// Checks that each weapon loads, fires and reloads the way the real one does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Weapon } from '../src/weapons/weapon.js';
import { WEAPONS } from '../src/weapons/defs.js';

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
    if (d.type === 'grenade' || d.type === 'binoculars') continue; // (nothing fired: tests/binoculars.test.js)
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
