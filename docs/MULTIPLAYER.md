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
  from Neon. Neon Auth is Better Auth, run by Neon for us: the users live in
  our Neon database, and we use Neon's own client library, not a plain
  Better Auth one (Neon's sign-in addresses differ from Better Auth's
  defaults).
- **Guests can play at once.** Signing in is only needed to keep progress.
- **One shared war.** The Generals side becomes a single war that everyone
  takes part in, run on the server around the clock. Real players lead the
  armies as generals; computer generals fill in for an army that has too few.
  War battles are played by heroes on the game servers, with bots filling up
  the sides.
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
- **Neon Auth** (managed Better Auth). Sign-in. The page uses Neon's auth
  client (`createAuthClient` from `@neondatabase/neon-js/auth`, as Neon's
  React guide does now; the smaller `@neondatabase/auth` package works too).
  After signing in it holds a short-lived signed token (a JWT, signed with
  Ed25519, valid 15 minutes, renewed in the background with
  `authClient.token()`). The game server checks the token's signature and
  issuer with Neon's public keys (published at `NEON_AUTH_JWKS_URL`, which is
  the Neon Auth address plus `/.well-known/jwks.json`, using the `jose`
  library) when a player connects, so it knows who they are without asking
  Neon every time. The issuer to check is only the start of the Neon Auth
  address (`https://` and the host name, without the `/neondb/auth` part).
  Nothing of Neon's is needed on the game server beyond those public keys.
- **The page and Neon Auth are on different sites** (Railway and neon.tech).
  So the page must make its auth client with
  `fetchOptions: { credentials: 'include' }`, or it gets no token. Safari can
  also block the sign-in cookie between two sites; if Safari players can't
  stay signed in, the fix is to serve the sign-in address from our own web
  address (Neon's JWT page links to Better Auth's notes on this).
- **Check Neon's current docs before building on it.** Neon Auth moves fast
  and older guides (and AI tools trained on them) are often out of date.

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

## The shared war

Today each player has a private war in their browser: it moves only while
their Generals screen is open, and the computer leads the other two armies. In
multiplayer there is one war for everyone, as in the original game.

**What players will see**

- At the start of a war each player picks an army and stays with it until the
  war ends (the original locked players to one army for the whole war).
- The Generals tab shows the same map to everyone: who holds what, every
  army's assault teams that you can see, battles going on, war news.
- **Generals** (in the beta, chosen by hand; later, a soldier of rank 18
  promoted, or a General hired) each own their assault teams and warfunds,
  as in the original. They buy teams, set them down at their army's capitals
  within their own command points and send them along the supply lines. An
  army has many generals; they share the land and the capitals.
- **Heroes** (everyone) see their army's war battles in the battle list on the
  Heroes screen and join one. The battle runs on a game server like any other,
  with bots filling the empty places.
- A war battle nobody joins is settled on its own after a while (the original
  waited 10 minutes when one side had too few players, then settled it).
- The war runs whether anyone is looking or not. A general who logs off leaves
  his teams standing where they are; they still defend if attacked.
- Computer generals fill in for an army with too few human generals, the way
  bots fill a battle, so the war never stalls.
- 15 capitals win the war. The winners' generals get their reward, and a new
  war starts (generals keep their warfunds and teams, as now).

**How it fits the pieces**

```
   Generals' browsers --- orders (buy, set down, send) ---> war service ---> Neon
   Everyone's browsers <-- the map, teams, battles, news --  (on Railway)    (the war's state)
                                                            |        ^
                                         "battle at Berlin" |        | "attackers won, losses"
                                                            v        |
                                                          game server (the battle itself)
```

- **The war service** runs the war's rules (`src/war/war.js`, which needs no
  browser already) every few seconds and keeps the war in the database: the
  map's owners, the teams, the battles, the news. It can live inside the web
  service at first; it is light (a whole war day takes well under a second of
  processor time to work out).
- When teams meet, the war service asks a game server to open a battle and
  lists it for that army's heroes. When the battle ends the game server reports
  who won and the losses, and the war goes on from there, exactly as a battle
  the player fights now.
- Generals' orders are checked on the server (enough warfunds, enough command
  points, their own team), so nobody can give themselves teams or money.
