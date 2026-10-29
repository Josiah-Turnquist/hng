// The front end, laid out like the original game's main interface: a top bar with
// the Heroes, Generals and Progression tabs and, at the right, the player's level,
// the army of the chosen soldier, settings, full screen and about.
//   Heroes: the soldier roster (recruit more, any army and class), the chosen
//     soldier standing in 3D, his loadout (weapons, vehicle, uniform), the
//     Bulletin, and Ready for battle with the battle he will join.
//   Generals: the battles to join, the battlefield's map and the battle's details.
//   Progression: the player's level, each soldier's rank and record, the ranks.
// Resolves with the battle options when the player goes into battle.
import { MAPS } from '../world/maps.js';
import { FACTIONS, WEAPONS, baseOf, weaponsFor, scopeChoices, LOADOUT_SLOTS, CLASS_POINTS, pointsOf, loadoutPoints } from '../weapons/defs.js';
import { BADGES, badgeOf, badgeTiers, wearable } from '../game/badges.js';
import { RIBBONS, ribbonInfo, ribbonLevel, ribbonsFor, requirement, requirementText, unlocked, carriable, tankRequirement, tankUnlocked } from '../game/ribbons.js';
import { AMMO } from '../weapons/ammo.js';
import { UPGRADE_SLOTS, SLOT_NAMES, AMMO_TYPES, GUN_UPGRADES, upgradesOf, upgradedDef, upgradeOpen, specialistKey, damageScale as scaleAt } from '../weapons/upgrades.js';
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

