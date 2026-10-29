# WWII Infantry Weapons: Technical Data for Ballistics and Handling Simulation

**Status: PARTIAL.** Research stopped early because of tool limits (details in section 0). US weapons are mostly covered. The Karabiner 98k and 7.92x57 sS are partly covered. The rest of the German list, all Soviet weapons, the material-penetration section and the trajectory tables were **not researched**. Those sections list the fields still needed and the sources found for them.

---

## 0. Method, limits and legend

**How the data was collected**
- `WebFetch` failed on every host with a DNS error (`getaddrinfo ENOTFOUND`, including en.wikipedia.org). Direct `curl` through the egress proxy was refused for Wikipedia, archive.org, forgottenweapons.com, municion.org, jbmballistics.com, hornady.com, lonesentry.com, ibiblio.org, bulletpicker.com and biggerhammer.net.
- Every value below therefore comes from **WebSearch result summaries**: the search tool's excerpts and paraphrases of the cited pages. No page was read in full. Re-check any value that matters against the cited page. Quoted manual figures (FM 23-5, TM 9-294, FM 23-45, MIS Special Series 14) are the most reliable items here.
- After about 50 searches by this agent, the session hit its shared cap of 200 WebSearch calls per turn, which is shared with other agents. Research stopped there. To continue, send a follow-up message (which gives a new search budget) or raise `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION`.

**Legend**
- **[U]**: uncertain. The value has a single weak source (forum, game wiki, auction listing, low-quality secondary site) or garbled source text.
- **[C]**: sources conflict. Every value found is listed.
- **[NF]**: not found in the sources checked.
- **[NR]**: not researched because the search budget ran out.
- "conv." marks a unit conversion I computed (1 gr = 0.0647989 g; 1 ft = 0.3048 m; 1 in = 25.4 mm; 1 lb = 0.4536 kg; 1 yd = 0.9144 m). No other numbers were derived or estimated.

---

## 1. Heroes & Generals additions (weapons the game had that are not on the original list)

These come from the official H&G Fandom wiki category and class pages, via search excerpts. The wiki says the pages were last updated 53 to 286 days ago.

