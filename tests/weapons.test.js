// Checks that each weapon loads, fires and reloads the way the real one does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Weapon } from '../src/weapons/weapon.js';
import { WEAPONS } from '../src/weapons/defs.js';
import { KIT_TYPES } from '../src/weapons/items/kits.js';

const DT = 1 / 120;

function run(w, seconds, trigger = false) {
  w.setTrigger(trigger);
  let shots = 0;
  for (let t = 0; t < seconds; t += DT) shots += w.update(DT);
  return shots;
}

// Pull and release the trigger once, then let the action settle.
function shoot(w) {
  const s = run(w, 0.05, true);
  run(w, 1.6, false);
  return s;
}

test('every weapon definition is complete and sane', () => {
  for (const [id, d] of Object.entries(WEAPONS)) {
    assert.ok(d.name && d.faction && d.type && d.slot, `${id} basics`);
    assert.ok(d.mass > 0 && d.mass < 25, `${id} mass`);
    // (Grenades, binoculars and kits fire nothing: tests/binoculars.test.js, tests/kits.test.js.)
    if (d.type === 'grenade' || d.type === 'binoculars' || KIT_TYPES.has(d.type)) continue;
    if (d.type === 'melee') {
      // Close-combat weapons fire nothing (game/melee.js).
      assert.ok(d.reach >= 0.8 && d.reach <= 1.5 && d.attack.hit < d.attack.period && d.damage.head > 0, `${id} blow`);
      continue;
    }
    assert.ok(d.mv > 20 && d.mv < 1300, `${id} muzzle velocity`);
    assert.ok(d.capacity >= 1 && d.capacity <= 100, `${id} capacity`);
    assert.ok(d.sight.ranges.includes(d.sight.zero), `${id} default zero must be a sight setting`);
    assert.ok(d.modes.length >= 1, `${id} modes`);
    if (d.modes.includes('auto')) assert.ok(d.rpm >= 300 && d.rpm <= 1300, `${id} rpm`);
  }
});

test('Kar 98k: 5 rounds, bolt after each shot, stripper clip reload', () => {
  const w = new Weapon(WEAPONS.kar98k);
  assert.equal(w.loaded, 5);
  assert.equal(shoot(w), 1);
  assert.equal(w.needsCycle, false, 'bolt worked after releasing the trigger');
  assert.equal(w.loaded, 4);
  // Holding the trigger does not fire again: it's a bolt action.
  assert.equal(run(w, 1.0, true), 1);
  run(w, 1.5, false);
  for (let i = 0; i < 3; i++) shoot(w);
  assert.equal(w.loaded, 0);
  assert.equal(w.clips, 10);
  assert.ok(w.startReload());
  run(w, 3.5);
  assert.equal(w.loaded, 5, 'full clip loaded and a round chambered');
  assert.equal(w.clips, 9);
});

test('Kar 98k: topping off loads single rounds', () => {
  const w = new Weapon(WEAPONS.kar98k);
  shoot(w);
  shoot(w);
  assert.equal(w.loaded, 3);
  w.startReload();
  run(w, 3);
  assert.equal(w.loaded, 5);
  assert.equal(w.clips, 9, 'one clip broken open for loose rounds');
  assert.equal(w.loose, 3);
});

test('M1 Garand: 8 shots, clip pings out on the last, then reload', () => {
  const w = new Weapon(WEAPONS.m1_garand);
  assert.equal(w.loaded, 8);
  const events = [];
  for (let i = 0; i < 8; i++) {
    shoot(w);
    events.push(...w.takeEvents());
  }
  assert.equal(w.loaded, 0);
  assert.ok(w.boltLocked);
  assert.ok(events.some((e) => e.type === 'clipEject' && !e.partial));
  assert.ok(w.startReload());
  run(w, 3);
  assert.equal(w.loaded, 8);
  assert.equal(w.boltLocked, false);
});

