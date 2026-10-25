# Multiplayer plan

How to turn this bots-only game into an online game where real players fight
each other, with bots filling the empty places. Hosting on Railway, the
database and player sign-in on Neon.

Prices and limits were checked in October 2026; check them again before you
commit to anything.

## The short version

- **One computer runs the real battle.** A game server on Railway runs the same
  game code we already run without graphics in the tests (soldiers, bullets,
  vehicles, captures, bots). Players' browsers send what they press and draw what
  the server says happened. Nobody's browser decides who got hit, so cheating
  is much harder.
- **Players connect over WebSockets** (a steady two-way connection a web page can
  open). Railway supports them on its normal secure web address. It does not
  accept UDP, the kind of traffic most big shooters use, but WebSockets are good
  enough at our size.
- **Bots fill every empty place.** A battle always has full sides. When a player
  joins, a bot leaves at its next death; when a player leaves, a bot takes over.
- **Neon holds the accounts and progress** (soldiers, loadouts, experience,
  unlocks, battle results) in a Postgres database.
- **Neon Auth handles sign-in** (email and password, Google, GitHub). Railway has
  no sign-in system of its own for players, so the "built-in auth" part comes
  from Neon. Neon Auth is still in beta; if it lets us down, we run the same
  sign-in library (Better Auth) ourselves on Railway, still storing users in Neon.
- **Guests can play at once.** Signing in is only needed to keep progress.
- **Cost at the start: about $5 to $10 a month.** Growing to a couple of hundred
  players at once: roughly $100 to $200 a month, most of it for data sent to
  players.

## What players will see

1. Open the game page. Play as a guest straight away, or sign in (email, Google
   or GitHub) to keep your soldiers and progress.
2. Pick a soldier on the Heroes screen as now.
3. Press **Quick battle**: the game finds a battle with room on your side (or
   starts one) and drops you in.
4. Fight alongside and against real players and bots. Names show who is who;
   the scoreboard marks bots.
5. At the end, experience and credits are worked out on the server and saved to
   your account.

## How the pieces fit

```
  Player's browser                          Railway                          Neon
 +------------------+   page and files   +-------------------+
 | the game page    | <----------------- | web service       |  accounts,   +-----------+
 | (draws, plays    |   sign-in, roster  | (files, roster,   | <----------> | Postgres  |
 |  sound, reads    | <----------------> |  shop, results)   |  progress    | database  |
 |  keys and mouse) |                    +-------------------+              +-----------+
 |                  |   WebSocket        +-------------------+                    ^
 |                  | <================> | game server       |  battle results    |
 |                  |   keys out,        | (runs the battles,|--------------------+
 |                  |   world state in   |  bots included)   |
 +------------------+                    +-------------------+
          |                                                                 +-----------+
          +-------------------- sign in -----------------------------------> | Neon Auth |
                                                                            +-----------+
```

- **The game page.** What we have now, plus a network layer. Served from
  Railway (or any file host or content delivery network).
- **Web service** (Node.js on Railway). Hands out the game files, keeps the
  roster and shop, receives battle results, and lists battles for matchmaking.
- **Game server** (Node.js on Railway). Each process runs several battles at
  once. Each battle is the game we have today running without graphics, stepped
  60 times a second, with a WebSocket for every player in it.
- **Neon Postgres.** Players, soldiers, loadouts, unlocks, results, reports.
- **Neon Auth.** Sign-in. After signing in, the page holds a short-lived signed
  token (a JWT, valid about 15 minutes, renewed in the background). The game
  server checks the token's signature with Neon's public keys (published at the
  sign-in address plus `/.well-known/jwks.json`) when a player connects, so it
  knows who they are without asking Neon every time.

## The network part, in plain terms

The hard part of an online shooter is making it feel instant when every
message takes time to travel. The usual tricks, which we would use:

