# WWII Combined-Arms Vehicle Data: Research File

Prepared 2026-10-23 for a physics-based WWII combined-arms game (driving model + armour penetration). Scope: the 31 vehicles you listed plus the Heroes & Generals (H&G) vehicles you did not list.

## 0. Read this first: research status and confidence markers

**What went wrong with access (affects every table below):**
- **WebFetch failed for every domain** tried (Wikipedia, tanks-encyclopedia, panzerworld, archive.org, theshermantank.com, fandom, namu.wiki, igcd) with `getaddrinfo ENOTFOUND`, so no page was opened directly.
- **Shell `curl` is blocked** by the session's egress proxy (HTTP 403 on CONNECT) for Wikipedia, tanks-encyclopedia, panzerworld, archive.org, wwiivehicles, onwar, bulletpicker, wwiiequipment, tankarchives, achtungpanzer and ww2db. Only GitHub/PyPI/npm are reachable.
- **WebSearch worked for 21 queries** (one more was refused by the search back-end), then returned "this turn's web search budget is used up (limit: 200 WebSearch calls per turn, shared by every agent in it)". Parallel agents used up the budget. No further searching was possible, and no workaround was attempted.
- So the only **verified** data is what those 21 searches returned: the H&G roster, the US 75 mm / 76 mm / 90 mm gun tables, partial 37 mm data, the M18 Hellcat infobox and part of the Willys MB data.
- The H&G roster was also cross-checked against an in-game vehicle-template extract that another agent left in this session's scratchpad (section 1).

**Markers used in every table:**

| Marker | Meaning |
|---|---|
| **[V]** | Verified this session: the value appeared in a web-search extract of the cited URL. The extract was machine-summarised, so it is still worth checking the page for transcription slips. |
| **[R]** | UNVERIFIED baseline. The value comes from model recall of commonly published figures (Wikipedia infoboxes, Hunnicutt, Jentz/Doyle, Zaloga, TMs). The URL shown is where to **check** it, not proof that the page says it. Do not ship without checking. |
| **[R?]** | As [R], but low confidence (figures vary between sources or recall is weak). |
| calc | Derived by arithmetic from other values in the row. |
|: / NOT retrieved | No value obtained. Left blank on purpose rather than guessed. |

Conventions: armour angles are **degrees from vertical** (0° = vertical plate). "RHA" = rolled homogeneous armour, "FHA" = face-hardened armour. US penetration figures use US/UK 50 %-success criteria unless stated. German tables use German criteria and Soviet tables use Soviet "through-penetration" criteria, so the three are **not directly comparable**. Power figures are gross unless marked net.

## Contents
1. Heroes & Generals roster cross-check
2. Guns and ammunition (A1–A7). Vehicles refer to these.
3. Vehicles: B1 light vehicles and trucks · B2 USA · B3 Germany · B4 USSR
4. C. H&G additions (headline baseline only)
5. D. Gaps, conflicts and the exact sources to fetch next

---

## 1. Heroes & Generals roster cross-check

The official H&G wiki (heroesandgenerals.fandom.com) could not be opened directly (DNS/proxy block), so the roster below comes from search-result extracts of its pages, the NamuWiki H&G pages, a Steam guide and the 2014 "Patton" update news. All rows are [V] for "this name appears in the source"; the in-game variant names may have changed in later patches (the wiki snapshots were 53–218 days old when indexed).

Sources: HG-V = https://heroesandgenerals.fandom.com/wiki/Vehicles · HG-C = https://heroesandgenerals.fandom.com/wiki/Category:Vehicles · HG-DE = https://heroesandgenerals.fandom.com/wiki/Category:German_vehicles · HG-SU = https://heroesandgenerals.fandom.com/wiki/Category:Soviet_Union_vehicles · HG-TC = https://heroesandgenerals.fandom.com/wiki/Tank_Crew · HG-LA = https://heroesandgenerals.fandom.com/wiki/Light_Armor · NW-US = https://en.namu.wiki/w/%ED%9E%88%EC%96%B4%EB%A1%9C%EC%A6%88%20%EC%95%A4%20%EC%A0%9C%EB%84%88%EB%9F%B4%EC%8A%A4/%EB%AF%B8%EA%B5%B0%20%ED%83%91%EC%8A%B9%EC%9E%A5%EB%B9%84 · NW-DE = https://en.namu.wiki/w/%ED%9E%88%EC%96%B4%EB%A1%9C%EC%A6%88%20%EC%95%A4%20%EC%A0%9C%EB%84%88%EB%9F%B4%EC%8A%A4/%EB%8F%85%EC%9D%BC%EA%B5%B0%20%ED%83%91%EC%8A%B9%EC%9E%A5%EB%B9%84 · ENG = https://www.engadget.com/2014-05-08-heroes-and-generals-patton-is-the-biggest-content-update-since-o.html

| Faction | Category (H&G) | Vehicles named in sources | On your list? | Source |
|---|---|---|---|---|
| US | Light armor | M2A2; M5A1 Stuart (37 mm, "13–51 mm armour"); M24 Chaffee (75 mm) | M5A1 yes; **M2A2, M24 added** | HG-V, HG-LA, https://heroesandgenerals.fandom.com/wiki/M5A1_Stuart |
| US | Medium armor | M3 Lee; M4A1 Sherman; M4A3E8 "Easy 8" | **M3 Lee added** | HG-V |
| US | Heavy armor | M4A3E2 "Jumbo"; M26 Pershing (90 mm) | **Jumbo added** | HG-V |
| US | Tank destroyers | M10; M18 Hellcat; M36 (heavy TD per NamuWiki) | yes | HG-V, NW-US |
| US | Infantry fighting / recon vehicles | M8 Greyhound; M20 Armored Utility Car; "T8E1 Stuart Recce" | **all added** | HG-V (search extract) |
| US | Motorcycles | Harley-Davidson 42WLA (solo and with sidecar gunner) | **added** | HG-V |
| DE | Light armor | Panzer II Ausf. C (20 mm + MG 34); Panzer 38(t) Ausf. E ("37.2 mm"); Panzer II Ausf. L "Luchs" | **all added** | HG-V, https://heroesandgenerals.fandom.com/wiki/Panzer_38(t)_Ausf._E , https://heroesandgenerals.fandom.com/wiki/Panzer_II_Ausf._L |
| DE | Medium armor | Panzer III J/1 (5 cm KwK 39 L/60); Panzer IV Ausf. H (KwK 40 L/48, skirts); Panzer V Ausf. G Panther (75 mm, "16–110 mm") | yes (variants: J/1, H, G) | https://heroesandgenerals.fandom.com/wiki/Panzer_III_J/1 , https://heroesandgenerals.fandom.com/wiki/Panzer_IV_Ausf._H , HG-V |
| DE | Heavy armor | Tiger I (88 mm, "20–120 mm"); Tiger II (Ausf. B) | **Tiger II added** | HG-V |
| DE | Tank destroyers | StuG III Ausf. F; Jagdpanzer 38(t) Hetzer; Jagdpanther (heavy TD) | **StuG III F (you listed G) and Jagdpanther added** | HG-TC, NW-DE, HG-DE |
| DE | IFV / recon | Sd.Kfz. 222; Sd.Kfz. 234/2 "Puma"; Sd.Kfz. 250 | **all added** | HG-V, HG-DE |
| DE | Motorcycles | BMW R75 with sidecar; Sd.Kfz. 2 Kettenkrad (tracked motorcycle) | **added** | HG-V / changelog extract |
| SU | Light armor | T-26 Model 1933; BT-7 Model 1937; T-38 Model 1937 (amphibious); T-70 Model 1942 | **T-26, BT-7, T-38 added** | HG-V, https://heroesandgenerals.fandom.com/wiki/T-26_Model_1933 |
| SU | Medium armor | T-34/76; T-34/85 | yes | HG-C |
| SU | Heavy armor | KV-85; IS-2 Model 1944 | **KV-85 added** | HG-V, HG-SU |
| SU | Tank destroyers | SU-76M (76.2 mm); SU-85; SU-100 (heavy TD) | yes | HG-V, https://heroesandgenerals.fandom.com/wiki/SU-100 |
| SU | IFV / recon | GAZ BA-64B | **added** | HG-V |
| SU | Motorcycles | 42WLA (Lend-Lease) | **added** | HG-V |

**Game-data cross-check (better evidence than the wiki extracts).** A parallel agent in this same session extracted the H&G vehicle templates (99 entries: faction, class, in-game mass and speed) to `/tmp/claude-0/-home-user-hng/7bd4bb68-678e-57c7-90b0-5e2c6d9e530b/scratchpad/vehicles.txt`. Its upstream repository/URL is not recorded in that file, so treat the provenance as "H&G game JSON as obtained by the other agent". Its in-game masses and speeds are **game values, not real-world data**, and are not used in this file's tables. What it settles:

| Your vehicle | In H&G game data? | H&G variant name |
|---|---|---|
| Willys MB · Kübelwagen · Opel Blitz | yes | Willys MB · Kubelwagen Typ 82 · Opel Blitz |
| GAZ-67B | yes, as **GAZ-67** | GAZ-67 |
| GMC CCKW 353 | yes, but as **GMC CCKW 352** (short wheelbase) | GMC CCKW 352 |
| ZIS-5 | **no** (the Soviet truck in H&G is the GAZ-AAA) |: |
| M3 half-track | yes, as **M3A1** | M3A1 |
| Sd.Kfz. 251 | yes | SdKfz 251-D |
| M5A1, M4A1, M10, M18, M36, M26 | yes | M5A1 Stuart, M4A1 Sherman, M10 Wolverine, M18 Hellcat, M36 Jackson (+ **M36B1**), M26 Pershing |
| M4A3(76)W | **no** (only the M4A3E8 and M4A3E2 Jumbo) | M4A3E8 Sherman |
| Panzer III J/M · Panzer IV G/H · Panther A/G | yes | Pz III Ausf J · Pz IV Ausf. H · Pz V Ausf. G |
| StuG III G · Tiger I · Hetzer | yes | Sturmgeschutz III (variant not named in data; wiki: Ausf. F) · Tiger · Jagdpanzer 38(t) "Hetzer" |
| Marder III | **no** |: |
| T-70, T-34/76, T-34/85, SU-76M, SU-85, SU-100, IS-2 | yes | T-70 Model 1942, T-34 76 Model 1942, T-34 85 Model 1944, SU-76M, SU-85, SU-100, IS-2 Model 1944 |

Further H&G ground vehicles in the game data that were missing from both your list and the wiki extracts above:
- US: Ford GPA (amphibious jeep), M29 Weasel, M16 MGMC (quad .50 half-track), M36B1.
- DE: Sd.Kfz. 7/1 (quad 2 cm Flak half-track), Typ 166 Schwimmwagen, Pz.Kpfw. I Ausf. A, Sd.Kfz. 250/3 (the H&G 250 variant).
- SU: GAZ-AAA (cargo, and with M-4 Maxim quad AA), T-20 Komsomolets, BA-6, BA-11, T-28 Model 1934, M-72 motorcycle (solo and sidecar).
- Neutral/civilian: Citroën AC4 Plateau truck, "Universal-1" tractor, bicycle.
- Static AA weapons (not vehicles): M55 Quad, Flakvierling 38, Maxim M4 Quad.

The 2014 "Patton" update coverage also confirms that infantry could spawn "off-road cars, motorcycles and half-tracks" and that the game then had 15 tanks, 3 tank destroyers and 12 other vehicles (ENG). Aircraft were out of scope.


## 2. Guns and ammunition

US guns (A1–A5) contain the verified tables from this session. German (A6) and Soviet (A7) guns are baseline-only.

### A1. US 75 mm Gun M3 (L/40): M4A1 Sherman (also M3 Lee hull gun, M24 uses lighter M6 with same ballistics)

Penetration table 1: Wikipedia "75 mm gun M2–M6" metric table (stated basis: mm of armour at **30° from vertical**; table credited to an external "penetration data" database ultimately derived from US/UK firing data; MV 618 m/s). Source: https://en.wikipedia.org/wiki/75_mm_gun_M2%E2%80%93M6

| Range | M61 APC(BC) vs RHA | M61 vs FHA | M72 AP vs RHA | M72 vs FHA |
|---|---|---|---|---|
| 100 m | 88 | 102 | 109 | 91 |
| 250 m | 85 | 99 | 102 | 85 |
| 500 m | 81 | 95 | 92 | 75 |
| 750 m | 77 | 90 | 84 | 66 |
| 1000 m | 73 | 86 | 76 | 58 |
| 1250 m | 69 | 82 | 68 | 51 |
| 1500 m | 65 | 79 | 62 | 45 |
| 2000 m | 59 | 72 | 51 | 35 |
| 2500 m | 53 | 65 | 41 | 27 |
| 3000 m | 47 | 60 | 34 | 21 |

UNCERTAIN: the search-extracted column order (RHA/FHA) for this table should be re-checked against the page; the 1000 m M61/RHA value (73 mm) is corroborated by the Wikipedia M4 Sherman article ("73 mm at 1,000 m firing M61 APCBC").
The Military-History Fandom mirror of the same table says "at 90 degrees" (i.e. measured from the plate surface = 0° from vertical) and "US/UK 50 % success criteria": so the obliquity basis of this table is itself disputed between the two copies: https://military-history.fandom.com/wiki/75mm_gun_M2%E2%80%93M6

Penetration table 2: yard-based "penetration comparison" table on the same Wikipedia page. The search extract did NOT state its angle or criteria; the values match the commonly quoted US wartime figures for a 30° plate [R?], so verify the caption before use:

| Range | M61 APC vs RHA | M72 AP vs RHA | M61 vs FHA | M72 vs FHA |
|---|---|---|---|---|
| 500 yd (457 m) | 66 | 76 | 74 | 66 |
| 1000 yd (914 m) | 60 | 63 | 67 | 53 |
| 1500 yd (1372 m) | 55 | 51 | 60 | 41 |
| 2000 yd (1829 m) | 50 | 43 | 54 | 33 |