- Browsers get the map's changes as they happen over the same kind of
  connection as the battles, so everyone sees teams move.

**What changes in the rules**

- Warfunds and command points become each general's own, not the army's.
- The war clock runs at real time (or a set speed; see Decisions). Today's 20
  times speed is for one player alone.
- Generals in the beta: a yes/no on each account, set by you from a small admin
  page. The rank 18 promotion and hiring for credits are already built and
  switch on later; hiring for real money needs payments (after accounts).

## Several battles at once

**Done (October 2026):** the server runs up to `MAX_BATTLES` battles at once
(default 3; each one is a full battle of bots and players, so a small Railway
machine may want fewer). A player joins a running battle his army fights in,
not yet decided and with a place for a player on his side (the fullest
first); if there is none, a new one opens where his army attacks: the Germans
against the Americans, the Americans and the Soviets against the Germans. So a
player of any army always has a battle, and players of the same army play
together. With every battle running and full: "Every battle is full right
now."

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
  **Done (October 2026):** each player in an online battle has his own ribbon
  tally on the server (`s.tally`), fed by the same game code as the browser's.
  When the battle is decided, or when he leaves before (the pause menu sends
  `{ k: 'l' }`, or the connection drops), the room works out his rewards with
  `src/game/rewards.js` (the same rules as a battle on your own computer) and
  `src/server/progress.js` `awardStored` adds them to the soldier kept in the
  database; he is sent them as `{ k: 'g', result, soldier, roster, rev }` and
  the results screen shows them. Joining uses the kept soldier's army, class
  and what he has opened and owns, not what the browser says. A save from the
  browser (`PUT /api/progress`) goes through `keepEarned`: names, loadouts,
  badges worn, recruits and soldiers sent home are his to change, but
  experience, ribbon points and records stay as kept, and credits only go
  down, by the price of what he bought (purchases he can't pay for, or of
  things not opened to him, are undone, and the browser is sent the corrected
  roster). Signed in, a battle on your own computer is practice: no
  experience or credits. The one way round it left: progress already in a
  browser is taken as it is the first time an account saves.
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

*Phase 0 is done.* What there is now:

- `src/server/battle.js`: a battle with no graphics, as the game server will
  run it (the tests use the same one). Each battle has its own village and
  collision world; tanks and cars are built from their real models.
