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
import { BADGES, badgeOf, badgeTiers, wearable } from '../game/badges.js';
import { RIBBONS, RIBBON_XP, ribbonInfo, ribbonLevel, ribbonsFor, requirement, requirementText, unlocked, carriable, tankRequirement, tankUnlocked } from '../game/ribbons.js';
import { ribbonSvg, RIBBON_GROUPS } from './ribbonArt.js';
import { AMMO } from '../weapons/ammo.js';
import { UPGRADE_SLOTS, SLOT_NAMES, AMMO_TYPES, GUN_UPGRADES, upgradesOf, upgradedDef, upgradeOpen, specialistKey, damageScale as scaleAt, SCOPE_FAMILIES } from '../weapons/upgrades.js';
import { priceOf, owns, canBuy, buy, ownsUpgrade, canBuyUpgrade, buyUpgrade, picksOf, fit, loadoutUpgrades } from '../game/armory.js';
import { variantCount } from '../actors/soldierKit.js';
import { SettingsView } from './settingsView.js';
import { emblem, classIcon, rankBadge, ICONS } from './icons.js';
import { loadRoster, saveRoster, selected, select, recruit, dismiss, rankOf, rankTitle, playerLevel, randomName, RANK_XP, RANK_TITLES, CLASS_NAMES, CLASS_NOTES, MAX_SOLDIERS } from './roster.js';
import { SoldierPreview } from './soldierPreview.js';
import { BattleMap } from './battleMap.js';

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
        <div class="fe-brand">HNG<span>Heroes &amp; Generals tribute</span></div>
        <nav class="fe-tabs">
          <button data-screen="heroes">Heroes</button>
          <button data-screen="generals">Generals</button>
          <button data-screen="progression">Progression</button>
        </nav>
        <div class="fe-status">
          <div class="fe-credits"></div>
          <div class="fe-level" title="Player level"></div>
          <div class="fe-army"></div>
          <button class="fe-icon" data-screen="settings" title="Settings">${ICONS.gear}</button>
          <button class="fe-icon fe-fs" title="Full screen">${ICONS.screen}</button>
          <button class="fe-icon" data-screen="about" title="About">${ICONS.info}</button>
        </div>
      </header>
      <main class="fe-main"></main>
      <div class="fe-touch" hidden>This game needs a keyboard and a mouse (or touchpad). Open it on a computer to play.</div>`;
    app.root.appendChild(root);
    const main = root.querySelector('.fe-main');
    root.querySelector('.fe-touch').hidden = !matchMedia('(hover: none) and (pointer: coarse)').matches;
    let screen = 'heroes';
    let view = null; // settings pages, when open
    let preview = null;
    try {
      preview = new SoldierPreview(app.renderer);
    } catch (e) {
      console.warn('No soldier preview', e);
    }

    const go = () => {
      const s = selected(roster);
      const m = roster.mission;
      save();
      window.removeEventListener('keydown', onKey);
      view?.close();
      preview?.dispose();
      root.remove();
      resolve({
        map: m.map,
        mode: 'auto',
        faction: s.faction,
        side: m.side,
        enemy: enemyOf(s.faction, m.enemy),
        cls: s.cls,
        tank: s.cls === 'tanker' ? s.tank || TANKS[s.faction][0][0] : null,
        loadout: [...s.loadout],
        badge: badgeOf(s),
        upgrades: loadoutUpgrades(s, s.loadout),
        bots: m.bots,
        minutes: m.minutes,
        soldier: { id: s.id, name: s.name, seed: s.seed, variant: s.variant },
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
        <div class="fe-stage hx-stage"><div class="stage-turn">${ICONS.turn}<span>Drag to turn</span></div><div class="fe-nameplate"></div><div class="hx-badges"></div></div>
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
      // The soldier in 3D, his name plate, and his badge under him.
      const stage = main.querySelector('.fe-stage');
      if (preview) {
        preview.show({ faction: s.faction, cls: s.cls, seed: s.seed, variant: s.variant, primary: s.loadout[0] });
        preview.frame(stage);
        if (!stage.dataset.drag) {
          preview.enableDrag(stage);
          stage.dataset.drag = '1';
        }
      } else stage.querySelector('.stage-turn').hidden = true;
      const r = rankOf(s.xp);
      const plate = main.querySelector('.fe-nameplate');
      plate.innerHTML = `<span class="np-rank">${rankBadge(r.rank)}</span><div class="np-text"><h2></h2><div class="np-sub"></div><div class="xp"><i style="width:${(r.progress * 100).toFixed(1)}%"></i></div><div class="np-xp"></div></div>`;
      plate.querySelector('h2').textContent = s.name;
      plate.querySelector('.np-sub').textContent = `Rank ${r.rank} · ${rankTitle(s.faction, r.rank)} · ${CLASS_NAMES[s.cls]}`;
      plate.querySelector('.np-xp').textContent = r.next === null ? `${fmt(s.xp)} XP: the highest rank` : `${fmt(s.xp)} / ${fmt(r.next)} XP`;
      const worn = badgeOf(s);
      const bd = el('button', 'hx-badge', `${shield(worn ? '<path d="M27 15l4 9 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill="#e2ac46"/>' : '<path d="M27 22v18M18 31h18" stroke="rgba(255,255,255,0.45)" stroke-width="3"/>')}<span></span>`);
      bd.querySelector('span').textContent = worn ? `${BADGES[worn.id].name} ${'I'.repeat(worn.tier)}` : 'Badge';
      bd.title = worn ? BADGES[worn.id].does : 'Choose a combat badge';
      bd.addEventListener('click', () => badgeWindow(s));
      main.querySelector('.hx-badges').appendChild(bd);
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
        [ICONS.shield || '', 'Badge', () => badgeWindow(s)],
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
        const pic = preview?.gunPicture(id, 240, 70) || '';
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
        for (const t of badgeTiers(s, id)) for (const a of t.alts) if (a.ribbon === key) out.push({ level: a.level, name: `${b.name} ${'I'.repeat(t.tier)}`, kind: 'badge', id });
      return out.sort((a, b) => a.level - b.level);
    }
    // The ribbons this soldier works on: his class's, and each gun he has used.
    const ribbonKeys = (s) => ribbonsFor(s.cls).concat(Object.keys(s.ribbons || {}).filter((k) => k.startsWith('spec:')));
    // A picture of what a level opens.
    function opensPicture(o, w = 150, h = 56) {
      if (o.kind === 'badge') return shield('<path d="M27 15l4 9 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill="#e2ac46"/>');
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
        show('heroes');
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

    // His combat badge, as in the original game: one worn, each with three
    // tiers that open at levels of his ribbons.
    function badgeWindow(s) {
      const W = openWindow('Combat badge', { sub: 'One worn; its tiers open with his ribbons', cls: 'hx-wide' });
      const draw = () => {
        W.body.innerHTML = '';
        const grid = el('div', 'hx-badgegrid');
        const open = wearable(s);
        const worn = badgeOf(s);
        const none = el('button', `badge-card${worn ? '' : ' on'}`);
        none.innerHTML = '<div class="bdg-head"><b>No badge</b></div>';
        none.addEventListener('click', () => {
          s.badge = null;
          save();
          draw();
        });
        grid.appendChild(none);
        // The ones he may wear; the rest folded away until asked for.
        const shut = Object.keys(BADGES).filter((id) => !open.includes(id));
        for (const id of [...open, ...(showShut ? shut : [])]) {
          const b = BADGES[id];
          const tiers = badgeTiers(s, id);
          const can = open.includes(id);
          const c = el('button', `badge-card${worn?.id === id ? ' on' : ''}${can ? '' : ' locked'}`);
          c.innerHTML = '<div class="bdg-head"><b></b><span class="bdg-tier"></span></div><div class="bdg-does"></div><div class="bdg-tiers"></div>';
          c.querySelector('b').textContent = b.name;
          const top = tiers.filter((t) => t.open).pop();
          c.querySelector('.bdg-tier').textContent = top ? `Tier ${'I'.repeat(top.tier)}` : 'Locked';
          c.querySelector('.bdg-does').textContent = b.does;
          const tl = c.querySelector('.bdg-tiers');
          for (const t of tiers) {
            const row = el('span', t.open ? 'open' : '');
            row.textContent = `${'I'.repeat(t.tier)}: ${b.show(t.value)}${t.open ? '' : `, at ${t.alts.map((a) => `${RIBBONS[a.ribbon].name} ${a.level}`).join(' or ')}`}`;
            tl.appendChild(row);
          }
          if (can)
            c.addEventListener('click', () => {
              s.badge = id;
              save();
              draw();
            });
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

    function readyBox(box, s) {
      const m = roster.mission;
      const mi = MISSIONS.find((x) => x.id === m.map) || MISSIONS[0];
      const enemy = enemyOf(s.faction, m.enemy);
      const what = m.map === 'town' ? `${m.side === 'attack' ? 'Attacking' : 'Defending'} against the ${FACTIONS[enemy].army} · ${m.bots} per side · ${m.minutes} min` : 'Practice, no enemies';
      box.innerHTML = `<div class="ready-mission"><span class="rm-kind"></span><b></b><small></small><button class="rm-change">Change battle</button></div><button class="ready-btn">Ready for battle</button>`;
      box.querySelector('.rm-kind').textContent = mi.kind;
      box.querySelector('b').textContent = mi.title;
      box.querySelector('small').textContent = what;
      box.querySelector('.rm-change').addEventListener('click', () => show('generals'));
      box.querySelector('.ready-btn').addEventListener('click', go);
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
        const list = upgradesOf(gun)
          .filter((u) => u.slot === slot)
          .sort((a, b) => a.level - b.level || a.credits - b.credits);
        if (chosen === undefined || (chosen && !list.some((u) => u.id === chosen))) chosen = picks[slot] || null;
        const key = specialistKey(gun);
        const lv = key ? ribbonLevel(s.ribbons?.[key]).level : null;
        ov.innerHTML = `<div class="cust-head"><span class="cust-gun">${gunPic ? `<img alt="" src="${gunPic}">` : ''}</span><div class="cust-title"><h2></h2><small></small></div><button class="cust-close">Done</button></div>
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

    // --- Generals: the battles ------------------------------------------------------
    function generals() {
      const s = selected(roster);
      const m = roster.mission;
      main.innerHTML = `
        <aside class="fe-panel fe-missions"><h3>Battles</h3><div class="mission-list"></div></aside>
        <div class="fe-panel fe-mapbox"><canvas class="fe-map"></canvas><div class="map-caption"></div></div>
        <aside class="fe-panel fe-detail"></aside>`;
      const list = main.querySelector('.mission-list');
      for (const mi of MISSIONS) {
        const c = el('button', `mission-card${mi.id === m.map ? ' on' : ''}`);
        c.innerHTML = '<span class="mc-kind"></span><b></b><small></small>';
        c.querySelector('.mc-kind').textContent = mi.kind;
        c.querySelector('b').textContent = mi.title;
        c.querySelector('small').textContent = mi.line;
        c.addEventListener('click', () => {
          m.map = mi.id;
          save();
          show('generals');
        });
        list.appendChild(c);
      }
      const mi = MISSIONS.find((x) => x.id === m.map) || MISSIONS[0];
      main.querySelector('.map-caption').textContent = `${mi.title}: ${MAPS[mi.id].description}`;
      drawMap(main.querySelector('.fe-map'), MAPS[mi.id], m.side === 'attack' ? 1 : 0);
      const d = main.querySelector('.fe-detail');
      d.appendChild(el('div', 'det-kind')).textContent = mi.kind;
      d.appendChild(el('h2')).textContent = mi.title;
      d.appendChild(el('p')).textContent = mi.note;
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
            show('generals');
          });
          c.appendChild(b);
        }
        r.appendChild(c);
        d.appendChild(r);
      };
      if (mi.id === 'town') {
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
      }
      const who = el('div', 'det-soldier');
      const r = rankOf(s.xp);
      who.innerHTML = `<span class="np-emb">${emblem(s.faction)}</span><span class="sc-text"><b></b><small></small></span>`;
      who.querySelector('b').textContent = s.name;
      who.querySelector('small').textContent = `${rankTitle(s.faction, r.rank)} · ${CLASS_NAMES[s.cls]} · ${WEAPONS[s.loadout[0]].name}`;
      d.appendChild(who);
      const b = el('button', 'ready-btn', 'Join battle');
      b.addEventListener('click', go);
      d.appendChild(b);
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
        <p>An unofficial fan tribute to <b>Heroes &amp; Generals</b>, the WWII game by Reto-Moto (2016 to 2023; its servers closed in May 2023): large battles of infantry, tanks and vehicles fought over a French village. It is not connected with Reto-Moto or the game's later owners and uses none of their assets.</p>
        <p>Everything is simulated: bullets fly with real drag and drop for their ammunition and slow down through walls; guns load, cycle and recoil like the originals and are aimed through their real sights; armor stops or fails against each shell by its real thickness and slope; tanks steer like their real transmissions; soldiers tire, bleed and bandage.</p>
        <p>All models, textures and sounds are generated in code when the game loads. Your soldiers and their ranks are kept in this browser.</p>
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