Other penetration statements:
- 75 mm M1897 on M2 carriage article (M3-gun ballistics, 30°): M61 ≈69 mm @500 yd, ≈48 mm @2000 yd; M72 ≈58 mm @500 yd, ≈25 mm @2000 yd ("approximate, based on M3 data"). https://en.wikipedia.org/wiki/75_mm_field_gun_M1897_on_M2_carriage: CONFLICTS with table 2 for M72.
- British trial: M72 AP 68 mm RHA at 500 yd (460 m) at 30°. https://en.wikipedia.org/wiki/Ordnance_QF_75_mm
- M61 at 0° and 500 yd: 81 mm RHA (search summary; source not pinned, consistent with table 1 500 m value).

Ammunition data:

| Round | Type | Projectile mass | MV | Filler | Source |
|---|---|---|---|---|---|
| APC M61 | APCBC-HE-T | 14.96 lb (6.79 kg) projectile per US spec booklet; Wikipedia gives 6.63 kg (14.62 lb) | 2030 ft/s (618 m/s) | see notes | https://www.theshermantank.com/wp-content/uploads/75mm-M3-spec-booklet-MK-VI.pdf ; https://en.wikipedia.org/wiki/75_mm_gun_M2%E2%80%93M6 |
| AP M72 | AP-T (uncapped shot) | 13.94 lb (6.32 kg) | 2030 ft/s (618 m/s) | none (solid shot) | same booklet; https://weaponsystems.net/system/1651-75mm+Gun+M3 |
| HE M48 | HE | 14.70 lb (6.67 kg) per booklet; Wikipedia 6.76 kg (14.9 lb) | 1520 ft/s (463 m/s) normal charge | see notes | same |
| Smoke M89 | Smoke | 6.61 lb projectile (9.83 lb complete round) | n/a in source | smoke | https://www.theshermantank.com/wp-content/uploads/M3-gun-Data.pdf |

Notes on 75 mm M3 ammunition:
- Complete-round weights (US data sheet): M48 HE normal 18.80 lb, M48 with supercharge 19.56 lb; M61 complete 19.92 lb. Max chamber pressure 38,000 psi; rate of fire listed as 20 rds/min. https://www.theshermantank.com/wp-content/uploads/M3-gun-Data.pdf
- Filler (game-derived, LOWER RELIABILITY): War Thunder wiki gives M61 APCBC 6.79 kg with 63.7 g explosive filler; M48 HE 6.3 kg with 666 g TNT-equivalent. https://wiki.warthunder.com/M3_(75_mm): the M48 mass conflicts with US data sheet (14.70 lb = 6.67 kg). Not confirmed from a TM in this research.
- Primary source to consult for exact data: War Department "Firing Tables for Gun, 75-mm, M2 and M3 (tank)" (FT 75-?-, change 1 May 1944), catalogued at https://mocat.library.unt.edu/catalog/595-ch1473 and https://www.awm.gov.au/collection/LIB17041 (contents not retrievable here).

### A2. US 76 mm Gun M1 (M1A1 / M1A1C / M1A2): M4A3(76)W, M4A3E8, M18 Hellcat. (M10 uses the different 3-inch Gun M7 with the same projectiles; see A3.)

