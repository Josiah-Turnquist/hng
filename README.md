# HNG: a WWII combined-arms shooter in the browser

An unofficial fan recreation of **Heroes & Generals** (Reto-Moto, 2016 to 2023): infantry, jeeps and tanks fighting over a French village, with an emphasis on realism. Bullets, shells, guns, soldiers and vehicles are all simulated from real-world data, and every model, texture and sound is generated in code when the game loads. The one exception is the M1 Garand in your hands, a downloaded model (see Credits); the made-in-code one is a setting away.

## Play

You need [Node.js](https://nodejs.org/) 18 or newer.

```
npm install
npm start
```

Then open http://localhost:8000 in Chrome, Edge or Firefox. The menus follow the original game's main interface:

- **Heroes**: your soldiers. You start with an infantryman of each army and can recruit more of any army and class (infantry, recon, paratrooper, tank crew). The chosen soldier stands in 3D (drag to turn him); beside him, his loadout: primary weapon, sidearm and grenade (with their real data), the tank for a tank crewman, and his uniform. **Ready for battle** takes him into the battle shown above it.
- **Generals**: the battles to join, with the battlefield's map and the battle's settings: your side, the enemy army, soldiers per side and the battle clock.
- **Progression**: your player level, each soldier's rank (0 to 22, with the period ranks of his army and the original game's experience table) and record. A soldier earns experience in an Assault for taking part, for every enemy he puts down and every point he takes, and more for a win.
- At the top right: settings, full screen and about. Your soldiers are kept in this browser.

In battle, click the game to capture the mouse; **Esc** releases it and opens the menu. When you fall in an Assault, the deploy map shows your points and how long until you can deploy at each: click one (or use the lean keys) and **Deploy**.

To make a single HTML file you can open without a server: `npm run build` (writes `dist/hng.html`, plus `dist/hng-page.html`, the same game without the outer page tags, for sites that add their own, such as a claude.ai artifact). The downloaded Garand model is copied to `dist/assets/` beside them (also as base64 text, for hosts that will not serve `.glb` files); it loads only when the game is served from a web server (opened straight from the file, you keep the made-in-code Garand).

### Battlefields

- **Saint-Aubin-sur-Lenne (Assault).** A French village in a bend of the river Lenne, modeled on H&G's "Town" map: the police station (O1) and the church (O2), five attack lines (A to E) of four capture points each, three bridges (one blown), farms on every approach, and Normandy countryside of woods, orchards and bocage hedgerows. Bots fill both sides (24 a side by default, up to 32 on the Generals screen), with tanks and anti-tank soldiers.
- **Proving Ground.** A firing range with paper targets and steel plates from 25 to 800 m, a penetration lane (planks, brick, sandbags, concrete, steel), target tanks at 200, 300 and 500 m, and a motor pool with every vehicle. A range card shows where each shot landed, its flight time, speed and energy.

### Controls

These are the keys the game starts with. Every one can be changed in Settings > Controls > Keys (also in the Esc menu during a battle), where each action can have two keys or mouse buttons. Esc opens the menu, steps back through its pages and closes it again.

| Action | Keys |
|---|---|
| Move, sprint (hold breath while aiming) | W A S D, Shift |
| Crouch, prone, jump or stand up | C, Z, Space |
| Lean | Q / E |
| Aim through the sights (hold, or press once in Settings > Controls), fire | Right mouse or `, left mouse |
| Sight range up / down | Mouse wheel while aiming, or Page Up / Page Down |
| Reload or work the bolt, fire mode | R, B (or middle mouse) |
| Weapons, grenade, bandage | 1 2 3, G, X |
| Get in or out of a vehicle (walk up to it; a prompt shows when you can) | F |
| Drive | W / S (S brakes, then reverses), A / D, Space handbrake (jeeps). The camera turns with a jeep or bike and swings in behind it when you leave the mouse alone; in a tank it stays where you aim the gun |
| Ride a bicycle or motorcycle | W / S, A / D (you lean into the turn), Space rear brake, Shift pedal hard (bicycle); in the sidecar the mouse lays the machine gun |
| Tank gunner's sight, shell type, coaxial MG | Hold right mouse (or `) or V, 1 / 2, Space |
| Change seat, camera | F1 to F4, V |
| Scoreboard | Tab |