// What's new: shown in the Bulletin.
const BULLETIN = [
  ['New', 'Heroes, Generals and Progression: recruit soldiers of any army, rise through the ranks.'],
  ['Controls', 'Every key can be changed in Settings > Controls > Keys. The ` key (left of 1) aims, as well as the right mouse button.'],
  ['Field report', 'Bicycles and motorcycles wait at the spawn points; walk up to one and press the get-in key.'],
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
  if (u.family) return `${u.mag}x telescopic sight.`;
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
    function heroes() {
      const s = selected(roster);
      main.innerHTML = `
        <aside class="fe-panel fe-roster"><h3>Soldiers <span class="count">${roster.soldiers.length} / ${MAX_SOLDIERS}</span></h3><div class="roster-list"></div></aside>
        <div class="fe-stage"><div class="stage-turn">${ICONS.turn}<span>Drag to turn</span></div><div class="fe-nameplate"></div></div>
        <aside class="fe-panel fe-loadout"><div class="lo-tabs"></div><div class="lo-body"></div></aside>
        <aside class="fe-panel fe-bulletin"><h3>Bulletin</h3></aside>
        <div class="fe-ready"></div>`;
      // Roster.
      const list = main.querySelector('.roster-list');
      for (const x of roster.soldiers) {
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
      const add = el('button', 'soldier-card recruit', `<span class="sc-emb">${ICONS.plus}</span><span class="sc-text"><b>Recruit a soldier</b><small>Any army, any class</small></span>`);
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
      // The soldier in 3D, and his name plate.
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
      plate.innerHTML = `<div class="np-top"><span class="np-emb">${emblem(s.faction)}</span><span class="np-rank">${rankBadge(r.rank)}</span><h2></h2></div><div class="np-sub"></div><div class="xp"><i style="width:${(r.progress * 100).toFixed(1)}%"></i></div><div class="np-xp"></div>`;
      plate.querySelector('h2').textContent = s.name;
      plate.querySelector('.np-sub').textContent = `Rank ${r.rank} · ${rankTitle(s.faction, r.rank)} · ${CLASS_NAMES[s.cls]} · ${FACTIONS[s.faction].army}`;
      plate.querySelector('.np-xp').textContent = r.next === null ? `${fmt(s.xp)} XP: the highest rank` : `${fmt(s.xp)} / ${fmt(r.next)} XP to ${rankTitle(s.faction, r.rank + 1)}`;
      loadout(s, 'weapons');
      // Bulletin.
      const bul = main.querySelector('.fe-bulletin');
      for (const [t, text] of BULLETIN) {
        const item = el('div', 'bul-item');
        item.appendChild(el('b')).textContent = t;
        item.appendChild(el('span')).textContent = text;
        bul.appendChild(item);
      }
      readyBox(main.querySelector('.fe-ready'), s);
    }

    function loadout(s, tab) {
      const tabs = main.querySelector('.lo-tabs');
      const body = main.querySelector('.lo-body');
      const names = [
        ['weapons', 'Weapons'],
        ['vehicle', 'Vehicle'],
        ['ribbons', 'Ribbons'],
        ['badge', 'Badge'],
        ['uniform', 'Uniform'],
      ];
      tabs.innerHTML = '';
      for (const [k, label] of names) {
        const b = el('button', k === tab ? 'on' : '', label);
        b.addEventListener('click', () => loadout(s, k));
        tabs.appendChild(b);
      }
      body.innerHTML = '';
      if (tab === 'weapons') {
        // His equipment points: what the loadout costs of what his class has.
        const budget = CLASS_POINTS[s.cls];
        const used = loadoutPoints(s.loadout);
        const meter = el('div', 'pts-meter');
        meter.innerHTML = '<span class="pts-l">Equipment points</span><span class="pts-v"></span><div class="pts-bar"></div>';
        meter.querySelector('.pts-v').textContent = `${used} / ${budget}`;
        const bar = meter.querySelector('.pts-bar');
        for (let k = 0; k < budget; k++) bar.appendChild(el('i', k < used ? 'on' : ''));
        body.appendChild(meter);
        const labels = ['Primary', 'Sidearm', 'Equipment 1', 'Equipment 2', 'Equipment 3', 'Close combat', 'Binoculars'];
        LOADOUT_SLOTS.forEach((slot, i) => {
          // One card for each rifle; its scopes are chosen under it. Another
          // army's guns show once he has begun to earn them (or has).
          const taken = s.loadout.filter((id, j) => id && j !== i);
          const options = families(s, slot).filter((w) => !taken.some((id) => baseOf(WEAPONS[id]) === w));
          const cur = s.loadout[i] ? WEAPONS[s.loadout[i]] : null;
          if (!cur && !options.length) return;
          const pickWeapon = (id) => {
            s.loadout[i] = id;
            save();
            if (i === 0) preview?.show({ faction: s.faction, cls: s.cls, seed: s.seed, variant: s.variant, primary: id });
            loadout(s, 'weapons');
          };
          // Points left for this slot: the budget less everything else.
          const room = budget - used + (cur ? pointsOf(cur.id) : 0);
          const box = el('div', 'slot');
          box.appendChild(el('div', 'slot-label', `${labels[i]}<span>${cur ? `${pointsOf(cur.id)} pt` : 'empty'}</span>`));
          const card = cur ? weaponCard(upgradedDef(cur.id, picksOf(s, cur.id)), true) : emptyCard(true);
          box.appendChild(card);
          if (options.length > (cur ? 1 : 0) || (cur && i > 0)) {
            const pick = el('div', 'slot-pick');
            pick.hidden = true;
            for (const w of options) {
              // Another rifle: plain if this soldier may carry it plain, else its first scope.
              const id = cur && w === baseOf(cur) ? cur.id : scopeChoices(w, s.cls)[0]?.id || w.id;
              const open = unlocked(s, id);
              const fits = pointsOf(id) <= room;
              const c = weaponCard(w, cur && w === baseOf(cur), open ? null : requirement(id, s.cls, s.faction), w.faction !== s.faction, open && !fits ? pointsOf(id) - room : 0);
              if (open && fits) {
                if (owns(s, id)) c.addEventListener('click', () => pickWeapon(id));
                else shopCard(c, s, id, () => pickWeapon(id));
              }
              pick.appendChild(c);
            }
            // Any slot but the main weapon's may be left empty.
            if (i > 0 && cur) {
              const c = emptyCard(false);
              c.addEventListener('click', () => pickWeapon(null));
              pick.appendChild(c);
            }
            card.classList.add('opens');
            card.title = 'Choose another';
            card.addEventListener('click', () => {
              const open = pick.hidden;
              body.querySelectorAll('.slot-pick').forEach((p) => (p.hidden = true));
              pick.hidden = !open;
            });
            box.appendChild(pick);
          }
          // Its scopes: none (where the plain rifle is allowed) and the ones
          // really fitted to it, each with what it changes.
          const scopes = cur ? scopeChoices(cur, s.cls) : [];
          if (scopes.some((c) => c.scope)) {
            const sc = el('div', 'scope-pick');
            sc.appendChild(el('div', 'slot-label', `Scope<span>${scopes.length > 1 ? `${scopes.length} to choose from` : ''}</span>`));
            for (const c of scopes) {
              const b = el('button', `scope-opt${c.id === cur.id ? ' on' : ''}`);
              b.appendChild(el('b')).textContent = c.scope ? c.scope.name : 'None';
              b.appendChild(el('small')).textContent = c.note;
              if (c.def.fitting) b.title = c.def.fitting.mount;
              if (owns(s, c.id)) b.addEventListener('click', () => c.id !== cur.id && pickWeapon(c.id));
              else shopCard(b, s, c.id, () => pickWeapon(c.id));
              sc.appendChild(b);
            }
            box.appendChild(sc);
          }
          // His upgrades for this gun: the customization screen.
          if (cur && upgradesOf(cur.id).length && owns(s, cur.id)) {
            const n = Object.keys(picksOf(s, cur.id)).length;
            const b = el('button', 'upg-open');
            b.innerHTML = `${ICONS.wrench || ''}<span>Customize</span><small></small>`;
            b.querySelector('small').textContent = n ? `${n} upgrade${n > 1 ? 's' : ''} fitted` : 'Ammunition, barrel, internal, sight, trigger';
            b.addEventListener('click', () => customize(s, cur.id));
            box.appendChild(b);
          }
          body.appendChild(box);
        });
        body.appendChild(el('div', 'lo-note', `As in the original game, everything he carries costs equipment points, and a ${CLASS_NAMES[s.cls].toLowerCase()} soldier has ${CLASS_POINTS[s.cls]}. Every soldier also carries field dressings to bandage wounds. More weapons open as his ribbons rise (the Ribbons tab); once open, each is bought once with credits.`));
      } else if (tab === 'vehicle') {
        if (s.cls === 'tanker') {
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
                loadout(s, 'vehicle');
              });
            else c.appendChild(el('em')).textContent = lockLine(s, tankRequirement(id));
            body.appendChild(c);
          }
          body.appendChild(el('div', 'lo-note', 'A tank crewman goes into battle in his tank, as its driver; the gunner and the other seats change with F1 to F4.'));
        } else {
          body.appendChild(el('div', 'lo-note', `${CLASS_NAMES[s.cls]} soldiers go into battle on foot. Jeeps, bicycles and motorcycles wait at the spawn points: walk up to one and press the get-in key. Recruit a tank crewman to fight in a tank.`));
        }
      } else if (tab === 'badge') {
        // His combat badge, as in the original game: one worn, each with three
        // tiers that open at levels of his ribbons.
        const open = wearable(s);
        const worn = badgeOf(s);
        const none = el('button', `badge-card${worn ? '' : ' on'}`);
        none.innerHTML = '<div class="bdg-head"><b>No badge</b></div>';
        none.addEventListener('click', () => {
          s.badge = null;
          save();
          loadout(s, 'badge');
        });
        body.appendChild(none);
        const ids = Object.keys(BADGES).sort((a, b) => open.includes(b) - open.includes(a));
        for (const id of ids) {
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
              loadout(s, 'badge');
            });
          else c.disabled = true;
          body.appendChild(c);
        }
        body.appendChild(el('div', 'lo-note', 'The original game gives each badge\'s strength but not what it does; what each does here is read from its name.'));
      } else if (tab === 'ribbons') {
        // His ribbons, as the original game's: the level, how far to the next,
        // and what the levels still to come open for him.
        for (const k of ribbonsFor(s.cls)) {
          const lv = ribbonLevel(s.ribbons?.[k]);
          const box = el('div', 'rib-row');
          box.innerHTML = '<div class="rib-head"><b></b><span class="rib-lv"></span></div><div class="rib-note"></div><div class="rib-bar"><i></i></div><div class="rib-next"></div>';
          box.querySelector('b').textContent = RIBBONS[k].name;
          box.querySelector('.rib-lv').textContent = `Level ${lv.level} of 12`;
          box.querySelector('.rib-note').textContent = RIBBONS[k].note;
          box.querySelector('i').style.width = `${(lv.progress * 100).toFixed(1)}%`;
          const pts = Math.round(s.ribbons?.[k] || 0);
          const ahead = opensWith(s, k).filter((o) => o.level > lv.level);
          box.querySelector('.rib-next').textContent =
            (lv.next === null ? `${fmt(pts)} points: the highest level` : `${fmt(pts)} / ${fmt(lv.next)} points to level ${lv.level + 1}`) + (ahead.length ? ` · Next: ${ahead.map((o) => `${o.name} (${o.level})`).join(', ')}` : '');
          body.appendChild(box);
        }
        // Specialist ribbons: each gun he has used, its own.
        const specs = Object.keys(s.ribbons || {}).filter((k) => k.startsWith('spec:'));
        if (specs.length) {
          body.appendChild(el('div', 'slot-label', 'Specialist ribbons<span>each gun its own</span>'));
          specs.sort((a, b) => s.ribbons[b] - s.ribbons[a]);
          for (const k of specs) {
            const info = ribbonInfo(k);
            const lv = ribbonLevel(s.ribbons[k]);
            const foreign = WEAPONS[info.gun].faction !== s.faction;
            const box = el('div', 'rib-row');
            box.innerHTML = '<div class="rib-head"><b></b><span class="rib-lv"></span></div><div class="rib-bar"><i></i></div><div class="rib-next"></div>';
            box.querySelector('b').textContent = info.name;
            box.querySelector('.rib-lv').textContent = `Level ${lv.level} of 12`;
            box.querySelector('i').style.width = `${(lv.progress * 100).toFixed(1)}%`;
            const pts = Math.round(s.ribbons[k]);
            box.querySelector('.rib-next').textContent = (lv.next === null ? `${fmt(pts)} points: the highest level` : `${fmt(pts)} / ${fmt(lv.next)} points to level ${lv.level + 1}`) + (foreign ? (lv.level >= 9 ? ' · He may carry it' : ' · At level 9 he may carry it') : '');
            body.appendChild(box);
          }
        }
        body.appendChild(el('div', 'lo-note', 'Pick up another army\'s gun in battle and use it to earn its Specialist ribbon: at level 9 he may take it into battle.'));
        body.appendChild(el('div', 'lo-note', 'As in the original game, a soldier earns each ribbon by what he does in battle (shots, hits, kills, headshots, vehicles knocked out), and his army\'s guns and tanks open at set ribbon levels. Rank still rises with experience.'));
      } else {
        const n = variantCount(s.faction, s.cls);
        const grid = el('div', 'uni-grid');
        for (let v = 0; v < n; v++) {
          const b = el('button', v === s.variant ? 'on' : '', `Uniform ${v + 1}`);
          b.addEventListener('click', () => {
            s.variant = v;
            save();
            preview?.show({ faction: s.faction, cls: s.cls, seed: s.seed, variant: v, primary: s.loadout[0] });
            loadout(s, 'uniform');
          });
          grid.appendChild(b);
        }
        body.appendChild(grid);
        body.appendChild(el('div', 'lo-note', 'Each uniform is a different set of the period kit of his army and class: jacket, helmet cover, webbing, pouches.'));
      }
    }

    // The rifles (and other guns) of a slot to choose from: his army's, then
    // another army's he has begun to earn or has earned.
    function families(s, slot) {
      const out = [];
      for (const w of carriable(s, slot)) {
        const b = baseOf(w);
        if (out.includes(b)) continue;
        if (b.faction !== s.faction) {
          const r = requirement(b.id, s.cls, s.faction);
          if (!unlocked(s, w.id) && !(s.ribbons?.[r.ribbon] > 0)) continue;
        }
        out.push(b);
      }
      return out;
    }

    // A weapon to choose; locked: what opens it, and how far he is. Another
    // army's carries its emblem.
    function weaponCard(w, on, lock = null, foreign = false, short = 0) {
      const c = el('button', `wpn-card${on ? ' on' : ''}${lock || short ? ' locked' : ''}`);
      const pic = preview?.gunPicture(w.id) || '';
      c.innerHTML = `<span class="wpn-pic">${pic ? `<img alt="" src="${pic}">` : ''}</span><span class="wpn-text"><b>${foreign ? `<span class="wpn-army">${emblem(w.faction)}</span>` : ''}<span class="wn"></span></b><small></small></span>`;
      c.querySelector('.wn').textContent = w.name;
      c.querySelector('small').textContent = lock ? lockLine(selected(roster), lock) : short ? `${pointsOf(w.id)} points: ${short} more than he has left` : weaponStats(w);
      if (lock || short) c.disabled = true;
      return c;
    }

    // An empty slot (or the choice to leave it empty).
    function emptyCard(on) {
      const c = el('button', `wpn-card empty${on ? ' on' : ''}`);
      c.innerHTML = '<span class="wpn-pic"></span><span class="wpn-text"><b>Empty</b><small>Nothing in this slot: its points stay free</small></span>';
      return c;
    }

    function lockLine(s, req) {
      return `Opens at ${requirementText(req)} (now level ${ribbonLevel(s.ribbons?.[req.ribbon]).level})`;
    }

    // What a ribbon opens for this soldier, by level.
    function opensWith(s, key) {
      const out = [];
      for (const slot of new Set(LOADOUT_SLOTS))
        for (const w of weaponsFor(s.faction, s.cls, slot)) {
          const r = requirement(w.id, s.cls, s.faction);
          if (r?.ribbon === key && !w.base) out.push({ name: w.name, level: r.level });
        }
      if (s.cls === 'tanker')
        for (const [id, name] of TANKS[s.faction]) {
          const r = tankRequirement(id);
          if (r?.ribbon === key) out.push({ name, level: r.level });
        }
      return out.sort((a, b) => a.level - b.level);
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
        loadout(s, 'weapons');
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
          const p = u ? pic(id, 160, 110) : slot === 'sight' || slot === 'ammo' ? '' : gunPic;
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
        const p = u ? pic(id, 320, 200) : gunPic;
        box.innerHTML = `<div class="cd-pic">${p ? `<img alt="" src="${p}">` : ''}</div><h3></h3><div class="cd-sub"></div><p class="cd-line"></p><div class="cd-bars"></div><button class="cd-act"></button>`;
        box.querySelector('h3').textContent = u ? short(u) : standard(slot);
        box.querySelector('.cd-sub').textContent = u ? [SLOT_NAMES[slot], sub(u)].filter(Boolean).join(' · ') : `${SLOT_NAMES[slot]} · as issued`;
        box.querySelector('.cd-line').textContent = u ? summary(gun, u) : 'The gun as it left the factory.';
        const bars = box.querySelector('.cd-bars');
        for (const [label, val] of METRICS) {
          const a = val(now, def),
            b = val(next, def);
          const row = el('div', 'cd-bar');
          const w = (x) => `${Math.max(3, Math.min(100, x * 50)).toFixed(1)}%`;
          const diff = Math.round((b / a - 1) * 100);
          row.innerHTML = `<span class="cb-l"></span><span class="cb-track"><i class="cb-now" style="width:${w(a)}"></i><i class="cb-next ${b > a + 1e-6 ? 'up' : b < a - 1e-6 ? 'down' : ''}" style="width:${w(b)}"></i></span><span class="cb-v">${diff ? `${diff > 0 ? '+' : ''}${diff}%` : ''}</span>`;
          row.querySelector('.cb-l').textContent = label;
          if (diff) row.classList.add(diff > 0 ? 'good' : 'bad');
          bars.appendChild(row);
        }
        if (next.scope && !now.scope) box.querySelector('.cd-line').textContent += ` ${next.scope.mag}x, set from ${next.sight.ranges[0]} to ${next.sight.ranges.at(-1)} ${next.sight.unit}.`;
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