- Every roll of the dice that decides what happens in a battle (spread,
  recoil, ricochets, armour, fires, the bots' choices) comes from the
  battle's own seeded stream (`rand` in `src/core/math.js`), and soldiers,
  vehicles and bullets are numbered within their battle. So a battle with the
  same seed and inputs plays out exactly the same, even with other battles
  run in the same program: the server is the one true version.
- `src/net/protocol.js`: the messages. Inputs name actions (not keys) and
  carry where the player faces; snapshots carry every soldier, vehicle and
  capture point in whole numbers; events carry shots, deaths and blasts.
  `RemoteInput` is the server's stand-in for a player's keyboard: it answers
  the same questions as the real one, so the same controls can drive a
  soldier on the server.
- `src/server/record.js`: recording a battle (settings, seed, inputs, a
  fingerprint every second) and playing it back to check it goes the same
  way.
- `server/battle.mjs` runs a battle like the server will and reports on it;
  `server/replay.mjs` plays a recording back.

Measured with `node server/battle.mjs --fast` (12 against 12, bots): a battle
starts in about 3.5 seconds and needs about 8 to 12% of one processor core in
real time. A snapshot is about 1.7 KB, 0.7 KB squeezed the way WebSocket
messages are, which at 20 a second is about 13 KB a second for each player,
in line with the costs above.

*Found for Phase 1.* On the player's own screen the gun's real direction
comes from the first-person gun model as it moves (sway, recoil, the sights
coming up), worked out while drawing. On the server the player's controls
need that without the drawing: the gun's aim and the "gun is up" moment as
plain numbers, with the browser sending where its gun pointed for each shot
and the server checking it is believable (close to where he faces, no faster
than the gun fires). The first job of Phase 1 is to split those numbers out of
the drawing (`src/game/player.js` and `src/weapons/viewmodel.js`).

**Phase 1: play together (about 3 to 4 weeks).**
One game server on Railway, asleep when nobody plays. Sign-in with Neon Auth
(no guests), so players are named and known from the first battle. Up to 16 players and
bots in a town battle. Your own movement predicted, everyone else smoothed.
Vehicles driven through the server. Goal: you and friends can play a whole
battle together.

*Phase 1 so far.* The gun's state the rules need is kept apart from the
drawing (`src/game/gunHold.js`: up after a switch, sights up), and the
player's own controls (`src/game/player.js`) run with no screen when given
`{ view: false }` and the server's stand-in keyboard. `addPlayer` in
`src/server/battle.js` puts a player in a server battle; his input messages
move, aim, fire and switch his guns, and a battle with players in it
records and plays back exactly (`tests/remotePlayer.test.js`). On the server a
shot leaves along where he faces with his sway; later the browser will send
where its gun pointed and the server will check it. Then the game server (`server/main.mjs`, `npm start`, what Railway runs): it
hands out the game's files (and nothing else of the repo), answers `/health`,
and players play over a WebSocket at `/play`. A player's first message
carries his Neon Auth sign-in token, checked against Neon's public keys
(`src/server/auth.js`; `NEON_AUTH_JWKS_URL` on Railway), and the soldier he
brings, whose loadout is checked against his army, class and points. One
battle at a time (`src/server/room.js`): it opens with the first player, runs
60 steps a second, sends each player 20 snapshots a second, hands a leaving
player's soldier to a bot, and closes a minute after the last player leaves,
so the server idles and Railway can put it to sleep. `tests/gameServer.test.js`
plays it over real WebSockets. Signing in: the browser
never talks to Neon directly. It calls `/api/auth/...` on the game's own
address and the server passes it on to Neon Auth
(`src/server/authProxy.js`, written after Neon's own server toolkit: only a
few headers each way, only Neon Auth's cookies, every cookie made the game
address's own, Secure and SameSite=Lax), so browsers that block other sites'
cookies (Safari) keep players signed in. `src/net/auth.js` holds the calls
(sign in, create an account, the session and its 15-minute token);
`src/ui/signIn.js` is the screen, shown first when the page comes from the
game server (`/api/config` answers) and never in the offline copy. Email and
password for now; Google needs Neon's redirect back to the game, later.
Then the battle in the browser (`src/net/online.js`): signed in, "Change
battle" offers "Online battle". The page joins the server's battle before the
map loads (the server says the side, the armies and the battle's dice; the
first player's army attacks), then builds the town as usual with no bots,
jeeps or bikes of its own (`AssaultMode` with `online: true` only shows
points and time). Everyone else and every vehicle is a puppet, placed from
the snapshots a tenth of a second behind and gliding between them. The
player's own soldier moves at once from his keys and is quietly put right
when the server saw him elsewhere (a quarter second's correction, or at once
when more than 3 m off). He sends his keys and where he looks 60 times a
second. Every round fired on the page is drawn only: hits, wounds, deaths,
blasts and points come from the server alone (`Soldier.hit` and `damage` do
nothing online). Getting into a vehicle happens at once on the page and
follows the server if it disagrees for half a second. Down, he picks where
to come back in on the same deploy map as offline; the choice goes with his
inputs, and the server puts him there once that point's wait is over (at the
front instead if the point is no longer his side's to spawn at, and after a
minute if he chooses none). `node tools/online.mjs` plays it
with two browsers on one computer (the server with `ALLOW_DEV_NAMES=1`,
`?dev=Name` instead of an account). A joining player takes a bot's place:
one bot on his side (a fallen one first, tank crews last) fights on until he
falls and is then gone for good, so the sides keep their size; a player who
leaves is taken over by a bot. Next: battle sizes by map, and trying it on
Railway.

*Neon is set up (October 2026).* What there is now:

- A Neon project, `hng` (`weathered-credit-22128237`, organisation
  `org-jolly-voice-46897785`), in AWS US West 2 (Oregon), close to Railway's
  US West. Its main branch is `production`.
- Neon Auth is on for that branch. Email and password sign-in is on (checking
  the email address is off for now). Google sign-in works with Neon's shared
  test keys. GitHub is not added yet. No sites are on its allowed list yet;
  `localhost` is always allowed.
- `neon.ts` (in the repo) lists the Neon services the project has: Postgres
  and Neon Auth. `neon deploy` makes the branch match it, and saves the
  branch's settings into `.env.local`. `@neon/config` and `@neon/env` were
  added to `package.json` for it.
- Two files stay on your computer and out of git: `.neon` (which project and
  branch this folder uses; no secrets in it) and `.env.local` (the secrets).
  `.env.local` holds `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_BRANCH`,
  `NEON_AUTH_BASE_URL` and `NEON_AUTH_JWKS_URL`.

To set up a fresh copy (a new computer or cloud session), install the Neon
command-line tool (`npm i -g neon@latest`), set `NEON_API_KEY` (or run
`neon login` to sign in through the browser), then:

```bash
neon link --org-id org-jolly-voice-46897785 --project-id weathered-credit-22128237 --branch production
neon deploy
```

Still to do before real players sign in:

- Add the game's Railway address to Neon Auth's allowed sites
  (`neon neon-auth domain add https://...`) once it has one.
- Use our own Google keys (the shared ones are for testing), add GitHub, and
  turn on email checking with a real email sender (Neon's production
  checklist).

**Phase 2: accounts and progress (about 1 to 2 weeks).**
Neon database and Neon Auth (email, Google, GitHub). Soldiers, loadouts and
unlocks saved on the server; experience and credits awarded by the server at the
end of each battle. A guest can turn into an account without losing progress.

*Phase 2 so far.* Each account's progress is kept in Neon's Postgres: one
row an account in a `progress` table (made by the server the first time it
is needed) with his soldiers (the roster: experience, credits, guns,
upgrades, ribbons, badges, loadouts) and his war, as JSON, and a revision
number. The game server answers `/api/progress` (`src/server/progress.js`,
`src/server/progressStore.js`): GET loads, PUT saves, signed in with the same
Neon Auth token as battles; a save based on an older revision is refused
with what is there now. In the browser (`src/net/progress.js`) the game
still reads and writes its soldiers and war as before; signing in loads the
server's copy first, every save (`src/core/saved.js`) goes to the server two
seconds later (at once when the page closes), and a newer copy saved from
another computer wins and the page reloads to show it. A new account takes
the progress already played in that browser, unless another account claimed
it first. Settings (graphics, keys) stay with each computer. On Railway it
needs `DATABASE_URL` (Neon's connection string, pooled); without it the
server says so and progress stays in each browser as before. Tests:
`tests/progress.test.js` (with `TEST_DATABASE_URL` it also runs against a
real Postgres). Still to come: the server working out each online battle's
experience and credits itself, so they can't be faked.

**Phase 3: the shared war (about 2 weeks).**
The war service on Railway with the war kept in Neon. Generals (chosen by hand
for the beta) give orders from the Generals tab; everyone sees the same map.
War battles open on the game servers and their results go back into the war.
Computer generals fill in for empty armies. An admin page to choose generals.

*Phase 3 is done (October 2026).* One war runs on the game server
(`src/server/warService.js`), kept in Neon (`war_state`, saved every 30
seconds and when the server stops) and run on in real time, `WAR_SPEED` times
faster (6 by default). Its generals are chosen on the admin page (`generals`
table); an army with no general, or whose generals have all been away a day,
is led by the computer. Signed in, the Generals tab shows that war: everyone
sees the same map (sent over `/lobby` every two seconds while the menus are
open), and only a general can give his army orders, which the server checks
with the same rules as the offline war (`src/war/war.js`). A war battle waits
`WAR_BATTLE_WAIT` minutes (10 by default) for players; a soldier of either
army joins it from the Generals tab or the battle chooser, and it opens as an
online battle with that battle's two armies. While it is being fought the war
waits for it, and the winner goes back into the war; if everyone leaves first,
it settles on its own. Heroes earn their army warfunds (40 a man put down,
250 a point taken). When a war is won, the next begins ten minutes later; the
admin page can also start one at once. The offline copy keeps its own war in
the browser, as before. Tests: `tests/sharedWar.test.js`.

**Phase 4: make it feel right (about 2 to 3 weeks).**
Hits judged as the shooter saw them, vehicle prediction, sending only nearby
information, trimming data, reconnecting after a dropped connection, a battle
list and Quick battle, the fairness checks.

**Phase 5: run it for real (ongoing).**
More than one game server, battles started on demand, health checks, logs and
charts, database backups, report, kick and ban tools, a privacy policy and terms.

These times are for the work itself; testing with real players always turns up
more.

## Decisions made (October 2026)

- **Host:** Railway (account already made). Region US West (California); it
  plays fine from anywhere in the US (about 60 to 80 ms from the east coast).
- **Budget:** $5 to $10 a month: the Hobby plan, whose $5 includes $5 of use.
- **Only running while people play:** the game server uses Railway's
  Serverless setting (Settings > Deploy > Serverless). With nobody connected
  for 10 minutes it goes to sleep and costs nothing; the next player's
  connection wakes it (the browser shows "Waking the server" and tries again
  for a few seconds). Neon's free database also sleeps after 5 idle minutes.
- **No guests:** everyone signs in, so sign-in (Neon Auth, free up to 60,000
  players a month) comes in Phase 1, with the first battles, instead of
  Phase 2.
- **Battle size:** set by each map, from 12 to about 30 a side (the Town map
  as now); bots fill whatever players don't.
- **WebSockets, not UDP.** UDP is the faster kind of connection big shooters
  use, but a web page can't use it directly; it would take WebRTC or
  WebTransport and a host that accepts UDP, for a gain a WWII battle at our
  size won't feel. Railway and WebSockets are kept; the game servers alone can
  move later if it ever matters.

At these numbers: a battle costs about $0.01 an hour to run plus about $0.002
an hour for each player's data, so 10 players for 2 hours every evening comes
to about $2 a month, inside the Hobby plan's $5.

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
7. **War speed:** real time, as in the original (a war lasts several days and
   teams take a few minutes to march between towns), or faster (say 4 times,
   for wars of a day or two while there are few players)?
8. **One war or several:** one war for everyone (recommended at first), or a
   war per region later?
9. **Beta generals:** about how many, so each army has a few.

## Risks and fallbacks

- **Neon Auth is newer than most of Neon.** It is managed Better Auth, so if
  it ever lets us down we could run Better Auth ourselves with the same users
  in Neon; the game server would only change where it reads the public keys.
- **No UDP on Railway.** Fallback: move only the game servers to a host that
  takes UDP if WebSockets prove too stuttery.
- **Browser games are easier to tamper with.** That is why the server decides
  everything.
- **A large download.** The game files should be compressed and cached so
  returning players start quickly.
- **Railway's raw TCP option** can't use a custom domain with a certificate, so
  the WebSockets go through Railway's normal secure web address instead.
- **A war with few players.** One army can run away with it. Computer generals
  fill empty armies, and the war can pause or slow when nobody is on.

## Sources

- Railway pricing: https://docs.railway.com/pricing/plans and
  https://docs.railway.com/reference/pricing/understanding-your-bill
- Railway regions: https://docs.railway.com/deployments/regions
- Railway TCP proxy (no UDP): https://docs.railway.com/networking/tcp-proxy
- Neon Auth: https://neon.com/docs/auth/overview,
  https://neon.com/docs/auth/guides/plugins/jwt and
  https://neon.com/guides/react-neon-auth-hono (a separate backend checking
  Neon Auth's tokens); neon-auth vs better-auth notes:
  https://github.com/neondatabase/neon-js/blob/main/packages/auth/neon-auth_vs_better-auth.md
- Neon setup from the command line: https://neon.com/docs/cli/init,
  https://neon.com/docs/cli/link, https://neon.com/docs/cli/deploy and
  https://neon.com/docs/reference/neon-ts
- Neon Auth before launch: https://neon.com/docs/auth/guides/configure-domains
  and https://neon.com/docs/auth/production-checklist
- Neon plans and prices: https://neon.com/docs/introduction/plans and
  https://neon.com/blog/major-compute-price-reduction-on-neon
