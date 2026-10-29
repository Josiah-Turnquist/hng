# Items beyond guns: conventions

The original game's loadout had, besides the main weapon and sidearm, three
equipment slots (grenades, first-aid kits, medic pouches, the repair wrench), a
close-combat slot (knives, bayonets, spades, bats) and binoculars. This game
follows it (`LOADOUT_SLOTS` in `src/weapons/defs.js`):

| Index | Slot (`def.slot`) | Key |
|---|---|---|
| 0 | `primary` | 1 |
| 1 | `sidearm` | 2 |
| 2, 3, 4 | `equipment` | 3 (also G), 4, 5 |
| 5 | `closecombat` | 6 |
| 6 | `binoculars` | 7 |

A soldier's `weapons[i]` holds a `Weapon` (or null) for slot `i`; the player
switches with the keys above or the mouse wheel (empty slots are skipped).

## Defining an item

Each kind of item has its own file in `src/weapons/items/` exporting a table of
definitions (`MELEE`, `BINOCULARS`, `POCKET_PISTOLS`, `KITS`), merged into
`WEAPONS` by `defs.js`. Every definition needs at least:

- `name`, `faction` (`US`, `GE` or `SU`), `slot`, `type`, `classes` (which of
  `infantry`, `paratrooper`, `recon`, `tanker` may carry it), `mass` (kg),
  `points` (the original game's equipment points, `equipmentPointsCost`), and
  `info` (one line for the loadout screen).
- What the rest of the game needs to treat it as a weapon in a slot (the
  derived-values loop at the end of `defs.js`, `Weapon`, the viewmodel, the HUD,
  pickups): give it what a grenade gets, or guard those places by `type`.

The ids are fixed (the ribbons that open them are set in `src/game/ribbons.js`):

- Close combat (`type: 'melee'`): `spade_m1910` (US M-1910 entrenching tool),
  `knife_m3` (US combat knife), `bat_us` (baseball bat); `spade_ge` (German
  small entrenching tool, "Schanzzeug"), `bayonet_s84_98` (Seitengewehr 84/98),
  `bat_ge` (baseball bat, Berlin 1936); `spade_mpl50` (Soviet MPL-50 small
  infantry spade, "Vulcan Stalin" in the game data), `knife_nr40` (NR-40 scout's
  knife), `bayonet_avs36` (AVS-36 bayonet), `bat_lapta` (lapta bat). Points: 1,
  bats 2.
- Binoculars (`type: 'binoculars'`): `binoc_us` (M3 6x30), `binoc_ge`
  (Dienstglas 6x30), `binoc_su` (6x30). 1 point.
- Pocket pistols (`slot: 'sidearm'`, `type: 'pistol'`): `colt_1903` (Colt
  Model 1903 Pocket Hammerless, .32 ACP), `beretta_1934` (Beretta M1934, 9 mm
  Corto), `korovin_tk` (Korovin TK, 6.35 mm). 1 point.
- Kits (`type: 'firstaid' | 'medkit' | 'wrench'`): `firstaid_us`,
  `firstaid_ge`, `firstaid_su` (first-aid kit, 1 point), `medic_us`,
  `medic_ge`, `medic_su` (medic pouch, 2 points), `wrench` (adjustable wrench,
  any army, 1 point). The wrench is defined with `faction: 'US'` and
  `anyArmy: true`; `weaponsFor()` in `defs.js` lists it for every army, and
  code that keeps another army's weapons apart (`requirement()` and
  `carriable()` in `ribbons.js`) should treat an `anyArmy` item as the
  soldier's own. How the kits work: `src/game/kits.js`.

## Ribbon points

The player's actions with these items feed his ribbons through
`game.ribbonTally` (`src/game/ribbons.js`), when the user is
`game.player.soldier`:

- A close-combat swing: `ribbonTally.shot(def, s)`; damage to a man:
  `game.onDamage` already passes it on if `s.damage(amount, { attacker, weapon:
  def })` is used; a kill: `onDeath` does it. (Close Combat ribbon.)
- First aid on himself: `ribbonTally.heal('self')`; on another man:
  `ribbonTally.heal('other')`. (Medic ribbon.)
- A repair with the wrench: `ribbonTally.repair()`. (Medic ribbon, as in the
  original data.)