| Faction | Category | Item (H&G name) | Source |
|---|---|---|---|
| US | Carbine | M1A1 Carbine (folding-stock paratrooper M1) | https://heroesandgenerals.fandom.com/wiki/Category:US_weapons |
| US | Revolver | M1917 (.45 ACP revolver) | https://heroesandgenerals.fandom.com/wiki/M1917 ; https://heroesandgenerals.fandom.com/wiki/Infantryman |
| US | Pistol | Colt M1903 Pocket Hammerless | https://heroesandgenerals.fandom.com/wiki/Weapons ; https://imfdb.org/wiki/Heroes_%26_Generals |
| US | AT launcher | M18 recoilless rifle (57 mm) | https://heroesandgenerals.fandom.com/wiki/Infantryman |
| US | AT grenade | No.74 ("sticky" ST grenade) | https://heroesandgenerals.fandom.com/wiki/No.74 |
| US | Grenade | Mk IIIA1 (concussion) | https://heroesandgenerals.fandom.com/wiki/Explosives |
| US | Explosive | "Infantry Demolition Kit M1" | https://heroesandgenerals.fandom.com/wiki/Explosives |
| US | Mines | M2A3 (AP), M1A1 (AT) | https://heroesandgenerals.fandom.com/wiki/Explosives |
| US | Flamethrower | M2 Flamethrower | https://heroesandgenerals.fandom.com/wiki/Infantryman |
| GER | LMG | MG13 | https://heroesandgenerals.fandom.com/wiki/Weapons |
| GER | LMG/automatic rifle | FG42 "Ausf. E" (the game's FG42 variant name) | https://heroesandgenerals.fandom.com/wiki/Weapons |
| GER | AT rifle | PzB 39 | https://heroesandgenerals.fandom.com/wiki/Weapons ; https://www.imfdb.org/wiki/Panzerbuchse_38_/_39 |
| GER | AT launcher | Granatbüchse 39 (GrB 39) | https://heroesandgenerals.fandom.com/wiki/Infantryman |
| GER | AT grenades | Hafthohlladung H3 (the Infantryman page says "H3.5"), Panzerwurfmine (L) | https://heroesandgenerals.fandom.com/wiki/Explosives ; /wiki/Infantryman |
| GER | Grenades | M24 Frag Sleeve (i.e., Splitterring), M24 "bundle version" (i.e., geballte Ladung) | https://heroesandgenerals.fandom.com/wiki/Explosives |
| GER | Mines | S-Mine (AP bounding), Tellermine 42 (AT) | https://heroesandgenerals.fandom.com/wiki/S-Mine ; /wiki/Explosives |
| GER | Pistol | "Model 1934" / Mauser 1934 Taschenpistole | https://imfdb.org/wiki/Heroes_%26_Generals (search excerpt); namu.wiki H&G page lists "Model 1934" without maker **[U]** |
| GER | Flamethrower | Flammenwerfer 41 | https://heroesandgenerals.fandom.com/wiki/Infantryman |
| USSR | Assault weapon | AVS-36 | https://heroesandgenerals.fandom.com/wiki/Weapons |
| USSR | LMG | Maxim-Tokarev MT; Degtyarev DT-29 | https://heroesandgenerals.fandom.com/wiki/Category:Russian_weapons |
| USSR | Pistol | Korovin TK | IMFDB excerpt only, not confirmed by a second search **[U]** |
| USSR | AT launcher | Ampulomet Model 1941 | https://heroesandgenerals.fandom.com/wiki/Category:Russian_weapons |
| USSR | Grenades | RG-42, RGD-33 Bundle ("five grenades strapped together") | https://heroesandgenerals.fandom.com/wiki/RGD-33_Bundle ; /wiki/Explosives |
| USSR | Mines | PMK-40 (AP), TM-35 (AT; "several 200 g blocks of TNT") | https://heroesandgenerals.fandom.com/wiki/TM-35 |
| USSR | Flamethrower | ROKS-3 | https://heroesandgenerals.fandom.com/wiki/Infantryman |

Searches found no evidence that H&G had shotguns, the Gewehr 41, the AVT-40 or the M38/M44 carbines. The weapons-page excerpt was cut off before any shotgun section, so this is **unconfirmed** either way. No technical data was gathered for any of the H&G additions above **[NR]**.

---

## 2. United States

### 2.1 M1 Garand (U.S. Rifle, Cal. .30, M1)

| Field | Value | Source |
|---|---|---|
| Cartridge / service bullet | .30-06, Ball M2 (152 gr flat-base; see section 5) | https://www.biggerhammer.net/manuals/garand/ammo.htm |
| Muzzle velocity | 2,800 ft/s (853 m/s) with M2 ammunition | FM 23-5 ch.1: https://www.biggerhammer.net/manuals/garand/intro.htm |
| Muzzle velocity (2nd source) | 2,750 to 2,800 ft/s | TM 9-1005-222-12: https://www.biggerhammer.net/manuals/tm9100522212/M1GARA.PDF |
| Action | Gas-operated, air-cooled, clip-fed, semiautomatic | FM 23-5 ch.1 (above) |
| Fire modes | Semi only | FM 23-5 ch.1 |
| Feed | 8-round en-bloc clip into an internal magazine. The clip is ejected after the last round and the bolt locks open. | https://en.wikipedia.org/wiki/M1_Garand ; https://www.outdoorlife.com/guns/m1-garand/ **[U]** |
| Weight | 9.5 lb (4.31 kg); about 10.5 lb (4.76 kg) with bayonet | FM 23-5 ch.1; TM 9-1005-222-12 |
| Weight range | 9.5 to 11.6 lb (4.31 to 5.3 kg) | https://en.wikipedia.org/wiki/M1_Garand |
| Overall length | 43.6 in (1,107 mm conv.) per FM 23-5; 43.5 in per Wikipedia **[C]** | FM 23-5 ch.1; Wikipedia |
| Barrel length | 24 in (610 mm) | FM 23-5 ch.1 |
| Sight radius | 27.9 in (709 mm conv.) at the 100 yd setting | FM 23-5 ch.1; TM 9-1005-222-12 |
| Trigger to butt plate | 13 to 13.25 in (330 to 337 mm conv.), measured from the front of the trigger on issue rifles **[U]** (sellers' measurements, not a specification) | https://lsbauctions.com/?p=112504 ; https://lsbauctions.com/wwii-winchester-m1-garand-us-30-06-cmp-rack-grade-rifle-dec-1941-cr/ |
| Rear sight | Adjustable aperture (peep). Elevation drum graduated 100 to 1,200 yd, even ranges marked. 1 MOA per click for elevation and windage on standard sights (National Match: ½ MOA). Receiver windage marks are 4 MOA each. | https://yarchive.net/gun/rifle/garand_sight.html ; https://www.americanrifleman.org/content/from-flush-nut-to-t105-the-evolution-of-the-m1-garand-rear-sight-assembly/ ; https://www.fulton-armory.com/how-do-i-sight-in-my-m1-garand-or-m1a-m14-type-rifle/ |
| Click travel | Windage 16 clicks left or right of centre; elevation 0 to 72 clicks | https://www.biggerhammer.net/manuals/garand/sighting.htm |
| Battle sight | Excerpt reads "300-yard zero, less two clicks" **[U]** (wording unclear) | https://www.biggerhammer.net/manuals/garand/sighting.htm |
| Front sight | A blade between two protecting ears (wings) on the sight base, which slides onto a dovetail on the gas cylinder and is held by a screw. You aim with the top of the blade; the ears only guard it from knocks. Issue blade 0.077 in (1.96 mm) wide; the National Match blade, 0.062 in, is narrower than the issue one. About 0.72 to 0.73 in from the bottom of the base to the top of the blade **[U]**. How high the ears stand against the blade's top: **[NF]** (both our models have them about 2 mm higher). | https://www.fulton-armory.com/product/front-sight-standard-new-fa-m1-garand/ ; https://kensight.com/m1-garand-national-match-kensight-front-sight-0-062-sight-blade/ ; https://forums.thecmp.org/forum/cmp-sales/m1-garand/118730-sight-picture **[U]** ; https://forums.thecmp.org/forum/cmp-sales/m1-garand/222775-front-sight-height **[U]** ; https://www.m14forum.com/threads/garand-front-sight-heights.519547/ **[U]** |
| Effective range | 500 yd (457 m) | https://en.wikipedia.org/wiki/M1_Garand |
| Maximum range (M2 ball) | 3,500 yd | https://www.biggerhammer.net/manuals/garand/ammo.htm |
| Safety | In the front of the trigger guard. Pushing it into the guard puts it in the "locked position (inside the trigger guard)". | FM 23-5: https://www.biggerhammer.net/manuals/garand/intro.htm |
| Clip "ping" mechanics | After the last shot the operating-rod catch holds the op rod back and releases the clip latch. The clip ejector spring in the trigger assembly throws the empty clip out, and the bolt stays open. | https://www.outdoorlife.com/guns/m1-garand/ ; https://crateclub.com/blogs/loadout/understanding-how-an-m1-garand-works-a-comprehensive-guide **[U]** (secondary) |
| Reload handling | "Garand thumb": the bolt can slam forward on the thumb that seats the clip. Shooters hold the op-rod handle back with the side of the right hand. | https://crateclub.com/blogs/loadout/how-to-load-an-m1-garand-a-comprehensive-guide **[U]** |
| Sniper scopes (M1C/M1D) | M81 (crosshair) and M82 (tapered post): 2.5x, FOV 35 ft at 100 yd (Lyman Alaskan type). M84: 2.2x, FOV 27 ft at 100 yd, post plus horizontal wire. Source is a 1947 maintenance manual summary. | https://www.koreanwaronline.com/arms/m1sight.htm |
| Sniper mount and dates | Griffin & Howe mount offset to the left so clips can still be loaded. M84 not available in quantity until Korea. M1D adopted Sept 1944 as substitute standard; none produced during WWII. | https://www.swatmag.com/article/long-guns-m1d-garand-sniper-rifle/ ; https://olive-drab.com/od_other_firearms_rifle_m1c-m1d.php ; https://gunsamerica.com/digest/m1-garand-sniper-variants-m1c-m1d-part-4-garands-from-the-government/ |
| Mechanical accuracy | **[NF]** | |

### 2.2 M1 / M1A1 / M2 Carbine

| Field | Value | Source |
|---|---|---|
| Cartridge / bullet | .30 Carbine Ball M1, 110 gr (7.13 g conv.) | https://en.wikipedia.org/wiki/.30_carbine |
| Muzzle velocity | 1,990 ft/s (607 m/s) | https://en.wikipedia.org/wiki/M1_carbine |
| Muzzle velocity (others) | 1,900 to 2,000 ft/s (globalsecurity). The .30 carbine article gives "110 gr FMJ 1,900 ft/s (579 m/s)" (different test basis). **[C]** | https://www.globalsecurity.org/military/systems/ground/m1-car-specs.htm ; https://en.wikipedia.org/wiki/.30_carbine |
| Fire modes | M1/M1A1 semi only. M2 semi and full auto, with the selector on the **left** side of the receiver near the chamber (the M2 stock is cut inside on the left for it). | https://www.rockislandauction.com/detail/74/1412/us-winchester-m2-carbine-class-iiinfa-machine-gun ; https://www.nramuseum.org/guns/the-galleries/wwii,-korea,-vietnam-and-beyond-1940-to-present/case-41-korean-war-firearms/us-m2-selective-fire-carbine-w-flash-hider.aspx |
| Cyclic rate (M2) | 750 rpm in most sources; also 750 to 775; one outlier says about 900 **[C]** | https://weaponsystems.net/system/1230-M1+Carbine ; https://www.uscarbinecal30.com/modelm2.html |
| Feed | 15- or 30-round detachable box. The 30-round magazine came in with the M2. | https://en.wikipedia.org/wiki/M1_carbine ; https://www.uscarbinecal30.com/modelm2.html |
| Weight | 5.2 lb (2.36 kg) empty (Wikipedia); 5.5 lb with empty magazine (globalsecurity); M1 2.36 kg and M1A1 2.53 kg with empty magazine (weaponsystems.net); M2 5.5 lb **[U]** | Wikipedia; globalsecurity; https://weaponsystems.net/system/1230-M1+Carbine |
| Overall length | 35.6 in (904 mm conv.) (Wikipedia); 35.58 in (globalsecurity) | as above |
| Barrel length | 17.75 in (451 mm) (Wikipedia); 18 in (globalsecurity) **[C]** (likely measured differently) | as above |
| Rear sight (early) | Type I "L" flip sight, two positions, **150 and 300 yd**, no windage, in most sources. Some forum posts say 100/300 **[C]**. | https://www.gunsandammo.com/editorial/restoring-an-m1-carbine-part-1/485927 ; https://www.worthpoint.com/worthopedia/m1-carbine-type-1-rear-flip-sight-inland-marked ; https://www.gunboards.com/threads/m1-carbine-rear-sight.1202793/ |
| Rear sight (late) | Adjustable sight: Type II milled, Type III stamped. One forum post gives 100, 200, 250, 300 yd settings **[U]**. | https://www.shootersforum.com/threads/advice-needed-ref-sights-on-30-cal-m1-carbine.44368/ |
| Sight radius | **[NF]** | |
| M1A1 | M1 with a folding metal skeleton stock, made only by Inland: 140,591 in two runs (1942–43 and 1944) **[U]**. A single source in the search gave this; the excerpt did not say which page. | https://weaponsystems.net/system/1230-M1+Carbine ; https://www.uscarbinecal30.com/modelm2.html |
| Effective range, accuracy, action detail | **[NF]** | |

### 2.3 M1903 Springfield / M1903A3 / M1903A4 (sniper)

| Field | Value | Source |
|---|---|---|
| Cartridge | .30-06 (M1/M2 ball) | https://en.wikipedia.org/wiki/M1903_Springfield |
| Muzzle velocity | 2,800 ft/s (853 m/s) | https://en.wikipedia.org/wiki/M1903_Springfield |
| Action / feed | Bolt action. 5-round internal box loaded with 5-round stripper clips (a 25-round magazine existed for an air-service variant). | https://en.wikipedia.org/wiki/M1903_Springfield |
| Weight | 8.7 lb (3.9 kg) (Wikipedia); other sites give 8.5 lb and 8.67 lb | https://en.wikipedia.org/wiki/M1903_Springfield |
| Overall length | 43.2 in (1,100 mm) | Wikipedia |
| Barrel | 24 in (610 mm) | Wikipedia |
| Rear sight (M1903, flip-up leaf) | Graduated to 2,700 yd (2,500 m). The 2,850 yd figure in the brief was **not** found. | https://en.wikipedia.org/wiki/M1903_Springfield |
| M1903A3 rear sight | Receiver-mounted aperture, ramp-adjustable 200 to 800 yd (Shooting Times). Another excerpt gave a lower maximum (400 yd) **[C]**. | https://www.shootingtimes.com/editorial/longgun_reviews_st_springmola3a4_201003/99110 ; https://warfarehistorynetwork.com/article/forgotten-substitute/ |
| M1903A4 build | Selected Remington M1903A3 rifles with the rear peep removed and the front blade never fitted, so no iron sights. Redfield mount. | https://www.milsurps.com/threads/a-summary-of-the-1903-a1-a3-a4-development-through-history.75146/ ; https://www.shootingtimes.com/editorial/longgun_reviews_st_springmola3a4_201003/99110 |
| M1903A4 scope | Weaver 330C (Army M73B1). 2.5x per American Rifleman ("2.5X Weaver 330"); 2.75x per milsurps **[C]**. FOV described as "very restricted" (no number found). Reticle **[NF]**. | https://www.americanrifleman.org/content/m1903a4-development-the-u-s-army-s-search-for-a-sniper-rifle/ ; milsurps (above); https://warfarehistorynetwork.com/article/forgotten-substitute/ |
| Sight radius, accuracy, effective range | **[NF]** | |

### 2.4 Thompson M1928A1 and M1A1

| Field | Value | Source |
|---|---|---|
| Cartridge | .45 ACP (Ball M1911, 230 gr) | see section 5 |
| Muzzle velocity | 935 ft/s (285 m/s conv.) (Wikipedia); about 950 ft/s (dockeryarmory) **[U]** | https://en.wikipedia.org/wiki/Thompson_submachine_gun ; https://dockeryarmory.com/m1928a1-thompson/ |
| Cyclic rate | M1928: 600 to 725 rpm. M1A1: 700 to 800 rpm (Wikipedia). Other figures seen: about 675, about 700 (game wiki), and 600 rpm ("older reference") **[C]**; the excerpts did not tie each to a page. | https://en.wikipedia.org/wiki/Thompson_submachine_gun ; https://www.koreanwaronline.com/arms/thompson.htm |
| Feed | M1928A1: 20- and 30-round box, 50- and 100-round drum. M1/M1A1: box only, no drums. | https://hbsa-uk.org/knowledge-and-research/hbsa-dvd-index-and-content/hbsa-historic-machine-guns-dvd/thompson-m1928a1-45-sub-machine-gun/ ; Wikipedia |
| Weight | M1928A1: 10.8 lb (4.9 kg) empty (Wikipedia); 10.75 lb (review) | Wikipedia ; https://shootingdiceblog.wordpress.com/2016/06/15/high-tech-auto-ordnance-m1928a1-thompson/ |
| Weight (M1A1) | 10 lb (4.5 kg) empty (Wikipedia); about 10.5 lb (craftholsters); 11 lb (koreanwaronline) **[C]** | Wikipedia ; https://www.craftholsters.com/m1a1-thompson-review ; https://www.koreanwaronline.com/arms/thompson.htm |
| Overall length (M1928A1) | 33.7 in (856 mm conv.) with compensator (Wikipedia); 33.75 in (review) | as above |
| Barrel (M1928A1) | 10.5 in (267 mm), finned, with Lyman-made Cutts compensator. 12.44 in including the compensator (one source). | HBSA (above) |
| Sights | M1928A1: adjustable Lyman rear. One listing says it is a folding ladder graduated to 650 yd **[U]**. M1A1: fixed rear sight and non-ribbed barrel. | HBSA ; https://dockeryarmory.com/m1928a1-thompson/ ; https://www.craftholsters.com/m1a1-thompson-review |
| Bolt (M1A1) | Separate firing pin and hammer of the M1 replaced by a firing pin machined into the bolt face | https://www.craftholsters.com/m1a1-thompson-review |
| Open/closed bolt, charging handle side, M1A1 length/barrel | **[NF]** in the excerpts | |

### 2.5 M3 / M3A1 "Grease Gun"

| Field | Value | Source |
|---|---|---|
| Cartridge | .45 ACP | https://en.wikipedia.org/wiki/M3_submachine_gun |
| Muzzle velocity | 900 ft/s (274 m/s) (Wikipedia); 920 ft/s (americanspecialops) **[C]** | Wikipedia ; https://www.americanspecialops.com/delta-force/weapons/m3-grease-gun.php |
| Cyclic rate | 450 rpm (Wikipedia); 350 to 450 rpm in another source | Wikipedia |
| Action | Fires from an open bolt with a fixed firing pin (operating principle not stated in the excerpts) | https://www.americanrifleman.org/content/at-the-range-m3a1-submachine-gun/ ; https://gunsmagazine.com/guns/rifles/the-grease-gun/ |
| Feed | 30-round steel stick magazine. The spring is stiff, so a loader was often needed; the M3A1 stock has a loader built in. | https://athlonoutdoors.com/article/grease-gun-m3-submachine-gun/ ; https://www.americanrifleman.org/content/at-the-range-m3a1-submachine-gun/ |
| Weight | M3: 8.15 lb (3.70 kg) empty. M3A1: 7.95 lb (3.61 kg) (Wikipedia). Also seen: 7.65 lb; 7.8 lb without sling and magazine (vietnamgear). | Wikipedia ; https://www.vietnamgear.com/kit.aspx?kit=45 |
| Length | 29.1 in (740 mm) stock extended, 21.9 in (556 mm) collapsed (Wikipedia); 29.8 / 22.8 in (americanspecialops) **[C]** | as above |
| Barrel | 8 in (203 mm) | Wikipedia ; americanspecialops |
| Sights | Fixed, set for 100 yd (91 m) | Wikipedia |
| Effective range | 100 yd | https://www.vietnamgear.com/kit.aspx?kit=45 |
| Cocking | M3: crank-type retracting handle on the **right** side of the receiver, fragile. M3A1: crank deleted; the shooter pulls the bolt back by a finger hole in the bolt. | https://gunsmagazine.com/guns/rifles/the-grease-gun/ ; https://athlonoutdoors.com/article/grease-gun-m3-submachine-gun/ |
| Safety | No conventional safety. A projection on the hinged ejection-port cover locks the bolt (forward or cocked) when the cover is closed. Guns could still fire if dropped and the cover knocked open. | https://www.americanrifleman.org/content/at-the-range-m3a1-submachine-gun/ ; https://gunsmagazine.com/guns/rifles/the-grease-gun/ |

### 2.6 Browning Automatic Rifle M1918A2

| Field | Value | Source |
|---|---|---|
| Cartridge | .30-06 | https://en.wikipedia.org/wiki/M1918_Browning_automatic_rifle |
| Fire modes | **Full-auto only** at two rates. The A2 has no semi. | Wikipedia ; https://machinegunboards.com/forums/index.php?%2Ftopic%2F5773-bar-1918a2-fire-rates%2F= |
| Cyclic rate | Slow 300 to 450 rpm, fast 500 to 650 rpm (Wikipedia). One source says about 350 slow and 550 fast **[C]**. | Wikipedia ; https://www.shootingillustrated.com/content/the-m1918a2-browning-automatic-rifle/ |
| Selector | Left side of the trigger group: **S** safe, **F** auto at the reduced rate, **A** auto at the normal rate | https://weaponsystems.net/system/1316-bar+m1918 ; https://www.historyofwar.org/articles/weapons_browning_automatic_rifle.html |
| Rate reducer | In the buttstock with the buffer per one source; another (forum) puts it in the trigger group **[C]**. Hard to clean and prone to corrosion. | weaponsystems.net ; historyofwar.org |
| Bolt | Fires from an open bolt (to avoid cook-offs) | Wikipedia |
| Feed | 20-round detachable box | Wikipedia |
| Weight | About 8.8 kg (19 lb) (Wikipedia); 19.4 lb (sproe) | Wikipedia ; http://www.sproe.com/b/bar.html |
| Length / barrel | 1,215 mm (47.8 in) / 610 mm (24.0 in) | Wikipedia |
| Sights | Rear sight adjustable 100 to 1,500 yd (91 to 1,372 m); sight radius 782 mm (30.8 in) on the A2 | Wikipedia |
| Bipod | "Foldable bipod attached to the barrel" | Wikipedia |
| Charging handle | Left side **[U]** (game-wiki source only) | https://battlefield.fandom.com/wiki/BAR_M1918 |
| Effective range | 550 m and 600 yd in different secondary sources **[C]**. The excerpt did not say which page gave which figure: dday-overlord.com, modernfirearms.net, weaponsystems.net or sproe.com. | https://modernfirearms.net/en/machineguns/u-s-a-machineguns/browning-m1918-bar-eng/ ; https://www.dday-overlord.com/en/material/weaponry/bar-browning-automatic-rifle |

### 2.7 Browning M1919A6 (with M1919A4 sight data)

| Field | Value | Source |
|---|---|---|
| Cartridge | .30-06 | https://en.wikipedia.org/wiki/M1919_Browning_machine_gun |
| Action | Recoil-operated, **closed bolt** | Wikipedia |
| Cyclic rate | 400 to 600 rpm | Wikipedia |
| Feed | 250-round cloth or disintegrating-link belt (Wikipedia); 150-round fabric belt (WWII Online game wiki) **[C/U]** | Wikipedia ; https://wiki.wwiionline.com/view/Browning_M1919A6 |
| Length / barrel | 53 in (1,346 mm conv.) / 24 in | Wikipedia |
| Weight | A6: 32 lb (Call of Duty wiki only) **[U]**. The 32.5 lb figure was **not** confirmed. Wikipedia gives 31 lb for the **A4**. | https://callofduty.fandom.com/wiki/Browning_M1919 ; Wikipedia |
| A6 features | Bipod and carrying handle added. Shoulder stock and flash hider not confirmed in excerpts **[U]**. | https://battlefield.fandom.com/wiki/M1919_Browning |
| Rear sight (M1919A4, FM 23-45) | Leaf graduated in 100 yd divisions up to 2,400 yd; set with the elevating-screw knob. Windage knob gives 10 mils left or right. Mil scale engraved on the left of the leaf. | https://www.ibiblio.org/hyperwar/USA/ref/FM/PDFs/FM23-45.pdf |
| Sight radius (M1919A4) | 13.94 in (354 mm conv.) | FM 23-45 (above) |
| Barrel change, A6-specific sight | **[NF]** | |

### 2.8 Johnson M1941 rifle

| Field | Value | Source |
|---|---|---|
| Cartridge | .30-06 | https://en.wikipedia.org/wiki/M1941_Johnson_rifle |
| Action | Short recoil, rotating bolt | Wikipedia ; https://smallarmsreview.com/m1941-johnson-rifle-ar-15-progenitor/ |
| Feed | 10-round rotary magazine, loaded with 5-round M1903 stripper clips. Loading side **[NF]**. | Wikipedia |
| Muzzle velocity | 2,840 ft/s (866 m/s) (Wikipedia); 853 m/s (fandom) **[C]** | Wikipedia ; https://ww2-history.fandom.com/wiki/M1941_Johnson_(Rifle) |
| Weight / length / barrel | 9.5 lb (4.31 kg) / 45.87 in (1,165 mm) / 22 in (560 mm) | Wikipedia |
| Sights | Adjustable iron sights. Graduations **[NF]**. | Wikipedia |

### 2.9 Johnson M1941 light machine gun

| Field | Value | Source |
|---|---|---|
| Cartridge | .30-06 | https://en.wikipedia.org/wiki/M1941_Johnson_machine_gun |
| Action / bolt | Short recoil, rotating bolt. **Open bolt** in full auto, **closed bolt** in semi. | Wikipedia ; https://www.americanrifleman.org/content/the-model-of-1941-johnson-light-machine-gun/ |
| Cyclic rate | 450 to 600 rpm (Wikipedia); adjustable 200 to 600 rpm (military-history fandom) **[C]**. The 300 to 900 rpm figure in the brief was **not** found. | Wikipedia ; https://military-history.fandom.com/wiki/M1941_Johnson_machine_gun |
| Feed | 20-round single-column box on the **left** side of the receiver. The fandom page cites a 25-round "brochure standard" **[U]**. | Wikipedia ; American Rifleman |
| Weight | 13 lb (5.9 kg) (Wikipedia); "just over 12 lb" (American Rifleman) **[C]** | as above |
| Length / barrel | 42 in / 22 in | Wikipedia |

### 2.10 Trench shotguns (Winchester M1897 and M1912)

| Field | Value | Source |
|---|---|---|
| M1897 weight | 8 lb (3.6 kg) | https://en.wikipedia.org/wiki/Winchester_Model_1897 |
| M1897 barrel | 20 in (510 mm) on the trench gun | Wikipedia |
| M1897 feed | 5-round tube magazine, plus 1 in the chamber | Wikipedia |
| M1897 handling | No trigger disconnector, so it **slam-fires** if the trigger is held while pumping. Trench version has a perforated steel heat shield and a bayonet-lug adapter for the M1917 bayonet. 12 gauge. | Wikipedia |
| M1912 barrel | 20 in, 20¾ in and 20⅞ in in different specimen descriptions **[C]** | https://www.rockislandauction.com/detail/53/1826 ; https://www.americanrifleman.org/content/i-have-this-old-gun-winchester-model-12-trench-gun/ |
| M1912 feed | Tube magazine: 6 × 2¾ in shells or 5 × 3 in shells | https://www.rockislandauction.com/detail/53/1826 |
| M1912 features | Ventilated heat shield (four rows of holes on WWII guns, six on the 1917 version) and M1917 bayonet lug. About 80,000 were made or bought in WWII, mainly for the Pacific. | American Rifleman (above); https://en.wikipedia.org/wiki/Winchester_Model_1912 |
| M1912 weight / length | About 3.6 kg / about 100 cm **[U]** (fan wiki only) | https://ww2-history.fandom.com/wiki/Winchester_M12_shotgun |
| 12 ga military buckshot load (pellet count, size, velocity) | **[NF]** | |

### 2.11 Colt M1911A1

| Field | Value | Source |
|---|---|---|
| Cartridge | .45 ACP Ball M1911, 230 gr (14.90 g conv.) | https://historynet.com/m1911-1911a1-weaponry/ |
| Muzzle velocity | 830 ft/s (253 m/s) | https://en.wikipedia.org/wiki/M1911_pistol ; https://www.globalsecurity.org/military/systems/ground/m1911a1-specs.htm |
| Feed | 7-round single-stack magazine | https://historynet.com/m1911-1911a1-weaponry/ |
| Weight | 39 oz (1,100 g) empty with magazine (Wikipedia); 2.5 lb (1.14 kg) with empty magazine (globalsecurity). The 2.44 lb / 8.25 in figures in the brief belong to the MEU(SOC) pistol, not the M1911A1. | Wikipedia ; globalsecurity ; https://en.wikipedia.org/wiki/MEU(SOC)_pistol |
| Length | 8.5 in (219 mm) | historynet (above) |
| Barrel | 5.03 in (127 mm) | Wikipedia |
| Sight radius, safety detail | **[NF]** | |

### 2.12 2.36-inch Rocket Launcher M1A1 / M9 / M9A1 ("Bazooka")

| Field | Value | Source |
|---|---|---|
| M1A1 launcher | Length about 54.5 in (1,384 mm conv.), weight about 13.26 lb (6.01 kg conv.) | TM 9-294 (1943): https://www.bulletpicker.com/pdf/TM-9-294-1943.pdf ; https://www.lonesentry.com/manuals/bazooka/bazooka-rocket-launcher-m1a1.html |
| Rocket (per TM 9-294, 1943) | Length 21.6 in (549 mm conv.), weight 3.5 lb (1.59 kg conv.). The excerpt does not name the model; the M6A1 is likely **[U]**. | TM 9-294 (1943) |
| Muzzle velocity | **265 ft/s (80.8 m/s conv.)** per TM 9-294. Also seen: 270 ft/s (82.3 m/s), 81 m/s, 80 m/s. | TM 9-294 ; https://ww2db.com/weapon.php?q=317 ; https://wiki.wwiionline.com/view/M9_Bazooka |
| Sights (M1A1) | Rear peep. Front sight has three studs for 100, 200 and 300 yd; intermediate ranges, lead and windage are estimated. | TM 9-294 ; lonesentry (above) |
| Range | Aimed fire up to 300 yd, maximum 700 yd (TM 9-294). Effective range in secondary sources: 100 yd (about 90 m), 100 m, 140 m, 150 m, or "150 to 300 yd depending on target" **[C]**. | TM 9-294 ; https://www.sonsoflibertymuseum.org/m9a1-bazooka.cfm ; https://www.ww2-weapons.com/bazooka/ |
| Penetration | "Up to 100 mm" (early 60 mm HEAT) and "up to 125 mm" (improved rounds for the M9); 119.4 mm at 0° (4.7 in); M6A3 3.5 to 4 in (89 to 102 mm) **[C/U]**. All are from secondary sources, and the excerpts did not tie each figure to a specific page. | https://www.ww2-weapons.com/bazooka/ ; https://military-history.fandom.com/wiki/Bazooka ; https://weaponsystems.net/system/1185-M9+Bazooka |
| Rocket shapes | M6A1/M7A1: pointed nose, fins without a rim. M6A3/M7A3: rounded nose, ring ("wheel-shaped") fin. | https://www.lonesentry.com/manuals/bazooka/bazooka-ammunition-rocket-m6a1.html |
| M6A3 | 19.4 in (493 mm), 3.38 lb (1.53 kg) **[U]** | https://military-history.fandom.com/wiki/Bazooka |
| M9 / M9A1 launcher | 61 in. Weight 15.87 lb (militaryfactory), 15.14 lb (sonsofliberty), or 16 lb (7.25 kg) (another source) **[C]**. The M9A1 breaks down into two sections. | https://www.militaryfactory.com/smallarms/detail.php?smallarms_id=1234 ; https://www.sonsoflibertymuseum.org/m9a1-bazooka.cfm |
| Backblast | "Approximately 15 yards" danger area behind the launcher **[U]** (museum page only) | https://www.sonsoflibertymuseum.org/m9a1-bazooka.cfm |

### 2.13 Mk 2 fragmentation grenade

| Field | Value | Source |
|---|---|---|
| Total mass | About 1 lb 5 oz (about 600 g), depending on filling | https://en.wikipedia.org/wiki/Mk_2_grenade |
| Body size | 3.5 in long × 2.3 in diameter | Wikipedia |
| Filler | 2 oz (56.7 g conv.) of TNT or EC blank-fire powder (flaked or granular TNT; EC is the low-explosive filler). Wikipedia lists the filling only as "varied". | https://military-history.fandom.com/wiki/Mk_2_grenade ; https://www.ima-usa.com/products/original-u-s-wwii-inert-mkii-pineapple-grenade-with-underlying-yellow-paint-m10a2-fuze |
| Fuzes | M5/M6/M204 detonating fuzes (HE filler); M10/M11 igniting fuzes (low-explosive filler) | Wikipedia |
| Delay | Usually 4 to 5 s. M6A4C 4 s; M10A3 4.5 to 5.3 s. The M204 (1944) is described as "silent" and more reliable; early M10/M10A1 fuzes sometimes detonated prematurely. | Wikipedia |
| Casualty radius | **[NF]** | |

---

## 3. Germany

### 3.1 Karabiner 98k (partial)

| Field | Value | Source |
|---|---|---|
| Cartridge / bullet | 7.92×57 mm, s.S. Patrone (see section 5) | https://en.wikipedia.org/wiki/7.92%C3%9757mm_Mauser |
| Muzzle velocity | 760 m/s (Wikipedia). About 2,800 ft/s (MIS 1943 estimate). 2,600 to 2,700 ft/s (Lone Sentry enemy-ordnance catalogue) **[C]**. | https://en.wikipedia.org/wiki/Karabiner_98k ; https://www.lonesentry.com/manuals/german-infantry-weapons/kar98-german-rifle.html |
| Weight | 3.7 to 4.1 kg (Wikipedia); about 9 lb (MIS 1943) | as above |
| Overall length | 1,110 mm (Wikipedia); 43.5 in (MIS 1943) | as above |
| Barrel | 600 mm (Wikipedia); 23.4 in (594 mm conv.) (MIS 1943) | as above |
| Rear sight | Leaf with an open **V** notch on a ramp (tangent), graduated **100 to 2,000 m** in 100 m steps; **no windage adjustment** | MIS Special Series 14 (above); https://ussr.fandom.com/wiki/Karabiner_98k |
| Front sight | Inverted-V "barleycorn" blade, sometimes with a detachable hood (hood standard from 1939 per one source **[U]**) | MIS 1943 ; https://vietnamwar.fandom.com/wiki/Karabiner_98k |
| Sight radius | 500 mm **[U]** (fan wiki only) | https://military-history.fandom.com/wiki/Karabiner_98k |
| Effective range | 500 m with iron sights, 800 to 1,000 m with a scope (Wikipedia). About 800 yd effective, about 3,000 yd maximum (MIS 1943). | as above |
| Feed, safety, bolt detail, ZF39/ZF41 scopes | **[NR]** | |

MIS 1943 caveat: the document itself warns that "data may be incomplete or inaccurate". It is a wartime intelligence estimate.

### 3.2 Not yet researched [NR]

Gewehr 41, Gewehr 43 and ZF4, Kar98k ZF39/ZF41, MP40, MP34/35, StG 44, FG 42, MG34, MG42, Walther P38, Luger P08, Mauser C96, Panzerschreck RPzB 54, Panzerfaust 30/60/100, Stielhandgranate 24, Eihandgranate 39. The same applies to the H&G extras (MG13, PzB 39, GrB 39, Hafthohlladung, Panzerwurfmine, Flammenwerfer 41, mines).

Most promising source found (not read): **MIS Special Series No. 14, "German Infantry Weapons" (25 May 1943)**, reproduced on Lone Sentry. It has a separate page per weapon and an ammunition chart giving cartridge weight, bullet weight and MV:
- https://www.lonesentry.com/manuals/german-infantry-weapons/ (index)
- http://mobile.lonesentry.com/manuals/german-infantry-weapons/ammunition-chart.html
- Lone Sentry "Catalog of Enemy Ordnance": https://www.lonesentry.com/ordnance/ (for example https://www.lonesentry.com/ordnance/2010/03/30/7-92-mm-granatbuchse-39-grenade-launching-rifle/)

---

## 4. USSR: not yet researched [NR]

Mosin-Nagant M1891/30 (and PU/PE scopes), M1938 and M1944 carbines, SVT-40, AVT-40, PPSh-41, PPS-43, PPD-40, DP-28, TT-33, Nagant M1895, PTRD-41, PTRS-41, RPG-40, RPG-43, F-1, RGD-33. Also the H&G extras: AVS-36, Maxim-Tokarev, DT-29, Korovin TK, RG-42, Ampulomet, ROKS-3, PMK-40, TM-35.

Suggested sources (from the brief and from search results, not read): the Soviet NSD manuals (Наставление по стрелковому делу) for the 1891/30 rifle, SVT and PPSh, which carry sight graduations and trajectory-height tables; FM 23-10 Appendix A, "Primary Sniper Weapons of the World", which may cover the PU scope (https://www.biggerhammer.net/manuals/23-10/appa.pdf); and TM 30-430, "Handbook on USSR Military Forces".

---

## 5. Ammunition (service loads found so far)

| Cartridge | Service bullet | Bullet mass | MV (weapon / barrel) | BC | Powder charge | Sources |
|---|---|---|---|---|---|---|
| .30-06 | Ball M2 (flat-base) | 152 gr (9.85 g conv.); some sources say 150 gr | 2,805 ft/s (855 m/s) (Wikipedia); about 2,800 ft/s (853 m/s) in the M1 rifle (FM 23-5) | **[NF]** | About 50 gr (3.24 g) IMR 4895 (forum recollection) **[U]**; "max 48.0 gr IMR 4895 to approximate M2" (forum, citing old American Rifleman data) **[U]** | https://en.wikipedia.org/wiki/.30_carbine ; https://www.biggerhammer.net/manuals/garand/ammo.htm ; https://forum.accurateshooter.com/threads/30-06-help-loading-m2-ball-for-older-rifle.4091297/ ; https://www.m14forum.com/threads/imr-4895-load-for-m1-garand.149156/ |
| .30-06 | Ball M2: other data | Bullet length 1.123 in; unpainted tip | Maximum range 3,500 yd | | | https://www.biggerhammer.net/manuals/garand/ammo.htm |
| .30-06 | AP M2 (black tip) | **[NF]** | 2,770 ft/s; maximum range 3,160 yd | | | same |
| .30-06 | Tracer M1 (red tip) | **[NF]** | 2,750 ft/s; maximum range 3,350 yd | | | same |
| .30 Carbine | Ball M1 | 110 gr (7.13 g conv.) | 1,990 ft/s (607 m/s) from the M1 carbine (18 in test barrel); a generic 110 gr FMJ figure is 1,900 ft/s. Factory loads give 1,567 ft/s at 100 yd. | **[NF]** (the 0.136 figure belongs to Speer's 110 gr JHP, a different bullet) | About 13.5 gr (0.875 g) WC820 **[U]** (forum) | https://en.wikipedia.org/wiki/.30_carbine ; https://en.wikipedia.org/wiki/M1_carbine ; https://chuckhawks.com/30cal.htm ; https://www.gunhub.com/threads/m1-carbine.52319/ |
| .45 ACP | Ball M1911 (FMJ) | 230 gr (14.90 g conv.) | 830 ft/s (253 m/s) from the M1911 (original spec reported as 850 ft/s, later 830); 935 ft/s from the Thompson; 900 ft/s from the M3 | **[NF]** | 5.0 gr (0.324 g) SR 7970, 885 ± 25 ft/s at 25.5 ft, 19,000 psi, per TM 43-0001-27 as quoted on a forum **[U]** | https://en.wikipedia.org/wiki/M1911_pistol ; https://chuckhawks.com/45ACP.htm ; https://castboolits.gunloads.com/archive/index.php/t-114977.html |
| 7.92×57 | s.S. (schweres Spitzgeschoss, 1934) | 12.8 g (197.5 gr conv.) | 760 m/s from a Kar98k with 600 mm barrel | G1 **0.557 to 0.584**; elsewhere 0.593 to 0.557 and "about 0.595". Wikipedia calls BCs "debatable". **[C]** | **[NF]** (2.75 g belongs to the old Patrone 88) | https://en.wikipedia.org/wiki/7.92%C3%9757mm_Mauser |
| 7.92×57 | S (1903 pointed bullet; reference only) | 9.9 g | n/a | G1 0.321 to 0.337 | | same |

**[NR]:** 9×19 Pist.Patr.08 (and m.E.), 7.63×25 Mauser, 7.92×33 Kurz, 7.92×57 S.m.K., 7.62×54R (L light ball, D heavy ball), 7.62×25 Tokarev, 7.62×38R Nagant, 14.5×114 (B-32), 12-gauge military buckshot, and G7 BCs for every cartridge.

---

## 6. Material penetration: not yet researched [NR]

No penetration data was gathered: wood (pine/oak), brick, concrete, sandbags/earth, sand and mild steel against .30-06, 7.92×57, 7.62×54R ball and 9×19, .45 ACP and 7.62×25. Sources to fetch next:
- FM 5-15 *Field Fortifications* (1944 edition): protection thickness against rifle and MG bullets.
- FM 5-103 *Survivability* (1985): direct-fire protection tables (7.62 mm ball and others).
- FM 21-75 *Combat Skills of the Soldier*: material protection tables.
- FM 90-10-1 / FM 3-06.11: urban-terrain penetration of brick, block and concrete.
- The ibiblio Hyperwar FM PDF directory (https://www.ibiblio.org/hyperwar/USA/ref/FM/PDFs/), which hosts WWII FMs. FM 23-45 is confirmed there; FM 5-15 is likely but not confirmed.

---

## 7. Trajectory / bullet-drop tables: not yet researched [NR]

No published drop or time-of-flight tables were gathered for .30-06 M2, 7.92×57 sS or 7.62×54R light ball. The only downrange figures found are the FM 23-5 maximum ranges in section 5. Sources to fetch next: Hatcher's Notebook ballistic tables for M1/M2 ball; the US FT (firing table) for the cal .30 M2 ball; German *Schußtafel* for s.S. ammunition, as printed in MG34/MG42 and rifle manuals (H.Dv. / D-series); the Soviet NSD *таблица превышений траектории* (trajectory-height table) for the 1908 light ball (L) in the 1891/30 manual. Computed solver output (for example from JBM) should not stand in for these published tables.

---

## 8. Fields still open for the covered US weapons

- Loaded weights, apart from the M1 Garand's 10.5 lb with bayonet.
- Front-sight types and sight radii: M1 Carbine, M1903 (A3/A4), Thompson, M3, Johnson rifle/LMG, M1911A1.
- Mechanical accuracy (MOA or dispersion) for all weapons.
- M1903A4 scope FOV and reticle.
- Thompson open-bolt confirmation and charging-handle sides (M1928A1 top, M1A1 side).
- M1919A6 weight and barrel-change procedure.
- 12-gauge 00 buck load data.
- Bazooka backblast from a primary manual.
- Mk 2 grenade casualty radius from a primary manual.
- Powder charges from primary sources (TM 9-1990, TM 9-1305-200, TM 43-0001-27).
- G1/G7 BCs for M2 ball, Carbine M1 ball and .45 Ball M1911.

Primary documents spotted in search results (not read in full):
- FM 23-5 chapters: https://www.biggerhammer.net/manuals/garand/
- TM 9-1275 intro: https://biggerhammer.net/manuals/garand/tm-intro.htm
- FM 23-35 handguns: https://www.biggerhammer.net/manuals/23-35/fm23-_2.htm
- FM 23-41 (M3 SMG) marksmanship: https://biggerhammer.net/manuals/fm23_41/CH4.PDF
- FM 23-45 (M1919A4): https://www.ibiblio.org/hyperwar/USA/ref/FM/PDFs/FM23-45.pdf and https://patcosta.com/wp-content/uploads/2022/07/FM23-45-M-1919A4.pdf
- TM 9-294 (bazooka, 1943): https://www.bulletpicker.com/pdf/TM-9-294-1943.pdf
- Thompson manual excerpts: https://www.koreanwaronline.com/arms/thompson.htm
- M1C/M1D scope manual excerpts: https://www.koreanwaronline.com/arms/m1sight.htm

---

## 9. Telescopic sights and their mounts, 1939 to 1945

Gathered for the scope option on rifles (`src/weapons/scopes.js`). Same method and legend as section 0: every value comes from **WebSearch result summaries** (WebFetch failed again with a DNS error on en.wikipedia.org), so no page was read in full. Most sources are auction listings, collector forums and magazine articles; manual figures were rarely found. Where the game needs a number no source gave, `scopes.js` marks it "est." and this section marks it **[NF]**.

The rule the game follows: a rifle may take a scope only if that rifle was really issued with it in the war, and fitting it changes what it really changed.

### 9.1 Rifle and scope pairs in the game

| Game id | Rifle and scope | Mount | In service | Clips | Iron sights | Changes to the rifle | Sources |
|---|---|---|---|---|---|---|---|
| `m1903a4` | M1903A4 with the Weaver 330C (Army M73B1) | Redfield Junior one-piece base screwed to the top of the receiver, rings; the scope lies over the action | Remington-built, 1943 on **[U]** (no adoption date found); most A4s issued had the M73B1 | **Blocked**: loaded one round at a time **[U]** (no source says so in words; the scope lies right over the clip guide) | **None**: the rifle was made without them | Bolt handle bent and cut back so the bolt opens under the scope, stock cut to match; C-type pistol grip stock | https://www.milsurps.com/threads/a-summary-of-the-1903-a1-a3-a4-development-through-history.75146/ ; https://www.shootingtimes.com/editorial/longgun_reviews_st_springmola3a4_201003/99110 ; https://lsbauctions.com/?p=84384 ; https://jouster2.com/forums/home/forum/jouster2-shooting-forums/sniper-rifles/18738-1903a4-redfield-jr-scope-base-question |
| `m1903a1_unertl` | M1903A1 (Marine Corps) with the Unertl 8x | Unertl target blocks dovetailed to the receiver and the barrel, 7.2 in apart; quarter-minute micrometer mounts | Made for the Marine Corps from about 1940; at least 3,500 scopes bought and 1,750 accepted by April 1945 (a forum post citing Poyer) **[U]**; 2,500 to 2,800 in dealers' estimates **[C]** | **Blocked** **[U]** (not found; the tube lies over the clip guide) | Not usable with the scope on **[U]** (it sits in line over them) | None found. The Marine scopes had **no return spring**: the scope slides forward in its mounts with each shot and is pulled back by hand **[U]** (forum posts; the Army marksmanship manual quoted there describes returning target scopes after each shot) | https://www.americanrifleman.org/articles/2019/10/24/the-m1903a1unertl-usmc-sniper-rifle/ ; https://www.milsurps.com/showthread.php?p=213323 ; https://legacy-collectibles.com/exceptional-u-s-m-c-j-unertl-8x-sniper-scope-with-mounts/ ; https://www.rockislandauction.com/detail/70/2687/springfield-armory-us-1903a1-rifle-unertl-telescopic-sight |
| `m1c_m81`, `m1c_m82` | M1C Garand with the M81 or M82 (Lyman Alaskan) | Griffin & Howe side mount: a rail pinned and screwed to the **left** of the receiver (five holes: three screws, two taper pins), quick-release scope on top, offset to the left | Adopted 27 July 1944 (American Rifleman) **[C]** (June 1944 is also seen); 7,971 delivered by the end of the war (Canfield, cited by auction houses); the first rifles arrived in mid 1945 and few reached the front **[U]** | **Free**: the offset keeps the top of the action clear, so the en-bloc clip goes in as before | **Usable** **[U]**: they stay on the rifle and the scope sits beside them; Forgotten Weapons says offset scopes suit a marksman who must switch quickly to irons | Leather cheek pad laced to the stock (some marked "K-Line", a wartime maker); rifles that failed the accuracy test after the mount went on were turned down (60% at first) | https://www.americanrifleman.org/articles/2014/8/29/the-m1c-garand-sniper-rifle/ ; https://forgottenweapons.com/m1c-sniper-garand ; https://www.forgottenweapons.com/m1d-sniper-garand/ ; https://www.rockislandauction.com/detail/4094/3399/us-springfield-armory-m1c-sniper-rifle-with-m82-sniper-scope ; https://scott-duff.com/?p=206 ; https://www.snipershide.com/shooting/goto/post?id=9942399 |
| `kar98k_zf39` | Kar 98k with the Zeiss Zielvier 4x on the high turret mount (the "ZF 39" system) | Turret base on the receiver ring, lever-locked rear base on the bridge, the scope over the action | Through the war; the high turret stayed in use though the side-rail mounts were simpler to make | **Blocked**: "Kar98k sniper rifles had to be manually loaded one round at a time" (Athlon) | **Usable** **[U]**: a magazine column says the turret mount has a "tunnel" so the iron sights stay usable with the scope on | Rifles picked for accuracy **[U]** | https://athlonoutdoors.com/article/the-kar98k-sniper-rifle/ ; https://www.riflemagazine.com/down-range-15 ; https://www.rockislandauction.com/detail/4098/284/wwii-german-mauser-k98k-high-turret-sniper-rifle-with-scope ; https://www.k98kforum.com/goto/post?id=112989 |
| `kar98k_zf41` | Kar 98k with the ZF 41 (1.5x) | On the rear sight base, ahead of the action (a rail on the left of the base) | From 1941; more than 100,000 made by 1945 | **Free**: it "allowed the gun to be loaded with five-round stripper clips" (American Rifleman); "allowing unimpeded [room] for stripper clips" (Forgotten Weapons) | **Usable** **[U]** (one general history site) | Rear sight base with the rail | https://www.americanrifleman.org/articles/2016/6/16/the-k98k-zf-41-the-first-scout-rifle ; https://forgottenweapons.com/assessment-of-a-zf-41-optic ; https://en.wikipedia.org/wiki/ZF41 ; https://historyrise.com/article/german-wwii-sniper-rifle-accessories-and-customization-options/ |
| `gewehr43_zf4` | Gewehr 43 with the ZF 4 (4x) | Clamp mount on the dovetail rail on the right rear of the receiver (every G43 had the rail) | 1944 and 1945 (scopes dated 1944 seen) **[U]**; Hetzenauer, the top German sniper, was issued one | Magazine, unchanged. (A G43 can also be charged with stripper clips through the top, which a scope over the receiver prevents **[U]**; the game reloads it by magazine only.) | Covered **[U]** (the scope sits over the receiver, in line with them) | None | https://www.rockislandauction.com/detail/47/1697/wwii-nazi-g43-sniper-rifle-with-zf4-scope-and-mount ; https://legacy-collectibles.com/sold-original-zf-4-scope-with-reproduction-mount/ ; https://athlonoutdoors.com/article/the-kar98k-sniper-rifle/ ; https://www.k98kforum.com/threads/g43-scope-mount.62256/post-488639 |
| `fg42_zfg42` | FG 42 with the ZFG 42 (4x) | Clamp rings on the dovetail rail on top of the receiver ("fits perfectly to the dovetail" of an FG 42 E, a forum owner) | 1943 to 1945 with the Fallschirmjäger, in small numbers | Magazine (on the left), unchanged | Folded **[U]**: the FG 42's front post flips up and its rear diopter folds | None | https://en.wikipedia.org/wiki/FG_42 ; https://rockislandauction.com/detail/63/3351/rare-world-war-ii-fg42-sniper-scope-and-mount ; https://www.k98kforum.com/goto/post?id=215088 ; https://legacy-collectibles.com/original-luftwaffe-zf4-scope-g43-k43-g41-fg42-030725-23-sj-3-19-25 |
| `mosin_pu` | Mosin-Nagant 1891/30 with the PU (3.5x) | Side mount: base on the left of the receiver, the scope over the action | From 1942 (the 91/30's PU mount was developed from spring 1942) | **Blocked** **[U]** (not found in words; the scope lies over the clip guide) | Not usable with the scope on **[U]**: nothing found either way; the scope lies over the bore, and the comb is cut for the iron sights with no riser for the scope | Long bent-down bolt handle (on every PU rifle seen; no source text found **[U]**) | https://en.wikipedia.org/wiki/PU_scope ; https://www.m9130.info/pu-snipers ; https://www.gunsandammo.com/editorial/best-world-war-ii-sniper-rifle-3-mosin-nagant/527411 ; https://lsbauctions.com/?p=75791 |
| `mosin_pem` | Mosin-Nagant 1891/30 with the PEM (4x) | Side mount (it replaced the PE's top mount around 1937 to 1938) | Made in the late 1930s (production end 1938 or later **[C]**), in service through the war | **Blocked** **[U]** | Not usable with the scope on **[U]** | Bent-down bolt handle **[U]** | https://en.wikipedia.org/wiki/PE_scope ; https://api.rockislandauction.com/detail/4094/3458/soviet-tula-m9130-mosinnagant-sniper-rifle-with-pe-scope ; https://legacy-collectibles.com/sold-1939-tula-m91-30-mosin-nagant-pe-sniper/ |
| `svt40_pu` | SVT-40 with the PU (3.5x) | A bracket locked into an extra notch on the receiver, holding the scope high over the action: a "see-through" mount (Wikipedia) | 1941 to 1942: production ended in October 1941 or in 1942 **[C]**; 51,710 sniper SVTs (Wikipedia) **[U]** | Magazine, unchanged | **Usable** under the scope **[U]** (from "see-through") | Receiver with the extra locking notch | https://en.wikipedia.org/wiki/SVT-40 ; https://www.m9130.info/pu-snipers ; https://www.k98kforum.com/goto/post?id=131192 |

### 9.2 The scopes

| Scope | Magnification | True field of view | Eye relief | Reticle | Range settings | Weight, length | Sources |
|---|---|---|---|---|---|---|---|
| Weaver 330 (Army M73B1) | 2.75x (American Rifleman); 2.5x in another American Rifleman article and 2.2x in a listing **[C]** | 35 ft at 100 yd (6.7 deg conv.) | 3.5 in (89 mm conv.) | Fine crosshair; one listing says tapered post **[C]** | Click knobs (quarter-minute clicks offered commercially), no range drum; the game sets it by range, 100 to 800 yd | 10.25 oz (0.29 kg conv.); 10.5 in (one seller: 10 7/8 in **[C]**); 3/4 in tube | https://www.americanrifleman.org/articles/2010/7/28/80-years-of-weaver-scopes/ ; https://unofficed.com/products/vintage-weaver-scope/17266332 ; https://www.milsurps.com/archive/index.php/t-60779.html ; https://www.rockislandauction.com/detail/4098/3292/wwii-us-remington-model-1903a4-sniper-rifle-with-m73b1-scope |
| Unertl 8x (Marine Corps) | Marked 8x, really 7.8x | **[NF]** (game est. 2.2 deg) | **[NF]** (game est. 6 cm) | "Medium fine crosshair" (the Marine board's requirement) | Quarter-minute micrometer mounts; the game: 100 to 1,000 yd | **[NF]** (game est. 0.7 kg, 56 cm); objective about 1.5 in | https://www.americanrifleman.org/articles/2019/10/24/the-m1903a1unertl-usmc-sniper-rifle/ |
| M81 and M82 (Lyman Alaskan) | 2.5x | 35 ft at 100 yd (6.7 deg conv.) per a 1947 manual summary; 40 ft for the commercial Alaskan in a 1938 test **[C]** | About 5 in (127 mm conv.), 1938 test of the commercial scope | M81 crosshair, M82 tapered post | Internal adjustments, no range drum; the game: 100 to 800 yd | 8 oz (0.23 kg conv.) and 10.5 in for the commercial scope; 22 mm tube. The M81 added a sliding sunshade and a rubber eyeshield **[U]**; about 1,200 M81s were made before the M82 **[U]** | https://www.koreanwaronline.com/arms/m1sight.htm ; https://americanrifleman.org/articles/2011/6/13/the-lyman-2-12-x-alaskan-scope ; https://www.snipershide.com/shooting/goto/post?id=9942399 ; https://www.rockislandauction.com/detail/4099/124/wwii-us-springfield-m1c-garand-sniper-rifle-with-m81-scope |
| Zeiss Zielvier 4x ("ZF 39") | 4x | **[NF]** (game est. 6 deg) | **[NF]** (game est. 85 mm) | Post with side bars ("Absehen 1") **[U]** | One owner's Zielvier has no range marks on its knob **[U]**; the game: 100 to 800 m | **[NF]** | https://www.k98kforum.com/goto/post?id=112989 ; https://historyrise.com/article/innovations-in-german-wwii-sniper-rifle-scope-technology/ |
| ZF 41 | 1.5x | "Narrow", "limited"; **[NF]** for a figure (game est. 7 deg) | Long: "perhaps over 12 in" (a guess by Forgotten Weapons) | **[NF]** (the game draws a pointed post) | **[NF]** (the game: 100 to 800 m) | **[NF]** | https://forgottenweapons.com/assessment-of-a-zf-41-optic ; https://www.americanrifleman.org/articles/2016/6/16/the-k98k-zf-41-the-first-scout-rifle |
| ZF 4 | 4x | **[NF]** (the 8 deg seen belongs to the modern Hensoldt ZF4-R) | **[NF]** | **[NF]** | Drum 100 to 800 m in 50 m steps (a dealer's listing) **[U]** | **[NF]**; made by Voigtländer ("ddx") and Opticotechna | https://legacy-collectibles.com/sold-original-zf-4-scope-with-reproduction-mount/ ; https://www.rockislandauction.com/detail/4098/3351/late-wwii-german-berlinlubecker-qve-45-k43-sniper-rifle |
| ZFG 42 | 4x | **[NF]** | **[NF]** | **[NF]** | **[NF]** (the game uses the ZF 4's) | A forum thread says the first ZFG 42 was aluminium and a later steel and brass type went on the FG 42; dealers say many FG 42s used Luftwaffe-marked ZF 4s in stamped rings **[C]** | https://www.k98kforum.com/goto/post?id=215392 ; https://rockislandauction.com/detail/63/3351/rare-world-war-ii-fg42-sniper-scope-and-mount |
| PU | 3.5x (3.5x21; Guns & Ammo says 3.5x20 **[C]**) | 4 deg 30 min | 72 mm | **[NF]** (the game draws a post and side bars) | Elevation drum 0 to 1,300 m in 100 m steps | 0.27 kg (9.52 oz in Guns & Ammo) | https://en.wikipedia.org/wiki/PU_scope ; https://www.gunsandammo.com/editorial/best-world-war-ii-sniper-rifle-3-mosin-nagant/527411 |
| PE and PEM | 4x; the PE focuses, the PEM does not | **[NF]**; the PU's field is smaller than the PE's | **[NF]** | **[NF]** | **[NF]** (the game: 100 to 1,400 m, est.) | **[NF]**; a "relatively large objective" | https://en.wikipedia.org/wiki/PE_scope ; https://athlonoutdoors.com/article/soviet-sniper/ |

### 9.3 What a scope did to the rifle, and what the game does with it

- **Loading.** A scope over the receiver covers the clip guide: "scope-mounted Kar98k rifles lacked the space to accommodate the strippers, so Kar98k sniper rifles had to be manually loaded one round at a time" (Athlon, above). The M1C's offset mount and the ZF 41's place ahead of the action were chosen to keep clips loading. In the game a blocked rifle pushes in every round singly, with the single-round timing it already had.
- **Iron sights.** The M1903A4 had none. The offset M1C, the ZF 39 high turret (its "tunnel"), the ZF 41 and the SVT-40's see-through bracket leave them usable **[U]**; in the game the fire mode key switches between scope and irons on those. A scope over the bore with no source for a gap under it (G43 ZF 4, FG 42, Mosin PU and PEM, the Unertl) takes them away.
- **Weight.** The scope and mount weights are added to the rifle (mostly est.): it comes up to the eye a little slower and sways a little more standing.
- **Bolt work.** The bolt handle of the M1903A4 and of the Mosin sniper rifles was bent down to clear the scope (the Kar 98k's was already turned down). The game keeps the original game's slower bolt work for the three scoped bolt rifles it had (a hand working the bolt under a scope) and gives the same to the other bolt rifles with a scope over the action; the ZF 41 leaves it as on the plain rifle. This timing is game data, not research.
- **Target scope recoil.** The Marine Unertl slides forward with each shot and is pulled back by hand **[U]**: half a second (est.) more before the next shot.
- **Cheek.** The M1C got a cheek pad to bring the eye to the offset scope; the Mosin's comb stayed cut for the iron sights (Guns & Ammo, above).
- **Accuracy.** Rifles picked for accuracy when they became sniper rifles (Kar 98k, M1C, the Unertl's National Match rifles) get a better mechanical accuracy in the game (est.); the G43, FG 42 and SVT-40 keep the plain rifle's.

### 9.4 Who may carry them

The original game gave scopes to the Recon class. A 2020 Steam thread (game data, not history) mentions Recon scopes up to 4x on the G43, SVT-40 and FG 42 and up to 2.8x on the Garand, and says infantry scopes were weakened then **[U]** (https://steamcommunity.com/app/227940/discussions/0/2968398851815318884). The game keeps scopes for Recon, with two exceptions from the history above: the ZF 41 was a marksman's sight for ordinary infantry, so infantrymen may fit it too, and the FG 42 was a paratrooper's rifle only, so its scope goes to paratroopers.

### 9.5 Left out, and why

- **M1D** (adopted September 1944, none made in the war; section 2.1) and the **M84** scope (not available in quantity until Korea).
- **M73** as a separate choice: the M1C's first scope, the same Lyman Alaskan as the M81 and M82 that replaced it within months.
- **Lyman 5A** target scope on Marine Springfields: a First World War scope, not researched **[NR]**.
- **Other Kar 98k mounts** (low turret, short and long side rail, claw mounts): the same scopes with the same effect on loading; left out to keep the choice short. Whether the side-rail mounts left the iron sights in view was not found **[NF]**.
- **PE on its top mount**, **AVS-36 with the PE** and **SVT-38** snipers: pre-war and few; the PE is the PEM's optics with a focusing ring.
- **K43 and G41 with the ZF 4**, **StG 44 with the ZF 4**: rifles not in the game, or very few.
- **Night sights** (the US infrared Sniperscope on the M2 carbine, the German Vampir on the StG 44): left out as the brief asked.

---

## 10. Close-combat weapons (knives, bayonets, spades, bats)

The original game's close-combat slot: each army's entrenching spade, a knife or bayonet, and a baseball bat (the lapta bat for the Soviets). As in sections 0 to 9, every value comes from WebSearch result summaries (WebFetch could not reach any host); dealers' and reproduction makers' listings stand in where no manual was found, so most figures are **[U]**. "est." in `src/weapons/items/melee.js` marks a value chosen for the game where nothing was found.

| Item (game id) | Overall length | Blade | Mass | Sources |
|---|---|---|---|---|
| US M3 trench knife (`knife_m3`) | 11.75 in (298 mm) | 6.75 in (171 mm), spear point | 230 g (a French reference); 8.4 to 9 oz (238 to 255 g conv.) for reproductions **[C]** | https://en.wikipedia.org/wiki/M3_trench_knife ; https://www.dday-overlord.com/?p=133817 ; https://www.bladehq.com/item--Ontario-Mark-III-M3-Trench-Knife--11288 |
| US M-1910 entrenching tool, "T-handle" (`spade_m1910`) | 22 in (559 mm); 56.5 to 57 cm for reproductions | 7 in (178 mm) wide (museum entry) | about 0.6 kg (reproduction); 1.5 lb (0.68 kg conv.) **[U]** | https://hub.catalogit.app/oklahoma-national-guard-museum/folder/entry/entrenching-tool ; https://therupturedduck.com/products/us-t-m1910-handled-entrenching-tool ; https://armyandoutdoors.co.nz/products/us-repro-m1910-t-handle-shovel |
| German small entrenching tool, kleines Schanzzeug (`spade_ge`) | about 21 to 22 in (533 to 559 mm) **[C]** (dealers; one gives a 14 in handle) | 7.5 to 7.75 in long, 5.6 to 5.75 in wide (190 to 197 x 143 to 146 mm conv.); 18.5 x 14.5 cm (mp44.nl) | **[NF]** (game est. 0.9 kg) | https://www.ima-usa.com/products/german-wwii-square-head-entrenching-tool-schanzzeug ; https://mp44.nl/equipment/entrenching_tool.htm |
| German Seitengewehr 84/98 (`bayonet_s84_98`) | 385 mm; 15 to 15.25 in from dealers | 252 mm, single edge with a fuller | **[NF]** (game est. 0.4 kg) | https://en.wikipedia.org/wiki/S84/98_III_bayonet ; https://www.ima-usa.com/products/original-german-wwii-98k-1942-dated-bayonet-by-paul-weyersberg-with-scabbard-frog |
| Soviet MPL-50 small infantry spade (`spade_mpl50`) | 50 cm (52 cm in one maker's listing) **[C]** | about 15 cm wide, 18 cm long | 0.55 kg (a modern maker) **[U]** (game est. 0.8 kg for wartime steel) | https://en.wikipedia.org/wiki/MPL-50 ; https://www.ima-usa.com/products/original-russian-wwi-era-mpl-50-entrenching-tool-with-rare-imperial-eagle-still-visible-dated-1914 ; https://enex.market/en/product/lopata-malaya-pekhotnaya-mpl-50/ |
| Soviet NR-40 scout's knife (`knife_nr40`) | 10.5 in (267 mm conv.) **[U]** | 152 mm, clip point; S-shaped guard, black wooden grip | 5 oz (142 g conv.) **[U]** | https://ww2db.com/weapon.php?q=a252 ; https://en.wikipedia.org/wiki/NR-40 ; https://armorvenue.com/get/russian-nr-40-wwii-scout-recon-knife/ |
| Soviet AVS-36 bayonet (`bayonet_avs36`) | 450 mm without scabbard | 335 mm (another listing: a 10 in knife blade) **[C]** | **[NF]** (game est. 0.5 kg) | https://cornet.cc/en/photos/121704 ; https://ima-usa.com/products/original-soviet-pre-wwii-1936-avs-36-rifle-first-model-bayonet-rare |
| Baseball bat, 1930s (`bat_us`, `bat_ge`) | 35 in (889 mm) for two game-used bats of 1932 and 1936 to 1937 | | 34.3 oz and 37 to 39 oz (0.97 to 1.11 kg conv.) **[U]**; the game: 36 oz (1.02 kg) | https://www.mearsonlineauctions.com/1932_Frank_Frisch_St__Louis_Cardinals_H_B_Louisvil-LOT5452.aspx ; https://lelands.com/bids/1936-1937-billy-southworth-game-used-bat |
| Lapta bat (`bat_lapta`) | 60 to 110 cm, at most 5 cm across (the sport's rules) | | **[NF]** (game: 80 cm of birch, est. 0.6 kg) | https://legalacts.ru/doc/prikaz-minsporta-rossii-ot-28042014-n-272-ob-utverzhdenii/ |

**The German bat.** Baseball was a demonstration sport at the Berlin Olympics: one game on 12 August 1936 between two American teams before about 90,000 to 100,000 people (https://en.wikipedia.org/wiki/Baseball_at_the_1936_Summer_Olympics). No source describes the bats; the game gives the German soldier the same 35 in American bat, darker.

**Timing of a blow.** A 2024 review of stabbing biomechanics gives knife motions of 0.62 to 1.07 s at 5 to 10 m/s, and for a forward thrust 0.61 +- 0.15 s, an overhand stab 0.68 +- 0.14 s (https://doaj.org/article/9675550f62944fdeb8e06adc32d1943f). A batter's swing from the start of the downswing to contact takes about 0.15 s (MLB average 0.149 s, https://blastmotion.com/blog/what-is-time-to-contact-in-baseball/), but a soldier swinging a bat or a spade one-handed from the shoulder first has to raise it. The game: a knife 0.55 s a blow, landing 0.2 s in; a bayonet 0.6 s (0.22 s); a spade 0.75 s (0.34 s); a bat 0.9 s (0.42 s) (est., within the measured thrust times for the blades).

**Reach and damage** are the original game's, not research: a stab with a knife or bayonet kills with one blow to the head or body; a spade or bat with one to the head or two to the body. Reach from the eyes: 1.0 m for a knife, 1.3 m for a spade or bayonet, 1.4 m for a bat (est.).

## 11. Binoculars and pocket pistols

Gathered for the binoculars slot (`src/weapons/items/binoculars.js`) and the pocket pistols (`src/weapons/items/pocket.js`, their rounds in `src/weapons/ammo.js`). Same method and legend as section 0: WebFetch failed again with a DNS error (en.wikipedia.org), so every value comes from **WebSearch result summaries** and no page was read in full. Values the game needs and no source gave are marked "est." in the data files and **[NF]** here.

### 11.1 Binoculars (6x30, all three armies)

| Glasses | Magnification and field | Reticle | Mass | Sources |
|---|---|---|---|---|
| US Binocular M3 | 6x30 **[NF]** for the M3's own field; 6x30 Porro glasses of the period: 8.5 deg (8 deg 30 min) | In the left telescope: a horizontal mil scale marked every 10 mils, from 50 mils left to 50 right of center (TM 9-575). Late glasses: a finer scale, 5-mil marks to 40 mils each side, in the lower part of the field | **[NF]** (game est. 0.58 kg) | https://www.ibiblio.org/hyperwar/USA/ref/TM/pdfs/TM9-575.pdf ; https://archive.org/download/TM9-1581/TM9-1581.pdf |
| German Dienstglas 6x30 | 6x30; field **[NF]** (game: 8.5 deg, as the period's 6x30s) | A "Strichplatte" range-estimation scale in 1/6400 (Strich), visible in the right eyepiece (dealer descriptions **[U]**); its pattern **[NF]** (the game draws a horizontal scale marked every 5 Strich and a vertical one rising from the middle, est. from photos) | **[NF]** (game est. 0.55 kg); a 1927 to 1962 Leitz 6x30 of 8.5 deg weighs 17 oz (0.48 kg) | https://milivault.com/products/87449 ; https://monocular.info/dienstglas6x30.htm ; https://www.l-camera-forum.com/leica-wiki.en/index.php/BIDOXIT |
| Soviet B-6 (6x30) | 6x, field 8 deg 30 min (a Russian training text on reconnaissance) | An angle-measuring scale for horizontal and vertical angles (same text); its pattern **[NF]** (the game draws a scale in thousandths, 1/6000, est.) | **[NF]** (game est. 0.6 kg) | https://zabgu.ru/files/html_document/pdf_files/fixed/Zadaniya_VUC/Razvedyvatelnaya_podgotovka_Tema_6._Zanyatie1.pdf |

Makers of the Dienstglas (dealer listings): ddx (Voigtlander), bmj and bek (Hensoldt), Leitz, Swarovski (cag), Emil Busch; late-war glasses in dark yellow paint. Soviet 6x30s of 1940 to 1941 from GOMZ.

What the game does with it: raised to the eyes (the aim key), the view has the real 6x magnification (as a scope's, `player.js`) and the figure-eight of the two eyepieces spans the 8.5 deg true field across; the reticle is drawn in the middle of the view, where both eyes see it. Fire spots, as in Heroes & Generals: the enemy nearest the middle of the view (within 1.5 deg), whose head or chest can be seen past walls and thick bushes, is marked for the whole side for 10 seconds (`src/game/spotting.js`). The spotting rules are game data, not history.

### 11.2 Pocket pistols

| Pistol | Cartridge | Length, barrel | Magazine | Mass (empty) | Muzzle velocity | Sources |
|---|---|---|---|---|---|---|
| Colt Model 1903 Pocket Hammerless | .32 ACP | 6.75 in (171 mm); 3.75 in (95 mm) from the Type II on (the first had 4 in) | 8 | 24 oz (680 g) | **[NF]** from this pistol; the load's 905 ft/s (276 m/s) from a test barrel (game est. 270 m/s) | https://wikipedia.com/wiki/Colt_M1903_.32_ACP ; https://www.americanrifleman.org/articles/2019/3/26/tested-colt-1903-parkerized-pistol ; https://www.alloutdoor.com/?p=362908 |
| Beretta M1934 | 9 mm Corto (.380 ACP) | 152 mm (150 or 155 in other sources **[C]**); 94 mm (88 or 86 **[C]**) | 7 | 660 g (617 g in the one German-service source **[C]**) | 229 m/s (Wikipedia), 251 and 290 m/s elsewhere **[C]** (game: 260 m/s) | https://en.wikipedia.org/wiki/Beretta_M1934 ; https://ww2db.com/weapon.php?q=S14 ; https://www.armedconflicts.com/-t11962 |
| Korovin TK (Tula Korovin) | 6.35 mm (.25 ACP) | 127 mm; 67.5 mm | 8 | 423 g (485 g loaded) | 228 m/s | https://en.wikipedia.org/wiki/Korovin_pistol ; https://americanrifleman.org/content/rifleman-q-a-soviet-tula-korovin-pistol ; https://forgottenweapons.com/1926-tula-korovin-the-first-soviet-semiauto-pistol |

German service: the M1934 as "9 mm P 671(i)" (armedconflicts.com, above; **[U]**: the only source for the designation). The Colt 1903 was issued to US general officers and, Parkerized and marked "U.S. Property", in the war (American Rifleman, above). The Korovin was made at Tula from 1926 to 1935.

**Ammunition.**

| Round | Bullet | Diameter | Velocity (test barrel) | Ballistic coefficient (G1) | Sources |
|---|---|---|---|---|---|
| .32 ACP ball | 71 gr (4.60 g, conv.) FMJ round nose | .3125 in (7.94 mm) | 905 ft/s (276 m/s, conv.) | 0.134 (Magtech's listing **[U]**) | https://powdervalley.com/product/magtech-ammo-32-auto-71-grain-fmj-50-rounds ; https://www.chuckhawks.com/32ACP.htm |
| .380 ACP / 9 mm Corto ball | 95 gr (6.16 g, conv.) FMJ | .355 in (9.02 mm) | 920 ft/s (280 m/s, conv.) | **[NF]** (game est. 0.09) | https://admin.grafs.com/catalog/product/productId/81824 |
| .25 ACP ball | 50 gr (3.24 g, conv.) FMJ | .251 in (6.38 mm) | 755 to 770 ft/s for most makers (about 230 m/s, conv.); 654 ft/s measured from a 2.1 in Baby Browning | 0.090 (Magtech's listing **[U]**) | https://en.wikipedia.org/wiki/.25_ACP ; https://bullets-brass.com/Product/Details/1181310 ; https://www.ar15.com/forums/Handguns/Fiocchi-25-ACP-50gr-FMJ-in-Clear-Ballistics-Gel-/20-192627/ |

Powder charges, reload times, recoil and accuracy figures for the three pistols are game estimates, scaled from the service pistols' data.
