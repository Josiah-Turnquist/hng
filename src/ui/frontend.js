// The front end, laid out like the original game's main interface: a top bar with
// the Heroes, Generals and Progression tabs and, at the right, the player's level,
// the army of the chosen soldier, settings, full screen and about.
//   Heroes: the soldier roster (recruit more, any army and class), the chosen
//     soldier standing in 3D with his badge, his loadout, what he is nearest
//     to opening, and Ready for battle with the battle he will join; gear,
//     badge, tank, uniform and ribbons in windows.
//   Generals: the battles to join, the battlefield's map and the battle's details.
//   Progression: the player's level, each soldier's rank and record, the ranks.
// Resolves with the battle options when the player goes into battle.
import { MAPS } from '../world/maps.js';
import { FACTIONS, WEAPONS, baseOf, weaponsFor, LOADOUT_SLOTS, CLASS_POINTS, pointsOf, loadoutPoints } from '../weapons/defs.js';
import { BADGES, BADGE_SLOTS, badgeOf, badgesOf, badgeTiers, wearable, wornIds } from '../game/badges.js';
import { RIBBONS, RIBBON_XP, ribbonInfo, ribbonLevel, ribbonsFor, requirement, requirementText, unlocked, carriable, tankRequirement, tankUnlocked } from '../game/ribbons.js';
import { ribbonSvg, RIBBON_GROUPS } from './ribbonArt.js';
import { badgeSvg } from './badgeArt.js';
import { AMMO } from '../weapons/ammo.js';
import { UPGRADE_SLOTS, SLOT_NAMES, AMMO_TYPES, GUN_UPGRADES, upgradesOf, upgradedDef, upgradeOpen, specialistKey, damageScale as scaleAt, SCOPE_FAMILIES } from '../weapons/upgrades.js';
import { priceOf, owns, canBuy, buy, ownsUpgrade, canBuyUpgrade, buyUpgrade, picksOf, fit, loadoutUpgrades } from '../game/armory.js';
import { variantCount } from '../actors/soldierKit.js';
import { SettingsView } from './settingsView.js';
import { emblem, classIcon, rankBadge, ICONS } from './icons.js';
import { loadRoster, saveRoster, selected, select, recruit, dismiss, rename, NAME_MAX, rankOf, rankTitle, playerLevel, randomName, RANK_XP, RANK_TITLES, CLASS_NAMES, CLASS_NOTES, MAX_SOLDIERS } from './roster.js';
import { SoldierPreview } from './soldierPreview.js';
import { BattleMap } from './battleMap.js';
import { signOut } from '../net/auth.js';
import { WarMapView, ARMY_COLORS } from './warMapView.js';
import { MAP, KIND_NAMES } from '../war/warMap.js';
import { TEAM_LEVELS, WAR_BONUS } from '../war/warMapData.js';
import { newWar, nextWar, tick, buy as buyTeam, deploy, deployProblem, order, withdraw, upgrade, upgradeProblem, upgradesFor, capitalsOf, ownerOf, teamOf, battleOf, teamsAt, cpUsed, teamLevel, fullness, refillCost, supplied, canFly, clock, TEAMS, BUYABLE, ARMIES, RESOURCE_NAMES, WAR_SPEED, CAPITALS_TO_WIN, BATTLE_TIME } from '../war/war.js';
import { loadWar, saveWar, commandPoints, generalRank, canPromote, promote, hireGeneral, mayLead, GENERAL_RANK, HIRE_PRICE } from '../war/warStore.js';
import { GAME_NAME, GAME_TAGLINE } from '../core/brand.js';

const TANKS = {
  US: [
    ['m5a1_stuart', 'M5A1 Stuart', 'Light tank, 37 mm gun, fast. Four crew.'],
    ['m4a1_sherman', 'M4A1 Sherman', 'Medium tank, 75 mm gun, gyrostabilized. Five crew.'],
  ],
  GE: [
    ['panzer4_h', 'Panzer IV Ausf. H', 'Medium tank, long 75 mm gun, 80 mm front. Five crew.'],
    ['tiger1', 'Tiger I', 'Heavy tank, 88 mm gun, 100 mm front, slow to turn. Five crew.'],
  ],
  SU: [
    ['t34_76', 'T-34/76', 'Medium tank, 76 mm gun, sloped armor, wide tracks. Four crew.'],
    ['t34_85', 'T-34-85', 'Medium tank, 85 mm gun in a three-man turret. Five crew.'],
  ],
};

const MISSIONS = [
  { id: 'town', kind: 'Assault', title: MAPS.town.name, line: 'Take, or hold, the police station and the church.', note: 'Five lines of capture points (A to E) lead to the two objectives, taken in order. The attackers have 30 seconds per point, the defenders the clock.' },
  { id: 'range', kind: 'Practice', title: MAPS.range.name, line: 'Firing lanes from 25 to 800 m and a motor pool with every vehicle.', note: 'No enemies: zero your sights, try every gun against paper, steel and armor, and drive the tanks, jeeps and bikes.' },
];

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmt = (n) => Math.round(n).toLocaleString('en-US');

function weaponStats(w) {
  if (w.type === 'melee' || !w.ammo) return `${w.length ? `${Math.round(w.length * 100)} cm · ` : ''}${w.mass.toFixed(2)} kg`;
  const am = AMMO[w.ammo];
  if (w.type === 'grenade') return [am?.name || w.name, am?.fuseTime ? `${am.fuseTime} s fuse` : '', `${w.mass.toFixed(2)} kg`].filter(Boolean).join(' · ');
  const parts = [am?.name || w.ammo, `${Math.round(w.mv)} m/s`];
  if (w.rpm && w.modes.some((m) => m === 'auto')) parts.push(`${w.rpm} rounds/min`);
  if (w.capacity > 1) parts.push(`${w.capacity} rounds`);
  if (w.scope) parts.push(`${w.scope.mag}x scope`);
  parts.push(`${w.mass.toFixed(1)} kg`);
  return parts.join(' · ');
}

// The bars of the customization screen: each a score where the gun as
// issued is 1 and higher is better.
const METRICS = [
  ['Damage', (d) => scaleAt(d, 20)],
  ['Range', (d) => scaleAt(d, 200)],
  ['Bullet speed', (d, b) => d.mv / b.mv],
  ['Accuracy', (d, b) => b.accuracy / d.accuracy],
  ['Fire rate', (d, b) => (b.bolt?.cycle ? b.bolt.cycle / d.bolt.cycle : d.rpm && b.rpm ? d.rpm / b.rpm : 1)],
  ['Control', (d, b) => (b.recoil?.rise ?? 1) / (d.recoil?.rise ?? 1)],
  ['Hip fire', (d, b) => b.hipError / (d.hipError * (d.hipStance?.stand ?? 1))],
];

// One line on what an upgrade does, from its biggest changes.
const SAYS = [
  ['damage', 'hits harder', 'hits softer'],
  ['rangeNear', 'keeps its punch further out', 'loses its punch sooner'],
  ['coneAim', 'less accurate', 'more accurate'],
  ['chamberTime', 'slower between shots', 'quicker between shots'],
  ['recoilUp', 'kicks more', 'kicks less'],
  ['coneStand', 'wilder from the hip', 'steadier from the hip'],
];
function summary(gun, u) {
  const f = u.f || {};
  if (u.slot === 'ammo') {
    const d = upgradedDef(gun, { ammo: u.id });
    const b = WEAPONS[gun];
    Object.assign(f, { damage: scaleAt(d, 20), rangeNear: scaleAt(d, 200) / scaleAt(d, 20), coneAim: d.accuracy / b.accuracy, recoilUp: d.recoil.rise / b.recoil.rise });
  }
  const out = SAYS.map(([k, up, down]) => ({ v: (f[k] ?? 1) - 1, text: (f[k] ?? 1) > 1 ? up : down }))
    .filter((x) => Math.abs(x.v) >= 0.02)
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
    .slice(0, 3)
    .map((x) => x.text);
  if (u.family) return `${SCOPE_FAMILIES[u.family].name} telescopic sight, ${u.name.match(/\((.*)\)/)?.[1] || 'its own'} reticle.`;
  if (!out.length) return 'Little change.';
  const t = out.join(', ');
  return `${t[0].toUpperCase()}${t.slice(1)}.`;
}

const enemyOf = (f, chosen) => (chosen && chosen !== f && FACTIONS[chosen] ? chosen : f === 'GE' ? 'US' : 'GE');

