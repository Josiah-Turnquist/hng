I could not write `/tmp/claude-0/-home-user-hng/7bd4bb68-678e-57c7-90b0-5e2c6d9e530b/scratchpad/research-hng-battle.md`: the harness refused report files from this agent ("return findings as text"). The full report is below; please save it to that path and append the contents of `/tmp/claude-0/-home-user-hng/7bd4bb68-678e-57c7-90b0-5e2c6d9e530b/scratchpad/tables.md` as Appendix A. That file holds tables T1–T10, which the report refers to.

## Summary

**Access was limited.** The proxy blocked fandom, Steam, Reddit, archive.org, YouTube and Wikipedia pages, so WebFetch failed. Web facts come from search-result summaries of those pages, not full pages. No Reddit, YouTube or archive.org snapshots were read. The 200-search budget ran out mid-research, so some items are marked unconfirmed.

**Main source: the game's own data.** A fan project on GitHub published JSON dumps of the live server data, last updated 21 Jan 2023. They contain weapons, ammo, mods, vehicles, maps, capture-point coordinates, mission presets and badges. Many values match the wiki exactly (Kar98k reload, rate of fire and sway; Garand 276.5 rpm; Heavy Set 92/89/85 %).

**Key findings:**
- **Modes and team sizes:** Assault, Skirmish (3 points, slider to 100) and Encounter (one point). Battles were 18 v 18; encounters 12 v 12 (16 for tank, pilot and recon versions).
- **Assault rules:** points are captured in sequence along lines A–E. Capture times are 30+30 s for normal points, 45+45 s for objectives and 90 s for access points. Defenders have 30 minutes, attackers get +2 min per capture, and sudden death follows.
- **Spawning:** delay is 10 s + 0.5 s per link (more for tanks). An underdog pool shortens delays for the smaller team, and spawns lock near contested points (80 m / 10 s rule).
- **Maps:** five assault maps covered 4,290 war-map towns.
- **Damage:** head ×4 (some say ×5), body ×1, legs ×0.8, arms ×0.5, on roughly 100 HP (inferred). Unmodified rifles needed 3 body hits in the 2023 data.
- **Ballistics and aiming:** bullets are projectiles with adjustable sight ranges.
- **Vehicles:** the tank driver also fires the main gun. Damage is component-based, and repair uses a wrench.
- **Probably absent:** bleeding and bandages, lean, vault and hold breath. None were found.
- **Praised:** atmosphere and realism. **Criticised:** headshot balance, netcode, visibility, the Armour 2.0 update, and grind.

## Files

- `/tmp/claude-0/-home-user-hng/7bd4bb68-678e-57c7-90b0-5e2c6d9e530b/scratchpad/tables.md`: Appendix A, tables T1–T10
- `/tmp/claude-0/-home-user-hng/7bd4bb68-678e-57c7-90b0-5e2c6d9e530b/scratchpad/scripts/tables.py`: regenerates the tables
- `/tmp/claude-0/-home-user-hng/7bd4bb68-678e-57c7-90b0-5e2c6d9e530b/scratchpad/dl_hagcp/json/`: the downloaded JSON

=================== FULL REPORT (save as research-hng-battle.md) ===================

# Heroes & Generals: how battles played (research for a faithful fan recreation)

