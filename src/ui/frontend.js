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
import { FACTIONS, WEAPONS, weaponsFor } from '../weapons/defs.js';
import { AMMO } from '../weapons/ammo.js';
import { variantCount } from '../actors/soldierKit.js';
import { SettingsView } from './settingsView.js';
import { emblem, classIcon, rankBadge, ICONS } from './icons.js';
import { loadRoster, saveRoster, selected, select, recruit, dismiss, rankOf, rankTitle, playerLevel, randomName, RANK_XP, RANK_TITLES, CLASS_NAMES, CLASS_NOTES, MAX_SOLDIERS } from './roster.js';
import { SoldierPreview } from './soldierPreview.js';
import { BattleMap } from './battleMap.js';

const TANKS = {
  US: [
    ['m4a1_sherman', 'M4A1 Sherman', 'Medium tank, 75 mm gun, gyrostabilized. Five crew.'],
    ['m5a1_stuart', 'M5A1 Stuart', 'Light tank, 37 mm gun, fast. Four crew.'],
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
  parts.push(`${w.mass.toFixed(1)} kg`);
  return parts.join(' · ');
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
        const slots = [
          ['primary', 'Primary'],
          ['sidearm', 'Sidearm'],
          ['equipment', 'Equipment'],
        ];
        slots.forEach(([slot, label], i) => {
          const options = weaponsFor(s.faction, s.cls, slot);
          const cur = WEAPONS[s.loadout[i]];
          const box = el('div', 'slot');
          box.appendChild(el('div', 'slot-label', `${label}<span>${options.length > 1 ? `${options.length} to choose from` : ''}</span>`));
          const card = weaponCard(cur, true);
          box.appendChild(card);
          if (options.length > 1) {
            const pick = el('div', 'slot-pick');
            pick.hidden = true;
            for (const w of options) {
              const c = weaponCard(w, w.id === cur.id);
              c.addEventListener('click', () => {
                s.loadout[i] = w.id;
                save();
                if (i === 0) preview?.show({ faction: s.faction, cls: s.cls, seed: s.seed, variant: s.variant, primary: w.id });
                loadout(s, 'weapons');
              });
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
          body.appendChild(box);
        });
        body.appendChild(el('div', 'lo-note', 'Every soldier also carries field dressings to bandage wounds.'));
      } else if (tab === 'vehicle') {
        if (s.cls === 'tanker') {
          if (!TANKS[s.faction].some((t) => t[0] === s.tank)) s.tank = TANKS[s.faction][0][0];
          for (const [id, name, note] of TANKS[s.faction]) {
            const c = el('button', `veh-card${id === s.tank ? ' on' : ''}`);
            c.appendChild(el('b')).textContent = name;
            c.appendChild(el('span')).textContent = note;
            c.addEventListener('click', () => {
              s.tank = id;
              save();
              loadout(s, 'vehicle');
            });
            body.appendChild(c);
          }
          body.appendChild(el('div', 'lo-note', 'A tank crewman goes into battle in his tank, as its driver; the gunner and the other seats change with F1 to F4.'));
        } else {
          body.appendChild(el('div', 'lo-note', `${CLASS_NAMES[s.cls]} soldiers go into battle on foot. Jeeps, bicycles and motorcycles wait at the spawn points: walk up to one and press the get-in key. Recruit a tank crewman to fight in a tank.`));
        }
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

    function weaponCard(w, on) {
      const c = el('button', `wpn-card${on ? ' on' : ''}`);
      const pic = preview?.gunPicture(w.id) || '';
      c.innerHTML = `<span class="wpn-pic">${pic ? `<img alt="" src="${pic}">` : ''}</span><span class="wpn-text"><b></b><small></small></span>`;
      c.querySelector('b').textContent = w.name;
      c.querySelector('small').textContent = weaponStats(w);
      return c;
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
        inp.max = 18;
        inp.value = m.bots;
        inp.id = l.htmlFor = 'fe-bots';
        inp.addEventListener('input', () => {
          m.bots = Number(inp.value);
          l.querySelector('b').textContent = m.bots;
          save();
        });
        r.appendChild(inp);
        r.appendChild(el('div', 'note', 'The original game fought 18 against 18. Fewer is lighter on slower computers.'));
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