- **The server is the referee.** It runs movement, bullets (with our real
  ballistics and flight time), damage, vehicles, grenades and captures. Browsers
  only suggest what their player wants to do.
- **Browsers send inputs, not results.** About 30 times a second: which keys are
  down, where the mouse points, "fire pressed". Each message is numbered.
- **The server sends snapshots.** About 20 times a second: where the soldiers
  and vehicles near you are and what they are doing, plus events (shots fired,
  hits, explosions, captures, kills). Only what is near enough to matter is
  sent to each player, which saves data and stops wall-hack cheats from seeing
  people across the map.
- **Your own soldier moves at once.** Your browser moves you straight away from
  your own inputs and quietly corrects you if the server disagrees (it usually
  agrees, since it runs the same code).
- **Everyone else is shown a moment in the past** (about a tenth of a second),
  gliding smoothly between snapshots instead of jumping.
- **Hits are judged as you saw them.** When you fire, the server rewinds the
  other soldiers to where your screen showed them, up to a limit (say a fifth of
  a second), so a good shot on your screen counts.
- **Vehicles** are run by the server from the driver's inputs. We start without
  predicting them in the driver's browser and add it if driving feels laggy.
- **Bots** run on the server, exactly as now.

Why WebSockets and not UDP: WebSockets run over TCP, which waits for a lost
piece of data before delivering later ones, so on a bad connection the game can
stutter for a moment. Small messages, 20 snapshots a second and smoothing in the
browser hide most of it. If it ever becomes a real problem, the game servers
alone can move to a host that accepts UDP (WebRTC data channels in the
browser), keeping everything else on Railway.

## Bots as fill

- Each battle has a size (for example 12 against 12). Empty places are bots.
- A joining player replaces a bot on their side when that bot next dies (or at
  once if it is far from the fight).
- A player who leaves is replaced by a bot after a short wait (so they can
  come back if they only dropped out).
- Bot skill can drift up or down a little to keep the sides even.
- A battle with no players left ends early or is paused, so it costs nothing.

The bots were upgraded for this (they now fight from cover, move up by turns,
throw grenades, bandage, search for enemies and hold posts), so a mostly-bot
battle is still a real fight.

## Keeping it fair

- The server decides everything that matters. The browser can't award itself
  hits, health, ammunition or experience.
- Inputs are checked: no moving faster than a soldier can, no firing faster than
  the gun, no impossible aim snaps every shot.
- Only nearby information is sent (see above).
- Limits on messages per second; a player who floods the server is dropped.
- Experience and credits are worked out on the server from what happened.
- Kick, ban and report tools, and logs to check reports against.

## Hosting on Railway

- **Services:** `web` (files, roster, matchmaking) and `game` (the battles). One
  Railway project with both, plus a staging copy for testing.
- **Region:** start in one region near most players. Railway has US West
  (California), US East (Virginia), EU West (Amsterdam) and Southeast Asia
  (Singapore). Add a second region when players elsewhere complain about lag.
- **Size of a battle:** measured with the headless battle harness, a battle of
  20 bots on the town map uses about 4 seconds of processor time per minute
  (about 7% of one processor core) and about 300 to 350 MB of memory. With real
  players and network work, plan on about 15% of a core and 400 MB per battle.
  A game server with 2 virtual processors and 2 GB of memory should run 6 to 8
  battles; we will measure it before relying on it.
- **Sleeping when empty:** with no players, a game server can stop, and start
  again when someone presses Quick battle (a few seconds' wait for the first
  player).

## Costs

Railway charges by use: $20 per virtual processor per month, $10 per GB of
memory per month and $0.05 per GB of data sent out. The Hobby plan is $5 a month
and includes $5 of use; Pro is $20 a month and includes $20 of use.

Neon's Free plan includes Neon Auth for up to 60,000 monthly active users, a
small database (0.5 GB) and computing that switches off after 5 minutes without
use (the first query after that takes a moment longer). The paid Launch plan
has a $5 monthly minimum, then $0.106 per compute-hour and $0.35 per GB stored
per month.

