# Research notes

This game recreates **Heroes & Generals** (Reto-Moto, open beta 2013, full release 23 September 2016, servers closed 25 May 2023) with the realism turned up. This page summarizes what was found and how it was used. The full notes, with every source, are in [`docs/research/`](research/):

- [heroes-and-generals.md](research/heroes-and-generals.md): the game's history, factions, classes, progression and content lists.
- [battles-maps-and-rules.md](research/battles-maps-and-rules.md): game modes, the Assault rules, spawning, the maps (including "Town"), damage and health.
- [weapons.md](research/weapons.md) and [vehicles.md](research/vehicles.md): technical data for the WWII weapons and vehicles.
- [data-tables.md](research/data-tables.md): tables extracted from the game's own server data.

## Sources and how reliable they are

- **The game's own data.** A fan project ([raouldeheer/Heroes-and-Generals-community-project](https://github.com/raouldeheer/Heroes-and-Generals-community-project)) published JSON dumps of the live server tables, last updated early 2023: weapons, ammunition, vehicles, maps and capture-point coordinates, mission presets. These are first-hand, though some fields are cryptic.
- **The community wikis** (heroesandgenerals.fandom.com and heroes-generals.fandom.com) for rules and map descriptions.
- **Military manuals and references** for the real equipment: US FM 23-5 and TM 9-series manuals, German s.S. ammunition data, Soviet tables, and standard references for vehicles.
- Web pages could only be read through search summaries during the research (direct page fetches failed), so some figures rest on a single summary. Where a value is an estimate it is marked "est." in the data files (`src/weapons/defs.js`, `src/weapons/ammo.js`, `src/vehicles/defs.js`).

## What was taken from Heroes & Generals

- **Three armies** (US, Germany, Soviet Union) and the classes infantry, recon, paratrooper and tank crew.
- **Assault rules:** capture points in sequence along lines A to E to the objectives; 30 + 30 s for a normal point, 45 + 45 s for an objective, 90 s for an access point; more soldiers capture faster (each extra man adds half as much as the one before); defenders have 30 minutes and each capture gives the attackers 2 more; attackers must hold every objective; defenders also win by taking every access point; sudden death when time runs out with the objectives split.
- **Spawning:** 10 s plus 0.5 s per link back to your base; points with enemies close by can't be spawned at; tanks come in only at access points and objectives.
- **The Town map:** a medium French village; O1 the police station and O2 the church about 170 m apart; lines A and B lead to the church, C, D and E to the police station; water surrounds the center on every approach except line A; four capture points per line.
- **Wounds:** damage multipliers by body part (head x4, body x1, legs x0.8, arms x0.5) and health that regenerates to the top of its third.
- **Scoring:** +5 per kill, -10 per team kill, -1 per suicide, shared credit for captures.
- **Battle size:** 18 against 18 in the original; adjustable here.

## Where this goes beyond the original

H&G used simplified ballistics and hit points. Here everything is simulated from physical data:

- **External ballistics** with G1, G2 and G7 drag tables, ballistic coefficients, air density from altitude and temperature, and wind. Checked against published data: the 7.92 mm s.S. bullet from a Kar 98k reaches 100 m in 0.14 s at 709 m/s.
- **Penetration of materials** with a two-term (Poncelet-type) law, calibrated so a .30-06 ball round goes through about 60 cm of pine, 15 cm of brick, 10 cm of concrete, 35 cm of sand, 45 cm of earth or 9 mm of mild steel, in line with field-fortification guidance.
- **Armor** by the de Marre relation (penetration grows with impact speed to the power 1.43) against line-of-sight thickness, with normalization for capped shells and ricochet at steep angles. Checks: PzGr 39 from the 7.5 cm KwK 40 defeats the Sherman's 51 mm glacis at 300 m; the T-34/76's BR-350A fails against the Panzer IV H's 80 mm front at 500 m; the Sherman's M61 gets through it at 300 m but not at 1000 m.
- **Weapon mechanisms** as built: stripper clips, en-bloc clips, open and closed bolts, belts, pans, drums, revolver gates and moon clips; real rates of fire, magazine sizes, masses and sight graduations.
- **Vehicle drivetrains** from real engine curves, gear ratios and final drives; each tank's own steering system.

