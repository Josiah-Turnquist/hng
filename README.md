# HNG: a WWII combined-arms shooter in the browser

A fan recreation of **Heroes & Generals** (Reto-Moto, 2016-2023): infantry, jeeps and tanks fighting over a French village, with an emphasis on realism. Bullets, shells, guns, soldiers and vehicles are all simulated from real-world data, and every model, texture and sound is generated in code when the game loads. Nothing is downloaded.

## Play

You need [Node.js](https://nodejs.org/) 18 or newer.

```
npm install
npm start
```

Then open http://localhost:8000 in Chrome, Edge or Firefox. Pick a battlefield, army, side, class and weapon in the menu and press **Deploy**. Click the game to capture the mouse; **Esc** releases it and pauses.

To make a single HTML file you can open without a server: `npm run build` (writes `dist/hng.html`).

### Battlefields

- **Saint-Aubin-sur-Lenne (Assault).** A French village in a bend of the river Lenne, modeled on H&G's "Town" map: the police station (O1) and the church (O2), five attack lines (A to E) of four capture points each, three bridges (one blown), farms on every approach. Bots fill both sides, with tanks and anti-tank soldiers.
- **Proving Ground.** A firing range with paper targets and steel plates from 25 to 800 m, a penetration lane (planks, brick, sandbags, concrete, steel), target tanks at 200, 300 and 500 m, and a motor pool with every vehicle. A range card shows where each shot landed, its flight time, speed and energy.

### Controls

| Action | Keys |
|---|---|
| Move, sprint (hold breath while aiming) | W A S D, Shift |
| Crouch, prone, jump or stand up | C, Z, Space |
| Lean | Q / E |
| Aim through the sights, fire | Right mouse, left mouse |
| Sight range up / down | Mouse wheel while aiming, or Page Up / Page Down |
| Reload or work the bolt, fire mode | R, B (or middle mouse) |
| Weapons, grenade, bandage | 1 2 3, G, X |
| Get in or out of a vehicle | F |
| Drive | W / S (S brakes, then reverses), A / D, Space handbrake (jeeps) |
| Tank gunner's sight, shell type, coaxial MG | Hold right mouse or V, 1 / 2, Space |
| Change seat, camera | F1 to F4, V |
| Scoreboard | Tab |

## What is simulated

**Ballistics.** Every bullet and shell is flown in small time steps with gravity, air drag from its real ballistic coefficient (G1, G2 or G7 drag tables), air density from altitude and temperature, and wind. A Kar 98k's 7.92 mm s.S. bullet leaves at 760 m/s and arrives at 100 m at 709 m/s after 0.14 s, as the real round does. Bullets slow down through what they hit using a two-term penetration law calibrated to field-fortification data (a .30-06 ball round gets through about 60 cm of pine, 15 cm of brick or 9 mm of mild steel), glance off at shallow angles, tumble after passing through, and crack overhead when they miss you.

**Guns.** 41 small arms of the three armies: rifles, carbines, submachine guns, machine guns, pistols, anti-tank rifles, bazookas and Panzerfausts, each with its real muzzle velocity, rate of fire, magazine, mass and sights. Each works like the original: stripper-clip and single-round loading for bolt actions, the Garand's en-bloc clip and ping, open-bolt submachine guns, belt-fed machine guns, revolvers loaded round by round. You aim through the real iron sights or scope; the rear sight is graduated in the original's units (yards or meters) and raising it really elevates the bore. Recoil comes from the momentum of the bullet and powder gas; sway from breathing, heartbeat, fatigue and wounds.

**Soldiers.** Walking, jogging and sprinting speeds of real infantry, stamina and breathing, stances, leaning, climbing steps, falling damage. Wounds depend on where a bullet hits and how much energy it still carries (head 4x, legs 0.8x, arms 0.5x, as in H&G); big wounds bleed until bandaged; health recovers to the top of its third like the original.

**Vehicles.** Willys MB, Kübelwagen, GAZ-67, Opel Blitz, M5A1 Stuart, M4A1 Sherman, Panzer IV Ausf. H, Tiger I, T-34/76 and T-34-85. Each has its real mass, engine torque curve, gearbox and final drive, so top speeds come out right (Sherman 39 km/h, Panzer IV 41, T-34 54, jeep 104). Suspensions settle at the real ride height. Tires grip according to the ground (road, grass, mud, sand). Tracks are belts that grip and slip; turning drags them sideways, which is why tanks need so much power to turn. Each tank steers like the real one: the Sherman's controlled differential cannot turn on the spot (31 ft circle), the T-34 and Panzer IV pivot on a braked track, and the Tiger's regenerative steering turns it in place.

**Tank guns and armor.** Turrets traverse at their real speed (6 deg/s for the Tiger, 24 for the Sherman); only the Sherman and Stuart guns are stabilized. Gunner's sights show the real magnification and reticle (German triangles, US mil lines, Soviet chevrons) with a range drum. Armor plates have their real thickness and slope; a shell penetrates when its de Marre penetration at the impact speed beats the plate's line-of-sight thickness, may glance off steep plates, and if it gets in it damages the engine, transmission, fuel, ammunition and crew. A PzGr 39 from the Panzer IV's long 75 goes through the Sherman's sloped glacis at 300 m; the T-34/76's shell bounces off the Panzer IV's 80 mm front at 500 m.

**Battles.** Assault with the original rules: capture points must be taken in order along a line; 30 + 30 s to neutralize and take a point, 45 + 45 s for objectives, 90 s for access points, faster with more men; 30 minutes on the clock plus 2 minutes per capture; sudden death; spawn delays of 10 s plus 0.5 s per link; spawns locked when enemies are close. Bots see you with a delay that depends on distance, your stance and movement, and gunfire; aim with a human error that settles as they track; lead and hold over at range; crouch or go prone to fight; step aside from vehicles; and come at you in tanks.

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
src/ui/               app, menus, HUD
debug/                viewers for guns, vehicles, soldiers, the village and sounds
tests/                node:test suites (npm test)
tools/                dev server, build, screenshot tools
docs/                 design notes and research
```

## Tests

`npm test` runs the test suites in Node: ballistics against published figures, every weapon's mechanism and sights, vehicle speeds, steering, slopes, turret traverse and armor match-ups, soldier hit zones, and the sound system. A headless battle harness (`tests/helpers/battle.js`) runs the real town with bots and no graphics, which is handy for tuning the AI.

## Notes and limits

- Single player against bots; there is no network play.
- The browser needs WebGL 2. On slower computers choose Low or Medium quality in Settings.
- Some values are estimates where no published figure was found; they are marked "est." in the data files. See `docs/RESEARCH.md` for sources.

Heroes & Generals was made by Reto-Moto. This project is an unofficial tribute and uses none of its assets.
