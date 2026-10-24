# How the game is built

Plain ES modules and three.js, no build step during development (`npm start` serves the files). Everything runs in one browser page; the only worker is the sound generator.

## Conventions

- Units: meters, kilograms, seconds, newtons, m/s. Angles in radians in code (degrees only in data files where noted).
- Axes: +X east (right), +Y up, -Z north (forward). A yaw of 0 faces -Z; positive yaw turns left (three.js convention).
- Models (guns, vehicles, soldiers) are built at real scale facing -Z, with named parts and "anchors" (muzzle, eyes, seats, ejection port...).
- The simulation runs at a fixed 120 steps per second (`src/core/loop.js`); rendering interpolates and runs as fast as the screen allows.

## Main systems

| System | Where | What it does |
|---|---|---|
| Terrain | `src/world/terrainGen.js`, `heightfield.js`, `terrainMesh.js` | 2 km heightfield at 2 m (town) with surfaces per cell (grass, dirt road, mud, fields...), river, roads, craters; GPU-textured mesh with distance detail. |
| Village | `src/world/village/` | Plans the town (buildings, walls, square, bridges, farms) and builds merged meshes plus thousands of collision boxes, door positions, cover points and spawn spots. |
| Countryside | `src/world/vegetation.js`, `src/world/vegetation/` | Woods, copses, bocage hedgerows on earth banks (with field gates), poplars along the roads, orchards by the farms, bushes, and grass, wheat, bracken and flowers that move in the wind. Near plants are instanced 3D models; far ones are impostors (crossed cards baked from the real models). Trunks and hedge banks are solid and stop bullets and sight. Leaves, bushes and hedges are partial cover: they have gaps you can see through, bots take longer to spot someone behind them the more foliage is in the way (`CollisionWorld.foliageAlong`), and bullets lose only a little speed going through. |
| Collision | `src/physics/collision.js` | Oriented boxes in a 2D grid plus the heightfield. Ray casts for bullets and sight, sphere pushes for bodies and vehicles. Box flags say what a box stops (movement, bullets, sight) and its material. |
| Ballistics | `src/ballistics/` | Drag tables (G1, G2, G7), atmosphere, projectile flight with Heun integration in steps of at most 1/400 s, material penetration and ricochet, armor penetration, and a zeroing solver used for sights. |
| Weapons | `src/weapons/` | Weapon data (`defs.js`), ammunition (`ammo.js`), the mechanism state machine (`weapon.js`: loading, cycling, fire modes, heat), sight alignment (`sighting.js`), the first-person gun (`viewmodel.js`) and procedural gun models (`models/`). |
| Soldiers | `src/actors/body.js`, `src/game/soldier.js` | Body movement (speeds, stances, stamina, steps, falls) and the soldier's health, wounds and weapons. `src/actors/soldierModel.js` is the skinned, procedurally animated model, which also supplies the hit zones. Uniforms and kit are built at real size per army and class (`soldierKit*.js`; garments in `soldierBody.js`, heads and hands in `soldierHead.js`, equipment in `soldierGear.js`) and textured from one atlas of fabrics, leather, steel and skin (`soldierMaterials.js`), in three levels of detail. `soldierFP.js` gives the player's first-person view his own sleeves and hands; `src/game/soldierView.js` drives the model from the game, including the riding pose bikes report through `riderPose`. |
| Vehicles | `src/vehicles/` | `vehicle.js` (rigid hull on raycast suspension, hull contacts, seats, armor plates and damage), `wheeled.js` (engine, gearbox, tires), `tracked.js` (tracks as gripping belts, steering systems, turret and gun), `trackMesh.js` (animated links), `models/` (procedural vehicle models). |
| AI | `src/ai/` | `navgrid.js` (walkability grid, its connected areas, and A*; one grid for soldiers and a wider-clearance one for vehicles), `bot.js` (infantry), `tankBot.js` (tank crews). |
| Game | `src/game/` | `game.js` (the match: update order, hits, explosions, vehicles, bots), `player.js` and `vehicleControl.js` (the player), `modes/` (Assault, firing range). |
| Rendering | `src/render/` | HDR pipeline (`pipeline.js`, shaders in `postfx.glsl.js`): contact shadows (SSAO), atmosphere and height fog from depth, edge smoothing (FXAA, 4x MSAA with alpha to coverage, or TAA), camera motion blur, focus blur when aiming, sun rays, bloom, eye adaptation (and an exposure that follows the daylight, so a low sun reads as warm rather than dim), ACES tone mapping and a film grade; cascaded shadow maps; sky with clouds and a late-afternoon sun (each map sets its sun in `maps.js`; the light's color and strength follow from how much air it crosses, `sky.js`); GPU-baked procedural textures; lit soft particles and decals; spent cases. |
| Sound | `src/audio/` | Every sound is synthesized at load (`synth.js` and `recipes/`); `audio.js` plays them with distance, air absorption, the speed of sound and reverb. |
| UI | `src/ui/` | The front end (`frontend.js`: the Heroes, Generals and Progression tabs of the original game; `roster.js`: the player's soldiers, ranks and experience, kept in localStorage; `soldierPreview.js`: the chosen soldier in 3D and the weapon pictures, drawn with the game's renderer; `icons.js`: emblems, class and rank badges), the battle map (`battleMap.js`: the battlefield seen from above, for the Generals tab, the loading screen and the deploy map), the pause menu (`menu.js`), the settings pages (`settingsView.js`: Graphics, Controls with the key list, Sound, Screen, each with pages below; Esc and Back go up a level), HUD, sights, scoreboard. |

## One simulation step

`Game.update(dt)`:

1. The player's controls (on foot or in a vehicle) set intents and triggers.
2. Vehicles step (4 sub-steps each for the stiff springs): suspension rays, gravity, drive train, hull contacts, air and water drag.
3. Bots think (every 0.2-0.5 s) and act; every soldier's body moves.
4. Footsteps, vehicles hitting people.
5. Projectiles fly; each hit goes through `Game._onImpact` (soldier wounds, vehicle armor, effects, sound).
6. The game mode updates (captures, timer, spawns).

## How a bullet hits a soldier

The projectile system asks `Game._raycastDynamic` for anything between two positions. Soldiers are tested with a bounding sphere, then the capsules of their posed model (17 body parts). The hit records the part, and the energy the bullet still had. `bulletDamage(energy, diameter)` times the part's multiplier gives the damage; bleeding depends on the wound. If the bullet goes through, it carries on with what speed it has left.

## How a shell hits a tank

Vehicles answer the same ray query with their armor plates (oriented boxes from the model data with real thickness in mm). `ProjectileSystem._hitArmor` compares the shell's penetration at its current speed with the plate's line-of-sight thickness (minus normalization for capped shells) and may decide on a ricochet. A penetration traces the shell on into the hull: modules on its path (engine, transmission, fuel, ammunition, gun, turret ring) are damaged and crew near the path are hurt, more with explosive filler. Tracks are separate plates that break.

## Adding things

- **A weapon:** add its data to `src/weapons/defs.js` (and its cartridge to `ammo.js` if new), a model builder in `src/weapons/models/` with the standard anchors (`muzzle`, `rearSight`, `frontSight`, grips, ejection port), then run `npm test`: the sighting test checks that its sights hit at the zero range.
- **A vehicle:** add its data to `src/vehicles/defs.js` (mass, engine curve, gears, suspension, armor comes from the model) and a builder in `src/vehicles/models/` following the conventions in `vkit.js`. Add its expected top speed to `tests/vehicles.test.js`.
- **A map:** add a definition to `src/world/maps.js` (terrain shape, river, roads, forests, objectives and lines for Assault).

## Controls

`src/core/input.js` names every action (`DEFAULT_BINDINGS`: up to two keys or mouse buttons each, by position on the keyboard, mouse buttons as `Mouse0` to `Mouse4`) and lists them for the controls menu (`ACTIONS`, with where each is used: on foot, in a vehicle or both). The game asks for actions (`input.is('aim')`, `hit`, `up`), never for raw keys, so a player's changes (saved as the differences from the defaults in `settings.bindings`) apply everywhere. Two actions may share a key only if they are never used in the same place; `tests/controls.test.js` checks the defaults, and the keys page moves a key off any action it would clash with.

## Graphics settings

`src/core/settings.js` lists every graphics option (`GRAPHICS_OPTIONS`: label, plain-English note, choices or range, and whether it applies at once) and the four presets (`GRAPHICS_PRESETS`). `settings.quality` resolves the options into the numbers the renderer reads (shadow maps and their size, edge smoothing mode, texture size...). Changing a setting in the menus calls `App.applyGraphics()`, which passes the new quality to the pipeline (`apply`), the world (`applyQuality`: shadows, terrain, vegetation distances and grass, sky) and the effects; only texture detail waits for the next battle. On the first start the preset is picked from the graphics card the browser reports (`detectQuality`).

Rough cost of each feature at 1920 x 1080 on a mid-range card: shadows are the biggest (each shadow map redraws the scene from the sun; the far maps are redrawn every other frame), then 4x MSAA (memory and bandwidth), contact shadows (two half-resolution passes), TAA (one full pass and a copy), focus when aiming (one pass, only while aiming), motion blur (one pass), sun rays (two quarter-resolution passes), bloom (ten small passes), eye adaptation (two tiny passes). Each flash light (Effects: Medium 2, High 4) adds a little to every lit pixel. Knee-high meadow grass is many layers of see-through cards, and the nearest 7,000 clumps are also drawn into the sharpest shadow map: on a slower card, Grass density and Grass distance are the next settings to lower after shadows.

## Debug pages

Open these through the dev server:

- `debug/guns.html?gun=kar98k` (or `gun=all`; `sight=1&range=300` shows the sight picture)
- `debug/vehicles.html?id=tiger1&armor=1`
- `debug/soldiers.html?pose=walk&cls=all` (`close=face|hands|kit|back|feet` for close-ups, `pose=bicycle` for a rider, `fp=kar98k` for the first-person arms)
- `debug/village.html?view=aerial`
- `debug/vegetation.html?view=lane` (or `aerial`, `forest`, `hedge`, `wheat`, `orchard`; `cam=x,y,z,yaw,pitch` for any view)
- `debug/audio.html`
- `debug/textures.html`
- `debug/battlemap.html?map=town&world=1&live=1` (the battle map as the deploy screen shows it; without `world=1` as the menus show it before the terrain exists)
- `debug/graphics.html?view=river&quality=high&aa=taa` (the world through the real pipeline with any graphics option; `fx=explosion|smoke|muzzle|impacts` for effects, `dof=1` for focus when aiming)

`node tools/shot.mjs "map=town&quality=low" out.png` takes a screenshot of the game in a headless browser.