## The data in the game

The tables below are generated from the game's data files.

### Small arms

| Weapon | Army | Type | Cartridge | Muzzle velocity | Rate of fire | Feed | Loaded mass | Sights |
|---|---|---|---|---|---|---|---|---|
| M1 Garand | US | semi | .30-06 Ball M2 | 853 m/s | semi-auto | 8 (enbloc) | 4.31 kg | 100-1200 yd |
| M1 Carbine | US | carbine | .30 Carbine Ball M1 | 607 m/s | semi-auto | 15 (box) | 2.36 kg | 150-300 yd |
| M1A1 Carbine | US | carbine | .30 Carbine Ball M1 | 607 m/s | semi-auto | 15 (box) | 2.53 kg | 150-300 yd |
| M2 Carbine | US | assault | .30 Carbine Ball M1 | 607 m/s | 750 rpm | 30 (box) | 2.60 kg | 100-300 yd |
| M1903 Springfield | US | rifle | .30-06 Ball M2 | 853 m/s | bolt action | 5 (stripper) | 3.94 kg | 100-2700 yd |
| M1903A4 (scoped) | US | sniper | .30-06 Ball M2 | 853 m/s | bolt action | 5 (stripper) | 4.20 kg | 2.5x scope |
| Thompson M1A1 | US | smg | .45 Ball M1911 | 285 m/s | 700 rpm | 30 (box) | 4.74 kg | fixed, 100 yd |
| M3 "Grease Gun" | US | smg | .45 Ball M1911 | 274 m/s | 450 rpm | 30 (box) | 3.70 kg | fixed, 100 yd |
| BAR M1918A2 | US | lmg | .30-06 Ball M2 | 853 m/s | 550 rpm | 20 (box) | 8.80 kg | 100-1500 yd |
| M1919A6 Browning | US | lmg | .30-06 Ball M2 | 853 m/s | 500 rpm | 100 (belt) | 14.70 kg | 200-2400 yd |
| Johnson M1941 LMG | US | lmg | .30-06 Ball M2 | 853 m/s | 550 rpm | 20 (box) | 5.90 kg | 200-1000 yd |
| Colt M1911A1 | US | pistol | .45 Ball M1911 | 253 m/s | semi-auto | 7 (box) | 1.10 kg | fixed, 25 yd |
| M1917 Revolver | US | revolver | .45 Ball M1911 | 240 m/s | double action | 6 (moon) | 1.13 kg | fixed, 25 yd |
| Bazooka M1A1 | US | launcher | 2.36 in Rocket M6A1 (HEAT) | 82 m/s | single shot | 1 (single) | 6.00 kg | 50-150 m |
| Mk II grenade | US | grenade | Mk II fragmentation grenade | - | - | - | 0.60 kg | - |
| Karabiner 98k | Germany | rifle | 7.92 mm s.S. Patrone | 760 m/s | bolt action | 5 (stripper) | 3.90 kg | 100-2000 m |
| Kar 98k ZF39 (scoped) | Germany | sniper | 7.92 mm s.S. Patrone | 760 m/s | bolt action | 5 (stripper) | 4.60 kg | 4x scope |
| Gewehr 43 | Germany | semi | 7.92 mm s.S. Patrone | 745 m/s | semi-auto | 10 (box) | 4.33 kg | 100-1200 m |
| MP 40 | Germany | smg | 9 mm Pistolenpatrone 08 | 398 m/s | 550 rpm | 32 (box) | 3.97 kg | 100-200 m |
| MP 34 | Germany | smg | 9 mm Pistolenpatrone 08 | 410 m/s | 600 rpm | 32 (box) | 4.48 kg | 50-500 m |
| StG 44 | Germany | assault | 7.92 mm Pistolenpatrone 43 | 685 m/s | 575 rpm | 30 (box) | 4.62 kg | 100-800 m |
| MG 42 | Germany | lmg | 7.92 mm s.S. Patrone | 755 m/s | 1200 rpm | 50 (belt) | 11.60 kg | 200-2000 m |
| MG 34 | Germany | lmg | 7.92 mm s.S. Patrone | 755 m/s | 850 rpm | 50 (belt) | 12.10 kg | 200-2000 m |
| FG 42 | Germany | lmg | 7.92 mm s.S. Patrone | 740 m/s | 900 rpm | 20 (box) | 4.95 kg | 100-1200 m |
| Walther P38 | Germany | pistol | 9 mm Pistolenpatrone 08 | 350 m/s | semi-auto | 8 (box) | 0.80 kg | fixed, 25 m |
| Luger P08 | Germany | pistol | 9 mm Pistolenpatrone 08 | 350 m/s | semi-auto | 8 (box) | 0.87 kg | fixed, 50 m |
| Mauser C96 | Germany | pistol | 9 mm Pistolenpatrone 08 | 425 m/s | semi-auto | 10 (stripper) | 1.13 kg | 50-500 m |
| Panzerschreck RPzB 54 | Germany | launcher | 8.8 cm R.Pz.B.Gr. 4322 (HEAT) | 110 m/s | single shot | 1 (single) | 11.00 kg | 50-150 m |
| Panzerfaust 60 | Germany | launcher | Panzerfaust 60 warhead (HEAT) | 45 m/s | single shot | 1 (disposable) | 6.10 kg | 30-80 m |
| Stielhandgranate 24 | Germany | grenade | Stielhandgranate 24 | - | - | - | 0.60 kg | - |
| Mosin-Nagant 1891/30 | USSR | rifle | 7.62 mm Type L light ball | 865 m/s | bolt action | 5 (stripper) | 4.00 kg | 100-2000 m |
| Mosin-Nagant PU (scoped) | USSR | sniper | 7.62 mm Type L light ball | 865 m/s | bolt action | 5 (stripper) | 4.60 kg | 3.5x scope |
| SVT-40 | USSR | semi | 7.62 mm Type L light ball | 840 m/s | semi-auto | 10 (box) | 3.85 kg | 100-1500 m |
| AVS-36 | USSR | assault | 7.62 mm Type L light ball | 840 m/s | 600 rpm | 15 (box) | 4.40 kg | 100-1500 m |
| PPSh-41 | USSR | smg | 7.62 mm Type P | 488 m/s | 1000 rpm | 71 (drum) | 3.63 kg | 100-200 m |
| PPS-43 | USSR | smg | 7.62 mm Type P | 500 m/s | 700 rpm | 35 (box) | 3.04 kg | 100-200 m |
| PPD-40 | USSR | smg | 7.62 mm Type P | 488 m/s | 800 rpm | 71 (drum) | 3.63 kg | 50-500 m |
| DP-28 | USSR | lmg | 7.62 mm Type L light ball | 840 m/s | 550 rpm | 47 (pan) | 9.12 kg | 100-1500 m |
| Tokarev TT-33 | USSR | pistol | 7.62 mm Type P | 420 m/s | semi-auto | 8 (box) | 0.85 kg | fixed, 25 m |
| Nagant M1895 | USSR | revolver | 7.62 mm Nagant revolver | 272 m/s | double action | 7 (gate) | 0.80 kg | fixed, 25 m |
| PTRD-41 | USSR | atRifle | 14.5 mm B-32 API | 1012 m/s | semi-auto | 1 (single) | 17.30 kg | 400-1000 m |
| RGD-33 | USSR | grenade | RGD-33 with fragmentation sleeve | - | - | - | 0.75 kg | - |

