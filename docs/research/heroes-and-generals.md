# Heroes & Generals: research dossier for a fan recreation

Compiled 2026-10-23. Scope: history, the strategic "Generals" layer, factions, soldier progression, and content lists (infantry weapons, ground vehicles, aircraft).

## How to read this report (method, source tiers, limitations)

**Tools that worked and tools that did not.**
- WebFetch could not open any page in this session (DNS failure on every host; archive.org and reddit.com refused). Plain `curl` was blocked by the proxy (HTTP 403). So I could not open Wikipedia, the fandom wiki, Steam, PC Gamer, Rock Paper Shotgun or archive.org snapshots directly.
- **WebSearch worked** until the shared per-turn search budget ran out (after about 70 searches by me). WebSearch returns a machine summary of the pages it finds. Facts tagged **[W]** come from those summaries. I cite the page each summary attributed the fact to, but I could not read the page myself, so the exact wording on the page is not verified.
- **GitHub code search worked.** It surfaced a fan project, [raouldeheer/Heroes-and-Generals-community-project](https://github.com/raouldeheer/Heroes-and-Generals-community-project), whose folder `packages/hagcp-assets/json/` holds JSON template tables (vehicles, weapon variants, ammunition, assault teams, ranks, ribbons, badges, maps and so on) that its author pulled from the live game servers with a custom client. The repository was created on 2022-01-05. Its battle-pass table lists seasons up to one running to 2023-03-28, so **the dump reflects the live game in late 2022 or early 2023, its final state.** Facts tagged **[D]** come from these files. They are first-hand game data, but some fields are cryptic, and where I interpret a field I say so.
  - Permalink base used below for [D] links: `https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/<file>.json`
- **unconfirmed** means I could not verify the item. **Conflict** means my sources disagree, and I list each version.

**Not covered** because I could not reach the sources: reviews (PC Gamer, Rock Paper Shotgun), SteamDB concurrent-player figures, archive.org snapshots of wiki.heroesandgenerals.com and heroesandgenerals.com, and Reddit threads. See section 6.

---

## 0. Quick facts

| Item | Value | Source |
|---|---|---|
| Developer | Reto-Moto (Danish studio founded 2008 by former IO Interactive founders) | [W] [MobyGames](https://mobygames.com/company/11232/reto-moto-aps), [Wikipedia: Reto-Moto](https://en.wikipedia.org/wiki/Reto-Moto) |
| Later owner | TLM Partners (later reported as "TLM Games"), from February 2022 | [W] [Business Wire](https://www.businesswire.com/news/home/20220203005289/en/RETO-MOTO-Transfers-the-Heroes-Generals-Business-to-TLM-Partners), [Game Developer](https://www.gamedeveloper.com/business/wwii-mmo-i-heroes-generals-i-shuts-down) |
| Engine | Retox, Reto-Moto's in-house engine, able to run in a browser | [W] [ModDB: Retox](https://www.moddb.com/engines/retox/articles), [IndieDB: Retox](https://www.indiedb.com/engines/retox) |
| Genre | Free-to-play WWII online FPS with a persistent strategy ("Generals") layer | [W] [Engadget 2011](https://www.engadget.com/2011-10-12-reto-moto-announces-persistent-wwii-shooter-heroes-and-generals.html) |
| Factions | United States, Germany, Soviet Union (the Soviets were added 2 March 2015) | [D] [factiontemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/factiontemplate.json); [W] [MassivelyOP](https://massivelyop.com/2015/03/02/heroes-generals-update-adds-soviet-faction/) |
| Full release | 23 September 2016 | [W] [MassivelyOP](https://massivelyop.com/2016/09/23/mmofps-heroes-generals-has-officially-launched-today/), [Wikipedia](https://en.wikipedia.org/wiki/Heroes_%26_Generals) |
| Shutdown | Announced 31 January 2023; servers offline 25 May 2023 | [W] [Game Developer](https://www.gamedeveloper.com/business/wwii-mmo-i-heroes-generals-i-shuts-down), [MMOs.com](https://mmos.com/news/heroes-generals-shutting-down-unreal-engine-sequel-in-development) |
| Registered players | "over 22 million players registered" (TLM's closing statement) | [W] [Game Developer](https://www.gamedeveloper.com/business/wwii-mmo-i-heroes-generals-i-shuts-down) |

---

## 1. History

### 1.1 Developer and founders
- Reto-Moto was formed in **2008** by former IO Interactive founders **Jacob Andersen, David Guldbrandsen, Jesper Vorsholt Jørgensen and Martin Pollas**, after IO Interactive was sold to Eidos in March 2004. [W] [MobyGames](https://mobygames.com/company/11232/reto-moto-aps), [Wikipedia: Reto-Moto](https://en.wikipedia.org/wiki/Reto-Moto)
- The studio was based in Denmark: a Reto-Moto press release is titled "The World's Largest Army Headquartered in Denmark". [W] [Newswire](https://www.newswire.com/news/the-worlds-largest-army-headquartered-in-denmark-14818928). The city (Copenhagen) is **unconfirmed**.
- **Publishing:** Square Enix signed a temporary publishing agreement in **November 2012**. [W] [Wikipedia: Reto-Moto](https://en.wikipedia.org/wiki/Reto-Moto), [Guru3D](https://www.guru3d.com/story/heroes-generals-to-be-published-by-square-enix/), [DSOGaming](https://www.dsogaming.com/news/heroes-generals-to-be-published-by-square-enix-new-screenshots-trailer-released/). Square Enix and Reto-Moto jointly announced the open beta in 2013. [W] [Everyeye](https://www.everyeye.it/notizie/heroes-generals-ora-in-open-beta-151420.html). When and how the Square Enix deal ended is **unconfirmed**. Wikipedia's infobox reportedly lists Reto-Moto as publisher from 2016 to 2022. [W] [Wikipedia](https://en.wikipedia.org/wiki/Heroes_%26_Generals)
- **Sale to TLM:** TLM Partners announced that it had acquired Heroes & Generals and related businesses from Reto-Moto. Business Wire dates the release 3 February 2022; Wikipedia says 4 February 2022 (**conflict** of one day). Reto-Moto filed a bankruptcy notice on 7 March 2022. [W] [Business Wire](https://www.businesswire.com/news/home/20220203005289/en/RETO-MOTO-Transfers-the-Heroes-Generals-Business-to-TLM-Partners), [Wikipedia: Reto-Moto](https://en.wikipedia.org/wiki/Reto-Moto)

### 1.2 Engine (Retox)
- Retox was Reto-Moto's proprietary engine, described as "capable of running in a browser" and built for Heroes & Generals. [W] [ModDB: Retox](https://www.moddb.com/engines/retox/articles), [IndieDB: Retox](https://www.indiedb.com/engines/retox)
- A later update gave the game a new render engine with "significant performance improvements" and experimental DirectX 12 support (date **unconfirmed**). [W] [DSOGaming tag page](https://www.dsogaming.com/tag/heroes-generals/)
- In January 2023 the owner said Retox had become antiquated, and that the sequel would use Unreal Engine 5. [W] [Wikipedia](https://en.wikipedia.org/wiki/Heroes_%26_Generals). MassivelyOP blamed "outdated" back-end technology. [W] [MassivelyOP](https://massivelyop.com/?p=562349)

### 1.3 Release timeline

| Date | Event | Source |
|---|---|---|
| 12 Oct 2011 | Reto-Moto announces Heroes & Generals as a persistent WWII shooter | [W] [Engadget](https://www.engadget.com/2011-10-12-reto-moto-announces-persistent-wwii-shooter-heroes-and-generals.html) |
| 2012 | Closed beta, with testers recruited through beta keys (E3 2012 coverage); the game was played through the browser | [W] [Gaming Nexus](https://www.gamingnexus.com/FullNews/E3-2012-Screen-Shots-and-first-Videolog-for-Heroes--Generals-released-/Item26930.aspx), [Engadget 19 Jun 2012](https://www.engadget.com/2012-06-19-heroes-and-generals-brings-persistent-shooter-action-to-your-brows.html) |
| (alpha) | Closed alpha dates are **unconfirmed** | none found |
| Nov 2012 | Temporary publishing deal with Square Enix | [W] [Wikipedia: Reto-Moto](https://en.wikipedia.org/wiki/Reto-Moto) |
| 1 Mar 2013 | Open beta; the game becomes free to play for everyone | [W] [Everyeye](https://www.everyeye.it/notizie/heroes-generals-ora-in-open-beta-151420.html) |
| 11 Jul 2014 | Released on Steam. Wikipedia calls it a "pre-release beta"; PCGamesN and MassivelyOP call it Early Access. PCGamesN describes it as "one of the first ten games to be Greenlit" (wording from the search summary). | [W] [Wikipedia](https://en.wikipedia.org/wiki/Heroes_%26_Generals), [PCGamesN](https://pcgamesn.com/heroes-generals/heroes-generals-ongoing-evolution-weve-had-to-loosen-up-in-order-to-appeal-to-a-larger-audience) |
| 2 Mar 2015 | "Timoshenko" update adds the Soviet Union as a third faction | [W] [MassivelyOP](https://massivelyop.com/2015/03/02/heroes-generals-update-adds-soviet-faction/), [GameSpot](https://www.gamespot.com/articles/heroes-generals-gets-soviet-update/1100-6425508/), [PCGamesN](https://www.pcgamesn.com/heroes-generals/from-russia-with-love-heroes-generals-update-adds-soviet-faction-1000-new-battlefields-and-14-new-vehicles), [Worthplaying](https://worthplaying.com/article/2015/3/2/news/95118-heroes-generals-content-update-adds-russian-faction-and-more-trailer/) |
| 23 Sep 2016 | Leaves early access; official launch | [W] [MassivelyOP](https://massivelyop.com/2016/09/23/mmofps-heroes-generals-has-officially-launched-today/), [MMOBomb](https://www.mmobomb.com/news/heroes-generals-promoted-beta-now-fully-launched) |
| 11 Dec 2018 | v1.13 update "rebrands game", adds a new map and tanks | [W] [Worthplaying](https://worthplaying.com/article/2018/12/11/news/112151-heroes-generals-v113-update-rebrands-game-adds-new-map-tanks-and-more/) |
| 23 Nov 2021 | Battle pass "season 0" begins (seasons 1 to 3 followed through March 2023) | [D] [battle_pass_season_template.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/battle_pass_season_template.json) |
| 3/4 Feb 2022 | TLM Partners acquires the game | see 1.1 |
| 31 Jan 2023 | Shutdown "within the next 6 months" announced, together with *Heroes & Generals 2: The Next War* on Unreal Engine 5 | [W] [MMOs.com](https://mmos.com/news/heroes-generals-shutting-down-unreal-engine-sequel-in-development) |
| 13 Feb to 14 Apr 2023 | Kickstarter for HnG2. The goal was first stated as $3M and later reduced to $2M; it reportedly ended at $111,675, unfunded. | [W] [MMOs.com](https://mmos.com/news/heroes-generals-shutting-down-unreal-engine-sequel-in-development), [Stop Killing Games wiki](https://stopkillinggames.wiki.gg/wiki/Heroes_&_Generals), [Game Developer](https://www.gamedeveloper.com/business/wwii-mmo-i-heroes-generals-i-shuts-down) |
| 25 May 2023 | Servers shut down | [W] [Game Developer](https://www.gamedeveloper.com/business/wwii-mmo-i-heroes-generals-i-shuts-down), [MMO Fallout](https://mmofallout.com/2023/05/25/heroes-generals-is-officially-dead-now/), [Delisted Games](https://delistedgames.com/heroes-generals-shuts-down-on-may-25th/) |

### 1.4 Platforms
- Windows PC. During the beta years the game ran from the web browser. [W] [Engadget 2012](https://www.engadget.com/2012-06-19-heroes-and-generals-brings-persistent-shooter-action-to-your-brows.html), [ModDB: Retox](https://www.moddb.com/engines/retox/articles)
- Steam from July 2014. [W] [Wikipedia](https://en.wikipedia.org/wiki/Heroes_%26_Generals)
- Epic Games Store (release date **unconfirmed**). [W] [Prima Games](https://primagames.com/?p=314045)
- I found no evidence of console versions (**unconfirmed**).

### 1.5 Business model
- **Free to play** from the open beta in March 2013. [W] [Everyeye](https://www.everyeye.it/notizie/heroes-generals-ora-in-open-beta-151420.html)
- **Currencies:**
  - **Credits**, earned by playing.
  - **Gold**, the premium currency. Characters could be hired for credits or gold: for example, the wiki's Characters page lists an Infantry character at about 9,200 credits or 110 gold. [W] [wiki: Characters](https://heroesandgenerals.fandom.com/wiki/Characters)
  - **Warfunds**, the war-mode currency used to buy and resupply Assault Teams (see 2.9). [W] [wiki: File:Warfunds](https://heroesandgenerals.fandom.com/wiki/File:Warfunds.png)
  - Assault Teams could also be bought with gold; the wiki gives gold equivalents next to warfund prices. [W] [wiki: Assault Team Costs](https://heroesandgenerals.fandom.com/wiki/Assault_Team_Costs)
- **Premium membership ("Veteran").** The packages still for sale in the final data were 1, 3, 30, 90 and 180 days, all using benefit set 2: credits ×1.25, warfunds ×1.75. Older items (benefit set 1: credits ×1.5, warfunds ×1.25, including a "Veteran" item) and 7, 10, 14 and 365-day items are flagged not for sale. Both sets give XP ×2, ribbon XP ×1.25, squad XP ×1.05, plus a **second combat-badge slot** and a **fourth equipment slot**. [D] [MembershipBenefitTemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/MembershipBenefitTemplate.json), [ShopMembershipItems.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/ShopMembershipItems.json). The data also contains a 30-day "DiscordNitro" membership item.
- **War Bonds.** These were investment items with a fixed series size, a 3 to 6 month term, a nominal value and monthly interest, sold in Gold or Credits. Example: series "Series-A", 100 gold nominal value, 7 gold interest per month, 6 months. [D] [ShopWarBondItemTemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/ShopWarBondItemTemplate.json)
- **Battle pass**, from November 2021 (see the timeline). [D] (same file as in the timeline)
- Other monetised items appear in the data: boosters, character packs, store bundles and weapon skins ("variants"). Prices are **unconfirmed**. [D] [WeaponVariantTemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/WeaponVariantTemplate.json)
- Real-money prices of gold are **unconfirmed**. Purchases of in-game currency were disabled when the shutdown was confirmed. [W] [Wikipedia](https://en.wikipedia.org/wiki/Heroes_%26_Generals)

### 1.6 Player counts
- "over 22 million players registered" (TLM, May 2023). [W] [Game Developer](https://www.gamedeveloper.com/business/wwii-mmo-i-heroes-generals-i-shuts-down)
- "8 million players" milestone, reported during early access (exact date **unconfirmed**). [W] [KeenGamer](https://www.keengamer.com/articles/news/heroes-generals-beats-8-million-players-mark/)
- Peak and average concurrent players (SteamDB) are **unconfirmed**; I could not reach SteamDB.

### 1.7 Shutdown: when and why
- **31 Jan 2023:** TLM announced the game "will shut down within the next 6 months" and that the team would move to building a playable prototype of *Heroes & Generals 2: The Next War* on Unreal Engine 5. A Kickstarter was planned for 13 February 2023. [W] [MMOs.com](https://mmos.com/news/heroes-generals-shutting-down-unreal-engine-sequel-in-development)
- **Stated or reported reasons:** a pivot to the sequel, which TLM called "the next step towards an even more exciting future". [W] [Game Developer](https://www.gamedeveloper.com/business/wwii-mmo-i-heroes-generals-i-shuts-down). The Retox engine had become antiquated or outdated. [W] [Wikipedia](https://en.wikipedia.org/wiki/Heroes_%26_Generals), [MassivelyOP](https://massivelyop.com/?p=562349). Players also claimed the game was unprofitable, but that is a user claim, not an official statement. [W] [Steam discussion](https://steamcommunity.com/app/227940/discussions/0/3909745662428887800)
- **25 May 2023:** servers offline. Game Developer says this was "over a month after its developer announced the game would be coming to an end", which probably refers to the later confirmation of the exact date rather than the January announcement (**unconfirmed** interpretation). The shutdown went ahead even though the Kickstarter failed. [W] [Game Developer](https://www.gamedeveloper.com/business/wwii-mmo-i-heroes-generals-i-shuts-down), [Delisted Games](https://delistedgames.com/heroes-generals/)

### 1.8 Successors and revival projects
- ***Heroes & Generals 2: The Next War*** (TLM, Unreal Engine 5). The Kickstarter failed and the game was never released. [W] [Stop Killing Games wiki](https://stopkillinggames.wiki.gg/wiki/Heroes_&_Generals), [Game Developer](https://www.gamedeveloper.com/business/wwii-mmo-i-heroes-generals-i-shuts-down)
- **Fan server revival ("HnG Group").** The group's Patreon says it "used a lot of time reverse engineering the game and built the new Game servers". [W] [Patreon: hnggroup](https://www.patreon.com/hnggroup/about), [project page](https://www.hng-group.com/RevivalJourney). Wikipedia reports this sequence (single source; dates not cross-checked) [W] [Wikipedia](https://en.wikipedia.org/wiki/Heroes_&_Generals):
  - a restored **2013** build in **December 2024**;
  - a **2014** build in **February 2025**;
  - a **2017** edition in **May 2025**, after which the 2014 build was shut down;
  - the final **2023** version, released **12 June 2026**.
- A Steam thread describes the community **2017 build** as playable, with no progression and all equipment usable, hosted by community members. [W] [Steam: "H&G 2017 version now playable"](https://steamcommunity.com/app/227940/discussions/0/592888717905032164/)
- A forum post notes the revival is in a legal grey area because it has no permission from the IP holders. [W] [Enlisted forum](https://forum.enlisted.net/t/anybody-here-excited-for-the-heroes-and-generals-fan-re-release/175609)
- **Insight Interactive "Heroes & Generals Rebuild".** A clean rebuild in Unreal Engine 5; its site lists "Stage 1: Foundation & Validation (2026 to 2027)". It grew out of a purchase of the U.S. trademark ("Oleson"). A crowdfunding campaign was planned for mid-2026, and the FAQ says the studio is not affiliated with Reto-Moto. Whether the crowdfunding launched is **unconfirmed**. [W] [Insight Interactive](https://www.insightinteractive.studio/heroes-generals), [FAQ](https://www.insightinteractive.studio/faq), [MassivelyOP 5 Dec 2025](https://massivelyop.com/2025/12/05/the-official-rebuild-of-heroes-generals-is-planning-a-crowdfunding-campaign-next-year/)
- **Code projects on GitHub:**
  - raouldeheer's "Heroes and Generals community project", described as a client "for the RTS part of the game"; it is the source of the [D] data. [GitHub](https://github.com/raouldeheer/Heroes-and-Generals-community-project), plus the [hgapi](https://github.com/raouldeheer/hgapi) and [hgdesktop](https://github.com/raouldeheer/hgdesktop) repositories.
  - "heroes and generals private server from old days" (2017). [GitHub: l4v4ph0x/priv8hng_sisvalid](https://github.com/l4v4ph0x/priv8hng_sisvalid)
  - A 2016 map-ripping project. [GitHub: Ravest95/MapRipperProject-HeroesAndGenerals-2016](https://github.com/Ravest95/MapRipperProject-HeroesAndGenerals-2016)
  - None of these repositories could be opened directly in this session; see section 6.
- An overview video of the revival projects: [YouTube](https://www.youtube.com/watch?v=_mlRJ6rHWMg) (not watched).

### 1.9 Content-update timeline (what was added when, where known)
- **2 Mar 2015, "Timoshenko".** Soviet faction: infantry, tankers, fighter pilots and paratroopers; the T-34-85 Model 1944, the Yak-9D and the PPSh-41. Also "14 new vehicles" and "1,000 new European battlefields", a rebalance of all weapons, three-faction victory conditions, retreat and supply-line skirmish mechanics, and battles that can include all three factions. [W] [MassivelyOP](https://massivelyop.com/2015/03/02/heroes-generals-update-adds-soviet-faction/), [PCGamesN](https://www.pcgamesn.com/heroes-generals/from-russia-with-love-heroes-generals-update-adds-soviet-faction-1000-new-battlefields-and-14-new-vehicles)
- **23 Jul 2015, "Walker".** New weapons, scopes, tweaks and balancing; which weapons is **unconfirmed**. [W] [Worthplaying](https://worthplaying.com/article/2015/7/23/news/96665-heroes-generals-walker-update-adds-new-weapons-scopes-tweaks-and-balancing/)
- **"Zhukov"** (date **unconfirmed**). Expanded light-tank play with new Soviet and German armour. [W] [MassivelyOP tag](https://massivelyop.com/tag/heroes-&-generals)
- **"Young"** (date **unconfirmed**). "Big changes". [W] [Wccftech](https://wccftech.com/heroes-generals-young-update-arrives-with-big-changes/)
- **11 Aug 2016, "Furness: Fist of Steel".** A Soviet tank destroyer plus a heavy and a medium tank; which models is **unconfirmed**. [W] [KeenGamer](https://www.keengamer.com/articles/news/heroes-generals-furness-fist-of-steel-update-out-now/)
- **"Red Army Amphibious! Light tank and a car!"** Steam news (date and vehicles **unconfirmed**; the T-38 is the Soviet amphibious light tank in the data). [W] [Steam News](https://store.steampowered.com/news/app/227940/view/2889578330857659404)
- **"Stronghold" update.** New map, new tanks (date **unconfirmed**). [W] [Fandom article](https://www.fandom.com/articles/1839-heroes-generals-stronghold-update-brings-new-map)
- **New map plus tank destroyers** (date **unconfirmed**). [W] [MMORPG.com](https://www.mmorpg.com/news/heroes-and-generals-updated-with-new-map-tank-destroyers-and-more-2000099852)
- **"Forward Airfield" assault map** (date **unconfirmed**). [W] [PCGamesN](https://www.pcgamesn.com/heroes-generals/heroes-generals-update-adds-the-forward-airfield-assault-map)
- **Dec 2018, v1.13.** New map and tanks. [W] [Worthplaying](https://worthplaying.com/article/2018/12/11/news/112151-heroes-generals-v113-update-rebrands-game-adds-new-map-tanks-and-more/)
- **"BIPODS ARE HERE!"** Steam news, about June 2019 (date inferred from the feed URL). [W] [Steam News](https://store.steampowered.com/news/posts/?appids=227940&enddate=1559809274)
- **v1.15 "war update".** "Every battle, including staged battles, now counts towards the War", and the war map can be viewed before, during and after battle (date **unconfirmed**). [W] Probably [wiki: Previous Changelogs](https://heroesandgenerals.fandom.com/wiki/Previous_Changelogs) (attribution uncertain).
- Update codenames appear to run alphabetically (Timoshenko, Walker, Xylander, Young, Zhukov); this pattern is an observation, **unconfirmed**. [W] [MassivelyOP tag](https://massivelyop.com/tag/heroes-&-generals)

---

## 2. The "Generals" strategic layer (War / campaign map)

### 2.1 The overall loop
- The **Strategy Game** is played on the campaign map, where player-owned **Assault Teams (ATs)** are moved around to create **War Battles**, with the goal of winning the war. [W] [wiki: Strategy Game](https://heroesandgenerals.fandom.com/wiki/Strategy_Game)
- The **Action Game** is the first-person shooter where those battles are fought. Battles are either **staged** (equal ATs on both sides) or **war** battles (the ATs the generals committed, which can be equal or unequal). [W] [wiki: Action Rules](https://heroesandgenerals.fandom.com/wiki/Action_Rules)
- Early design pitch (2012): the strategic map has "contested cities, factories, airfields and war torn country-sides" with "hundreds of key locations". Players manage resources and reinforcements to secure locations. Factories produce resources such as armoured vehicles and planes, and cities produce manpower. [W] [Blue's News 2011](https://www.bluesnews.com/s/126418/heroes-generals-announced), [PCGamesN "everything we know"](https://www.pcgamesn.com/HeroesandGenerals/heroes-and-generals-everything-we-know). This describes the early design; in the final data, production is a faction-wide timer (2.7).

### 2.2 War length and victory conditions
- **Victory:** "Capture and hold 15 major cities", or make the opponents lose all their major cities. [W] [wiki: Victory conditions](https://heroesandgenerals.fandom.com/wiki/Victory_conditions), [wiki: Strategy Game](https://heroesandgenerals.fandom.com/wiki/Strategy_Game)
- The map has **23 capitals**, each worth 1 victory point in the data. Each faction starts with **3** capitals; the other 17 start neutral. [D] [capital.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/capital.json); [W] [wiki: Campaign map](https://heroesandgenerals.fandom.com/wiki/Campaign_map)
- **Three-faction victory conditions** arrived with the Soviet update in March 2015. [W] [MassivelyOP](https://massivelyop.com/2015/03/02/heroes-generals-update-adds-soviet-faction/)
- **War rewards:** the winning faction's players get **+250 warfunds per active AT**, plus a status effect worth +5% character rank XP and +5 AT XP. [W] [wiki: Strategy Game](https://heroesandgenerals.fandom.com/wiki/Strategy_Game). The data matches: `warfundBonus 250`, `xpBonusPercent 5`, and `aTDeployCostPercent 4.75`, whose meaning (likely a discount on AT deployment) is **unconfirmed**. [D] [WarBonusTemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/WarBonusTemplate.json)
- **War length:** no official figure found. Old player threads suggest most wars lasted about 3 to 8 days (anecdotal, **unconfirmed**). [W] [Steam: switching factions during war](https://steamcommunity.com/app/227940/discussions/0/34096318966371915/), [Steam: can you not switch wars](https://steamcommunity.com/app/227940/discussions/0/45350791832652922/)
- **Faction lock:** threads indicate a player could not switch faction mid-war (**unconfirmed** detail). [W] (same threads)

### 2.3 Map geography
- **The 23 capitals** in the final (2022) campaign map [W] [wiki: Campaign map](https://heroesandgenerals.fandom.com/wiki/Campaign_map), [wiki: Strategy Game](https://heroesandgenerals.fandom.com/wiki/Strategy_Game):
  - **Germany starts with:** Budapest, Rome, Athens
  - **United States starts with:** Arnhem, Saint-Quentin, Edinburgh
  - **Soviet Union starts with:** Leningrad, Warsaw, Donetsk
  - **Neutral at start (14):** Berlin, Bucharest, Copenhagen, Frankfurt, Kiev, London, Marseille, Minsk, Oslo, Prague, Riga, Stockholm, Vichy, Zürich
  - In other words, the map covers Europe from the British Isles and Scandinavia to the Balkans and Ukraine, and the starting capitals are deliberately non-historical.
- **Older versions differed.** An older Steam guide gives Germany Berlin and Rome, the USA London and Edinburgh, and the USSR Moscow and Leningrad. [W] [Steam guide "How does the game work?"](https://steamcommunity.com/sharedfiles/filedetails/?id=279849228). This is a **conflict** with the 2022 list, and probably reflects a different war-map version.
- **Map point types:** capital, airfield, town, mountain town, factory. Points are linked by supply lines and are the strategy-game equivalent of capture points. Aircraft launch only from airfields, forward airfields or capitals. [W] [wiki: Map point](https://heroesandgenerals.fandom.com/wiki/Map_point), [wiki: Airfield](https://heroesandgenerals.fandom.com/wiki/Airfield), [wiki: Factory](https://heroesandgenerals.fandom.com/wiki/Factory), [wiki: Mountain Town](https://heroesandgenerals.fandom.com/wiki/Mountain_Town)
- **Supply-line colours:** blue for your side, red for the enemy, grey for contested or neutral. ATs need an unbroken friendly (blue) chain back to a friendly capital to be resupplied. [W] [wiki: Basic Game Tutorial (outdated)](https://heroesandgenerals.fandom.com/wiki/Basic_Game_Tutorial_-_outdated)
- Some towns were "adjusted since they didn't exist in WWII" (from a patch note). [W] Probably [wiki: Previous Changelogs](https://heroesandgenerals.fandom.com/wiki/Previous_Changelogs); the search summary did not say which page it came from. **The full list of non-capital towns is unconfirmed**; I could not retrieve it.
- **Battle maps (FPS terrains) in the final data.** Scene files are prefixed T01 (French countryside), T02 (Ardennes and mountains), T03 (city) and T04 (Russia). [D] [gamemap.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/gamemap.json)
  - "Town" (Medium French Village)
  - "Mountain Town" (ardennes_mountains)
  - "Factory" (ardennes_tank_factory)
  - "Airfield" (ardennes_airfield)
  - "Forward Airfield"
  - "Samrée Depot", "Colmar Hamlet" (Mill), "Lunéville" (tank encounter), "Canal Bridge" (recon encounter), "Gorge" (mountain tank encounter), "Sawmill", "Village Skirmish", "Hill 60"
  - "Russian Factory", "Vasyugan Fortification", "Russian Skirmish", "Russian Encounter"
  - "City River", "City Boulevard", "City Train"
  - "Mountain Railroad", "New Test Skirmish Map"
- **Town assault map:** five possible attack routes to the centre. Attackers must take the **Police Station (O1)** and the **Church (O2)**. [W] [wiki: Town](https://heroesandgenerals.fandom.com/wiki/Town)

### 2.4 Assault Teams (ATs)

**Types and upgrade tree.** The tree is identical for all three factions. In the table, CP is my reading of the data field `size`; it matches the wiki's command-point costs. [D] [commandnodetemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/commandnodetemplate.json); [W] [wiki: Assault Team](https://heroesandgenerals.fandom.com/wiki/Assault_Team), [wiki: Guard](https://heroesandgenerals.fandom.com/wiki/Guard), [wiki: Motorized Guard](https://heroesandgenerals.fandom.com/wiki/Motorized_Guard), [wiki: Mechanized Infantry](https://heroesandgenerals.fandom.com/wiki/Mechanized_Infantry), [wiki: Light Armor](https://heroesandgenerals.fandom.com/wiki/Light_Armor), [wiki: Medium Armor](https://heroesandgenerals.fandom.com/wiki/Medium_Armor), [wiki: Heavy Armor](https://heroesandgenerals.fandom.com/wiki/Heavy_Armor)

| Branch (owner class) | AT (data name) | Level | Upgrades from | CP | Map speed (data) | Composition: resources (in-battle vehicle spawn slots) |
|---|---|---|---|---|---|---|
| Infantry (Infantry character) | Guard | 0 | (buy) | 1 | 0.48 | 36 infantry |
| | Motorized Guard | 1 | Guard | 1 | 1.80 | 36 infantry + 12 motorcycles (1 slot) |
| | Infantry | 1 | Guard | 2 | 0.60 | 90 infantry |
| | Motorized Infantry | 2 | Infantry | 2 | 1.56 | 90 infantry + 30 cars ("terrain vehicles") (2 slots) |
| | Mechanized Infantry | 3 | Motorized Infantry | 2 | 1.44 | 100 infantry + 10 APCs (1 slot) |
| Recon (Recon character) | Recon | 0 | (buy) | 1 | 0.72, view range 2 | 20 recon |
| | Motorized Recon | 1 | Recon | 1 | 1.98, view 3 | 24 recon + 24 motorcycles (2 slots) |
| | Mechanized Recon | 2 | Motorized Recon | 1 | 1.68, view 4 | 28 recon + 14 armoured cars (2 slots) |
| Armour (Tank Crew character) | Light Armor | 0 | (buy) | 1 | 0.96 | 20 tank crew + 16 light tanks (2 slots) |
| | Medium Armor | 1 | Light Armor | 2 | 0.54 | 20 tank crew + 18 medium tanks (4 slots) |
| | Heavy Armor | 2 | Medium Armor only | 2 | 0.45 | 16 tank crew + 14 heavy tanks (4 slots) |
| | Medium Tank Destroyer | 1 | Light Armor | 1 | 0.72 | 16 tank crew + 14 tank destroyers (2 slots) |
| | Heavy Tank Destroyer | 2 | Medium TD | 2 | 0.45 | 12 tank crew + 10 heavy TDs (4 slots) |
| Airborne (Paratrooper character) | Pathfinders (in the air) / Pathfinders on ground | 0 | (buy) | 1 | 3.0 air / 0.54 ground | 36 paratroopers + 9 transport planes (1 slot); on the ground, 36 paratroopers |
| | Paratroopers (in the air) / Paratroopers on ground | 1 | Pathfinders | 2 | 2.7 air / 0.48 ground | 72 paratroopers + 18 transport planes (1 slot); on the ground, 72 paratroopers |
| Air (Fighter Pilot character) | Fighter Recon | 0 | (buy) | 1 | 3.0, view 4 | 20 pilots + 16 recon planes (2 slots) |
| | Fighter Squadron | 1 | Fighter Recon | 2 | 5.2 | 24 pilots + 24 fighters (4 slots) |
| | Heavy Fighter Squadron | 2 | Fighter Squadron | 2 | 5.6 | 24 pilots + 24 heavy fighters (2 slots) |

Composition source: [D] [commandnodetemplatearmyresourcetemplaterelation.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/commandnodetemplatearmyresourcetemplaterelation.json). It matches the wiki's figures for the infantry line and for Medium Armor (20 tank crew + 18 medium armour). "Vehicle spawn slots" is the data field `vehicleSpawnSlots`; my guess is that it caps how many of the AT's vehicles can be in play at once in a battle (**unconfirmed**).

Notes and conflicts:
- **Medium tank destroyer path.** The wiki says the Medium Tank Destroyer costs 1 CP and cannot be upgraded to Heavy Armor. The data agrees (`size 1`) and shows that it upgrades to the Heavy Tank Destroyer instead. [W] [wiki: Heavy Armor](https://heroesandgenerals.fandom.com/wiki/Heavy_Armor); [D] (as above)
- **Older type lists.** Older wiki lists name "Infantry, Guards, Recon, Light/Medium/Heavy Tanks, Tank Destroyers and Fighter Squadrons" [W] [wiki: Strategy Game](https://heroesandgenerals.fandom.com/wiki/Strategy_Game), and "Paratroopers", "Light/Medium/Heavy Armor" and "Recon Fighter" [W] [wiki: Talk:Assault Team](https://heroesandgenerals.fandom.com/wiki/Talk:Assault_Team). The names changed between versions.
- **Air AT radii.** Air ATs have `attackradius` and `transportradius` in the data: pathfinders 1950/3800, paratroopers 1850/3600, fighter recon 550/1850, fighter squadron 950/2850, heavy fighter squadron 1650/3450. [D] (as above)
- **Who may command what.** Infantry characters can command infantry ATs only; Generals can deploy every kind of AT. [W] [Steam discussion](https://steamcommunity.com/app/227940/discussions/0/606068060820224219/). Rank gates such as "Motorized Infantry requires Infantry rank 15 or General" and "Motorized Guard: Infantryman rank 12+ or General" appear on wiki pages, possibly outdated (**unconfirmed**). [W] [wiki: Motorized Guard](https://heroesandgenerals.fandom.com/wiki/Motorized_Guard). The data links each AT to an owning character class through `generalCharacterTemplateId`: 1 Infantry, 2 Fighter Pilot, 4 Paratrooper, 5 Tank Crew, 6 Recon. [D] (as above)

**Buying.** Only level-0 ATs can be bought outright; higher levels are upgrades. [W] [wiki: Assault Team](https://heroesandgenerals.fandom.com/wiki/Assault_Team). Cost **conflicts** across versions:
- Latest wiki table (warfunds): Infantry 14,000 (51 gold), Recon 28,500, Motorized Recon 24,000, Motorized Guard 24,000, Motorized Infantry 30,000, Mechanized Infantry 30,000. [W] [wiki: Assault Team](https://heroesandgenerals.fandom.com/wiki/Assault_Team)
- Older wiki values ("old stuff"): Infantry 36,500, Paratroopers 73,000, Light Armor 65,500, Medium Armor 94,000, Heavy Armor 166,000, Recon Fighter 89,500. [W] [wiki: Talk:Assault Team](https://heroesandgenerals.fandom.com/wiki/Talk:Assault_Team)
- Another wiki page: Infantry 36,500 (1,029 gold), Light Armor 79,500 (1,129 gold), Fighter Squadron 118,500 (1,219 gold). [W] [wiki: Assault Team Costs](https://heroesandgenerals.fandom.com/wiki/Assault_Team_Costs)
- An older guide: Light Armor 44,500, Paratroopers 46,000, Heavy Armor 30,000. [W] [gamepressure](https://www.gamepressure.com/heroesandgenerals/assault-teams-basic-information/z47616)

**AT experience and levels:** an AT needs 350 XP for level 1, 3,450 for level 2 and 9,200 for level 3. [D] [AssaultTeamLevel.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/AssaultTeamLevel.json). ATs gain "30 or 5 xp depending on victory or loss". AT battles were "by far the fastest way to earn rank xp" for the owning soldier. [W] [Steam discussion](https://steamcommunity.com/app/227940/discussions/0/1499000547486683687)

**Deploying and moving.**
- ATs are deployed only at capitals; the owner picks which capital, and needs enough warfunds and the required resources. [W] [wiki: Strategy Game](https://heroesandgenerals.fandom.com/wiki/Strategy_Game)
- Ground ATs move along supply lines. Air ATs fly directly between airfields: to a battle and back, or to another friendly airfield. [W] [wiki: Strategy Game](https://heroesandgenerals.fandom.com/wiki/Strategy_Game), [wiki: Battle System](https://heroesandgenerals.fandom.com/wiki/Battle_System)
- For paratrooper ATs, the ground element stays at the battle and the aircraft return to the airfield. [W] [wiki: Battle System](https://heroesandgenerals.fandom.com/wiki/Battle_System). The data models this as pairs of nodes ("paratroopers" and "paratroopers_on_ground") that convert into each other. [D] (as above)
- Aircraft cannot take part in skirmishes; an air AT in a skirmish is un-deployed. [W] [wiki: Battle System](https://heroesandgenerals.fandom.com/wiki/Battle_System)

**Un-deployment.** An AT is un-deployed when it:
- loses all its resources;
- loses an auto-resolved battle;
- ends an action battle on the losing side;
- or when its owner joins a new war.

[W] [wiki: Un-deployed](https://heroesandgenerals.fandom.com/wiki/Un-deployed)

**Morale (final data).** Morale runs from 0 to 100. An AT loses 20 per battle, gains 10 per win, regenerates 0.15 per minute and **surrenders at 25**. [D] [CommandNodeMoraleTemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/CommandNodeMoraleTemplate.json). How visible this was to players is **unconfirmed**.

### 2.5 How battles were generated from the war map
- A **skirmish** happens when ATs meet on a supply line between map points, or in a battle for an access point. An **assault** happens at a map point where opposing teams meet. [W] [wiki: Battle System](https://heroesandgenerals.fandom.com/wiki/Battle_System), [wiki: Action Rules](https://heroesandgenerals.fandom.com/wiki/Action_Rules)
- Moving an AT toward an enemy-held, occupied area creates a war battle. Winning the skirmish on the supply line next to a city lets you attack that city. [W] [wiki: Strategy Game](https://heroesandgenerals.fandom.com/wiki/Strategy_Game)
- **Mission types** in the data: Assault ("Eliminate all enemy opposition"), Destruction, Skirmish, Supply, Encounter, Specialist Encounter, Pilot Encounter, Recon Encounter. [D] [missiontype.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/missiontype.json)
- **Mission presets** in the data [D] [missionpreset.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/missionpreset.json):
  - Assault and "Assault Small" on Airfield, Tank Factory, Forward Airfield, Mountain Village and Medium French Village: up to **36 players**.
  - Capture-and-hold Skirmish on Forest, King of the Hill, Village and Russian Skirmish: 36 players, objective hold time 180 s.
  - Encounters (Depot, Mill, Russian): 24 to 36 players.
  - Tank, Pilot and Recon Encounters: 16 players, hold time 600 s.
  - Assaults on Russian Factory, Russian Fortress and the three City maps are flagged unavailable in the final data.
- **Tickets and resources.** The infantry and vehicles inside the committed ATs work as spawn tickets. One infantry spawn or resupply costs **40 warfunds**, and each infantry kill pays the killer's General 40 warfunds. [W] [wiki: File:Warfunds](https://heroesandgenerals.fandom.com/wiki/File:Warfunds.png)
- **Battle Director.** A battle counts as "fun" when each faction has spawn tickets for about **18 players** (two-faction battle). If one side is not "fun", an **auto-resolve timer starts at 10 minutes**. [W] [wiki: Battle Director](https://heroesandgenerals.fandom.com/wiki/Battle_Director)
- **Assault rules.** Attackers must capture all objectives. The time limit is **30 minutes**; if time runs out while the attackers hold an objective, the game goes to sudden death. [W] [wiki: Getting Started](https://heroesandgenerals.fandom.com/wiki/Getting_Started). Assault maps have 2 or 3 main control points depending on the map. [W] [Wikipedia](https://en.wikipedia.org/wiki/Heroes_%26_Generals)
- **Skirmish rules** (early design): "Skirmishes are fought over three simultaneously open control points". "Major battles" are fought through control of supply lines toward central map objectives. [W] [Blue's News](https://www.bluesnews.com/s/126418/heroes-generals-announced)
- From v1.15, every battle, staged ones included, counted toward the war. [W] [wiki: Previous Changelogs](https://heroesandgenerals.fandom.com/wiki/Previous_Changelogs)
- **Three-faction battles** (from March 2015): "Battles can now have soldiers, vehicles and planes from all three factions fighting over the same objectives". A third faction could join a war mission that had not yet been "activated" (patch note). [W] [MassivelyOP](https://massivelyop.com/2015/03/02/heroes-generals-update-adds-soviet-faction/); the patch-note line probably comes from [wiki: Previous Changelogs](https://heroesandgenerals.fandom.com/wiki/Previous_Changelogs) or [Steam discussion "town map 3-way"](https://steamcommunity.com/app/227940/discussions/0/1620599015900533119/) (attribution uncertain).

### 2.6 Generals and high command
- **General** is a sixth character class used only in the strategy game; there are five playable FPS classes plus the General. [W] [wiki: Characters](https://heroesandgenerals.fandom.com/wiki/Characters), [heroes-generals.fandom.com](https://heroes-generals.fandom.com/wiki/File:SUINF.png). In the data the General has 0 equipment points. [D] [charactertemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/charactertemplate.json)
- **Promotion:** a character becomes eligible at **rank 18**. The upgrade is free but **permanent**: the character can no longer fight in action battles and earns XP only from strategy-game results, up to rank 22. [W] [wiki: Generals](https://heroesandgenerals.fandom.com/wiki/Generals), [wiki: Characters](https://heroesandgenerals.fandom.com/wiki/Characters)
- The Characters page also lists hiring a General directly for about 1.97M credits or 9,900 gold, with "progression level 12". [W] [wiki: Characters](https://heroesandgenerals.fandom.com/wiki/Characters)
- **Command Points (CP)** are the budget for ATs:
  - CP are earned at rank 12, rank 15, then one per rank up to 22, which gives two. An Officer reaches 4 CP; a General gets 6 more, for 10 in total. The rank table shows 5 CP at rank 18 and 6 at rank 19.
  - War Victory ribbons add up to +3 CP, starting at ribbon level 4.
  - An older guide puts the first CP at rank 11 (**conflict**, probably an older version).
  - [W] [wiki: Command Points](https://heroesandgenerals.fandom.com/wiki/Command_Points), [wiki: Ranks](https://heroesandgenerals.fandom.com/wiki/Ranks), [gamepressure](https://www.gamepressure.com/heroesandgenerals/basics/z675fd)
- The data also contains non-player nodes "hq", "commander" and "reserve" (level 10) for each faction. Their purpose is **unconfirmed**. [D] [commandnodetemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/commandnodetemplate.json)

### 2.7 Faction resources and supply
- **Faction-wide resource pools.** In the final data, every 600 seconds each faction produces a fixed amount of each resource category, starting from a war-start stock. The values are identical for all three factions. [D] [ArmyResourceProductionTemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/ArmyResourceProductionTemplate.json), category names from [armyresourcecategory.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/armyresourcecategory.json)

| Resource category | Produced per 10 min | Stock at war start | Avg size (data `avgSize`) |
|---|---|---|---|
| infantryman | 900 | 850,000 | 1 |
| paratrooper | 25 | 0 | 1 |
| recon | 37 | 30,000 | 1 |
| tank_crew | 54 | 13,500 | 1 |
| fighter_pilot | 13 | 7,000 | 1 |
| motorcycle | 180 | 60,000 | 20 |
| terrain_vehicle (cars) | 160 | 75,000 | 10 |
| armoured_car | 5 | 2,400 | 15 |
| armored_personnel_carrier | 18 | 11,000 | 25 |
| light_armor | 19 | 4,000 | 30 |
| medium_armor | 9 | 1,250 | 35 |
| heavy_armor | 2 | 225 | 40 |
| tank_destroyer | 8 | 2,000 | 45 |
| heavy_tank_destroyer | 6 | 1,200 | 50 |
| fighter_plane | 3 | 1,800 | 50 |
| heavy_fighter_plane | 3 | 1,400 | 60 |
| recon_plane | 6 | 6,000 | 40 |
| transport_plane | 6 | 0 | 55 |

- Each category also carries `captureTransferMultiplierWar 0.3` and `captureTransferMultiplierStaged 0.1`. My guess is that these are the share of resources transferred or captured in war and staged battles respectively; the meaning is **unconfirmed**. [D] [armyresourcecategory.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/armyresourcecategory.json)
- **Supply lines** connect map points; an AT must be linked back to a friendly capital to resupply (2.3). [W] [wiki: Basic Game Tutorial (outdated)](https://heroesandgenerals.fandom.com/wiki/Basic_Game_Tutorial_-_outdated). The 2015 Soviet update added "retreat and supply-line skirmish mechanics". [W] [MassivelyOP](https://massivelyop.com/2015/03/02/heroes-generals-update-adds-soviet-faction/)

### 2.8 "Resistance": not confirmed
- I could **not** confirm any game mechanic called "resistance". The only "Greek Resistance" hit was a player group page on the wiki. [W] [wiki: Greek Resistance](https://heroesandgenerals.fandom.com/wiki/Greek_Resistance)
- Mechanics that may be what you remember:
  - AT **morale** and surrender (2.4);
  - the **underdog bonus**: according to players, an XP and warfunds bonus tied to faction population online, not to war progress, and not a combat bonus [W] [Steam: underdog bonus](https://steamcommunity.com/app/227940/discussions/0/483368526590019302), [Steam: fix your war bonus](https://steamcommunity.com/app/227940/discussions/11/133262848297656918/);
  - the winner's **war bonus** (2.2).
- If "resistance" was a 2013 or 2014 feature (for example on the original war map), it may be documented only in archive.org snapshots of wiki.heroesandgenerals.com, which I could not reach (**unconfirmed**).

### 2.9 Warfunds economy
- Warfunds can be earned in War battles once a player reaches **player level 10**. [W] [gamepressure "War mode"](https://www.gamepressure.com/heroesandgenerals/war-mode/z17613)
- Soldiers (Heroes) earn warfunds by defending, capturing, raiding and neutralising objectives. Generals earn them when their ATs kill enemies and destroy vehicles. [W] [wiki: File:Warfunds](https://heroesandgenerals.fandom.com/wiki/File:Warfunds.png)
- Players reported that the warfund split between commanders in the same battle was randomised. [W] [Steam discussion](https://steamcommunity.com/app/227940/discussions/0/2549465882915898047)
- **AT bonuses in the data:** each AT node has `victoryWarfundBonus` and `participationWarfundBonus` (for example Guard 150/400, Infantry 150/800, Heavy Armor 7,586 to 8,936/0). The premium warfund multiplier is 1.25 and the campaign mission XP multiplier is 1.5. [D] [commandnodetemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/commandnodetemplate.json), [ExperienceLevels.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/ExperienceLevels.json)

---

## 3. Factions (USA, Germany, Soviet Union)

- **Faction IDs** in the data: 1 United States (US), 2 Germany (GE), 3 Soviet Union (USSR). [D] [factiontemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/factiontemplate.json)
- **Origins:** the US and Germany were the launch factions; the Soviet Union joined on 2 March 2015. [W] [MassivelyOP](https://massivelyop.com/2015/03/02/heroes-generals-update-adds-soviet-faction/)
- **Shared systems.** By the final version the factions were mechanically mirrored:
  - the same AT tree [D] [commandnodetemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/commandnodetemplate.json);
  - the same resource production [D] [ArmyResourceProductionTemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/ArmyResourceProductionTemplate.json);
  - the same classes;
  - three starting capitals each.
- **What distinguished them** was mainly the arsenal (full lists in section 5). Highlights:
  - **Standard rifle:** all three infantry factions start with a semi-automatic rifle: M1 Garand (US), Gewehr 43 (GE), SVT-40 (SU). [W] [wiki: Infantryman](https://heroesandgenerals.fandom.com/wiki/Infantryman), [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals)
  - **"Assault" automatic weapon (infantry only):** US M1/M2 Carbine, GE Sturmgewehr 44, SU AVS-36. The wiki groups these as "Assault Rifles". [W] [wiki: Weapons](https://heroesandgenerals.fandom.com/wiki/Weapons); [D] [ribbontemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/ribbontemplate.json)
  - **Anti-tank:**
    - US: Bazooka M1A1 and M9A1, M18 recoilless rifle.
    - GE: Panzerschreck, Granatbüchse 39, Panzerbüchse 39 AT rifle, Panzerfaust 60 as a map pickup.
    - SU: PTRD-41 and PTRS-41 AT rifles, Ampulomet as the "launcher" slot, RPG-43 AT grenade.
    - [W] [wiki: Weapons](https://heroesandgenerals.fandom.com/wiki/Weapons), [wiki: PTRD-41](https://heroesandgenerals.fandom.com/wiki/PTRD-41), [wiki: Bazooka M1A1](https://heroesandgenerals.fandom.com/wiki/Bazooka_M1A1); [D] [weaponAmmoMapping.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/weaponAmmoMapping.json)
  - **Paratrooper-specific automatic weapons:** GE FG 42 (paratroopers only); US Johnson M1941 (infantry and paratroopers); none for the SU. [D] [ribbontemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/ribbontemplate.json)
  - **Submachine guns:** the Soviets had three, including drum-fed guns: the PPD-40 (drum), the PPSh-41 (71-round drum) and the PPS-43. [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals)
  - **APCs:** the US and Germany had half-tracks (M3A1, SdKfz 251) plus trucks; the Soviets had only the GAZ-AAA truck in the final data. A ribbon entry suggests the Soviets may have used the M3A1 half-track at some point (**unconfirmed**). [D] [vehicletemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/vehicletemplate.json), [ribbontemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/ribbontemplate.json)
  - **Transport aircraft:** only the US C-47A and the German Ju-52/3m exist in the final data. Which transport Soviet paratroopers used is **unconfirmed**. [D] [vehicletemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/vehicletemplate.json)
- **Faction balance perception** (opinion only): players asked "Why are russians the weakest faction?" and "Why does the soviet faction lose so much?". [W] [Steam](https://steamcommunity.com/app/227940/discussions/0/1353742967808762306/), [Steam](https://steamcommunity.com/app/227940/discussions/0/350532795330870959/)
- **Uniforms:** each class has a default uniform per faction in the data. [D] [charactertemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/charactertemplate.json)

---

## 4. Soldier progression

### 4.1 Classes
Five playable classes plus the RTS-only General. [W] [wiki: Characters](https://heroesandgenerals.fandom.com/wiki/Characters)

| Class (data name) | Equipment points (data) | `deployPoolCost` / off-class cost (data; meaning unconfirmed) | Hire cost at rank 0 (wiki) | Drives or flies | Owns AT branch |
|---|---|---|---|---|---|
| Infantry (`rifleman`) | 10 | 10 / 50 | about 9,200 credits or 110 gold | light vehicles, APCs | Guard / Infantry line |
| Paratrooper (`paratrooper`) | 8 | 28 / 200 | about 71k credits or 850 gold | (parachutes from transports) | Pathfinders / Paratroopers |
| Recon (`recon`) | 8 | 60 / 200 | about 208k credits or 2,500 gold | armoured cars | Recon line |
| Tank Crew (`tankcrew`) | 6 | 100 / 300 | **unconfirmed** | tanks, tank destroyers | Armour and TD lines |
| Fighter Pilot (`fighterpilot`) | 6 | 100 / 300 | about 200k credits or 2,000 gold | aircraft | Fighter line |
| General (`general`) | 0 | 0 | about 1.97M credits or 9,900 gold (or promote at rank 18) | none | any AT |

Sources: [D] [charactertemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/charactertemplate.json); [W] [wiki: Characters](https://heroesandgenerals.fandom.com/wiki/Characters), [NamuWiki: Class](https://en.namu.wiki/w/%ED%9E%88%EC%96%B4%EB%A1%9C%EC%A6%88%20%EC%95%A4%20%EC%A0%9C%EB%84%88%EB%9F%B4%EC%8A%A4/%EB%B3%91%EA%B3%BC). Vehicle-to-class mapping is from ribbon class requirements (4.9).

- **Hire-cost conflict:** an older wiki Starter Guide gives Infantry 22,000 credits / 230 gold and Recon 187,000 / 1,450. You first buy a "Character Slot", then pick a class, and you can only buy classes you have unlocked. [W] [wiki: Starter Guide](https://heroesandgenerals.fandom.com/wiki/Starter_Guide?cookieSetup=true), [wiki: Characters](https://heroesandgenerals.fandom.com/wiki/Characters)
- The data also has a `cost` field per class (rifleman 3000, paratrooper 6425, tankcrew 7725, fighterpilot 7975, recon 8325) in an **unconfirmed** unit. [D] [charactertemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/charactertemplate.json)
- **No later classes** (medic, engineer and so on) exist as separate classes. Medic, anti-tank and similar roles were handled by **careers**, ribbons and badges inside the five classes (4.6 and 4.7). [D] [CharacterCareerTemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/CharacterCareerTemplate.json)

### 4.2 Loadout slots and equipment points
- **Weapon slot categories:** `primary`, `sidearm`, `closecombat`, `equipment`. [D] [weaponslotcategory.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/weaponslotcategory.json)
- **Equipment-point budget per class:** Infantry 10, Paratrooper 8, Recon 8, Tank Crew 6, Pilot 6. [D] [charactertemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/charactertemplate.json). The wiki confirms "a German infantryman has 10 equipment points and can carry most weapons available to their faction". [W] [wiki: Loadouts](https://heroesandgenerals.fandom.com/wiki/Loadouts)
- **Equipment slots:** premium membership unlocks a **fourth equipment slot**, so the base was three (inference). It also unlocks a **second combat-badge slot**, so the base was one. [D] [MembershipBenefitTemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/MembershipBenefitTemplate.json)
- **Point costs per item** are **unconfirmed**; there was no weapon-template table in the data I could read.

### 4.3 Ranks and XP
- **Ranks run 0 to 22.** Cumulative XP needed, from the final data [D] [ExperienceLevels.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/ExperienceLevels.json):

| Rank | Cumulative XP | Rank | Cumulative XP | Rank | Cumulative XP |
|---|---|---|---|---|---|
| 0 | 0 | 8 | 41,000 | 16 | 1,498,000 |
| 1 | 10 | 9 | 52,500 | 17 | 2,534,000 |
| 2 | 1,000 | 10 | 64,500 | 18 | 5,035,000 |
| 3 | 3,000 | 11 | 77,000 | 19 | 9,036,000 |
| 4 | 6,500 | 12 | 101,000 | 20 | 13,037,000 |
| 5 | 11,000 | 13 | 160,000 | 21 | 17,038,000 |
| 6 | 19,500 | 14 | 219,000 | 22 | 29,040,000 |
| 7 | 30,000 | 15 | 462,000 | | |

- The wiki Ranks page matches this table for ranks 17 to 22 [W] [wiki: Ranks](https://heroesandgenerals.fandom.com/wiki/Ranks). Other wiki pages give different numbers, which are **conflicts**: General tips has rank 7 at 66,000 and rank 15 at 559,000; the Generals page has rank 18 at 5,132,000 and rank 22 at 29,137,000. These are probably older versions. [W] [wiki: General tips](https://heroesandgenerals.fandom.com/wiki/General_tips), [wiki: Generals](https://heroesandgenerals.fandom.com/wiki/Generals)
- **Milestones:** first Command Point at rank 12, General eligibility at rank 18 (see 2.6).
- **Vehicle rank gates** quoted on the wiki: M5A1 Stuart rank 1; M3 Lee rank 4; M4A1 Sherman rank 7; StuG III and SU-85 rank 8; Jagdpanther and SU-100 rank 11; Tiger II rank 12. Medium Armor AT command rank: 12 or 15 (**conflict** between pages). [W] [wiki: Armor](https://heroesandgenerals.fandom.com/wiki/Armor), [wiki: Light Armor](https://heroesandgenerals.fandom.com/wiki/Light_Armor), [wiki: Medium Armor](https://heroesandgenerals.fandom.com/wiki/Medium_Armor)
- **Rank titles** (Private, Corporal and so on, per faction) are **unconfirmed**; no source I reached listed them.
- **XP multipliers:** premium XP ×2. Character XP from AT battles is the fastest source (see 2.4). [D] [MembershipBenefitTemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/MembershipBenefitTemplate.json)

### 4.4 Player (account) level
- 12 account levels with cumulative thresholds 0, 250, 900, 1,700, 2,500, 3,400, 4,400, 5,800, 7,250, 8,900, 19,000 and 37,500. [D] [PlayerLevel.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/PlayerLevel.json)
- Levels unlock items of several types, such as credits (5,000 to 100,000), character classes, slots and features [D] [PlayerLevelUnlock.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/PlayerLevelUnlock.json); the type codes are not decoded, so the details are **unconfirmed**.
- War and warfunds open at player level 10 (2.9).

### 4.5 Ribbons (per-character mastery tracks)
- **Ribbons have 12 levels**, with thresholds 500, 1,500, 3,500, 7,500, 15,500, 19,500, 29,500, 41,500, 73,500, 90,500, 132,500 and 184,500 (ribbon XP). [D] [ribbonlevel.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/ribbonlevel.json), [RibbonLevelUpgradeTemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/RibbonLevelUpgradeTemplate.json)
- **Ribbon categories** in the data [D] [ribbontemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/ribbontemplate.json):
  - **General:** Physical Training, Combat Movement, Parachute
  - **Roles:** Defense, Tactical, Medic, Recon
  - **Combat:** Infantry Assault, Explosives, Tank Destruction, Close Combat, Handgun Assault, SMG Assault, LMG Assault
  - **Driving:** Driver, Chauffeur
  - **Pilot:** Dog Fight, Tactical Bomber, Ground Support
  - **Tank:** Tank Driver, Armor Assault, Armor Damage
  - **War:** War Victory, Battle
  - **Squad:** Squad Leader, Squad Member
  - **One "Specialist" ribbon per weapon or vehicle** (for example "M1 Garand Specialist", "Panther Ausf. G Specialist")
- **War Victory** ribbon levels 4 and up grant extra Command Points (2.6). [W] [wiki: Command Points](https://heroesandgenerals.fandom.com/wiki/Command_Points)
- What each Specialist ribbon level unlocks (for example weapon modifications) is **unconfirmed**; the requirement table only links ribbons to classes, weapons and vehicles. [D] [RibbonRequirement.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/RibbonRequirement.json)
- **Ribbons, not rank, open the weapons and vehicles (final game).** The unlock table `progressionUnlock` has 2,727 rows: `unlockType` 1 is "ribbon `unlockMetaName` at level `unlockMetaLevel`" (2,701 rows), `unlockType` 2 is "rank `unlockMetaLevel`" (26 rows). Item type 2 is a weapon (`weapontemplate` id) and 4 a vehicle (`vehicletemplate` id); the other item type codes are not decoded. Rank rows give a Command Point at ranks 12 and 15 to 22 (item type 11) and five items of type 1 at ranks 5, 6, 8, 9 and 17 whose meaning is **unconfirmed** (possibly equipment slots). No weapon or vehicle is opened by rank. [D] [progressionUnlock.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/progressionUnlock.json)
- **Ribbon class masks** (`characterClassRequirement`; 1 infantry, 2 pilot, 4 paratrooper, 8 tank crew, 16 recon): Infantry Assault 21 (infantry, paratrooper, recon), LMG Assault 1 (infantry), SMG Assault, Handgun Assault, Explosives and Tank Destruction 31 (all), Parachute 6 (pilot, paratrooper), the three tank ribbons 8. [D] [ribbontemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/ribbontemplate.json)
- **Own-army weapons by ribbon level** (item type 2; classes in brackets where they differ):
  - US: M1 Garand Infantry Assault 0; M3 Grease Gun IA 1 (tank crew Armor Damage 0); Mk IIIA1 IA 3; Mk II Explosives 3; Bazooka M1A1 IA 4; M1 Carbine IA 5 (paratrooper Parachute 4); M1903 IA 6; BAR IA 7; M1/M2 Carbine IA 12; Johnson LMG LMG Assault 5 (paratrooper Parachute 9); M1919 LMG Assault 12; M1A1 Carbine Parachute 6 (tank crew Armor Damage 9); Thompson SMG Assault 9; M1911 Handgun Assault 5; M1917 Handgun Assault 9; Bazooka M9A1 Tank Destruction 5.
  - Germany: Gewehr 43 IA 0; MP 34 IA 1 (tank crew AD 0); Stielhandgranate 24 IA 3; M24 sleeve Explosives 3; MG 34 LMG 5; Kar 98k IA 6; MP 40 SMG 9; FG 42 Parachute 9; StG 44 IA 12; MG 42 LMG 12; C96 Handgun 5; P08 Handgun 8; P38 Handgun 12; Panzerschreck Tank Destruction 11. (The Panzerfaust 60 is not in the table: it came only in crates on the maps; see the German weapons table below.)
  - Soviet Union: SVT-40 IA 0; PPD-40 IA 1 (tank crew AD 0); RGD-33 Explosives 3; Bazooka M1A1 IA 4 (Lend-Lease); PTRD Tank Destruction 5; Mosin-Nagant IA 6; DP-28 IA 7; PPSh-41 SMG 9; PPS-43 SMG 11; AVS-36 IA 12; TT-33 Handgun 5; Nagant M1895 Handgun 9.
  - Other armies' weapons open at level 9 of that weapon's own Specialist ribbon. Launchers and anti-tank rifles cross over by other ribbons: the Bazooka for Germans at Tank Destruction 9 and for Soviets at Infantry Assault 4 (Lend-Lease); the Panzerschreck for Americans and Soviets at Tank Destruction 12; the PTRD for Americans at Tank Destruction 8 and for Germans at PTRD Specialist 9. Other armies' grenades are listed but not unlockable (`unlockable` false).
  - Specialist ribbons earn points with their own gun alone (`statRequirement`, by weapon id), per shot / point of damage / kill (and kill assist) / headshot kill: for example M1 Garand 9.844 / 1.986 / 929.2 / 1,580.2; Kar 98k 17.51 / 1.351 / 224.2 / 503.3; MP 40 3.805 / 0.876 / 135.8 / 288.3; MG 42 3.497 / 1.282 / 161.9 / 372.8; PPSh-41 3.223 / 0.742 / 115.0 / 244.2; M1911 29.214 / 2.742 / 478.3 / 1,028.3; the PTRD also 706.5 a vehicle knocked out. The full table is in game/ribbons.js. [D] [statRequirement.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/statRequirement.json)
  - Other ribbons open items this game doesn't have: Close Combat the knives, spades and bats (levels 0 to 11); Tactical a pocket pistol (1), first-aid kits (2) and binoculars (3); Medic a medic pouch (6); Driver and Tank Driver a repair wrench (6, 2).
  - So a new soldier's only weapon is his army's first rifle (Garand, Gewehr 43, SVT-40), or a tank crewman's first SMG.
- **Vehicles by ribbon level** (item type 4): tank crews by Armor Assault: Panzer I 0, Panzer II and M5A1 Stuart 1, Panzer 38(t) 3, Panzer III 4, Hetzer 6, M4A1 Sherman, Panzer IV H and T-34/76 7, Tiger 9, M4A3E8 and T-34-85 10, Tiger II 12; infantry: Willys MB, Kübelwagen and GAZ-67 Infantry Assault 2; WLA solo Driver 8 (recon Driver 2). The wiki's "rank 1 Stuart, rank 7 Sherman" figures (4.3) match these Armor Assault levels.
- **How ribbon points are earned** (`statRequirement`, `eParentType` 1 = ribbon; points per stat, by `weaponcategoryid`: 11 semi-automatic rifles, 12 bolt-action and anti-tank rifles, 13 assault rifles, 14 machine guns, 15 scoped rifles, 16 SMGs, 17 handguns, 8 launchers, 9 grenades, 20/27/28/29 tank guns):
  - Infantry Assault: per shot / point of damage / kill / headshot: semi-auto 0.746 / 0.15 / 70.4 / 119.7; bolt-action 7.398 / 0.571 / 94.7 / 212.7; machine gun 0.559 / 0.113 / 52.8 / 89.8; SMG 0.373 / 0.075 / 35.2 / 59.8; StG 44 (by weapon id 49) 1.66 / 0.382 / 59.2 / 125.7. Kill assists score as kills.
  - LMG Assault (machine guns) 2.161 / 0.792 / 100.1 / 230.4; SMG Assault 2.231 / 0.514 / 79.6 / 169.0; Handgun Assault 13.792 / 1.295 / 225.8 / 485.5; Explosives (grenades) 14.029 a throw, 1.605 a point of damage, 770.7 a kill.
  - Tank Destruction: a vehicle knocked out with a launcher 253.9, with an anti-tank rifle 257.1 (plus about 0.05 a point of vehicle damage).
  - Armor Assault: tank gun shots 1.6 (light) to 5.6 (heavy), vehicles knocked out 61.5 to 177.3; Armor Damage: vehicles knocked out 31.6 to 40.7; Tank Driver: 0.196 a meter driven.
  - Parachute: 73.2 a successful jump and 8.4 a second under the canopy. Recon: kills and damage at long range, headshots, battles without dying.
  - [D] [statRequirement.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/statRequirement.json), [weapontemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/weapontemplate.json)
- **This game** (game/ribbons.js) uses these tables as they are, with these choices of ours: a new soldier also gets his army's first pistol and grenade; a scoped rifle opens with its plain rifle (the scope unlock rows, item type 3, did not decode); each army's first tank in this game opens at level 0 (the real starting light tanks are not in it); the Panzerfaust opens at Tank Destruction 1; the M2 Carbine and AVS-36 score as the StG 44; a paratrooper's every deployment counts as one jump of about 12 s; machine-gun kills from a tank score as the data's light-tank machine guns; a kill assist is a man the player hurt in the 15 s before someone else killed him (the game's own rule is **unconfirmed**); another army's guns show in the loadout once the soldier has begun their Specialist ribbon.


### 4.6 Combat badges (perks)
- There are 35 badge types, most with **3 tiers**. The numeric effect per tier is in the data, but the effect descriptions are not, so what each multiplier modifies is **unconfirmed** unless the name makes it obvious. [D] [combatbadgetype.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/combatbadgetype.json), [combatbadgetemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/combatbadgetemplate.json)
- Base slots: 1, or 2 with membership (4.2).

| Data category | Badges (tier values) |
|---|---|
| 1 (general) | Nimble (1/2/3), Heavy set (0.92/0.89/0.85), Marathon man (2/2.5/3), First Blood (2) |
| 2 (driving) | Driver (0.75/0.62/0.5), Car Thief (0.75/0.5/0.25), Mechanic (0.71/0.63/0.56) |
| 3 (infantry) | Hoarder (+1/+2/+3), Grenadier (1.08/1.11/1.15), Dead-eye (1.25/1.38/1.5), Quickdraw (0.75/0.62/0.5), Fast reload (0.85/0.77/0.70), Infantry first (1.13/1.19/1.25), PointShooter (0.75/0.62/0.5), DynamiteLover (template named "XX", 1/2/3), Ghillie (0.75/0.5/0.1), Camouflaged, Infantry fist (1.13/1.19/1.25), Tight Grip (0.75/0.62/0.5), Scavenger (0.5/0.75/1.0) |
| 4 (medic) | First Aid (0.72/0.625/0.56), Combat Medic (1/2/3), Hand of god (1.4/1.6/1.8) |
| 5 (pilot) | Airborne (0.75/0.62/0.5), Bombs Away (0.85/0.77/0.70), Flak Jacket (0.92/0.89/0.85), Aircraft Thief (0.75/0.5/0.25) |
| 6 (paratrooper) | Para-training (0.75/0.62/0.5), Free Fall |
| 7 (tank) | Gunner (0.9/0.85/0.8), Tanker (0.75/0.62/0.5), Tank Thief (0.75/0.5/0.25) |
| 8 (leadership, probably squad or AT related) | Logistics Expert, Battlefield Commander, Charismatic Leader (0.10/0.15/0.20 each) |

The category labels in brackets are my reading of the badge names.

### 4.7 Careers (late-game specialisations)
Careers exist per class in the final data [D] [CharacterCareerTemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/CharacterCareerTemplate.json):
- **Infantry:** Assault Infantry, Close Quarters Expert, Anti-Tank Infantry, Medic, Infantry Commander
- **Paratrooper:** Airborne Raider, Airborne Commander
- **Tank Crew:** Armoured Spearhead, Tank Hunter, Armour Commander
- **Recon:** Sniper, Recon Commander
- **Fighter Pilot:** Fighter Ace, Airforce Commander, Close Air Support

What careers unlocked, and when they were introduced, is **unconfirmed**. Related data tables exist: [CharacterCareerRequirementTemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/CharacterCareerRequirementTemplate.json) and CareerOrderTemplate.json.

### 4.8 Weapon modification system
- **Five mod slots per weapon:** Ammunition, Barrel, Internal (bolt or spring), Sight, Trigger. These apply to every firearm category in the data: SemiAutoRifle, BoltActionRifle, AssaultRifle, LightMachinegun, SniperRifle, Submachinegun and Handgun. [D] [WeaponModCategory.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/WeaponModCategory.json)
- **Stats a mod can change** (as multipliers):
  - near and far range;
  - damage and damage at far range;
  - camera recoil (right, up, variance);
  - recoil time and **chamber time** (rate of fire);
  - spread cone when standing, crouching, prone and aiming, and how fast the cone contracts;
  - item condition and wear.
  - [D] [WeaponModifierTemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/WeaponModifierTemplate.json)
- **Example mods** from the same file. Values are per weapon family and vary; in each pair the first is good and the second is the trade-off.
  - **Barrels**
    - Stainless Steel Barrel: range ×1.10, recoil ×1.05.
    - Chrome Lined Barrel: range ×1.20, recoil ×1.10.
    - Chrome Moly 4150: damage ×1.33, far damage ×1.15, recoil ×1.10, spread up to ×1.20.
    - Octagon: damage ×1.27, recoil and spread ×1.10.
    - Scout II / Scout II-s: damage ×1.27 or ×1.16.
    - URAH-2 Heavy Barrel: range ×1.14 to 1.18, recoil ×0.95, slower cycling ×1.08.
    - Könich FJ-S (FG 42): range ×1.1 to 1.2, tighter spread.
  - **Internal**
    - Heavy Bolt: damage ×1.30 to 1.32, recoil ×1.10, chamber time ×1.10 to 1.15 (slower fire).
    - Lightened Bolt: range ×0.90 to 0.95, chamber time ×0.86 to 0.95 (faster fire).
    - Heavy Spring: recoil ×0.9, chamber time ×1.1.
    - Lightened Spring: recoil ×1.05 to 1.10, chamber time ×0.9 to 0.95.
    - Pistol-specific bolts and springs, and a "Special Light Bolt".
  - **Trigger**
    - Hair Trigger and Fine Hair Trigger: chamber time ×0.85 to 0.9, more recoil or spread.
    - Field Trigger Job / Field Adjusted Trigger: chamber time ×0.9 to 0.95, recoil ×1.04 to 1.12.
    - Marksman Trigger Job and Match Trigger: chamber time ×0.85 to 0.93, more spread.
  - **Sights**
    - Field Adjusted Sights: spread ×0.9.
    - Match Sights: spread ×0.85.
    - Telescopic sights by magnification:
      - 1.9× "infantry" scopes: M73B1 (US), ZF-41 (GE), PU (SU), each in "Infantry" and "Infantry Marksman" reticles;
      - 2.75×: M84;
      - 4×: PE, ZF-4;
      - 4.2×: ZF-39;
      - 8×: Unertl 8X, ZS Zielacht.
    - Reticle options: Fine Cross, Fine Duplex, German#1, German#4, T-Post.
    - Scopes also have zeroing ranges: 100 to 800 m in 50 m steps.
- **Which mods fit which weapon** is listed per weapon in [D] [WeaponModMapping.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/WeaponModMapping.json). It is the source to use for a faithful per-weapon upgrade tree. Highlights from my partial decoding, cross-referenced with mod IDs in WeaponModifierTemplate.json:
  - **US semi-autos:** M1 Garand, M1 Carbine, M1A1 Carbine and M1/M2 Carbine share one set: Lightened or Heavy Spring, Field Trigger Job, Stainless Steel Barrel, Field Adjusted Sights, and the M73B1 (1.9×) and M84 (2.75×) scopes. The Scout II-s barrel is also offered for the M1 Garand, Gewehr 43 and SVT-40.
  - **Unscoped bolt-actions take sniper optics:**
    - M1903: M73B1, M84, Unertl 8×
    - Kar98k: ZF-41, ZF-39 4.2×, ZS Zielacht 8×, ZF-4
    - Mosin-Nagant: PU 1.9×, PE 4×, ZS Zielacht 8×
  - Bolt-action barrel, internal and trigger options: Heavy or Lightened Bolt, Octagon, Chrome Moly 4150, Scout II, Match Sights, Hair, Fine Hair and Marksman triggers.
  - **Fixed-optic sniper templates.** The separate "Scoped" templates (M1903 Scoped, Kar98k Scoped, Mosin Scoped) have no sight slot options, only barrel, bolt, spring and trigger.
  - **Other semi-autos and automatics:**
    - Gewehr 43: ZF-41 or ZF-4
    - StG 44: ZF-41 or ZF-4
    - SVT-40: PU or PE
    - AVS-36: PU or PE, plus the URAH-2 Heavy Barrel
  - **FG 42:** the LMG mod set plus the Könich FJ-S barrel, a Fast Trigger and ZF-4 scopes.
  - **All LMGs** share one set: Stainless Steel or Chrome Lined barrel, Heavy Bolt, Heavy or Lightened Spring, Field Adjusted Sights, Field Trigger Job.
  - **SMGs:** springs, bolts (including the Special Light Bolt on the M3, MP 34 and PPD-40), trigger jobs and field-adjusted sights.
  - **Pistols:** pistol bolts and springs, Hair and Match triggers, barrels, Field-Adjusted and Match sights.
  - **AT rifles** (PTRD, PTRS, PzB 39) use the bolt-action mod set.
- **Ammunition types:** each calibre has a default load plus alternatives, many with fictional brand names. [D] [ammotemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/ammotemplate.json), [weaponAmmoMapping.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/weaponAmmoMapping.json)
  - .30-06: M2 Ball, Match M72, Bertie Clay Mk III (h), Black Hornet
  - .45 ACP: .45 Army Ball, Akicita AMF, Akicita Kinetic, United Defence Ranger, United Defence Super +P (revolver)
  - .30 Carbine: .30 Carbine, United Defence "Jackal"
  - .32 ACP: .32 ACP Ball, Akicita AMF, Akicita Kinetic, United Defence Ranger
  - 9 mm: 9mm Parabellum, DMW Fuchs, Wulff Engel, Wulff Faust
  - 7.65 mm: 7.65mm Ball, DMW Fuchs, Wulff Engel, Wulff Faust
  - 7.92×57: s.S. Patrone, S.m.E. ball, S.m.K.Hart, Anschusspatrone s.S.
  - 7.92 Kurz: Kurzpatrone 43, Jägerpatrone Kurz
  - 7.62×54R: Type L Light Ball, Type D Heavy Ball, 7N1 Sniper, Type L-41 JPH
  - 7.62×25: 7.62 TT, P-41, Leonov Devil, Leonov Misha
  - 7.62×38R: Red Army Ball, Cartridge Type R, CCCP Target, Leonov Medved
  - 6.35 mm: 6.35mm Ball, 6.3mm Tula, Leonov Mochshny, United Defence .25ACP
  - 14.5 mm: BS-41, Leonov Bronya MAX, Leonov Monstr
  - 7.92×94 (PzB 39): Patrone 318 variants
  - Vehicle and aircraft guns have AP, APCBC, HE, HEAT, HVAP, smoke and incendiary rounds per calibre.
- **How mods were obtained** is **unconfirmed**: credits, weapon-ribbon levels and modification kits are all possible. Every mod row in the final data has `forSale 0`. A wiki page "Weapons Modifiers" exists but I could not read it. [W] [wiki: Weapons Modifiers](https://heroesandgenerals.fandom.com/wiki/Weapons_Modifiers). An older Steam guide on German weapon modifications (frozen at v1.28.1) is another lead. [W] [Steam guide 936876756](https://steamcommunity.com/sharedfiles/filedetails/?id=936876756)
- **Item wear:** the weapon, mod and vehicle tables carry `maxCondition`, `wearPerShot`, `wearPerSpawn` and `wearPerBattle`, so items had durability. Whether it applied in the final live version is **unconfirmed**. [D] [WeaponModifierTemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/WeaponModifierTemplate.json), [vehicletemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/vehicletemplate.json)
- **Weapon skins ("variants")** such as "Used", "Dark Walnut", "Anodized Black", "Autumn Oakleaf", "Carbon Black" and "Olivegreen" exist for most items. [D] [WeaponVariantTemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/WeaponVariantTemplate.json)
- **Bipods** were added around June 2019. [W] [Steam News](https://store.steampowered.com/news/posts/?appids=227940&enddate=1559809274)

### 4.9 Which classes could use which weapons and vehicles
Each weapon or vehicle "Specialist" ribbon carries a class requirement per faction. I read these as bitmasks: 1 = Infantry, 2 = Fighter Pilot, 4 = Paratrooper, 8 = Tank Crew, 16 = Recon, 32 = General. This reading is an inference, but it is consistent across the whole table: every tank ribbon is 8, every plane ribbon 2, every armoured-car ribbon 16, the FG 42 ribbon 4, and the Parachute ribbon 6 (Pilot + Paratrooper). [D] [ribbontemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/ribbontemplate.json), [RibbonRequirement.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/RibbonRequirement.json)

| Weapon group | Classes allowed (decoded) |
|---|---|
| Pistols and revolvers (all factions) | all five classes |
| Submachine guns (M3, Thompson, MP 34, MP 40, PPD-40, PPSh-41, PPS-43) | all five classes |
| Semi-auto rifles (M1 Garand, M1 Carbine, Gewehr 43, SVT-40) | Infantry, Paratrooper |
| M1A1 Carbine (US) | Paratrooper, Tank Crew |
| Bolt-action rifles (M1903, Kar98k, Mosin-Nagant 91/30) | Infantry, Recon |
| "Assault" automatics (M1/M2 Carbine, StG 44, AVS-36) | Infantry only |
| LMGs (BAR, M1919, MG13, MG34, MG42, DP-28, DT, Maxim-Tokarev) | Infantry only |
| Johnson M1941 (US) | Infantry, Paratrooper |
| FG 42 (GE) | Paratrooper only |
| AT rifles (Panzerbüchse 39, PTRD-41, PTRS-41) | Infantry only |
| Light vehicles (jeeps, cars, trucks, AA trucks, half-tracks) | Infantry |
| Motorcycles (all WLA, R75 and M-72 variants) and the Kettenkrad; also the generic "Driver" and "Chauffeur" ribbons | Infantry, Recon (decoded mask 17) |
| Armoured cars (M8, M20, T8E1, SdKfz 222/234/250, BA-64B/BA-6/BA-11) | Recon only |
| Tanks and tank destroyers | Tank Crew only |
| Aircraft | Fighter Pilot only |

- The wiki independently says "LMGs are infantry-only, apart from the Johnson and FG42". [W] [wiki: Weapons](https://heroesandgenerals.fandom.com/wiki/Weapons)
- **Scoped sniper variants** (M1903 Scoped, Kar98k Scoped, Mosin-Nagant Scoped) have no ribbon of their own. They are presumably Recon weapons (**unconfirmed**).
- **M1D (M84 scope) conflict:** IMFDB says the M1D sniper Garand was available to US Infantry, Recon and Paratroopers. The final data gives the M1 Garand ribbon only Infantry and Paratrooper. [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals)
- **Launchers, grenades and mines** have no ribbon of their own, so their class rules are **unconfirmed**. The wiki shows them on Infantry loadouts. [W] [wiki: Infantryman](https://heroesandgenerals.fandom.com/wiki/Infantryman)
- **Data anomalies:** the "QMC-4 1/4 Ton Amphibian" ribbon (the US Ford GPA) carries a Germany mask, which is probably a data error. The M3A1 half-track and WLA motorcycle ribbons carry US and Soviet masks, so Lend-Lease use is possible (**unconfirmed**).

### 4.10 Vehicle upgrades
- Vehicles have 0 to 2 upgrade slots [D] [vehicletemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/vehicletemplate.json). Upgrade items [D] [vehicleupgradetemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/vehicleupgradetemplate.json):
  - **Supply crates:** Medic, Anti-tank, Ammo, Flamethrower, Demolition Kit.
  - **Mounted machine guns:** M1919A4, M2 .50 cal, MG34, MG42, PM1910/30 (Maxim), DP, DShK-38.
  - **Cosmetic:** camo netting (tank destroyer, armoured recon vehicle, heavy tank destroyer) and coloured plane smoke (red, green, white, blue).
- **Mobile spawns:** half-tracks and trucks (M3A1, GMC CCKW 352, SdKfz 251-D, Opel Blitz, GAZ-AAA Cargo) are flagged `mobileSpawn: true`. [D] [vehicletemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/vehicletemplate.json)

---

## 5. Content lists

**Primary source:** the final live-game data. Base item names and internal IDs come from [D] [WeaponVariantTemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/WeaponVariantTemplate.json), the parent weapon IDs of every skin. Calibres come from [D] [weaponAmmoMapping.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/weaponAmmoMapping.json) and [ammotemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/ammotemplate.json). Faction and class come from [D] [ribbontemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/ribbontemplate.json) (see 4.9).

**Cross-check:** the wiki's "WPN" numbers match these data IDs, for example M3 = WPN 5, Thompson = 32, M1 Garand = 40, BAR = 45, M1903 = 46. [W] [wiki: Weapons](https://heroesandgenerals.fandom.com/wiki/Weapons), [wiki: Infantryman](https://heroesandgenerals.fandom.com/wiki/Infantryman)

**Where faction is marked "(origin)"**, the item has no ribbon, so I assigned the faction from the item's real-world origin; this is **unconfirmed** in-game. **Unlock-order notes** come from IMFDB. [W] [IMFDB: Heroes & Generals](https://www.imfdb.org/wiki/Heroes_&_Generals)

**When added:** dates are unknown for almost every item. The confirmed exception is the **PPSh-41, added 2 March 2015** with the Soviet faction. [W] [MassivelyOP](https://massivelyop.com/2015/03/02/heroes-generals-update-adds-soviet-faction/). Treat every other item's introduction date as **unconfirmed**.

### 5.1 Infantry weapons and equipment

#### United States

| Item (data id) | Type | Calibre / ammo (data) | Classes (decoded) | Notes and sources |
|---|---|---|---|---|
| M1 Garand (40) | semi-auto rifle | .30-06 | Infantry, Paratrooper | US infantry starting rifle; 8-round en-bloc clip with the "ping" [W] [wiki: Infantryman](https://heroesandgenerals.fandom.com/wiki/Infantryman), [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals). Takes M73B1 1.9× and M84 2.75× scopes [D] [WeaponModMapping.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/WeaponModMapping.json) |
| M1 Carbine (16) | semi-auto carbine | .30 Carbine | Infantry, Paratrooper | [W] [wiki: Category:US weapons](https://heroesandgenerals.fandom.com/wiki/Category:US_weapons) |
| M1A1 Carbine (56) | semi-auto carbine (folding stock) | .30 Carbine | Paratrooper, Tank Crew | [W] [heroes-generals.fandom.com: M1A1 Carbine](https://heroes-generals.fandom.com/wiki/M1A1_Carbine) |
| M1/M2 Carbine (50) | select-fire, the game's US "assault" gun | .30 Carbine | Infantry | the wiki groups it with the assault rifles [W] [wiki: Weapons](https://heroesandgenerals.fandom.com/wiki/Weapons), [NamuWiki US infantry equipment](https://en.namu.wiki/w/%ED%9E%88%EC%96%B4%EB%A1%9C%EC%A6%88%20%EC%95%A4%20%EC%A0%9C%EB%84%88%EB%9F%B4%EC%8A%A4/%EB%AF%B8%EA%B5%B0%20%EB%B3%B4%EB%B3%91%EC%9E%A5%EB%B9%84) |
| Springfield M1903 (46) | bolt-action rifle | .30-06 | Infantry, Recon | [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals) |
| Springfield M1903 Scoped (42) | sniper rifle | .30-06 | **unconfirmed** (probably Recon) | Unertl 8× scope options in the mod data |
| M3 "Greasegun" (5) | SMG | .45 ACP | all classes | first US SMG unlock, low rate of fire [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals) |
| Thompson M1A1 (32) | SMG | .45 ACP | all classes | second US SMG unlock [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals) |
| M1918A2 BAR (45) | automatic rifle (LMG slot) | .30-06 | Infantry | [W] [wiki: Infantryman](https://heroesandgenerals.fandom.com/wiki/Infantryman) |
| M1919 Browning (62) | LMG (IMFDB: M1919A6) | .30-06 | Infantry | [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals) |
| Johnson M1941 LMG (66) | LMG | .30-06 | Infantry, Paratrooper | [W] [IMFDB: M1941 Johnson MG](https://www.imfdb.org/wiki/M1941_Johnson_machine_gun) |
| Colt M1911A1 (20) | pistol | .45 ACP | all | "second available handgun for the US" [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals) |
| M1917 Revolver (8) | revolver | .45 ACP | all | [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals) |
| Colt M1903 Pocket Hammerless (76) | pocket pistol | .32 ACP | all | [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals) |
| FP-45 Liberator (161) | single-shot pistol | .45 | **unconfirmed** | [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals) |
| Bazooka M1A1 (52) | AT rocket launcher | 2.36" M6A1 rocket | **unconfirmed** (Infantry loadouts on the wiki) | reloads faster than the Panzerschreck but its rockets fly slower [W] [wiki: Bazooka M1A1](https://heroesandgenerals.fandom.com/wiki/Bazooka_M1A1) |
| Bazooka M9A1 (134) | AT rocket launcher | 2.36" M6A3 rocket | **unconfirmed** | [W] [wiki: Bazooka M9A1](https://heroesandgenerals.fandom.com/wiki/Bazooka_M9A1) |
| M18 Recoilless Rifle (139) | recoilless AT gun | 57 mm HEAT M307 | **unconfirmed** | [D] only |
| M2 Flamethrower (900) | flamethrower | fuel | **unconfirmed** | [D] only (origin) |
| Grenade Mk II (10) | fragmentation grenade | n/a | n/a | shortest throw of the grenades but the most damage within its radius [W] [wiki: Grenade Mk II](https://heroesandgenerals.fandom.com/wiki/Grenade_Mk_II) |
| Mk IIIA1 (154) | concussion grenade (origin) | n/a | n/a | [D] only |
| Demolition Kit M37 (158, also 160) | demolition charge (origin) | n/a | n/a | [D]. The wiki's explosives table names an "Infantry Demolition Kit M1" (naming **conflict**) [W] [wiki: Explosives](https://heroesandgenerals.fandom.com/wiki/Explosives) |
| M1A1 (83) | AT mine (origin) | n/a | n/a | [D] only |
| M2A3 (81) | bounding AP mine (origin) | n/a | n/a | [D] only |
| Combat Knife 1219C2 (1), M-1910 Spade (3) | melee (origin) | n/a | n/a | [D] only |
| U.S. Field Dressing (75), U.S. Small Medic Kit (78) | healing | n/a | n/a | [D] [weaponAmmoMapping.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/weaponAmmoMapping.json) |
| N-K M3 6x30 (99) | binoculars (origin) | n/a | n/a | [D] only |

#### Germany

| Item (data id) | Type | Calibre / ammo (data) | Classes (decoded) | Notes and sources |
|---|---|---|---|---|
| Gewehr 43 (44) | semi-auto rifle | 7.92×57 | Infantry, Paratrooper | German infantry starting rifle; 10-round magazine [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals), [wiki: Weapons](https://heroesandgenerals.fandom.com/wiki/Weapons) |
| Karabiner 98 Kurz (43) | bolt-action rifle | 7.92×57 | Infantry, Recon | late model with front-sight hood, 5-round stripper clips [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals) |
| Karabiner 98 Kurz Scoped (41) | sniper rifle | 7.92×57 | **unconfirmed** (probably Recon) | ZF-39 4.2× scope [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals); [D] [WeaponModifierTemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/WeaponModifierTemplate.json) |
| Sturmgewehr 44 (49) | assault rifle | 7.92×33 Kurz | Infantry | ZF-4 4× scope option [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals), [wiki: Scopes](https://heroesandgenerals.fandom.com/wiki/Scopes) |
| MP 34 (6) | SMG | 9 mm | all classes | first German SMG unlock, 20-round magazine [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals) |
| MP 40 (31) | SMG | 9 mm | all classes | 32-round magazine [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals) |
| MG-13 (148) | LMG | 7.92×57 | Infantry | [W] [wiki: Weapons](https://heroesandgenerals.fandom.com/wiki/Weapons) |
| Maschinengewehr 34 (63) | LMG | 7.92×57 | Infantry | first German LMG unlock, 50-round belt drum [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals) |
| Maschinengewehr 42 (61) | LMG | 7.92×57 | Infantry | second German LMG unlock, very high rate of fire, 100-round belts [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals), [wiki: Weapons](https://heroesandgenerals.fandom.com/wiki/Weapons) |
| FG 42 (47) | automatic rifle | 7.92×57 | Paratrooper only | IMFDB calls it the early "FG 42/I"; the wiki says "FG42 Ausf. E" (naming **conflict**); has its own "Könich FJ-S" barrel mod [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals), [wiki: Category:German weapons](https://heroesandgenerals.fandom.com/wiki/Category:German_weapons) |
| Mauser C96 (21) | pistol | 9 mm | all | second German pistol unlock [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals) |
| Luger P08 (7) | pistol | 9 mm | all | third German pistol unlock [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals) |
| Walther P38 (67) | pistol | 9 mm | all | fourth German pistol unlock; plays much like the Luger [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals) |
| Mauser M1934 (77) | pocket pistol | 7.65 mm | all | IMFDB calls it the "Mauser 1934 Taschenpistole" [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals) |
| Panzerschreck RPzB 54 (53) | AT rocket launcher | 88 mm rocket | **unconfirmed** | rockets faster and flatter than the Bazooka's [W] [wiki: Panzerschreck RPzB 54](https://heroesandgenerals.fandom.com/wiki/Panzerschreck_RPzB_54) |
| Granatbüchse 39 (136) | AT rifle-grenade launcher | 45 mm G.G.PzG. | **unconfirmed** | the German "AT launcher" slot item; a converted PzB 39 [W] [wiki: Infantryman](https://heroesandgenerals.fandom.com/wiki/Infantryman) |
| Panzerbüchse 39 (135) | AT rifle | 7.92×94 (Patrone 318) | Infantry | a primary weapon in the wiki table [W] [wiki: Infantryman](https://heroesandgenerals.fandom.com/wiki/Infantryman) |
| Panzerfaust 60 (51) | disposable AT launcher | n/a | n/a | found only as weapon crates on maps, not unlocked [W] [wiki: Explosives](https://heroesandgenerals.fandom.com/wiki/Explosives) |
| Flammenwerfer 41 (901), Einstossflammenwerfer 46 (903) | flamethrowers (origin) | fuel | **unconfirmed** | [D] only |
| Stielhandgranate 24 (11) | stick grenade | n/a | n/a | 20 m blast radius in the wiki table; its ammo entry is named "Stielhandgranate 42" [W] [wiki: Explosives](https://heroesandgenerals.fandom.com/wiki/Explosives); [D] |
| M24 Frag sleeve (19) | stick grenade with fragmentation sleeve (origin) | n/a | n/a | [D] only |
| M24 Bundle (156) | bundled charge (origin) | n/a | n/a | [D] only |
| Panzerwurfmine Lang (59) | thrown AT grenade | n/a | n/a | [W] [wiki: Category:Explosives](https://heroesandgenerals.fandom.com/wiki/Category:Explosives), [IMFDB: Panzerwurfmine](https://www.imfdb.org/wiki/Panzerwurfmine) |
| Hafthohlladung H3 (84) | magnetic AT charge (placed, not thrown) | n/a | n/a | [W] [wiki: Hafthohlladung H3](https://heroesandgenerals.fandom.com/wiki/Hafthohlladung_H3) |
| Tellermine 42 (82) | AT mine | n/a | n/a | [W] [wiki: Category:Explosives](https://heroesandgenerals.fandom.com/wiki/Category:Explosives) |
| S-Mine (80) | bounding AP mine | n/a | n/a | [W] [wiki: Category:Explosives](https://heroesandgenerals.fandom.com/wiki/Category:Explosives) |
| Seitengewehr 98 (2), Schanzzeug spade (4) | melee | n/a | n/a | [D] only |
| German Field Dressing (73), German Small Medic Kit (89) | healing | n/a | n/a | [D] |
| Dienstglas 6x30 (98) | binoculars | n/a | n/a | [D] |
| RZ20 Parachute (101) | parachute | n/a | n/a | [D] |

#### Soviet Union

| Item (data id) | Type | Calibre / ammo (data) | Classes (decoded) | Notes and sources |
|---|---|---|---|---|
| Tokarev SVT-40 (14) | semi-auto rifle | 7.62×54R | Infantry, Paratrooper | Soviet infantry starting rifle; 10-round magazine; a PU-scoped version exists [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals), [wiki: Infantryman](https://heroesandgenerals.fandom.com/wiki/Infantryman) |
| Mosin-Nagant 1891/30 (12) | bolt-action rifle | 7.62×54R | Infantry, Recon | [W] [wiki: Weapons](https://heroesandgenerals.fandom.com/wiki/Weapons) |
| Mosin-Nagant 1891/30 Scoped (13) | sniper rifle | 7.62×54R | **unconfirmed** (probably Recon) | PU scope (IMFDB says 3.5×) [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals) |
| AVS-36 (54) and AVS-36 bayonet (55) | automatic rifle, the Soviet "assault" gun | 7.62×54R | Infantry | [W] [wiki: Weapons](https://heroesandgenerals.fandom.com/wiki/Weapons), [NamuWiki Soviet infantry equipment](https://en.namu.wiki/w/%ED%9E%88%EC%96%B4%EB%A1%9C%EC%A6%88%20%EC%95%A4%20%EC%A0%9C%EB%84%88%EB%9F%B4%EC%8A%A4/%EC%86%8C%EB%A0%A8%EA%B5%B0%20%EB%B3%B4%EB%B3%91%EC%9E%A5%EB%B9%84) |
| PPD-40 (24) | SMG (drum) | 7.62×25 | all classes | first Soviet SMG unlock; good for clearing buildings [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals) |
| PPSh-41 (33) | SMG (71-round drum) | 7.62×25 | all classes | second Soviet SMG unlock; **added 2 March 2015** [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals), [MassivelyOP](https://massivelyop.com/2015/03/02/heroes-generals-update-adds-soviet-faction/) |
| PPS-43 (57) | SMG (35-round magazine) | 7.62×25 | all classes | third Soviet SMG unlock [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals), [IMFDB: PPS](https://www.imfdb.org/wiki/PPS_Submachine_Gun) |
| Degtyaryov DP-28 (9) | LMG (47-round top pan) | 7.62×54R | Infantry | [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals) |
| DT (144) (ribbon name "Degtyarev DP-DTM") | LMG | 7.62×54R | Infantry | the wiki lists a "DT-29" [W] [wiki: Infantryman](https://heroesandgenerals.fandom.com/wiki/Infantryman) |
| Maxim-Tokarev MT (145) | LMG | 7.62×54R | Infantry | [W] [IMFDB: Maxim](https://www.imfdb.org/wiki/Maxim) |
| Tula Tokarev TT-33 (22) | pistol | 7.62×25 | all | second Soviet pistol unlock [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals) |
| Nagant M1895 revolver (58) | revolver | 7.62×38R | all | [W] [wiki: Infantryman](https://heroesandgenerals.fandom.com/wiki/Infantryman) |
| Korovin TK (90) | pocket pistol | 6.35 mm | all | [W] [IMFDB: Korovin TK](https://www.imfdb.org/wiki/Korovin_TK) |
| PTRD-41 (34) | single-shot AT rifle | 14.5×114 | Infantry | good against light armour, poor against heavy [W] [wiki: PTRD-41](https://heroesandgenerals.fandom.com/wiki/PTRD-41) |
| PTRS-41 (138) | semi-auto AT rifle | 14.5×114 | Infantry | successor to the PTRD [W] [wiki: PTRD-41](https://heroesandgenerals.fandom.com/wiki/PTRD-41) |
| Ampulomet-41 (137) | launcher-slot weapon | 125 mm FBM-125 | **unconfirmed** | the Soviet "AT launcher" slot item [W] [wiki: Infantryman](https://heroesandgenerals.fandom.com/wiki/Infantryman) |
| RPG-43 (36) | AT impact grenade (shaped charge) | n/a | n/a | [W] [wiki: RPG-43](https://heroesandgenerals.fandom.com/wiki/RPG-43) |
| ROKS-3 (902) | flamethrower (origin) | fuel | **unconfirmed** | [D] only |
| RGD-33 (15) | stick grenade | n/a | n/a | 85 g TNT with a fragmentation sleeve [W] [wiki: RGD-33](https://heroesandgenerals.fandom.com/wiki/RGD-33) |
| RG-42 (155) | grenade (origin) | n/a | n/a | [D] only |
| RG-33 Bundle (157) | bundled charge (origin) | n/a | n/a | [D] only |
| TM-35 (18) | AT mine (origin) | n/a | n/a | [D] only |
| PMK-40 (17) | AP mine (origin) | n/a | n/a | [D] only |
| NR-40 "Scouts knife" (23), "Vulcan Stalin" (25) | melee; "Vulcan Stalin" uses the shovel ammo entry, so it is probably a spade (identity **unconfirmed**) | n/a | n/a | [D] only |
| Soviet Field Dressing (74), Soviet Small Medic Kit (79) | healing | n/a | n/a | [D] |
| N-K 6x30 (48) | binoculars (faction inferred) | n/a | n/a | [D] only |

**Notes for the Soviet list:**
- The wiki footnotes that the "Soviet Bazooka M1A1 is unlocked through Infantry Assault", which implies Lend-Lease use (**unconfirmed**). [W] [wiki: Infantryman](https://heroesandgenerals.fandom.com/wiki/Infantryman)
- Calibre-only names (for example "7.62 mm MG" on vehicles) are my decoding of ammunition groups.

#### Items with unclear faction or availability
- **"Machine Carbine Mk I" (159)**, the Owen SMG, 9 mm. Its ribbon has an empty class mask (0/0/0), so it was possibly unavailable or event-only. IMFDB lists an "Owen Mk 1/43" in the game. [D] [ribbontemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/ribbontemplate.json); [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals)
- **S.T. Grenade No.74 (85)**, a British "sticky bomb" AT grenade. The faction that used it is **unconfirmed**. [W] [wiki: No.74](https://heroesandgenerals.fandom.com/wiki/No.74)
- **Event items:** Baseball Bat (149, 150), Lapta Bat (151), Snowball (152), "Easteregg" throwable (153). **Tools:** Adjustable Wrench (102), the tank-crew repair tool (inferred), and Map (95). [D] [WeaponVariantTemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/WeaponVariantTemplate.json), [ammotemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/ammotemplate.json)
- **Not found by name**, though sometimes assumed to be in the game: Sten, Suomi, Lee-Enfield, Gewehr 41, the Johnson M1941 *rifle*, and the Welrod. They appear in none of the final data tables I read, and the IMFDB searches did not surface H&G entries for them either. Three unnamed weapon IDs in the ammo table (91, 92, 93, firing 7.62×25, .30-06 and .45 respectively) could not be identified, so this is not conclusive. [W] [IMFDB](https://www.imfdb.org/wiki/Heroes_&_Generals); [D] [weaponAmmoMapping.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/weaponAmmoMapping.json)

### 5.2 Ground vehicles and aircraft (complete list from the final data)

**Reading the tables:**
- Category headings follow the data's `armyresourcecategory` (the AT resource type each vehicle belongs to).
- "Speed (data)" is the template's `speed` field. For aircraft it is a placeholder value of 40 and is probably not used; the flight model is separate.
- Some names are spelled as in the data, typos included. "Focke-Wulff FW-109 D-9" is the Fw 190 D-9; its ribbon is spelled "Focke-Wulff Fw190 D9". "GGAZ-AAA" is the GAZ-AAA.
- The SdKfz 250/3 half-track is in the armoured-car (Recon) category in the data.

**Known introduction dates:**
- T-34-85 Model 1944 and Yak-9D: 2 March 2015, part of "14 new vehicles" in the Soviet update. [W] [MassivelyOP](https://massivelyop.com/2015/03/02/heroes-generals-update-adds-soviet-faction/)
- 11 August 2016: a Soviet tank destroyer, heavy tank and medium tank (models **unconfirmed**). [W] [KeenGamer](https://www.keengamer.com/articles/news/heroes-generals-furness-fist-of-steel-update-out-now/)
- Every other vehicle's date is **unconfirmed** (see 1.9).

#### Cars, motorcycles, light utility and AA trucks

| Faction | Name in game data (id) | Available | Armament (decoded) | Speed (data) | Mass kg | HP | Mobile spawn |
|---|---|---|---|---|---|---|---|
| US | Willys MB (1) | yes | .30-06 MG on mount (alt .50 BMG mount) | 89 | 1020 | 500 | no |
| US | 42WLA Solo (5) | yes | none listed | 95 | 245 | 375 | no |
| US | M16 Multiple Gun Motor Carriage (54) | yes | 4x .50 BMG (AA) | 64 | 9000 | 750 | no |
| US | M29 Weasel (55) | yes | none listed | 58 | 1632 | 500 | no |
| US | Ford GPA (70) | yes | none listed | 84 | 1110 | 500 | no |
| US | 42WLA Sidecar (98) | yes | .30-06 MG (sidecar) | 95 | 670 | 375 | no |
| Germany | Kubelwagen Typ 82 (2) | yes | 7.92 mm MG (alt mount) | 80 | 715 | 500 | no |
| Germany | R75 Sidecar (4) | yes | 7.92 mm MG (sidecar) | 95 | 670 | 375 | no |
| Germany | SdKfz 2 Kettenkrad HK 101 (35) | yes | none listed | 70 | 1560 | 375 | no |
| Germany | Sd.Kfz. 7/1 (53) | yes | 4x 20 mm (20x138B, Flakvierling) (AA) | 50 | 11550 | 750 | no |
| Germany | Typ 166 Schwimmwagen (69) | yes | none listed | 75 | 910 | 500 | no |
| Germany | R75 Solo (99) | yes | none listed | 95 | 245 | 375 | no |
| Soviet Union | GAZ-67 (7) | yes | 7.62 mm MG or 12.7 mm DShK (mount options) | 90 | 1020 | 500 | no |
| Soviet Union | GGAZ-AAA M-4 Maxim (49) | yes | 4x 7.62 mm Maxim (AA) | 65 | 2950 | 750 | no |
| Soviet Union | T-20 Komsomolets (57) | yes | 7.62 mm MG | 50 | 3500 | 500 | no |
| Soviet Union | M72 Solo (100) | yes | none listed | 95 | 245 | 375 | no |
| Soviet Union | M72 Sidecar (101) | yes | 7.62 mm MG (sidecar) | 95 | 670 | 375 | no |

#### Armoured cars (recon vehicles)

| Faction | Name in game data (id) | Available | Armament (decoded) | Speed (data) | Mass kg | HP | Mobile spawn |
|---|---|---|---|---|---|---|---|
| US | M8 Greyhound (72) | yes | 37 mm gun + .30-06 coax + .50 BMG | 72 | 7802 | 900 | no |
| US | T8E1 Stuart Recce (94) | yes | .50 BMG + .30-06 MG | 65 | 12000 | 900 | no |
| US | M20 (95) | yes | .50 BMG | 89 | 7099 | 900 | no |
| Germany | SdKfz 222 (71) | yes | 20 mm (20x138B) + 7.92 mm MG | 75 | 4800 | 900 | no |
| Germany | SdKfz 234/2 Puma (91) | yes | 50 mm (50x289R ammo group) + 7.92 mm MG | 80 | 7802 | 900 | no |
| Germany | SdKfz 250-3 (96) | yes | 7.92 mm MG | 65 | 5700 | 900 | no |
| Soviet Union | BA-64B (44) | yes | 7.62 mm MG | 75 | 2300 | 900 | no |
| Soviet Union | BA-6 (47) | yes | 45 mm + 7.62 mm MGs | 55 | 5120 | 900 | no |
| Soviet Union | BA-11 (97) | yes | 45 mm + 7.62 mm MGs | 64 | 8300 | 900 | no |

#### APCs / trucks (mobile spawn)

| Faction | Name in game data (id) | Available | Armament (decoded) | Speed (data) | Mass kg | HP | Mobile spawn |
|---|---|---|---|---|---|---|---|
| US | M3A1 (60) | yes | .50 BMG | 64 | 9300 | 900 | yes |
| US | GMC CCKW 352 (66) | yes | none listed | 70 | 2500 | 750 | yes |
| Germany | SdKfz 251-D (61) | yes | 2x 7.92 mm MG | 55 | 8500 | 900 | yes |
| Germany | Opel Blitz (64) | yes | none listed | 75 | 2495 | 750 | yes |
| Soviet Union | GAZ-AAA Cargo (59) | yes | none listed | 65 | 2950 | 750 | yes |

#### Light tanks

| Faction | Name in game data (id) | Available | Armament (decoded) | Speed (data) | Mass kg | HP | Mobile spawn |
|---|---|---|---|---|---|---|---|
| US | M5A1 Stuart (15) | yes | 37 mm gun + .30-06 MGs | 64 | 15500 | 1200 | no |
| US | M24 Chaffee (17) | yes | 75 mm gun (ammo group "75mm L/40") + .30-06 MGs | 56 | 18400 | 1200 | no |
| US | M2A2 Light Tank (45) | yes | .50 BMG + .30-06 MGs | 65 | 8660 | 1200 | no |
| Germany | Panzerkampfwagen I Ausf. A (16) | yes | 2x 7.92 mm MG | 50 | 5400 | 1200 | no |
| Germany | Panzerkampfwagen II Ausf. C (38) | yes | 20 mm (20x138B) + 7.92 mm MG | 40 | 8900 | 1200 | no |
| Germany | Panzerkampfwagen 38(t) Ausf. E (39) | yes | 37 mm (37.2x249) + 7.92 mm MGs | 42 | 9850 | 1200 | no |
| Germany | Panzerkampfwagen II Ausf. L (52) | yes | 20 mm (20x138B) + 7.92 mm MG | 60 | 13208 | 1200 | no |
| Soviet Union | BT-7 Model 1937 (8) | yes | 45 mm + 7.62 mm MG | 72 | 13900 | 1200 | no |
| Soviet Union | T-38 Model 1937 (43) | yes | 7.62 mm MG | 40 | 3300 | 1200 | no |
| Soviet Union | T-26 Model 1933 (46) | yes | 45 mm + 7.62 mm MG | 31 | 9400 | 1200 | no |
| Soviet Union | T-70 Model 1942 (48) | yes | 45 mm + 7.62 mm MG | 45 | 9400 | 1200 | no |

#### Medium tanks

| Faction | Name in game data (id) | Available | Armament (decoded) | Speed (data) | Mass kg | HP | Mobile spawn |
|---|---|---|---|---|---|---|---|
| US | M4A3E8 Sherman (13) | yes | 76 mm gun ("76mm L/55") + .30-06 MGs | 42 | 33650 | 1700 | no |
| US | M3 Lee (37) | yes | 75 mm hull gun ("75mm L/40") + 37 mm turret gun + .30-06 MGs | 42 | 27900 | 1700 | no |
| US | M4A1 Sherman (42) | yes | 75 mm gun ("75mm L/40") + .30-06 MGs | 40 | 27900 | 1700 | no |
| Germany | Panzerkampfwagen III Ausf J (14) | yes | 50 mm (50x289R) + 7.92 mm MGs | 40 | 21500 | 1700 | no |
| Germany | Panzerkampfwagen IV Ausf. H (36) | yes | 75 mm (75x495R) + 7.92 mm MGs | 38 | 26000 | 1700 | no |
| Germany | Panzerkampfwagen V Ausf. G (56) | yes | 75 mm (75x640R) + 7.92 mm MGs | 46 | 45465 | 1700 | no |
| Soviet Union | T-34 76 Model 1942 (9) | yes | 76.2 mm (F-34 ammo group) + 7.62 mm MGs | 55 | 30000 | 1700 | no |
| Soviet Union | T-34 85 Model 1944 (18) | yes | 85 mm + 7.62 mm MGs | 55 | 30000 | 1700 | no |
| Soviet Union | T-28 Model 1934 (67) | yes | short 76.2 mm ("76.2mm L/25" ammo group) + several 7.62 mm MGs | 40 | 28500 | 1700 | no |

#### Heavy tanks

| Faction | Name in game data (id) | Available | Armament (decoded) | Speed (data) | Mass kg | HP | Mobile spawn |
|---|---|---|---|---|---|---|---|
| US | M26 Pershing (28) | yes | 90 mm gun + .30-06 MGs | 35 | 41900 | 2200 | no |
| US | M4A3E2 Jumbo Sherman (68) | yes | 76 mm gun (ammo group "76mm L/55") + .30-06 MGs | 35 | 38000 | 2200 | no |
| Germany | Panzerkampfwagen VI Tiger (10) | yes | 88 mm (88x571R) + 7.92 mm MGs | 41 | 57000 | 2200 | no |
| Germany | Panzerkampfwagen VI Tiger II (51) | yes | 88 mm (88x822R) + 7.92 mm MGs | 38 | 70000 | 2200 | no |
| Soviet Union | IS-2 Model 1944 (6) | yes | 122 mm + 7.62 mm MGs | 37 | 46000 | 2200 | no |
| Soviet Union | KV-85 (63) | yes | 85 mm + 7.62 mm MGs | 42 | 46000 | 2200 | no |

#### Tank destroyers (medium)

| Faction | Name in game data (id) | Available | Armament (decoded) | Speed (data) | Mass kg | HP | Mobile spawn |
|---|---|---|---|---|---|---|---|
| US | M18 Hellcat (12) | yes | 76 mm gun ("76mm L/55") + .50 BMG | 80 | 17700 | 1200 | no |
| US | M10 Wolverine (58) | yes | 3-inch/76.2 mm gun (76.2x586R) | 48 | 29600 | 1700 | no |
| Germany | Sturmgeschutz III (11) | yes | 75 mm (75x495R) + 7.92 mm MG | 40 | 23900 | 1700 | no |
| Germany | Jagdpanzer 38(t) "Hetzer" (50) | yes | 75 mm (75x495R) + 7.92 mm MG | 42 | 15750 | 1200 | no |
| Soviet Union | SU-85 (19) | yes | 85 mm | 55 | 29600 | 1700 | no |
| Soviet Union | SU-76M (65) | yes | 76.2 mm (76.2x385R / F-34 ammo groups) | 50 | 11200 | 1200 | no |

#### Tank destroyers (heavy)

| Faction | Name in game data (id) | Available | Armament (decoded) | Speed (data) | Mass kg | HP | Mobile spawn |
|---|---|---|---|---|---|---|---|
| US | M36B1 Jackson (87) | yes | 90 mm gun + .30-06 MG | 42 | 32000 | 1900 | no |
| US | M36 Jackson (88) | yes | 90 mm gun | 48 | 29000 | 1900 | no |
| Germany | Jagdpanzer V Jagdpanther (89) | yes | 88 mm (88x822R) + 7.92 mm MG | 46 | 46000 | 1900 | no |
| Soviet Union | SU-100 (90) | yes | 100 mm | 48 | 29600 | 1900 | no |

#### Stationary AA emplacements

| Faction | Name in game data (id) | Available | Armament (decoded) | Speed (data) | Mass kg | HP | Mobile spawn |
|---|---|---|---|---|---|---|---|
| US | M55 Quad (33) | yes | 4x .50 BMG (AA) | 0 | 1340 | 500 | no |
| Germany | Flakvierling 38 (31) | yes | 4x 20 mm (20x138B) (AA) | 0 | 1509 | 500 | no |
| Soviet Union | Maxim M4 Quad (26) | yes | 4x 7.62 mm Maxim (AA) | 0 | 460 | 500 | no |

#### Fighters

| Faction | Name in game data (id) | Available | Armament (decoded) | Speed (data) | Mass kg | HP | Mobile spawn |
|---|---|---|---|---|---|---|---|
| US | Curtiss P-40N Warhawk (78) | yes | 6x .50 BMG + AN-M57 250 lb bombs | 40 | 4018 | 450 | no |
| US | Seversky P-35A (84) | yes | .50 BMG + .30-06 MGs + AN-M57 bombs | 40 | 2433 | 450 | no |
| US | Mustang P-51D (92) | yes | 6x .50 BMG + AN-M64A1 bombs | 40 | 2433 | 450 | no |
| Germany | Messerschmitt Bf 109E (20) | yes | 2x 20 mm (20x80RB) + 2x 7.92 mm MG + SC250 bomb | 40 | 2665 | 450 | no |
| Germany | Messerschmitt Bf 109D-1 (85) | yes | 20 mm (20x80RB) + 2x 7.92 mm MG + SC250 bomb | 40 | 3090 | 450 | no |
| Germany | Focke-Wulff FW-109 D-9 (93) | yes | 2x 20 mm + 2x 13 mm (13x64B) + SC500 bomb | 40 | 3090 | 450 | no |
| Soviet Union | Yakovlev Yak-9D (24) | yes | 20 mm (20x99R ShVAK ammo) + 12.7 mm + FAB-100 bombs | 40 | 3200 | 450 | no |
| Soviet Union | Mikoyan-Gurevich MiG-3 (83) | yes | 12.7 mm + 2x 7.62 mm + FAB-100 bombs | 40 | 3200 | 450 | no |
| Soviet Union | Lavochkin La-7 (86) | yes | 3x 20 mm (20x99R) + FAB-100 bombs | 40 | 3090 | 450 | no |

#### Heavy fighters / fighter-bombers

| Faction | Name in game data (id) | Available | Armament (decoded) | Speed (data) | Mass kg | HP | Mobile spawn |
|---|---|---|---|---|---|---|---|
| US | P-38 Lightning (21) | yes | 20 mm Hispano + 4x .50 BMG + bombs | 40 | 9390 | 650 | no |
| Germany | Messerschmitt Me 410 B-2/U2 (80) | yes | 2x 20 mm + 2x 13 mm fwd, 2x 13 mm rear + SC250 bombs | 40 | 9283 | 650 | no |
| Soviet Union | Petlyakov Pe-3bis (79) | yes | 20 mm + 2x 12.7 mm fwd, 12.7 mm defensive + FAB-250 bombs | 40 | 7620 | 650 | no |

#### Recon planes

| Faction | Name in game data (id) | Available | Armament (decoded) | Speed (data) | Mass kg | HP | Mobile spawn |
|---|---|---|---|---|---|---|---|
| US | Curtiss O-52 Owl (77) | yes | .30-06 fwd MG + .30-06 rear gunner + AN-M57 bombs | 40 | 2433 | 750 | no |
| Germany | Henschel HS 126 B-1 (75) | yes | 7.92 mm fwd MG + 7.92 mm rear gunner + SC250 bomb | 40 | 3090 | 750 | no |
| Soviet Union | Polikarpov R-Z (76) | yes | 7.62 mm fwd MG + 7.62 mm rear gunner + FAB-100 bombs | 40 | 3150 | 750 | no |

#### Transport planes

| Faction | Name in game data (id) | Available | Armament (decoded) | Speed (data) | Mass kg | HP | Mobile spawn |
|---|---|---|---|---|---|---|---|
| US | Douglas C-47A Skytrain (22) | yes | none listed | 40 | 13290 | 650 | no |
| Germany | Junkers Ju-52/3m (23) | yes | none listed | 40 | 13290 | 650 | no |

#### Neutral / scenery vehicles

| Faction | Name in game data (id) | Available | Armament (decoded) | Speed (data) | Mass kg | HP | Mobile spawn |
|---|---|---|---|---|---|---|---|
| Neutral | Pierre Bicycle (3) | yes | none listed | 34 | 12 | 500 | no |
| Neutral | Citroën AC4 Plateau (34) | yes | none listed | 72 | 1020 | 500 | no |
| Neutral | Universal-1 Tractor (81) | yes | none listed | 35 | 1995 | 500 | no |
| Neutral | Citroën AC4 Plateau (82) | yes | none listed | 72 | 1020 | 500 | no |

#### Entries flagged unavailable in the data (placeholders, NPC or cut content)

| Faction | Name in game data (id) | Available | Armament (decoded) | Speed (data) | Mass kg | HP | Mobile spawn |
|---|---|---|---|---|---|---|---|
| US | Douglas A-20G-20 Havoc (30) | **no (unused/NPC)** | none listed | 0 | 0 | 375 | no |
| US | B-17G Flying Fortress (73) | **no (unused/NPC)** | .50 BMG turrets (unavailable) | 30 | 9390 | 650 | yes |
| Germany | Junkers Ju-87G-1 "Stuka" (29) | **no (unused/NPC)** | none listed | 0 | 0 | 375 | no |
| Germany | Messerschmitt Bf 109E (62) | **no (unused/NPC)** | none listed | 40 | 8226 | 450 | no |
| Germany | Junkers Ju-87G-1 (74) | **no (unused/NPC)** | 20 mm + 7.92 mm (unavailable) | 40 | 6510 | 650 | no |
| Soviet Union | Petlyakov Pe-8 (32) | **no (unused/NPC)** | none listed | 0 | 0 | 375 | no |
| Neutral | DRB Class 52 (40) | **no (unused/NPC)** | none listed | 0 | 0 | 375 | no |
| Neutral | DRB_Wagon (41) | **no (unused/NPC)** | none listed | 0 | 0 | 375 | no |

Sources: [vehicletemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/vehicletemplate.json), armament decoded from [VehicleWeaponSlot.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/VehicleWeaponSlot.json) + [weaponAmmoMapping.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/weaponAmmoMapping.json) + [ammotemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/ammotemplate.json) (caliber/gun identification is my decoding of ammo group names; treat gun names as inferred).

### 5.3 Per-faction vehicle roster (summary of 5.2, final live data)
Source for all three lists: [D] [vehicletemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/vehicletemplate.json). Data names are expanded slightly for readability.

- **United States**
  - **Light vehicles and motorcycles:** Willys MB; Ford GPA (amphibious jeep; its ribbon is named "QMC-4 1/4 Ton Amphibian"); M29 Weasel; Harley-Davidson 42WLA solo and with sidecar.
  - **AA:** M16 MGMC (quad .50 half-track).
  - **APCs and trucks:** M3A1 half-track; GMC CCKW 352 truck.
  - **Armoured cars (Recon):** M8 Greyhound; M20; T8E1 Stuart Recce.
  - **Light tanks:** M2A2; M5A1 Stuart; M24 Chaffee.
  - **Medium tanks:** M3 Lee; M4A1 Sherman; M4A3E8 Sherman.
  - **Heavy tanks:** M4A3E2 "Jumbo" Sherman (76 mm in the data); M26 Pershing.
  - **Tank destroyers:** M10 Wolverine; M18 Hellcat; M36 Jackson; M36B1.
  - **Stationary:** M55 quad .50.
  - **Aircraft:** Seversky P-35A; Curtiss P-40N Warhawk; P-51D Mustang; P-38 Lightning (heavy fighter); Curtiss O-52 Owl (recon); Douglas C-47A Skytrain (transport).
  - **In the data but unavailable:** A-20G Havoc, B-17G Flying Fortress.
- **Germany**
  - **Light vehicles and motorcycles:** Kübelwagen Typ 82; Typ 166 Schwimmwagen; SdKfz 2 Kettenkrad; BMW R75 solo and with sidecar.
  - **AA:** Sd.Kfz. 7/1 (Flakvierling half-track).
  - **APCs and trucks:** SdKfz 251 (data "251-D"; ribbon "SdKfz 251/1"); Opel Blitz.
  - **Armoured cars (Recon):** SdKfz 222; SdKfz 234/2 Puma; SdKfz 250/3.
  - **Light tanks:** Panzer I Ausf. A; Panzer II Ausf. C; Panzer 38(t) Ausf. E; Panzer II Ausf. L (Luchs).
  - **Medium tanks:** Panzer III Ausf. J (ribbon "J/1"); Panzer IV Ausf. H; Panther Ausf. G.
  - **Heavy tanks:** Tiger; Tiger II.
  - **Tank destroyers:** StuG III (ribbon "Ausf. G"); Jagdpanzer 38(t) Hetzer; Jagdpanther.
  - **Stationary:** Flakvierling 38.
  - **Aircraft:** Bf 109D-1; Bf 109E (ribbon "E-4"); Fw 190 D-9; Me 410 B-2/U2 (heavy fighter); Henschel Hs 126 B-1 (recon); Junkers Ju 52/3m (transport).
  - **In the data but unavailable:** Ju 87G-1 "Stuka".
- **Soviet Union**
  - **Light vehicles and motorcycles:** GAZ-67; M-72 solo and with sidecar; T-20 Komsomolets (armoured tractor).
  - **AA:** GAZ-AAA with M-4 quad Maxim.
  - **Truck:** GAZ-AAA Cargo.
  - **Armoured cars (Recon):** BA-64B; BA-6; BA-11.
  - **Light tanks:** T-38 (amphibious); T-26 Model 1933; BT-7 Model 1937; T-70 Model 1942.
  - **Medium tanks:** T-28 Model 1934; T-34/76 Model 1942; T-34-85 Model 1944.
  - **Heavy tanks:** KV-85; IS-2 Model 1944.
  - **Tank destroyers:** SU-76M; SU-85; SU-100.
  - **Stationary:** Maxim M4 quad.
  - **Aircraft:** MiG-3; Yak-9D; La-7; Pe-3bis (heavy fighter); Polikarpov R-Z (recon).
  - **No Soviet transport plane** exists in the data (**unconfirmed** which one Soviet paratroopers used).
  - **In the data but unavailable:** Pe-8.
- **Neutral or civilian:** Pierre bicycle, Citroën AC4 Plateau truck, Universal-1 tractor. Unavailable: DRB Class 52 locomotive and wagon.
- **Ribbon names add model detail:** "Stug III Ausf. G", "Panzer III, Ausf. J/1", "Bf 109E-4", "SdKfz 251/1", "WLA with Sidecar", "R75 with Sidecar". [D] [ribbontemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/ribbontemplate.json)
- **Cross-references for vehicles** (not opened): [wiki: Vehicles](https://heroesandgenerals.fandom.com/wiki/Vehicles), [wiki: Light Tanks](https://heroesandgenerals.fandom.com/wiki/Light_Tanks), [NamuWiki: German vehicles](https://en.namu.wiki/w/%ED%9E%88%EC%96%B4%EB%A1%9C%EC%A6%88%20%EC%95%A4%20%EC%A0%9C%EB%84%88%EB%9F%B4%EC%8A%A4/%EB%8F%85%EC%9D%BC%EA%B5%B0%20%ED%83%91%EC%8A%B9%EC%9E%A5%EB%B9%84), [NamuWiki: US vehicles](https://en.namu.wiki/w/%ED%9E%88%EC%96%B4%EB%A1%9C%EC%A6%88%20%EC%95%A4%20%EC%A0%9C%EB%84%88%EB%9F%B4%EC%8A%A4/%EB%AF%B8%EA%B5%B0%20%ED%83%91%EC%8A%B9%EC%9E%A5%EB%B9%84)

**Caveat on completeness:** this is the roster in the *final* data dump (about 2022 to 2023). Vehicles that were removed earlier in the game's life, if any, would not appear. I found no evidence of removed vehicles, but the archive of earlier versions was not reachable (**unconfirmed**).

---

## 6. Open questions and items I could not confirm
1. **Closed alpha dates**, the end of the Square Enix deal, and the Epic Games Store release date.
2. **Concurrent-player peaks** (SteamDB) and critical reception (PC Gamer, Rock Paper Shotgun, Metacritic). None of these could be fetched.
3. **Non-capital town names** on the war map, and the layout of earlier war maps (2013 to 2015). The older Steam guide lists different capitals (Berlin, London, Moscow and so on; see 2.3).
4. **A "Resistance" mechanic.** Not found (see 2.8). Worth checking archive.org copies of wiki.heroesandgenerals.com.
5. **Rank titles** per faction.
6. **Equipment-point cost per item**, and weapon base stats (damage, rate of fire, magazine size, reload). There is no weapon-template table in the data I could read. Per-ammo damage and range values do exist in [ammotemplate.json](https://github.com/raouldeheer/Heroes-and-Generals-community-project/blob/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json/ammotemplate.json).
7. **How weapon mods were unlocked and paid for.** What careers and ribbon levels unlocked.
8. **Which specific vehicles and weapons each update added**, beyond the Soviet launch items.
9. **Class rules for launchers, grenades, mines and scoped sniper variants.**
10. **Fan revival dates.** The "2013 build Dec 2024 / 2014 build Feb 2025 / 2017 build May 2025 / 2023 build June 2026" sequence comes from one source (Wikipedia, via a search summary).
11. **The meaning of some data fields:** `deployPool*`, `captureTransferMultiplier*`, `aTDeployCostPercent`, `vehicleSpawnSlots`, and the leadership combat badges.

**Suggested next steps.**
- If you add [raouldeheer/Heroes-and-Generals-community-project](https://github.com/raouldeheer/Heroes-and-Generals-community-project) to a session, the remaining tables can be read in full rather than through search snippets: per-weapon mods, ammo stats, vehicle ammo storage, ribbons and careers. This session could not open the repository directly.
- A follow-up web pass, after the search budget resets, could target archive.org snapshots of wiki.heroesandgenerals.com (2014 to 2016) for the "resistance" question and the older war map.

---

## 7. Source index (everything cited above)

**Game data (fan-extracted from the live servers, final state about 2022 to 2023).** Base path: https://github.com/raouldeheer/Heroes-and-Generals-community-project/tree/0e0ce4de7ef5919b14bc007f22384092d2fdf313/packages/hagcp-assets/json. Files used: factiontemplate, capital, gamemap, missiontype, missionpreset, commandnodetemplate, commandnodetemplatearmyresourcetemplaterelation, armyresourcecategory, ArmyResourceProductionTemplate, CommandNodeMoraleTemplate, AssaultTeamLevel, WarBonusTemplate, ExperienceLevels, PlayerLevel, PlayerLevelUnlock, charactertemplate, CharacterCareerTemplate, weaponslotcategory, WeaponModCategory, WeaponModifierTemplate, WeaponModMapping, WeaponVariantTemplate, weaponAmmoMapping, ammotemplate, ribbontemplate, ribbonlevel, RibbonRequirement, RibbonLevelUpgradeTemplate, combatbadgetype, combatbadgetemplate, vehicletemplate, VehicleWeaponSlot, vehicleupgradetemplate, MembershipBenefitTemplate, ShopMembershipItems, ShopWarBondItemTemplate, battle_pass_season_template. Each file is `<name>.json` in that folder.

**Web pages** (seen through WebSearch summaries only, not opened):
- **Encyclopaedic:**
  - https://en.wikipedia.org/wiki/Heroes_%26_Generals
  - https://en.wikipedia.org/wiki/Reto-Moto
  - https://mobygames.com/company/11232/reto-moto-aps
  - https://www.moddb.com/engines/retox/articles
  - https://www.indiedb.com/engines/retox
  - https://stopkillinggames.wiki.gg/wiki/Heroes_&_Generals
  - https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/HeroesAndGenerals
  - https://www.imfdb.org/wiki/Heroes_&_Generals
  - NamuWiki class and equipment pages (linked inline)
- **Official wiki** (fandom; pages cited inline):
  - Strategy_Game, Campaign_map, Victory_conditions, Map_point, Town, Airfield, Factory, Mountain_Town, Assault_Team, Talk:Assault_Team, Assault_Team_Costs, Guard, Motorized_Guard, Mechanized_Infantry, Light_Armor, Medium_Armor, Heavy_Armor, Armor
  - Battle_System, Battle_Director, Action_Rules, Getting_Started, Un-deployed, Command_Points, Ranks, Generals, General_tips, Characters, Starter_Guide, Loadouts, Infantryman
  - Weapons, Weapons_Modifiers, Scopes, Explosives, Category:US_weapons, Category:German_weapons, Category:Russian_weapons
  - PTRD-41, Bazooka_M1A1, Bazooka_M9A1, Panzerschreck_RPzB_54, Grenade_Mk_II, RGD-33, RPG-43, Hafthohlladung_H3, No.74
  - Previous_Changelogs, Basic_Game_Tutorial_-_outdated, Greek_Resistance, File:Warfunds.png
- **News and press:**
  - Engadget (2011-10-12; 2012-06-19)
  - Blue's News announcement
  - Gaming Nexus (E3 2012)
  - Guru3D and DSOGaming (Square Enix deal)
  - Everyeye (open beta)
  - PCGamesN (early access; Soviet update; Forward Airfield; "everything we know")
  - MassivelyOP (2015-03-02 Soviet faction; 2016-09-23 launch; ?p=562349; 2025-12-05 Insight Interactive)
  - GameSpot (Soviet update)
  - Worthplaying (2015-03-02; 2015-07-23; 2018-12-11)
  - KeenGamer (8 million players; Furness update)
  - Wccftech (Young update)
  - MMORPG.com (tank destroyers update)
  - Fandom article (Stronghold update)
  - MMOBomb (full launch)
  - Business Wire (2022-02-03)
  - Game Developer (shutdown)
  - MMOs.com (shutdown/sequel)
  - Delisted Games
  - MMO Fallout (2023-05-25)
  - Prima Games (Epic Games Store)
  - Newswire (Reto-Moto press release)
- **Community:**
  - Steam discussions and guides (linked inline)
  - Patreon hnggroup
  - hng-group.com/RevivalJourney
  - Enlisted forum
  - Insight Interactive site and FAQ
  - gamepressure.com H&G guide pages