test('MP 40: open bolt, holding the trigger empties it and drops the bolt', () => {
  const w = new Weapon(WEAPONS.mp40);
  assert.equal(w.loaded, 32);
  const shots = run(w, 5, true);
  assert.equal(shots, 32);
  // 32 rounds at 550 rpm takes about 3.5 s.
  assert.equal(w.boltBack, false, 'bolt rode home on an empty chamber');
  run(w, 0.1, false);
  assert.ok(w.startReload());
  run(w, 3.5);
  assert.equal(w.mag, 32);
  assert.equal(w.boltBack, true, 'cocked during the reload');
  assert.equal(w.spareMags.length, 4);
});

test('cyclic rate is respected', () => {
  const w = new Weapon(WEAPONS.mg42);
  const shots = run(w, 1.0, true);
  // 1200 rpm = 20 rounds per second.
  assert.ok(shots >= 19 && shots <= 21, `MG 42 fired ${shots} in 1 s`);
  const t = new Weapon(WEAPONS.thompson_m1a1);
  const s2 = run(t, 1.0, true);
  assert.ok(s2 >= 11 && s2 <= 13, `Thompson fired ${s2} in 1 s`);
});

test('tactical reload keeps the chambered round and the partial magazine', () => {
  const w = new Weapon(WEAPONS.stg44);
  assert.equal(w.loaded, 31, '30 in the magazine + 1 in the chamber');
  run(w, 0.5, true); // short burst
  run(w, 0.2, false);
  const left = w.mag;
  w.startReload();
  run(w, 3.5);
  assert.equal(w.loaded, 31);
  assert.ok(w.spareMags.includes(left), 'partly used magazine kept');
});

test('Nagant revolver loads one round at a time', () => {
  const w = new Weapon(WEAPONS.nagant_m1895);
  assert.equal(w.loaded, 7);
  for (let i = 0; i < 3; i++) shoot(w);
  assert.equal(w.loaded, 4);
  w.startReload();
  run(w, 3.5);
  assert.equal(w.loaded, 7);
  assert.equal(w.loose, 32);
});

test('fire mode and sight range selection', () => {
  const w = new Weapon(WEAPONS.stg44);
  assert.equal(w.mode, 'auto');
  w.cycleMode();
  assert.equal(w.mode, 'semi');
  assert.equal(run(w, 1, true), 1, 'semi fires once per trigger pull');
  const k = new Weapon(WEAPONS.kar98k);
  assert.equal(k.zeroRange, 100);
  k.changeZero(+1);
  k.changeZero(+1);
  assert.equal(k.zeroRange, 300);
  k.changeZero(-5);
  assert.equal(k.zeroRange, 100);
});

// --- Stopped reloads ---------------------------------------------------------

const total = (w) => w.loaded + w.reserveRounds;
const fires = (d) => !(d.type === 'melee' || d.type === 'grenade' || d.type === 'binoculars' || KIT_TYPES.has(d.type) || d.feed === 'disposable');

// Ways to run a gun down before a reload: trigger held until empty, single
// pulls until empty, and a few rounds fired (a top-off).
const SETUPS = {
  held: (w) => {
    run(w, 20, true);
    run(w, 1.6, false);
  },
  pulls: (w) => {
    for (let i = 0; i < 80 && w.loaded > 0; i++) shoot(w);
  },
  few: (w) => {
    for (let i = 0; i < 3; i++) shoot(w);
  },
};

// Press R (or work the bolt) and wait, as often as it takes; true when it can fire.
function recover(w) {
  for (let i = 0; i < 6; i++) {
    run(w, 0.2);
    if (w.state !== 'ready') run(w, 12);
    if (w.canFire()) return true;
    if (w.needsCycle) w.startBoltCycle();
    else if (!w.startReload()) return false;
    run(w, 12);
  }
  return w.canFire();
}