Ammunition (Wikipedia "76 mm gun M1": https://en.wikipedia.org/wiki/76_mm_gun_M1)

| Round | Type | Projectile mass | MV | Filler |
|---|---|---|---|---|
| APC M62 / M62A1 | APCBC-HE-T | 7.00 kg | ~790 m/s (2,600 ft/s) | small HE filler (exact weight not retrieved – see note) |
| AP M79 | AP-T solid shot | 6.8 kg | ~790 m/s (2,600 ft/s) | none |
| HVAP M93 (T4) | APCR/HVAP-T (tungsten core) | 3.4 kg | ~1,000 m/s (Wikipedia); 3,400 ft/s (1,036 m/s) for M1A1-gun HVAP per panzer-war | none |
| HE M42A1 | HE | NOT retrieved | NOT retrieved | NOT retrieved |

Penetration table 1: Wikipedia main table (the search summary described it as **0°**, i.e. vertical plate; verify the basis on the page):

| Range | M62 vs RHA | M62 vs FHA | M79 vs RHA | M79 vs FHA | M93 HVAP |
|---|---|---|---|---|---|
| 100 m | 125 | 124 | 154 | 132 | 239 |
| 500 m | 116 | 122 | 131 | 112 | 208 |
| 1000 m | 106 | 116 | 107 | 92 | 175 |
| 1500 m | 97 | 110 | 88 | 75 | 147 |
| 2000 m | 89 | 101 | 72 | 62 | 124 |

Penetration table 2: US official (yards, **30° from vertical**, homogeneous plate; same values on Wikipedia/Wikiwand and on panzer-war.com which quotes TM 9-1907 / N-4636-C graphs):

| Range | APC M62 | AP M79 | HVAP M93 |
|---|---|---|---|
| 500 yd (457 m) | 93–94 | 109 | 157–158 |
| 1000 yd (914 m) | 88–89 | 92 | 134–135 |
| 1500 yd (1372 m) | 81–82 | 76 | 116–117 |
| 2000 yd (1829 m) | 75–76 | 64 | 98–99 |

(The ranges are as printed in the source table.) Sources: https://www.wikiwand.com/en/76_mm_gun_M1 ; http://panzer-war.com/page60.html

Other published figures (do not mix): Zaloga & Sarson quoted on Wikipedia talk page: APC 98 mm @500 m and 90 mm @1000 m; HVAP 150 mm @500 m and 132 mm @1000 m (30°). https://en.wikipedia.org/wiki/Talk:76_mm_gun_M1 . The talk page also says the Ordnance Dept. tested with the target at normal impact and then calculated estimates for a 20° (not 30°) slope, and that the slide-rule arithmetic was wrong. Treat early published figures with caution.
Wikipedia also quotes M93 at point-blank 0°: 201–218 mm.

### A3. US 3-inch Gun M7: M10 Wolverine
- Fires the same projectile family as the 76 mm M1 (APC M62, AP M79, HVAP M93, HE M42A1) at the same nominal 2,600 ft/s (≈792 m/s) MV, so the A2 tables are the usual stand-in. [R] check: https://en.wikipedia.org/wiki/3-inch_gun_M7 
- Penetration figures specific to the M7 were NOT retrieved this session.

### A4. US 90 mm Gun M3: M36 Jackson, M26 Pershing

Ammunition:

| Round | Type | Projectile mass | MV | Filler | Source |
|---|---|---|---|---|---|
| APC M82 | APCBC-HE-T | 24.11 lb (10.94 kg) | 2,650 ft/s (808 m/s) standard; 2,800 ft/s (853 m/s) late/improved charge | Explosive "D" bursting charge, BD fuze M68 (mass of filler not retrieved) | https://www.lonesentry.com/manuals/90-mm-ammunition/index.html ; https://www.alternatewars.com/BBOW/Weapons/AFV_Guns/US_90mm_Guns.htm ; https://www.wikiwand.com/en/90_mm_gun_M1/M2/M3 |
| AP M77 | AP-T solid shot | NOT retrieved | 823 m/s (2,700 ft/s) per Wikipedia table | none | https://www.wikiwand.com/en/90_mm_gun_M1/M2/M3 |
| HVAP T30E16 / M304 | APCR-T (tungsten core) | complete round 16.84 kg; projectile mass NOT retrieved | 1,021 m/s (alternatewars); 1,018 m/s (Wikipedia table) | none | https://www.alternatewars.com/BBOW/Weapons/AFV_Guns/US_90mm_Guns.htm |
| HE M71 | HE | complete round 23.29 lb (10.56 kg); projectile mass NOT retrieved | 2,700 ft/s (823 m/s) listed for the M1 gun | NOT retrieved | https://www.theshermantank.com/wp-content/uploads/M3-90mm-gun-data.pdf ; alternatewars |

Penetration table 1: Wikipedia/Wikiwand table. The extract did not state the angle; the same page's HVAP figures are described "at 90°" (normal impact = 0° from vertical), so this table is probably **0° / normal** (inferred, verify):

| Range | M77 AP vs RHA | M77 vs FHA | M82 APC (808 m/s) vs RHA | M82 vs FHA | M82 late (853 m/s) vs RHA | M82 late vs FHA | T30E16 HVAP |
|---|---|---|---|---|---|---|---|
| 100 m | 188 | 168 | 164 | 151 | 169 | 161 | 306 |
| 500 m | 163 | 146 | 150 | 147 | 164 | 155 |: |
| 1000 m | 137 | 122 | 137 | 140 | 151 | 147 | 246 |
| 1500 m | 115 | 102 | 125 | 135 | 140 | 138 |: |
| 2000 m | 96 | 86 | 114 | 123 | 132 | 127 |: |

Source: https://www.wikiwand.com/en/90_mm_gun_M1/M2/M3 (copy of https://en.wikipedia.org/wiki/90_mm_gun_M1/M2/M3)

Penetration table 2: US official, homogeneous armour at **30°** obliquity:

| Range | M82 APC (AMCP 706-107 table) | M82 APC "early" (alternatewars) | HVAP T30E16 (alternatewars, Situation Report No. 34) | HVAP M304 (US data sheet, angle not stated) |
|---|---|---|---|---|
| 0 yd | 5.0 in (127 mm) (AMCP column as extracted: the flat 0–1500 yd fall-off looks inconsistent with the other series; verify) |: |: |: |
| 500 yd (457 m) | 4.5 in (114 mm) | 119.4 mm | 221.0 mm | 221 mm (8.7 in) |
| 1000 yd (914 m) | 4.3 in (109 mm) | 111.8 mm | 200.7 mm | 199 mm (7.9 in) |
| 1500 yd (1372 m) | 4.2 in (107 mm) | 104.1 mm | 177.8 mm | 176 mm (7.0 in) |
| 2000 yd (1829 m) |: | 96.5 mm | 154.9 mm | 156 mm (6.1 in) |

Striking velocity of M82 (AMCP 706-107): ≈2,680 ft/s @500 yd, 2,570 @1000 yd, 2,460 @1500 yd (indicates retained-velocity curve usable to fit drag). Sources: https://www.alternatewars.com/BBOW/Weapons/AFV_Guns/US_90mm_Guns.htm ; https://www.theshermantank.com/wp-content/uploads/M3-90mm-gun-data.pdf
panzer-war (TM 9-1907 graphs, 30°, yards): M82 at 2,670 ft/s ≈112 mm at 1000 yd. http://panzer-war.com/page60.html

### A5. US 37 mm Gun M6 (L/53): M5A1 Stuart (also M8 Greyhound)

| Round | Type | Projectile mass | MV | Filler | Source / status |
|---|---|---|---|---|---|
| APC M51 (M51B1/B2) | APCBC-T | 0.87 kg | 884 m/s (firearmcentral); collector forum: early lots ≈2,600 ft/s (792 m/s), later ≈2,800–2,900 ft/s (853–884 m/s) | none (shot) | [V] https://firearmcentral.fandom.com/wiki/Gun,_37mm,_M3 ; https://www.bocn.co.uk/threads/37mm-m74-ap-weight.43014/ |
| AP M74 | AP-T | 0.87 kg | 884 m/s (firearmcentral) vs 792 m/s (H&G wiki – game source) | none | [V] same + https://heroesandgenerals.fandom.com/wiki/37mm_M6_L/53 |
| HE M63 | HE | 0.73 kg projectile (1.42 kg complete round) | ≈782–792 m/s | 39 g TNT | [V] https://www.gunboards.com/threads/performance-of-us-37mm-at-gun.195734/ (forum – medium reliability) |
| Canister M2 | canister | NOT retrieved | NOT retrieved |: | not retrieved |

Penetration (fragmentary; sources disagree, all [V] as quoted by search):
- M51 APC: ≈61 mm (2.4 in) at 500 yd (Wikipedia, M6 GMC article; angle not stated – US practice is 20°/30°). https://en.wikipedia.org/wiki/M6_gun_motor_carriage
- M74 AP: 36 mm at 457 m (500 yd) at 0°?, 25 mm at 914 m (1000 yd) at 20° (firearmcentral – values look low/inconsistent; UNCERTAIN). https://firearmcentral.fandom.com/wiki/Gun,_37mm,_M3
- 48 mm at 500 yd, 30°, shot type unidentified, MV 2,545 ft/s (forum). https://www.gunboards.com/threads/performance-of-us-37mm-at-gun.195734/
- panzer-war (TM 9-1907 graphs, 30°, homogeneous, 50 % criterion): 37 mm M3/M6 APCBC M51B2 ≈43 mm at 1000 yd. http://panzer-war.com/page60.html
- A proper 100/500/1000/1500/2000 m table for the 37 mm was NOT retrieved.

### A6. German guns: UNVERIFIED BASELINE [R] (no German gun page could be opened or searched this session)

All values below are model recall of the tables commonly published on Wikipedia and panzerworld.com (German firing data, plate **30° from vertical**, RHA). Each must be checked before use. "check:" = page that carries the table.

| Gun (vehicles) | Round | Type | Proj. mass | MV | 100 m | 500 m | 1000 m | 1500 m | 2000 m | check |
|---|---|---|---|---|---|---|---|---|---|---|
| 5 cm KwK 39 L/60 (Pz III J/1, L, M; Puma uses KwK 39/1) | Pzgr. 39 | APCBC-HE | 2.06 kg | 835 m/s | 67 | 57 | 44 | 34 | 26 | https://en.wikipedia.org/wiki/5_cm_KwK_39 |
| same | Pzgr. 40 | APCR | ≈0.93–1.07 kg (sources differ) | ≈1,130–1,180 m/s | 130 | 72 | 38 |: |: | same |
| same | Sprgr. | HE | ≈1.8 kg [R?] | ≈550 m/s [R?] |: |: |: |: |: | same |
| 7.5 cm KwK 40 L/43 (early Pz IV G) | Pzgr. 39 | APCBC-HE | 6.8 kg | 740 m/s | 98 | 91 | 82 | 72 | 63 | https://en.wikipedia.org/wiki/7.5_cm_KwK_40 |
| same | Pzgr. 40 | APCR | 4.1 kg | ≈920 m/s | 126 | 108 | 87 | 69 |: | same |
| 7.5 cm KwK 40 L/48 / StuK 40 L/48 (Pz IV G late/H, StuG III G) | Pzgr. 39 | APCBC-HE | 6.8 kg | 750 m/s or 790 m/s (sources differ) | 106 | 96 | 85 | 74 | 64 | same; https://www.panzerworld.com/ (site search) |
| same | Pzgr. 40 | APCR | 4.1 kg | ≈930 m/s | 143 | 120 | 97 | 77 |: | same |
| same | Gr. 38 HL/B / HL/C | HEAT | ≈4.4–4.6 kg | ≈450–485 m/s | 75 (HL/B) / 100 (HL/C), range-independent | | | | | same |
| same | Sprgr. 34 | HE | 5.74 kg | ≈550 m/s [R?] |: | | | | | same |
| 7.5 cm PaK 39 L/48 (Hetzer) | Pzgr. 39 / 40, Sprgr. 34 |: | as KwK 40 L/48 | ≈750 m/s (Pzgr. 39) [R?] | treat as KwK 40 L/48 [R?] | | | | | https://en.wikipedia.org/wiki/7.5_cm_Pak_39 |
| 7.5 cm PaK 40/3 L/46 (Marder III) | Pzgr. 39 | APCBC-HE | 6.8 kg | ≈790 m/s | close to KwK 40 L/48 values [R?] – own table not recalled reliably | | | | | https://en.wikipedia.org/wiki/7.5_cm_Pak_40 |
| 7.5 cm KwK 42 L/70 (Panther) | Pzgr. 39/42 | APCBC-HE | 6.8 kg | 925 m/s | 138 | 124 | 111 | 99 | 89 | https://en.wikipedia.org/wiki/7.5_cm_KwK_42 |
| same | Pzgr. 40/42 | APCR | 4.75 kg | 1,120 m/s | 194 | 174 | 149 | 127 | 106 | same |
| same | Sprgr. 42 | HE | 5.74 kg | 700 m/s |: | | | | | same |
| 8.8 cm KwK 36 L/56 (Tiger I) | Pzgr. 39 | APCBC-HE | 10.2 kg | 773 m/s | 120 | 110 | 100 | 91 | 84 | https://en.wikipedia.org/wiki/8.8_cm_KwK_36 |
| same | Pzgr. 40 | APCR | 7.3 kg | 930 m/s | 171 | 156 | 138 | 123 | 110 | same |
| same | Gr. 39 HL | HEAT | 7.65 kg | 600 m/s | 90, range-independent | | | | | same |
| same | Sprgr. L/4.5 | HE | 9.0 kg | 820 m/s |: | | | | | same |
| 8.8 cm KwK 43 L/71 / PaK 43/3 (Tiger II, Jagdpanther – H&G additions) | Pzgr. 39/43 | APCBC-HE | 10.2 kg | 1,000 m/s | 203 | 185 | 165 | 148 | 132 | https://en.wikipedia.org/wiki/8.8_cm_KwK_43 |
| same | Pzgr. 40/43 | APCR | 7.3 kg | 1,130 m/s | 237 | 217 | 193 | 171 | 153 | same |

Notes:
- German tables are usually quoted for a 30° plate and German success criteria; they are NOT directly comparable with US 50 %-criteria tables (A1–A4) or Soviet "through-penetration" criteria.
- Explosive filler masses for Pzgr. 39 (all calibres) and HE rounds were NOT retrieved; do not use guessed values.
- Ballistic coefficients: none found. German firing tables (Schusstafeln) would be the primary source for drag/velocity-vs-range data [R?]. Search results also showed panzer-war.com pages titled "German 75mm Model 40 Guns" (http://panzer-war.com/page43.html) and "75mm Pzgr. 39 penetration vs velocity" (http://www.panzer-war.com/page44.html); their contents were not read.

### A7. Soviet guns: UNVERIFIED BASELINE [R?] (no Soviet gun page could be opened or searched this session)

Projectile masses / MVs below are recall of commonly published figures; Soviet penetration tables (usually quoted at 90° = normal impact and Soviet "through-penetration" criteria) were NOT retrieved and are deliberately left blank rather than guessed.

| Gun (vehicles) | Round | Type | Proj. mass | MV | check |
|---|---|---|---|---|---|
| 45 mm 20-K mod. 1932/38 (T-70; H&G: T-26, BT-7) | BR-240 | APHE (blunt, ballistic cap) | ≈1.43 kg | ≈760 m/s | https://en.wikipedia.org/wiki/45_mm_anti-tank_gun_M1937_(53-K) |
| same | BR-240P | APCR | ≈0.85 kg | ≈985 m/s | same |
| same | O-240 | HE-frag | ≈2.14 kg | ≈335 m/s | same |
| 76.2 mm F-34 (T-34/76) | BR-350A | APHE | ≈6.3 kg | ≈662 m/s | https://en.wikipedia.org/wiki/76_mm_tank_gun_M1940_F-34 |
| same | BR-350P | APCR | ≈3.02 kg | ≈950 m/s | same |
| same | OF-350 | HE-frag | ≈6.2 kg | ≈680 m/s | same |
| 76.2 mm ZiS-3Sh (SU-76M) | BR-350A / BR-350P / OF-350 | as above | as above | ≈655 / 950 / 680 m/s | https://en.wikipedia.org/wiki/76_mm_divisional_gun_M1942_(ZiS-3) |
| 85 mm ZiS-S-53 (T-34/85) / D-5S (SU-85) / D-5T (KV-85) | BR-365 / BR-365K | APHE | ≈9.2 kg | ≈792 m/s | https://en.wikipedia.org/wiki/85_mm_air_defense_gun_M1939_(52-K) ; https://en.wikipedia.org/wiki/T-34 |
| same | BR-365P | APCR | ≈4.99 kg | ≈1,050 m/s | same |
| same | O-365K | HE-frag | ≈9.54 kg | ≈793 m/s | same |
| 100 mm D-10S (SU-100) | BR-412 | APHE | ≈15.88 kg | ≈895 m/s | https://en.wikipedia.org/wiki/100_mm_field_gun_M1944_(BS-3) ; https://en.wikipedia.org/wiki/D-10_tank_gun |
| same | OF-412 | HE-frag | ≈15.6 kg | ≈900 m/s | same |
| 122 mm D-25T (IS-2) | BR-471 | APHE (separate loading) | ≈25 kg | ≈790–800 m/s | https://en.wikipedia.org/wiki/122_mm_gun_M1931/37_(A-19) ; https://en.wikipedia.org/wiki/IS-2 |
| same | OF-471 | HE-frag | ≈25 kg | ≈800 m/s | same |

Secondary weapons (all [R]): 7.62 mm DT (coax/hull/turret-rear), 12.7 mm DShK (IS-2 AA mount, late war).
Best follow-up sources for Soviet penetration: the Wikipedia pages above (tables with criteria), tankarchives.blogspot.com (Peter Samsonov's translated Soviet test reports), and Bird & Livingston's appendix tables.

---

## 3. Vehicles

Each vehicle table has a **Sources** line defining short keys (W, HG …) with full URLs. Every row carries a marker ([V]/[R]/[R?]) and the key of the page to check.

## B1. Light vehicles and trucks

### B1.1 Willys MB (1/4-ton 4x4): also Ford GPW (near-identical)
Sources: W = https://en.wikipedia.org/wiki/Willys_MB · KW = https://www.kaiserwillys.com/?p=119101 (41-45 MB general specs) · KW2 = https://www.kaiserwillys.com/about_willys_jeep_mb_history_specs · AL = https://allisons.org/ll/4/Jeep/MB · CJ = https://classicjeeps.co.uk/?p=20 · primary manual: TM 9-803 (not reachable this session)

| Item | Value | Status / source |
|---|---|---|
| Weight | 2,453 lb (1,113 kg) net; ≈3,253 lb (1,476 kg) gross with 800 lb cross-country payload | [R] W |
| Length / width | 132 in (3.35 m) / 62 in (1.57 m) | [V] W |
| Height | ≈69 in (1.75 m) top up | [R?] W |
| Wheelbase | 80 in (2,032 mm) | [V] KW, CJ |
| Track (F/R) | 48 in / 48 in (1,219 mm) per AL **vs** 49 in / 49 in (1,245 mm) per CJ: sources disagree | [V] AL, CJ |
| Ground clearance | 8.75 in (222 mm) | [R] W |
| Tyres | 6.00-16; inflation 30 psi (KW) **vs** 35 psi (CJ) | [V] KW, CJ |
| Crew / capacity | driver + 2–3 passengers | [R] W |
| Engine | Willys L134 "Go Devil" (Model 441/442), 134.2 cu in (2.2 L) I4 side-valve, gasoline | [R] W |
| Power | 60 hp (45 kW) @ 4,000 rpm (gross; ≈54 hp net) | [R] W |
| Torque | 105 lb-ft (142 N·m) @ 2,000 rpm | [R] W |
| Gearbox | Warner T-84 3F/1R | [V] KW |
| Gear ratios | 1st 2.665, 2nd 1.564, 3rd 1.000, R 3.554 (T-84J) | [R] (commonly quoted TM 9-803 figures; not verified) |
| Transfer case | Spicer/Dana 18, 2-speed | [V] KW |
| Transfer ratios | High 1.00 : 1, Low 1.97 : 1 | [R] |
| Axles / final drive | Spicer 25 front (steer/drive), Spicer 23-2 rear; 4.88 : 1 | [R] |
| Speed in 2nd gear | 41 mph high range / 21 mph low range | [V] CJ |
| Steering / turning | Ross cam-and-lever; turning radius NOT retrieved | [R?] |
| Suspension | semi-elliptic leaf springs on beam axles, hydraulic dampers | [R] W |
| Top speed | 65 mph (105 km/h) | [R] W |
| Fuel / range | 15 US gal (57 L) gasoline / ≈300 mi (480 km) | [R] W |
| Power-to-weight | ≈54 hp/t (net weight) | calc from above |
| Armament (optional) | M2HB .50 or M1919A4 .30 on pedestal mount | [R] |

### B1.2 Volkswagen Kübelwagen Typ 82
Sources: W = https://en.wikipedia.org/wiki/Volkswagen_K%C3%BCbelwagen (no data verified this session)

| Item | Value | Status |
|---|---|---|
| Weight | ≈715–725 kg unladen (sources vary) | [R?] W |
| Length / width / height | 3,740 mm / 1,600 mm / 1,650 mm (top up) | [R?] W |
| Wheelbase / track | 2,400 mm / ≈1,356 mm F, 1,360 mm R | [R?] W |
| Ground clearance | ≈285–290 mm | [R?] |
| Tyres | 5.25-16 (balloon "Geländereifen" on some vehicles) | [R?] |
| Crew | 4 (driver + 3) | [R] |
| Engine | VW air-cooled flat-4 OHV, petrol: 985 cc, 23.5 PS @ 3,000 rpm (to early 1943); 1,131 cc, 25 PS (18 kW) @ 3,000 rpm (from 1943) | [R] W |
| Torque (1,131 cc) | ≈67 N·m (6.8 kgf·m) @ ≈2,000 rpm | [R?] |
| Drive | rear-wheel drive only (4x2): no transfer case; ZF self-locking (limited-slip) differential; portal reduction gears in rear hubs | [R] W |
| Gearbox | 4F/1R manual, non-synchro; ratios ≈3.60 / 2.07 / 1.25 / 0.80, R 6.60; final drive 4.43 × hub reduction ≈1.4 | [R?] |
| Suspension | torsion bars all round (front trailing links, rear swing axles) | [R] W |
| Top speed | 80 km/h | [R] W |
| Steering / turning radius | NOT retrieved |: |

### B1.3 GAZ-67B (4x4)
Sources: W = https://en.wikipedia.org/wiki/GAZ-67 (page confirmed to exist via search; numbers not verified). H&G game data names this vehicle simply "GAZ-67".

| Item | Value | Status |
|---|---|---|
| Weight | ≈1,320 kg curb | [R] W |
| Length / width / height | ≈3,345 / 1,685 / 1,700 mm | [R?] W |
| Wheelbase / track | 1,850 mm / ≈1,446 mm (67B widened track) | [R?] W |
| Ground clearance | ≈223 mm | [R?] |
| Tyres | 6.50-16 | [R?] |
| Engine | GAZ-MM 3.28 L I4 side-valve, petrol, ≈54 hp @ 2,800 rpm (some sources 50 hp) | [R?] W |
| Transmission | 4F/1R + 2-speed transfer case, 4x4 | [R?] |
| Suspension | quarter-elliptic leaf springs with hydraulic lever dampers | [R?] |
| Top speed | ≈90 km/h | [R] W |
| Capacity | 4 persons | [R?] |
| Note | BA-64 armoured car (H&G addition) used the GAZ-64/67 chassis | [V] https://en.wikipedia.org/wiki/BA-64 |

### B1.4 Opel Blitz 3-ton (3.6-36S 4x2 / 3.6-6700A 4x4)
Sources: W = https://en.wikipedia.org/wiki/Opel_Blitz (not verified this session)

| Item | Value | Status |
|---|---|---|
| Engine | Opel 3.6 L (3,626 cc) I6 OHV, petrol, 75 PS (≈73.5 hp) @ 3,000 rpm | [R] W |
| Transmission | 5F/1R; 6700A adds 2-speed transfer case and driven front axle | [R] W |
| Wheelbase | 3,600 mm | [R] W |
| Payload | ≈3,000–3,300 kg | [R] |
| Length / width / height | ≈6.0 m / ≈2.27 m / ≈2.2 m (cab) | [R?] |
| Suspension | semi-elliptic leaf springs, rigid axles | [R] |
| Top speed | ≈80–90 km/h | [R?] |
| Weight, torque, ratios, tyres, turning radius | NOT retrieved |: |

### B1.5 GMC CCKW 353 (2½-ton 6x6, long wheelbase)
Sources: W = https://en.wikipedia.org/wiki/GMC_CCKW · primary manual TM 9-801 [R?] (not reachable). H&G game data has the **CCKW 352** (short 145 in wheelbase), not the 353.

| Item | Value | Status |
|---|---|---|
| Engine | GMC 270, 269.5 cu in (4.4 L) I6 OHV, petrol; ≈91.5 hp net / ≈104 hp gross @ 2,750 rpm | [R?] W |
| Torque | ≈216 lb-ft (293 N·m) @ 1,400 rpm | [R?] |
| Transmission | 5F/1R (5th = overdrive) | [R?] |
| Transfer case | 2-speed, front axle drive selectable | [R] |
| Axle ratio | ≈6.6 : 1 (banjo or Timken split axles) | [R?] |
| Wheelbase | 164 in (4.17 m) (CCKW-352: 145 in) | [R] |
| Payload | 2.5 short tons off-road / 5 short tons on road | [R] W |
| Tyres | 7.50-20, dual on both rear axles (10 tyres) | [R] |
| Suspension | leaf springs front; rear tandem on inverted leaf springs / trunnion | [R?] |
| Top speed | ≈45 mph (72 km/h) | [R] W |
| Weight / dimensions | ≈4.5–4.8 t empty; ≈6.5–6.9 m long, 2.24 m wide, ≈2.8 m high (tarp) | [R?] |

### B1.6 ZIS-5 (3-ton 4x2)
Sources: W = https://en.wikipedia.org/wiki/ZIS-5 (not verified this session). Not in the H&G game data; the H&G Soviet truck is the GAZ-AAA (C4).

| Item | Value | Status |
|---|---|---|
| Engine | ZIS-5 5.55 L I6 side-valve, petrol, 73 hp @ 2,300 rpm | [R] W |
| Torque | ≈28 kgf·m (≈275 N·m) @ ≈1,100–1,300 rpm | [R?] |
| Transmission | 4F/1R, 4x2 | [R] W |
| Curb weight / payload | ≈3,100 kg / 3,000 kg | [R] W |
| Wheelbase | 3,810 mm | [R] W |
| Length / width / height | ≈6,060 / 2,235 / 2,160 mm | [R?] W |
| Top speed | ≈60 km/h | [R] W |
| Suspension | semi-elliptic leaf springs | [R] |

### B1.7 M3 Half-track (and M3A1)
Sources: W = https://en.wikipedia.org/wiki/M3_half-track · primary manual TM 9-710 [R?] (not reachable). H&G game data has the **M3A1** (ring-mounted .50) and the M16 MGMC (C4).

| Item | Value | Status |
|---|---|---|
| Weight | ≈20,000 lb (9.1 t) loaded | [R] W |
| Length / width / height | 20 ft 3.5 in (6.18 m, with front roller) / 7 ft 3.5 in (2.22 m) / 7 ft 5 in (2.26 m) | [R] W |
| Crew | 3 + 10 passengers (13) | [R] W |
| Engine | White 160AX, 386 cu in (6.33 L) I6, petrol, 147 hp @ 3,000 rpm | [R] W |
| Torque | ≈325 lb-ft (441 N·m) @ 1,200 rpm | [R?] |
| Transmission | 4F/1R constant-mesh + 2-speed transfer case (front-axle drive selectable) | [R?] |
| Steering | front wheels only (steering wheel); tracks are driven, not steered | [R] |
| Suspension | front semi-elliptic leaf springs; rear track bogie with vertical volute spring; rubber band track ≈12 in (305 mm) wide | [R?] |
| Top speed | ≈45 mph (72 km/h) road | [R] W |
| Fuel / range | 60 US gal / ≈175–200 mi (280–320 km) | [R?] |
| Armour | 1/4 in (6.35 mm) sides & rear; 1/2 in (12.7 mm) windshield shield/front | [R] W |
| Armament | M2HB .50 on pedestal (M3) or M49 ring mount (M3A1) + .30 cal | [R] W |
| Turning radius / ratios | NOT retrieved |: |

### B1.8 Sd.Kfz. 251 (Ausf. C/D) mittlerer Schützenpanzerwagen
Sources: W = https://en.wikipedia.org/wiki/Sd.Kfz._251 (page confirmed via search: ≥15,252 built by seven manufacturers; predecessor Sd.Kfz. 11)

| Item | Value | Status |
|---|---|---|
| Weight | ≈7.8 t (Ausf. C) – ≈8.5 t (Ausf. D) | [R?] W |
| Length / width / height | 5.80 m / 2.10 m / 1.75 m | [R] W |
| Crew | 2 + 10 infantry | [R] W |
| Engine | Maybach HL 42 TUKRM 4.2 L I6, petrol, 100 PS @ 2,800 rpm | [R] W |
| Transmission | 4F/1R with high/low range (8F/2R) [R?] | [R?] |
| Steering | steering wheel turns front wheels; at large lock the inner track is braked automatically ("Lenkbremse") | [R?] |
| Suspension | front transverse leaf spring; rear torsion bars with interleaved road wheels | [R] W |
| Top speed | 52.5 km/h road | [R] W |
| Range | ≈300 km road | [R] W |
| Armour | 14.5 mm front, 8 mm sides/rear (6–14.5 mm) | [R] W |
| Armament | 1–2 × MG 34/42 | [R] |
| Track width / ratios / turning radius | NOT retrieved |: |

---

## B2. United States: tanks and tank destroyers

Common US drivetrain facts used below (all [R]: figures commonly quoted from the TM 9-731-series manuals and Hunnicutt, *Sherman* (1978); not verified this session):
- Sherman-family synchromesh gearbox, 5F/1R: 1st 7.56, 2nd 3.11, 3rd 1.78, 4th 1.11, 5th 0.73, R 5.65.
- Controlled-differential (Cletrac-type, regenerative, single fixed radius) steering: bevel gear 3.53 : 1, steering ratio 1.515 : 1; herringbone final drive 2.84 : 1.
- A controlled differential cannot neutral-steer (no pivot turn); the tightest turn is the fixed differential radius (≈31 ft / 9.4 m quoted for the M4 series [R?]).
- Angles are measured from vertical.

### B2.1 M5A1 Stuart (light tank)
Sources: W = https://en.wikipedia.org/wiki/M3_Stuart · HG = https://heroesandgenerals.fandom.com/wiki/M5A1_Stuart (game wiki)

| Item | Value | Status |
|---|---|---|
| Combat weight | ≈15.4 t (≈33,900 lb) | [R] W |
| L / W / H | ≈4.84 m (15 ft 10.5 in) / 2.29 m (7 ft 6 in) / ≈2.30 m | [R?] W |
| Crew | 4: commander (also loads), gunner, driver, assistant driver/bow gunner | [R] |
| Engine | 2 × Cadillac Series 42 V-8 (346 cu in / 5.67 L each), gasoline; ≈148 hp gross each @ 3,200 rpm (≈220 hp net total) | [R?] W |
| Transmission | 2 × Hydra-Matic 4-speed automatic + 2-speed transfer unit (6F/1R usable) | [R?] |
| Steering | controlled differential; no pivot turn | [R] |
| Top speed | ≈36 mph (58 km/h) road | [R] W |
| Range / fuel | ≈100 mi (160 km) / ≈89 US gal | [R?] |
| Suspension | VVSS; track ≈11.6 in (295 mm) | [R?] |
| Armour (range) | 13–51 mm | [V] HG (game wiki; matches W infobox range [R]) |
| Armour detail | glacis ≈1.125 in (29 mm) at ≈48°; turret front ≈1.5 in (38 mm); gun shield ≈1.5–2 in (38–51 mm); sides ≈1 in (25 mm) vertical; top/floor ≈0.375–0.5 in (10–13 mm) | [R?] |
| Main gun | 37 mm Gun M6 in Combination Mount M44 (see A5) | [V] HG |
| Ammo stowage | ≈123 rds 37 mm | [R?] |
| Elevation | ≈+20° / −10° | [R?] |
| Traverse | hydraulic power + manual; rate NOT retrieved | [R?] |
| Stabilizer | Westinghouse gyrostabilizer (elevation only) | [R] |
| Sights | NOT retrieved |: |
| MGs | 3 × M1919A4 .30 (coax, bow, AA) | [V] HG lists "37mm + M1919A4 + M1919A4 (passenger)"; 3rd MG [R] |

### B2.2 M4A1 Sherman (75 mm; cast hull)
Sources: W = https://en.wikipedia.org/wiki/M4_Sherman · G75 = https://en.wikipedia.org/wiki/75_mm_gun_M2%E2%80%93M6 · DS = https://www.theshermantank.com/wp-content/uploads/M3-gun-Data.pdf

| Item | Value | Status |
|---|---|---|
| Combat weight | 66,800 lb (30.3 t) | [R] W |
| L / W / H | 19 ft 2 in (5.84 m) / 8 ft 7 in (2.62 m) / 9 ft 0 in (2.74 m) | [R] W |
| Crew | 5: commander, gunner, loader, driver, assistant driver/bow gunner | [R] W |
| Engine | Continental R975-C1, 9-cyl air-cooled radial, 973 cu in (15.9 L), gasoline (80 octane) | [R] W |
| Power | 400 hp gross / 350 hp net @ 2,400 rpm | [R] W |
| Torque | ≈940 lb-ft (1,274 N·m) gross @ 1,700 rpm; ≈800 lb-ft (1,085 N·m) net @ 1,800 rpm | [R?] |
| Gearbox / ratios | 5F/1R synchromesh; see common data above | [R] |
| Steering / final drive | controlled differential; final drive 2.84 : 1; no pivot turn; min radius ≈31 ft | [R] / radius [R?] |
| Speed | 24 mph (39 km/h) sustained, ≈30 mph (48 km/h) max road | [R] W |
| Fuel / range | 175 US gal (662 L) / ≈120 mi (193 km) | [R] W |
| Power-to-weight | ≈13.2 hp/t gross (≈11.6 net) | calc |
| Suspension | VVSS, 3 bogies × 2 wheels per side | [R] W |
| Track / contact | 16.56 in (421 mm) wide; ground contact ≈147 in (3.73 m); ground pressure ≈13.7 psi (0.96 kg/cm²) | width [R]; contact & pressure [R?] |

Armour (M4A1, cast hull; thickness / angle from vertical): all [R] from Hunnicutt-type data sheets unless marked:

| Location | Thickness | Angle |
|---|---|---|
| Upper hull front (cast) | 2.0 in (51 mm) | 37°–55° (curved casting) |
| Lower hull front (final-drive housing) | 2.0 in (51 mm) | 0°–56° (rounded) |
| Hull sides | 1.5 in (38 mm) | ≈0° |
| Hull rear | 1.5 in (38 mm) | ≈0°–20° [R?] |
| Hull top | 0.75 in (19 mm) | 83°–90° |
| Floor | 1.0 in (25 mm) front / 0.5 in (13 mm) rear | 90° |
| Turret front | 3.0 in (76 mm) | 30° |
| Gun shield (M34 mount) | 3.0 in (76 mm) | 0° (M34A1 rotor shield thicker [R?]) |
| Turret sides | 2.0 in (51 mm) | ≈5° |
| Turret rear | 2.0 in (51 mm) | 0° |
| Turret top | 1.0 in (25 mm) | 90° |

| Armament item | Value | Status |
|---|---|---|
| Main gun | 75 mm Gun M3 (L/40) in M34/M34A1 mount (ammo & penetration: A1) | [V] G75 |
| Rate of fire | 20 rds/min listed in US gun data sheet | [V] DS |
| Ammo stowage | ≈90 rds (M4A1, dry stowage); wet-stowage 75 mm hulls such as M4A3(75)W ≈104 rds | [R?] |
| Elevation | +25° / −12° (some sources −10°) | [R?] |
| Traverse | hydraulic (Oilgear) or electric, ≈15 s per 360° (≈24°/s); manual crank backup (rate NOT retrieved) | [R?] |
| Stabilizer | Westinghouse gyrostabilizer, elevation only | [R] |
| Sights | telescope M70F (≈3×) + periscope M4/M4A1 with telescope M38 (≈1.44×) | [R?] |
| MGs | M2HB .50 AA (≈300 rds); 2 × M1919A4 .30 coax & bow (≈4,750 rds) | [R?] |
| M3 gun penetration headline | "73 mm at 1,000 m with M61 APCBC" | [V] W |

### B2.3 M4A3(76)W (VVSS) and B2.4 M4A3E8 / M4A3(76)W HVSS "Easy Eight"
Sources: W = https://en.wikipedia.org/wiki/M4_Sherman · G76 = https://en.wikipedia.org/wiki/76_mm_gun_M1 · HG = https://heroesandgenerals.fandom.com/wiki/Vehicles (E8 is in H&G as "M4A3E8 Sherman Easy 8"; the VVSS M4A3(76)W is not in the H&G game data)

| Item | M4A3(76)W VVSS | M4A3E8 (HVSS) | Status |
|---|---|---|---|
| Combat weight | ≈71,000–74,000 lb (≈32–33.7 t): sources differ | ≈74,200 lb (≈33.7 t) | [R?] |
| Length (gun fwd) / width / height | ≈24 ft 8 in (7.52 m) / ≈8 ft 9.5 in (2.68 m) / ≈9 ft 9 in (2.97 m) | length & height ≈same; width ≈9 ft 10 in (≈2.99 m) with 23-in tracks | [R?] |
| Crew | 5 | 5 | [R] |
| Engine | Ford GAA V-8, 1,100 cu in (18.0 L), liquid-cooled DOHC, gasoline | same | [R] W |
| Power | 500 hp gross / 450 hp net @ 2,600 rpm | same | [R] W |
| Torque | ≈1,040 lb-ft (1,410 N·m) gross @ 2,200 rpm; ≈950 lb-ft (1,288 N·m) net @ ≈2,100 rpm | same | [R?] |
| Gearbox / steering | 5F/1R synchromesh, controlled differential (see common data); no pivot turn | same | [R] |
| Speed | ≈26 mph (42 km/h) sustained, ≈30 mph short | same | [R?] |
| Fuel / range | 168 US gal (636 L) / ≈100 mi (160 km) | same | [R] |
| Suspension | VVSS | HVSS (horizontal volute springs, dual wheels, shock absorbers) | [R] |
| Track width | 16.56 in (421 mm) | 23 in (584 mm), T66/T80/T84 | [R] |
| Ground pressure | ≈14 psi [R?] | ≈11 psi (≈0.77 kg/cm²) [R?] | [R?] |

Armour (both; thickness / angle from vertical):

| Location | Value | Status |
|---|---|---|
| Upper hull front | 2.5 in (64 mm) at 47° | [R] |
| Lower hull front (one-piece cast nose) | 2.0–4.25 in (51–108 mm) at 0°–56° | [R?] |
| Hull sides | 1.5 in (38 mm) at 0° | [R] |
| Hull rear | 1.5 in (38 mm) at ≈0°–20° | [R?] |
| Top / floor | 0.75 in (19 mm) / 1.0 in front, 0.5 in rear | [R] |
| Turret front (T23 turret) | ≈3.5 in (89 mm) cast | [R?] |
| Gun shield (M62 mount) | 3.5 in (89 mm) | [R] |
| Turret sides / rear | ≈2.5 in (64 mm) at 0°–13° / ≈2.5 in (64 mm) | [R?] |
| Turret top | 1.0 in (25 mm) | [R] |

| Armament item | Value | Status |
|---|---|---|
| Main gun | 76 mm Gun M1A1 / M1A1C / M1A2 in M62 mount (A2) | [V] G76 |
| Ammo stowage | ≈71 rds 76 mm | [R] |
| Elevation | ≈+25° / −10° | [R?] |
| Traverse | hydraulic (Oilgear) + manual; ≈15 s per 360° | [R?] |
| Stabilizer | Westinghouse gyrostabilizer, elevation | [R] |
| Sights | NOT reliably retrieved (telescope M71-series + periscope M4A1 commonly cited) |: |
| MGs | M2HB .50 AA; 2 × M1919A4 (coax, bow) | [R] |

### B2.5 M10 Wolverine (3-inch GMC M10; diesel M4A2-based hull)
Sources: W = https://en.wikipedia.org/wiki/M10_tank_destroyer · HG = https://heroesandgenerals.fandom.com/wiki/Vehicles (in H&G as "M10 Tank Destroyer")

| Item | Value | Status |
|---|---|---|
| Combat weight | ≈29.5–29.9 t (≈65,000 lb) | [R?] W |
| L / W / H | ≈6.83 m with gun (5.97 m hull) / 3.05 m (10 ft) / ≈2.5–2.9 m (sources differ: to turret top vs over AA MG) | [R?] |
| Crew | 5: commander, gunner, loader, driver, assistant driver | [R] |
| Engine | twin GM 6-71 (6046) 2-stroke diesels, ≈375 hp net @ 2,100 rpm combined (M10A1: Ford GAA petrol, 450 hp net) | [R] W |
| Torque | NOT retrieved |: |
| Gearbox / steering | 5F/1R synchromesh, controlled differential, no pivot | [R] |
| Speed / range | ≈30 mph (48 km/h) / ≈200 mi (320 km) | [R?] |
| Suspension / track | VVSS / 16.56 in | [R] |
| Upper hull front | 1.5 in (38 mm) at 55° | [R] |
| Lower hull front | 2.0 in (51 mm) cast, 0°–56° | [R?] |
| Hull sides | upper 0.75 in (19 mm) at 38°; lower 1.0 in (25 mm) at 0° | [R] |
| Hull rear / top / floor | ≈0.75 in (19 mm) at 38° / 0.75 in / 0.5 in | [R?] |
| Turret | open-topped; front ≈2.25 in (57 mm) at ≈45°; gun shield ≈2.25 in; sides ≈1 in (25 mm) at 20°; rear ≈1 in + counterweights | [R?] |
| Bolt-on appliqué | bosses for extra hull plates fitted | [R] |
| Main gun | 3-inch Gun M7 (A3); 54 rds | [R] |
| Elevation | ≈+19° / −10° | [R?] |
| Traverse | manual (hand-cranked, 2-speed): notoriously slow; rate NOT retrieved | [R?] |
| MG | M2HB .50 on turret rear | [R] |

### B2.6 M18 Hellcat (76 mm GMC M18)
Sources: W = https://en.wikipedia.org/wiki/M18_Hellcat (infobox + text retrieved via search this session)

| Item | Value | Status |
|---|---|---|
| Combat weight | ≈17 t (≈37,500 lb) with crew; prose elsewhere in article says "about 20 tons" (inconsistent) | [V] W |
| Length | 5.28 m hull / 6.65 m with gun | [V] W |
| Width / height | 2.87 m / 2.57 m | [V] W |
| Crew | 5 | [V] W |
| Engine | Continental R975-C1 350 hp; supercharged R975-C4 400 hp from serial 1351 (article prose calls it "Wright R-975") | [V] W |
| Power-to-weight | ≈20.5–23.5 hp/t | [V] W |
| Transmission | 900T "Torqmatic" (torque converter) 3F/1R; cruising ≈12 / 25 / 45 mph in the three gears | [V] W |
| Steering | controlled differential (no pivot) | [R] |
| Speed | ≈55 mph (89 km/h) road / ≈26 mph (42 km/h) off-road | [V] W |
| Range | ≈100 mi (160 km) road | [V] W |
| Suspension | torsion bar | [V] W |
| Track | ≈14.4 in (366 mm) single-pin | [R?] |
| Armour (range) | 4.8–25.4 mm ("small-arms protection only") | [V] W |
| Armour detail | hull front ≈0.5 in (12.7 mm) steeply sloped; turret front ≈1 in (25.4 mm) at ≈23°; open-topped turret | [R?] |
| Main gun / ammo | 76 mm M1A1/M1A1C/M1A2 (A2); 45 rds | [V] W |
| MG | .50 cal M2HB, 800 rds | [V] W |
| Elevation / traverse | ≈+19.5° / −10°; hydraulic + manual (rates NOT retrieved) | [R?] |

### B2.7 M36 Jackson (90 mm GMC M36; M10A1/M4A3 hull)
Sources: W = https://en.wikipedia.org/wiki/M36_tank_destroyer · HG = H&G Vehicles/namu (listed as heavy TD)

| Item | Value | Status |
|---|---|---|
| Combat weight | ≈28–29 t (≈62,000–64,000 lb) | [R?] W |
| L / W / H | ≈7.47 m with gun / 3.05 m / ≈2.72 m | [R?] |
| Crew | 5 | [R] |
| Engine | Ford GAA V-8 gasoline, 450 hp net / 500 hp gross @ 2,600 rpm (M36B2: twin GM 6-71 diesel) | [R] W |
| Gearbox / steering | 5F/1R synchromesh + controlled differential, no pivot | [R] |
| Speed / range | ≈30 mph (48 km/h) / ≈150 mi (240 km) | [R?] |
| Suspension | VVSS, 16.56 in track | [R] |
| Hull armour | as M10A1: glacis 1.5 in (38 mm) at 55°; sides 0.75 in (19 mm) at 38° | [R] |
| Turret armour | open-topped; cast front/gun shield ≈3 in (76 mm); sides ≈1.25 in (32 mm) at ≈5° | [R?] |
| Main gun / ammo | 90 mm Gun M3 (A4) in M4/M4A1 mount; 47 rds | [R] |
| Elevation / traverse | ≈+20° / −10°; hydraulic + manual (rates NOT retrieved) | [R?] |
| MG | M2HB .50 | [R] |

### B2.8 M26 Pershing
Sources: W = https://en.wikipedia.org/wiki/M26_Pershing · HG = https://heroesandgenerals.fandom.com/wiki/Vehicles ("heavy armor"; "90 mm gun"; "slowest tank in the game off-road": game claim)

| Item | Value | Status |
|---|---|---|
| Combat weight | 41.9 t (46.2 short tons) | [R] W |
| L / W / H | 8.65 m (28 ft 4.5 in) with gun, 6.33 m hull / 3.51 m (11 ft 6 in) / 2.78 m (9 ft 1.5 in) | [R] W |
| Crew | 5 | [R] W |
| Engine | Ford GAF V-8, 18.0 L, gasoline; 500 hp gross / 450 hp net @ 2,600 rpm | [R] W |
| Torque | ≈1,040 lb-ft gross @ 2,200 rpm | [R?] |
| Transmission | GM Torqmatic: torque converter + 3F/1R planetary | [R] W |
| Steering | controlled differential (no pivot) | [R?] |
| Speed | ≈25–30 mph (40–48 km/h) road (sources differ); Wikipedia infobox lists ≈5 mph (8.4 km/h) off-road | [R?] W |
| Range / fuel | ≈100 mi (160 km) / ≈183 US gal | [R?] |
| Suspension / track | torsion bar, 6 road wheels/side / 24 in (610 mm) T80E1 | [R] / track [R?] |
| Upper hull front | 4 in (102 mm) at 46° | [R] |
| Lower hull front | 3 in (76 mm) at 53° | [R] |
| Hull sides | 3 in (76 mm) forward / 2 in (51 mm) rear, vertical | [R?] |
| Hull rear / top / floor | ≈2 in (51 mm) upper rear / 0.875 in (22 mm) / 1 in front, 0.5 in rear | [R?] |
| Gun shield (mantlet) | 4.5 in (114 mm) | [R] |
| Turret front / sides / rear / top | 4 in (102 mm) / 3 in (76 mm) / 3 in (76 mm) / 1 in (25 mm) | [R?] |
| Main gun / ammo | 90 mm Gun M3 in M67 mount (A4); 70 rds | [R] W |
| Elevation / traverse | ≈+20° / −10°; hydraulic + manual (rates NOT retrieved) | [R?] |
| MGs | M2HB .50 AA; 2 × M1919A4 (coax, bow) | [R] W |

---

## B3. Germany: tanks, assault guns and tank destroyers

No German vehicle page could be opened or searched this session (search budget exhausted before this block). Everything below is [R]/[R?] baseline unless marked [V]; verify against Jentz & Doyle *Panzer Tracts*, panzerworld.com, the D-manuals (e.g. D 656/27 "Tigerfibel", D 655/27 "Pantherfibel" [R?] numbers) and Wikipedia before use. Angles are from vertical.

### B3.1 Panzer III Ausf. J (incl. J/1 with 5 cm L/60) and Ausf. M
Sources: W = https://en.wikipedia.org/wiki/Panzer_III · PW = https://www.panzerworld.com/ (site search: Panzer III) · HG = https://heroesandgenerals.fandom.com/wiki/Panzer_III_J/1 (H&G has the J/1 with "50mm KwK 39 L/60" [V])

| Item | Value | Status |
|---|---|---|
| Combat weight | Ausf. J ≈21.5 t; J/1 ≈21.5–22 t; Ausf. M ≈22.7 t | [R?] W/PW |
| L / W / H | hull 5.52 m (≈6.3–6.4 m with L/60 gun) / ≈2.95 m (≈3.27 m with Schürzen, M) / ≈2.50 m | [R?] |
| Crew | 5: commander, gunner, loader, driver, radio operator/hull MG | [R] |
| Engine | Maybach HL 120 TRM V-12, 11.9 L, petrol; 300 PS @ 3,000 rpm max, ≈265 PS @ 2,600 rpm continuous | [R] W |
| Torque | NOT retrieved |: |
| Transmission | Maybach SSG 77, 6F/1R synchromesh | [R] |
| Steering | clutch-brake via epicyclic steering units; no true neutral steer | [R?] |
| Speed | 40 km/h road / ≈18–20 km/h off-road | [R] W |
| Range / fuel | ≈155 km road, ≈95 km off-road / ≈320 L | [R?] |
| Suspension | torsion bar, 6 road wheels per side | [R] W |
| Track / ground pressure | 400 mm / ≈0.94 kg/cm² | [R?] |

| Armour location | Ausf. J / J/1 | Ausf. M (differences) | Status |
|---|---|---|---|
| Hull nose (lower front) | 50 mm at ≈21° | same | [R?] |
| Superstructure front (driver's plate) | 50 mm at ≈9° | + 20 mm spaced plate | [R?] |
| Hull / superstructure sides | 30 mm, vertical | + 5 mm Schürzen | [R] |
| Rear | 50 mm at ≈10° | same | [R?] |
| Top / floor | ≈18 mm / ≈16 mm | same | [R?] |
| Turret front | 57 mm at ≈15° | same | [R?] |
| Mantlet | 50 mm | + 20 mm spaced plate | [R] |
| Turret sides / rear | 30 mm at 25° / 30 mm at ≈12° | + ≈8 mm turret Schürzen | [R?] |
| Turret top | 10 mm | same | [R] |

| Armament item | Value | Status |
|---|---|---|
| Main gun | 5 cm KwK 39 L/60 (J/1, L, M): early J: 5 cm KwK 38 L/42 (see A6) | [V] HG for J/1; [R] |
| Ammo stowage | ≈84–98 rds depending on sub-variant | [R?] |
| Elevation | ≈+20° / −10° | [R?] |
| Traverse | manual only (hand wheels); rate NOT retrieved | [R] |
| Sight | TZF 5e (2.5×) | [R?] |
| Stabilizer | none | [R] |
| MGs | 2 × MG 34 (coax, hull ball mount) | [R] |

### B3.2 Panzer IV Ausf. G and Ausf. H
Sources: W = https://en.wikipedia.org/wiki/Panzer_IV · PW = https://www.panzerworld.com/ (site search: Panzer IV) · HG = https://heroesandgenerals.fandom.com/wiki/Panzer_IV_Ausf._H (H&G: "KwK40 L/48 75mm", "side skirts" [V])

| Item | Ausf. G | Ausf. H | Status |
|---|---|---|---|
| Combat weight | ≈23.5 t | ≈25 t | [R] W |
| L / W / H |: | 7.02 m with gun (≈5.9 m hull) / 2.88 m (3.29 m with Schürzen) / 2.68 m | [R?] |
| Crew | 5 | 5 | [R] |
| Engine | HL 120 TRM, 300 PS @ 3,000 rpm max / ≈265 PS @ 2,600 rpm | same (HL 120 TRM 112) | [R] |
| Transmission | SSG 76, 6F/1R | SSG 77, 6F/1R | [R?] |
| Steering | clutch-brake (epicyclic steering brakes), no neutral steer | same | [R?] |
| Speed | ≈40 km/h road | ≈38 km/h road; ≈16–20 km/h off-road | [R] |
| Range / fuel | ≈210 km road | ≈210 km road / ≈130 km off-road; 470 L | [R] |
| Suspension | leaf-spring bogies (quarter-elliptic), 8 road wheels/side | same | [R] |
| Track / ground pressure | 400 mm | 400 mm / ≈0.89 kg/cm² | [R] / [R?] |

| Armour location | Ausf. H (thickness / angle) | Ausf. G difference | Status |
|---|---|---|---|
| Hull nose | 80 mm at ≈14° | 50 mm (+30 mm bolted on late G) | [R?] |
| Superstructure front | 80 mm at ≈10° | 50 mm (+30 mm bolted) | [R?] |
| Glacis (between nose and superstructure) | ≈20–25 mm at ≈72° | same | [R?] |
| Sides | 30 mm vertical (+5 mm Schürzen) | 30 mm | [R] |
| Rear | 20 mm at ≈10° | same | [R?] |
| Top / floor | 10–16 mm / 10 mm | same | [R?] |
| Turret front | 50 mm at ≈11° | same | [R] |
| Mantlet | 50 mm | same | [R] |
| Turret sides / rear | 30 mm at 25° / 30 mm at ≈15° (+8 mm turret Schürzen) | same | [R?] |
| Turret top | 10–16 mm | same | [R?] |

| Armament item | Value | Status |
|---|---|---|
| Main gun | 7.5 cm KwK 40 L/43 (early G) or L/48 (late G, H) (A6) | [V] HG for H |
| Ammo stowage | ≈87 rds | [R] |
| Elevation | ≈+20° / −10° | [R?] |
| Traverse | electric (auxiliary 2-stroke generator) + manual; rates NOT retrieved | [R] / rates: |
| Sight | TZF 5f / 5f1 (2.5×) | [R?] |
| MGs | 2 × MG 34 (coax, hull) | [R] |

### B3.3 StuG III Ausf. G
Sources: W = https://en.wikipedia.org/wiki/Sturmgesch%C3%BCtz_III (H&G instead lists StuG III Ausf. F [V] https://heroesandgenerals.fandom.com/wiki/Tank_Crew)

| Item | Value | Status |
|---|---|---|
| Combat weight | ≈23.9 t | [R] W |
| L / W / H | 6.77 m with gun / 2.95 m / 2.16 m | [R] W |
| Crew | 4: commander, gunner, loader/radio, driver | [R] |
| Engine / transmission | HL 120 TRM 300 PS / SSG 77 6F/1R | [R] / [R?] |
| Speed / range | 40 km/h road, ≈20 km/h off-road / ≈155 km | [R] W |
| Suspension | torsion bar, 6 road wheels | [R] |
| Front (hull & superstructure) | 80 mm (50 + 30 mm bolted, later 80 mm single plate), near-vertical to ≈20° | [R?] |
| Sides / rear / top | 30 mm / ≈50 mm / ≈10–17 mm | [R?] |
| Mantlet | Topfblende (box) or cast "Saukopf" ≈45–50 mm | [R?] |
| Main gun / ammo | 7.5 cm StuK 40 L/48 (A6) / 54 rds | [R] W |
| Traverse / elevation | ≈10° left & right (manual) / ≈−6° … +20° | [R?] |
| Sight | Sfl.ZF 1a periscope (5×) | [R?] |
| MG | MG 34 on roof (shielded; later remote) | [R] |

### B3.4 Panther Ausf. A / Ausf. G
Sources: W = https://en.wikipedia.org/wiki/Panther_tank · PW = https://www.panzerworld.com/ (site search: Panther) · HG = https://heroesandgenerals.fandom.com/wiki/Vehicles (H&G: "Panzer V Ausf. G", 75 mm, armour 16–110 mm [V] – game values)

| Item | Ausf. A | Ausf. G | Status |
|---|---|---|---|
| Combat weight | ≈45.5 t | ≈44.8 t | [R] W |
| L / W / H | 6.87 m hull, 8.66 m with gun / 3.27 m (3.42 m with skirts) / ≈2.99 m | same | [R] W |
| Crew | 5 | 5 | [R] |
| Engine | Maybach HL 230 P30 V-12, 23.1 L, petrol; 700 PS @ 3,000 rpm max, governed ≈600 PS @ 2,500 rpm | same | [R] W |
| Transmission | ZF AK 7-200, 7F/1R synchromesh | same | [R] W |
| Steering | MAN single-radius regenerative steering gear (fixed radius per gear) with auxiliary clutch-brakes; neutral (pivot) turn capability: sources disagree, NOT confirmed | same | [R?] |
| Speed | ≈46 km/h road (Ausf. D ≈55 km/h); off-road ≈24 km/h | same | [R?] |
| Range / fuel | ≈200 km road, ≈100 km off-road / ≈720–730 L | same | [R?] |
| Suspension | double torsion bars, interleaved road wheels (8/side, 860 mm) | same | [R] |
| Track / ground pressure | 660 mm / ≈0.88 kg/cm² | same | [R] / [R?] |

| Armour location | Ausf. A | Ausf. G | Status |
|---|---|---|---|
| Upper hull front | 80 mm at 55° | 80 mm at 55° | [R] |
| Lower hull front | 60 mm at 55° | ≈50–60 mm at 55° (sources differ) | [R?] |
| Upper hull sides | 40 mm at 40° | 50 mm at 30° | [R] |
| Lower hull sides | 40 mm vertical | 40 mm vertical | [R] |
| Rear | 40 mm at 30° | 40 mm at 30° | [R] |
| Top / floor | 16 mm / 16 mm (≈30 mm front floor section) | 16 mm (later up to 40 mm on parts of roof [R?]) | [R?] |
| Turret front | ≈100–110 mm at ≈10–12° | same | [R?] |
| Mantlet | 100 mm curved | 100 mm; late G "chin" mantlet | [R] |
| Turret sides / rear | 45 mm at 25° / 45 mm at 25° | same | [R] |
| Turret top | 16 mm | 16 mm (later ≈30 mm [R?]) | [R?] |

| Armament item | Value | Status |
|---|---|---|
| Main gun | 7.5 cm KwK 42 L/70 (A6) | [R] W; [V] HG "75mm" |
| Ammo stowage | A ≈79 rds; G ≈82 rds | [R] |
| Elevation | +18° / −8° | [R] |
| Traverse | hydraulic, engine-driven, speed varies with rpm (Ausf. A/G ≈15–18 s per 360° at high rpm; Ausf. D much slower); manual backup | [R?] |
| Sight | TZF 12 binocular (2.5×) on D/early A; TZF 12a monocular (2.5×/5×) on later A and G | [R?] |
| Stabilizer | none | [R] |
| MGs | 2 × MG 34 (coax; bow ball mount Kugelblende 50 on A/G) | [R] |

### B3.5 Tiger I (Pz.Kpfw. VI Ausf. E)
Sources: W = https://en.wikipedia.org/wiki/Tiger_I · PW = https://www.panzerworld.com/ (site search: Tiger I) · HG = https://heroesandgenerals.fandom.com/wiki/Vehicles (H&G: heavy armor, 88 mm, 20–120 mm [V] – game values) · Tigerfibel = D 656/27 (https://en.wikipedia.org/wiki/Tigerfibel)

| Item | Value | Status |
|---|---|---|
| Combat weight | ≈54 t (early) / ≈57 t (late) | [R] W |
| L / W / H | 6.316 m hull, 8.45 m with gun / 3.56 m (combat tracks) / 3.00 m | [R] W |
| Crew | 5 | [R] |
| Engine | Maybach HL 210 P45 (650 PS, first ≈250 built) then HL 230 P45 V-12 23.1 L petrol, 700 PS @ 3,000 rpm (service rpm governed lower) | [R] W |
| Transmission | Maybach OLVAR OG 40 12 16 semi-automatic preselector, 8F/4R | [R] W |
| Steering | Henschel L 600 C regenerative (double-differential type) with steering wheel; **can neutral-steer (pivot) in neutral** | [R] |
| Turning radius | ≈3.4 m in 1st gear … ≈165 m in 8th (per-gear fixed radii) | [R?] |
| Speed | ≈45 km/h road (early), ≈38–40 km/h later (governed); ≈20–25 km/h off-road | [R] W |
| Range / fuel | ≈110–195 km road / ≈534–540 L | [R?] |
| Suspension | torsion bar, interleaved/overlapping 800 mm road wheels | [R] |
| Track | 725 mm combat / 520 mm transport | [R] |
| Ground pressure | ≈1.04 kg/cm² (other figures circulate) | [R?] |

| Armour location | Thickness / angle | Status |
|---|---|---|
| Hull nose (lower front) | 100 mm at ≈25° | [R?] |
| Superstructure front (driver's plate) | 100 mm at ≈10° | [R?] |
| Glacis (top of nose) | 60 mm, steeply sloped (≈80°) | [R?] |
| Upper side (superstructure) | 80 mm vertical | [R] |
| Lower hull side (behind wheels) | 60 mm vertical | [R] |
| Rear | 80 mm at ≈9° | [R?] |
| Top / floor | 25 mm / 25 mm | [R] |
| Turret front | 100 mm | [R] |
| Mantlet | ≈100–120 mm (often given 110 mm) | [R?] |
| Turret sides / rear | 80 mm vertical / 80 mm | [R] |
| Turret roof | 25 mm (40 mm on late production) | [R] |

| Armament item | Value | Status |
|---|---|---|
| Main gun | 8.8 cm KwK 36 L/56 (A6) | [R] W; [V] HG "88mm" |
| Ammo stowage | ≈92 rds | [R] |
| Elevation | ≈−8° / +15° (other sources −6.5° / +17°) | [R?] |
| Traverse | hydraulic, engine-driven: ≈60 s per 360° at 2,000 rpm (faster at higher rpm); manual handwheel ≈720 turns per 360° | [R?] |
| Sight | TZF 9b binocular (2.5×); later TZF 9c monocular (2.5×/5×) | [R?] |
| MGs | 2 × MG 34 (coax, hull) | [R] |

### B3.6 Jagdpanzer 38(t) "Hetzer"
Sources: W = https://en.wikipedia.org/wiki/Jagdpanzer_38(t) · HG namu/official listing [V]: Hetzer is in H&G as German tank destroyer

| Item | Value | Status |
|---|---|---|
| Combat weight | ≈15.75–16 t | [R] W |
| L / W / H | 6.38 m with gun, 4.87 m hull / 2.63 m / 2.17 m | [R] W |
| Crew | 4: commander, gunner, loader, driver | [R] |
| Engine | Praga AC/2, 6-cyl 7.75 L petrol, 160 PS @ 2,800 rpm (often run at ≈150 PS) | [R] W |
| Transmission / steering | Praga-Wilson epicyclic preselector 5F/1R; Wilson-type epicyclic clutch-brake steering | [R?] |
| Speed / range | 42 km/h road / ≈177 km | [R] W |
| Suspension | leaf springs, 4 large road wheels per side | [R] |
| Track | ≈350 mm | [R?] |
| Upper front / lower front | 60 mm at 60° / 60 mm at 40° | [R] |
| Sides | ≈20 mm at ≈40° (upper) / ≈15–20 mm lower | [R?] |
| Rear / top / floor | ≈8 mm / ≈8 mm / ≈10 mm | [R?] |
| Mantlet | "Saukopf" ≈60 mm cast | [R?] |
| Main gun / ammo | 7.5 cm PaK 39 L/48 (A6) / ≈41 rds | [R] |
| Traverse / elevation | ≈5° left, ≈11° right / ≈−6° … +12° | [R?] |
| Sight | Sfl.ZF 1a (5×) | [R?] |
| MG | MG 34/42 remote-controlled on roof | [R] |

### B3.7 Marder III (Sd.Kfz. 138 Ausf. H / Ausf. M; Sd.Kfz. 139 with 7.62 cm PaK 36(r))
Sources: W = https://en.wikipedia.org/wiki/Marder_III (not verified). NOTE: the Marder III is **not** in the H&G game-data vehicle list (section 1).

| Item | Value (Ausf. M unless stated) | Status |
|---|---|---|
| Combat weight | ≈10.5 t | [R] W |
| L / W / H | ≈4.95 m / ≈2.15 m / ≈2.48 m | [R?] |
| Crew | 4 | [R] |
| Engine | Praga AC 6-cyl petrol ≈150–160 PS (Ausf. H: Praga TNHPS/II ≈140 PS) | [R?] |
| Speed | ≈42 km/h | [R?] |
| Armour | ≈10–20 mm (front ≈15–20 mm), open-topped fighting compartment | [R?] |
| Main gun / ammo | 7.5 cm PaK 40/3 L/46 (A6) / ≈27 rds | [R?] |
| Everything else | NOT retrieved |: |

---

## B4. USSR: tanks and self-propelled guns

No Soviet vehicle page could be opened or searched this session. All values are [R]/[R?] baseline; verify against Wikipedia, Zaloga (Osprey New Vanguard), tankarchives.blogspot.com and Soviet manuals before use. Angles from vertical.

### B4.1 T-70 (Model 1942) / T-70M
Sources: W = https://en.wikipedia.org/wiki/T-70 · HG: "T-70 Model 1942" is in H&G as SU light armor [V] https://heroesandgenerals.fandom.com/wiki/Vehicles

| Item | Value | Status |
|---|---|---|
| Combat weight | ≈9.2 t (T-70) / ≈9.8 t (T-70M) | [R] W |
| L / W / H | ≈4.29 m / ≈2.32 m / ≈2.04 m | [R] W |
| Crew | 2: driver; commander who also aims and loads the gun | [R] W |
| Engines | 2 × GAZ-202 6-cyl petrol in tandem, ≈70 hp each (≈140 hp total) | [R?] W |
| Transmission / steering | 4F/1R; clutch-brake steering | [R?] |
| Speed / range | ≈45 km/h road / ≈250–360 km | [R] / [R?] |
| Suspension | torsion bar, 5 road wheels/side | [R] W |
| Armour (range) | ≈10–60 mm | [R] W |
| Armour detail | hull front ≈35–45 mm sloped; sides ≈15 mm; turret ≈35 mm; mantlet up to ≈60 mm | [R?] |
| Main gun / ammo | 45 mm 20-K mod. 1938 (A7) / ≈70–90 rds | [R] / [R?] |
| Traverse | manual | [R] |
| MG | 7.62 mm DT coax | [R] |

### B4.2 T-34/76 (Model 1942 and Model 1943)
Sources: W = https://en.wikipedia.org/wiki/T-34 · HG: "T-34/76" in H&G [V] https://heroesandgenerals.fandom.com/wiki/Category:Vehicles

| Item | Value | Status |
|---|---|---|
| Combat weight | ≈28.5–30.9 t (1942–43 production; 1940 model 26.5 t) | [R?] W |
| L / W / H | 5.92 m hull, 6.68 m with gun / 3.00 m / 2.45 m | [R] W |
| Crew | 4: commander (also gunner), loader, driver, radio operator/bow gunner | [R] W |
| Engine | V-2-34 V-12 diesel, 38.9 L; 500 hp @ 1,800 rpm max (≈450 hp nominal) | [R] W |
| Torque | NOT retrieved |: |
| Gearbox | dry multi-plate main clutch; 4F/1R (to early 1943), 5F/1R (from ≈spring 1943) | [R] W |
| Steering | lateral (side) clutches + band brakes (clutch-brake); can pivot about one braked track | [R] |
| Speed | ≈53–55 km/h road | [R] W |
| Range / fuel | ≈300–400 km road (with external tanks) / ≈460–540 L internal | [R?] |
| Suspension | Christie (coil springs in hull sides), 5 large road wheels/side | [R] W |
| Track / ground pressure | 550 mm / ≈0.72–0.83 kg/cm² | [R] / [R?] |
| Upper glacis | 45 mm at 60° | [R] |
| Lower front | 45 mm at ≈53° | [R] |
| Upper hull sides | 40–45 mm at 40° | [R?] |
| Lower hull sides | 45 mm vertical | [R] |
| Rear | ≈40 mm at ≈45–47° | [R?] |
| Top / floor | ≈16–20 mm / ≈13–16 mm | [R?] |
| Turret (1942–43 cast "hexagonal") front / mantlet / sides / rear / top | ≈52–70 mm (factory-dependent) / ≈40–45 mm / ≈52 mm at ≈20–30° / ≈52 mm / ≈15–20 mm: LOW confidence | [R?] |
| Main gun | 76.2 mm F-34 (A7) | [R] W |
| Ammo stowage | ≈77 rds (early) / ≈100 rds (1942–43 hexagonal turret) | [R?] |
| Elevation | ≈+25°…+30° / −5° | [R?] |
| Traverse | electric + manual; rates NOT retrieved | [R] |
| Sights | TMFD-7 telescope (2.5×) and PT-4-7 periscope (2.5×) | [R?] |
| MGs | 2 × 7.62 mm DT (coax, bow) | [R] |

### B4.3 T-34/85 (1944)
Sources: W = https://en.wikipedia.org/wiki/T-34 · https://en.wikipedia.org/wiki/T-34-85 · HG [V] T-34/85 is in H&G

| Item | Value | Status |
|---|---|---|
| Combat weight | ≈32 t | [R] W |
| L / W / H | ≈8.15 m with gun (≈6.1 m hull) / 3.00 m / ≈2.72 m | [R?] |
| Crew | 5: commander, gunner, loader, driver, radio operator/bow gunner | [R] W |
| Engine / gearbox / steering | V-2-34 500 hp; 5F/1R; side clutches + brakes | [R] |
| Speed / range | ≈55 km/h / ≈300–360 km | [R?] |
| Suspension / track | Christie / 550 mm | [R] |
| Hull armour | as T-34/76 (45 mm at 60° glacis) | [R] |
| Turret front / mantlet / sides / rear / top | 90 mm / ≈40 mm (gun mantlet) / ≈75 mm at ≈20° / ≈52 mm / ≈20 mm | [R] front; others [R?] |
| Main gun / ammo | 85 mm ZiS-S-53 (early: D-5T) (A7) / ≈55–60 rds | [R] |
| Elevation | ≈+22° / −5° | [R?] |
| Traverse | electric (MB-20V motor) + manual; rates NOT retrieved | [R?] |
| Sights | TSh-16 telescope (4×); PT-4-17 periscope | [R?] |
| MGs | 2 × DT | [R] |

### B4.4 SU-76M
Sources: W = https://en.wikipedia.org/wiki/SU-76 · HG [V] "SU-76M … tank destroyer with a 76.2mm cannon" https://heroesandgenerals.fandom.com/wiki/Vehicles

| Item | Value | Status |
|---|---|---|
| Combat weight | ≈10.5–10.6 t | [R] W |
| L / W / H | ≈5.0 m / ≈2.72 m / ≈2.1–2.2 m | [R?] |
| Crew | 4 | [R] |
| Engines | 2 × GAZ-203 (GAZ-202 type) petrol: total quoted as ≈140 hp or ≈170 hp (sources disagree) | [R?] |
| Speed / range | ≈45 km/h / ≈250–320 km | [R] / [R?] |
| Suspension | torsion bar, 6 road wheels/side | [R] |
| Armour | ≈25–35 mm front, ≈10–15 mm sides, open top/rear | [R?] |
| Main gun / ammo | 76.2 mm ZiS-3Sh (A7) / ≈60 rds | [V] HG calibre; ammo [R] |
| Traverse / elevation | ≈±15° / ≈−5° … +25° | [R?] |

### B4.5 SU-85
Sources: W = https://en.wikipedia.org/wiki/SU-85 · HG [V] SU-85 is in H&G as tank destroyer

| Item | Value | Status |
|---|---|---|
| Combat weight | ≈29.6 t | [R] W |
| L / W / H | ≈8.15 m / 3.00 m / ≈2.45 m | [R] W |
| Crew | 4 | [R] |
| Engine / drivetrain | V-2-34 500 hp; T-34 drivetrain | [R] |
| Speed / range | ≈47–55 km/h / ≈400 km | [R?] |
| Armour | superstructure front 45 mm at ≈50°; sides ≈45 mm; mantlet ≈60 mm | [R?] |
| Main gun / ammo | 85 mm D-5S (A7) / ≈48 rds | [R] |
| Traverse / elevation | ≈±10° / ≈−5° … +25° | [R?] |
| Sight | TSh-15 (4×) | [R?] |

### B4.6 SU-100
Sources: W = https://en.wikipedia.org/wiki/SU-100 · HG [V] https://heroesandgenerals.fandom.com/wiki/SU-100 ("hardest-hitting heavy TD", "poor gun depression", "no coaxial MG" – game wiki)

| Item | Value | Status |
|---|---|---|
| Combat weight | ≈31.6 t | [R] W |
| L / W / H | ≈9.45 m with gun, ≈6.1 m hull / 3.00 m / ≈2.25 m | [R] W |
| Crew | 4 | [R] |
| Engine / drivetrain | V-2-34(M) ≈500–520 hp; 5F/1R T-34 drivetrain | [R?] |
| Speed / range | ≈48 km/h / ≈310 km | [R] W |
| Armour | front 75 mm at ≈50°; sides ≈45 mm; mantlet ≈110 mm | [R?] |
| Main gun / ammo | 100 mm D-10S (A7) / 33 rds | [R] W |
| Traverse / elevation | ≈±8° / ≈−3° … +20° | [R?] |
| Sight | TSh-19 (4×) | [R?] |
| MG | none fixed (crew weapons) | [V] HG "no coaxial MG" |

### B4.7 IS-2 (Model 1944)
Sources: W = https://en.wikipedia.org/wiki/IS-2 · HG [V] "IS-2 Model 1944" heavy armor in H&G

| Item | Value | Status |
|---|---|---|
| Combat weight | ≈46 t | [R] W |
| L / W / H | ≈9.9 m with gun, ≈6.8 m hull / ≈3.07–3.09 m / ≈2.73 m | [R?] |
| Crew | 4: commander, gunner, loader, driver | [R] |
| Engine | V-2-IS (V-2K) V-12 diesel: ≈520 hp @ 2,000 rpm in most Russian sources; Wikipedia-type summaries also give 600 hp (disagreement) | [R?] |
| Transmission / steering | 4F/1R with 2-speed range multiplier (8F/2R); two-stage planetary steering mechanisms | [R?] |
| Speed / range | ≈37 km/h road / ≈240 km | [R] W |
| Suspension / track | torsion bar, 6 road wheels/side / ≈650 mm | [R] / [R?] |
| Upper front (1944 straightened glacis) | 120 mm at ≈60° | [R?] |
| Lower front | 100 mm at ≈30° | [R?] |
| Sides / rear / top / floor | ≈90 mm / ≈60 mm / ≈30 mm / ≈20 mm | [R?] |
| Turret front / mantlet / sides / rear / top | ≈100 mm (curved cast) / ≈100 mm / ≈90 mm at ≈20° / ≈90 mm / ≈30 mm | [R?] |
| Main gun / ammo | 122 mm D-25T L/43, separate loading (A7) / 28 rds | [R] W |
| Rate of fire | ≈1.5–3 rds/min | [R] |
| Elevation | ≈−3° / +20° | [R?] |
| Traverse | electric + manual; rates NOT retrieved | [R] |
| Sight | TSh-17 (4×) | [R?] |
| MGs | 3 × DT (coax, hull, turret rear) + DShK 12.7 mm AA | [R] |

---

## C. Heroes & Generals vehicles missing from your list: headline baseline

Presence in H&G is [V] (see section 1). Every technical value in this section is [R]/[R?] recall that was NOT verified this session; "check" gives the page to verify against. Detailed fields (ratios, per-plate angles, sights, traverse rates) were not attempted for these.

### C1. United States

| Vehicle | Weight / crew | Engine | Speed | Armour headline | Main armament | check |
|---|---|---|---|---|---|---|
| M2A2 light tank (twin turret) | ≈8.7 t [R?] / 4 | Continental W-670 radial ≈250 hp (some Guiberson T-1020 diesel) [R?] | ≈45 mph (72 km/h) [R?] | ≈6–16 mm [R?] | M2HB .50 + M1919A4 .30 in two turrets, plus hull MGs [R] | https://en.wikipedia.org/wiki/M2_light_tank |
| M24 Chaffee | ≈18.4 t / 4–5 | 2 × Cadillac 44T24 V-8, ≈110 hp net each (≈220 hp); twin Hydra-Matic + 2-speed transfer; controlled differential | ≈35 mph (56 km/h) | glacis ≈25 mm at 60°; turret front/mantlet ≈38 mm | 75 mm Gun M6 (M3 ballistics, see A1), ≈48 rds; Westinghouse elevation stabilizer [R] | https://en.wikipedia.org/wiki/M24_Chaffee |
| M3 Lee | ≈27 t / 6–7 | Continental R975-EC2/C1 radial, 400 hp gross (≈340 net) | ≈24 mph (39 km/h) | ≈51 mm front, ≈38 mm sides, ≈51 mm turret [R?] | 75 mm M2 (L/31) or M3 (L/40) in right sponson (≈±15° traverse) + 37 mm M5/M6 in turret [R] | https://en.wikipedia.org/wiki/M3_Lee |
| M4A3E2 "Jumbo" | ≈38 t / 5 | Ford GAA 500 hp gross / 450 net; final drive lowered, top speed ≈22 mph (35 km/h) | ≈22 mph | glacis 4 in (102 mm) at 47° (2.5 + 1.5 in); lower front ≈5.5 in (140 mm); sides 3 in (76 mm); turret 6 in (152 mm); gun shield 7 in (178 mm) [R] | 75 mm M3 (some field-refitted 76 mm M1) | https://en.wikipedia.org/wiki/M4_Sherman |
| M8 Greyhound (6x6) | ≈7.8 t / 4 | Hercules JXD I6 petrol ≈110 hp @ 3,000 rpm; 4F/1R + 2-speed transfer | ≈55 mph (89 km/h) | ≈3–19 mm (front ≈19 mm) [R?] | 37 mm M6 (A5) ≈80 rds, M1919A4 coax, M2HB AA [R] | https://en.wikipedia.org/wiki/M8_Greyhound |
| M20 Armored Utility Car | ≈7 t [R?] / 2–6 | as M8 | ≈55 mph | as M8 hull, open top | M2HB .50 on ring mount | https://en.wikipedia.org/wiki/M20_Armored_Utility_Car |
| "T8E1 Stuart Recce" | turretless M5-series reconnaissance vehicle [R?] | as M5A1 (B2.1) | ≈36 mph | as M5A1 hull | ring-mounted .50 cal [R?] | (game name; real-world data NOT retrieved) |
| Harley-Davidson WLA (42WLA) | ≈245 kg [R?] / 1 (+sidecar gunner) | 45 cu in (739 cc) side-valve V-twin ≈23.5 hp; 3-speed hand shift | ≈65 mph (105 km/h) [R?] |: | rider's weapons (sidecar MG in game) | https://en.wikipedia.org/wiki/Harley-Davidson_WLA |

### C2. Germany

| Vehicle | Weight / crew | Engine | Speed | Armour headline | Main armament | check |
|---|---|---|---|---|---|---|
| Panzer II Ausf. C | ≈8.9 t / 3 | Maybach HL 62 TR ≈140 PS | ≈40 km/h | 14.5 mm basic, ≈30–35 mm front with appliqué | 2 cm KwK 30 L/55 (≈180 rds) + MG 34 [R] ([V] game: "20 mm gun and MG34") | https://en.wikipedia.org/wiki/Panzer_II |
| Panzer II Ausf. L "Luchs" | ≈11.8 t / 4 | Maybach HL 66 P ≈180 PS; torsion bars, interleaved wheels | ≈60 km/h | front ≈30 mm, sides ≈20 mm | 2 cm KwK 38 + MG 34 [R] | https://en.wikipedia.org/wiki/Luchs_(tank) |
| Panzer 38(t) Ausf. E | ≈9.85 t / 4 | Praga EPA I6 ≈125 PS; leaf springs, 4 large wheels | ≈42 km/h | front 25 mm + 25 mm appliqué (≈50 mm) | 3.7 cm KwK 38(t) L/47.8 ([V] game "37.2 mm") + 2 × MG 37(t) | https://en.wikipedia.org/wiki/Panzer_38(t) |
| Tiger II (Ausf. B) | ≈68–70 t / 5 | HL 230 P30 700 PS; OLVAR 8F/4R; Henschel L 801 regenerative steering (neutral turn) [R?] | ≈41.5 km/h road | glacis 150 mm at 50°; lower 100 mm at 50°; sides 80 mm at 25°; production turret front 180 mm, sides 80 mm [R] ([V] game: "best frontal armor in the game") | 8.8 cm KwK 43 L/71 (A6), ≈80–86 rds | https://en.wikipedia.org/wiki/Tiger_II |
| Jagdpanther | ≈45.5 t / 5 | HL 230 P30 700 PS; AK 7-200 | ≈46 km/h | front 80 mm at 55°; sides 50 mm at 30°; mantlet ≈100–120 mm | 8.8 cm PaK 43/3 L/71 (A6), ≈57 rds; limited traverse ≈±11° [R?] | https://en.wikipedia.org/wiki/Jagdpanther |
| StuG III Ausf. F (H&G variant) | ≈21.6–23 t [R?] / 4 | HL 120 TRM 300 PS | ≈40 km/h | 50 mm + 30 mm bolted front (late F) [R?] | 7.5 cm StuK 40 L/43 (late F/8: L/48) | https://en.wikipedia.org/wiki/Sturmgesch%C3%BCtz_III |
| Sd.Kfz. 222 | ≈4.8 t / 3 | Horch V-8 petrol (3.5 L ≈75–81 PS, later 3.8 L ≈90 PS); 4x4, 4-wheel steering | ≈80–85 km/h | ≈8–14.5 mm (later 30 mm front) | 2 cm KwK 30/38 + MG 34 | https://en.wikipedia.org/wiki/Sd.Kfz._222 |
| Sd.Kfz. 234/2 "Puma" | ≈11.7 t / 4 | Tatra 103 V-12 air-cooled diesel ≈210–220 PS; 8x8, 8-wheel steering, driving positions both ends | ≈80–90 km/h | front ≈30 mm sloped; sides ≈8–10 mm | 5 cm KwK 39/1 L/60 (A6), ≈55 rds + MG 42 | https://en.wikipedia.org/wiki/Sd.Kfz._234 |
| Sd.Kfz. 250 | ≈5.4–5.8 t / 2 + 4 | Maybach HL 42 TRKM ≈100 PS; half-track | ≈60–65 km/h | ≈6–14.5 mm | MG 34/42 | https://en.wikipedia.org/wiki/Sd.Kfz._250 |
| Sd.Kfz. 2 Kettenkrad | ≈1.6 t / 1 + 2 | Opel Olympia 1.5 L ≈36 PS | ≈70 km/h |: |: | https://en.wikipedia.org/wiki/Kettenkrad |
| BMW R75 + sidecar | ≈420 kg / 2–3 | 745 cc OHV flat-twin ≈26 hp; driven sidecar wheel, lockable differential, road/off-road ranges | ≈92–95 km/h |: | sidecar MG 34 | https://en.wikipedia.org/wiki/BMW_R75 |

### C3. USSR

| Vehicle | Weight / crew | Engine | Speed | Armour headline | Main armament | check |
|---|---|---|---|---|---|---|
| T-26 Model 1933 | ≈9.6 t / 3 | GAZ T-26 4-cyl petrol (Vickers/Armstrong-Siddeley copy) ≈90 hp | ≈31 km/h road ([V] game: "slowest Soviet light tank") | ≈6–15 mm | 45 mm 20-K (A7) + DT | https://en.wikipedia.org/wiki/T-26 |
| BT-7 Model 1937 | ≈13.9 t / 3 | Mikulin M-17T V-12 petrol ≈450–500 hp; Christie convertible (tracks or wheels) | ≈52 km/h tracks / ≈72–86 km/h wheels | ≈6–22 mm | 45 mm 20-K + DT ([V] game: "very fast, poor armor") | https://en.wikipedia.org/wiki/BT-7 |
| T-38 Model 1937 (amphibious) | ≈3.3 t / 2 | GAZ-AA 4-cyl ≈40 hp; propeller in water | ≈40 km/h land / ≈6 km/h water | ≈3–9 mm | 7.62 mm DT | https://en.wikipedia.org/wiki/T-38_tank |
| GAZ BA-64B | ≈2.4 t / 2 | GAZ-MM ≈50–54 hp; 4x4 (GAZ-64/67 chassis) | ≈80 km/h | ≈6–15 mm sloped | 7.62 mm DT ([V] game: "AP bullets") | https://en.wikipedia.org/wiki/BA-64 |
| KV-85 | ≈46 t / 4 | V-2K / V-2IS V-12 diesel ≈600 hp [R?] | ≈40 km/h | hull front ≈75 mm (+ appliqué on some), turret ≈100 mm [R?] | 85 mm D-5T (A7) | https://en.wikipedia.org/wiki/KV-85 |
| 42WLA (Lend-Lease) | see C1 | | | | | |

### C4. Further H&G vehicles found only in the game data (headline baseline, all [R]/[R?])

| Vehicle | Weight / crew | Engine | Speed | Armour headline | Armament | check |
|---|---|---|---|---|---|---|
| Ford GPA "Seep" (amphibious 4x4) | ≈1.6–1.7 t / up to 5 [R?] | Willys/Ford L134-type 60 hp I4; Willys-type T-84 / Dana 18 driveline [R?] | ≈80 km/h land, ≈8–9 km/h water [R?] |: |: | https://en.wikipedia.org/wiki/Ford_GPA |
| M29 Weasel (tracked carrier) | ≈1.8–2.0 t / 1 + 3 [R?] | Studebaker Champion 6-170 I6 ≈65–75 hp; controlled-differential steering [R?] | ≈58 km/h [R?] |: |: | https://en.wikipedia.org/wiki/M29_Weasel |
| M16 MGMC (M3 half-track + M45 Quadmount) | ≈9 t / 5 [R] | White 160AX 147 hp (as M3, B1.7) | ≈72 km/h | as M3 (6.35–12.7 mm) | 4 × M2HB .50 in powered M45 mount | https://en.wikipedia.org/wiki/M16_multiple_gun_motor_carriage |
| M36B1 | ≈30+ t [R?] / 5 | Ford GAA 500 hp gross (M4A3 hull) | ≈42–48 km/h [R?] | M4A3 hull armour (see B2.3) + M36 open turret | 90 mm M3 (A4) | https://en.wikipedia.org/wiki/M36_tank_destroyer |
| Sd.Kfz. 7/1 (8 t half-track + 2 cm Flakvierling 38) | ≈11.5 t / ≈10 [R?] | Maybach HL 62 TUK ≈140 PS [R?] | ≈50 km/h | unarmoured (some cab armour) | 4 × 2 cm Flak 38 | https://en.wikipedia.org/wiki/Sd.Kfz._7 |
| VW Typ 166 Schwimmwagen | ≈910 kg / 4 [R] | VW 1,131 cc flat-4, 25 PS; 4x4 with off-road gear; propeller for water [R] | ≈80 km/h land, ≈10 km/h water [R] |: |: | https://en.wikipedia.org/wiki/Volkswagen_Schwimmwagen |
| Pz.Kpfw. I Ausf. A | ≈5.4 t / 2 [R] | Krupp M 305 4-cyl air-cooled ≈57–60 PS [R] | ≈37 km/h [R] | ≈6–13 mm [R] | 2 × 7.92 mm MG 13 [R] | https://en.wikipedia.org/wiki/Panzer_I |
| Sd.Kfz. 250/3 (radio half-track) | ≈5.5–5.8 t / 4 [R?] | Maybach HL 42 TRKM ≈100 PS | ≈60 km/h | ≈6–14.5 mm | MG 34/42 | https://en.wikipedia.org/wiki/Sd.Kfz._250 |
| GAZ-AAA (6x4 truck; H&G also with M-4 Maxim quad AA) | ≈2.5–3 t empty [R?] / 1 + load | GAZ-M (Ford-A-derived) I4 ≈50 hp [R?] | ≈65 km/h [R?] |: | (game: quad Maxim) | https://en.wikipedia.org/wiki/GAZ-AAA |
| T-20 Komsomolets (armoured tractor) | ≈3.5 t / 2 + 6 [R] | GAZ-M I4 ≈50 hp [R] | ≈50 km/h [R] | ≈7–10 mm [R] | 7.62 mm DT | https://en.wikipedia.org/wiki/Komsomolets_armored_tractor |
| BA-6 (6x4 armoured car, GAZ-AAA chassis) | ≈5.1 t / 4 [R] | GAZ-A/GAZ-M ≈40–50 hp [R?] | ≈43–52 km/h [R?] | ≈6–9 mm [R?] | 45 mm 20-K (A7) + DT | https://en.wikipedia.org/wiki/BA-6 |
| BA-11 (6x4 heavy armoured car, ZIS-6 chassis) | ≈8 t / 4 [R?] | ZIS-16 I6 ≈88 hp [R?] | ≈64 km/h [R?] | up to ≈13 mm [R?] | 45 mm 20-K + 2 × DT [R?] | https://en.wikipedia.org/wiki/BA-11 |
| T-28 Model 1934 (multi-turret medium) | ≈25–28 t / 6 [R] | Mikulin M-17T V-12 petrol ≈450–500 hp [R] | ≈37–42 km/h [R] | ≈20–30 mm (later screened versions thicker) [R] | 76.2 mm KT-28 L/16.5 (later L-10 L/26) + 3–4 DT [R] | https://en.wikipedia.org/wiki/T-28 |
| M-72 motorcycle (solo / sidecar) | ≈350 kg with sidecar [R?] / 1–3 | 746 cc side-valve flat-twin ≈22 hp (BMW R71 copy) [R] | ≈85–90 km/h [R?] |: | sidecar DP/DT MG in service | https://en.wikipedia.org/wiki/M-72_(motorcycle) |

---

## D. Gaps, conflicts and next steps

### D1. Known source conflicts (all listed in-line above)
- 75 mm M3 / M72 AP at 500 yd: 76 mm (Wikipedia yard table; angle not stated in the extract) vs 68 mm at 30° (British trial) vs ≈58 mm at 30° (M1897-on-M2 carriage article).
- 75 mm M3 metric table: the Wikipedia copy states the basis as 30° from vertical, but the Military-History Fandom mirror says "at 90 degrees" (normal impact). Check the live page and its source note.
- 75 mm M61 / M48 projectile mass: US data sheet 14.96 lb / 14.70 lb vs Wikipedia 6.63 kg / 6.76 kg vs War Thunder wiki 6.79 kg / 6.3 kg.
- 37 mm M74 MV: 884 m/s vs 792 m/s. M51 MV changed during production (≈2,600 → 2,800–2,900 ft/s).
- 90 mm M82: standard 2,650 ft/s vs improved 2,800 ft/s charge. The 30° penetration differs between the AMCP 706-107 table (4.5 in at 500 yd) and the alternatewars "early" series (119.4 mm).
- 90 mm HVAP T30E16/M304 at 30°: 221/200.7/177.8/154.9 mm (alternatewars) vs 221/199/176/156 mm (US data sheet).
- M18 weight: ≈17 t in the infobox vs "about 20 tons" in the article prose. The engine is called Continental in the infobox and Wright in the prose.
- Willys MB track (48 in vs 49 in) and tyre pressure (30 vs 35 psi).

### D2. Fields still missing (priority for the physics model)
- **Gear ratios / final drives**: only the Willys MB and the Sherman family (both [R]) and the Kübelwagen ([R?]) have them. All German, Soviet, M5A1, M18, M24 and M26 transmissions, plus all trucks except the Willys, are missing.
- **Torque curves**: only single-point recalled values (Willys, R975, Ford GAA, White 160AX, GMC 270, VW 1131).
- **Minimum turning radius / per-gear steering radii**: only the Sherman family (≈31 ft, [R?]) and Tiger I (per-gear, [R?]).
- **Turret traverse rates and sights**: only [R?] values.
- **Explosive filler masses**: only M61 (63.7 g) and M48 (666 g), both from the War Thunder wiki (game source), M63 (39 g TNT, forum), and the M82 filler type (Explosive D). German Pzgr. 39 and Soviet APHE fillers are not retrieved.
- **Ballistic coefficients**: none found in any source this session.
- **Soviet penetration tables**: none.
- **Bird & Livingston tables**: not accessed directly.

### D3. Exact sources to fetch next (once WebFetch DNS works or the search budget is raised)
- Ballistics / ballistic coefficients:
  - US Ballistic Data index with per-round firing-table PDFs: https://www.alternatewars.com/BBOW/Ballistics/Tables/US_Ballistic_Data.htm
  - 90 mm data: https://www.alternatewars.com/BBOW/Weapons/AFV_Guns/US_90mm_Guns.htm
  - US AFV guns overview: https://www.alternatewars.com/BBOW/Weapons/AFV_Guns/AFV_Guns_USA.htm
  - Office of the Chief of Ordnance (Jan 1945), "Armor-Piercing Ammunition for Gun, 90-mm, M3": https://www.lonesentry.com/manuals/90-mm-ammunition/index.html
- US gun data sheets:
  - 75 mm specification booklet: https://www.theshermantank.com/wp-content/uploads/75mm-M3-spec-booklet-MK-VI.pdf
  - 75 mm M3 gun data: https://www.theshermantank.com/wp-content/uploads/M3-gun-Data.pdf
  - 90 mm M3 gun data: https://www.theshermantank.com/wp-content/uploads/M3-90mm-gun-data.pdf
- Penetration compilations:
  - panzer-war.com, US: http://panzer-war.com/page60.html
  - panzer-war.com, Germany: http://www.panzer-war.com/page59.html
  - panzer-war.com, "WW II Ballistics Tank Gun Penetration" (http://www.panzer-war.com/page61.html) and a page titled "WW II Ballistics: Armor and Gunnery Fail" (http://www.panzer-war.com/page57.html), seen in search results but not read
- Wikipedia gun pages named in A1–A7 (penetration tables with stated criteria).
- Vehicle pages named in each table's "Sources" line (Wikipedia, tanks-encyclopedia.com, panzerworld.com), plus Hunnicutt *Sherman* / *Pershing* / *Stuart* data sheets for US armour angles and drivetrain ratios.
- Primary manuals to locate:
  - TM 9-803 (Willys MB / Ford GPW)
  - TM 9-731-series (M4/M4A1)
  - TM 9-759 (M4A3)
  - TM 9-710 (half-tracks) [R?]
  - TM 9-801 (CCKW) [R?]
  - Tigerfibel D 656/27 and Pantherfibel D 655/27 [R?]
- To continue, send a follow-up message (this resets the per-turn search budget) or raise `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION`. WebFetch's DNS failure (`ENOTFOUND` on every host) should also be fixed so pages can be read in full rather than through search summaries.