Prepared 2026-10-23. This covers the first-person "Action Game" battles of Heroes & Generals (Reto-Moto, later TLM). The servers shut down on 25 May 2023 ([Game Developer](https://gamedeveloper.com/business/wwii-mmo-i-heroes-generals-i-shuts-down), [Wikipedia](https://en.wikipedia.org/wiki/Heroes_%26_Generals)). The strategic war map is covered only where it changes battle rules.

## How to read this report

There are two kinds of evidence.

1. **`[data]`: the game's own server metadata.** The fan "Heroes and Generals community project" published JSON dumps of the live game's database tables at <https://github.com/raouldeheer/Heroes-and-Generals-community-project/tree/main/packages/hagcp-assets/json>. The last data commit is 21 Jan 2023 ("Updated assets"), about four months before shutdown ([commit history](https://github.com/raouldeheer/Heroes-and-Generals-community-project/commits/main/packages/hagcp-assets/json)).
   - The numbers are primary, but the meaning of each field is not documented. Where I interpret a field, I say so and mark it unconfirmed.
   - Each claim names its JSON file. The raw files are at `https://raw.githubusercontent.com/raouldeheer/Heroes-and-Generals-community-project/main/packages/hagcp-assets/json/<file>.json`.
2. **Web sources:** the two Fandom wikis (heroesandgenerals.fandom.com, which calls itself the "Official H&G Wiki", and heroes-generals.fandom.com), Steam discussions, news and guides, gamepressure guides, news sites and reviews.

**Limitations:**
- The proxy blocked direct fetches of fandom.com, steamcommunity.com, store.steampowered.com, reddit.com, archive.org, youtube.com, wikipedia.org and the review sites. Web facts therefore come from **search-engine summaries** of those pages, which are paraphrased and sometimes truncated. Where possible, numbers were cross-checked against `[data]` (section 0).
- No Reddit threads, YouTube descriptions or archive.org snapshots of wiki.heroesandgenerals.com could be read.
- The search budget ran out before every planned query was made. Anything not found is marked **unconfirmed**.
- H&G changed constantly between 2013 and 2023. Wiki pages are of mixed age, while `[data]` reflects late 2022 to January 2023. Where they disagree, both values are given.

---

## 0. Cross-check: where `[data]` and the wiki agree

| Check | Wiki / web | `[data]` |
|---|---|---|
| Kar98k reload / scoped reload | 3.7 s / 5.2 s ([wiki Kar98k](https://heroesandgenerals.fandom.com/wiki/Karabiner_98_Kurz)) | reloadtime 3.7, reloadtimescoped 5.2 (weapontemplate.json) |
| Kar98k rate of fire | 42.11 rpm (same page) | 60 / (chambertime 1.125 + recoiltime 0.3) = 42.1, so **rpm = 60/(chambertime + recoiltime)** |
| Kar98k sway | 1 / 0.3 / 0.15 (stand/crouch/prone), aim modifier 0.15, fatigue 4 | identical |
| Fast Reload badge on Kar98k | 3.15 / 2.87 / 2.59 s ([wiki Kar98k](https://heroesandgenerals.fandom.com/wiki/Karabiner_98_Kurz), [Fast Reload CB](https://heroesandgenerals.fandom.com/wiki/Fast_Reload_CB)) | 3.7 × 0.85 / 0.77 / 0.70 (combatbadgetemplate.json) |
| M1 Garand | 8 rounds, 2.8 s reload, ~276.5 rpm ([wiki M1 Garand](https://heroesandgenerals.fandom.com/wiki/M1_Garand)) | clipsize 8, reload 2.8, recoiltime 0.217 → 276.5 |
| M2 Carbine cone | 0.35° ([wiki M2 Carbine](https://heroesandgenerals.fandom.com/wiki/M2_Carbine)) | baseconefire 0.35 |
| Bazooka sight steps | 50/100/150 m, default 50 ([wiki Previous Changelogs](https://heroesandgenerals.fandom.com/wiki/Previous_Changelogs)) | 50–150, 3 steps, default 50 |
| Bazooka M9A1 | 50–500 m in 50 m steps, reload 3.4 s ([wiki Bazooka M9A1](https://heroesandgenerals.fandom.com/wiki/Bazooka_M9A1)) | identical |
| Panzerfaust 60 | reload 3.3 s, 70 m/s ([wiki Panzerfaust 60](https://heroesandgenerals.fandom.com/wiki/Panzerfaust_60)) | identical |
| Heavy Set badge | 92 / 89 / 85 % damage taken ([wiki Combat Badge](https://heroesandgenerals.fandom.com/wiki/Combat_Badge)) | 0.92 / 0.89 / 0.85 |
| First Aid badge | +40/60/80 % faster health recovery ([wiki Combat Badge](https://heroesandgenerals.fandom.com/wiki/Combat_Badge) / [Combat Ribbons](https://heroesandgenerals.fandom.com/wiki/Combat_Ribbons), via summary) | 0.72 / 0.625 / 0.56 time multipliers (1/0.72 ≈ 1.39 …) |
| Airfield unlocks | B2 or C2 unlock O1, D2 unlocks O2, A2 unlocks O3 ([wiki Airfield](https://heroesandgenerals.fandom.com/wiki/Airfield)) | same links (CapturePointConnectionTemplate.json) |
| Battle size | 18 v 18 ([Steam: Players Per Game](https://steamcommunity.com/app/227940/discussions/0/520518053440147942/)) | maxPlayerCount 36 for Assault and Skirmish (missionpreset.json) |

**Disagreements:**
- Kar98k muzzle velocity: 898.95 m/s on the wiki, 852 m/s in `[data]`.
- MG42 velocity: 749.76 m/s on the wiki ([wiki MG42](https://heroesandgenerals.fandom.com/wiki/Maschinengewehr_42)), 852 in `[data]`.
- Bolt-action near damage: 52–56 on older wiki pages ([wiki M1903](https://heroesandgenerals.fandom.com/wiki/Rifle_M1903), [wiki Mosin](https://heroesandgenerals.fandom.com/wiki/Mosin-Nagant_M91/30)), 47–49 for the `[data]` default ammo. These are probably different patch versions or ammo types.

---

## 1. Battle game modes and rules

### 1.1 Battle categories and unlocks
- There were **staged battles** with equal assault teams, and **war battles** where the teams depended on what the generals sent ([wiki Action Rules](https://heroesandgenerals.fandom.com/wiki/Action_Rules); [Mein-MMO 2017](https://mein-mmo.de/en/heroes-generals,171261/)). Training missions gave the same rewards but did not affect the war ([wiki Action Rules](https://heroesandgenerals.fandom.com/wiki/Action_Rules)).
- Unlocks:
  - First Encounter from player level 1 and Skirmish from level 2. This comes from a fandom "Game Modes" search snippet whose page URL I did not capture, so it is **unconfirmed**.
  - Assault from player level IV ([Wikipedia](https://en.wikipedia.org/wiki/Heroes_%26_Generals)).
  - In `[data]` missionpreset.json, "Beginner" training encounters are for player levels 0–2. Other training presets need level 3.

### 1.2 Team sizes, bots and squads
- **Max players** (`[data]` missionpreset.json, maxPlayerCount):

  | Mode | Max players |
  |---|---|
  | Assault | 36 (18 v 18) |
  | Skirmish | 36 |
  | Infantry Encounter | 24 (36 on the Russian Encounter map) |
  | Tank / Pilot / Recon Encounter | 16 |

- The forums agree on 18 v 18 ([Steam: Players Per Game](https://steamcommunity.com/app/227940/discussions/0/520518053440147942/), [Steam: How many players per map?](https://steamcommunity.com/app/227940/discussions/0/343787283755106429/)).
  - A post attributed to a developer says "18vs18 and we plan to go to 24vs24". It is in one of the Steam player-count threads, e.g. [So, what's the player count?](https://steamcommunity.com/app/227940/discussions/0/41973820614571154) or [Max player count?](https://steamcommunity.com/app/227940/discussions/0/45350791329609130). The exact thread and the attribution are not verified, and there is no sign the increase happened.
  - Fighter pilots could join beyond 18 (Players Per Game thread).
- **Bots:** `[data]` aiSaBotCountPerFaction is 18 for Assault, 10 for Skirmish, 4–6 for infantry Encounter and 12 for specialist encounters. My reading is that this is the number of bots per side (**unconfirmed**). The beginner First Encounter used bots as opponents ([heroes-generals wiki Encounter](https://heroes-generals.fandom.com/wiki/Encounter)).
- **Soldiers per player:** only 30 soldiers per faction could be used in the Action Game ([wiki Characters](https://heroesandgenerals.fandom.com/wiki/Characters); `[data]` maxCharactersPerPlayer 30).
- **Squads:**
  - Default squad slots in `[data]` (SquadPlayerSlotTemplate.json): infantry 4, paratrooper 4, tank crew 3, recon 2, pilot 2.
  - An older forum post says infantry squads were capped at 6 ([Steam: Squad size?](https://steamcommunity.com/app/227940/discussions/0/34095051751842059/)).
  - Update 1.12 (2018) introduced fixed squad sizes and removed the auxiliary-seat feature ([PCGamesN](https://www.pcgamesn.com/heroes-generals/update-112-deploy-drive-destroy)).
  - The squad leader needed rank 6 to give orders and could change the squad's spawn point for the whole squad ([wiki Squads](https://heroesandgenerals.fandom.com/wiki/Squads)).

### 1.3 Assault
- **Structure:**
  - Attackers enter at access points A1, B1, C1, D1 and E1, one per line ([wiki Capture Points](https://heroesandgenerals.fandom.com/wiki/Capture_Points)).
  - Each line is a chain of points (X1 → X2 → X3, sometimes X4) that ends at a main objective O1, O2 or O3 (`[data]` CapturepointTemplate.json and CapturePointConnectionTemplate.json; see 3.4).
  - Main points are linked by smaller positions that must be taken first ([Wikipedia](https://en.wikipedia.org/wiki/Heroes_%26_Generals)).
- **Number of objectives:** 2 on Town, Mountain Town and Factory; 3 on Airfield and Forward Airfield ([wiki Mission Objective](https://heroesandgenerals.fandom.com/wiki/Mission_Objective); `[data]`).
- **Capture order:** you can only capture a point that is connected to a friendly point and unlocked ([wiki Action Rules](https://heroesandgenerals.fandom.com/wiki/Action_Rules), [wiki Capture Points](https://heroesandgenerals.fandom.com/wiki/Capture_Points)).
- **Capture times** (same pages):

  | Point type | To neutral | To capturing team |
  |---|---|---|
  | Standard point | 30 s | +30 s |
  | Objective | 45 s | +45 s |
  | Access point |: | 90 s, direct (no neutral step) |

  - `[data]` missiontype.json "Assault" stores 1000/240 (points), 800/450 (objectives) and 1000/240 (access points). The units are unknown and do not map to the wiki's seconds (**unconfirmed**).
- **Effect of player count:**
  - The more players on a point, the faster it goes. Being 5 players up captures faster than being 1 up ([wiki Capture Points](https://heroesandgenerals.fandom.com/wiki/Capture_Points)).
  - An old build note says the 2nd capturer adds half as much as the 1st, the 3rd half as much as the 2nd, and so on, with everyone credited equally ([wiki Previous Changelogs](https://heroesandgenerals.fandom.com/wiki/Previous_Changelogs), Eisenhower build 56009).
  - In a contested zone the side with more soldiers captures ([heroes-generals wiki Skirmish](https://heroes-generals.fandom.com/wiki/Skirmish)).
- **Tanks and capturing:** on Airfield, O1 (the hangar) is the only point tanks can capture ([wiki Airfield](https://heroesandgenerals.fandom.com/wiki/Airfield)). That suggests vehicle capture was allowed per point. Whether other maps worked the same way is **unconfirmed**.
- **Timer:** defenders must hold for 30 minutes. Attackers gain **+2 minutes per capture**, less for re-capturing the same point ([wiki Assault](https://heroesandgenerals.fandom.com/wiki/Assault), [wiki Capture Points](https://heroesandgenerals.fandom.com/wiki/Capture_Points)).
- **Winning** ([wiki Assault](https://heroesandgenerals.fandom.com/wiki/Assault), [wiki Action Rules](https://heroesandgenerals.fandom.com/wiki/Action_Rules), [Wikipedia](https://en.wikipedia.org/wiki/Heroes_%26_Generals)):
  - Attackers must take **all** objectives.
  - Defenders win by holding all objectives until the timer runs out, **or** by capturing every attacker access point.
  - **Sudden death:** if both sides hold at least one objective when time expires, the first side to hold all objectives wins ([wiki Assault](https://heroesandgenerals.fandom.com/wiki/Assault), [wiki Starter Guide](https://heroesandgenerals.fandom.com/wiki/Starter_Guide)).
  - On the war map, attackers who capture nothing in 30 minutes are pushed back to the previous map point (wiki, via summary).
- **Outdated rule:** an early tutorial said the attack timer paused while attackers held a "victory point" ([wiki Basic Game Tutorial – outdated](https://heroesandgenerals.fandom.com/wiki/Basic_Game_Tutorial_-_outdated)).
- **Hard time limit:** `[data]` timelimit is 10000 in every preset. If that is seconds, it is about 2 h 47 min (**unconfirmed**), which fits the wiki's "3-hour timeout" ([wiki Action Rules](https://heroesandgenerals.fandom.com/wiki/Action_Rules)).
- `[data]` also has "Assault Small" presets on the same maps. How they differed is **unconfirmed**.

### 1.4 Skirmish ("Capture & Hold")
- **Layout:** three points, one near each spawn and one in the middle ([heroes-generals wiki Skirmish](https://heroes-generals.fandom.com/wiki/Skirmish), [wiki Skirmish](https://heroesandgenerals.fandom.com/wiki/Skirmish)). They can be taken in any order, 30 s to neutral plus 30 s to capture. There are no capturable access points ([wiki Action Rules](https://heroesandgenerals.fandom.com/wiki/Action_Rules)).
- **Winning** ([wiki Action Rules](https://heroesandgenerals.fandom.com/wiki/Action_Rules), [wiki Victory conditions](https://heroesandgenerals.fandom.com/wiki/Victory_conditions)):
  - Each side has a score slider that rises while it holds more zones. The first to 100 wins.
  - Holding 2 more zones than the enemy fills it at double speed, and more contested zones slow it down.
  - A side also wins if the enemy runs out of lives.
  - After a 3-hour timeout the defenders win.
  - The heroes-generals wiki frames it as needing 1 point if the enemy has none, or 2 if the enemy has one.
  - Wikipedia's "hold three points" wording conflicts with both.
- Fighter pilots could not play Skirmish maps; paratroopers could ([heroes-generals wiki Skirmish](https://heroes-generals.fandom.com/wiki/Skirmish)).
- On the war map, skirmishes happened when assault teams met on a supply line between towns ([wiki Action Rules](https://heroesandgenerals.fandom.com/wiki/Action_Rules)).
- `[data]`: objectiveHoldTime 180, 36 players, objectives O1–O3 and spawns A and B.

### 1.5 Encounter
- **Encounter:** one point, "King of the Hill" style; hold it until your team's bar fills ([heroes-generals wiki Encounter](https://heroes-generals.fandom.com/wiki/Encounter), [Wikipedia](https://en.wikipedia.org/wiki/Heroes_%26_Generals)). One player called it "a skirmish with only 1 point that captures faster" ([Steam](https://steamcommunity.com/app/227940/discussions/0/483368526587930273/)).
- **First Encounter:** played against bots, one point, about 10 minutes.
- `[data]`:
  - objectiveHoldTime is 300. A 5-minute hold to win is my reading (**unconfirmed**).
  - Samrée Depot and Colmar Hamlet have 1 objective. The "Russian Encounter" map has 3.
- **Specialist encounters** (`[data]`): Tank, Pilot and Recon presets on **Lunéville**, with a single central objective, 16 players and a 600 hold time. Gorge and Canal Bridge versions are marked unavailable. The wiki lists Lunéville under "Tank/Pilots" ([wiki List of Maps](https://heroesandgenerals.fandom.com/wiki/List_of_Maps)).

### 1.6 Unreleased modes in the data
- `[data]` defines "Destruction" ("Blow some stuff up to complete the mission") and "Supply" (placeholder text).
- The only Supply preset is "Mountain Railroad", marked unavailable.
- Whether either was ever playable is **unconfirmed**.

### 1.7 Reinforcements, tickets and manpower
- **Tickets:** in war battles each soldier or vehicle spawn was drawn from the assault teams' resources. "Army Resources" was the number of tickets, i.e. spawns, a team supplied ([wiki Basic Game Tutorial – outdated](https://heroesandgenerals.fandom.com/wiki/Basic_Game_Tutorial_-_outdated)). Each spawn was deducted at random from an assault team of a similar class ([wiki Assault Team](https://heroesandgenerals.fandom.com/wiki/Assault_Team)).
- **Where resources came from:** cities produced manpower and factories produced vehicles and planes ([PCGamesN](https://www.pcgamesn.com/HeroesandGenerals/heroes-and-generals-everything-we-know), via summary).
- **Limited Supply:** gamepressure mentions this balancing mechanic, but its details are **unconfirmed** ([gamepressure](https://www.gamepressure.com/heroesandgenerals/assault-teams-basic-information/z47616)).
- **Running out:** in Skirmish, running out of lives loses ([wiki Action Rules](https://heroesandgenerals.fandom.com/wiki/Action_Rules)). What happened in Assault when resources ran out is **unconfirmed**.
- **`[data]` deployPoolCost:**
  - Classes: rifleman 10, paratrooper 28, recon 60, tank crew 100, pilot 100. The "off-class" costs are 50, 200 and 300.
  - Vehicles: for example Willys 200, Sherman 380, Tiger 648, IS-2 750.
  - It looks like a deploy budget, but that is **unconfirmed**.

### 1.8 Score and XP
- **Score:** +5 per kill, −1 per suicide, −10 per team kill. Capture credit is shared by contribution. Score only sets scoreboard rank, which unlocks ribbons ([wiki Action Rules](https://heroesandgenerals.fandom.com/wiki/Action_Rules)).
- **XP:** kill 1, armour kill 15, plane kill 40, team kill −10, "savior kill" 10, and 0.03 XP per point of damage. Capturing and defending contested points gave the most XP (same; [wiki Getting Started](https://heroesandgenerals.fandom.com/wiki/Getting_Started)).
- **Credits:** about 4.2 per score point ([wiki Credits](https://heroesandgenerals.fandom.com/wiki/Credits), via summary).

---

## 2. Spawning

### 2.1 Spawn points and delays
- You could spawn at access points, captured points and objectives, and mobile spawns ([Wikipedia](https://en.wikipedia.org/wiki/Heroes_%26_Generals)).
- **Delays** ([wiki Action Rules](https://heroesandgenerals.fandom.com/wiki/Action_Rules)):
  - Soldier at a capture point: **10 s + 0.5 s per link** back to your access point, rounded up.
  - Tanks: **+2.5 s per link**. Other vehicles: **+1.5 s per link**.
  - Mobile spawn (e.g. a half-track): **20 s**.
  - **Underdog pool:** spawn time = base delay − pool. The pool fills by 0.25 s × the underdog ratio every second while your team has fewer players.
- **Contested lock:** a point cannot be used while an enemy is capturing it. It is also locked if a teammate died within **80 m** of it in the last **10 s** while a neighbouring point is enemy-held. This exists so the attack can push forward ([wiki Action Rules](https://heroesandgenerals.fandom.com/wiki/Action_Rules); the summary was truncated, so check the exact condition).
  - Players reported being spawned far from a contested point ([Steam](https://steamcommunity.com/app/227940/discussions/0/613936039618736974)).
- **Tank spawn locations:** tanks spawned only at main objectives and access points ([wiki Airfield](https://heroesandgenerals.fandom.com/wiki/Airfield)). Whether this held on every map is **unconfirmed**.
- `[data]` gives every weapon respawntime 10. Its meaning is unknown.

### 2.2 Mobile and squad spawns
- **Mobile-spawn vehicles** (`[data]` vehicletemplate.json, mobileSpawn = true): the GMC CCKW 352, Opel Blitz and GAZ-AAA trucks, and the M3A1 and SdKfz 251-D half-tracks. A B-17G is also flagged and looks like an event vehicle.
- The wiki lists the M3 half-track as a mobile spawn costing 79,000 credits or 950 gold ([wiki Vehicles](https://heroesandgenerals.fandom.com/wiki/Vehicles), [wiki M3 Half-track (Lend-Lease)](https://heroesandgenerals.fandom.com/wiki/M3_Half-track_(Lend-Lease))).
- **Rules** (from [wiki Previous Changelogs](https://heroesandgenerals.fandom.com/wiki/Previous_Changelogs), [wiki Squads](https://heroesandgenerals.fandom.com/wiki/Squads) and [wiki Vehicles](https://heroesandgenerals.fandom.com/wiki/Vehicles) via summary; which page states which rule was not verified):
  - A squadmate's mobile spawn shows up in the spawn menu.
  - It must be picked within the first 10 s of the vehicle's life.
  - You must come from the same access point.
  - Half-tracks are usable by everyone on that access point, limited per resource pool.
  - A tank stops working as a spawn for armour squads once its owner dies.

### 2.3 Choosing soldier and vehicle, and costs
- **Classes** (`[data]` charactertemplate.json): rifleman, recon, paratrooper, tank crew and fighter pilot. Generals could not play the Action Game ([wiki Generals](https://heroesandgenerals.fandom.com/wiki/Generals)).
- **Who spawns what:** infantry spawn trucks and half-tracks, recon spawn motorcycles, pilots spawn aircraft and tank crews spawn tanks. Some half-tracks were free when you bought a pilot, tank crew or paratrooper ([wiki Vehicles](https://heroesandgenerals.fandom.com/wiki/Vehicles)).
- **Vehicle costs:** each vehicle had a purchase price plus a credit cost **per spawn**:

  | Vehicle | Purchase | Per spawn | Source |
  |---|---|---|---|
  | M4A1 Sherman | 124,000 cr | 361 cr | [wiki M4A1 Sherman](https://heroesandgenerals.fandom.com/wiki/M4A1_Sherman) |
  | ¼-ton truck | 46,000 cr / 275 gold | 31 cr | [wiki Truck, 1/4 ton](https://heroesandgenerals.fandom.com/wiki/Truck,_1/4_ton,_4x4) |
  | M2A2 light tank | 34,000 cr / 400 gold |: | [wiki Vehicles](https://heroesandgenerals.fandom.com/wiki/Vehicles) |
  | SdKfz 251/1 |: | 386 cr (maintenance load 3:07) | [wiki SdKfz 251/1](https://heroesandgenerals.fandom.com/wiki/SdKfz_251/1) |
  | Blitz truck |: | 166 cr (maintenance load 2:55) | [wiki Blitz Truck](https://heroesandgenerals.fandom.com/wiki/Blitz_Truck) |

- **Weapon costs:**
  - Weapons list a "Field Maintenance Load": MG34 0:35, MG42 0:45, SVT-40 and PPSh 0:20. The MG34 page also lists a "Cost Per Shot" ([wiki MG34](https://heroesandgenerals.fandom.com/wiki/Maschinengewehr_34), [wiki SVT-40](https://heroesandgenerals.fandom.com/wiki/SVT-40)). How these worked is **unconfirmed**.
  - Mods have a one-time cost ([wiki Game Lobby](https://heroesandgenerals.fandom.com/wiki/Game_Lobby)). Some add wear and maintenance cost ([wiki Weapon Upgrades](https://heroesandgenerals.fandom.com/wiki/Weapon_Upgrades)).
  - `[data]` has wearPerShot, maxCondition and wearPerSpawn fields.

### 2.4 Paratroopers and air spawns
- Paratroopers jump from transport planes (`[data]` C-47A, Ju-52/3m). The drop prompt appears at 300 m, and you jump at about 275 m to land on top of a moving plane ([wiki Paratrooper's Handbook](https://heroesandgenerals.fandom.com/wiki/Paratrooper's_Handbook)).
- The Free Fall badge lets you choose when to open the chute. The Parachute ribbon rewards late openings ([wiki Parachute Ribbon](https://heroesandgenerals.fandom.com/wiki/Parachute_Ribbon)).
- A parachute costs 5 EP (`[data]`).
- Player complaints:
  - chutes opened 5–10 m above the ground, which made AA trucks useless ([Steam](https://steamcommunity.com/app/227940/discussions/0/357286119110231795/));
  - camping at the para-plane spawn ([Steam](https://steamcommunity.com/app/227940/discussions/11/133256240731250106/));
  - "Paratrooper system OP" ([Steam](https://steamcommunity.com/app/227940/discussions/0/611701999524368824)).

---

## 3. Maps

### 3.1 Catalogue
Full metadata is in table T3.

| Map | Mode | Region / look | Notes |
|---|---|---|---|
| **Town** | Assault, 5 lines A–E, O1 + O2 | French village (`T01M01_MediumFrenchVillage`) | O1 Police Station, O2 Church; river and bridges ([wiki Town](https://heroesandgenerals.fandom.com/wiki/Town)) |
| **Mountain Town** | Assault, 5 lines, O1 + O2 | Ardennes hills (`ardennes_mountains`) | O1 Train Station, O2 Fuel Depot ([wiki Mountain Town](https://heroesandgenerals.fandom.com/wiki/Mountain_Town)) |
| **Factory** | Assault, 4 lines, O1 + O2 | Ardennes (`ardennes_tank_factory`) | multi-floor factory in a valley ([wiki Factory](https://heroesandgenerals.fandom.com/wiki/Factory)) |
| **Airfield** | Assault, 4 lines, O1–O3 | Ardennes (`ardennes_airfield`) | hangar, control tower, fighter dispersal pen ([wiki Airfield](https://heroesandgenerals.fandom.com/wiki/Airfield)) |
| **Forward Airfield** | Assault, 4 lines, O1–O3 | French countryside (`T01M04_AdvanceAirfield`) | O1 Airfield, O2 Bridge, O3 Church ([wiki Forward Airfield](https://heroesandgenerals.fandom.com/wiki/Forward_Airfield)) |
| Sawmill (formerly "Forest Skirmish") | Skirmish | Ardennes forest | 3 objectives ([wiki List of Maps](https://heroesandgenerals.fandom.com/wiki/List_of_Maps)) |
| Hill 60 (formerly "Hill Skirmish"; preset "King of the Hill") | Skirmish | French | 3 objectives |
| Village Skirmish | Skirmish | French | 3 objectives |
| Russian Skirmish | Skirmish | Russian (T04) | probably the wiki's "Khutor" (**unconfirmed**) |
| Russian Encounter | Encounter | Russian | probably "Krepost Outpost" (**unconfirmed**); 3 objectives |
| Samrée Depot | Encounter / First Encounter | Ardennes | renamed in 1.10 ([Steam 1.10](https://store.steampowered.com/news/app/227940/view/2889578330857644520)) |
| Colmar Hamlet ("Mill") | Encounter / First Encounter | French countryside | added in 1.10, Dec 2017 ([Steam 1.10](https://steamcommunity.com/games/HeroesAndGenerals/announcements/detail/1462971750456327952), [Worthplaying](http://worthplaying.com/article/2017/12/14/news/106496/)) |
| Lunéville | Tank / Pilot / Recon Encounter | French | one central objective |
| Gorge, Canal Bridge | specialist encounters (unavailable) | Ardennes / French | `[data]` only |
| City River, City Train Station, City Boulevard, Russian Factory, Vasyugan Fortification, Mountain Railroad, New Test Skirmish Map | unreleased | City (T03) / Russian (T04) | `[data]` only |

- **Region codes:** scene name prefixes T01 = French, T02 = Ardennes/mountain, T03 = city, T04 = Russian (`[data]` gamemap.json terrainType 1–4; the region labels are my reading of the identifiers).
- **Wiki map list:**
  - Assault: Airfield, Forward Airfield, Town, Mountain Town, Factory.
  - Tank/Pilots: Lunéville.
  - Capture & Hold: Samrée Depot, Krepost Outpost, Colmar Hamlet, Sawmill, Khutor, Hill 60, Village Skirmish.
  - First Encounter: Colmar Hamlet, Samrée Depot ([wiki List of Maps](https://heroesandgenerals.fandom.com/wiki/List_of_Maps)).
- **Layout reference:** a fan Unity project recreates the 2016 maps approximately: <https://github.com/Ravest95/MapRipperProject-HeroesAndGenerals-2016>.

### 3.2 How the war map reused them
- `[data]` battlefield.json lists 4,290 war-map battlefields. Their battle maps break down as: Town 2,018, Mountain Town 1,321, Factory 618, Forward Airfield 169, Airfield 162, plus one each for Samrée Depot and Vasyugan. So almost every town fight used one of five layouts, with only the town name changing.
- Examples:
  - Town map: Thionville, Warrington, Laval, Venice.
  - Mountain Town: Plyussa, Mâcon.
  - Factory: Sissonne, Świebodzin.
  - Forward Airfield: Amsterdam Vliegveld, Balaklava.
  - Airfield: Yeovil Airfield, Sola Lufthavn.
- **Capitals** (`[data]` capital.json):
  - On the Town map: London City, Marseille, Frankfurt am Main, Warsaw, Budapest, Rome, Bucharest, Prague, Leningrad, Berlin, Minsk, Kyiv, Athens, Riga, Edinburgh, Arnhem, Saint-Quentin.
  - On Mountain Town: Zurich, Donetsk, Stockholm, Oslo, Copenhagen, Vichy.
- **War victory:** hold 15 major cities ([wiki Victory conditions](https://heroesandgenerals.fandom.com/wiki/Victory_conditions)).

### 3.3 What the maps looked like
- **Town** ([wiki Town](https://heroesandgenerals.fandom.com/wiki/Town), [heroes-generals Town (French)](https://heroes-generals.fandom.com/wiki/Town_(French)), [wiki Previous Changelogs](https://heroesandgenerals.fandom.com/wiki/Previous_Changelogs)):
  - A medium French village. The A line starts in the north-west.
  - O1 is the Police Station and O2 the **Church**, in the middle of the map. The church has an open roof that paratroopers can drop through, three towers for snipers, three broken walls you can walk through, and a front door.
  - Water surrounds the centre from every attack point except the A line. Attackers come from the forest side; defenders cross the river by a destroyed bridge (via summary).
  - The early church carried altered Reichskriegsflagge decorations, later removed.
  - Patches moved the O2 deploy zone closer to the church and opened a wall hole on the "cabbage patch" side.
  - **Conflict:** the wiki says the church unlocks after the police station falls. `[data]` instead links lines A and B to O2, and lines C, D and E to O1.
- **Mountain Town** ([wiki Mountain Town](https://heroesandgenerals.fandom.com/wiki/Mountain_Town), [Previous Changelogs](https://heroesandgenerals.fandom.com/wiki/Previous_Changelogs)):
  - Open fields, rivers crossed by many bridges, and hills.
  - O1 is the Train Station, with containers, two AA batteries and walls that create chokepoints. O2 is the Fuel Depot.
  - Later changes removed a deploy zone between the objectives and widened a river into a gulf to stop flanking of O2.
  - Unlock sources conflict (C3 unlocks O2 and E3 unlocks O1, versus D3 unlocks O1). `[data]` says lines A, B and C feed O2, and lines D and E feed O1.
- **Factory** ([wiki Factory](https://heroesandgenerals.fandom.com/wiki/Factory)):
  - A "linear city": the objectives are linked by multi-floor factory buildings with roof access, in a valley ringed by higher hills.
  - `[data]`: lines A and B feed O2, lines C and D feed O1. The objectives are only 735 units apart, the closest pair on any map.
- **Airfield** ([wiki Airfield](https://heroesandgenerals.fandom.com/wiki/Airfield)):
  - O1 is the hangar, the only point tanks can capture. O2 is the control tower. O3 is a fighter dispersal pen.
  - The open centre is exposed to planes, recon snipers and tanks, and tanks often camped O3.
- **Forward Airfield** ([wiki Forward Airfield](https://heroesandgenerals.fandom.com/wiki/Forward_Airfield)):
  - Added in the "Utz" build. O1 is the airfield, O2 a bridge and O3 a church.
  - An AA gun stands east of the church. Village houses are mostly open, with rooftop positions.
  - Later additions: trees, a château and health crates.
- **Colmar Hamlet** belonged to a "French Countryside" series of maps (Steam 1.10 notes, via summary).
- Finer details such as hedgerows and foliage are **unconfirmed**.

### 3.4 Layout pattern and scale
- **Pattern:** assault maps are radial. Four or five lines run from access points at the map edges toward two or three central objectives. Each line feeds one specific objective, and the objectives are linked to each other (`[data]` CapturePointConnectionTemplate.json).
- **Which line feeds which objective:**

  | Map | Line → objective |
  |---|---|
  | Town | A, B → O2; C, D, E → O1 |
  | Mountain Town | A, B, C → O2; D, E → O1 |
  | Factory | A, B → O2; C, D → O1 |
  | Airfield | A → O3; B, C → O1; D → O2 |
  | Forward Airfield | A → O2; B, C → O3; D → O1 |

  - A few connection rows in the dump reference other maps' point IDs. I used only chains whose coordinates are consistent.
- **Points per line:** Town 4 (including the access point); Mountain Town, Factory and Forward Airfield 3; Airfield 2. Vasyugan (unreleased) has 4 lines of 4 points converging on one O1.
- **Town spacing** (`[data]` game units; all coordinates are in table T4):

  | Line | Point-to-point distances |
  |---|---|
  | A | A1 → A2 2,776; → A3 1,772; → A4 1,546; → O2 1,204 |
  | B | B1 → B2 2,083; → B3 1,819; → B4 2,163; → O2 3,163 |
  | C | C1 → C2 3,273; → C3 2,542; → C4 2,631; → O1 3,363 |
  | D | D1 → D2 3,339; → D3 1,832; → D4 2,550; → O1 967 |
  | E | E1 → E2 1,805; → E3 1,921; → E4 1,937; → O1 1,913 |
  | O1–O2 | 1,682 |

  - Access points sit about 7,000–8,600 units from the centre.
- **Scale (my inference, unconfirmed):** gamemap.json terrainsize is 20,000 for assault and tank maps, 10,000 for small infantry maps and 16,000 for Hill 60. If 1 unit = 0.1 m:
  - assault terrain is about 2 × 2 km, with a fought-over area about 1.5–1.7 km across;
  - points are about 90–340 m apart along a line;
  - Town's police station and church are about 170 m apart;
  - skirmish spawns are 200–400 m apart;
  - Lunéville's spawns are about 740 m from its objective.

  Verify this against the map-ripper project before relying on it.

---

## 4. Infantry mechanics

### 4.1 Health and damage
- **Hit zones** ([wiki Action Rules](https://heroesandgenerals.fandom.com/wiki/Action_Rules)): head ×4, body ×1, legs ×0.8, arms ×0.5. Worked example for a 36-damage pistol: 144 / 36 / 28 / 18, so a headshot kills in one and the body takes 3 hits. [wiki Heroes War School](https://heroesandgenerals.fandom.com/wiki/Heroes_War_School) also gives 4×.
  - **Conflict:** forum posts say the head multiplier became 5× when the pocket pistols were added ([Steam](https://steamcommunity.com/app/227940/discussions/0/1620600279665342996/?ctp=3)). See also the "Headshot Nerfs" thread ([Steam](https://steamcommunity.com/app/227940/discussions/0/1488861734112544711)). Which value was final is **unconfirmed**.
  - A 2017 blog says any weapon's headshot effectively one-shots ([lcrayment blog](https://lcraymentblog.wordpress.com/2017/12/08/the-problems-solutions-heroes-generals/)).
- **Health pool:** not stated anywhere I found (**unconfirmed**). About **100 HP** is implied by:
  - the 3 × 36 example;
  - first aid healing "up to 80";
  - modding a bolt-action to "100% damage" for one-shot torso kills ([Steam: 1 hit Body Kills](https://steamcommunity.com/app/227940/discussions/0/613936039599300251/), [Steam: How to make 1 shot kill sniper](https://steamcommunity.com/app/227940/discussions/0/530649887209249858/));
  - a user review's "it shouldn't take 3 .30 caliber bullets" ([Metacritic user reviews](https://www.metacritic.com/game/heroes-and-generals/user-reviews/)), which matches 49 × 2 = 98 in `[data]`.
- **Falloff:** every round has near and far damage, near and far range, and a max range (`[data]` ammotemplate.json).
  - .30-06 ball: 49 out to 65 m, 35 beyond 150 m.
  - 9 mm: 32 out to 22 m, 18 beyond 68 m.
  - M1903: damage starts dropping after 160 m ([wiki M1903](https://heroesandgenerals.fandom.com/wiki/Rifle_M1903)).
  - Linear interpolation between the two ranges is assumed (**unconfirmed**).
- **Shots to kill**, computed from `[data]` default ammo assuming 100 HP, head ×4 and no falloff:

| weapon | dmg near/far | body hits near (far) | head hits near (far) | leg hits | arm hits | fire cycle (s) | body TTK near (s) |
|---|---|---|---|---|---|---|---|
| Karabiner 98 Kurz | 47/35 | 3 (3) | 1 (1) | 3 | 5 | 1.425 | 2.85 |
| Rifle M1903 | 49/35 | 3 (3) | 1 (1) | 3 | 5 | 1.38 | 2.76 |
| Mosin-Nagant 91/30 | 47/38 | 3 (3) | 1 (1) | 3 | 5 | 1.429 | 2.86 |
| M1 Garand | 49/35 | 3 (3) | 1 (1) | 3 | 5 | 0.217 | 0.43 |
| Gewehr 43 | 47/35 | 3 (3) | 1 (1) | 3 | 5 | 0.237 | 0.47 |
| SVT-40 | 47/38 | 3 (3) | 1 (1) | 3 | 5 | 0.209 | 0.42 |
| M1 Carbine | 29/15 | 4 (7) | 1 (2) | 5 | 7 | 0.133 | 0.40 |
| StG 44 | 34/23 | 3 (5) | 1 (2) | 4 | 6 | 0.12 | 0.24 |
| AVS-36 | 47/38 | 3 (3) | 1 (1) | 3 | 5 | 0.11 | 0.22 |
| Thompson M1A1 | 33/18 | 4 (6) | 1 (2) | 4 | 7 | 0.10 | 0.30 |
| MP 40 | 32/18 | 4 (6) | 1 (2) | 4 | 7 | 0.109 | 0.33 |
| PPSh-41 | 29/11 | 4 (10) | 1 (3) | 5 | 7 | 0.071 | 0.21 |
| BAR M1918 | 49/35 | 3 (3) | 1 (1) | 3 | 5 | 0.115 | 0.23 |
| MG 42 | 47/35 | 3 (3) | 1 (1) | 3 | 5 | 0.06 | 0.12 |
| 1911 pistol | 33/18 | 4 (6) | 1 (2) | 4 | 7 | 0.16 | 0.48 |

  - Older wiki pages say unmodified bolt-actions killed in 2 torso hits within 200 m, using a damage of 56 ([wiki M1903](https://heroesandgenerals.fandom.com/wiki/Rifle_M1903)). Players later said "It's not OHK like it used to be". Balance changed over time.
- **Damage reduction:**
  - **Heavy Set** badge: 92 / 89 / 85 % damage taken ([wiki Combat Badge](https://heroesandgenerals.fandom.com/wiki/Combat_Badge); `[data]`). Gamepressure says 5/10/15 % instead ([gamepressure](https://www.gamepressure.com/heroesandgenerals/combat-badges/ze7601)); `[data]` supports the wiki. Gold Heavy Set prevented one-shot torso kills from bolt-actions ([wiki M1903](https://heroesandgenerals.fandom.com/wiki/Rifle_M1903)).
  - "Armor plates" were reportedly field gear that added HP. This is a player claim ([Steam](https://steamcommunity.com/app/227940/discussions/0/1642044369656530977/)) and **unconfirmed**.

### 4.2 Healing, bleeding and bandages
- **Bleeding and bandaging: no evidence found** in the wikis, Steam, guides or `[data]`. The only healing items in the data are the First Aid Kit and Medic Pouch. This is **likely absent (unconfirmed)**. An old post mentions a medic refilling "his bandage" from a vehicle crate, probably meaning first-aid kits ([Steam](https://steamcommunity.com/app/227940/discussions/0/1290691308579128937/)).
- **Partial regeneration** (details conflict, **unconfirmed**):
  - Health is in three stages and regenerates back to the top of the current stage; another player says "3 or 4 areas" ([Steam](https://steamcommunity.com/app/227940/discussions/0/34095684555241465/)).
  - A 2015 fan guide says it regenerates to at most 1/3 of total health, and only chests restore it fully ([lhg100](https://game.lhg100.com/Article/gameguides/H/201512/12715.html)).
  - The First Aid badge speeds recovery by 40/60/80 %.
- **Crates:**
  - You had to stand on supply/health boxes to resupply and heal ([wiki Basic Game Tutorial – outdated](https://heroesandgenerals.fandom.com/wiki/Basic_Game_Tutorial_-_outdated)).
  - Medic crates refill first-aid kits and pouches ([wiki Supply Crates](https://heroesandgenerals.fandom.com/wiki/Supply_Crates)).
  - `[data]` vehicle crates: Medic, Ammo, Anti-tank, Flamethrower and Demolition Kit (vehicleupgradetemplate.json).
- **First Aid Kit** (update 1.05 "Medic!", 2017-03-20; [wiki Changelog](https://heroesandgenerals.fandom.com/wiki/Changelog), [Steam](https://steamcommunity.com/games/HeroesAndGenerals/announcements/detail/246975849479669385), [Worthplaying](https://worthplaying.com/article/2017/3/21/news/102903-heroes-generals-update-adds-medic-abilities-fixes-tweaks/)):
  - Heals **up to 80 HP per use**, on a nearby teammate or on yourself.
  - Unlocks at Tactical Ribbon grade 5 and costs 1 EP.
  - The **Medic Pouch** holds 3 kits, unlocks at Medic Ribbon grade 6 and costs 2 EP. `[data]` agrees and gives a use range of 2, probably metres.
  - Prices: 9,200 credits / 110 gold for the kit, 30,000 / 350 for the pouch ([wiki Equipment](https://heroesandgenerals.fandom.com/wiki/Equipment)).
  - The Combat Medic badge adds 1/2/3 kits ([wiki Combat Medic CB](https://heroesandgenerals.fandom.com/wiki/Combat_Medic_CB)).
  - Moving interrupts the heal animation ([Steam](https://steamcommunity.com/app/227940/discussions/0/133259956022990950/?ctp=2)).

### 4.3 Fall damage
- Fall damage exists: opening a chute too late hurts ([Steam](https://steamcommunity.com/app/227940/discussions/0/3075370188246189105/)), and players asked whether Heavy Set reduces fall damage ([Steam](https://steamcommunity.com/app/227940/discussions/0/604941528489629634)).
- The thresholds are **unconfirmed**.

### 4.4 Movement, stances and stamina
- **Controls:** stand, crouch (Ctrl), prone (Z), slow walk (Left Alt), sprint (Shift), jump (Space) ([wiki Action Game Controls](https://heroesandgenerals.fandom.com/wiki/Action_Game_Controls)).
- **Build notes** ([wiki Previous Changelogs](https://heroesandgenerals.fandom.com/wiki/Previous_Changelogs)):
  - Strafing and running backwards reduced to **70 %** speed.
  - Characters slide on slopes steeper than **49°**.
  - Jump height raised slightly so obstacles can still be crossed.
- **"Young" update (Nov 2015)** ([wccftech](https://wccftech.com/heroes-generals-young-update-arrives-with-big-changes/), [Worthplaying](https://worthplaying.com/article/2015/11/19/news/97834-heroes-generals-update-adds-new-map-game-mode-weapons-and-more/)):
  - new soldier collision system, so you can go prone in more places;
  - faster prone crawl;
  - sprinting always increases speed and is easier uphill;
  - smoother transitions between running, sprinting and aiming;
  - cheaper sprinting;
  - you can fire while sliding;
  - jumping no longer costs stamina but pauses its regeneration.
- **"Hallowes" update (~2016)** ([Steam news](https://store.steampowered.com/news/posts/?appids=227940&enddate=1478095350), [Steam](https://store.steampowered.com/news/app/227940/view/2889578330857658695)):
  - jumping while sprinting keeps sprint speed but costs stamina (a later change than Young);
  - smoother prone turning and aiming.
- **Stamina:**
  - LMGs and other heavy gear drain stamina much faster than SMGs and rifles; walking costs nothing ([Steam](https://steamcommunity.com/app/227940/discussions/0/133256240737113384/), [Steam](https://steamcommunity.com/app/227940/discussions/0/208684375430650766/)).
  - The Physical Fitness ribbon was suggested for longer sprints. `[data]` puts "Marathon man" (2 / 2.5 / 3) and "Nimble" (1 / 2 / 3) in the same badge category as Heavy Set; their meanings are **unconfirmed**.
  - The stamina bar was in the bottom-left of the HUD ([gamepressure](http://guides.gamepressure.com/heroesandgenerals/guide.asp?ID=30188)).
- **Speeds:** exact walk, run, sprint, crouch and prone speeds are **unconfirmed**. Players said sprinting with an MG42 feels slow ([Steam](https://steamcommunity.com/app/227940/discussions/0/1519260397784205524/)).
- **Vaulting:** no vault system was found. Players jumped over walls and complained about it ([Steam](https://steamcommunity.com/app/227940/discussions/0/613935404025610321/)). Likely absent (**unconfirmed**).
- **Leaning:** players requested lean on Q/E ([Steam](https://steamcommunity.com/app/227940/discussions/11/1692659769958090474/), [Steam](https://steamcommunity.com/app/227940/discussions/0/610575007214430094)). Q was the default for a squad order. Likely absent (**unconfirmed**).
- **Machine guns** (`[data]` weapontemplate.json):
  - usewhilerunning = 0 on the BAR, M1919s, MG34, MG42, MG-13, DP-28, DT and Maxim. My reading: they cannot be fired while running.
  - proneandaimonly = 1 on most of these. My reading: they can only be aimed down sights while prone. Both readings are **unconfirmed**.
  - An old note lowered the MG42's and M1919's un-aimed accuracy while prone ([Previous Changelogs](https://heroesandgenerals.fandom.com/wiki/Previous_Changelogs)).

### 4.5 Aiming: sway, recoil, cone, scopes and zeroing
- **ADS:** right mouse button. `[data]` aimfov1 is 40 for most guns and 10 for built-in scopes. Reading this as field of view in degrees is **unconfirmed**.
- **Sway:**
  - Each weapon has sway per stance, an aim multiplier, sway from movement and sway from fatigue. The Thompson has movement sway 0.8 and fatigue sway 1.5 ([wiki Thompson](https://heroesandgenerals.fandom.com/wiki/Thompson_M1A1)); see T5.
  - The Hallowes update raised standing and crouched sway, lowered prone sway, and added more sway from turning, moving and precision mode for the MG42 and bolt-actions ([Previous Changelogs](https://heroesandgenerals.fandom.com/wiki/Previous_Changelogs)).
- **Hold breath:** requested by players ([Steam](https://steamcommunity.com/app/227940/discussions/0/1637543304844880426/), [Steam](https://steamcommunity.com/app/227940/discussions/0/385429254945503704/)) but apparently never added. Likely absent (**unconfirmed**).
- **Recoil and cone** ([wiki Game Mechanics](https://heroesandgenerals.fandom.com/wiki/Game_Mechanics), [sandbox](https://heroesandgenerals.fandom.com/wiki/Game_Mechanics/sandbox)):
  - Camera recoil per shot (up/right plus random variance) is changed by "stability" mods.
  - The cone of fire, in degrees, grows during sustained fire. Ammo mods affect it, and the Tight Grip badge reduces it while aiming.
  - "Precision" describes how closely shots follow the path.
  - `[data]` also has aimpenaltyperbullet, aimpenaltyturn and aimpenaltycontractionpersec. Tight Grip, PointShooter and Quickdraw are all 0.75 / 0.62 / 0.5; the last two probably affect hip-fire cone and weapon draw time (**unconfirmed**).
- **Scopes** (`[data]` WeaponModifierTemplate.json):
  - Sniper rifles have built-in scopes.
  - Scope parts: 1.9× (M73B1, PU, ZF-41), 2.75× (M84), 4× (PE, ZF-4), 4.2× (ZF-39), 8× (Unertl, ZS Zielacht).
  - Reticles: Fine Cross, Fine Duplex, German #1, German #4, T-Post.
  - All scopes adjust from 100 to 800 m in 50 m steps.
- **Zeroing:**
  - The mouse wheel while aiming changes the range ([NamuWiki tips](https://en.namu.wiki/w/%ED%9E%88%EC%96%B4%EB%A1%9C%EC%A6%88%20%EC%95%A4%20%EC%A0%9C%EB%84%88%EB%9F%B4%EC%8A%A4/%ED%8C%81), unofficial). The HUD shows the current setting ([wiki Basic Game Tutorial – outdated](https://heroesandgenerals.fandom.com/wiki/Basic_Game_Tutorial_-_outdated), [Steam guide](https://steamcommunity.com/sharedfiles/filedetails/?id=279849228)).
  - Players say it matters little at 100–200 m ([Steam](https://steamcommunity.com/app/227940/discussions/0/276237094306583423/)).
  - `[data]` sight ranges:

    | Weapon | Range |
    |---|---|
    | Bolt-actions | 100–2000 m in 100 m steps |
    | SMGs | fixed 50 m |
    | Most pistols | fixed 25 m (C96/P08 50–450 m) |
    | Garand, G43, SVT | single step (fixed) |
    | M1A1 Carbine | 100–800 m |
    | StG 44 | 100–1000 m |
    | BAR | 100–1500 m |
    | MG42, MG34 | 100–2000 m |
    | Bazooka M1A1, Panzerschreck | 50–150 m |
    | Bazooka M9A1 | 50–500 m |
    | Tank guns | 0–4000 m in about 100 m steps |

### 4.6 Ballistics
- Bullets were **projectiles, not hitscan** ([Game With Your Brain review](https://gamewithyourbrain.com/blog/2018/11/18/a-slightly-in-depth-heroes-and-generals-review)).
- `[data]` muzzle velocities (m/s):

  | Round | m/s |
  |---|---|
  | .30-06 | 852 |
  | 7.92 Mauser | 852 |
  | 7.62×54R | 949 |
  | 7.92 Kurz | 685 |
  | .30 Carbine | 600 |
  | 9 mm | 425 |
  | 7.62 Tokarev | 480 |
  | .45 ACP | 253 |
  | 14.5 mm | 1114 |
  | Panzerschreck rocket | 110 |
  | Bazooka rocket | 82 |
  | Panzerfaust | 70 |
  | Tank rounds | 450–1180 |

  Max range is 2000 m for rifles and 500–750 m for pistol calibres.
- **Drop:** players disagreed, but most said it shows at long range (scoped rifles beyond about 250 m) and with slow tank shells ([Steam](https://steamcommunity.com/app/227940/discussions/0/616198900650095891/), [Steam](https://steamcommunity.com/app/227940/discussions/0/305509857559292858/), [Steam](https://steamcommunity.com/app/227940/discussions/0/1699417068297469566/)).
- **Travel time:** real; you had to lead moving targets.
- **Wind:** **unconfirmed**. `[data]` has a windId field whose effect is unknown.

### 4.7 Bullet penetration through materials
- **Unconfirmed.** Players contradict each other: wooden floors stopped bullets, "no penetration in this game", and shots through walls were blamed on clipping ([Steam](https://steamcommunity.com/app/227940/discussions/0/351659808485833980/), [Steam](https://steamcommunity.com/app/227940/discussions/0/351660338714072948/)).
- `[data]` armour penetration on small arms (rifle 3–6 mm, 14.5 mm 30–50 mm) appears to apply only to vehicle armour.

### 4.8 Suppression, friendly fire and hit feedback
- **Suppression:** none found (**unconfirmed**).
- **Friendly fire:**
  - Per players, small arms do not hurt teammates, but explosives, vehicles and some AT weapons do ([Steam](https://steamcommunity.com/app/227940/discussions/0/611702631223828520), [Steam](https://steamcommunity.com/app/227940/discussions/0/1519260397779256176/); **unconfirmed**).
  - A team kill costs −10 score and −10 XP ([wiki Action Rules](https://heroesandgenerals.fandom.com/wiki/Action_Rules)).
  - Griefing could be reported. Repeat offenders were flagged, removed from the mission and banned, with warnings for new players ([wiki Teamkilling](https://heroesandgenerals.fandom.com/wiki/Teamkilling)).
- **Hit feedback:**
  - A small blood puff and no gore ([Steam](https://steamcommunity.com/app/227940/discussions/0/45350791755662024/)). Some asked to disable the blood because it hurt visibility ([Steam](https://steamcommunity.com/app/227940/discussions/0/483368526586503229), [Steam](https://steamcommunity.com/app/227940/discussions/0/45350791839053993)).
  - A hit marker is **unconfirmed**.
  - Blood-without-damage reports continued after server-side hit detection (Steam threads such as [Bad netcode](https://steamcommunity.com/app/227940/discussions/0/37470847796753507/), via summary).

### 4.9 Classes, equipment points and badges
- **EP budgets** (`[data]`): rifleman 10, paratrooper 8, recon 8, tank crew 6, pilot 6.
- **Item EP costs:** rifles 5, SMGs and LMGs 6–7, launchers 5, pistols 1–2, grenades 2, mines 2–3, first aid kit 1, binoculars 1, wrench 1, parachute 5.
- **Ammo pouches** can be adjusted. This sets the most ammo you can resupply to and costs EP ([Steam guide](https://steamcommunity.com/sharedfiles/filedetails/?id=279849228); [wiki Equipment Points](https://heroesandgenerals.fandom.com/wiki/Equipment_Points)).
- **Badges** (`[data]` combatbadgetype.json): Hoarder, Heavy set, Marathon man, Ghillie, Camouflaged, Infantry fist, Tight Grip, Driver, Gunner, Tanker, Airborne, Grenadier, Para-training, Free Fall, Bombs Away, Flak Jacket, Scavenger, Car/Tank/Aircraft Thief, Logistics Expert, Dead-eye, Battlefield Commander, Charismatic Leader, Mechanic, First Aid, Combat Medic, Hand of god, Quickdraw, Fast reload, Infantry first, PointShooter, Nimble. Only the badges in section 0 have confirmed meanings.

---

## 5. Weapon handling

### 5.1 Slots
- Slots (`[data]` weaponslotcategory.json): primary, sidearm, close combat, equipment. Keys 1–4 select them; mapping key 1 to primary and so on is my inference.
- Key 6 selects a picked-up weapon and E picks it up. A hidden slot 5 was used only for event items ([wiki List of default keys](https://heroesandgenerals.fandom.com/wiki/List_of_default_keys), [Action Game Controls](https://heroesandgenerals.fandom.com/wiki/Action_Game_Controls)).

### 5.2 Fire modes
- Mouse 3 toggles the fire mode ([wiki List of default keys](https://heroesandgenerals.fandom.com/wiki/List_of_default_keys)).
- `[data]`:
  - **Select-fire:** StG 44, M2 Carbine, AVS-36, Thompson, PPSh-41, PPD-40, FG 42, MG-13, MG 34, BAR, Johnson.
  - **Auto only:** MG 42, M1919/A4, DP-28, DT, Maxim, MP 40, MP 34, M3 Grease Gun, PPS-43, "Machine Carbine Mk I" (the Sten), flamethrowers.
  - **Single only:** bolt-actions, semi-autos, pistols.

### 5.3 Reloads (incl. M1 Garand)
- Ammo is tracked by magazine (`[data]` magazine size × number carried). Examples: Garand 8 × 10, Kar98k 5 × 10, StG 44 30 × 6, MG 42 100 × 2.
- Reloads take longer when a scope is fitted.
- The Fast reload badge multiplies reload time by 0.85 / 0.77 / 0.70.
- **Garand:**
  - 8-round en-bloc clip, 2.8 s reload. That is faster than the G43 (3.1 s) and SVT (2.9 s) but gives the fewest rounds per reload ([wiki M1 Garand](https://heroesandgenerals.fandom.com/wiki/M1_Garand), [Steam guide](https://steamcommunity.com/sharedfiles/filedetails/?id=778075008)).
  - `[data]` clipautoeject = 1 on the Garand, US carbines and AVS-36, probably auto-ejecting the empty clip.
  - Whether a part-fired clip could be topped up is **unconfirmed**.
- `[data]` maglowlimit is probably the low-ammo warning threshold. equiptime (draw time) is 0.3–0.6 s.

### 5.4 Firearm stats
- All firearms are in table T5: modes, magazines, reload, fire cycle and rpm, damage and range, velocity, cone, sway, sight steps and EP.
- The rpm column is meaningless for launchers.

### 5.5 Ammo variants
Each gun had 2–5 ammo types that trade damage against range, cone and recoil (`[data]` ammotemplate.json and weaponAmmoMapping.json).

| Weapon | Ammo | Damage | Range (m) | Other |
|---|---|---|---|---|
| Kar98k | S.m.E. (default) | 47/35 | 64–160 |: |
| Kar98k | Anschusspatrone s.S. | 54/40 | 106–195 | cone ×0.8, recoil ×1.5 |
| Kar98k | s.S. Patrone | 51/37 |: | cone ×1.1, recoil ×1.5 |
| Kar98k | S.m.K. Hart | 56/33 | 51–125 | cone ×1.2, recoil ×2; not for sale |
| Garand | Match M72 | 53/40 |: | 899 m/s, cone ×0.83, recoil ×1.75 ([wiki](https://heroesandgenerals.fandom.com/wiki/M1_Garand)) |
| PPSh | "Leonov Devil" | 35/10 | 8–42 | cone ×1.25, recoil ×2.2 |
| MP 40 | "DMW Fuchs" | 30/19 | 32–83 | cone ×0.75 |

### 5.6 Weapon modifications
- **How mods work** ([wiki Weapon Upgrades](https://heroesandgenerals.fandom.com/wiki/Weapon_Upgrades)):
  - Most mods have a positive and a negative effect.
  - They change damage, rate of fire, range, precision and stability.
  - Categories: ammunition, trigger, internal, sights/scopes, barrel, plus cosmetic skins.
  - A bought mod must be switched on with a tickbox.
  - Some mods add wear and maintenance cost.
- `[data]` (WeaponModCategory.json) confirms **5 slots**: Ammunition, Barrel, Internal, Sight, Trigger. Multipliers are in table T7. Examples:
  - **Heavy Bolt:** damage ×1.30, far damage ×1.10, recoil ×1.10, fire interval ×1.15.
  - **Lightened Bolt/Spring:** fire interval ×0.86–0.95, at the cost of range or recoil.
  - **Barrels** (Scout II, Chrome Moly 4150, Octagon, Stainless, URAH-2): more damage or range, but more recoil or cone.
  - **Triggers** (Hair, Fine Hair, Match, Field Trigger Job, Marksman): faster cycling, but more recoil or cone.
  - **Match / Field Adjusted Sights:** cone ×0.85–0.95.
- A player said only the Field trigger and Lightened spring raised the Garand's rpm ([Steam](https://steamcommunity.com/app/227940/discussions/0/365163686074500400/)).

### 5.7 Grenades, explosives and mines
All values from `[data]`; see table T6.

| Type | Items | Blast | Radius | Fuse | Carried / EP | Other |
|---|---|---|---|---|---|---|
| Frag grenade | Mk II, RGD-33, M24 sleeve | 110 | 25 | 3 s | 3 / 2 |: |
| Stick / offensive grenade | Mk IIIA1, Stielhandgranate 24, RG-42 | 170 | 10 | 2.5 s |: |: |
| Bundle / demolition kit | Stielhandgranate bundle, RGD-33 bundle, Demo Kit M1 | 200 | 20 | 3.5 s | 2 | armour damage 750–1200 |

- The wiki's fuse times match (Mk II 3 s, Demo Kit M1 3.5 s) ([wiki Explosives](https://heroesandgenerals.fandom.com/wiki/Explosives), [wiki Grenade Mk II](https://heroesandgenerals.fandom.com/wiki/Grenade_Mk_II)).
- Radius units are probably metres. A "chargetime" of 0.5–1 s may be a throw wind-up (**unconfirmed**).
- **AT grenades:**
  - RPG-43 and Panzerwurfmine: impact fuse, 70–126 mm penetration, 800–1100 damage.
  - **No.74 sticky:** 5 s fuse, 45–60 mm, 700–900 ([wiki No.74](https://heroesandgenerals.fandom.com/wiki/No.74)).
  - **H3 magnetic charge:** placed on the tank, 5 s, 60–75 mm, 1100–1400. Cannot be placed on a moving tank; players said two kill any tank ([wiki H3](https://heroesandgenerals.fandom.com/wiki/Hafthohlladung_H3), [Steam](https://steamcommunity.com/app/227940/discussions/0/1694919808739003354/)).
- **AT mines** (TM-35, Tellermine 42, M1A1): 3000 blast, 200 mm, 2000–4000 damage. Triggered only by heavy weights (threshold 500). 2 carried, 3 EP ([wiki TM-35](https://heroesandgenerals.fandom.com/wiki/TM-35), [wiki Tellermine 42](https://heroesandgenerals.fandom.com/wiki/Tellermine_42)).
- **AP mines:** S-Mine and M2A3 do 250 in a 2.5 radius; PMK-40 does 80 in a 1.5 radius. Threshold 50.
- No separate "satchel" item was found; the bundles and demo kits fill that role (**unconfirmed**).

### 5.8 Anti-tank weapons
`[data]`, cross-checked with [wiki Explosives](https://heroesandgenerals.fandom.com/wiki/Explosives#Guns) and [wiki Bazooka M9A1](https://heroesandgenerals.fandom.com/wiki/Bazooka_M9A1).

| Weapon | Pen (mm) | Armour dmg | Velocity | Reload | Sights | Notes |
|---|---|---|---|---|---|---|
| Bazooka M1A1 | 70–95 | 800–1100 | 82 m/s | 3.4 s | 50–150 m | 5 rockets, 5 EP |
| Bazooka M9A1 | 95–115 | 850–1200 | 82 m/s | 3.4 s | 50–500 m | |
| Panzerschreck RPzB 54 | 70–110 | 850–1200 | 110 m/s | 3.6 s | 50–150 m | |
| Panzerfaust 60 | 60–85 | 650–950 | 70 m/s | – | 30–90 m | single shot |
| M18 recoilless rifle | 58–76 | 650–850 | 366 m/s | 5.4 s | 100–1100 m | |
| Gewehr-Granatbüchse 39 (rifle grenade) | 70–95 | 700–1000 | 70 m/s | 4.4 s | 50–150 m | |
| Ampulomet-41 | 80–120 | 1000–1500 | 60 m/s | 6 s | 25–150 m | |
| PTRD-41 (14.5 mm) | 30–50 | 375–437 | 1114 m/s | 4.3 s | 100–2000 m | 300/150 infantry damage |
| PTRS-41 (14.5 mm) | 30–50 | 375–437 | 1114 m/s | 7 s | 100–1500 m | 5-round semi-auto |
| PzB 39 (7.92×94) | 35–45 | 350–412 | 1210 m/s | 4.3 s | fixed 300 m | 250/100 infantry damage |

- Launchers also do 1000/750 direct damage to infantry, plus a 100-point blast in a 7.5 radius.
- Old wiki cost tables conflict: 40,000 credits / 480 gold versus 58,000 / 690 for the Panzerschreck ([wiki Explosives](https://heroesandgenerals.fandom.com/wiki/Explosives), [German wiki](https://heroesandgenerals.fandom.com/de/wiki/Waffen)).

### 5.9 Flamethrowers, melee and tools
- **Flamethrowers** (M2, Flammenwerfer 41, ROKS-3, Einstoss 46): 20–25 m range, 50 damage per projectile, 8 EP.
- **Melee:** knives and bayonets 70, spades 60, bats 70 (`[data]`).
- **Wrench:** 35 melee damage and repairs vehicles, 1 EP.
- **Binoculars:** B, then hold RMB to look; also the squad leader's command mode and used for spotting ([Action Game Controls](https://heroesandgenerals.fandom.com/wiki/Action_Game_Controls), [Getting Started](https://heroesandgenerals.fandom.com/wiki/Getting_Started)).

---

## 6. Vehicles

### 6.1 Driving and controls
- **Keys:** W/S throttle and brake/reverse, A/D steer, E enter/exit, C change seat, Ctrl crouch in an open seat, Left Shift (hold) free look ([Action Game Controls](https://heroesandgenerals.fandom.com/wiki/Action_Game_Controls)). End toggles first/third person ([List of default keys](https://heroesandgenerals.fandom.com/wiki/List_of_default_keys)).
- There is a "rangefinder/elevation" action; its key is **unconfirmed** ([gamepressure Controls](https://guides.gamepressure.com/heroesandgenerals/guide.asp?ID=30189)).
- `[data]` vehicletemplate.json has a full driving model: mass, gears, rpm curve, steering, wheel and track friction, suspension, turn speed, top and reverse speed (km/h) and off-road speed. Examples:

  | Vehicle | Top / reverse (km/h) | Notes |
  |---|---|---|
  | Tiger | 41 / 13 | 57 t, 8 forward / 4 reverse gears |
  | M4A1 Sherman | 40 / 12 | |
  | T-34/76 | 55 / 13.5 | |
  | M18 Hellcat | 80 / 17 | |
  | Willys | 89 / 29 | |
  | Motorcycles | 95 | |

  The full list is table T8.

### 6.2 Crew seats
- **The driver also aims and fires the main gun and coaxial MG** ([wiki Playing as Tanker](https://heroesandgenerals.fandom.com/wiki/Playing_as_Tanker)).
  - C switches between the driver seat and an MG seat.
  - Most light tanks have only one seat.
  - Some MG seats are exposed and some are inside the tank.
  - Weapon order in the driver seat: main gun, then the second ammo type, then the coaxial MG.
- `[data]` VehicleWeaponSlot.json:
  - Seat 1 is the main gun plus coaxial MG; seat 2 is the bow or roof MG.
  - M3 Lee: seat 1 has the 75 mm, seat 2 the 37 mm turret, seat 3 an MG ([wiki M3 Lee](https://heroesandgenerals.fandom.com/wiki/M3_Lee)).
  - T-28 has 4 MG positions and the IS-2 has 3 seats.
  - Hetzer: the driver presses C to switch to the MG ([wiki](https://heroesandgenerals.fandom.com/wiki/Jagdpanzer_38(t)_Hetzer)).
  - Armoured cars put their gunner in seat 2 ([wiki BA-6](https://heroesandgenerals.fandom.com/wiki/BA-6)).

### 6.3 Damage model
- **Component model** ([Steam "Armoured and dangerous"](https://steamcommunity.com/games/HeroesAndGenerals/announcements/detail/1693807228190597622), [Steam news copy](https://store.steampowered.com/news/app/227940/view/2889578330857637179), [Steam dev thread](https://steamcommunity.com/app/227940/discussions/0/1620599015898385975)):
  - A shell must first **penetrate the armour**. The game then checks which components it hit: engine, wheels/tracks, transmission, ammunition, gun/turret, and on planes wings and rudder.
  - Engine damage cuts top speed; track damage slows that track; turret-ring damage slows traverse; transmission damage cuts top speed; wheel damage hurts handling.
  - Ammunition carries high damage multipliers.
  - Tracking a tank can matter as much as killing it.
- **Internals** ([wiki Game Mechanics](https://heroesandgenerals.fandom.com/wiki/Game_Mechanics), [sandbox](https://heroesandgenerals.fandom.com/wiki/Game_Mechanics/sandbox), [wiki Vehicle armor](https://heroesandgenerals.fandom.com/wiki/Vehicle_armor)):
  - armorHP wears down as it absorbs hits, and effective armour thickness falls with it to a floor of about 10 %.
  - Each component has internalHP and a totalDamageMultiplier. When destroyed it deals internalHP × multiplier plus any excess.
  - Excess goes to BaseStructure or Fuselage, which passes 50 % to the vehicle's HP.
  - Engine_Small has 150 internal HP, Engine_Medium 450.
- **Ammo racks:** multiple racks were reported (anecdotal; [Steam](https://steamcommunity.com/app/227940/discussions/0/3335371283875214910/), [Steam](https://steamcommunity.com/app/227940/discussions/0/3393916911759714700/)).
- **Hit points** (`[data]`):

  | Class | HP | armorHPMul |
  |---|---|---|
  | Light tanks | 1200 | 10 |
  | Medium tanks | 1700 | 15 |
  | Heavy tanks | 2200 | 20 |
  | Tank destroyers | 1200–1900 | 8–15 |
  | Armoured cars | 900 | 3–8 |
  | APC half-tracks | 900 | 1.5 |
  | Trucks | 750 | 1.5 |
  | Jeeps | 500 | 0.5 |
  | Motorcycles | 375 | 0.5 |
  | Fighters | 450 | 0.5 |
  | Heavy fighters, transports | 650 | 0.5 |
  | Recon planes | 750 | 0.5 |
  | AA emplacements | 500 |: |

- After penetration, damage was reportedly the same anywhere and random within a range, and an old rear-armour bonus was removed (anecdotal; [Steam](https://steamcommunity.com/app/227940/discussions/0/1318835718947350332/)).
- A 2014 armour table lists older values ([tyranthrax](https://tyranthrax.wordpress.com/2014/08/10/heroes-and-generals-tank-and-tank-destroyer-armor-table-and-penetration/)).
- `[data]` ammo armour fields: penetration angle 60°, ricochet angle 120, penetration falloff from 10 m to 1000–1500 m (down to 5 %).

### 6.4 Tank ammunition
- Wiki ([wiki Vehicle Ammunition](https://heroesandgenerals.fandom.com/wiki/Vehicle_Ammunition)):
  - **AP:** solid head that punches through and wrecks mechanisms.
  - **APHE:** slightly more penetration and much more damage than AP.
  - **APCR/HVAP:** much more penetration, less damage.
  - **HE:** wide blast, for infantry.
  - Only **2 ammo types** per tank per sortie (T-34/76 example).
- `[data]` adds HEAT, APCBC, Shrapnel and Smoke. Table T9 has the per-gun values.
- **Reload times:** 37–50 mm about 2.3–2.6 s; 75–76 mm 3–4 s; 88 mm 4–5.5 s; 90 mm 5 s; 122 mm 6 s.
- Tank sights adjust from 0 to 4000 m in 100 m steps.

### 6.5 Repair
- **Adjustable Wrench:** hold LMB next to the vehicle. Its health bar is shown, and you are exposed while repairing. It doubles as a melee weapon.
- Unlocked through the Tank Driver ribbon; tank crews don't start with it. The Mechanic badge speeds repair, and several repairers stack up to about 250 % ([wiki Adjustable Wrench](https://heroesandgenerals.fandom.com/wiki/Adjustable_Wrench), [heroes-generals wiki](https://heroes-generals.fandom.com/wiki/Adjustable_Wrench)).
- `[data]` Mechanic is 0.71 / 0.63 / 0.56, which reads as a repair-time multiplier.
- The wrench costs 1 EP in `[data]`, but a forum post says 2 slots for tank crews ([Steam](https://steamcommunity.com/app/227940/discussions/0/613935403977884827/)): a conflict.

### 6.6 Spawning, costs and upgrades
- See 2.1–2.3.
- `[data]` vehicle upgrades: mounted MGs (M2, M1919A4, MG34, MG42, DShK, PM1910, DP), supply crates, camouflage netting and coloured plane smoke.
- Camouflage costs about 40,000 to 391,000 credits ([wiki Vehicles](https://heroesandgenerals.fandom.com/wiki/Vehicles)).

### 6.7 Aircraft
- **Control modes** ([wiki Flight Manual](https://heroesandgenerals.fandom.com/wiki/Flight_Manual)):
  - **Classic:** mouse controls pitch and roll, A/D yaw, W/S throttle, Space drops bombs, LMB fires MGs, RMB fires cannon.
  - **Mouse:** aim where you want to fly.
  - **Camera:** a white cross shows where you want to go, a red cross where you are pointing.
- **Key conflicts:** auto-level is "F (hold)" or Alt depending on the page. Ctrl is either a debug toggle or "hold to fly with WASD" ([wiki Fighter Pilot](https://heroesandgenerals.fandom.com/wiki/Fighter_Pilot)).
- **Bombing:** climb first, then dive at the target; flying too low lets your own bomb destroy you (same page).
- **`[data]` aircraft:**
  - **Fighters (450 HP):** P-51D, P-40N, P-35A, Bf 109D/E, Fw 190 D-9, MiG-3, Yak-9D, La-7. Guns plus 1–6 bombs (AN-M57, AN-M64, SC250, SC500, FAB-100/250).
  - **Heavy fighters (650 HP):** P-38, Me 410, Pe-3, some with a rear gunner.
  - **Recon planes (750 HP):** O-52, Hs 126, R-Z, each with a rear gunner.
  - **Transports:** C-47, Ju-52.
  - Ju-87G, B-17G, A-20 and Pe-8 appear to be event or unused aircraft.
- Flight physics live in separate flight-model records not in the dump (**unconfirmed**).

### 6.8 Anti-aircraft
- **Static AA:** Flakvierling 38 (Germany), Maxim M4 Quad (USSR), M55 Quad (US; fires its guns in sequence).
  - Placed at key objectives and access points.
  - Reload automatically, and respawn with full health and ammo after a short delay.
  - The Flakvierling needs about 60–70 hits to down a plane; lead your target ([wiki Flakvierling 38](https://heroesandgenerals.fandom.com/wiki/Flakvierling_38), [wiki Anti-Air Guns](https://heroesandgenerals.fandom.com/wiki/Anti-Air_Guns), [wiki M55 Quad](https://heroesandgenerals.fandom.com/wiki/M55_Quad)).
- **AA vehicles** (`[data]`): M16 MGMC, Sd.Kfz. 7/1, GAZ-AAA with a quad Maxim. AA emplacements have 500 HP.

---

## 7. Default PC controls and HUD

### 7.1 Key bindings
Remap via Esc → "Input Settings" → "Remap Keys". The file is `C:\Users\<USER>\AppData\LocalLow\Heroes and Generals\KeyMappings.xml` ([Action Game Controls](https://heroesandgenerals.fandom.com/wiki/Action_Game_Controls), [List of default keys](https://heroesandgenerals.fandom.com/wiki/List_of_default_keys), [Steam](https://steamcommunity.com/app/227940/discussions/0/1620599015876924468/)).

| Action | Key | Note |
|---|---|---|
| Move / jump / sprint / crouch / prone / slow walk | WASD / Space / Shift / Ctrl / Z / Left Alt | Action Game Controls |
| Use, pick up weapon, enter/exit vehicle | E | |
| Whistle | F | [wiki Whistle](https://heroesandgenerals.fandom.com/wiki/Whistle) |
| Fire / aim down sights / reload | LMB / RMB / R | |
| Adjust sight range | Mouse wheel while aiming | NamuWiki, unofficial |
| Weapon slots / picked-up weapon / event slot | 1–4 / 6 / 5 (5 only in KeyMappings.xml) | List of default keys |
| Next / previous weapon | Mouse wheel (Page Down also listed for previous) | conflict |
| Fire mode | Mouse 3 | |
| Binoculars, squad command mode | B; hold RMB to look | |
| Squad "defend" order / resign as leader | Q / F4 | |
| Scoreboard / team chat / map | Tab / T / M | |
| Report grief / war map / latest kills / task list | F1 / F2 / F3 / F5 | |
| Network info / performance info | F6 / F7 | |
| Screenshot / undeploy (suicide) | F9 / F11 | |
| Vehicle drive / seat change / crouch in open seat | WASD / C / Ctrl | |
| Vehicle 1st/3rd person / free look | End / hold Left Shift | |
| Plane (classic) | mouse pitch and roll, A/D yaw, W/S throttle, LMB MG, RMB cannon, Space bombs | Flight Manual |
| Plane auto-level | F (hold) or Alt | conflict |
| Grenade, knife | via slots 3 and 4? | **unconfirmed** |
| Lean / hold breath / bandage | none found | feature probably absent |

### 7.2 HUD layout
- **Top centre:** objective progress bars (blue for your team, red for the enemy) with stars for captured objectives ([gamepressure](http://guides.gamepressure.com/heroesandgenerals/guide.asp?ID=30188)).
- **Top right:** kill feed showing the weapon used ([gamepressure](http://guides.gamepressure.com/heroesandgenerals/guide.asp?ID=30188), [wiki Basic Game Tutorial – outdated](https://heroesandgenerals.fandom.com/wiki/Basic_Game_Tutorial_-_outdated)). F3 lists recent kills.
- **Bottom left:** health and stamina. A later build showed health, armour, fatigue and rank here ([Previous Changelogs](https://heroesandgenerals.fandom.com/wiki/Previous_Changelogs)).
- **Bottom right:** weapon, magazine and total ammo, all ammo types, and the current sight-range setting ([Steam guide](https://steamcommunity.com/sharedfiles/filedetails/?id=279849228), Previous Changelogs, Basic Game Tutorial). The older status box also showed stance, health and range.
- **Capture zone:** a circle with the point's name (e.g. "B2") and blue and red counts of soldiers inside ([wiki Getting Started](https://heroesandgenerals.fandom.com/wiki/Getting_Started)).
- **Friends and enemies:** teammates are blue dots; enemies get no red dots and must be spotted by eye (Basic Game Tutorial).
- **Minimap and compass:** no minimap found. A compass existed in alpha and early beta and was apparently removed later ([Steam](https://steamcommunity.com/app/227940/discussions/0/3223871682622086839/), **unconfirmed**). The map is on M.
- **Other:** the vehicle health bar is visible while repairing. The briefing screen showed access, control and objective points ([gamepressure Briefing](http://guides.gamepressure.com/heroesandgenerals/guide.asp?ID=30187)).

---

## 8. Reception

### 8.1 Praised
- **Atmosphere and realism:** "gritty, arena-based WWII simulation", muted colours, "plausibly realistic", not like Call of Duty ([MMOBomb](https://www.mmobomb.com/review/heroes-and-generals), [MMOBomb](https://www.mmobomb.com/word-play-going-to-war-with-heroes-generals)). F2P.com scored it 7.5 and 8 for realism and atmosphere ([F2P.com](https://www.f2p.com/mmo-review/heroes-and-generals/), [F2P.com 2](https://www.f2p.com/mmo-review/heroes-and-generals-review/)).
- **Gunplay:** a 2017 review said kills usually take 2–3 shots and precise weapons reward headshots from cover (search summary; exact review not verified). Projectile ballistics "add flavor at medium to long range" ([Game With Your Brain](https://gamewithyourbrain.com/blog/2018/11/18/a-slightly-in-depth-heroes-and-generals-review)).
- **Breadth:** combined arms in a persistent war, free to play, a "strong pick-up FPS" ([MMOs.com](https://mmos.com/review/heroes-and-generals)). The single critic score on Metacritic is 80 ([Metacritic](https://www.metacritic.com/game/heroes-and-generals/)).
- **Netcode change:** the 2015 switch to server-side hit detection got "extremely positive" feedback according to the developer ([GameWatcher](https://www.gamewatcher.com/2015-30-01-heroes-generals-updated-with-new-hit-detection-system), [Attack of the Fanboy](https://attackofthefanboy.com/news/heroes-generals-hit-detection-update-released/), [MMOReviews](https://www.mmoreviews.com/improved-hit-detection-system-heroes-generals/), [Sportskeeda](https://www.sportskeeda.com/esports/new-update-heroes-general-adds-server-side-hit-detection-system)).

### 8.2 Criticised
- **Headshots:** any weapon, even starter pistols, could one-shot to the head, and high fire rates got more chances. One blogger called this a "nightmare for balancing" ([lcrayment](https://lcraymentblog.wordpress.com/2017/12/08/the-problems-solutions-heroes-generals/)). Threads: [Steam](https://steamcommunity.com/app/227940/discussions/0/358417008718042200/), [Steam](https://steamcommunity.com/app/227940/discussions/0/152391995412936996/).
- **Body-shot TTK:** "shouldn't take 3 .30 cal bullets" ([Metacritic users](https://www.metacritic.com/game/heroes-and-generals/user-reviews/)). The `[data]` damage values confirm 3 hits.
- **Gunplay feel:** short-range gunplay "poor and finicky" ([Game With Your Brain](https://gamewithyourbrain.com/blog/2018/11/18/a-slightly-in-depth-heroes-and-generals-review)). Users called it "cardboard" with "terrible" ballistics (Metacritic users). "The aiming and controls suck" ([Steam](https://steamcommunity.com/app/227940/discussions/0/3038228835139541091/)).
- **Netcode:** "poor netcode" (Game With Your Brain; [Steam](https://steamcommunity.com/app/227940/discussions/0/37470847796753507/)). Blood splatter without damage kept being reported.
- **Visibility:** enemies hard to see (Game With Your Brain), and blood obscured vision ([Steam](https://steamcommunity.com/app/227940/discussions/0/483368526586503229)).
- **Movement:** prone and crouch felt sluggish; no lean, vault or hold breath; obstacles were hard to cross (sections 4.4–4.5).
- **Vehicles:** "Armour 2.0" (Oct 2018) drew heavy criticism and drove players away ([Wikipedia](https://en.wikipedia.org/wiki/Heroes_%26_Generals)). Fights over AT infantry versus tanks continued ([Steam](https://steamcommunity.com/app/227940/discussions/0/1699416432425943917/), [Steam](https://steamcommunity.com/app/227940/discussions/0/1761356057426041550/), [Steam](https://steamcommunity.com/app/227940/discussions/11/343786650654957486)).
- **Paratroopers:** spawn camping, late chute openings, overpowered (see 2.4).
- **Squads:** players wanted at least 5 per squad ([Steam](https://steamcommunity.com/app/227940/discussions/0/357287304425231869/)).
- **Grind:** grind and paywall; the strategy layer was "a time-sink" ([MMOs.com](https://mmos.com/review/heroes-and-generals)). Slow progression and dated graphics were also cited, and users averaged 5.5/10 with 39 % negative ([Metacritic](https://www.metacritic.com/game/heroes-and-generals/)).
- **Overall scores:** HistoryNet 3/5, "for shooter fans, not for realism seekers" ([HistoryNet](https://historynet.com/game-review-heroes-and-generals/)); MMOHuts 3.5/5 ([MMOHuts](https://mmohuts.com/news/heroes-generals-review)); Game With Your Brain 5/10.

### 8.3 Timeline
| Date | Event | Source |
|---|---|---|
| Early 2015 | Server-side hit detection | [GameWatcher](https://www.gamewatcher.com/2015-30-01-heroes-generals-updated-with-new-hit-detection-system) |
| Nov 2015 | "Young" movement rework | [wccftech](https://wccftech.com/heroes-generals-young-update-arrives-with-big-changes/) |
| ~2016 | "Hallowes": sway and prone changes | [Steam news](https://store.steampowered.com/news/posts/?appids=227940&enddate=1478095350) |
| Mar 2017 | 1.05 Medic! | [wiki Changelog](https://heroesandgenerals.fandom.com/wiki/Changelog) |
| Dec 2017 | 1.10: Colmar Hamlet | [Steam](https://store.steampowered.com/news/app/227940/view/2889578330857644520) |
| 2018 | 1.12 Deploy! Drive! Destroy! | [PCGamesN](https://www.pcgamesn.com/heroes-generals/update-112-deploy-drive-destroy) |
| Oct 2018 | Armour 2.0 | [Wikipedia](https://en.wikipedia.org/wiki/Heroes_%26_Generals) |
| Oct / Dec 2019 | 1.16 "Aim, Fly and Fire" (2019-10-02); 1.17 "Cold Front" (2019-12-18) | [wiki Changelog](https://heroesandgenerals.fandom.com/wiki/Changelog); contents **unconfirmed** |
| Jan 2022 | "Switch Faster and Punch Harder" (2022-01-25) | [wiki Changelog](https://heroesandgenerals.fandom.com/wiki/Changelog); contents **unconfirmed** |
| 25 May 2023 | Shutdown | [Game Developer](https://gamedeveloper.com/business/wwii-mmo-i-heroes-generals-i-shuts-down) |

- **Fan revivals** (timelines conflict between sources):
  - restored 2013 build (Dec 2024) and 2014 build (Feb 2025) ([Stop Killing Games wiki](https://stopkillinggames.wiki.gg/wiki/Heroes_&_Generals));
  - a 2017 edition (May 2025) ([Wikipedia](https://en.wikipedia.org/wiki/Heroes_%26_Generals));
  - [HnG-group](https://www.hng-group.com/), which says it reverse-engineered the servers ([Patreon](https://www.patreon.com/hnggroup/about)), and [HnG Sunrise](https://heroes-and-generals.com/);
  - an Unreal Engine 5 rebuild by [Insight Interactive](https://www.insightinteractive.studio/heroes-generals).

---

## 9. Implications for the recreation (my recommendations)
1. **Copy the well-attested core loop exactly:**
   - radial Assault maps with 4–5 lettered lines of chained points leading to 2–3 objectives;
   - capture times of 30+30 s, 45+45 s and 90 s;
   - a 30-minute clock with +2 min per capture, sudden death, and a defender win by taking all access points;
   - Skirmish's 3-point slider to 100 and Encounter's single point;
   - 18 v 18.
2. **Import the `[data]` JSON directly** as the balance baseline (tables T5–T9) rather than retyping it.
3. **Core infantry model:**
   - about 100 HP (inferred);
   - hit multipliers 4 / 1 / 0.8 / 0.5;
   - near/far damage falloff;
   - projectile bullets with gravity;
   - adjustable sight range;
   - sway per stance plus fatigue;
   - camera recoil plus cone growth;
   - ammo tracked per magazine, with pouches costing equipment points.
4. **Optional fixes for the biggest complaints**, behind toggles if you want to stay faithful:
   - headshot multiplier per weapon class;
   - lean, simple vaulting and hold breath;
   - an optional hit marker and subtler blood;
   - stronger protection against spawn camping.
5. **Vehicles:**
   - one-player tanks (the driver fires the gun) with optional MG seats;
   - component damage on top of penetration, with armour that wears down;
   - 2 ammo types per sortie;
   - wrench repair;
   - longer spawn delay per link for tanks.
6. **Check before building:** map scale and coordinate units, and whether bleeding really was absent.

## 10. Open items
- Exact soldier HP, and whether the head multiplier was 4× or 5×.
- Bleeding: none found. The regeneration rule (stages versus 1/3).
- Movement speeds, the stamina pool and drain rates, and jump height.
- Suppression, hit markers, penetration of scenery, and wind.
- Meanings of `[data]` fields: capture-time units, objectiveHoldTime, timelimit, deployPoolCost, aiSaBotCountPerFaction, proneandaimonly, aimfov and badge effects.
- Coordinate units (decimetres inferred).
- Keys for grenades, melee and the tank rangefinder; the auto-level key conflict.
- What happens when Assault resources run out.
- What the 2019–2022 updates changed.
- Reddit, YouTube and archive.org were not accessible; those are the next sources to check.

Appendix A: insert the contents of `/tmp/claude-0/-home-user-hng/7bd4bb68-678e-57c7-90b0-5e2c6d9e530b/scratchpad/tables.md` here. It contains:
- T1 mission types;
- T2 mission presets;
- T3 maps;
- T4 assault point coordinates;
- T5 firearms;
- T6 explosives, melee and equipment;
- T7 weapon mods;
- T8 vehicles;
- T9 tank ammo;
- T10 classes.

# Appendix A: tables

### T1. Mission types (missiontype.json)

| id | title | rules text | capturepoint capture / neutralize | objective capture / neutralize | access point capture / neutralize |
|---|---|---|---|---|---|
| 1 | Assault | Eliminate all enemy opposition | 1000 / 240 | 800 / 450 | 1000 / 240 |
| 2 | Destruction | Blow some stuff up to complete the mission | 0 / 0 | 0 / 0 | 0 / 0 |
| 3 | Skirmish | Skirmish with skirmish on top | 0 / 0 | 900 / 900 | 0 / 0 |
| 4 | Supply | Supply with supply on top | 0 / 0 | 0 / 0 | 0 / 0 |
| 5 | Encounter | Secure and hold the objective | 0 / 0 | 200 / 200 | 0 / 0 |
| 6 | Specialist Encounter | Secure and hold the objective | 0 / 0 | 900 / 200 | 0 / 0 |
| 7 | Pilot Encounter | Secure and hold the objective | 0 / 0 | 900 / 200 | 0 / 0 |
| 8 | Recon Encounter | Secure and hold the objective | 0 / 0 | 900 / 200 | 0 / 0 |

### T2. Mission presets (missionpreset.json)

| preset (missioninfo) | mode | map | available | maxPlayerCount | objectiveHoldTime | timelimit | aiSaBotCountPerFaction | min/max player level |
|---|---|---|---|---|---|---|---|---|
| Assault - Airfield | Assault | Airfield | 1 | 36 | 0 | 10000 | 18 | 0/99 |
| Assault - City Boulevard | Assault | City Boulevard | 0 | 36 | 0 | 10000 | 18 | 0/99 |
| Assault - City River | Assault | City River | 0 | 36 | 0 | 10000 | 18 | 0/99 |
| Assault - City Train Station | Assault | City Train | 0 | 36 | 0 | 10000 | 18 | 0/99 |
| Assault - Forward Airfield | Assault | Forward Airfield | 1 | 36 | 0 | 10000 | 18 | 0/99 |
| Assault - Medium French Village | Assault | Town | 1 | 36 | 0 | 10000 | 18 | 0/99 |
| Assault - Mountain Village | Assault | Mountain Town | 1 | 36 | 0 | 10000 | 18 | 0/99 |
| Assault - Russian Factory | Assault | Russian Factory | 0 | 36 | 0 | 10000 | 18 | 0/99 |
| Assault - Russian Fortress | Assault | Vasyugan Fortification | 0 | 36 | 0 | 10000 | 18 | 0/99 |
| Assault - Tank Factory | Assault | Factory | 1 | 36 | 0 | 10000 | 18 | 0/99 |
| Assault Small - Airfield | Assault | Airfield | 1 | 36 | 0 | 10000 | 18 | 0/99 |
| Assault Small - Forward Airfield | Assault | Forward Airfield | 1 | 36 | 0 | 10000 | 18 | 0/99 |
| Assault Small - Medium French Village | Assault | Town | 1 | 36 | 0 | 10000 | 18 | 0/99 |
| Assault Small - Mountain Village | Assault | Mountain Town | 1 | 36 | 0 | 10000 | 18 | 0/99 |
| Assault Small - Russian Fortress | Assault | Vasyugan Fortification | 0 | 36 | 0 | 10000 | 18 | 0/99 |
| Assault Small - Tank Factory | Assault | Factory | 1 | 36 | 0 | 10000 | 18 | 0/99 |
| Capture and Hold Inf - Encounter - Depot | Encounter | Samrée Depot | 1 | 24 | 300 | 10000 | 4 | 0/99 |
| Capture and Hold Inf - Encounter - Mill | Encounter | Colmar Hamlet | 1 | 24 | 300 | 10000 | 4 | 0/99 |
| Capture and Hold Inf - Encounter - Russian | Encounter | Russian Encounter | 1 | 36 | 300 | 10000 | 6 | 0/99 |
| Encounter - Depot | Encounter | Colmar Hamlet | 0 | 24 | 300 | 10000 | 0 | 0/99 |
| Mountain Tank Encounter | Encounter | Gorge | 0 | 36 | 300 | 10000 | 0 | 0/99 |
| Russian Encounter | Encounter | Russian Encounter | 0 | 24 | 300 | 10000 | 0 | 0/99 |
| Training - Encounter - Depot | Encounter | Samrée Depot | 1 | 24 | 300 | 10000 | 0 | 3/99 |
| Training - Encounter - Depot - Beginner | Encounter | Samrée Depot | 1 | 24 | 300 | 10000 | 0 | 0/2 |
| Training - Encounter - Mill | Encounter | Colmar Hamlet | 1 | 24 | 300 | 10000 | 0 | 3/99 |
| Training - Encounter - Mill - Beginner | Encounter | Colmar Hamlet | 1 | 24 | 300 | 10000 | 0 | 0/2 |
| Training - Encounter - Russian | Encounter | Russian Encounter | 0 | 36 | 300 | 10000 | 0 | 3/99 |
| Training - Encounter - Russian - Beginner | Encounter | Russian Encounter | 0 | 36 | 300 | 10000 | 0 | 0/2 |
| Capture and Hold Pilot - Pilot Encounter - Town | Pilot Encounter | Lunéville | 1 | 16 | 600 | 10000 | 12 | 0/99 |
| Capture and Hold Recon - Recon Encounter - Town | Recon Encounter | Lunéville | 1 | 16 | 600 | 10000 | 12 | 0/99 |
| Recon Encounter | Recon Encounter | Canal Bridge | 0 | 24 | 300 | 10000 | 12 | 0/99 |
| Capture and Hold - Skirmish - Forest | Skirmish | Sawmill | 1 | 36 | 180 | 10000 | 10 | 0/99 |
| Capture and Hold - Skirmish - King of the Hill | Skirmish | Hill 60 | 1 | 36 | 180 | 10000 | 10 | 0/99 |
| Capture and Hold - Skirmish - Russian Skirmish | Skirmish | Russian Skirmish | 1 | 36 | 180 | 10000 | 10 | 0/99 |
| Capture and Hold - Skirmish - Village | Skirmish | Village Skirmish | 1 | 36 | 180 | 10000 | 10 | 0/99 |
| Capture and Hold Inf - Skirmish - Forest | Skirmish | Sawmill | 1 | 36 | 180 | 10000 | 10 | 0/99 |
| Capture and Hold Inf - Skirmish - King of the Hill | Skirmish | Hill 60 | 1 | 36 | 180 | 10000 | 10 | 0/99 |
| Capture and Hold Inf - Skirmish - Russian Skirmish | Skirmish | Russian Skirmish | 1 | 36 | 180 | 10000 | 10 | 0/99 |
| Capture and Hold Inf - Skirmish - Village | Skirmish | Village Skirmish | 1 | 36 | 180 | 10000 | 10 | 0/99 |
| Capture and Hold Tank - Tank Encounter - Town | Specialist Encounter | Lunéville | 1 | 16 | 600 | 10000 | 12 | 0/99 |
| Mountain Tank Encounter | Specialist Encounter | Gorge | 0 | 24 | 600 | 10000 | 12 | 0/99 |
| Mountain Tank Encounter | Specialist Encounter | Gorge | 0 | 24 | 300 | 10000 | 12 | 0/99 |
| Tank Encounter | Specialist Encounter | Lunéville | 0 | 24 | 300 | 10000 | 12 | 0/99 |
| Supply | Supply | Mountain Railroad | 0 | 36 | 0 | 10000 | 0 | 0/99 |

### T3. Battle maps (gamemap.json, CapturepointTemplate.json, accesspointtemplate.json, battlefield.json)

| map | scene file | terrainType | terrainsize | access points (lines) | objectives | other capture points | # of the 4,290 war-map battlefields using it |
|---|---|---|---|---|---|---|---|
| Town | T01M01_MediumFrenchVillage.scn | 1 | 20000 | 5 (ABCDE) | O1, O2 | 20 | 2018 |
| Mountain Town | T02M01_Mountain.scn | 2 | 20000 | 5 (ABCDE) | O1, O2 | 15 | 1321 |
| Factory | T02M03_TankFactory.scn | 2 | 20000 | 4 (ABCD) | O1, O2 | 12 | 618 |
| Forward Airfield | T01M04_AdvanceAirfield.scn | 1 | 20000 | 4 (ABCD) | O1, O2, O3 | 12 | 169 |
| Airfield | T02M04_Airfield.scn | 2 | 20000 | 4 (ABCD) | O1, O2, O3 | 8 | 162 |
| Samrée Depot | T02M08_Depot.scn | 2 | 10000 | 2 (AB) | O1 | 0 | 1 |
| Vasyugan Fortification | T04M01.scn | 4 | 20000 | 4 (ABCD) | O1 | 16 | 1 |
| Russian Factory | T04M01_RussianFactory.scn | 4 | 20000 | 4 (AD) | O1, O2, O3 | 11 | 0 |
| Colmar Hamlet | T01M08_Mill.scn | 1 | 10000 | 2 (AB) | O1 | 0 | 0 |
| Russian Skirmish | T04M04_RussianSkirmish.scn | 4 | 10000 | 2 (AB) | O1, O2, O3 | 0 | 0 |
| Russian Encounter | T04M06_RussianEncounter.scn | 4 | 10000 | 2 (AB) | O1, O2, O3 | 0 | 0 |
| Lunéville | T01M09_TankEncounter.scn | 1 | 20000 | 2 (AB) | O1 | 0 | 0 |
| Canal Bridge | T01M11_ReconEncounter.scn | 1 | 20000 | 3 (AB) | 0 | 0 | 0 |
| City Boulevard | T03M03_CityBoulevard.scn | 3 | 20000 | 2 (AB) | - | 0 | 0 |
| Gorge | T02M09_TankEncounter.scn | 2 | 20000 | 2 (AB) | O1 | 0 | 0 |
| City River | T03M01_CityRiver.scn | 3 | 20000 | 2 (AB) | - | 0 | 0 |
| City Train | T03M02_CityTrainStation.scn | 3 | 20000 | 2 (AB) | - | 0 | 0 |
| Sawmill | T02M05_Skirmish.scn | 2 | 10000 | 2 (AB) | O1, O2, O3 | 0 | 0 |
| Village Skirmish | T01M06_VillageSkirmish.scn | 1 | 10000 | 2 (AB) | O1, O2, O3 | 0 | 0 |
| Hill 60 | T01M03_Skirmish.scn | 1 | 16000 | 2 (AB) | O1, O2, O3 | 0 | 0 |
| New Test Skirmish Map | T01M05_Skirmish.scn | 1 | 40000 | 2 (AB) | - | 0 | 0 |
| Mountain Railroad | T02M02_MountainBridge.scn | 2 | 12345680 | 0 () | - | 0 | 0 |

### T4. Assault map point coordinates (game units; x/y as stored)

**Town**: A1 (5380, -6006); A2 (5329, -3230); A3 (3602, -2832); A4 (2375, -1892); B1 (4789, 6781); B2 (5291, 4759); B3 (3624, 4031); B4 (2207, 2397); C1 (-5415, 6144); C2 (-2330, 5052); C3 (209, 5168); C4 (186, 2537); D1 (-6321, -1162); D2 (-3086, -1990); D3 (-1979, -3450); D4 (-130, -1694); E1 (-3280, -6654); E2 (-1791, -5633); E3 (-145, -4642); E4 (189, -2734); O1* (293, -824); O2* (1974, -757)

**Mountain Town**: A1 (3834, -7395); A2 (4028, -5280); A3 (2753, -3197); B1 (7017, 771); B2 (4272, 1303); B3 (2881, -679); C1 (-119, 4413); C2 (-289, 2435); C3 (1072, 449); D1 (-4467, 2553); D2 (-3595, 992); D3 (-3843, -1147); E1 (-6643, -7385); E2 (-5317, -6023); E3 (-3427, -5351); O1* (-2427, -2708); O2* (83, -1564)

**Factory**: A1 (1636, -5086); A2 (2308, -3346); A3 (1618, -2767); B1 (6034, -1226); B2 (3892, -701); B3 (2420, -1482); C1 (-576, 2498); C2 (-776, 1128); C3 (-460, -29); D1 (-2466, -1955); D2 (-1098, -2795); D3 (361, -2464); O1* (291, -1526); O2* (983, -1277)

**Airfield**: A1 (4240, -6237); A2 (4360, -3051); B1 (2011, 7276); B2 (1716, 3674); C1 (-6840, -2055); C2 (-3857, -1653); D1 (-292, -7019); D2 (-300, -4322); O1* (-1034, 980); O2* (-116, -1637); O3* (1809, -81)

**Forward Airfield**: A1 (-6349, 429); A2 (-4756, 1308); A3 (-2713, 773); B1 (-1197, 5802); B2 (-234, 4638); B3 (1502, 2477); C1 (6290, 416); C2 (5222, 1569); C3 (3469, 1615); D1 (761, -6295); D2 (-229, -4670); D3 (-45, -3091); O1* (70, -1366); O2* (-733, 782); O3* (2252, 621)


### T5. Infantry firearms (weapontemplate.json + default ammo from ammotemplate.json)

| faction | class | weapon | fire modes | mag x mags | reload s (scoped) | cycle s -> rpm | default ammo | dmg near/far | near/far range m | muzzle m/s | base cone deg | sway stand/crouch/prone (aim mult) | fatigue sway | sight range min-max (steps) | EP | flags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| GE | AT launcher | GranatBuchse 39 | single | 1 x 5 | 4.4 (4.4) | 0.6 -> 100 | [45mm Rifle Grenade] G.G.PzG. | 1100/900 | 0/100 | 70 | 0.5 | 4.17/2.67/0.26 (0.28) | 4 | 50-150 (5) | 5 |  |
| GE | AT launcher | Panzerfaust 60 | single | 1 x 1 | 3.3 (3.3) | 0.81 -> 74 | Panzerfaust 60 | 1000/750 | 0/100 | 70 | 0.54 | 2.06/1.56/1.36 (0.3) | 4 | 30-90 (3) | 5 |  |
| GE | AT launcher | Panzerschreck RPzB 54 | single | 1 x 5 | 3.6 (3.6) | 4.3 -> 14 | [88mm Rocket] 88mm Raketen Panzer Büchse Granate 4322 | 1000/750 | 0/100 | 110 | 0.53 | 2.17/1.67/1.47 (0.28) | 4 | 50-150 (3) | 5 |  |
| US | AT launcher | Bazooka M1A1 | single | 1 x 5 | 3.4 (3.4) | 4.1 -> 15 | [2.36 Inch Rocket] M6A1 Rocket | 1000/750 | 0/100 | 82 | 0.53 | 2.17/1.67/1.47 (0.28) | 4 | 50-150 (3) | 5 |  |
| US | AT launcher | Bazooka M9A1 | single | 1 x 5 | 3.4 (3.4) | 4.1 -> 15 | [2.36 Inch Rocket] M6A3 Rocket | 1000/750 | 0/100 | 82 | 0.45 | 2.17/1.67/1.47 (0.28) | 4 | 50-500 (10) | 5 |  |
| US | AT launcher | M18 Recoilless Rifle | single | 1 x 5 | 5.4 (5.4) | 6.1 -> 10 | [57mm Recoilless] 57mm HEAT M307 | 1000/750 | 0/100 | 366 | 0.15 | 2.17/1/0.35 (0.28) | 4 | 100-1100 (11) | 5 |  |
| USSR | AT launcher | Ampulomet-41 | single | 1 x 5 | 6 (6) | 6.7 -> 9 | [125mm Grenade] FBM-125 | 1000/750 | 0/100 | 60 | 0.6 | 4.17/2.67/0.26 (0.28) | 4 | 25-150 (11) | 5 |  |
| GE | Semi-auto rifle | Gewehr 43 | single | 10 x 8 | 3.1 (3.1) | 0.237 -> 253 | [7.92x57mm Mauser] S.m.E. 7.92 ball | 47/35 | 64/160 | 852 | 0.13 | 0.45/0.37/0.2 (0.2) | 4 | 100-2000 (1) | 5 |  |
| US | Semi-auto rifle | M1 Carbine | single | 15 x 10 | 3 (3) | 0.133 -> 451 | [.30 Carbine] .30 Carbine | 29/15 | 35/80 | 600 | 0.4 | 0.47/0.27/0.17 (0.2) | 3 | 100-200 (2) | 5 | clipautoeject=1 |
| US | Semi-auto rifle | M1 Garand | single | 8 x 10 | 2.8 (2.8) | 0.217 -> 276 | [.30-06 Springfield] M2 .30-06 Ball | 49/35 | 65/150 | 852 | 0.11 | 0.52/0.32/0.22 (0.2) | 4 | 100-800 (1) | 5 | clipautoeject=1 |
| US | Semi-auto rifle | M1A1 Carbine | single | 15 x 10 | 3 (3) | 0.133 -> 451 | [.30 Carbine] .30 Carbine | 29/15 | 35/80 | 600 | 0.45 | 0.47/0.27/0.17 (0.2) | 3 | 100-800 (8) | 4 | clipautoeject=1 |
| USSR | Semi-auto rifle | Tokarev SVT-40 | single | 10 x 8 | 2.9 (2.9) | 0.209 -> 287 | [7.62x54mmR] Type L Light Ball | 47/38 | 70/140 | 949 | 0.145 | 0.41/0.32/0.19 (0.2) | 4 | 100-2000 (1) | 5 |  |
| GE | Bolt-action / AT rifle | Karabiner 98 Kurz | single | 5 x 10 | 3.7 (5.2) | 1.425 -> 42 | [7.92x57mm Mauser] S.m.E. 7.92 ball | 47/35 | 64/160 | 852 | 0.04 | 1/0.3/0.15 (0.15) | 4 | 100-2000 (20) | 5 |  |
| GE | Bolt-action / AT rifle | PanzerBuchse-39 | single | 1 x 10 | 4.3 (4.3) | 4.6 -> 13 | [7.92x94mm] Patrone 318 SmK-Rs-L'spur | 250/100 | 150/500 | 1210 | 0.8 | 5.2/3.2/0.26 (0.4) | 7 | 300-300 (1) | 7 |  |
| US | Bolt-action / AT rifle | Rifle M1903 | single | 5 x 10 | 3.4 (4.9) | 1.38 -> 43 | [.30-06 Springfield] M2 .30-06 Ball | 49/35 | 65/150 | 852 | 0.04 | 1/0.3/0.15 (0.15) | 4 | 100-2000 (20) | 5 |  |
| USSR | Bolt-action / AT rifle | Mosin-Nagant 1891-30 | single | 5 x 10 | 3.6 (5.1) | 1.429 -> 42 | [7.62x54mmR] Type L Light Ball | 47/38 | 70/140 | 949 | 0.04 | 1/0.3/0.15 (0.15) | 4 | 100-2000 (20) | 5 |  |
| USSR | Bolt-action / AT rifle | PTRD 1941 | single | 1 x 10 | 4.3 (4.3) | 4.6 -> 13 | [14.5x114mm] 14.5mm BS-41 | 300/150 | 200/600 | 1114 | 0.8 | 5.2/3.2/0.26 (0.4) | 7 | 100-2000 (20) | 7 |  |
| USSR | Bolt-action / AT rifle | PTRS-41 | single | 5 x 3 | 7 (4.8) | 0.4 -> 150 | [14.5x114mm] 14.5mm BS-41 | 300/150 | 200/600 | 1114 | 1 | 5.2/3.2/0.46 (0.4) | 7 | 100-1500 (15) | 7 |  |
| GE | Assault rifle / flamethrower | EinstossFlammenWerfer46 | auto | 1 x 1 | 5 (8) | 1.05 -> 57 | Flamethrower Fuel | 50/0 | 20/25 | 60 | 0 | 3.55/2.15/1.45 (0.44) | 5 | 50-50 (1) | 8 |  |
| GE | Assault rifle / flamethrower | FlammenWerfer41 | auto | 10 x 2 | 8 (8) | 1.05 -> 57 | Flamethrower Fuel | 50/0 | 20/25 | 60 | 0 | 3.55/2.15/1.45 (0.44) | 5 | 50-50 (1) | 8 |  |
| GE | Assault rifle / flamethrower | Sturmgewehr 44 | auto/single | 30 x 6 | 3.2 (3.2) | 0.12 -> 500 | [7.92×33mm Kurz] Kurzpatrone 43 | 34/23 | 35/140 | 685 | 0.31 | 1.58/1.42/0.66 (0.25) | 4 | 100-1000 (10) | 6 |  |
| US | Assault rifle / flamethrower | M1/M2 Carbine | auto/single | 30 x 6 | 3.2 (3.2) | 0.104 -> 577 | [.30 Carbine] .30 Carbine | 29/15 | 35/80 | 600 | 0.35 | 1.25/1.05/0.5 (0.2) | 3 | 100-300 (5) | 6 | clipautoeject=1 |
| US | Assault rifle / flamethrower | M2 FlameThrower | auto | 5 x 4 | 6 (6) | 0.71 -> 85 | Flamethrower Fuel | 50/0 | 20/25 | 60 | 0 | 3.55/2.15/1.45 (0.44) | 5 | 50-50 (1) | 8 |  |
| USSR | Assault rifle / flamethrower | AVS-36 | auto/single | 15 x 10 | 3 (3) | 0.11 -> 545 | [7.62x54mmR] Type L Light Ball | 47/38 | 70/140 | 949 | 0.25 | 1.6/1.36/0.6 (0.2) | 4 | 100-800 (8) | 6 | clipautoeject=1 |
| USSR | Assault rifle / flamethrower | ROKS3 | auto | 10 x 2 | 7 (7) | 2.05 -> 29 | Flamethrower Fuel | 50/0 | 20/25 | 60 | 0 | 3.55/2.15/1.45 (0.44) | 5 | 50-50 (1) | 8 |  |
| GE | LMG / MG | Fallschirmjägergewehr 42 | auto/single | 20 x 7 | 3.3 (3.3) | 0.111 -> 540 | [7.92x57mm Mauser] S.m.E. 7.92 ball | 47/35 | 64/160 | 852 | 0.41 | 1.76/1.36/0.66 (0.3) | 7 | 100-1000 (10) | 6 |  |
| GE | LMG / MG | MG-13 | auto/single | 25 x 6 | 3.6 (3.6) | 0.109 -> 550 | [7.92x57mm Mauser] S.m.E. 7.92 ball | 47/35 | 64/160 | 852 | 0.41 | 1.83/1.02/0.66 (0.3) | 7 | 100-2000 (20) | 6 | no fire while running |
| GE | LMG / MG | Maschinengewehr 34 | auto/single | 50 x 3 | 5.7 (5.7) | 0.086 -> 700 | [7.92x57mm Mauser] S.m.E. 7.92 ball | 47/35 | 64/160 | 852 | 0.27 | 2.5/1.05/0.6 (0.38) | 8 | 100-2000 (20) | 7 | no fire while running, proneandaimonly=1 |
| GE | LMG / MG | Maschinengewehr 42 | auto | 100 x 2 | 7 (7) | 0.06 -> 1000 | [7.92x57mm Mauser] S.m.E. 7.92 ball | 47/35 | 64/160 | 852 | 0.25 | 4/1.7/0.4 (0.35) | 8 | 100-2000 (20) | 7 | no fire while running, proneandaimonly=1 |
| US | LMG / MG | Johnson M1941 LMG | auto/single | 20 x 7 | 3.5 (3.5) | 0.104 -> 577 | [.30-06 Springfield] M2 .30-06 Ball | 49/35 | 65/150 | 852 | 0.45 | 2.1/1.2/0.66 (0.3) | 7 | 100-1000 (10) | 6 |  |
| US | LMG / MG | M1918 Automatic Rifle | auto/single | 20 x 8 | 3.5 (3.5) | 0.115 -> 522 | [.30-06 Springfield] M2 .30-06 Ball | 49/35 | 65/150 | 852 | 0.4 | 1.71/0.99/0.54 (0.3) | 7 | 100-1500 (15) | 6 | no fire while running, proneandaimonly=1 |
| US | LMG / MG | M1919 MG | auto | 100 x 2 | 7 (7) | 0.1 -> 600 | [.30-06 Springfield] M2 .30-06 Ball | 49/35 | 65/150 | 852 | 0.25 | 4/1.45/0.45 (0.38) | 8 | 100-1200 (12) | 7 | no fire while running, proneandaimonly=1 |
| US | LMG / MG | M1919A4 | auto | 50 x 3 | 6.2 (6.2) | 0.1 -> 600 | [.30-06 Springfield] M2 .30-06 Ball | 49/35 | 65/150 | 852 | 0.2 | 3/1.7/0.8 (0.38) | 8 | 200-1200 (6) | 7 | no fire while running, proneandaimonly=1 |
| USSR | LMG / MG | Degtyarev DP 28 | auto | 47 x 3 | 5.7 (5.7) | 0.109 -> 550 | [7.62x54mmR] Type L Light Ball | 47/38 | 70/140 | 949 | 0.5 | 1.82/1/0.86 (0.3) | 7 | 100-2000 (20) | 6 | no fire while running, proneandaimonly=1 |
| USSR | LMG / MG | Degtyarev DT 29 | auto | 63 x 3 | 5.7 (5.7) | 0.1 -> 600 | [7.62x54mmR] Type L Light Ball | 47/38 | 70/140 | 949 | 0.35 | 2.5/1.21/0.6 (0.38) | 8 | 100-1000 (10) | 7 | no fire while running, proneandaimonly=1 |
| USSR | LMG / MG | Maxim-Tokarev | auto | 100 x 2 | 7 (7) | 0.1 -> 600 | [7.62x54mmR] Type L Light Ball | 47/38 | 70/140 | 949 | 0.25 | 4/1.45/0.45 (0.38) | 8 | 100-2000 (20) | 7 | no fire while running, proneandaimonly=1 |
| GE | Sniper rifle | Karabiner 98 Kurz Scoped | single | 5 x 10 | 4.4 (4.4) | 2.05 -> 29 | [7.92x57mm Mauser] S.m.E. 7.92 ball | 47/35 | 64/160 | 852 | 0.03 | 0.99/0.49/0.29 (0.2) | 3 | 100-2000 (20) | 5 |  |
| US | Sniper rifle | Springfield M1903 Scoped | single | 5 x 10 | 4.4 (4.4) | 2.05 -> 29 | [.30-06 Springfield] M2 .30-06 Ball | 49/35 | 65/150 | 852 | 0.02 | 0.99/0.49/0.29 (0.2) | 3 | 100-2000 (20) | 5 |  |
| USSR | Sniper rifle | Mosin-Nagant 1891-30 Scoped | single | 5 x 10 | 4.4 (4.4) | 2.05 -> 29 | [7.62x54mmR] Type L Light Ball | 47/38 | 70/140 | 949 | 0.03 | 0.99/0.49/0.29 (0.2) | 3 | 100-2000 (20) | 5 |  |
| GE | SMG | Maschinenpistole 34 | auto | 20 x 7 | 2.9 (2.9) | 0.12 -> 500 | [9mm Parabellum] 9mm Parabellum | 32/18 | 22/68 | 425 | 0.69 | 1.51/1.11/0.41 (0.3) | 1.5 | 50-50 (1) | 6 |  |
| GE | SMG | Maschinenpistole 40 | auto | 32 x 5 | 3.2 (3.2) | 0.109 -> 550 | [9mm Parabellum] 9mm Parabellum | 32/18 | 22/68 | 425 | 0.6 | 1.35/1.05/0.35 (0.3) | 1.5 | 50-50 (1) | 6 |  |
| US | SMG | M3 Grease Gun | auto | 30 x 5 | 3.1 (3.1) | 0.13 -> 462 | [.45 APC] .45 Army Ball | 33/18 | 20/65 | 253 | 0.64 | 1.56/1.16/0.46 (0.3) | 1.5 | 50-50 (1) | 6 |  |
| US | SMG | Thompson M1A1 | auto/single | 30 x 5 | 2.9 (2.9) | 0.1 -> 600 | [.45 APC] .45 Army Ball | 33/18 | 20/65 | 253 | 0.5 | 1.55/1.15/0.45 (0.3) | 1.5 | 50-50 (1) | 6 |  |
| US | SMG | Thompson M1A1 PBR | auto/single | 30 x 5 | 2.9 (2.9) | 0.1 -> 600 | [.45 APC] .45 Army Ball | 33/18 | 20/65 | 253 | 0.5 | 1.55/1.15/0.45 (0.3) | 1.5 | 50-50 (1) | 6 |  |
| USSR | SMG | PPD-40 | auto/single | 71 x 2 | 4.2 (4.2) | 0.092 -> 650 | [7.62x25mm Tokarev] 7.62 TT | 29/11 | 20/65 | 480 | 0.7 | 1.7/1.3/0.8 (0.3) | 2.5 | 50-50 (1) | 6 |  |
| USSR | SMG | PPS-43 | auto | 35 x 4 | 3 (4.2) | 0.109 -> 550 | [7.62x25mm Tokarev] 7.62 TT | 29/11 | 20/65 | 480 | 0.65 | 1.6/1.2/0.5 (0.3) | 1.5 | 50-50 (1) | 6 |  |
| USSR | SMG | PPSh-41 | auto/single | 71 x 2 | 4.3 (4.3) | 0.071 -> 850 | [7.62x25mm Tokarev] 7.62 TT | 29/11 | 20/65 | 480 | 0.66 | 1.6/1.2/0.7 (0.3) | 2.5 | 100-200 (2) | 6 |  |
| USSR | SMG | PPSh-41 PBR | auto/single | 71 x 2 | 4.3 (4.3) | 0.092 -> 650 | [7.62x25mm Tokarev] 7.62 TT | 29/11 | 20/65 | 480 | 0.748 | 2.5/1.64/0.86 (0.3) | 1.5 | 50-50 (1) | 6 |  |
| any | SMG | Machine Carbine Mk I | auto | 33 x 5 | 3.2 (3.2) | 0.109 -> 550 | [9mm Parabellum] 9mm Parabellum | 32/18 | 22/68 | 425 | 0.6 | 1.35/1.05/0.35 (0.3) | 1.5 | 50-50 (1) | 6 |  |
| GE | Pistol | Model 1934 | single | 8 x 3 | 2.85 (2.85) | 0.174 -> 346 | [7.65x17mm SR] 7.65mm Ball | 30/14 | 10/50 | 348 | 0.25 | 1.2/0.7/0.5 (0.6) | 1 | 25-25 (1) | 1 |  |
| GE | Pistol | P08 Parabellum | single | 8 x 4 | 2.55 (2.55) | 0.139 -> 432 | [9mm Parabellum] 9mm Parabellum | 32/18 | 22/68 | 425 | 0.24 | 1.21/1.11/1.01 (0.3) | 1 | 50-450 (9) | 2 |  |
| GE | Pistol | P38 Parabellum | single | 8 x 4 | 2.65 (2.65) | 0.139 -> 432 | [9mm Parabellum] 9mm Parabellum | 32/18 | 22/68 | 425 | 0.24 | 1.21/1.11/1.01 (0.3) | 1 | 50-50 (1) | 2 |  |
| GE | Pistol | Pistol C96 | single | 10 x 4 | 2.65 (2.65) | 0.167 -> 360 | [9mm Parabellum] 9mm Parabellum | 32/18 | 22/68 | 425 | 0.31 | 0.8/0.5/0.3 (0.5) | 1 | 50-450 (9) | 2 |  |
| US | Pistol | 1903 Pocket Hammerless | single | 8 x 3 | 3.1 (3.1) | 0.174 -> 346 | [.32 ACP] .32 ACP Ball | 30/14 | 10/50 | 253 | 0.2 | 1.2/0.7/0.5 (0.6) | 1 | 25-25 (1) | 1 |  |
| US | Pistol | 1911 Pistol | single | 8 x 5 | 2.85 (2.85) | 0.16 -> 375 | [.45 APC] .45 Army Ball | 33/18 | 20/65 | 253 | 0.2 | 0.8/0.5/0.3 (0.5) | 1 | 25-25 (1) | 2 |  |
| US | Pistol | M1917 Revolver | single | 6 x 5 | 3.35 (3.35) | 0.18 -> 333 | [.45 APC] .45 Army Ball | 33/18 | 20/65 | 253 | 0.13 | 0.78/0.48/0.35 (0.1) | 1 | 25-25 (1) | 2 |  |
| USSR | Pistol | Korovin TK | single | 8 x 3 | 3 (3) | 0.139 -> 432 | [6.35x15.5mm SR] 6.35mm Ball | 25/10 | 10/50 | 228 | 0.25 | 1.2/0.7/0.5 (0.6) | 1 | 25-25 (1) | 1 |  |
| USSR | Pistol | Nagant M1895 | single | 7 x 5 | 5.5 (3.35) | 0.174 -> 346 | [7.62x38mmR] Red Army Ball | 37/23 | 22/65 | 327 | 0.1 | 0.78/0.48/0.35 (0.1) | 1 | 25-25 (1) | 2 |  |
| USSR | Pistol | Tula Tokarev 33 | single | 8 x 5 | 2.95 (2.95) | 0.154 -> 389 | [7.62x25mm Tokarev] 7.62 TT | 29/11 | 20/65 | 480 | 0.39 | 0.95/0.65/0.56 (0.3) | 1 | 25-25 (1) | 2 |  |
| any | Pistol | FP-45 Liberator Pistol | single | 1 x 10 | 5 (5) | 5.25 -> 11 | [.45 APC] .45 Army Ball | 33/18 | 20/65 | 253 | 0.2 | 0.8/0.5/0.3 (0.5) | 1 | 25-25 (1) | 0 |  |

### T6. Grenades, mines, AT grenades, melee and equipment (weapontemplate.json + ammotemplate.json)

| faction | item | category id | carried (x count) | EP | fuse / timer s | blast dmg | blast radius | vs armour: penetration mm / damage | notes |
|---|---|---|---|---|---|---|---|---|---|
| GE | Dienstglas 6x30 | 4 | 1 x 1 | 1 | - | - | - | - | |
| GE | German First Aid Kit | 4 | 1 x 1 | 1 | 0 | 0 | 0 | - |  |
| GE | German Medic Pouch | 4 | 1 x 3 | 2 | 0 | 0 | 0 | - |  |
| GE | RZ20 Parachute | 4 | 1 x 1 | 5 | - | - | - | - | |
| US | N-K M3 6x30 | 4 | 1 x 1 | 1 | - | - | - | - | |
| US | T-5 Parachute | 4 | 1 x 1 | 5 | - | - | - | - | |
| US | U.S. First Aid Kit | 4 | 1 x 1 | 1 | 0 | 0 | 0 | - |  |
| US | U.S. Medic Pouch | 4 | 1 x 3 | 2 | 0 | 0 | 0 | - |  |
| USSR | N-K 6x30 | 4 | 1 x 1 | 1 | - | - | - | - | |
| USSR | Soviet First Aid Kit | 4 | 1 x 1 | 1 | 0 | 0 | 0 | - |  |
| USSR | Soviet Medic Pouch | 4 | 1 x 3 | 2 | 0 | 0 | 0 | - |  |
| any | Adjustable Wrench | 4 | 0 x 0 | 1 | 0 | 0 | 0 | - | direct dmg 35/5 |
| any | Map | 4 | 0 x 0 | 0 | - | - | - | - | |
| GE | S-Mine | 5 | 1 x 2 | 2 | 0 | 250 | 2.5 | 6-10 / 200-250 |  weight threshold 50 |
| US | M2A3 | 5 | 1 x 2 | 2 | 0 | 250 | 2.5 | 6-10 / 200-250 |  weight threshold 50 |
| USSR | PMK-40 | 5 | 1 x 2 | 2 | 0 | 80 | 1.5 | 6-10 / 100-150 |  weight threshold 50 |
| GE | Tellermine 42 | 6 | 1 x 2 | 3 | 0 | 3000 | 2.5 | 200-200 / 2000-4000 |  weight threshold 500 |
| US | M1A1 | 6 | 1 x 2 | 3 | 0 | 3000 | 2.5 | 200-200 / 2000-4000 |  weight threshold 500 |
| USSR | TM-35 | 6 | 1 x 2 | 3 | 0 | 3000 | 2.5 | 200-200 / 2000-4000 |  weight threshold 500 |
| GE | Hafthohlladung H3 | 7 | 1 x 3 | 2 | 5 | 1000 | 5 | 60-75 / 1100-1400 |  |
| GE | Panzerwurfmine Lang | 7 | 1 x 3 | 2 | 0 | 110 | 7.5 | 85-126 / 800-1100 | direct dmg 200/200 |
| US | S.T. Grenade No.74 | 7 | 1 x 3 | 2 | 5 | 2000 | 5 | 45-60 / 700-900 |  |
| USSR | RPG-43 | 7 | 1 x 3 | 2 | 0 | 110 | 7.5 | 70-110 / 800-1100 | direct dmg 200/200 |
| any | Easter Egg | 7 | 1 x 100 | 0 | 0 | 0 | 0.1 | - | direct dmg 10/10 |
| any | Snowball | 7 | 1 x 100 | 0 | 0 | 0 | 0.1 | - | direct dmg 10/10 |
| GE | M24 Frag sleeve | 9 | 1 x 3 | 2 | 3 | 110 | 25 | 4-6 / 70-120 | direct dmg 100/10 |
| GE | Stielhandgranate 24 | 9 | 1 x 3 | 2 | 2.5 | 170 | 10 | 4-6 / 70-120 | direct dmg 100/10 |
| GE | Stielhandgranate 24 Bundle | 9 | 1 x 2 | 2 | 3.5 | 200 | 20 | 20-40 / 750-1200 | direct dmg 100/10 |
| US | Crate Demolition Kit | 9 | 1 x 1 | 2 | 3.5 | 200 | 20 | 20-40 / 750-1200 | direct dmg 100/10 |
| US | Demolition Kit M1 | 9 | 1 x 2 | 2 | 3.5 | 200 | 20 | 20-40 / 750-1200 | direct dmg 100/10 |
| US | Mk II | 9 | 1 x 3 | 2 | 3 | 110 | 25 | 4-6 / 70-120 | direct dmg 100/10 |
| US | Mk IIIA1 | 9 | 1 x 3 | 2 | 2.5 | 170 | 10 | 4-6 / 70-120 | direct dmg 100/10 |
| USSR | RG-42 | 9 | 1 x 3 | 2 | 2.5 | 170 | 10 | 4-6 / 70-120 | direct dmg 100/10 |
| USSR | RGD-33 | 9 | 1 x 3 | 2 | 3 | 110 | 25 | 4-6 / 70-120 | direct dmg 100/10 |
| USSR | RGD-33 Bundle | 9 | 1 x 2 | 2 | 3.5 | 200 | 20 | 20-40 / 750-1200 | direct dmg 100/10 |
| GE | Baseball Bat 1936 Berlin | 10 | 0 x 0 | 2 | 0 | 0 | 0 | - | direct dmg 70/10 |
| GE | Schanzzeug Spade | 10 | 0 x 0 | 1 | 0 | 0 | 0 | - | direct dmg 60/10 |
| GE | Seitengewehr 98 | 10 | 0 x 0 | 1 | 0 | 0 | 0 | - | direct dmg 70/10 |
| US | Baseball Bat | 10 | 0 x 0 | 2 | 0 | 0 | 0 | - | direct dmg 70/10 |
| US | Combat Knife 1219C2 | 10 | 0 x 0 | 1 | 0 | 0 | 0 | - | direct dmg 70/10 |
| US | M-1910 Spade | 10 | 0 x 0 | 1 | 0 | 0 | 0 | - | direct dmg 60/10 |
| USSR | AVS-36 Bayonet | 10 | 0 x 0 | 1 | 0 | 0 | 0 | - | direct dmg 70/10 |
| USSR | Lapta Bat | 10 | 0 x 0 | 2 | 0 | 0 | 0 | - | direct dmg 70/10 |
| USSR | NR-40 'Scouts knife' | 10 | 0 x 0 | 1 | 0 | 0 | 0 | - | direct dmg 70/10 |
| USSR | Vulcan Stalin | 10 | 0 x 0 | 1 | 0 | 0 | 0 | - | direct dmg 60/10 |

### T7. Weapon modification parts (WeaponModifierTemplate.json); multipliers, 1.0 = unchanged; duplicates with identical effects collapsed

| slot | part | non-1.0 multipliers / sight data |
|---|---|---|
| Barrel | Scout II | RangeNear x1.15, RangeFar x1.15, DamageFar x1.2, CameraRecoilUp x1.1, CameraRecoilRight x1.1 |
| Barrel | Stainless Steel Barrel | RangeNear x1.1, RangeFar x1.1, CameraRecoilUp x1.05, CameraRecoilRight x1.05 |
| Barrel | Chrome Lined Barrel | RangeNear x1.2, RangeFar x1.2, CameraRecoilUp x1.1, CameraRecoilRight x1.1 |
| Barrel | Chrome Lined Barrel | RangeNear x1.1, RangeFar x1.1, Damage x1.061 |
| Barrel | Chrome Moly 4150 | RangeNear x1.05, Damage x1.331, DamageFar x1.15, CameraRecoilUp x1.1, CameraRecoilRight x1.1, ConeStandMode x1.2, ConeAimModifier x1.15, ConeContractionPerSecond x0.95 |
| Barrel | Könich FJ-S | RangeNear x1.1, RangeFar x1.2, CameraRecoilUp x1.02, RecoilTime x1.05, ChamberTime x1.05, ConeStandMode x0.95, ConeAimModifier x0.92, ConeContractionPerSecond x1.07 |
| Barrel | Octagon | RangeFar x1.05, Damage x1.269, DamageFar x1.05, CameraRecoilUp x1.1, CameraRecoilRight x1.1, ConeStandMode x1.1, ConeAimModifier x1.1, ConeContractionPerSecond x0.9 |
| Barrel | Scout II | RangeNear x1.05, RangeFar x1.05, Damage x1.27, DamageFar x1.1, CameraRecoilUp x1.1, CameraRecoilRight x1.1, ConeStandMode x1.05, ConeAimModifier x1.05, ConeContractionPerSecond x0.95 |
| Barrel | Scout II-s | RangeNear x1.05, RangeFar x1.05, Damage x1.16, DamageFar x1.05, CameraRecoilUp x1.1, CameraRecoilRight x1.1, ConeStandMode x1.05, ConeAimModifier x1.05, ConeContractionPerSecond x0.95 |
| Barrel | Stainless Steel Barrel | RangeNear x1.11, RangeFar x1.08, Damage x1.01, DamageFar x1.1, CameraRecoilUp x1.06, CameraRecoilRight x1.06 |
| Barrel | Stainless Steel Barrel | RangeNear x1.13, RangeFar x0.97, CameraRecoilUp x1.05, CameraRecoilRight x1.05 |
| Barrel | Stainless Steel Barrel | RangeNear x1.05, RangeFar x1.05, CameraRecoilUp x1.04, CameraRecoilRight x1.04 |
| Barrel | Stainless Steel Barrel | RangeNear x1.1, RangeFar x1.1, CameraRecoilUp x1.1, CameraRecoilRight x1.1 |
| Barrel | Stainless Steel Barrel | ConeStandMode x0.9, ConeAimModifier x0.9, ConeContractionPerSecond x1.1 |
| Barrel | URAH-2 Heavy Barrel | RangeNear x1.14, RangeFar x1.18, DamageFar x1.04, CameraRecoilUp x0.96, CameraRecoilRight x0.95, RecoilTime x1.08, ChamberTime x1.08, ConeStandMode x0.97, ConeAimModifier x0.98, ConeContractionPerSecond x1.05 |
| Internal | Heavy Bolt | Damage x1.3, DamageFar x1.1, CameraRecoilUp x1.1, CameraRecoilRight x1.1, RecoilTime x1.15, ChamberTime x1.15, ConeStandMode x1.05, ConeAimModifier x1.05, ConeContractionPerSecond x0.95 |
| Internal | Heavy Spring | CameraRecoilUp x0.9, CameraRecoilRight x0.9, RecoilTime x1.1, ChamberTime x1.1 |
| Internal | Lightened Bolt | RangeNear x0.95, RangeFar x0.95, RecoilTime x0.95, ChamberTime x0.95 |
| Internal | Lightened Spring | CameraRecoilUp x1.05, CameraRecoilRight x1.05, RecoilTime x0.95, ChamberTime x0.95 |
| Internal | Heavy Bolt | Damage x1.32, DamageFar x1.1, CameraRecoilUp x1.1, CameraRecoilRight x1.1, RecoilTime x1.15, ChamberTime x1.1, ConeStandMode x1.05, ConeAimModifier x1.05, ConeContractionPerSecond x0.95 |
| Internal | Heavy Bolt | RangeNear x1.1, RangeFar x1.1, Damage x1.03, CameraRecoilUp x1.1, CameraRecoilRight x1.1, RecoilTime x1.1, ChamberTime x1.1 |
| Internal | Heavy Pistol Bolt | RangeNear x1.15, RangeFar x1.15, Damage x1.1, RecoilTime x1.08, ChamberTime x1.08 |
| Internal | Heavy Pistol Spring | CameraRecoilUp x0.8, CameraRecoilRight x0.8, RecoilTime x1.08, ChamberTime x1.08 |
| Internal | Heavy Spring | CameraRecoilUp x0.9, CameraRecoilRight x0.9, RecoilTime x1.08, ChamberTime x1.08 |
| Internal | Light Pistol Bolt | RangeNear x0.9, RangeFar x0.9, RecoilTime x0.93, ChamberTime x0.94 |
| Internal | Light Pistol Spring | CameraRecoilUp x1.04, CameraRecoilRight x1.04, RecoilTime x0.92, ChamberTime x0.93 |
| Internal | Lightened Bolt | RangeNear x0.95, RangeFar x0.95, CameraRecoilUp x1.05, CameraRecoilRight x1.05, RecoilTime x0.92, ChamberTime x0.92, ConeStandMode x1.03, ConeAimModifier x1.04 |
| Internal | Lightened Bolt | RangeNear x0.9, RangeFar x0.9, RecoilTime x0.86, ChamberTime x0.88 |
| Internal | Lightened Spring | CameraRecoilUp x1.1, CameraRecoilRight x1.1, RecoilTime x0.93, ChamberTime x0.91 |
| Internal | Lightened Spring | CameraRecoilUp x1.04, CameraRecoilRight x1.04, RecoilTime x0.9, ChamberTime x0.9 |
| Internal | Lightened Spring | CameraRecoilUp x1.05, CameraRecoilRight x1.05, RecoilTime x0.92, ChamberTime x0.92 |
| Internal | Lightened Spring | RangeNear x0.92, RangeFar x0.85, RecoilTime x0.93, ChamberTime x0.93 |
| Internal | Lightened spring | CameraRecoilUp x1.1, CameraRecoilRight x1.1, RecoilTime x0.94, ChamberTime x0.94, ConeStandMode x1.03, ConeAimModifier x1.04 |
| Internal | Special Light Bolt | RangeNear x0.96, RangeFar x0.94, CameraRecoilUp x1.04, CameraRecoilRight x1.03, RecoilTime x0.92, ChamberTime x0.92, ConeStandMode x1.04, ConeAimModifier x1.04 |
| Sight | Field Adjusted Sights | ConeStandMode x0.9, ConeAimModifier x0.9, ConeContractionPerSecond x1.1 |
| Sight | Field Adjusted Sights | ConeStandMode x0.95, ConeAimModifier x0.91, ConeContractionPerSecond x1.1 |
| Sight | M73B1 (Infantry Marksman) | magnification 1.9x, range 100-800 m in 50 m steps |
| Sight | M73B1 (Infantry) | magnification 1.9x, range 100-800 m in 50 m steps |
| Sight | M84 (Fine Cross) | magnification 2.75x, range 100-800 m in 50 m steps |
| Sight | M84 (Fine Duplex) | magnification 2.75x, range 100-800 m in 50 m steps |
| Sight | M84 (German#1) | magnification 2.75x, range 100-800 m in 50 m steps |
| Sight | M84 (German#4) | magnification 2.75x, range 100-800 m in 50 m steps |
| Sight | Match Sights | ConeStandMode x0.85, ConeAimModifier x0.85, ConeContractionPerSecond x1.15 |
| Sight | Match Sights | ConeStandMode x0.85, ConeAimModifier x0.85, ConeContractionPerSecond x1.1 |
| Sight | PE (Fine Cross) | magnification 4x, range 100-800 m in 50 m steps |
| Sight | PE (Fine Duplex) | magnification 4x, range 100-800 m in 50 m steps |
| Sight | PE (German#1) | magnification 4x, range 100-800 m in 50 m steps |
| Sight | PE (German#4) | magnification 4x, range 100-800 m in 50 m steps |
| Sight | PU (Infantry Marksman) | magnification 1.9x, range 100-800 m in 50 m steps |
| Sight | PU (Infantry) | magnification 1.9x, range 100-800 m in 50 m steps |
| Sight | Unertl 8X (Fine Cross) | magnification 8x, range 100-800 m in 50 m steps |
| Sight | Unertl 8X (Fine Duplex) | magnification 8x, range 100-800 m in 50 m steps |
| Sight | Unertl 8X (German#1) | magnification 8x, range 100-800 m in 50 m steps |
| Sight | Unertl 8X (German#4) | magnification 8x, range 100-800 m in 50 m steps |
| Sight | Unertl 8X (T-Post) | magnification 8x, range 100-800 m in 50 m steps |
| Sight | ZF-39 (Fine Cross) | magnification 4.2x, range 100-800 m in 50 m steps |
| Sight | ZF-39 (Fine Duplex) | magnification 4.2x, range 100-800 m in 50 m steps |
| Sight | ZF-39 (German#1) | magnification 4.2x, range 100-800 m in 50 m steps |
| Sight | ZF-39 (German#4) | magnification 4.2x, range 100-800 m in 50 m steps |
| Sight | ZF-4 (Fine Cross) | magnification 4x, range 100-800 m in 50 m steps |
| Sight | ZF-4 (Fine Duplex) | magnification 4x, range 100-800 m in 50 m steps |
| Sight | ZF-4 (German#1) | magnification 4.2x, range 100-800 m in 50 m steps |
| Sight | ZF-4 (German#1) | magnification 4x, range 100-800 m in 50 m steps |
| Sight | ZF-4 (German#4) | magnification 4x, range 100-800 m in 50 m steps |
| Sight | ZF-4 (T-Post) | magnification 4x, range 100-800 m in 50 m steps |
| Sight | ZF-41 (Infantry Marksman) | magnification 1.9x, range 100-800 m in 50 m steps |
| Sight | ZF-41 (Infantry) | magnification 1.9x, range 100-800 m in 50 m steps |
| Sight | ZS Zielacht (Fine Cross) | magnification 8x, range 100-800 m in 50 m steps |
| Sight | ZS Zielacht (Fine Duplex) | magnification 8x, range 100-800 m in 50 m steps |
| Sight | ZS Zielacht (German#1) | magnification 8x, range 100-800 m in 50 m steps |
| Sight | ZS Zielacht (German#4) | magnification 8x, range 100-800 m in 50 m steps |
| Sight | ZS Zielacht (T-Post) | magnification 8x, range 100-800 m in 50 m steps |
| Trigger | Field Trigger Job | CameraRecoilUp x1.05, CameraRecoilRight x1.05, RecoilTime x0.95, ChamberTime x0.95 |
| Trigger | Hair Trigger | RecoilTime x0.9, ChamberTime x0.9, ConeStandMode x1.1, ConeAimModifier x1.1, ConeContractionPerSecond x0.9 |
| Trigger | Marksman Trigger Job | CameraRecoilUp x1.2, CameraRecoilRight x1.15, RecoilTime x0.93, ChamberTime x0.93 |
| Trigger | Fast Trigger | CameraRecoilUp x1.08, CameraRecoilRight x1.04, RecoilTime x0.9, ChamberTime x0.85 |
| Trigger | Field Adjusted Trigger | CameraRecoilUp x1.05, CameraRecoilRight x1.05, RecoilTime x0.9, ChamberTime x0.9 |
| Trigger | Field Trigger Job | CameraRecoilUp x1.07, CameraRecoilRight x1.07, RecoilTime x0.93, ChamberTime x0.95 |
| Trigger | Field Trigger Job | CameraRecoilUp x1.12, CameraRecoilRight x1.12, RecoilTime x0.92, ChamberTime x0.92 |
| Trigger | Field Trigger Job | CameraRecoilUp x1.04, CameraRecoilRight x1.04, RecoilTime x0.91, ChamberTime x0.93 |
| Trigger | Field Trigger Job | CameraRecoilUp x1.05, CameraRecoilRight x1.05, RecoilTime x0.9, ChamberTime x0.9 |
| Trigger | Field Trigger Job | CameraRecoilUp x1.07, CameraRecoilRight x1.07, RecoilTime x0.93, ChamberTime x0.93 |
| Trigger | Fine Hair Trigger | CameraRecoilUp x1.08, CameraRecoilRight x1.08, RecoilTime x0.85, ChamberTime x0.85 |
| Trigger | Hair Trigger | CameraRecoilUp x1.08, CameraRecoilRight x1.08, RecoilTime x0.87, ChamberTime x0.89 |
| Trigger | Hair Trigger | CameraRecoilUp x1.1, CameraRecoilRight x1.1, RecoilTime x0.87, ChamberTime x0.89 |
| Trigger | Marksman Trigger Job | RecoilTime x0.9, ChamberTime x0.9, ConeStandMode x1.2, ConeAimModifier x1.2, ConeContractionPerSecond x0.9 |
| Trigger | Marksman Trigger Job | RecoilTime x0.86, ChamberTime x0.87, ConeStandMode x1.05, ConeAimModifier x1.05, ConeContractionPerSecond x0.95 |
| Trigger | Match Trigger | RecoilTime x0.85, ChamberTime x0.86, ConeStandMode x1.08, ConeAimModifier x1.08, ConeContractionPerSecond x0.9 |

### T8. Vehicles (vehicletemplate.json, VehicleWeaponSlot.json); seat 1 = driver/pilot seat

| faction | vehicle | type | resource class | hitPoints | armorHPMul | top speed / reverse (km/h, per field names) | mobile spawn | deployPoolCost | seat -> weapons |
|---|---|---|---|---|---|---|---|---|---|
| GE | Kubelwagen Typ 82 | wheeled | terrain_vehicle | 500 | 0.5 | 80 / 27 |  | 200 | 2: Kubelwagen - Mounted MG42, Kübelwagen Typ82 - Mounted MG42 |
| GE | Opel Blitz | wheeled | armored_personnel_carrier | 750 | 1.5 | 75 / 22 | yes | 700 |  |
| GE | SdKfz 2 Kettenkrad HK 101 | wheeled | motorcycle | 375 | 0.5 | 70 / 12 |  | 360 |  |
| GE | SdKfz 222 | wheeled | armoured_car | 900 | 3 | 75 / 20.8 |  | 460 | 2: 20mm KwK 30 L/55, Tiger I - Coaxial |
| GE | SdKfz 234/2 Puma | wheeled | armoured_car | 900 | 3 | 80 / 80 |  | 660 | 2: 50mm KwK 39 L/60, MG-42 - Coaxial |
| GE | Typ 166 Schwimmwagen | wheeled | terrain_vehicle | 500 | 0.5 | 75 / 25 |  | 240 |  |
| US | Ford GPA | wheeled | terrain_vehicle | 500 | 0.5 | 84 / 25 |  | 240 |  |
| US | GMC CCKW 352 | wheeled | armored_personnel_carrier | 750 | 1.5 | 70 / 22 | yes | 700 |  |
| US | M20 | wheeled | armoured_car | 900 | 3 | 89 / 38 |  | 360 | 2: M20 - Mounted M2HB Browning |
| US | M8 Greyhound | wheeled | armoured_car | 900 | 3 | 72 / 35 |  | 660 | 2: 37mm Greyhound, Bow M1919 Browning; 3: M18 Hellcat - Mounted M2HB Browning |
| US | Willys MB | wheeled | terrain_vehicle | 500 | 0.5 | 89 / 29 |  | 200 | 2: 1/4ton 4x4 - Mounted M2HB Browning, Mounted M1919 Browning |
| USSR | BA-11 | wheeled | armoured_car | 900 | 4 | 64 / 55 |  | 660 | 2: 45mm 20K, 7.62mm DT; 3: 7.62mm DT Mounted |
| USSR | BA-6 | wheeled | armoured_car | 900 | 3 | 55 / 25 |  | 460 | 2: 45mm 20K, 7.62mm DT; 3: 7.62mm DT Mounted |
| USSR | BA-64B | wheeled | armoured_car | 900 | 3 | 75 / 20 |  | 360 | 2: 7.62mm DT Mounted |
| USSR | GAZ-67 | wheeled | terrain_vehicle | 500 | 0.5 | 90 / 30 |  | 200 | 2: GAZ-67 Mounted- DShK 38, Mounted PM 1910-30 |
| USSR | GAZ-AAA Cargo | wheeled | armored_personnel_carrier | 750 | 1.5 | 65 / 20 | yes | 700 |  |
| USSR | GGAZ-AAA M-4 Maxim | wheeled | terrain_vehicle | 750 | 1.5 | 65 / 20 |  | 700 | 2: PM M1910 |
| any | Citroën AC4 Plateau | wheeled | - | 500 | 0.5 | 72 / 20 |  | 240 |  |
| any | Citroën AC4 Plateau | wheeled | - | 500 | 0.5 | 72 / 20 |  | 240 |  |
| any | Universal-1 Tractor | wheeled | - | 500 | 0.5 | 35 / 8 |  | 240 |  |
| GE | Jagdpanzer 38(t) "Hetzer" | tracked | tank_destroyer | 1200 | 8 | 42 / 9 |  | 240 | 1: 75mm PaK 39 L/48; 2: Kübelwagen Typ82 - Mounted MG42 |
| GE | Jagdpanzer V Jagdpanther | tracked | heavy_tank_destroyer | 1900 | 15 | 46 / 9 |  | 600 | 1: 88mm KwK 43 L/71; 2: Tiger I - Coaxial |
| GE | Panzerkampfwagen 38(t) Ausf. E | tracked | light_armor | 1200 | 10 | 42 / 12 |  | 380 | 1: 37mm KwK 38 L/47.8, 7.92mm MG 37 - Light Tank Pz38(T); 2: 7.92mm MG 37 - Light Tank Pz38(T) |
| GE | Panzerkampfwagen I Ausf. A | tracked | light_armor | 1200 | 10 | 50 / 12 |  | 240 | 1: Pz.I Ausf.A Dual MG |
| GE | Panzerkampfwagen II Ausf. C | tracked | light_armor | 1200 | 10 | 40 / 15 |  | 348 | 1: 20mm KwK 30 L/55, Tiger I - Coaxial |
| GE | Panzerkampfwagen II Ausf. L | tracked | light_armor | 1200 | 10 | 60 / 20 |  | 648 | 1: 20mm KwK 38 L/55, Tiger I - Coaxial |
| GE | Panzerkampfwagen III Ausf J | tracked | medium_armor | 1700 | 15 | 40 / 10 |  | 348 | 1: 50mm KwK 38 L/42, Tiger I - Coaxial; 2: Tiger I - Coaxial |
| GE | Panzerkampfwagen IV Ausf. H | tracked | medium_armor | 1700 | 15 | 38 / 9 |  | 380 | 1: 75mm KwK 40 L/48, Tiger I - Coaxial; 2: Tiger I - Coaxial |
| GE | Panzerkampfwagen V Ausf. G | tracked | medium_armor | 1700 | 15 | 46 / 8 |  | 648 | 1: 75mm Kw.K.42 L / 70, Tiger I - Coaxial; 2: Tiger I - Coaxial |
| GE | Panzerkampfwagen VI Tiger | tracked | heavy_armor | 2200 | 20 | 41 / 13 |  | 648 | 1: 88mm KwK 36 L/56, Tiger I - Coaxial; 2: Tiger I - Coaxial |
| GE | Panzerkampfwagen VI Tiger II | tracked | heavy_armor | 2200 | 20 | 38 / 9 |  | 750 | 1: 88mm KwK 43 L/71, Tiger I - Coaxial; 2: Tiger I - Coaxial |
| GE | Sturmgeschutz III | tracked | tank_destroyer | 1700 | 15 | 40 / 9 |  | 348 | 1: 75mm KwK 40  L/48; 2: Kübelwagen Typ82 - Mounted MG42 |
| US | M10 Wolverine | tracked | tank_destroyer | 1700 | 12 | 48 / 12 |  | 240 | 1: 76mm M7 |
| US | M18 Hellcat | tracked | tank_destroyer | 1200 | 8 | 80 / 17 |  | 348 | 1: 76mm M1A2 L/55; 2: M18 Hellcat - Mounted M2HB Browning |
| US | M24 Chaffee | tracked | light_armor | 1200 | 10 | 56 / 18 |  | 700 | 1: 75mm M6 L/39, Bow M1919 Browning; 2: Bow M1919 Browning |
| US | M26 Pershing | tracked | heavy_armor | 2200 | 20 | 35 / 12 |  | 750 | 1: 90mm M3 L/52, Bow M1919 Browning; 2: Bow M1919 Browning |
| US | M29 Weasel | tracked | terrain_vehicle | 500 | 0.5 | 58 / 17.6 |  | 320 |  |
| US | M2A2 Light Tank | tracked | light_armor | 1200 | 10 | 65 / 12 |  | 240 | 1: .50 Caliber M2 - Light Tank M2A2; 2: Bow M1919 Browning; 3: Bow M1919 Browning |
| US | M3 Lee | tracked | medium_armor | 1700 | 15 | 42 / 10 |  | 348 | 1: 75mm M2, Bow M1919 Browning Dual; 2: 37mm M5 L/53, Bow M1919 Browning; 3: Bow M1919 Browning |
| US | M36 Jackson | tracked | heavy_tank_destroyer | 1900 | 12 | 48 / 10 |  | 600 | 1: 90mm M3 L/52 |
| US | M36B1 Jackson | tracked | heavy_tank_destroyer | 1900 | 15 | 42 / 9 |  | 600 | 1: 90mm M3 L/52; 2: Bow M1919 Browning |
| US | M4A1 Sherman | tracked | medium_armor | 1700 | 15 | 40 / 12 |  | 380 | 1: 75mm M3, Bow M1919 Browning; 2: Bow M1919 Browning |
| US | M4A3E2 Jumbo Sherman | tracked | heavy_armor | 2200 | 20 | 35 / 9 |  | 648 | 1: 76mm M1A2 L/55, Bow M1919 Browning; 2: Bow M1919 Browning |
| US | M4A3E8 Sherman | tracked | medium_armor | 1700 | 15 | 42 / 10 |  | 648 | 1: 76mm M1A2 L/55, Bow M1919 Browning; 2: Bow M1919 Browning, Mounted M1919 Browning |
| US | M5A1 Stuart | tracked | light_armor | 1200 | 10 | 64 / 15 |  | 350 | 1: 37mm Stuart, Bow M1919 Browning; 2: Bow M1919 Browning |
| US | T8E1 Stuart Recce | tracked | armoured_car | 900 | 8 | 65 / 15 |  | 460 | 2: T8E1 StuartRecce - Mounted M2HB Browning; 3: Mounted M1919 Browning |
| USSR | BT-7 Model 1937 | tracked | light_armor | 1200 | 10 | 72 / 25 |  | 380 | 1: 45mm 20K Model 1934 L/46, 7.62mm DT |
| USSR | IS-2 Model 1944 | tracked | heavy_armor | 2200 | 20 | 37 / 17 |  | 750 | 1: 122mm Gun D-25T, 7.62mm DT; 2: 7.62mm DT; 3: 7.62mm DT |
| USSR | KV-85 | tracked | heavy_armor | 2200 | 20 | 42 / 16 |  | 648 | 1: 7.62mm DT, 85mm D-5T L / 52; 2: 7.62mm DT |
| USSR | SU-100 | tracked | heavy_tank_destroyer | 1900 | 15 | 48 / 12 |  | 600 | 1: 100mm D 10-S M1944 L/55 |
| USSR | SU-76M | tracked | tank_destroyer | 1200 | 8 | 50 / 10 |  | 240 | 1: 76.2mm ZIS-3T Model 1942 |
| USSR | SU-85 | tracked | tank_destroyer | 1700 | 15 | 55 / 13.5 |  | 348 | 1: 85mm D-5S L/52 |
| USSR | T-20 Komsomolets | tracked | terrain_vehicle | 500 | 0.5 | 50 / 17 |  | 360 | 2: 7.62mm DT Mounted |
| USSR | T-26 Model 1933 | tracked | light_armor | 1200 | 10 | 31 / 9 |  | 350 | 1: 45mm Gun Model 32, 7.62mm DT |
| USSR | T-28 Model 1934 | tracked | medium_armor | 1700 | 15 | 40 / 13 |  | 348 | 1: 7.62mm DT, 76.2 mm Gun KT-28 L/25; 2: 7.62mm DT; 3: 7.62mm DT; 4: 7.62mm DT |
| USSR | T-34 76 Model 1942 | tracked | medium_armor | 1700 | 15 | 55 / 13.5 |  | 380 | 1: 7.62mm DT, 76.2mm F-34 L/42; 2: 7.62mm DT |
| USSR | T-34 85 Model 1944 | tracked | medium_armor | 1700 | 15 | 55 / 12 |  | 648 | 1: 7.62mm DT, 85mm S-53 L/52; 2: 7.62mm DT |
| USSR | T-38 Model 1937 | tracked | light_armor | 1200 | 10 | 40 / 10 |  | 240 | 1: Coaxial 7.62mm DT |
| USSR | T-70 Model 1942 | tracked | light_armor | 1200 | 10 | 45 / 10 |  | 648 | 1: 45mm 20K L/46, 7.62mm DT |
| GE | Focke-Wulff FW-109 D-9 | aircraft | fighter_plane | 450 | 0.5 | n/a (flight model / static) |  | 300 | 1: 13mm MG 131, 20mm MG 151, SC500 500kg Bomb |
| GE | Henschel HS 126 B-1 | aircraft | recon_plane | 750 | 0.5 | n/a (flight model / static) |  | 240 | 1: 7.92mm MG 17, SC250 Bomb; 2: Mounted 7.92mm MG 15 |
| GE | Junkers Ju-87G-1 | aircraft | fighter_plane | 650 | 0.5 | n/a (flight model / static) |  | 0 | 1: 37mm BK 3.7; 2: Kübelwagen Typ82 - Mounted MG42 |
| GE | Messerschmitt Bf 109D-1 | aircraft | fighter_plane | 450 | 0.5 | n/a (flight model / static) |  | 260 | 1: Bf109D - MG 17, Bf109D - MG FF, SC250 250kg Bomb |
| GE | Messerschmitt Bf 109E | aircraft | fighter_plane | 450 | 0.5 | n/a (flight model / static) |  | 280 | 1: AN-M64A1, Bf109E - MG 17, Bf109E - MG FF |
| GE | Messerschmitt Bf 109E | aircraft | fighter_plane | 450 | 0.5 | n/a (flight model / static) |  | 0 |  |
| GE | Messerschmitt Me 410 B-2/U2 | aircraft | heavy_fighter_plane | 650 | 0.5 | n/a (flight model / static) |  | 350 | 1: 13mm MG 131, 20mm MG 151, SC250 Bomb; 2: 13mm MG 131 |
| US | B-17G Flying Fortress | aircraft | fighter_plane | 650 | 0.5 | n/a (flight model / static) | yes | 0 | 1: P-38 Lightning - MG 53-2 Browning; 2: M18 Hellcat - Mounted M2HB Browning; 3: M18 Hellcat - Mounted M2HB Browning; 4: M18 Hellcat - Mounted M2HB Browning; 5: P-38 Lightning - MG 53-2 Browning |
| US | Curtiss O-52 Owl | aircraft | recon_plane | 750 | 0.5 | n/a (flight model / static) |  | 240 | 1: AN-M57 250lbs, ANM2 .30; 2: Mounted ANM2 .30 |
| US | Curtiss P-40N Warhawk | aircraft | fighter_plane | 450 | 0.5 | n/a (flight model / static) |  | 348 | 1: 12.7mm M2, AN-M57 250lbs |
| US | Mustang P-51D | aircraft | fighter_plane | 450 | 0.5 | n/a (flight model / static) |  | 260 | 1: 12.7mm M2, AN-M64A1 500lb Bomb |
| US | P-38 Lightning | aircraft | heavy_fighter_plane | 650 | 0.5 | n/a (flight model / static) |  | 390 | 1: 20mm Hispano M1, AN-M64 Bomb, P-38 Lightning - MG 53-2 Browning |
| US | Seversky P-35A | aircraft | fighter_plane | 450 | 0.5 | n/a (flight model / static) |  | 260 | 1: 12.7mm M2, AN-M57A1 250lb Bomb, M1919 Browning |
| USSR | Lavochkin La-7 | aircraft | fighter_plane | 450 | 0.5 | n/a (flight model / static) |  | 300 | 1: 20mm B-20, FAB-100 100kg Bomb |
| USSR | Mikoyan-Gurevich MiG-3 | aircraft | fighter_plane | 450 | 0.5 | n/a (flight model / static) |  | 260 | 1: 12.7mm Berezin UB, 7.62 mm ShKAS, FAB-100 100kg Bomb |
| USSR | Petlyakov Pe-3bis | aircraft | heavy_fighter_plane | 650 | 0.5 | n/a (flight model / static) |  | 350 | 1: 12.7 mm UBK, 20mm ShVAK, FAB-250; 2: 7.62 mm ShKAS, Mounted 12.7 mm |
| USSR | Polikarpov R-Z | aircraft | recon_plane | 750 | 0.5 | n/a (flight model / static) |  | 240 | 1: FAB-100, PV-1; 2: Mounted 7.62mm DA |
| USSR | Yakovlev Yak-9D | aircraft | fighter_plane | 450 | 0.5 | n/a (flight model / static) |  | 280 | 1: 12.7mm UBS MG, 20mm ShVAK, FAB-100 |
| GE | Flakvierling 38 | AA emplacement | - | 500 | 1 | n/a (flight model / static) |  | 0 | 1: 20mm KwK30 |
| US | M55 Quad | AA emplacement | - | 500 | 1 | n/a (flight model / static) |  | 0 | 1: Mounted M2HB Browning |
| USSR | Maxim M4 Quad | AA emplacement | - | 500 | 1 | n/a (flight model / static) |  | 0 | 1: PM M1910 |
| GE | R75 Solo | motorcycle | motorcycle | 375 | 0.5 | 95 / 10 |  | 300 |  |
| US | 42WLA Solo | motorcycle | motorcycle | 375 | 0.5 | 95 / 10 |  | 300 |  |
| USSR | M72 Solo | motorcycle | motorcycle | 375 | 0.5 | 95 / 10 |  | 300 |  |
| GE | Sd.Kfz. 7/1 | half-track | terrain_vehicle | 750 | 1.5 | 50 / 15 |  | 700 | 2: 20mm KwK30 |
| GE | SdKfz 250-3 | half-track | armoured_car | 900 | 3 | 65 / 19 |  | 360 | 2: Kübelwagen Typ82 - Mounted MG42 |
| GE | SdKfz 251-D | half-track | armored_personnel_carrier | 900 | 1.5 | 55 / 19 | yes | 750 | 2: Kübelwagen Typ82 - Mounted MG42; 3: Kübelwagen Typ82 - Mounted MG42 |
| US | M16 Multiple Gun Motor Carriage | half-track | terrain_vehicle | 750 | 1.5 | 64 / 18 |  | 700 | 2: Mounted M2HB Browning |
| US | M3A1 | half-track | armored_personnel_carrier | 900 | 1.5 | 64 / 18 | yes | 750 | 2: M18 Hellcat - Mounted M2HB Browning |
| GE | Junkers Ju-52/3m | transport plane | transport_plane | 650 | 0.5 | n/a (flight model / static) |  | 0 |  |
| US | Douglas C-47A Skytrain | transport plane | transport_plane | 650 | 0.5 | n/a (flight model / static) |  | 0 |  |
| GE | R75 Sidecar | motorcycle+sidecar | motorcycle | 375 | 0.5 | 95 / 19 |  | 300 | 2: R75 - Mounted MG42 |
| US | 42WLA Sidecar | motorcycle+sidecar | motorcycle | 375 | 0.5 | 95 / 19 |  | 300 | 2: Motorcycle Mounted M1919 Browning |
| USSR | M72 Sidecar | motorcycle+sidecar | motorcycle | 375 | 0.5 | 95 / 19 |  | 300 | 2: Mounted DP |
| any | Pierre Bicycle | bicycle | - | 500 | 0.5 | 34 / 12 |  | 0 |  |

### T9. Tank / AT-gun ammunition, selected main guns (ammotemplate.json)

| gun | reload s | sight range (steps) | ammo | muzzle m/s | penetration mm (near) | armour damage | HE: penetration mm / armour dmg | blast dmg / radius |
|---|---|---|---|---|---|---|---|---|
| 122mm Gun D-25T | 6 | 0-4000 (41) | [122mm] 122mm BR-471 APHE (default) | 800 | 158-178 | 1955-2300 | - | 130 / 1 |
| 122mm Gun D-25T | 6 | 0-4000 (41) | [122mm] 122mm OF-471H High Explosive | 800 | - | 0-0 | 20-40 / 630-1050 | 210 / 12 |
| 122mm Gun D-25T | 6 | 0-4000 (41) | [122mm] 122mm BR-471B APCBCHE | 800 | 195-212 | 1837-2089 | - | 130 / 1 |
| 76.2mm F-34 L/42 | 3 | 0-4000 (41) | [76.2mm F-34 L/42.5] UOF-354 High Explosive | 680 | - | 0-0 | 8-25 / 525-840 | 200 / 10 |
| 76.2mm F-34 L/42 | 3 | 0-4000 (41) | [76.2mm F-34 L/42.5] UBR-354P HVAP | 950 | 124-132 | 1290-1575 | - | 100 / 1 |
| 76.2mm F-34 L/42 | 3 | 0-4000 (41) | [76.2mm F-34 L/42.5] UBR-354A Armor Piercing (default) | 792 | 80-92 | 1290-1575 | - | 100 / 1 |
| 76.2mm F-34 L/42 | 3 | 0-4000 (41) | [76.2mm F-34 L/42.5] USh-354 Shrapnel | 624 | - | 0-0 | 4-12 / 525-840 | 125 / 20 |
| 76.2mm F-34 L/42 | 3 | 0-4000 (41) | [76.2mm F-34 L/42.5] UBR-354A APCBCHE | 655 | 92-102 | 1350-1650 | - | 100 / 1 |
| 76.2mm F-34 L/42 | 3 | 0-4000 (41) | [76.2mm F-34 L/42.5] UD-354A Smoke | 624 | - | 0-0 | - | 50 / 12 |
| 85mm S-53 L/52 | 4 | 0-4000 (41) | [85x629mmR] UO-365K High Explosive | 793 | - | 0-0 | 10-30 / 525-840 | 165 / 9 |
| 85mm S-53 L/52 | 4 | 0-4000 (41) | [85x629mmR] UBR-365 Armor Piercing (default) | 800 | 109-129 | 1458-1597 | - | 100 / 1 |
| 85mm S-53 L/52 | 4 | 0-4000 (41) | [85x629mmR] BR-365P APCR | 1100 | 157-177 | 1424-1693 | - | 100 / 1 |
| 85mm S-53 L/52 | 4 | 0-4000 (41) | [85x629mmR] UBR-365K Armor Piercing High Explosive | 800 | 124-135 | 1538-1742 | - | 100 / 1 |
| 88mm KwK 36 L/56 | 4 | 0-4000 (41) | [88x571mm R] 88mm Panzergranate 39 (default) | 773 | 122-142 | 1422-1659 | - | 130 / 1 |
| 88mm KwK 36 L/56 | 4 | 0-4000 (41) | [88x571mm R] 88mm Sprenggranatpatrone | 600 | - | 0-0 | 20-40 / 630-1050 | 175 / 10 |
| 88mm KwK 36 L/56 | 4 | 0-4000 (41) | [88x571mm R] 88mm Panzergranate 40 | 930 | 161-181 | 1422-1659 | - | 130 / 1 |
| 88mm KwK 36 L/56 | 4 | 0-4000 (41) | [88x571mm R] 88mm Granate 39 HL | 600 | 100-120 | 1300-1508 | - | 175 / 9 |
| 75mm M3 | 3 | 0-2000 (41) | [75mm L/40] 75mm APCBC M61 | 619 | 92-112 | 1350-1500 | - | 100 / 1 |
| 75mm M3 | 3 | 0-2000 (41) | [75mm L/40] 75mm AP M72 Shot (default) | 619 | 81-101 | 1260-1425 | - | 100 / 1 |
| 75mm M3 | 3 | 0-2000 (41) | [75mm L/40] 75mm HE M48  | 463 | - | 0-0 | 8-25 / 525-840 | 200 / 12 |
| 75mm M3 | 3 | 0-2000 (41) | [75mm L/40] 75mm HVAP T45 | 869 | 117-137 | 1260-1425 | - | 100 / 1 |
| 75mm M3 | 3 | 0-2000 (41) | [75mm L/40] 75mm Shrapnel Mk I  | 463 | - | 0-0 | 4-12 / 525-840 | 125 / 20 |
| 75mm M3 | 3 | 0-2000 (41) | [75mm L/40] 75mm Smoke WP M64 | 550 | - | 0-0 | - | 50 / 12 |
| 76mm M1A2 L/55 | 4 | 0-4200 (43) | [76mm L/55] 76mm APCBC M62 | 790 | 125-138 | 1513-1700 | - | 100 / 1 |
| 76mm M1A2 L/55 | 4 | 0-4200 (43) | [76mm L/55] 76mm AP M79 Shot (default) | 790 | 109-129 | 1417-1559 | - | 100 / 1 |
| 76mm M1A2 L/55 | 4 | 0-4200 (43) | [76mm L/55] 76mm M26 HE/APC | 820 | - | 0-0 | 10-30 / 525-840 | 160 / 8 |
| 76mm M1A2 L/55 | 4 | 0-4200 (43) | [76mm L/55] 76mm HVAP T4 | 1000 | 167-197 | 1417-1559 | - | 100 / 1 |
| 37mm Stuart | 2.6 | 0-1200 (13) | [37mm L/53] 37mm APC M51B1 Shot | 870 | 60-68 | 920-1104 | - | 100 / 1 |
| 37mm Stuart | 2.6 | 0-1200 (13) | [37mm L/53] 37mm AP M74 Shot (default) | 870 | 50-58 | 834-994 | - | 100 / 1 |
| 37mm Stuart | 2.6 | 0-1200 (13) | [37mm L/53] 37mm HE M63 | 782 | - | 0-0 | 5-20 / 315-420 | 180 / 9 |
| 37mm Stuart | 2.6 | 0-1200 (13) | [37mm L/53] 37mm HE Mk II | 792 | 30-40 | 550-650 | 5-20 / 315-420 | 150 / 7 |
| 90mm M3 L/52 | 5 | 0-4000 (41) | [90x600mm R] 90mm APC-T M82 | 853 | 146-168 | 1850-1950 | - | 130 / 1 |
| 90mm M3 L/52 | 5 | 0-4000 (41) | [90x600mm R] 90mm AP T33 (default) | 823 | 119-139 | 1775-1900 | - | 130 / 1 |
| 90mm M3 L/52 | 5 | 0-4000 (41) | [90x600mm R] 90mm M71 HE | 823 | - | 0-0 | 20-40 / 630-1050 | 195 / 12 |
| 90mm M3 L/52 | 5 | 0-4000 (41) | [90x600mm R] 90mm HVAP T30E16 | 1018 | 221-241 | 1775-1900 | - | 130 / 1 |
| 37mm KwK 38 L/47.8 | 2.29 | 0-2000 (21) | [37.2x249mm] 37mm Panzergranate 40/37(T) | 1020 | 75-88 | 920-1150 | - | 100 / 1 |
| 37mm KwK 38 L/47.8 | 2.29 | 0-2000 (21) | [37.2x249mm] 37mm Panzergranate 37(T) (default) | 741 | 45-52 | 920-1150 | - | 100 / 1 |
| 37mm KwK 38 L/47.8 | 2.29 | 0-2000 (21) | [37.2x249mm] 37mm Sprenggranatpatrone 34(T) | 792 | - | 0-0 | 5-20 / 315-420 | 180 / 9 |
| 37mm KwK 38 L/47.8 | 2.29 | 0-2000 (21) | [37.2x249mm] 37mm Panzergranate Patrone 37(T) umg. | 750 | 55-65 | 1058-1197 | - | 100 / 1 |
| 75mm KwK 40 L/48 | 3 | 0-2000 (21) | [75x495mm R] Panzergranate 40 | 930 | 143-158 | 1325-1475 | - | 100 / 1 |
| 75mm KwK 40 L/48 | 3 | 0-2000 (21) | [75x495mm R] 75mm Panzergranate 39 (default) | 750 | 95-115 | 1325-1475 | - | 100 / 1 |
| 75mm KwK 40 L/48 | 3 | 0-2000 (21) | [75x495mm R] 75mm Sprenggranatpatrone 34 | 550 | - | 0-0 | 15-35 / 315-1050 | 200 / 10 |
| 75mm KwK 40 L/48 | 3 | 0-2000 (21) | [75x495mm R] 75mm Granate 38 HL/B | 450 | 85-105 | 1238-1350 | - | 150 / 8 |
| 75mm KwK 40 L/48 | 3 | 0-2000 (21) | [75x495mm R] 75mm Nebelgranat Patrone | 550 | - | 0-0 | - | 50 / 12 |
| 88mm KwK 43 L/71 | 5.5 | 0-4000 (41) | [88x822mm R] 88mm Panzergranate 40/43 | 1130 | 228-248 | 1500-1700 | - | 130 / 1 |
| 88mm KwK 43 L/71 | 5.5 | 0-4000 (41) | [88x822mm R] 88mm Granate 39 HL | 700 | 100-120 | 1400-1600 | - | 150 / 9 |
| 88mm KwK 43 L/71 | 5.5 | 0-4000 (41) | [88x822mm R] 88mm Panzergranate 39/43 (default) | 1000 | 142-162 | 1500-1700 | - | 130 / 1 |
| 88mm KwK 43 L/71 | 5.5 | 0-4000 (41) | [88x822mm R] 88mm Sprenggranatpatrone | 700 | - | 0-0 | 20-40 / 630-1050 | 195 / 12 |
| 50mm KwK 39 L/60 | 2.5 | 0-3000 (31) | [50x289mm R] 50mm Panzergranate (default) | 835 | 57-72 | 963-1090 | - | 100 / 1 |
| 50mm KwK 39 L/60 | 2.5 | 0-3000 (31) | [50x289mm R] 50mm Sprenggranatpatrone 38 (default) | 550 | - | 0-0 | 8-25 / 525-840 | 220 / 12 |
| 50mm KwK 39 L/60 | 2.5 | 0-3000 (31) | [50x289mm R] 50mm Panzergranate 40 | 1180 | 120-140 | 963-1090 | - | 100 / 1 |
| 45mm 20K L/46 | 2.6 | 0-1000 (11) | [45x310mmR] UBR-243 Armor Piercing (default) | 820 | 48-57 | 874-1126 | - | 100 / 1 |
| 45mm 20K L/46 | 2.6 | 0-1000 (11) | [45x310mmR] UO-243 High Explosive | 343 | - | 0-0 | 5-20 / 315-420 | 180 / 9 |
| 45mm 20K L/46 | 2.6 | 0-1000 (11) | [45x310mmR] UBR-243P HVAP | 1070 | 86-106 | 874-1126 | - | 100 / 1 |
| 45mm 20K L/46 | 2.6 | 0-1000 (11) | [45x310mmR] UB-243M Armor Piercing | 820 | 52-62 | 902-1178 | - | 100 / 1 |

### T10. Soldier classes (charactertemplate.json, SquadPlayerSlotTemplate.json)

| class | equipmentPoints | deployPoolCost | deployPoolOffClassCost | default squad slots |
|---|---|---|---|---|
| rifleman | 10 | 10 | 50 | 4 |
| fighterpilot | 6 | 100 | 300 | 2 |
| paratrooper | 8 | 28 | 200 | 4 |
| tankcrew | 6 | 100 | 300 | 3 |
| recon | 8 | 60 | 200 | 2 |
| general | 0 | 0 | 0 | - |