Rough monthly costs:

| Stage | What runs | Railway | Neon | Total |
| --- | --- | --- | --- | --- |
| Testing with friends | 1 battle at a time, a few players | $5 (Hobby, use covered) | $0 (Free) | about $5 |
| Small launch | up to 4 battles at once, about 50 players at busy times | $20 to $40 | $0 to $5 | about $20 to $45 |
| Growing | up to 15 battles, about 200 players at busy times, 8 busy hours a day | $100 to $200 | $5 to $20 | about $100 to $220 |

Most of the "growing" cost is data sent to players: at about 10 to 15 KB per
second per player, 200 players for 8 hours a day comes to 2 to 3 TB a month, or
$90 to $130. Sending less (only nearby soldiers, small numbers, fewer snapshots
when nothing moves) brings that down. Per player it is well under one cent per
hour of play.

## Plan of work

**Phase 0: get the game ready (about a week of work).**
Make the battle run as a server program with nothing that needs a browser (the
test harness already does most of this). Decide the messages between browser
and server. Add a way to record a battle and play it back, for finding bugs.

**Phase 1: play together (about 2 to 3 weeks).**
One game server on Railway, guest names only, no accounts. Up to 16 players and
bots in a town battle. Your own movement predicted, everyone else smoothed.
Vehicles driven through the server. Goal: you and friends can play a whole
battle together.

**Phase 2: accounts and progress (about 1 to 2 weeks).**
Neon database and Neon Auth (email, Google, GitHub). Soldiers, loadouts and
unlocks saved on the server; experience and credits awarded by the server at the
end of each battle. A guest can turn into an account without losing progress.

**Phase 3: make it feel right (about 2 to 3 weeks).**
Hits judged as the shooter saw them, vehicle prediction, sending only nearby
information, trimming data, reconnecting after a dropped connection, a battle
list and Quick battle, the fairness checks.

**Phase 4: run it for real (ongoing).**
More than one game server, battles started on demand, health checks, logs and
charts, database backups, report, kick and ban tools, a privacy policy and terms.

These times are for the work itself; testing with real players always turns up
more.

## Decisions for you

1. **Guests:** let people play without an account? (Recommended: yes.)
2. **Sign-in methods:** email and password, Google, GitHub? Discord is popular
   with players and could come later.
3. **Where most players are:** to pick the first region (US East is a safe
   start for North America, EU West for Europe).
4. **Battle size:** 12 against 12, or 16 against 16?
5. **Monthly budget ceiling:** so we can set spending limits on Railway.
6. **Accounts to create:** a Railway account and a Neon account (yours, so you
   own them). For Phase 1 only Railway is needed.

## Risks and fallbacks

- **Neon Auth is in beta.** Fallback: run Better Auth ourselves on Railway with
  the users in Neon. It is the same library, so the change is small.
- **No UDP on Railway.** Fallback: move only the game servers to a host that
  takes UDP if WebSockets prove too stuttery.
- **Browser games are easier to tamper with.** That is why the server decides
  everything.
- **A large download.** The game files should be compressed and cached so
  returning players start quickly.
- **Railway's raw TCP option** can't use a custom domain with a certificate, so
  the WebSockets go through Railway's normal secure web address instead.

## Sources

- Railway pricing: https://docs.railway.com/pricing/plans and
  https://docs.railway.com/reference/pricing/understanding-your-bill
- Railway regions: https://docs.railway.com/deployments/regions
- Railway TCP proxy (no UDP): https://docs.railway.com/networking/tcp-proxy
- Neon Auth: https://neon.com/docs/auth/overview and
  https://neon.com/docs/auth/guides/plugins/jwt
- Neon plans and prices: https://neon.com/docs/introduction/plans and
  https://neon.com/blog/major-compute-price-reduction-on-neon