export function showFrontEnd(app) {
  return new Promise((resolve) => {
    const roster = loadRoster();
    const save = () => saveRoster(roster);
    const root = el('div', 'fe');
    root.innerHTML = `
      <header class="fe-top">
        <div class="fe-brand">${esc(GAME_NAME)}<span>${esc(GAME_TAGLINE)}</span></div>
        <nav class="fe-tabs">
          <button data-screen="heroes">Heroes</button>
          <button data-screen="generals">Generals</button>
          <button data-screen="progression">Progression</button>
        </nav>
        <div class="fe-status">
          <div class="fe-credits"></div>
          <div class="fe-level" title="Player level"></div>
          <div class="fe-army"></div>
          <button class="fe-friends" hidden title="Friends and party">Friends<i></i></button>
          <button class="fe-account" hidden></button>
          <button class="fe-icon" data-screen="settings" title="Settings">${ICONS.gear}</button>
          <button class="fe-icon fe-fs" title="Full screen">${ICONS.screen}</button>
          <button class="fe-icon" data-screen="about" title="About">${ICONS.info}</button>
        </div>
      </header>
      <main class="fe-main"></main>
      <div class="fe-touch" hidden>This game needs a keyboard and a mouse (or touchpad). Open it on a computer to play.</div>`;
    app.root.appendChild(root);
    const main = root.querySelector('.fe-main');
    // Signed in (online): the account's name; press twice to sign out.
    const acct = root.querySelector('.fe-account');
    if (app.account) {
      acct.hidden = false;
      acct.textContent = app.account.user.name || app.account.user.email;
      acct.title = `Signed in as ${app.account.user.email}. Press to sign out.`;
      acct.addEventListener('click', async () => {
        if (!acct.classList.contains('sure')) {
          acct.classList.add('sure');
          acct.textContent = 'Sign out?';
          setTimeout(() => {
            acct.classList.remove('sure');
            acct.textContent = app.account.user.name || app.account.user.email;
          }, 3000);
          return;
        }
        await signOut();
        location.reload();
      });
    }
    // Friends and party (signed in, on the game server): the button, with a
    // count of requests and invites waiting; called into battle by the leader.
    const lobby = app.lobby || null;
    let offLobby = null;
    if (lobby) {
      const fb = root.querySelector('.fe-friends');
      fb.hidden = false;
      const badge = () => {
        const n = lobby.state.friends.filter((x) => x.status === 'asks').length + lobby.state.invites.length;
        fb.querySelector('i').textContent = n ? String(n) : '';
        fb.classList.toggle('party', !!lobby.state.party);
      };
      offLobby = lobby.on(badge);
      badge();
      fb.addEventListener('click', () => friendsWindow());
      lobby.onGo = () => partyGo();
    }
    root.querySelector('.fe-touch').hidden = !matchMedia('(hover: none) and (pointer: coarse)').matches;
    let screen = 'heroes';
    let view = null; // settings pages, when open
    let preview = null;
    try {
      preview = new SoldierPreview(app.renderer);
      // The backdrop behind him: Mist (the others kept to compare, by
      // ?backdrop=dark|smoke|mist|dusk|pale|night).
      const bd = app.params?.get?.('backdrop') || 'mist';
      preview.setBackdrop(bd);
      root.dataset.backdrop = bd;
    } catch (e) {
      console.warn('No soldier preview', e);
    }

    // Into battle: the staged battle chosen, or a battle of the war (b) that
    // this soldier joins as a hero.
    const go = (b = null, war = null) => {
      const s = selected(roster);
      const m = roster.mission;
      if (b) {
        b.hero = s.id;
        saveWar(war);
      }
      const att = b ? b.att === s.faction : m.side === 'attack';
      // Online (signed in): the game server's battle; the server says which side.
      const online = !b && !!m.online && !!app.account;
      // His party follows him in.
      if (online && lobby?.leading) lobby.go();
      offLobby?.();
      if (lobby) lobby.onGo = null;
      save();
      window.removeEventListener('keydown', onKey);
      view?.close();
      preview?.dispose();
      root.remove();
      resolve({
        online,
        map: b || online ? 'town' : m.map,
        mode: 'auto',
        faction: s.faction,
        side: att ? 'attack' : 'defend',
        enemy: b ? (att ? b.def : b.att) : enemyOf(s.faction, m.enemy),
        cls: s.cls,
        tank: s.cls === 'tanker' ? s.tank || TANKS[s.faction][0][0] : null,
        loadout: [...s.loadout],
        badges: badgesOf(s),
        upgrades: loadoutUpgrades(s, s.loadout),
        bots: m.bots,
        minutes: b ? BATTLE_TIME / 60 : m.minutes,
        soldier: { id: s.id, name: s.name, seed: s.seed, variant: s.variant },
        war: b ? { number: war.number, battle: b.id, point: MAP.name(b.point) } : null,
      });
    };

    const topBar = () => {
      const s = selected(roster);
      const lv = playerLevel(roster);
      root.querySelector('.fe-level').innerHTML = `<b>${lv.level}</b><span>Level</span><i style="--p:${lv.progress.toFixed(3)}"></i>`;
      root.querySelector('.fe-level').title = `Player level ${lv.level}: ${fmt(lv.xp)} XP from all your soldiers`;
      const cr = root.querySelector('.fe-credits');
      cr.innerHTML = `${ICONS.coin || ''}<b>${fmt(roster.credits || 0)}</b><span>Credits</span>`;
      cr.title = 'Credits, shared by all your soldiers: earned in battle, spent on guns and upgrades';
      root.querySelector('.fe-army').innerHTML = `${emblem(s.faction)}<span>${FACTIONS[s.faction].army}</span>`;
      root.querySelectorAll('.fe-tabs button, .fe-icon[data-screen]').forEach((b) => b.classList.toggle('on', b.dataset.screen === screen));
    };

    // Called into battle by his party's leader: with a soldier of the leader's
    // army if he has one (so they fight side by side), into the online battle.
    const partyGo = () => {
      const m = roster.mission;
      m.online = true;
      m.war = null;
      const army = lobby?.leaderArmy;
      if (army && selected(roster).faction !== army) {
        const same = roster.soldiers.find((x) => x.faction === army);
        if (same) select(roster, same.id);
      }
      save();
      show('heroes');
      main.querySelector('.ready-btn')?.click();
    };

    // Friends and party: friends (asked by name, requests, who is on), the
    // party (invites, members and their armies, leaving) and party chat.
    function friendsWindow() {
      const W = openWindow('Friends and party', { sub: 'Play in the same battle, on the same side', cls: 'hx-wide' });
      W.body.innerHTML = `<div class="fr">
        <section class="fr-col">
          <h3>Add a friend</h3>
          <form class="fr-add"><input maxlength="24" placeholder="Their player name" autocomplete="off"><button>Add</button></form>
          <div class="fr-note"></div>
          <h3>Friends</h3>
          <div class="fr-list"></div>
        </section>
        <section class="fr-col">
          <h3>Party</h3>
          <div class="fr-party"></div>
          <div class="fr-chat"><div class="fr-log"></div><form class="fr-say"><input maxlength="200" placeholder="Say something to your party" autocomplete="off"><button>Send</button></form></div>
        </section>
      </div>`;
      const add = W.body.querySelector('.fr-add');
      add.addEventListener('submit', (e) => {
        e.preventDefault();
        const inp = add.querySelector('input');
        if (inp.value.trim()) lobby.ask(inp.value.trim());
        inp.value = '';
      });
      const say = W.body.querySelector('.fr-say');
      say.addEventListener('submit', (e) => {
        e.preventDefault();
        const inp = say.querySelector('input');
        if (inp.value.trim()) lobby.say(inp.value.trim());
        inp.value = '';
      });
      const button = (text, fn, cls = '') => {
        const b = el('button', cls);
        b.textContent = text;
        b.addEventListener('click', fn);
        return b;
      };
      const WHERE = { menus: 'Online', battle: 'In battle' };
      const draw = (st) => {
        if (!W.box.isConnected) return off();
        W.body.querySelector('.fr-note').textContent = st.note || '';
        const me = st.me?.id;
        const p = st.party;
        const inParty = new Set(p ? [...p.members.map((x) => x.id), ...(p.invited || []).map((x) => x.id)] : []);
        // Friends: requests first, then who is on, then the rest.
        const list = W.body.querySelector('.fr-list');
        list.innerHTML = '';
        const order = { asks: 0, friend: 1, asked: 2 };
        const rank = (x) => order[x.status] * 3 + (x.where === 'menus' ? 0 : x.where === 'battle' ? 1 : 2);
        for (const x of [...st.friends].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))) {
          const row = el('div', `fr-row ${x.where || 'off'}`);
          row.innerHTML = '<i class="dot"></i><b></b><small></small><span class="fr-btns"></span>';
          row.querySelector('b').textContent = x.name || '(no name)';
          row.querySelector('small').textContent = x.status === 'asks' ? 'Wants to be friends' : x.status === 'asked' ? 'Asked' : WHERE[x.where] || 'Offline';
          const btns = row.querySelector('.fr-btns');
          if (x.status === 'asks') {
            btns.append(button('Accept', () => lobby.accept(x.id), 'gold'), button('Decline', () => lobby.drop(x.id)));
          } else if (x.status === 'asked') btns.append(button('Cancel', () => lobby.drop(x.id)));
          else {
            if (x.where && !inParty.has(x.id) && (!p || p.leader === me)) btns.append(button('Invite', () => lobby.invite(x.id), 'gold'));
            btns.append(button('Remove', () => lobby.drop(x.id)));
          }
          list.appendChild(row);
        }
        if (!st.friends.length) list.innerHTML = '<div class="lo-note">No friends yet. Add one by their player name.</div>';
        // The party, and invites to others.
        const pb = W.body.querySelector('.fr-party');
        pb.innerHTML = '';
        for (const inv of st.invites) {
          const row = el('div', 'fr-row fr-inv');
          row.innerHTML = '<b></b><span class="fr-btns"></span>';
          row.querySelector('b').textContent = `${inv.name} invites you to a party`;
          row.querySelector('.fr-btns').append(button('Join', () => lobby.take(inv.party), 'gold'), button('No thanks', () => lobby.turnDown(inv.party)));
          pb.appendChild(row);
        }
        if (!p) pb.appendChild(el('div', 'lo-note', 'Not in a party. Invite a friend who is online, and you go into battle together when the party leader presses Ready for battle.'));
        else {
          for (const x of p.members) {
            const row = el('div', `fr-row ${x.where || 'off'}`);
            row.innerHTML = '<i class="dot"></i><b></b><small></small><span class="fr-btns"></span>';
            const tags = [x.id === p.leader ? 'leader' : null, x.id === me ? 'you' : null].filter(Boolean);
            row.querySelector('b').textContent = tags.length ? `${x.name} (${tags.join(', ')})` : x.name;
            row.querySelector('small').textContent = [x.army ? FACTIONS[x.army]?.army : null, WHERE[x.where]].filter(Boolean).join(' · ');
            if (p.leader === me && x.id !== me) row.querySelector('.fr-btns').append(button('Remove', () => lobby.kick(x.id)));
            pb.appendChild(row);
          }
          for (const x of p.invited || []) {
            const row = el('div', 'fr-row off');
            row.innerHTML = '<i class="dot"></i><b></b><small>Invited</small>';
            row.querySelector('b').textContent = x.name;
            pb.appendChild(row);
          }
          const lead = p.members.find((x) => x.id === p.leader);
          const mine = p.members.find((x) => x.id === me);
          if (lead?.army && mine?.army && lead.army !== mine.army) pb.appendChild(el('div', 'fr-warn', `Your leader fights for the ${FACTIONS[lead.army].army}. When the party goes in, you take a soldier of that army if you have one.`));
          pb.appendChild(el('div', 'lo-note', p.leader === me ? 'Press Ready for battle and your party comes with you.' : 'When your leader presses Ready for battle, you go in with them.'));
          pb.appendChild(button('Leave party', () => lobby.leave()));
        }
        W.body.querySelector('.fr-chat').hidden = !p;
        const log = W.body.querySelector('.fr-log');
        log.innerHTML = '';
        for (const l of st.chat) {
          const line = el('div', `fr-line${l.mine ? ' mine' : ''}`);
          line.innerHTML = '<b></b><span></span>';
          line.querySelector('b').textContent = `${l.name}:`;
          line.querySelector('span').textContent = ` ${l.text}`;
          log.appendChild(line);
        }
        log.scrollTop = log.scrollHeight;
      };
      const off = lobby.on(draw);
      draw(lobby.state);
    }

    const show = (name) => {
      screen = name;
      view?.close();
      view = null;
      main.innerHTML = '';
      main.className = `fe-main fe-${name}`;
      root.classList.toggle('stage', name === 'heroes' && !!preview);
      ({ heroes, generals, progression, settings, about })[name]();
      topBar();
      // The soldier stands in 3D on the Heroes screen only.
      if (name === 'heroes') preview?.start();
      else preview?.stop();
    };

    // --- Heroes -------------------------------------------------------------------
    // As in the original game's Heroes screen, kept to what the soldier has
    // and can use: the roster (filtered by army and class), the soldier with
    // his badge, his loadout (a card for each thing he carries; one line to add
    // more of a kind only while he has points to spare), what he is nearest to
    // opening, and the battle. Choosing gear, the badge, the tank, the uniform
    // and the ribbons open in windows.
    const filter = { armies: new Set(['US', 'GE', 'SU']), cls: '' };
    function heroes() {
      const s = selected(roster);
      main.innerHTML = `
        <aside class="fe-roster hx-col"><div class="hx-filter"></div><div class="roster-list"></div></aside>
        <div class="fe-stage hx-stage"><div class="fe-nameplate"></div><div class="hx-badges"></div></div>
        <section class="hx-col hx-load"><div class="hx-head"><div class="hx-icons"></div><div class="hx-pts"></div></div><div class="hx-slots"></div></section>
        <aside class="hx-col hx-right"><div class="fe-panel hx-next"></div><div class="fe-ready"></div></aside>`;
      // Roster, filtered by army and class.
      const fl = main.querySelector('.hx-filter');
      for (const f of ['US', 'GE', 'SU']) {
        const b = el('button', filter.armies.has(f) ? 'on' : '', emblem(f));
        b.title = FACTIONS[f].army;
        b.addEventListener('click', () => {
          if (filter.armies.has(f) && filter.armies.size > 1) filter.armies.delete(f);
          else filter.armies.add(f);
          show('heroes');
        });
        fl.appendChild(b);
      }
      const sel = el('select', 'hx-select');
      sel.innerHTML = `<option value="">All soldiers</option>${Object.entries(CLASS_NAMES).map(([k, n]) => `<option value="${k}"${filter.cls === k ? ' selected' : ''}>${n}</option>`).join('')}`;
      sel.addEventListener('change', () => {
        filter.cls = sel.value;
        show('heroes');
      });
      fl.appendChild(sel);
      const list = main.querySelector('.roster-list');
      for (const x of roster.soldiers) {
        if (x.id !== s.id && (!filter.armies.has(x.faction) || (filter.cls && x.cls !== filter.cls))) continue;
        const r = rankOf(x.xp);
        const card = el('button', `soldier-card${x.id === s.id ? ' on' : ''}`);
        card.innerHTML = `<span class="sc-emb">${emblem(x.faction)}</span><span class="sc-text"><b></b><small></small></span><span class="sc-rank">${rankBadge(r.rank)}<i>${r.rank}</i></span><span class="sc-class" title="${CLASS_NAMES[x.cls]}">${classIcon(x.cls)}</span>`;
        card.querySelector('b').textContent = x.name;
        card.querySelector('small').textContent = `${rankTitle(x.faction, r.rank)} · ${CLASS_NAMES[x.cls]}`;
        card.addEventListener('click', () => {
          select(roster, x.id);
          save();
          show('heroes');
        });
        list.appendChild(card);
      }
      const add = el('button', 'soldier-card recruit', `<span class="sc-emb">${ICONS.plus}</span><span class="sc-text"><b>Recruit a soldier</b><small>${roster.soldiers.length} of ${MAX_SOLDIERS}</small></span>`);
      add.disabled = roster.soldiers.length >= MAX_SOLDIERS;
      add.addEventListener('click', () => recruitPanel());
      list.appendChild(add);
      // Send the chosen soldier home (asked once more first; the last one stays).
      if (roster.soldiers.length > 1) {
        const foot = el('div', 'roster-foot');
        const ask = () => {
          foot.innerHTML = '';
          const b = foot.appendChild(el('button', 'dismiss'));
          b.textContent = `Dismiss ${s.name}`;
          b.addEventListener('click', () => {
            foot.innerHTML = '<span></span><button class="yes">Dismiss</button><button class="no">Keep</button>';
            foot.querySelector('span').textContent = `Send ${s.name} home? His rank and record go with him.`;
            foot.querySelector('.yes').addEventListener('click', () => {
              dismiss(roster, s.id);
              save();
              show('heroes');
            });
            foot.querySelector('.no').addEventListener('click', ask);
          });
        };
        ask();
        main.querySelector('.fe-roster').appendChild(foot);
      }
      // The soldier in 3D, his name plate, and his two badges under him.
      const stage = main.querySelector('.fe-stage');
      if (preview) {
        // (His main gun with the upgrades fitted to it: a scope shows on it.)
        preview.show({ faction: s.faction, cls: s.cls, seed: s.seed, variant: s.variant, primary: s.loadout[0], picks: picksOf(s, s.loadout[0]) });
        preview.frame(stage);
        if (!stage.dataset.drag) {
          preview.enableDrag(stage);
          stage.dataset.drag = '1';
        }
      }
      const r = rankOf(s.xp);
      const plate = main.querySelector('.fe-nameplate');
      plate.innerHTML = `<span class="np-rank">${rankBadge(r.rank)}</span><div class="np-text"><h2></h2><div class="np-sub"></div><div class="xp"><i style="width:${(r.progress * 100).toFixed(1)}%"></i></div><div class="np-xp"></div></div>`;
      plate.querySelector('h2').textContent = s.name;
      // Rename him: the pencil turns the name into a box; Enter keeps, Esc doesn't.
      const pen = el('button', 'np-pen', ICONS.pen);
      pen.title = 'Rename';
      pen.addEventListener('click', () => {
        const h = plate.querySelector('h2');
        const box = el('input', 'np-name');
        box.value = s.name;
        box.maxLength = NAME_MAX;
        box.spellcheck = false;
        h.replaceWith(box);
        pen.hidden = true;
        box.focus();
        box.select();
        let done = false;
        const end = (keep) => {
          if (done) return;
          done = true;
          if (keep && rename(roster, s.id, box.value)) save();
          show('heroes');
        };
        box.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter') end(true);
          else if (e.key === 'Escape') end(false);
        });
        box.addEventListener('blur', () => end(true));
      });
      plate.querySelector('h2').after(pen);
      // A General (rank 18 and promoted): marked by his name; he keeps fighting.
      if (s.general) plate.querySelector('h2').insertAdjacentHTML('beforeend', '<span class="np-gen">General</span>');
      else if (canPromote(s)) {
        const pb = el('button', 'np-promote', 'Promote to General');
        pb.title = 'He can lead the war on the Generals side, and still fights';
        pb.addEventListener('click', () => {
          promote(roster, s.id);
          save();
          show('heroes');
        });
        plate.querySelector('.np-text').appendChild(pb);
      }
      plate.querySelector('.np-sub').textContent = `Rank ${r.rank} · ${rankTitle(s.faction, r.rank)} · ${CLASS_NAMES[s.cls]}`;
      plate.querySelector('.np-xp').textContent = r.next === null ? `${fmt(s.xp)} XP: the highest rank` : `${fmt(s.xp)} / ${fmt(r.next)} XP`;
      // Each like a loadout card: its label, the badge, its name.
      for (let slot = 0; slot < BADGE_SLOTS; slot++) {
        const worn = badgeOf(s, slot);
        const bd = el('button', 'hx-badge', `<span class="lab">Badge ${slot + 1}</span>${worn ? badgeSvg(worn.id, worn.tier) : shield('<path d="M27 22v18M18 31h18" stroke="rgba(255,255,255,0.45)" stroke-width="3"/>')}<b></b>`);
        bd.querySelector('b').textContent = worn ? `${BADGES[worn.id].name} ${'I'.repeat(worn.tier)}` : 'Choose one';
        bd.title = worn ? BADGES[worn.id].does : 'Choose a combat badge';
        bd.addEventListener('click', () => badgeWindow(s, slot));
        main.querySelector('.hx-badges').appendChild(bd);
      }
      loadoutColumn(s);
      nextUp(s, main.querySelector('.hx-next'));
      readyBox(main.querySelector('.fe-ready'), s);
    }

    const SLOT_LABELS = ['Primary', 'Sidearm', 'Equipment', 'Equipment', 'Equipment', 'Close combat', 'Binoculars'];
    const shield = (inner) => `<svg viewBox="0 0 54 62" aria-hidden="true"><path d="M27 2 L51 10 V30 C51 45 40 55 27 60 C14 55 3 45 3 30 V10 Z" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>${inner}</svg>`;

    // His loadout: buttons for his tank, badge and uniform, his equipment
    // points as dots, a card for each thing he carries.
    function loadoutColumn(s) {
      const icons = main.querySelector('.hx-icons');
      const tabs = [
        [ICONS.rifle || '', 'Weapons', null],
        ...(s.cls === 'tanker' ? [[ICONS.tank || '', 'Tank', () => vehicleWindow(s)]] : []),
        [ICONS.shield || '', 'Badges', () => badgeWindow(s, 0)],
        [ICONS.shirt || '', 'Uniform', () => uniformWindow(s)],
      ];
      for (const [icon, label, open] of tabs) {
        const b = el('button', open ? '' : 'on', icon);
        b.title = label;
        if (open) b.addEventListener('click', open);
        icons.appendChild(b);
      }
      const budget = CLASS_POINTS[s.cls];
      const used = loadoutPoints(s.loadout);
      const pts = main.querySelector('.hx-pts');
      pts.title = `${used} of ${budget} equipment points`;
      for (let k = 0; k < budget; k++) pts.appendChild(el('i', k < used ? 'on' : ''));
      const slots = main.querySelector('.hx-slots');
      const room = budget - used;
      const shown = new Set();
      s.loadout.forEach((id, i) => {
        const kind = LOADOUT_SLOTS[i];
        if (!id) {
          // One line to add a thing of a kind, while he has points for it.
          if (room < 1 || shown.has(kind) || !carriable(s, kind).length) return;
          shown.add(kind);
          const b = el('button', 'hx-slot empty', `<span>+ ${SLOT_LABELS[i]}</span><span class="left">${room} point${room > 1 ? 's' : ''} left</span>`);
          b.addEventListener('click', () => slotWindow(s, i));
          slots.appendChild(b);
          return;
        }
        const w = upgradedDef(id, picksOf(s, id));
        const pic = preview?.gunPicture(id, 240, 70, picksOf(s, id)) || '';
        const n = Object.keys(picksOf(s, id)).length;
        const ups = upgradesOf(id).length ? `<span class="mods" title="${n} of 5 upgrade slots fitted">${[0, 1, 2, 3, 4].map((k) => `<i class="${k < n ? 'on' : ''}"></i>`).join('')}</span>` : '';
        const b = el('button', `hx-slot${i === 0 ? ' main' : ''}`, `<span class="lab">${SLOT_LABELS[i]}</span><span class="pt">${pointsOf(id)} pt</span>${pic ? `<img alt="" src="${pic}">` : ''}<b></b>${ups}`);
        b.querySelector('b').textContent = w.name;
        b.title = weaponStats(w);
        b.addEventListener('click', () => slotWindow(s, i));
        slots.appendChild(b);
      });
    }

    // What a ribbon opens for this soldier, by level: guns and items, tanks,
    // badge tiers, and on a gun's Specialist ribbon its upgrades (and, for
    // another army's gun, leave to carry it at level 9).
    function opensWith(s, key) {
      const out = [];
      if (key.startsWith('spec:')) {
        const gun = key.slice(5);
        for (const u of upgradesOf(gun)) out.push({ level: u.level, name: u.name, kind: 'upgrade', id: u.id, gun });
        if (WEAPONS[gun]?.faction !== s.faction) out.push({ level: 9, name: `${WEAPONS[gun].name}: may carry it`, kind: 'gun', id: gun });
      } else {
        for (const slot of new Set(LOADOUT_SLOTS))
          for (const w of weaponsFor(s.faction, s.cls, slot)) {
            const r = requirement(w.id, s.cls, s.faction);
            if (r?.ribbon === key && !w.base) out.push({ level: r.level, name: w.name, kind: 'gun', id: w.id });
          }
        if (s.cls === 'tanker')
          for (const [id, name] of TANKS[s.faction]) {
            const r = tankRequirement(id);
            if (r?.ribbon === key) out.push({ level: r.level, name, kind: 'tank', id });
          }
      }
      for (const [id, b] of Object.entries(BADGES))
        for (const t of badgeTiers(s, id)) for (const a of t.alts) if (a.ribbon === key) out.push({ level: a.level, name: `${b.name} ${'I'.repeat(t.tier)}`, kind: 'badge', id, tier: t.tier });
      return out.sort((a, b) => a.level - b.level);
    }
    // The ribbons this soldier works on: his class's, and each gun he has used.
    const ribbonKeys = (s) => ribbonsFor(s.cls).concat(Object.keys(s.ribbons || {}).filter((k) => k.startsWith('spec:')));
    // A picture of what a level opens.
    function opensPicture(o, w = 150, h = 56) {
      if (o.kind === 'badge') return badgeSvg(o.id, o.tier);
      if (o.kind === 'tank') return `<span class="hx-tankpic">${ICONS.tank || ''}</span>`;
      const src = o.kind === 'upgrade' ? preview?.partPicture?.(o.gun, o.id, w, Math.round(h * 1.4)) : preview?.gunPicture(o.id, w, h);
      return src ? `<img alt="" src="${src}">` : '';
    }

    // The three things he is nearest to opening, and the way to his ribbons.
    function nextUp(s, box) {
      box.innerHTML = '<h3>Next up</h3>';
      const all = [];
      for (const k of ribbonKeys(s)) {
        const pts = s.ribbons?.[k] || 0;
        const L = ribbonLevel(pts);
        for (const o of opensWith(s, k)) if (o.level > L.level) all.push({ ...o, k, need: RIBBON_XP[o.level] - pts, done: (pts - RIBBON_XP[L.level]) / (RIBBON_XP[o.level] - RIBBON_XP[L.level]) });
      }
      all.sort((a, b) => a.need - b.need);
      for (const o of all.slice(0, 3)) {
        const row = el('button', 'hx-nx', `${ribbonSvg(o.k, o.level, { grey: false })}<span><b></b><small></small><i><em style="width:${Math.max(4, o.done * 100).toFixed(0)}%"></em></i></span>`);
        row.querySelector('b').textContent = o.name;
        row.querySelector('small').textContent = `${ribbonInfo(o.k).name} ${o.level} · ${fmt(o.need)} points to go`;
        row.addEventListener('click', () => trackWindow(s, o.k, o.level));
        box.appendChild(row);
      }
      const top = ribbonKeys(s).sort((a, b) => (s.ribbons?.[b] || 0) - (s.ribbons?.[a] || 0))[0];
      const b = el('button', 'hx-ribbons', `${ribbonSvg(top, ribbonLevel(s.ribbons?.[top]).level)}<span>Ribbons</span>`);
      b.addEventListener('click', () => ribbonsWindow(s));
      box.appendChild(b);
    }

    // A window over the screen: { box, body, foot, close }. Esc or the cross
    // closes it, and the screen behind is drawn afresh.
    function openWindow(title, { sub = '', cls = '' } = {}) {
      main.querySelector('.hx-dim')?.remove();
      const dim = el('div', 'hx-dim');
      dim.innerHTML = `<div class="hx-win ${cls}"><header><h2></h2><span class="hx-sub"></span><button class="x" title="Close">${ICONS.close}</button></header><div class="hx-wb"></div><footer><button class="ok">OK</button></footer></div>`;
      dim.querySelector('h2').textContent = title;
      dim.querySelector('.hx-sub').textContent = sub;
      main.appendChild(dim);
      const onKey = (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          close();
        }
      };
      const close = () => {
        window.removeEventListener('keydown', onKey, true);
        dim.remove();
        show(screen);
      };
      window.addEventListener('keydown', onKey, true);
      dim.querySelector('.x').addEventListener('click', close);
      dim.querySelector('.ok').addEventListener('click', close);
      dim.addEventListener('click', (e) => e.target === dim && close());
      return { box: dim.querySelector('.hx-win'), body: dim.querySelector('.hx-wb'), foot: dim.querySelector('footer'), close, title: (t) => (dim.querySelector('h2').textContent = t) };
    }

    // Choosing what goes in a slot: what he owns, what is for sale to him, and
    // (folded away) what his ribbons will open.
    function slotWindow(s, i) {
      const slot = LOADOUT_SLOTS[i];
      const cur = s.loadout[i];
      const budget = CLASS_POINTS[s.cls];
      const room = budget - loadoutPoints(s.loadout) + (cur ? pointsOf(cur) : 0);
      const W = openWindow(SLOT_LABELS[i] === 'Primary' ? 'Primary weapon' : SLOT_LABELS[i], { sub: `${room} of ${budget} points free for this slot`, cls: 'hx-pick' });
      // Everything he may carry here, but not twice (another slot's gun or its scoped kin).
      const taken = s.loadout.filter((id, j) => id && j !== i).map((id) => baseOf(WEAPONS[id]));
      const foreignOk = (w) => w.faction === s.faction || w.anyArmy || w.faction === 'ALL' || unlocked(s, w.id) || (s.ribbons?.[requirement(w.id, s.cls, s.faction)?.ribbon] || 0) > 0;
      const items = carriable(s, slot).filter((w) => !taken.includes(baseOf(w)) && foreignOk(w));
      const pick = (id) => {
        s.loadout[i] = id;
        save();
        W.close();
      };
      const yours = items.filter((w) => unlocked(s, w.id) && owns(s, w.id));
      const sale = items.filter((w) => unlocked(s, w.id) && !owns(s, w.id));
      const locked = items.filter((w) => !unlocked(s, w.id));
      const card = (w) => {
        const c = el('button', `hx-card${w.id === cur ? ' on' : ''}`);
        const pic = preview?.gunPicture(w.id, 300, 90) || '';
        c.innerHTML = `${pic ? `<img class="gun" alt="" src="${pic}">` : ''}<b>${w.faction !== s.faction && !w.anyArmy && w.faction !== 'ALL' ? `<span class="wpn-army">${emblem(w.faction)}</span>` : ''}<span class="wn"></span></b><small></small><span class="tag"></span>`;
        c.querySelector('.wn').textContent = w.name;
        c.querySelector('small').textContent = `${pointsOf(w.id)} point${pointsOf(w.id) > 1 ? 's' : ''}`;
        c.title = weaponStats(w);
        return c;
      };
      const section = (title, list, fill) => {
        if (!list.length) return;
        W.body.appendChild(el('h4', 'hx-ph', title));
        const g = el('div', 'hx-pg');
        for (const w of list) {
          const c = card(w);
          fill(c, w);
          g.appendChild(c);
        }
        W.body.appendChild(g);
      };
      const tooMany = (c, w) => {
        if (pointsOf(w.id) <= room) return false;
        c.classList.add('short');
        c.querySelector('small').textContent = `${pointsOf(w.id)} points: ${pointsOf(w.id) - room} more than he has free`;
        return true;
      };
      section('Yours', yours, (c, w) => {
        const tag = c.querySelector('.tag');
        if (w.id === cur) {
          tag.innerHTML = '<span class="own">✓ Carrying</span>';
          if (upgradesOf(w.id).length) {
            const cu = el('span', 'hx-cust', `${ICONS.wrench} Customize`);
            cu.addEventListener('click', (e) => {
              e.stopPropagation();
              W.close();
              customize(s, w.id);
            });
            tag.appendChild(cu);
          }
          c.addEventListener('click', () => W.close());
          return;
        }
        tag.innerHTML = '<span class="own">Owned</span>';
        if (!tooMany(c, w)) c.addEventListener('click', () => pick(w.id));
      });
      section('For sale', sale, (c, w) => {
        if (tooMany(c, w)) {
          c.querySelector('.tag').innerHTML = `<span class="price">${ICONS.coin}${fmt(priceOf(w.id))}</span>`;
          return;
        }
        shopCard(c, s, w.id, () => pick(w.id));
      });
      if (locked.length) {
        const more = el('button', 'hx-more', `<span>${locked.length} more open as his ribbons rise</span><span>Show ▸</span>`);
        W.body.appendChild(more);
        more.addEventListener('click', () => {
          more.remove();
          section('Opens with his ribbons', locked, (c, w) => {
            const r = requirement(w.id, s.cls, s.faction);
            c.classList.add('locked');
            c.disabled = true;
            if (r) {
              c.querySelector('.tag').innerHTML = `<span class="hx-lock">${ribbonSvg(r.ribbon, r.level)}<em></em></span>`;
              c.querySelector('em').textContent = `${RIBBONS[r.ribbon]?.name || ribbonInfo(r.ribbon)?.name} ${r.level}`;
            }
          });
        });
      }
      if (i > 0 && cur) {
        const empty = el('button', 'hx-empty', 'Leave empty');
        empty.addEventListener('click', () => pick(null));
        W.foot.prepend(empty);
      }
      if (!items.length) W.body.appendChild(el('div', 'lo-note', 'Nothing his class may carry here.'));
    }

    // His combat badges: two worn, each with three tiers that open at levels
    // of his ribbons. The window fills one slot; choosing the badge worn in
    // the other slot swaps the two.
    function badgeWindow(s, slot) {
      const W = openWindow(`Combat badge ${slot + 1}`, { sub: 'He wears two; their tiers open with his ribbons', cls: 'hx-wide' });
      const wear = (id) => {
        const ids = wornIds(s);
        const other = ids.indexOf(id);
        if (id && other !== -1 && other !== slot) ids[other] = ids[slot];
        ids[slot] = id;
        s.badges = ids;
        save();
        draw();
      };
      const draw = () => {
        W.body.innerHTML = '';
        const grid = el('div', 'hx-badgegrid');
        const open = wearable(s);
        const worn = badgeOf(s, slot);
        const ids = wornIds(s);
        const none = el('button', `badge-card${worn ? '' : ' on'}`);
        none.innerHTML = '<div class="bdg-head"><b>No badge</b></div>';
        none.addEventListener('click', () => wear(null));
        grid.appendChild(none);
        // The ones he may wear; the rest folded away until asked for.
        const shut = Object.keys(BADGES).filter((id) => !open.includes(id));
        for (const id of [...open, ...(showShut ? shut : [])]) {
          const b = BADGES[id];
          const tiers = badgeTiers(s, id);
          const can = open.includes(id);
          const c = el('button', `badge-card${worn?.id === id ? ' on' : ''}${can ? '' : ' locked'}`);
          const top = tiers.filter((t) => t.open).pop();
          c.innerHTML = `<span class="bdg-pic">${badgeSvg(id, top?.tier || 1, { grey: !can })}</span><div class="bdg-head"><b></b><span class="bdg-tier"></span></div><div class="bdg-does"></div><div class="bdg-tiers"></div>`;
          c.querySelector('b').textContent = b.name;
          const elsewhere = ids.indexOf(id);
          c.querySelector('.bdg-tier').textContent = !top ? 'Locked' : elsewhere !== -1 && elsewhere !== slot ? `Tier ${'I'.repeat(top.tier)} · in badge ${elsewhere + 1}` : `Tier ${'I'.repeat(top.tier)}`;
          c.querySelector('.bdg-does').textContent = b.does;
          const tl = c.querySelector('.bdg-tiers');
          for (const t of tiers) {
            const row = el('span', t.open ? 'open' : '');
            row.textContent = `${'I'.repeat(t.tier)}: ${b.show(t.value)}${t.open ? '' : `, at ${t.alts.map((a) => `${RIBBONS[a.ribbon].name} ${a.level}`).join(' or ')}`}`;
            tl.appendChild(row);
          }
          if (can) c.addEventListener('click', () => wear(id));
          else c.disabled = true;
          grid.appendChild(c);
        }
        W.body.appendChild(grid);
        if (shut.length && !showShut) {
          const more = el('button', 'hx-more', `<span>${shut.length} more open as his ribbons rise</span><span>Show ▸</span>`);
          more.addEventListener('click', () => {
            showShut = true;
            draw();
          });
          W.body.appendChild(more);
        }
      };
      let showShut = false;
      draw();
    }

    // A tank crewman's tank.
    function vehicleWindow(s) {
      const W = openWindow('Tank', { sub: 'He goes into battle in it, as its driver' });
      const draw = () => {
        W.body.innerHTML = '';
        if (!TANKS[s.faction].some((t) => t[0] === s.tank) || !tankUnlocked(s, s.tank)) s.tank = TANKS[s.faction][0][0];
        for (const [id, name, note] of TANKS[s.faction]) {
          const open = tankUnlocked(s, id);
          const c = el('button', `veh-card${id === s.tank ? ' on' : ''}${open ? '' : ' locked'}`);
          c.appendChild(el('b')).textContent = name;
          c.appendChild(el('span')).textContent = note;
          if (open)
            c.addEventListener('click', () => {
              s.tank = id;
              save();
              draw();
            });
          else c.appendChild(el('em')).textContent = lockLine(s, tankRequirement(id));
          W.body.appendChild(c);
        }
        W.body.appendChild(el('div', 'lo-note', 'The gunner and the other seats change with F1 to F4.'));
      };
      draw();
    }

    function uniformWindow(s) {
      const W = openWindow('Uniform', { sub: 'The period kit of his army and class' });
      const draw = () => {
        W.body.innerHTML = '';
        const grid = el('div', 'uni-grid');
        for (let v = 0; v < variantCount(s.faction, s.cls); v++) {
          const b = el('button', v === s.variant ? 'on' : '', `Uniform ${v + 1}`);
          b.addEventListener('click', () => {
            s.variant = v;
            save();
            preview?.show({ faction: s.faction, cls: s.cls, seed: s.seed, variant: v, primary: s.loadout[0] });
            draw();
          });
          grid.appendChild(b);
        }
        W.body.appendChild(grid);
      };
      draw();
    }

    // All his ribbons, grouped as the original's overview: each as its
    // ribbon with the stars of its level and how far to the next; the one
    // picked out large, with what earns it.
    function ribbonsWindow(s, pickKey = null) {
      const W = openWindow('Ribbons overview', { cls: 'hx-wide' });
      const keys = ribbonKeys(s);
      let k0 = pickKey && keys.includes(pickKey) ? pickKey : keys.slice().sort((a, b) => (s.ribbons?.[b] || 0) - (s.ribbons?.[a] || 0))[0];
      const draw = () => {
        W.body.innerHTML = '<div class="hx-ovb"><div class="hx-sel"></div><div class="hx-groups"></div></div>';
        const L = ribbonLevel(s.ribbons?.[k0]);
        const info = ribbonInfo(k0);
        const selBox = W.body.querySelector('.hx-sel');
        selBox.innerHTML = `<h3></h3>${ribbonSvg(k0, L.level)}<div class="bar"><i style="width:${(L.progress * 100).toFixed(1)}%"></i></div><div class="pts"></div><p></p><button>View progression</button>`;
        selBox.querySelector('h3').textContent = info.name;
        selBox.querySelector('.pts').textContent = L.next === null ? `${fmt(s.ribbons?.[k0] || 0)}: the highest level` : `Level ${L.level} · ${fmt(s.ribbons?.[k0] || 0)} / ${fmt(L.next)}`;
        selBox.querySelector('p').textContent = `${info.note}.`;
        selBox.querySelector('button').addEventListener('click', () => trackWindow(s, k0));
        const groups = W.body.querySelector('.hx-groups');
        const specs = keys.filter((k) => k.startsWith('spec:'));
        for (const g of [...RIBBON_GROUPS, { name: 'Specialist', keys: specs }]) {
          const ks = g.keys.filter((k) => keys.includes(k));
          if (!ks.length) continue;
          const box = el('div', 'hx-grp', `<h4>${g.name}</h4>`);
          const tiles = el('div', 'hx-tiles');
          for (const k of ks) {
            const l = ribbonLevel(s.ribbons?.[k]);
            const t = el('button', `hx-tile${k === k0 ? ' on' : ''}`, `${ribbonSvg(k, l.level)}<div class="bar"><i style="width:${(l.progress * 100).toFixed(0)}%"></i></div><span></span>`);
            t.querySelector('span').textContent = ribbonInfo(k).name.replace(' Specialist', '');
            t.title = `${ribbonInfo(k).name}: level ${l.level} of 12`;
            t.addEventListener('click', () => {
              k0 = k;
              draw();
            });
            tiles.appendChild(t);
          }
          box.appendChild(tiles);
          groups.appendChild(box);
        }
      };
      draw();
    }

    // One ribbon's twelve levels: those reached in color, a marker under each
    // level that opens something, and the level picked out below with what it
    // opens.
    function trackWindow(s, k, pickLevel = null) {
      const info = ribbonInfo(k);
      const W = openWindow(info.name, { cls: 'hx-wide' });
      const pts = s.ribbons?.[k] || 0;
      const L = ribbonLevel(pts);
      const all = opensWith(s, k);
      let sel = pickLevel || Math.min(12, L.level + 1);
      const back = el('button', 'hx-empty', '‹ All ribbons');
      back.addEventListener('click', () => ribbonsWindow(s, k));
      W.foot.prepend(back);
      const draw = () => {
        W.body.innerHTML = `<p class="hx-note"></p><div class="hx-track"></div><div class="hx-detail"></div>`;
        W.body.querySelector('.hx-note').textContent = `${info.note}.`;
        const tr = W.body.querySelector('.hx-track');
        for (let n = 1; n <= 12; n++) {
          const got = n <= L.level;
          const has = all.filter((o) => o.level === n);
          const fillW = got ? 100 : n === L.level + 1 ? L.progress * 100 : 0;
          const b = el('button', `hx-lv${n === sel ? ' on' : ''}`, `<span>${n}</span>${ribbonSvg(k, n, { grey: !got })}<span class="hx-line"><i style="width:${fillW.toFixed(0)}%"></i></span>${has.length ? `<span class="hx-mark${got ? ' got' : ''}">${has.length}</span>` : '<span class="hx-mark none"></span>'}`);
          b.title = has.length ? has.map((o) => o.name).join(', ') : `Level ${n}`;
          b.addEventListener('click', () => {
            sel = n;
            draw();
          });
          tr.appendChild(b);
        }
        if (L.level < 12) {
          const cur = el('div', 'hx-cur', `Level ${L.level + 1}<b>${fmt(pts)} / ${fmt(L.next)}</b>`);
          cur.style.left = `${((L.level + 0.5) / 12) * 100}%`;
          tr.appendChild(cur);
        }
        const det = W.body.querySelector('.hx-detail');
        const here = all.filter((o) => o.level === sel);
        det.innerHTML = `<div>${ribbonSvg(k, sel, { grey: sel > L.level })}</div><div><h3>Level ${sel}</h3><div class="hx-dsub"></div><div class="hx-opens"></div></div>`;
        det.querySelector('.hx-dsub').textContent = sel <= L.level ? 'Reached.' : `${fmt(RIBBON_XP[sel] - pts)} points to go.${here.length ? ' Opens:' : ''}`;
        const op = det.querySelector('.hx-opens');
        for (const o of here) {
          const d = el('div', '', `${opensPicture(o)}<span></span>`);
          d.querySelector('span').textContent = o.name;
          op.appendChild(d);
        }
        if (!here.length) op.appendChild(el('div', 'hx-none', 'Nothing new at this level.'));
      };
      draw();
    }

    function lockLine(s, req) {
      return `Opens at ${requirementText(req)} (now level ${ribbonLevel(s.ribbons?.[req.ribbon]).level})`;
    }

    // The battle he goes to: a battle of the war, if one was chosen and is
    // still on and he is of the army the player leads, else a staged battle.
    let onlineChosen = false;
    function readyBox(box, s) {
      const m = roster.mission;
      // (His party sees which army he has chosen.)
      lobby?.army(s.faction);
      const war = m.war ? loadWar() : null;
      const wb = war && !war.over && war.army === s.faction && !m.online ? battleOf(war, m.war) : null;
      const mi = MISSIONS.find((x) => x.id === m.map) || MISSIONS[0];
      const enemy = enemyOf(s.faction, m.enemy);
      // Signed in: the online battle, each time the menus open. Battles on
      // this computer against bots are a quiet link away (practice).
      if (app.account && !onlineChosen) {
        onlineChosen = true;
        if (!m.online) {
          m.online = true;
          m.war = null;
          save();
        }
      }
      box.innerHTML = `<div class="ready-mission"><span class="rm-kind"></span><b></b><small></small><button class="rm-change">Change battle</button></div><button class="ready-btn">Ready for battle</button>`;
      if (m.online && app.account) {
        const ch = box.querySelector('.rm-change');
        ch.textContent = 'Practice offline';
        ch.className = 'rm-practice';
        box.querySelector('.rm-kind').textContent = 'Online battle';
        box.querySelector('b').textContent = 'Town';
        box.querySelector('small').textContent = 'Against other players, with bots filling both sides';
      } else if (wb) {
        const att = wb.att === s.faction;
        box.querySelector('.rm-kind').textContent = 'War battle';
        box.querySelector('b').textContent = MAP.name(wb.point);
        box.querySelector('small').textContent = `${att ? 'Attacking' : 'Defending'} against the ${FACTIONS[att ? wb.def : wb.att].army} · ${Math.max(0, Math.ceil((wb.ends - war.t) / 60))} min left`;
      } else {
        box.querySelector('.rm-kind').textContent = mi.kind;
        box.querySelector('b').textContent = mi.title;
        box.querySelector('small').textContent = m.map === 'town' ? `${m.side === 'attack' ? 'Attacking' : 'Defending'} against the ${FACTIONS[enemy].army} · ${m.bots} per side · ${m.minutes} min` : 'Practice, no enemies';
      }
      box.querySelector('.ready-mission button').addEventListener('click', () => battleWindow(s));
      if (app.account && !m.online) {
        const back = el('button', 'rm-online', 'Back to online battle');
        back.addEventListener('click', () => {
          m.online = true;
          m.war = null;
          save();
          readyBox(box, s);
        });
        box.querySelector('.ready-mission').appendChild(back);
      }
      box.querySelector('.ready-btn').addEventListener('click', () => (wb ? go(wb, war) : go()));
    }

    // A gun, sight or item he has opened but not bought: its price, and a
    // second click to buy it with the player's credits.
    function shopCard(c, s, id, after) {
      c.classList.add('shop');
      const tag = c.appendChild(el('em', 'price'));
      const price = priceOf(id);
      const idle = () => {
        c.classList.remove('confirm');
        tag.textContent = `${fmt(price)} credits`;
      };
      idle();
      c.addEventListener('click', (e) => {
        e.stopPropagation();
        const can = canBuy(roster, s, id);
        if (!can.ok) {
          tag.textContent = can.why === 'credits' ? `${fmt(price)} credits: ${fmt(price - (roster.credits || 0))} more than you have` : 'Not open yet';
          return;
        }
        if (!c.classList.contains('confirm')) {
          c.classList.add('confirm');
          tag.textContent = `Buy for ${fmt(price)} credits? Click again`;
          setTimeout(idle, 4000);
          return;
        }
        buy(roster, s, id);
        save();
        topBar();
        after();
      });
    }

    // The customization screen, as in the original game: the gun's five upgrade
    // slots down the side, the parts for the chosen slot as pictures, and the
    // one picked out in detail: what it does to the gun, as bars against what
    // is fitted now, and its price or the level that opens it.
    function customize(s, gun) {
      const def = WEAPONS[gun];
      const entry = GUN_UPGRADES[gun] || GUN_UPGRADES[def.base];
      main.querySelector('.cust')?.remove();
      const ov = el('div', 'cust');
      main.appendChild(ov);
      const close = () => {
        ov.remove();
        window.removeEventListener('keydown', onEsc, true);
        show('heroes');
      };
      const onEsc = (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          close();
        }
      };
      window.addEventListener('keydown', onEsc, true);
      let slot = UPGRADE_SLOTS.find((k) => upgradesOf(gun).some((u) => u.slot === k)) || 'ammo';
      let chosen; // the part picked out: an upgrade id, or null for the gun's own
      let asking = false; // waiting for the second click to buy
      const gunPic = preview?.gunPicture(gun, 360, 120) || '';
      const pic = (id, w, h) => (id ? preview?.partPicture?.(gun, id, w, h) : '') || '';
      const standard = (k) => (k === 'ammo' ? AMMO_TYPES[entry?.ammo]?.name || 'Service round' : k === 'sight' ? (def.scope ? def.scope.name : 'Iron sights') : 'Standard');
      const short = (u) => (u ? u.name.replace(/\s*\(.*\)$/, '') : '');
      const sub = (u) => (u?.family ? u.name.match(/\((.*)\)/)?.[1] || '' : u?.cartridge || '');

      const draw = () => {
        const picks = picksOf(s, gun);
        // The gun as fitted now, at the top; and in his hands behind, when it is his main gun.
        const fittedPic = preview?.gunPicture(gun, 360, 120, picks) || gunPic;
        if (preview && gun === s.loadout[0]) preview.show({ faction: s.faction, cls: s.cls, seed: s.seed, variant: s.variant, primary: gun, picks });
        const list = upgradesOf(gun)
          .filter((u) => u.slot === slot)
          .sort((a, b) => a.level - b.level || a.credits - b.credits);
        if (chosen === undefined || (chosen && !list.some((u) => u.id === chosen))) chosen = picks[slot] || null;
        const key = specialistKey(gun);
        const lv = key ? ribbonLevel(s.ribbons?.[key]).level : null;
        ov.innerHTML = `<div class="cust-head"><span class="cust-gun">${fittedPic ? `<img alt="" src="${fittedPic}">` : ''}</span><div class="cust-title"><h2></h2><small></small></div><button class="cust-close">Done</button></div>
          <div class="cust-body"><nav class="cust-slots"></nav><div class="cust-grid"></div><aside class="cust-detail"></aside></div>`;
        ov.querySelector('h2').textContent = def.name;
        ov.querySelector('.cust-title small').textContent = key ? `${ribbonInfo(key).name} · level ${lv} of 12` : 'All upgrades open';
        ov.querySelector('.cust-close').addEventListener('click', close);
        // The five slots, each with what is fitted.
        const nav = ov.querySelector('.cust-slots');
        for (const k of UPGRADE_SLOTS) {
          const n = upgradesOf(gun).filter((u) => u.slot === k).length;
          const fitted = picks[k] ? upgradesOf(gun).find((u) => u.id === picks[k]) : null;
          const b = el('button', `cs-slot${k === slot ? ' on' : ''}${n ? '' : ' none'}`);
          const p = pic(picks[k], 96, 66);
          b.innerHTML = `<span class="cs-pic">${p ? `<img alt="" src="${p}">` : ICONS.wrench}</span><span class="cs-text"><b></b><small></small></span>`;
          b.querySelector('b').textContent = SLOT_NAMES[k];
          b.querySelector('small').textContent = n ? (fitted ? short(fitted) : standard(k)) : 'No upgrades';
          if (n)
            b.addEventListener('click', () => {
              slot = k;
              chosen = undefined;
              asking = false;
              draw();
            });
          else b.disabled = true;
          nav.appendChild(b);
        }
        // The parts for this slot.
        const grid = ov.querySelector('.cust-grid');
        const tile = (u) => {
          const id = u?.id || null;
          const have = !u || ownsUpgrade(s, gun, id);
          const open = !u || upgradeOpen(s, gun, id);
          const fitted = (picks[slot] || null) === id;
          const t = el('button', `ctile${id === chosen ? ' sel' : ''}${fitted ? ' fitted' : ''}${open ? '' : ' locked'}`);
          const p = u ? pic(id, 160, 110) : slot === 'ammo' ? pic(entry?.ammo, 160, 110) : gunPic;
          t.innerHTML = `<span class="ct-pic">${p ? `<img alt="" src="${p}">` : ''}</span><b></b><span class="ct-sub"></span><span class="ct-tag"></span>`;
          t.querySelector('b').textContent = u ? short(u) : standard(slot);
          t.querySelector('.ct-sub').textContent = u ? sub(u) : 'As issued';
          t.querySelector('.ct-tag').innerHTML = fitted ? '✓ Fitted' : have ? 'Owned' : !open ? `Level ${u.level}` : `${ICONS.coin}${fmt(u.credits)}`;
          t.addEventListener('click', () => {
            chosen = id;
            asking = false;
            draw();
          });
          return t;
        };
        grid.appendChild(tile(null));
        for (const u of list) grid.appendChild(tile(u));
        detail(ov.querySelector('.cust-detail'), picks, list.find((u) => u.id === chosen) || null);
      };

      // The part picked out: picture, one line on what it does, bars against
      // what is fitted now, and the button to buy or fit it.
      const detail = (box, picks, u) => {
        const id = u?.id || null;
        const now = upgradedDef(gun, picks);
        const next = upgradedDef(gun, { ...picks, [slot]: id || undefined });
        const p = u ? pic(id, 320, 200) : slot === 'ammo' ? pic(entry?.ammo, 320, 200) || gunPic : gunPic;
        box.innerHTML = `<div class="cd-pic">${p ? `<img alt="" src="${p}">` : ''}</div><h3></h3><div class="cd-sub"></div><p class="cd-line"></p><div class="cd-bars"></div><button class="cd-act"></button>`;
        box.querySelector('h3').textContent = u ? short(u) : standard(slot);
        box.querySelector('.cd-sub').textContent = u ? [SLOT_NAMES[slot], sub(u)].filter(Boolean).join(' · ') : `${SLOT_NAMES[slot]} · as issued`;
        box.querySelector('.cd-line').textContent = u ? summary(gun, u) : 'The gun as it left the factory.';
        const bars = box.querySelector('.cd-bars');
        for (const [label, val] of METRICS) {
          const a = val(now, def),
            b = val(next, def);
          const row = el('div', 'cd-bar');
          // The part both share, then what this one adds (green) or takes away (red).
          const pos = (x) => Math.max(2, Math.min(100, x * 50));
          const lo = pos(Math.min(a, b)),
            hi = pos(Math.max(a, b));
          const diff = Math.round((b / a - 1) * 100);
          row.innerHTML = `<span class="cb-l"></span><span class="cb-track"><i class="cb-now" style="width:${lo.toFixed(1)}%"></i><i class="cb-diff ${b > a ? 'up' : 'down'}" style="left:${lo.toFixed(1)}%;width:${(hi - lo).toFixed(1)}%"></i></span><span class="cb-v">${diff ? `${diff > 0 ? '+' : ''}${diff}%` : ''}</span>`;
          row.querySelector('.cb-l').textContent = label;
          if (diff) row.classList.add(diff > 0 ? 'good' : 'bad');
          bars.appendChild(row);
        }
        if (next.scope && !now.scope) box.querySelector('.cd-line').textContent += ` ${next.scope.mag}x, ranges from ${next.sight.ranges[0]} to ${next.sight.ranges.at(-1)} ${next.sight.unit}.`;
        const act = box.querySelector('.cd-act');
        const have = !u || ownsUpgrade(s, gun, id);
        const fitted = (picks[slot] || null) === id;
        if (fitted) {
          act.textContent = 'Fitted';
          act.disabled = true;
        } else if (have) {
          act.textContent = 'Fit';
          act.addEventListener('click', () => {
            fit(s, gun, slot, id);
            save();
            draw();
          });
        } else if (!upgradeOpen(s, gun, id)) {
          act.textContent = `Opens at Specialist level ${u.level}`;
          act.disabled = true;
        } else {
          const can = canBuyUpgrade(roster, s, gun, id);
          act.innerHTML = can.ok ? (asking ? `Buy for ${fmt(u.credits)}? Click again` : `${ICONS.coin} Buy · ${fmt(u.credits)}`) : `${ICONS.coin} ${fmt(u.credits)} · ${fmt(u.credits - (roster.credits || 0))} short`;
          act.classList.add('buy');
          if (!can.ok) act.disabled = true;
          else
            act.addEventListener('click', () => {
              if (!asking) {
                asking = true;
                draw();
                return;
              }
              asking = false;
              buyUpgrade(roster, s, gun, id);
              fit(s, gun, slot, id);
              save();
              topBar();
              draw();
            });
        }
      };
      draw();
    }

    function recruitPanel() {
      const pick = { faction: selected(roster).faction, cls: 'infantry' };
      let name = randomName(pick.faction);
      const panel = el('div', 'fe-modal');
      const draw = () => {
        panel.innerHTML = `<div class="fe-panel modal-box"><h3>Recruit a soldier</h3>
          <label>Army</label><div class="choice-row armies"></div>
          <label>Class</label><div class="choice-row classes"></div><div class="note cls-note"></div>
          <label for="recruit-name">Name</label><div class="name-row"><input id="recruit-name" maxlength="40"><button class="reroll" title="Another name">${ICONS.turn}</button></div>
          <div class="modal-actions"><button class="cancel">Cancel</button><button class="ok">Recruit</button></div></div>`;
        const armies = panel.querySelector('.armies');
        for (const f of ['US', 'GE', 'SU']) {
          const b = el('button', f === pick.faction ? 'on' : '', `${emblem(f)}<span>${FACTIONS[f].army}</span>`);
          b.addEventListener('click', () => {
            if (pick.faction !== f) name = randomName(f);
            pick.faction = f;
            draw();
          });
          armies.appendChild(b);
        }
        const classes = panel.querySelector('.classes');
        for (const c of Object.keys(CLASS_NAMES)) {
          const b = el('button', c === pick.cls ? 'on' : '', `${classIcon(c)}<span>${CLASS_NAMES[c]}</span>`);
          b.addEventListener('click', () => {
            pick.cls = c;
            draw();
          });
          classes.appendChild(b);
        }
        panel.querySelector('.cls-note').textContent = CLASS_NOTES[pick.cls];
        const inp = panel.querySelector('input');
        inp.value = name;
        inp.addEventListener('input', () => (name = inp.value));
        panel.querySelector('.reroll').addEventListener('click', () => {
          name = randomName(pick.faction);
          inp.value = name;
        });
        panel.querySelector('.cancel').addEventListener('click', () => panel.remove());
        panel.querySelector('.ok').addEventListener('click', () => {
          recruit(roster, { ...pick, name: name.trim() || randomName(pick.faction) });
          save();
          panel.remove();
          show('heroes');
        });
      };
      draw();
      main.appendChild(panel);
    }

    // --- Generals: the war -----------------------------------------------------------
    // As in the original's strategy game: the war map of Europe, the player's
    // assault teams bought with warfunds and set down within his command
    // points, sent along the supply lines; battles where they meet the enemy,
    // joined by a hero or settled on their own. The other two armies have
    // computer generals. The war runs while this screen is open.
    function generals() {
      if (!mayLead(roster)) return lockedScreen();
      let war = loadWar();
      if (!war) return newWarScreen();
      const army = war.army;
      for (const b of war.battles) b.hero = null;
      war.cpLimit[army] = commandPoints(generalRank(roster, army));
      main.innerHTML = `
        <aside class="fe-panel wr-side wr-army"></aside>
        <div class="wr-mapbox"><canvas class="wr-map"></canvas><div class="wr-top"></div><div class="wr-hint" hidden></div>
          <div class="wr-zoom"><button data-z="1.4" title="Zoom in">+</button><button data-z="0.71" title="Zoom out">&minus;</button><button data-z="fit" title="All of Europe">${ICONS.screen}</button></div>
          <div class="wr-over" hidden></div></div>
        <aside class="fe-panel wr-side wr-detail"></aside>`;
      const armyBox = main.querySelector('.wr-army');
      const detail = main.querySelector('.wr-detail');
      const top = main.querySelector('.wr-top');
      const hint = main.querySelector('.wr-hint');
      const overBox = main.querySelector('.wr-over');
      let paused = false;
      let sel = null;
      let saveT = 0,
        uiT = 1;
      const mine = (t) => t && t.army === army;
      const pick = (p) => {
        const t = sel?.team ? teamOf(war, sel.team) : null;
        // A team of his selected and a point tapped: send it there.
        if (p?.point != null && mine(t) && t.at !== null && !t.battle) {
          if (order(war, t.id, p.point)) {
            flash(`${TEAMS[t.type].name}: ${t.air ? 'flying' : 'on the way'} to ${MAP.name(p.point)}`);
            return refresh(true);
          }
          return flash(`${TEAMS[t.type].name} can't get to ${MAP.name(p.point)}`);
        }
        sel = p;
        mapView.selected = sel;
        refresh(true);
      };
      const canvas = main.querySelector('.wr-map');
      const mapView = new WarMapView(canvas, {
        army,
        onPick: pick,
        onFrame: (dt) => {
          if (!paused && !war.over) tick(war, dt * WAR_SPEED);
          saveT += dt;
          uiT += dt;
          if (saveT > 3) {
            saveT = 0;
            saveWar(war);
          }
          if (uiT > 0.4) refresh();
        },
      });
      mapView.setWar(war);
      // Start over his own land.
      const home = capitalsOf(war, army);
      if (home.length) {
        mapView.view.x = home.reduce((n, p) => n + MAP.x[p], 0) / home.length;
        mapView.view.y = home.reduce((n, p) => n + MAP.y[p], 0) / home.length;
        mapView.view.s = Math.max(mapView.view.s, 0.09);
      }
      const onResize = () => mapView.resize();
      window.addEventListener('resize', onResize);
      view = {
        close() {
          mapView.stop();
          saveWar(war);
          window.removeEventListener('resize', onResize);
          main.removeEventListener('click', onAct);
          main.removeEventListener('pointerdown', press, true);
          window.removeEventListener('pointerup', release, true);
        },
      };
      main.querySelector('.wr-zoom').addEventListener('click', (e) => {
        const z = e.target.closest('button')?.dataset.z;
        if (z === 'fit') mapView.fit();
        else if (z) mapView.zoom(Number(z));
      });
      let flashT = 0;
      function flash(text) {
        hint.hidden = false;
        hint.textContent = text;
        hint.classList.add('flash');
        flashT = performance.now();
      }

      // The panels, rebuilt only when what they show has changed (so a button
      // is never pulled from under the pointer).
      const last = { army: '', detail: '', top: '' };
      // Not while a press is under way, so the click lands on what was pressed.
      let pressing = false;
      const press = () => (pressing = true);
      const release = () => setTimeout(() => (pressing = false), 0);
      main.addEventListener('pointerdown', press, true);
      window.addEventListener('pointerup', release, true);
      function refresh(now = false) {
        if (!now && (uiT < 0.4 || pressing)) return;
        uiT = 0;
        const put = (box, key, html) => {
          if (last[key] === html) return;
          last[key] = html;
          box.innerHTML = html;
        };
        put(top, 'top', topHtml());
        put(armyBox, 'army', armyHtml());
        put(detail, 'detail', detailHtml());
        const t = sel?.team ? teamOf(war, sel.team) : null;
        if (performance.now() - flashT > 2600) {
          hint.classList.remove('flash');
          hint.hidden = !(mine(t) && t.at !== null && !t.battle);
          if (!hint.hidden) hint.textContent = `Tap a point to send ${TEAMS[t.type].name} there${canFly(war, t) ? ` · it can fly up to ${Math.round((TEAMS[t.type].airRange * KM) / 10) * 10} km from here` : ''}`;
        }
        overBox.hidden = !war.over;
        if (war.over && !overBox.dataset.done) {
          overBox.dataset.done = '1';
          const won = war.over.winner === army;
          overBox.innerHTML = `<div class="wr-overbox"><span>War ${war.number} is over</span><h2></h2><p></p><button class="ready-btn" data-act="next">Start war ${war.number + 1}</button></div>`;
          overBox.querySelector('h2').textContent = won ? `The ${FACTIONS[army].army} wins` : `The ${FACTIONS[war.over.winner].army} wins`;
          overBox.querySelector('p').textContent = won ? `Fifteen capitals held. Your general keeps his warfunds and teams, with ${WAR_BONUS.warfunds} warfunds for each team in the field.` : 'Your general keeps his warfunds and teams for the next war.';
        }
      }

      function topHtml() {
        const score = ARMIES.map((a) => `<span class="wr-sc${a === army ? ' me' : ''}" title="${FACTIONS[a].army}: capitals held of ${CAPITALS_TO_WIN} to win">${emblem(a)}<b>${capitalsOf(war, a).length}</b><i>/${CAPITALS_TO_WIN}</i></span>`).join('');
        return `<div class="wr-clock"><b>War ${war.number}</b><span>${clock(war.t)}</span><button data-act="pause" title="${paused ? 'Let the war run' : 'Hold the war'}">${paused ? '&#9654;' : '&#10073;&#10073;'}</button></div><div class="wr-score">${score}</div>`;
      }

      function armyHtml() {
        const teams = war.teams.filter((t) => t.army === army);
        const used = cpUsed(war, army);
        const rows = teams
          .map((t) => {
            const on = sel?.team === t.id ? ' on' : '';
            const full = t.at === null ? 0 : fullness(t);
            return `<button class="wr-team${on}${t.at === null ? ' reserve' : ''}${t.battle ? ' fight' : ''}" data-act="team" data-id="${t.id}">${teamSign(t)}<span class="t"><b>${esc(TEAMS[t.type].name)}</b><small>${esc(whereText(t))}</small></span><span class="lv">${teamLevel(t)}</span>${t.at === null ? '' : `<span class="bar"><i style="width:${(full * 100).toFixed(0)}%"></i></span>`}</button>`;
          })
          .join('');
        const gen = roster.soldiers.filter((x) => x.faction === army && x.general).sort((a, b) => b.xp - a.xp)[0];
        return `<div class="wr-head">${emblem(army)}<div><b>${FACTIONS[army].army}</b><small>${gen ? `Led by General ${esc(gen.name)}` : 'You are its general'}</small></div></div>
          <div class="wr-stats"><div title="Warfunds buy and refill assault teams"><span>Warfunds</span><b>${fmt(war.funds[army])}</b></div><div title="Command points: room for teams in the field. More as your soldiers of this army rise in rank (12, 15, 18 to 22)."><span>Command points</span><b>${used} / ${war.cpLimit[army]}</b></div></div>
          <h3>Assault teams</h3><div class="wr-teams">${rows || '<div class="lo-note">No teams yet.</div>'}</div>
          <button class="wr-add" data-act="buy">+ Assault team</button>`;
      }

      function detailHtml() {
        const t = sel?.team ? teamOf(war, sel.team) : null;
        if (t) return teamHtml(t);
        if (sel?.point != null) return pointHtml(sel.point);
        const mineB = war.battles.filter((b) => b.att === army || b.def === army);
        const battles = mineB.map((b) => battleRow(b)).join('');
        const news = war.log
          .slice(0, 14)
          .map((l) => `<div class="wr-news${l.army ? ` a-${l.army}` : ''}"><time>${clock(l.t).replace('Day ', 'D')}</time><span>${esc(l.text)}</span></div>`)
          .join('');
        return `<h3>Your battles</h3>${battles || '<div class="lo-note">None now. Battles start where your teams meet the enemy, or the enemy comes for your capitals.</div>'}
          <h3 class="wr-gap">War news</h3><div class="wr-newslist">${news}</div>`;
      }

      function battleRow(b) {
        const att = b.att === army;
        const foe = att ? b.def : b.att;
        const left = Math.max(0, Math.ceil((b.ends - war.t) / 60));
        const hero = heroFor();
        return `<div class="wr-battle"><div class="k">${b.garrison ? 'Capital assault' : 'Assault'} · ${left} min left</div><b>${esc(MAP.name(b.point))}</b><small>${att ? 'Attacking' : 'Defending'} against the ${FACTIONS[foe].army}</small>
          <div class="wr-bbtn"><button data-act="join" data-id="${b.id}" ${hero ? '' : 'disabled'}>${hero ? `Fight as ${esc(hero.name)}` : 'No soldier in this army'}</button><button data-act="look" data-point="${b.point}">Show</button></div></div>`;
      }

      function teamHtml(t) {
        const d = TEAMS[t.type];
        const lv = teamLevel(t);
        const next = TEAM_LEVELS[lv];
        const prev = lv ? TEAM_LEVELS[lv - 1] : 0;
        let h = `<div class="det-kind">${t.army === army ? 'Your assault team' : FACTIONS[t.army].army} · Level ${lv}</div><h2>${esc(d.name)}</h2><div class="wr-where">${esc(whereText(t))}</div>`;
        if (t.army !== army) {
          return `${h}<div class="lo-note">About ${fmt(Object.entries(t.men).reduce((n, [r, c]) => n + (r in RESOURCE_NAMES ? c : 0), 0))} men and machines, morale ${Math.round(t.morale)}.</div>`;
        }
        const made = Object.entries(d.made)
          .map(([r, n]) => {
            const have = t.at === null ? t.men[r] || 0 : Math.min(n, t.men[r] || 0);
            return `<div class="wr-res"><span>${RESOURCE_NAMES[r]}</span><b>${have} / ${n}</b><i><u style="width:${((have / n) * 100).toFixed(0)}%"></u></i></div>`;
          })
          .join('');
        h += `<div class="wr-resl">${made}<div class="wr-res"><span>Morale</span><b>${Math.round(t.morale)}</b><i><u class="m" style="width:${t.morale.toFixed(0)}%"></u></i></div>
          <div class="wr-res"><span>Team XP</span><b>${fmt(t.xp)}${next ? ` / ${fmt(next)}` : ''}</b><i><u class="x" style="width:${next ? (((t.xp - prev) / (next - prev)) * 100).toFixed(0) : 100}%"></u></i></div></div>`;
        const pace = d.speed / TEAMS.guard.speed;
        h += `<div class="wr-facts">${d.cp} command point${d.cp > 1 ? 's' : ''} · ${pace === 1 ? 'marches at a Guard\'s pace' : `${pace.toFixed(1)} times a Guard's pace`}${d.airSpeed ? ', far faster in the air' : ''} · earns ${d.joinFunds ? `${fmt(d.joinFunds)} warfunds a battle and ` : ''}${fmt(d.winFunds)} for a win</div>`;
        if (t.at === null) {
          const caps = capitalsOf(war, army);
          const why = deployProblem(war, t, null);
          h += `<h3 class="wr-gap">Set it down at</h3>${why ? `<div class="lo-note warn">${esc(why)}</div>` : `<div class="lo-note">Costs ${fmt(refillCost(t))} warfunds to bring it to full strength.</div>`}
            <div class="wr-caps">${caps.map((p) => `<button data-act="deploy" data-point="${p}" ${why ? 'disabled' : ''}>${esc(MAP.name(p))}</button>`).join('')}</div>`;
        } else if (!t.battle) {
          h += `<div class="wr-acts">${t.path.length || t.hold > 0 ? '<button data-act="stop">Stop here</button>' : ''}<button data-act="withdraw" ${supplied(war, army)[t.at] ? '' : 'disabled title="Only from your own land joined to a capital"'}>Back to reserve</button></div>`;
        } else {
          const b = battleOf(war, t.battle);
          if (b) h += battleRow(b);
        }
        const ups = upgradesFor(t);
        if (ups.length) {
          h += `<h3 class="wr-gap">Upgrade</h3>${ups
            .map((u) => {
              const why = upgradeProblem(war, t, u.id);
              return `<button class="wr-up" data-act="upgrade" data-type="${u.id}" ${why ? 'disabled' : ''}><b>${esc(u.name)}</b><span>${fmt(u.price)} warfunds</span><small>${esc(why || madeText(u))}</small></button>`;
            })
            .join('')}`;
        }
        return h;
      }

      function pointHtml(p) {
        const who = ownerOf(war, p);
        const kind = MAP.isCapital(p) ? 'Capital' : KIND_NAMES[MAP.kind[p]];
        const here = teamsAt(war, p);
        const b = war.battles.find((x) => x.point === p);
        let h = `<div class="det-kind">${kind}</div><h2>${esc(MAP.name(p))}</h2><div class="wr-where">${who ? `${emblem(who)}<span>Held by the ${FACTIONS[who].army}</span>` : '<span>Neutral</span>'}</div>`;
        if (b) h += battleRow(b);
        if (here.length) h += `<h3 class="wr-gap">Here</h3>${here.map((t) => `<button class="wr-team" data-act="team" data-id="${t.id}">${teamSign(t)}<span class="t"><b>${esc(TEAMS[t.type].name)}</b><small>${FACTIONS[t.army].army}</small></span></button>`).join('')}`;
        if (MAP.isCapital(p)) h += `<div class="lo-note">Capitals win the war: ${CAPITALS_TO_WIN} of the 23. A capital held by an army is defended by its garrison when no team stands in it; a neutral one takes two hours to take.</div>`;
        return h;
      }

      // Clicks in the panels and on the map's top bar.
      const onAct = (e) => {
        const b = e.target.closest('[data-act]');
        if (!b || b.disabled) return;
        const act = b.dataset.act;
        const t = sel?.team ? teamOf(war, sel.team) : null;
        if (act === 'pause') paused = !paused;
        if (act === 'team') {
          sel = { team: Number(b.dataset.id) };
          const tt = teamOf(war, sel.team);
          if (tt?.at != null) {
            const [x, y] = mapView.teamXY(tt);
            mapView.view.x = x;
            mapView.view.y = y;
          }
        }
        if (act === 'look') {
          sel = { point: Number(b.dataset.point) };
          mapView.focus(sel.point, Math.max(mapView.view.s, 0.25));
        }
        if (act === 'buy') return buyWindow();
        if (act === 'deploy' && t && deploy(war, t.id, Number(b.dataset.point))) {
          mapView.focus(t.at);
          saveWar(war);
        }
        if (act === 'stop' && t) {
          t.path = [];
          t.leg = 0;
          t.hold = 0;
        }
        if (act === 'withdraw' && t) withdraw(war, t.id);
        if (act === 'upgrade' && t) upgrade(war, t.id, b.dataset.type);
        if (act === 'join') {
          const bt = battleOf(war, Number(b.dataset.id));
          const hero = heroFor();
          if (bt && hero) {
            select(roster, hero.id);
            return go(bt, war);
          }
        }
        if (act === 'next') {
          war = nextWar(war);
          saveWar(war);
          return show('generals');
        }
        mapView.selected = sel;
        refresh(true);
      };
      main.addEventListener('click', onAct);

      // His hero for a battle: the soldier picked on the Heroes screen if he
      // is of this army, else his best soldier who is.
      function heroFor() {
        const s = selected(roster);
        if (s.faction === army) return s;
        return roster.soldiers.filter((x) => x.faction === army).sort((a, b) => b.xp - a.xp)[0] || null;
      }

      function whereText(t) {
        if (t.at === null) return 'In reserve';
        if (t.battle) return `In battle at ${MAP.name(t.at)}`;
        if (t.hold > 0) return `Taking ${MAP.name(t.at)} · ${Math.ceil(t.hold / 60)} min`;
        if (t.path.length) return `${t.air ? 'Flying' : 'Marching'} to ${MAP.name(t.path[t.path.length - 1])}${t.air ? '' : ` · ${t.path.length} point${t.path.length > 1 ? 's' : ''}`}`;
        return `At ${MAP.name(t.at)}`;
      }

      // Buying a team: the four the original sold outright (the rest are
      // upgrades of these).
      function buyWindow() {
        const W = openWindow('New assault team', { sub: 'Bought with warfunds, then set down at one of your capitals' });
        const draw = () => {
          W.body.innerHTML = '';
          for (const id of BUYABLE) {
            const d = TEAMS[id];
            const c = el('button', `wr-buy${war.funds[army] < d.price ? ' locked' : ''}`);
            c.innerHTML = `${teamSign({ type: id, army })}<span class="t"><b></b><small></small></span><span class="p"><b>${fmt(d.price)}</b><small>warfunds · ${d.cp} CP</small></span>`;
            c.querySelector('b').textContent = d.name;
            c.querySelector('small').textContent = madeText(d) + (d.airRange ? ' · flies from airfields and capitals' : '');
            c.disabled = war.funds[army] < d.price;
            c.addEventListener('click', () => {
              const t = buyTeam(war, army, id);
              if (!t) return;
              sel = { team: t.id };
              saveWar(war);
              W.close();
            });
            W.body.appendChild(c);
          }
          W.body.appendChild(el('div', 'lo-note', `You have ${fmt(war.funds[army])} warfunds. Teams rise in level as they fight, which opens their upgrades (Guard to Motorized Guard or Infantry, Light Armor to Medium Armor or tank destroyers, and so on).`));
        };
        draw();
      }

      refresh(true);
      mapView.start();
    }

    // Not a General yet: how to become one (a soldier at rank 18 promoted, or
    // a General hired with credits).
    function lockedScreen() {
      const best = roster.soldiers.reduce((a, b) => (b.xp > a.xp ? b : a));
      const r = rankOf(best.xp).rank;
      main.innerHTML = `<div class="wr-new fe-panel"><div class="det-kind">The war</div><h2>Become a General</h2><p>Generals lead the war: they buy assault teams and send them across Europe. Reach rank ${GENERAL_RANK} with one of your soldiers and promote him (he keeps fighting), or hire a General.</p><p class="wr-lockline"></p><div class="wr-acts"><button class="ready-btn wr-hire"></button></div></div>`;
      main.querySelector('.wr-lockline').textContent = `Your highest soldier, ${best.name}, is rank ${r} of ${GENERAL_RANK}.`;
      const hb = main.querySelector('.wr-hire');
      hb.textContent = `Hire a General · ${fmt(HIRE_PRICE)} credits`;
      hb.disabled = (roster.credits || 0) < HIRE_PRICE;
      hb.addEventListener('click', () => {
        if (!hireGeneral(roster)) return;
        save();
        show('generals');
      });
    }

    // The first war: which army the player leads as its general.
    function newWarScreen() {
      main.innerHTML = `<div class="wr-new fe-panel"><div class="det-kind">The war</div><h2>Choose your army</h2><p>Three armies fight over Europe on the original game's war map. You lead one as its general; the other two have computer generals. Your soldiers of that army fight its battles as heroes. The army that holds 15 capitals wins the war.</p><div class="wr-armies"></div></div>`;
      const box = main.querySelector('.wr-armies');
      const sNow = selected(roster);
      for (const a of ARMIES) {
        const n = roster.soldiers.filter((s) => s.faction === a).length;
        const caps = MAP.capitals.filter((c) => c.start === a).map((c) => MAP.name(c.point));
        const c = el('button', `wr-pick${a === sNow.faction ? ' on' : ''}`);
        c.innerHTML = `${emblem(a)}<b></b><small></small><em></em>`;
        c.querySelector('b').textContent = FACTIONS[a].army;
        c.querySelector('small').textContent = `Starts with ${caps.join(', ')}`;
        c.querySelector('em').textContent = n ? `${n} of your soldiers` : 'None of your soldiers yet';
        c.addEventListener('click', () => {
          saveWar(newWar({ army: a }));
          show('generals');
        });
        box.appendChild(c);
      }
    }

    // Choosing a battle for the Heroes screen: a battle of the war for a soldier
    // of the army the player leads, or a staged battle.
    function battleWindow(s) {
      const W = openWindow('Choose a battle', { sub: 'A battle of your war, or a staged one', cls: 'hx-wide' });
      const m = roster.mission;
      const draw = () => {
        W.body.innerHTML = '';
        const war = loadWar();
        // Signed in: the online battle, against other players.
        if (app.account) {
          W.body.appendChild(el('h3', 'wr-gap', 'Online'));
          const c = el('button', `mission-card${m.online ? ' on' : ''}`);
          c.innerHTML = '<span class="mc-kind">Online battle</span><b>Town</b><small>Against other players, with bots filling both sides.</small>';
          c.addEventListener('click', () => {
            m.online = true;
            m.war = null;
            save();
            draw();
          });
          W.body.appendChild(c);
        }
        W.body.appendChild(el('h3', 'wr-gap', 'Your war'));
        if (!war) W.body.appendChild(el('div', 'lo-note', 'No war yet: start one on the Generals screen.'));
        else if (war.army !== s.faction) W.body.appendChild(el('div', 'lo-note', `Your war is fought by the ${FACTIONS[war.army].army}; ${s.name} is in the ${FACTIONS[s.faction].army}.`));
        else {
          const list = war.battles.filter((b) => b.att === war.army || b.def === war.army);
          if (!list.length) W.body.appendChild(el('div', 'lo-note', 'No battles right now. Send your assault teams to meet the enemy on the Generals screen.'));
          for (const b of list) {
            const att = b.att === war.army;
            const c = el('button', `mission-card${m.war === b.id ? ' on' : ''}`);
            c.innerHTML = '<span class="mc-kind"></span><b></b><small></small>';
            c.querySelector('.mc-kind').textContent = `War battle · ${Math.max(0, Math.ceil((b.ends - war.t) / 60))} min left`;
            c.querySelector('b').textContent = MAP.name(b.point);
            c.querySelector('small').textContent = `${att ? 'Attacking' : 'Defending'} against the ${FACTIONS[att ? b.def : b.att].army} · fought on the Town map`;
            c.addEventListener('click', () => {
              m.war = b.id;
              m.online = false;
              save();
              draw();
            });
            W.body.appendChild(c);
          }
        }
        W.body.appendChild(el('h3', 'wr-gap', 'Staged battles'));
        for (const mi of MISSIONS) {
          const c = el('button', `mission-card${!m.war && !m.online && mi.id === m.map ? ' on' : ''}`);
          c.innerHTML = '<span class="mc-kind"></span><b></b><small></small>';
          c.querySelector('.mc-kind').textContent = mi.kind;
          c.querySelector('b').textContent = mi.title;
          c.querySelector('small').textContent = mi.line;
          c.addEventListener('click', () => {
            m.map = mi.id;
            m.war = null;
            m.online = false;
            save();
            draw();
          });
          W.body.appendChild(c);
        }
        if (m.war || m.online || m.map !== 'town') return;
        const d = el('div', 'wr-staged');
        const row = (label, opts, value, set) => {
          const r = el('div', 'det-row');
          r.appendChild(el('label')).textContent = label;
          const c = el('div', 'choice-row');
          for (const [v, text] of opts) {
            const b = el('button', v === value ? 'on' : '');
            b.innerHTML = text;
            b.addEventListener('click', () => {
              set(v);
              save();
              draw();
            });
            c.appendChild(b);
          }
          r.appendChild(c);
          d.appendChild(r);
        };
        row('Your side', [['attack', 'Attack'], ['defend', 'Defend']], m.side, (v) => (m.side = v));
        const foes = ['US', 'GE', 'SU'].filter((f) => f !== s.faction);
        row('Against', foes.map((f) => [f, `${emblem(f)}<span>${FACTIONS[f].army}</span>`]), enemyOf(s.faction, m.enemy), (v) => (m.enemy = v));
        const r = el('div', 'det-row');
        const l = r.appendChild(el('label', '', 'Soldiers per side: <b></b>'));
        l.querySelector('b').textContent = m.bots;
        const inp = el('input');
        inp.type = 'range';
        inp.min = 4;
        inp.max = 32;
        inp.value = m.bots;
        inp.id = l.htmlFor = 'fe-bots';
        inp.addEventListener('input', () => {
          m.bots = Number(inp.value);
          l.querySelector('b').textContent = m.bots;
          save();
        });
        r.appendChild(inp);
        r.appendChild(el('div', 'note', 'The original game fought 18 against 18; bots make up the numbers. Fewer is lighter on slower computers.'));
        d.appendChild(r);
        row('Battle clock', [[10, '10 min'], [20, '20 min'], [30, '30 min']], m.minutes, (v) => (m.minutes = v));
        W.body.appendChild(d);
      };
      draw();
    }

    // A team's staff-map sign, in its army's colour.
    function teamSign(t) {
      const br = TEAMS[t.type].branch;
      const inner = {
        infantry: '<path d="M4 4l22 12M26 4L4 16"/>',
        paratrooper: '<path d="M4 4l22 12M26 4L4 16"/><path d="M8 10q3.5-6 7 0q3.5-6 7 0"/>',
        tanker: '<ellipse cx="15" cy="10" rx="9" ry="5"/>',
        recon: '<path d="M4 16L26 4"/>',
      }[br];
      return `<svg class="wr-sign" viewBox="0 0 30 20" aria-hidden="true"><rect x="1" y="1" width="28" height="18" fill="${ARMY_COLORS[t.army]}" stroke="#f3eedd" stroke-width="1.2"/><g fill="none" stroke="#f3eedd" stroke-width="1.5">${inner}</g></svg>`;
    }

    // Map units to kilometres: London to Warsaw is about 1,450 km on the ground.
    const KM = 1450 / 6177;

    function madeText(d) {
      return Object.entries(d.made)
        .map(([r, n]) => `${n} ${RESOURCE_NAMES[r]}`)
        .join(', ');
    }

    // The battlefield's map, drawn from the map's plan (no terrain yet); drawn
    // again when the window changes size.
    function drawMap(canvas, def, team) {
      requestAnimationFrame(() => {
        if (!canvas.isConnected) return;
        const map = new BattleMap(canvas, def, {});
        map.draw({ team });
        const onResize = () => {
          if (!canvas.isConnected) return window.removeEventListener('resize', onResize);
          clearTimeout(canvas._resizeT);
          canvas._resizeT = setTimeout(() => map.resize(), 150);
        };
        window.addEventListener('resize', onResize);
      });
    }
    void drawMap;

    // --- Progression -------------------------------------------------------------
    function progression() {
      const s = selected(roster);
      const lv = playerLevel(roster);
      main.innerHTML = `
        <div class="fe-panel prog-level"><div class="pl-badge"><b>${lv.level}</b><span>Level</span></div><div class="pl-text"><h2>Player level ${lv.level}</h2><p></p><div class="xp"><i style="width:${(lv.progress * 100).toFixed(1)}%"></i></div></div></div>
        <div class="fe-panel prog-soldiers"><h3>Your soldiers</h3><div class="ps-table"></div></div>
        <div class="fe-panel prog-ranks"><h3></h3><div class="rank-list"></div></div>`;
      main.querySelector('.pl-text p').textContent = `${fmt(lv.xp)} XP from all your soldiers together. Battles give experience: for fighting, for every enemy you put out of the fight, for every point you take or hold, and more for a win.`;
      const t = main.querySelector('.ps-table');
      t.innerHTML = '<div class="ps-row head"><span>Soldier</span><span>Rank</span><span>XP</span><span>Battles</span><span>Won</span><span>Kills</span><span>Deaths</span><span>Points</span></div>';
      for (const x of roster.soldiers) {
        const r = rankOf(x.xp);
        const row = el('button', `ps-row${x.id === s.id ? ' on' : ''}`);
        row.innerHTML = `<span class="ps-name">${emblem(x.faction)}<b></b></span><span class="ps-rank">${rankBadge(r.rank)}<em></em></span><span>${fmt(x.xp)}</span><span>${x.stats.battles}</span><span>${x.stats.wins}</span><span>${x.stats.kills}</span><span>${x.stats.deaths}</span><span>${x.stats.captures}</span>`;
        row.querySelector('b').textContent = x.name;
        row.querySelector('em').textContent = `${r.rank} ${rankTitle(x.faction, r.rank)}`;
        row.addEventListener('click', () => {
          select(roster, x.id);
          save();
          show('progression');
        });
        t.appendChild(row);
      }
      const r = rankOf(s.xp);
      main.querySelector('.prog-ranks h3').textContent = `Ranks of the ${FACTIONS[s.faction].army}`;
      const rl = main.querySelector('.rank-list');
      RANK_TITLES[s.faction].forEach((title, i) => {
        const it = el('div', `rank-item${i === r.rank ? ' on' : i < r.rank ? ' done' : ''}`);
        it.innerHTML = `${rankBadge(i)}<span class="ri-n">${i}</span><span class="ri-t"></span><span class="ri-xp">${fmt(RANK_XP[i])} XP</span>`;
        it.querySelector('.ri-t').textContent = title;
        rl.appendChild(it);
      });
      rl.appendChild(el('div', 'note', 'Rank XP from the original game. From rank 18 its soldiers could become generals; here they keep fighting.'));
    }

    // --- Settings and about ---------------------------------------------------------
    function settings() {
      const p = el('div', 'fe-panel fe-settings-box');
      main.appendChild(p);
      view = new SettingsView(p, app, { root: 'home' });
    }

    function about() {
      main.innerHTML = `<div class="fe-panel fe-about">
        <h2>About</h2>
        <p><b>${esc(GAME_NAME)}</b> is a WWII battle game for the browser: soldiers fight large battles of infantry, tanks and vehicles over a French village, and generals fight the war on a map.</p>
        <p>Everything is simulated: bullets fly with real drag and drop for their ammunition and slow down through walls; guns load, cycle and recoil like the originals and are aimed through their real sights; armor stops or fails against each shell by its real thickness and slope; tanks steer like their real transmissions; soldiers tire, bleed and bandage.</p>
        <p>All models, textures and sounds are generated in code when the game loads. Signed in, your soldiers and their ranks are kept on the game server; otherwise in this browser.</p>
        <p>To find problems and see how the game runs, the game server keeps a record of signed-in players' battles (side, class, time, kills and deaths), how smoothly the game runs and any errors, for 90 days. It keeps no addresses, emails or chat.</p>
        <p>Some of the war map, assault teams, upgrades and prices still come from the data kept by the Heroes &amp; Generals community project (Raoul de Heer, MIT licence); they are being replaced with the game's own.</p>
        <p>Play it on a computer with a keyboard and a mouse or touchpad. Settings &gt; Controls lists every key.</p></div>`;
    }

    // Top bar buttons.
    root.querySelectorAll('.fe-tabs button, .fe-icon[data-screen]').forEach((b) => b.addEventListener('click', () => show(b.dataset.screen)));
    const fs = root.querySelector('.fe-fs');
    fs.hidden = !document.fullscreenEnabled;
    fs.addEventListener('click', () => {
      try {
        if (document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {});
        else document.documentElement.requestFullscreen?.()?.catch?.(() => {});
      } catch {
        /* not allowed here */
      }
    });
    // Esc: back a page in the settings, out of the recruit panel.
    const onKey = (e) => {
      if (e.code !== 'Escape' || e.repeat) return;
      const modal = main.querySelector('.fe-modal');
      if (modal) modal.remove();
      else if (view) view.back();
    };
    window.addEventListener('keydown', onKey);
    show('heroes');
  });
}