### Vehicles

| Vehicle | Army | Mass | Engine | Top speed (geared) | Steering | Main gun | Turret traverse |
|---|---|---|---|---|---|---|---|
| Willys MB | US | 1.1 t | Willys L134 "Go Devil" 2.2 L I4, 60 hp | 117 km/h | wheels (all drive) | - | - |
| Kübelwagen Typ 82 | Germany | 0.8 t | VW 985 cc air-cooled flat four, 25 hp (1943: 1131 cc) | 97 km/h | wheels (rear drive) | - | - |
| GAZ-67 | USSR | 1.3 t | GAZ-MM 3.3 L I4, 54 hp | 88 km/h | wheels (all drive) | - | - |
| M4A1 Sherman | US | 30.3 t | Continental R975-C1 9-cylinder radial, 400 hp gross | 39 km/h | controlled differential | 75 mm M3 L/40 | 24 deg/s, stabilized |
| Panzer IV Ausf. H | Germany | 25.0 t | Maybach HL 120 TRM V12, 300 hp | 42 km/h | epicyclic units | 7.5 cm KwK 40 L/48 | 14 deg/s |
| T-34/76 (1942) | USSR | 28.5 t | V-2-34 V12 diesel, 500 hp | 53 km/h | clutch and brake | 76.2 mm F-34 L/41.5 | 25 deg/s |
| M5A1 Stuart | US | 15.4 t | Twin Cadillac Series 42 V8s, 2 x 148 hp, Hydramatic | 60 km/h | controlled differential | 37 mm M6 | 30 deg/s, stabilized |
| Tiger I | Germany | 56.0 t | Maybach HL 230 P45 V12, 690 PS | 45 km/h | regenerative (turns in place) | 8.8 cm KwK 36 L/56 | 6 deg/s |
| T-34-85 (1944) | USSR | 32.0 t | V-2-34 V12 diesel, 500 hp | 55 km/h | clutch and brake | 85 mm ZiS-S-53 | 26 deg/s |
| Opel Blitz 3.6-36S | Germany | 3.6 t | Opel 3.6 L straight six, 75 hp | 90 km/h | wheels (rear drive) | - | - |