Red marks round the middle of the screen point to where a shot that hit you came from, pale ones to bullets that only just missed. Projectiles look like what they are: tracer rounds are glowing slugs with a white-hot head and a short fading tail, tank shells fly with their tracer burning in the base, bazooka and Panzerschreck rockets (and the Panzerfaust's warhead) are their real models, the rockets trailing smoke, and ordinary bullets flying near you show as small blurred bullets (Settings > Screen > Bullets in flight). A fired launcher's tube is empty until you reload.

Where to go: a marker floats over each point your side should take or hold next, with its name, distance and capture progress; the nearest says ATTACK or DEFEND and stays at the edge of the screen when you look away. Marks above the compass show which way the points lie, a line under the points bar says how it's going on the point you stand on ("Taking A2: 35%"), and when you respawn a hint names the point to make for (Settings > Screen > Objective markers).

Who not to shoot: a green dot floats over the head of everyone on your side, through walls and smoke too, smaller and fainter with distance (Settings > Screen > Teammate markers).

Grenades: hold the fire button to pull the pin and draw back (holding it longer cooks the grenade, its fuse burning), let go to throw. The grenade flies, bounces and rolls (further on stone than on soft ground) and goes off when its fuse runs out. A live grenade that lands within 12 m of you gets a mark on screen, red when it is close enough to hurt you (Settings > Screen > Grenade warning). A bandage is used up only once you have finished putting it on: move and you stop, but keep it.

Fallen soldiers drop their main weapon, with whatever ammunition they had left; walk up to one and press the use key (F) to pick it up, leaving the gun you had in that slot in its place. Weapons on the ground stay for two minutes. Taking a hit flashes the edges of the screen red, jolts your view, and you hear it; bleeding hard blurs the edges of your view until you bandage.

## What is simulated

**Ballistics.** Every bullet and shell is flown in small time steps with gravity, air drag from its real ballistic coefficient (G1, G2 or G7 drag tables), air density from altitude and temperature, and wind. A Kar 98k's 7.92 mm s.S. bullet leaves at 760 m/s and arrives at 100 m at 709 m/s after 0.14 s, as the real round does. Bullets slow down through what they hit using a two-term penetration law calibrated to field-fortification data (a .30-06 ball round gets through about 60 cm of pine, 15 cm of brick or 9 mm of mild steel), glance off at shallow angles, tumble after passing through, and crack overhead when they miss you.

**Guns.** 41 small arms of the three armies: rifles, carbines, submachine guns, machine guns, pistols, anti-tank rifles, bazookas and Panzerfausts, each with its real muzzle velocity, rate of fire, magazine, mass and sights. Each works like the original: stripper-clip and single-round loading for bolt actions, the Garand's en-bloc clip and ping, open-bolt submachine guns, belt-fed machine guns, revolvers loaded round by round. You aim through the real iron sights or scope (from the hip, a small crosshair shows where the gun points, its gap as wide as the shots spread); the rear sight is graduated in the original's units (yards or meters) and raising it really elevates the bore. Recoil comes from the momentum of the bullet and powder gas; sway from breathing, heartbeat, fatigue and wounds.

**Soldiers.** Walking, jogging and sprinting speeds of real infantry, stamina and breathing, stances, leaning, climbing steps, falling damage. Wounds depend on where a bullet hits and how much energy it still carries (head 4x, legs 0.8x, arms 0.5x, as in H&G); big wounds bleed until bandaged; health recovers to the top of its third like the original.

**Vehicles.** Willys MB, Kübelwagen, GAZ-67, Opel Blitz, M5A1 Stuart, M4A1 Sherman, Panzer IV Ausf. H, Tiger I, T-34/76 and T-34-85. Each has its real mass, engine torque curve, gearbox and final drive, so top speeds come out right (Sherman 39 km/h, Panzer IV 41, T-34 54, jeep 104). Suspensions settle at the real ride height. Tires grip according to the ground (road, grass, mud, sand). Tracks are belts that grip and slip; turning drags them sideways, which is why tanks need so much power to turn. Each tank steers like the real one: the Sherman's controlled differential cannot turn on the spot (31 ft circle), the T-34 and Panzer IV pivot on a braked track, and the Tiger's regenerative steering turns it in place. Bumping a wall or a tree, or landing off a bank, does no harm below about 30 km/h; harder knocks damage the vehicle and hurt whoever rides in the open (into a wall at 60 km/h, half their health; at 80 km/h it kills). The crew of a vehicle wrecked in a crash climb out of it. A tank's own shells never hurt it at the muzzle, even bursting on a wall just in front.

**Bicycles and motorcycles.** The way most soldiers get about: a 1930s French roadster bicycle, the Harley-Davidson WLA, BMW R 75 and M-72, solo and with a sidecar (the sidecar gunner works an M1919, MG 34 or DP), parked at every spawn point and by doors around the village. A two-wheeler balances by steering: it leans into a turn as far as the speed and the radius need (the rider rolls it in the way you press at once, and up again when you let go), wobbles at a walk until a foot goes down, can't turn sharply at speed, and goes down if you ask the ground for more grip than it has at speed (grass, mud and forest floor catch riders out). Brakes load the front wheel; a locked wheel slides. The bicycle is pedaled with a rider's real power (about 160 W to cruise at 18 km/h on a road, a 600 W sprint that drains your stamina, hills that slow you to a crawl); on soft ground he works harder to keep his pace, and for gameplay soft ground holds a bicycle back less than it really would, so it cruises at 15 to 18 km/h over grass, leaf litter and crops (slower on ploughed fields, mud and sand). Sidecar outfits steer like a car: the chair goes light in hard turns toward it (the rider brings it down if it lifts), and the outfit pulls to one side under power and braking. Riders are out in the open; tires, tanks and engines can be shot. Bots take a bike for long trips, keep to the roads, and get off short of the fight.

**Tank guns and armor.** Turrets traverse at their real speed (6 deg/s for the Tiger, 24 for the Sherman); only the Sherman and Stuart guns are stabilized. Gunner's sights show the real magnification and reticle (German triangles, US mil lines, Soviet chevrons) with a range drum. Armor plates have their real thickness and slope; a shell penetrates when its de Marre penetration at the impact speed beats the plate's line-of-sight thickness, may glance off steep plates, and if it gets in it damages the engine, transmission, fuel, ammunition and crew. A PzGr 39 from the Panzer IV's long 75 goes through the Sherman's sloped glacis at 300 m; the T-34/76's shell bounces off the Panzer IV's 80 mm front at 500 m.

**Battles.** Assault with the original rules: capture points must be taken in order along a line; 30 + 30 s to neutralize and take a point, 45 + 45 s for objectives, 90 s for access points, faster with more men; 30 minutes on the clock plus 2 minutes per capture; sudden death; spawn delays of 10 s plus 0.5 s per link; spawns locked when enemies are close. Bots see you with a delay that depends on distance, your stance and movement, and gunfire; aim with a human error that settles as they track; lead and hold over at range; step aside from vehicles; and come at you in tanks. They fight like infantry: they make for cover when a fight starts and shoot from it, popping up or leaning out round a corner and ducking back (lower and longer under heavy fire); reload and bandage behind it; lob grenades at enemies who have gone to ground close by; watch where an enemy disappeared and, attacking, go and look for him; and call out what they see to comrades nearby. Attacking, fireteams of three come at a point from different sides and move up by turns from cover to cover; holding a point, a bot takes a post facing the enemy.

## Project layout

```
index.html            page shell
src/main.js           entry point
src/core/             math, input, fixed-step loop, settings
src/render/           render pipeline, sky, shadows, procedural textures, effects, spent cases
src/world/            terrain, maps, roads and river, village, vegetation
src/physics/          collision world (boxes + heightfield), rigid bodies
src/ballistics/       drag tables, atmosphere, materials and penetration, projectiles, solver
src/weapons/          weapon data, ammunition, mechanisms, sights, first-person view, gun models
src/actors/           soldier movement, soldier models and animation, hit zones
src/vehicles/         vehicle data, wheeled and tracked physics, damage, tracks, models
src/ai/               navigation grid and path finding, infantry bots, tank crews
src/audio/            sound synthesis and the Web Audio system
src/game/             game loop, world, player, vehicle controls, game modes
src/ui/               app, front end (Heroes, Generals, Progression), battle map, settings pages, pause menu, HUD
debug/                viewers for guns, vehicles, soldiers, the village and sounds
tests/                node:test suites (npm test)
tools/                dev server, build, screenshot tools
docs/                 design notes and research
```

## Tests

`npm test` runs the test suites in Node: ballistics against published figures, every weapon's mechanism and sights, vehicle speeds, steering, slopes, turret traverse and armor match-ups, soldier hit zones, and the sound system. A headless battle harness (`tests/helpers/battle.js`) runs the real town with bots and no graphics, which is handy for tuning the AI.

## Notes and limits

- Single player against bots for now; [docs/MULTIPLAYER.md](docs/MULTIPLAYER.md) is the plan for online play (Railway and Neon), with bots filling the empty places.
- The browser needs WebGL 2. The graphics quality is picked for your computer the first time the game starts; Settings (also in the Esc menu during a battle) has the Low, Medium, High and Ultra presets and every option on its own (render resolution, edge smoothing, shadows, contact shadows, glow, sun rays, view distance, trees, grass, textures, effects, focus when aiming and motion blur, both off unless you turn them on), can show the frame rate, turns the hip-fire crosshair on or off, and picks which M1 Garand model you hold (the downloaded one, or the one made in code). On a slow computer try Low, or lower the render resolution and shadows first.
- Some values are estimates where no published figure was found; they are marked "est." in the data files. See `docs/RESEARCH.md` for sources.

## Credits

- **"Realistic M1 Garand"** by Raymond ([rookieray](https://sketchfab.com/rookieray)), from [Sketchfab](https://sketchfab.com/3d-models/realistic-m1-garand-8d639aed01a94c8bb6e8cb58070a71f3), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). It is the M1 Garand in your hands (Settings, Screen: "M1 Garand model" switches to the made-in-code one). The file in `assets/models/` is as downloaded; as it loads, `src/weapons/models/downloaded.js` resizes it to a real Garand's sight spacing, draws its butt out to a real Garand's length from the trigger, leaves out the loose rounds, cases and spent clip shown round it, seats its clip, makes its rear sight a separate sliding part with a wider peep hole, and puts its textures on directly.

Heroes & Generals was made by Reto-Moto. This project is an unofficial tribute and uses none of its assets.