test('a reload stopped at any step of any weapon leaves a gun R brings back, with no rounds lost or gained', () => {
  let checked = 0;
  for (const [id, d] of Object.entries(WEAPONS)) {
    if (!fires(d)) continue;
    for (const [how, setup] of Object.entries(SETUPS)) {
      const ref = new Weapon(d);
      setup(ref);
      if (!ref.canReload()) continue;
      ref.startReload();
      const steps = ref.sequence.steps.map((s) => ({ name: s.name, t: s.t }));
      let start = 0;
      for (const st of steps) {
        for (const f of [0.02, 0.5, 0.97]) {
          // Once (R, a weapon switch, a pickup, a vehicle, a blow) or twice (R twice).
          for (const presses of [1, 2]) {
            const w = new Weapon(d);
            setup(w);
            const before = total(w);
            w.startReload();
            run(w, start + st.t * f);
            const at = w.sequence?.steps[w.stepIndex]?.name;
            for (let p = 0; p < presses; p++) w.cancelReload();
            run(w, 12);
            const where = `${id} (${how}) stopped in ${at} (${st.name} ${f}) x${presses}`;
            assert.ok(w.canFire() || w.canReload() || w.needsCycle, `${where}: neither fires nor reloads`);
            assert.ok(recover(w), `${where}: R does not bring it back (mag ${w.mag}, chambered ${w.chambered}, bolt locked ${w.boltLocked})`);
            assert.equal(total(w), before, `${where}: rounds lost or gained`);
            assert.ok(run(w, 0.05, true) >= 1, `${where}: fires`);
            checked++;
          }
        }
        start += st.t;
      }
    }
  }
  assert.ok(checked > 500, `checked ${checked}`);
});

test('a bot (reloads only when empty, holds the trigger) is never left with a gun stuck after a stopped reload', () => {
  for (const [id, d] of Object.entries(WEAPONS)) {
    if (!fires(d)) continue;
    const ref = new Weapon(d);
    SETUPS.held(ref);
    if (!ref.canReload()) continue;
    ref.startReload();
    let start = 0;
    for (const st of ref.sequence.steps) {
      const w = new Weapon(d);
      SETUPS.held(w);
      w.startReload();
      run(w, start + st.t * 0.6);
      w.cancelReload();
      w.cancelReload();
      run(w, 0.3);
      // src/ai/bot.js: reload when nothing is loaded, else keep shooting.
      let shots = 0;
      for (let i = 0; i < 60 && !shots; i++) {
        if (w.state === 'ready' && w.loaded === 0 && w.canReload()) w.startReload();
        shots += run(w, 0.25, true);
        run(w, 0.05, false);
      }
      assert.ok(shots > 0, `${id} stopped in ${st.name}: the bot never fires again`);
      start += st.t;
    }
  }
});

test('MP 40 stopped while being cocked: R (or the trigger) only cocks it, using no magazine', () => {
  const w = new Weapon(WEAPONS.mp40);
  run(w, 5, true);
  run(w, 0.1);
  w.startReload();
  while (w.sequence.steps[w.stepIndex].name !== 'charge') run(w, DT);
  w.cancelReload();
  assert.equal(w.mag, 32);
  assert.equal(w.boltBack, false);
  assert.ok(w.canReload(), 'R is offered');
  assert.ok(w.startReload());
  assert.deepEqual(
    w.sequence.steps.map((s) => s.name),
    ['charge'],
  );
  run(w, 1);
  assert.equal(w.boltBack, true);
  assert.equal(w.spareMags.length, 4, 'no magazine used');
  // The same through the trigger.
  const b = new Weapon(WEAPONS.mp40);
  run(b, 5, true);
  run(b, 0.1);
  b.startReload();
  while (b.sequence.steps[b.stepIndex].name !== 'charge') run(b, DT);
  b.cancelReload();
  assert.ok(run(b, 2, true) > 0, 'pulling the trigger cocks it, then it fires');
});

test('Kar 98k: R while loading rounds closes the bolt; R again leaves it open, and the next R closes it', () => {
  const w = new Weapon(WEAPONS.kar98k);
  shoot(w);
  shoot(w);
  const before = total(w);
  w.startReload();
  while (w.sequence.steps[w.stepIndex].name !== 'round') run(w, DT);
  w.cancelReload();
  assert.equal(w.sequence.steps[w.stepIndex].name, 'boltClose');
  w.cancelReload();
  assert.equal(w.state, 'ready');
  assert.equal(w.chambered, false);
  assert.ok(w.startReload());
  run(w, 3);
  assert.equal(w.chambered, true);
  assert.equal(total(w), before);
});