### Tank ammunition

| Shell | Caliber | Mass | Muzzle velocity | Penetration (0 deg, reference) | Explosive |
|---|---|---|---|---|---|
| M61 APC | 75 mm | 6.79 kg | 619 m/s | 88 mm at 610 m/s | 0.064 kg filler |
| M48 HE | 75 mm | 6.66 kg | 463 m/s | - | 0.67 kg |
| PzGr. 39 APCBC-HE | 75 mm | 6.8 kg | 790 m/s | 128 mm at 780 m/s | 0.018 kg filler |
| SprGr. 34 HE | 75 mm | 5.74 kg | 550 m/s | - | 0.68 kg |
| BR-350A APHE | 76 mm | 6.3 kg | 662 m/s | 82 mm at 655 m/s | 0.155 kg filler |
| OF-350 HE-Frag | 76 mm | 6.2 kg | 680 m/s | - | 0.62 kg |
| M51 APC | 37 mm | 0.87 kg | 884 m/s | 64 mm at 870 m/s | - |
| M63 HE | 37 mm | 0.73 kg | 790 m/s | - | 0.04 kg |
| PzGr. 39 (8.8 cm) APCBC-HE | 88 mm | 10.2 kg | 773 m/s | 158 mm at 770 m/s | 0.059 kg filler |
| Sprgr. Patr. (8.8 cm) HE | 88 mm | 9 kg | 820 m/s | - | 0.9 kg |
| BR-365 APBC-HE | 85 mm | 9.2 kg | 792 m/s | 116 mm at 780 m/s | 0.048 kg filler |
| O-365K HE-Frag | 85 mm | 9.5 kg | 793 m/s | - | 0.74 kg |


## Things that could not be confirmed

- Exact interior layouts of the original map's buildings; the village here is a plausible French village built to the documented layout (church, police station, square, bridges, river bend).
- Some ballistic coefficients for less common cartridges, and some gear ratios (marked "est.").
- How the original handled running out of reinforcement tickets in Assault (not used here).