test('M1 Garand stopped as the bolt is released: no clip lost, and with no clips left it still closes', () => {
  const w = new Weapon(WEAPONS.m1_garand);
  for (let i = 0; i < 8; i++) shoot(w);
  assert.equal(total(w), 80);
  w.startReload();
  while (w.sequence.steps[w.stepIndex].name !== 'boltRelease') run(w, DT);
  w.cancelReload();
  assert.equal(w.mag, 8);
  assert.ok(w.startReload());
  assert.deepEqual(
    w.sequence.steps.map((s) => s.name),
    ['boltRelease'],
  );
  run(w, 1);
  assert.equal(w.loaded, 8);
  assert.equal(total(w), 80, 'all 80 rounds still there');
  // The last clip.
  const last = new Weapon(WEAPONS.m1_garand);
  for (let i = 0; i < 8; i++) shoot(last);
  last.clips = 1;
  last.startReload();
  while (last.sequence.steps[last.stepIndex].name !== 'boltRelease') run(last, DT);
  last.cancelReload();
  assert.equal(last.clips, 0);
  assert.ok(last.startReload(), 'the rifle can still be closed on its last clip');
  run(last, 1);
  assert.equal(last.loaded, 8);
  // A clip pushed in with rounds still in the rifle keeps them.
  const g = new Weapon(WEAPONS.m1_garand);
  g.mag = 3;
  g.chambered = false;
  const r = total(g);
  g._garandClipIn();
  assert.equal(g.mag, 8);
  assert.equal(g.loose, 3);
  assert.equal(total(g), r, 'the 3 rounds left in go back with the loose ones');
});

test('dying mid-reload: the reload does not carry on after the weapon is filled again', () => {
  for (const id of ['nagant_m1895', 'm1911a1', 'c96', 'm1917_revolver', 'tt33', 'kar98k', 'm1_garand', 'mp40', 'mg42']) {
    const w = new Weapon(WEAPONS[id]);
    SETUPS.pulls(w);
    w.startReload();
    run(w, 0.4);
    w.fill();
    const fresh = new Weapon(WEAPONS[id]);
    assert.equal(w.state, 'ready', id);
    run(w, 6);
    assert.equal(w.loaded, fresh.loaded, `${id} loaded`);
    assert.equal(w.reserveRounds, fresh.reserveRounds, `${id} reserve`);
  }
});

test('Scavenger rounds for clip-fed guns are counted in rounds, not clips', () => {
  const g = new Weapon(WEAPONS.m1_garand);
  const r = g.reserveRounds;
  g.addRounds(4);
  assert.equal(g.reserveRounds, r + 4, 'half a Garand clip is 4 rounds');
  g.addRounds(4);
  assert.equal(g.reserveRounds, r + 8);
  assert.equal(g.loose, 0, 'two halves make a clip');
  const m = new Weapon(WEAPONS.m1917_revolver);
  const r2 = m.reserveRounds;
  m.addRounds(6);
  assert.equal(m.reserveRounds, r2 + 6, 'six rounds are two half-moon clips');
});

test('M1917: half-moon clips only go in whole, so no rounds vanish', () => {
  const w = new Weapon(WEAPONS.m1917_revolver);
  shoot(w);
  assert.equal(w.loaded, 5);
  assert.equal(w.canReload(), false, 'no room for a clip of 3');
  for (let i = 0; i < 3; i++) shoot(w);
  assert.equal(w.loaded, 2);
  const before = total(w);
  assert.ok(w.startReload());
  run(w, 4);
  assert.equal(w.loaded, 5, 'one clip of 3 in');
  assert.equal(total(w), before);
  for (let i = 0; i < 5; i++) shoot(w);
  w.startReload();
  run(w, 4);
  assert.equal(w.loaded, 6);
});
