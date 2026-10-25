// Visual effects tied to vehicles: exhaust smoke (thicker under load and from
// diesels), dust and spray thrown up by wheels and tracks, fire and smoke from
// damaged or destroyed vehicles, and a flying turret after an ammunition blast.
//
// Damage shows in stages, so anyone can tell at a glance, from a hundred meters
// off, how hurt a vehicle is and when it is nearly finished (DAMAGE_STAGES):
// thin grey wisps from the engine, then steady darker smoke, then thick black
// smoke with sparks and small flames. The paint blackens as it goes, ending in
// the charred wreck, and hits leave holes, gouges and scorch marks where they
// landed, riding on the hull, turret or gun they struck.
import * as THREE from 'three';
import { G, clamp, RNG, Noise } from '../core/math.js';
import { CollisionWorld, RayHit, Box } from '../physics/collision.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const DUSTY = new Set([1, 2, 5, 8, 9, 11]); // dry grass, dirt, field, dirt road, sand, wheat
const MUDDY = new Set([3]);

export function updateVehicleEffects(game, v, dt) {
  updateDamageLook(v);
  const fx = game.effects;
  if (!fx) return;
  v._fxT = (v._fxT || 0) + dt;
  const b = v.body;
  const up = _v2.set(0, 1, 0).applyQuaternion(b.quaternion);
  // Exhaust.
  if (v.alive && v.engineOn) {
    v._exhaustAcc = (v._exhaustAcc || 0) + dt * (2 + v.load * 14 + (v.shiftTimer > 0 ? 6 : 0));
    const diesel = v.def.engine.sound === 'engineTankDiesel';
    while (v._exhaustAcc > 1) {
      v._exhaustAcc -= 1;
      for (const name of ['exhaustL', 'exhaustR']) {
        const p = v.anchorWorld(name, _v);
        if (!p) continue;
        const shade = diesel ? 0.12 + (1 - v.load) * 0.1 : 0.35;
        fx.spawn('muzzleSmoke', p.x, p.y, p.z, { count: 1, dir: [b.velocity.x * 0.3, 0.6, b.velocity.z * 0.3], spread: 0.15, scale: diesel ? 2.4 : 1.4, color: [shade, shade, shade * 0.95] });
      }
      if (!v.model.anchors?.exhaustL && !v.model.anchors?.exhaustR) {
        const p = _v.set(0, v.def.dims[1] * 0.4, v.def.dims[2] * 0.5);
        v._modelToWorld(p, p);
        fx.spawn('muzzleSmoke', p.x, p.y, p.z, { count: 1, dir: [0, 0.6, 0], spread: 0.15, scale: 1.4 });
      }
    }
  }
  // Dust or mud from wheels and tracks.
  const speed = b.velocity.length();
  if (speed > 2.5 && v.wheels.length) {
    v._dustAcc = (v._dustAcc || 0) + dt * Math.min(12, speed * (v.def.kind === 'tracked' ? 1.2 : 0.8));
    while (v._dustAcc > 1) {
      v._dustAcc -= 1;
      const w = v.wheels[(Math.random() * v.wheels.length) | 0];
      if (!w.onGround) continue;
      const p = w.contactNow;
      if (DUSTY.has(w.surface)) {
        fx.spawn('dust', p.x, p.y + 0.15, p.z, { count: 1, dir: [-b.velocity.x * 0.15, 0.4, -b.velocity.z * 0.15], spread: 0.5, scale: 1 + speed * 0.08 });
      } else if (MUDDY.has(w.surface)) {
        fx.spawn('mud', p.x, p.y + 0.1, p.z, { count: 2, dir: [-b.velocity.x * 0.2, 1.5, -b.velocity.z * 0.2], spread: 0.8, speed: 1.2, ground: p.y - 0.05 });
      }
    }
  }
  if (v.waterDepth > 0.15 && speed > 1) {
    const p = b.position;
    fx.spawn('water', p.x + (Math.random() - 0.5) * 2, p.y - v.cg.y + v.waterDepth, p.z + (Math.random() - 0.5) * 2, { count: 2, dir: [0, 2 + speed * 0.3, 0], spread: 1, speed: 1 });
  }
  // A hurt engine smokes, by damage stage (a fire, below, makes its own).
  if (v.alive && !(v.fire > 0)) damageSmoke(game, v, dt, damageStage(v));
  // Fire and smoke.
  if (v.fire > 0 || !v.alive) {
    const burning = v.fire > 0;
    v._fireAcc = (v._fireAcc || 0) + dt * (burning ? 10 : 2);
    while (v._fireAcc > 1) {
      v._fireAcc -= 1;
      const p = _v.set((Math.random() - 0.5) * v.def.dims[0] * 0.5, v.def.dims[1] * 0.8, v.def.dims[2] * (0.15 + Math.random() * 0.2));
      v._modelToWorld(p, p);
      if (burning) fx.spawn('fire', p.x, p.y, p.z, { count: 1, spread: 0.4, scale: v.alive ? 0.6 : 1.1 });
      fx.spawn('smoke', p.x, p.y + 0.5, p.z, { count: 1, spread: 0.4, scale: burning ? 1.2 : 0.9, color: [0.08, 0.08, 0.08] });
    }
    // Firelight: a faint, flickering glow on what stands close (in daylight flames
    // light little; brighter pulses made everything near a burning vehicle flash).
    if (burning && Math.random() < dt * 3) fx.flashLight(b.position.x, b.position.y + 1.5, b.position.z, 1.6, 8, 0.25);
  }
  // A turret thrown off by an ammunition explosion flies, then lies where it lands.
  const tf = v.turretFly;
  const t = v.model.parts?.turret;
  if (tf && t && !tf.landed) {
    if (!tf.started) {
      tf.started = true;
      t.updateWorldMatrix(true, false);
      const pos = new THREE.Vector3(),
        quat = new THREE.Quaternion();
      t.matrixWorld.decompose(pos, quat, new THREE.Vector3());
      game.world.scene.attach(t);
      tf.pos = pos;
      t.position.copy(pos);
      t.quaternion.copy(quat);
    }
    tf.vy -= G * dt;
    t.position.x += tf.vx * dt;
    t.position.y += tf.vy * dt;
    t.position.z += tf.vz * dt;
    t.rotateX(tf.spin * dt * 0.3);
    t.rotateZ(tf.spin * dt);
    const gy = game.world.hf.getHeight(t.position.x, t.position.z);
    if (t.position.y < gy + 0.3 && tf.vy < 0) {
      t.position.y = gy + 0.3;
      tf.landed = true;
      fx.spawn('dust', t.position.x, gy + 0.3, t.position.z, { count: 10, spread: 2, speed: 1.5, scale: 2 });
    }
  }
}

// ------------------------------------------------------------------ damage stages
// Health left (a share of the full) at or below which each stage starts: 1 hurt
// (thin grey wisps from the engine), 2 badly hurt (steady darker smoke), 3 almost
// broken (thick black smoke, sparks now and then, small flames at the engine).
// Stage 0 is sound, 4 destroyed.
export const DAMAGE_STAGES = [0.6, 0.35, 0.15];

// The stage for a share of health left (0..1).
export function healthStage(frac) {
  if (!(frac > 0)) return 4;
  let s = 0;
  while (s < DAMAGE_STAGES.length && frac <= DAMAGE_STAGES[s]) s++;
  return s;
}

// How hurt a vehicle shows: by its health, except that a hit engine smokes
// whatever shape the rest is in (a damaged one thinly, a dead one steadily).
// Bicycles have no engine.
export function damageStage(v) {
  if (!v.alive) return 4;
  let s = Math.min(3, healthStage(v.hp / v.maxHp));
  const engine = v.pedal ? 1 : (v.modules?.engine ?? 1);
  if (engine <= 0) s = Math.max(s, 2);
  else if (engine < 1) s = Math.max(s, 1);
  return s;
}

// Per-vehicle damage state (made on first use).
function dmg(v) {
  return (v._dmg ??= { scorch: 0, soot: 1, mats: null, charred: false, marks: new Map(), vent: null, smokeAcc: 0, flameAcc: 0, flameT: 0, flameOn: false, sparkT: 1 });
}

// ------------------------------------------------------------------ engine smoke
// Engine smoke by stage: puffs a second, puff size, and its grey (1 white, 0 black).
const SMOKE = [null, { rate: 1.5, scale: 0.45, shade: 0.5 }, { rate: 3, scale: 0.75, shade: 0.2 }, { rate: 6, scale: 1.05, shade: 0.05 }];

function damageSmoke(game, v, dt, stage) {
  const sm = SMOKE[stage];
  if (!sm || v.pedal) return;
  const fx = game.effects;
  const d = dmg(v);
  const vent = engineVent(v);
  const b = v.body;
  // Smaller vehicles make less of it: a motorcycle's is about half a jeep's. Far
  // off, fewer and bigger puffs: the column stays as easy to see, for less.
  const cam = game.camera?.position;
  const far = cam ? clamp((cam.distanceTo(b.position) - 60) / 200, 0, 0.6) : 0;
  const size = (v.isBike ? 0.5 : clamp(v.def.dims[0] / 2.8, 0.7, 1.15)) * (1 + far);
  const [hx, , hz] = vent.half;
  d.smokeAcc += dt * sm.rate * (v.isBike ? 0.7 : 1) * (1 - 0.4 * far) * (fx.q?.count ?? 1);
  while (d.smokeAcc > 1) {
    d.smokeAcc -= 1;
    const p = _v.set(vent.pos.x + (Math.random() - 0.5) * hx, vent.pos.y, vent.pos.z + (Math.random() - 0.5) * hz);
    v._modelToWorld(p, p);
    const c = sm.shade * (0.88 + Math.random() * 0.24);
    fx.spawn('smoke', p.x, p.y, p.z, { count: 1, dir: [b.velocity.x * 0.3, 0.7 + stage * 0.3, b.velocity.z * 0.3], spread: 0.2, scale: sm.scale * size, color: [c, c, c * 0.96] });
  }
  if (stage < 3) return;
  // Almost done for: small flames lick out of the engine in fits...
  d.flameT -= dt;
  if (d.flameT <= 0) {
    d.flameOn = !d.flameOn;
    d.flameT = d.flameOn ? 0.4 + Math.random() * 1.2 : 0.15 + Math.random() * 0.6;
  }
  if (d.flameOn) {
    d.flameAcc += dt * 9;
    while (d.flameAcc > 1) {
      d.flameAcc -= 1;
      const p = _v.set(vent.pos.x + (Math.random() - 0.5) * hx * 0.8, vent.pos.y - 0.05, vent.pos.z + (Math.random() - 0.5) * hz * 0.8);
      v._modelToWorld(p, p);
      fx.spawn('fire', p.x, p.y, p.z, { count: 1, dir: [b.velocity.x * 0.5, 0.4, b.velocity.z * 0.5], spread: 0.15, scale: (v.isBike ? 0.36 : 0.32) * size });
    }
  }
  // ...and now and then a shower of sparks.
  d.sparkT -= dt;
  if (d.sparkT <= 0) {
    d.sparkT = 0.7 + Math.random() * 2.2;
    const p = v._modelToWorld(_v.copy(vent.pos), _v);
    fx.spawn('spark', p.x, p.y, p.z, { count: v.isBike ? 5 : 10, dir: [0, 2.5, 0], spread: 1.6, speed: 1.4, ground: game.world.hf?.getHeight(p.x, p.z) });
  }
}

const _hit = new RayHit();
const _box = new Box(0, 0, 0, 1, 1, 1, 0, 'armor', 0);

// Where smoke from a hurt engine comes out, in model space (worked out once):
// the outer skin over the engine (a tank's rear deck, a jeep's bonnet), found by
// looking straight up from the middle of the engine through the hull plates. A
// motorcycle's engine is out in the open: from the engine itself.
function engineVent(v) {
  const d = dmg(v);
  if (d.vent) return d.vent;
  const [W, H, L] = v.def.dims;
  const eng = v.internals?.find((m) => m.name === 'engine');
  const c = eng ? new THREE.Vector3().setFromMatrixPosition(eng.local) : new THREE.Vector3(0, H * 0.45, L * 0.3);
  const half = eng ? [eng.box.hx, eng.box.hy, eng.box.hz] : [W * 0.25, H * 0.15, L * 0.12];
  let top = c.y + half[1];
  const normal = new THREE.Vector3(0, 1, 0);
  if (!v.isBike) {
    for (const pl of v.plates || []) {
      if (pl.part !== 'body' || pl.kind) continue;
      const e = pl.local.elements;
      _box.cx = e[12];
      _box.cy = e[13];
      _box.cz = e[14];
      _box.ax = [e[0], e[1], e[2]];
      _box.ay = [e[4], e[5], e[6]];
      _box.az = [e[8], e[9], e[10]];
      _box.hx = pl.box.hx;
      _box.hy = pl.box.hy;
      _box.hz = pl.box.hz;
      if (!CollisionWorld.rayBox(_box, c.x, c.y, c.z, 0, 1, 0, 2.5, _hit) || c.y + _hit.tExit <= top) continue;
      top = c.y + Math.min(2.5, _hit.tExit);
      // (Its face toward the engine, turned outward: the way the deck faces.)
      if (_hit.t > 0 && -_hit.ny > 0.5) normal.set(-_hit.nx, -_hit.ny, -_hit.nz);
      else normal.set(0, 1, 0);
    }
  }
  d.vent = { pos: new THREE.Vector3(c.x, top, c.z), half, normal };
  return d.vent;
}

// ------------------------------------------------------------------ scorched paint
// How far the paint has gone (0 clean, 1 as black as it gets short of burning
// out): from the first real damage down to almost nothing left.
export function scorchLevel(frac) {
  return clamp((0.92 - frac) / 0.8, 0, 1);
}

// Soot and burnt paint at full scorch (times the paint's own color). Bicycles
// don't burn: they gather dust and lose their shine.
const SOOT = new THREE.Color(0.5, 0.46, 0.42);
const DUST = new THREE.Color(0.32, 0.28, 0.22);
// Paint and canvas take it all; bare metal, rubber and glass a little over half.
const SOOTY = /paint|cast|canvas/i;
const _c = new THREE.Color();

// The paint blackens (a bicycle just gets dirtier) as the vehicle loses health,
// and soot settles over a smoking engine: a patch when it smokes in earnest, a
// bigger one when it is almost done for. A wreck that burns out is charred
// (charModel); a wrecked bicycle stays dirty.
export function updateDamageLook(v) {
  if (!v.model?.root || v._dmg?.charred) return;
  const s = v.alive ? Math.round(scorchLevel(v.hp / v.maxHp) * 40) / 40 : 1;
  if (s !== (v._dmg?.scorch ?? 0)) applyScorch(v, s);
  if (!v.alive || v.isBike) return;
  const stage = damageStage(v);
  if (stage >= 2 && (v._dmg?.soot ?? 1) < stage) engineSoot(v, stage);
}

function engineSoot(v, stage) {
  const d = dmg(v);
  const vent = engineVent(v);
  const [hx, , hz] = vent.half;
  // (The vent is in vehicle space, which is the hull group's frame too.)
  const parent = markParent(v, 'body');
  for (let st = Math.max(2, (d.soot ?? 1) + 1); st <= stage; st++) {
    const k = st === 2 ? 1.6 : 2.2;
    _p.copy(vent.pos).addScaledVector(_a.set(Math.random() - 0.5, 0, Math.random() - 0.5), Math.min(hx, hz) * 0.5);
    markLocal(v, parent, 'scorch', _p, vent.normal, hx * k, hz * k, _X);
  }
  d.soot = stage;
}

function applyScorch(v, s) {
  const d = dmg(v);
  d.scorch = s;
  for (const e of ownMaterials(v)) {
    const m = e.mat;
    const k = s * e.weight;
    if (v.pedal) {
      if (m.color && e.color) m.color.copy(e.color).lerp(DUST, 0.4 * k);
      if ('roughness' in m) m.roughness = e.roughness + (Math.max(e.roughness, 0.9) - e.roughness) * k;
      if ('metalness' in m) m.metalness = e.metalness * (1 - 0.6 * k);
      continue;
    }
    if (m.color && e.color) m.color.copy(e.color).multiply(_c.setRGB(1 + (SOOT.r - 1) * k, 1 + (SOOT.g - 1) * k, 1 + (SOOT.b - 1) * k));
    if ('roughness' in m) m.roughness = e.roughness + (1 - e.roughness) * k;
    if ('metalness' in m) m.metalness = e.metalness * (1 - 0.5 * k);
  }
}

// This vehicle's own copies of its materials (every vehicle of a type shares
// them), made the first time it needs them, so its paint can blacken without
// touching anyone else's. Each remembers how it first looked.
function ownMaterials(v) {
  const d = dmg(v);
  if (d.mats) return d.mats;
  const list = [];
  const done = new Map();
  const standIn = !!v.model.meta?.placeholder;
  v.model.root.traverse((o) => {
    if (!o.isMesh || o.userData.damageMarks) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const out = mats.map((m) => {
      let c = done.get(m);
      if (!c) {
        c = m.clone();
        c.userData = { texWorld: m.userData?.texWorld };
        v.game?.world?.shadows?.setup(c);
        done.set(m, c);
        list.push({ mat: c, color: c.color ? c.color.clone() : null, roughness: c.roughness ?? 1, metalness: c.metalness ?? 0, weight: standIn || SOOTY.test(m.name || '') ? 1 : 0.6 });
      }
      return c;
    });
    o.material = Array.isArray(o.material) ? out : out[0];
  });
  d.mats = list;
  return list;
}

// Burnt-out wreck: every material goes dark and dull (from its first look, so
// earlier scorching doesn't make it any blacker).
export function charModel(v) {
  const d = dmg(v);
  for (const e of ownMaterials(v)) {
    const c = e.mat;
    if (c.color && e.color) c.color.copy(e.color).multiplyScalar(0.16);
    if ('roughness' in c) c.roughness = 1;
    if ('metalness' in c) c.metalness = e.metalness * 0.4;
    if (c.emissive) c.emissive.setRGB(0, 0, 0);
    c.userData.charred = true;
  }
  d.charred = true;
}

// ------------------------------------------------------------------ hit marks
// Three kinds of mark: a hole punched through (dark middle, torn bright edge, a
// ring of soot), a gouge where a shell failed to get in or glanced off (metal
// scraped bright, burnt round the edge) and a soot scorch where something burst
// or burned its way in. Each is laid onto the part's own surface and clipped to
// the mark's square, so nothing hangs off an edge or sinks into a rounded
// casting; all marks of a kind on a part make one mesh that rides with it. A
// part keeps at most MARK_CAP of a kind; past that a new mark takes the place of
// the oldest.
export const MARK_CAP = { hole: 24, gouge: 10, scorch: 10 };
// (Scorches underneath, holes on top.)
const MARK_ORDER = { scorch: 1, gouge: 2, hole: 3 };

const markTextures = {};
// The marks' pictures, drawn in code (64 x 64, alpha for the ragged edge).
function markTexture(kind) {
  if (markTextures[kind]) return markTextures[kind];
  const N = 64;
  const data = new Uint8Array(N * N * 4);
  const seed = { hole: 11, gouge: 23, scorch: 37 }[kind];
  const rng = new RNG(seed);
  const noise = new Noise(seed);
  // A ragged outline: the radius wobbles with the angle.
  const waves = [0, 1, 2, 3].map((i) => [2 + i * 2 + rng.int(0, 1), rng.next() * 6.28, (0.15 * rng.range(0.6, 1)) / (i + 1)]);
  const ss = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const u = ((x + 0.5) / N) * 2 - 1,
        w = ((y + 0.5) / N) * 2 - 1;
      const ang = Math.atan2(w, u);
      let rag = 1;
      for (const [f, ph, a] of waves) rag += a * Math.sin(f * ang + ph);
      const r = Math.hypot(u, w) / rag;
      const n = noise.noise2(x * 0.19, y * 0.19) * 0.5 + 0.5;
      const n2 = noise.noise2(x * 0.5 + 40, y * 0.5) * 0.5 + 0.5;
      let R, Gc, B, A;
      if (kind === 'hole') {
        if (r < 0.2) [R, Gc, B, A] = [10, 9, 8, 1];
        else if (r < 0.3) {
          // The torn edge: bare steel in broken patches.
          const k = 60 + 80 * n2;
          [R, Gc, B, A] = [k, k * 0.99, k * 0.96, 1];
        } else {
          const a = 0.85 * (1 - ss(0.3, 1, r + (n - 0.5) * 0.35));
          [R, Gc, B, A] = [24, 21, 18, a];
        }
      } else if (kind === 'gouge') {
        if (r < 0.42) {
          // Scraped steel, streaked, darker toward the bottom of the scoop.
          const k = (85 + 55 * n2) * (0.75 + 0.25 * clamp(r / 0.42, 0, 1));
          [R, Gc, B, A] = [k, k * 0.98, k * 0.95, 1];
        } else if (r < 0.62) [R, Gc, B, A] = [44, 37, 31, 0.92];
        else [R, Gc, B, A] = [30, 26, 22, 0.7 * (1 - ss(0.62, 1, r)) * (0.4 + 0.6 * n)];
      } else {
        // Soot, darkest in the middle and browner where it thins out.
        const a = 0.92 * (1 - ss(0.25, 1, r + (n - 0.5) * 0.45)) * (0.75 + 0.25 * n2);
        const k = clamp(r, 0, 1);
        [R, Gc, B, A] = [14 + 40 * k, 12 + 29 * k, 11 + 19 * k, a];
      }
      // (Clear all round the border, so smaller copies of it stay clear there too.)
      if (x === 0 || y === 0 || x === N - 1 || y === N - 1) A = 0;
      const i = (y * N + x) * 4;
      data[i] = R;
      data[i + 1] = Gc;
      data[i + 2] = B;
      data[i + 3] = Math.round(clamp(A, 0, 1) * 255);
    }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  markTextures[kind] = t;
  return t;
}

// One material per kind and world (like the world's bullet holes: see-through,
// pulled toward the camera so it sits on the surface).
const markMats = new WeakMap();
const NO_WORLD = {};
function markMaterial(game, kind) {
  const key = game?.world || NO_WORLD;
  let set = markMats.get(key);
  if (!set) markMats.set(key, (set = {}));
  if (!set[kind]) {
    const gouge = kind === 'gouge';
    const m = new THREE.MeshStandardMaterial({ map: markTexture(kind), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, roughness: gouge ? 0.6 : 0.9, metalness: gouge ? 0.3 : 0.1 });
    m.name = `mark-${kind}`;
    game?.world?.shadows?.setup(m);
    set[kind] = m;
  }
  return set[kind];
}

// What carries the marks on a plate's part: the part itself (turret, gun), or
// the hull's own group (so on a motorcycle seen from afar they hide with it).
function markParent(v, part) {
  const parts = v.model.parts || {};
  return (part && part !== 'body' && parts[part]) || parts.body || v.model.root;
}

const _p = new THREE.Vector3();
const _a = new THREE.Vector3();
const _pt = new THREE.Vector3();
const _nm = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _cen = new THREE.Vector3();
const _tv = new THREE.Vector3();
const _tn = new THREE.Vector3();
const _ta = new THREE.Vector3();
const _tb = new THREE.Vector3();
const _tc = new THREE.Vector3();
const _th = new THREE.Vector3();
const _e1 = new THREE.Vector3();
const _e2 = new THREE.Vector3();
const _fn = new THREE.Vector3();
const _T = new THREE.Vector3();
const _B = new THREE.Vector3();
const _X = new THREE.Vector3(1, 0, 0);
const _white = new THREE.Color(1, 1, 1);
const _mInv = new THREE.Matrix4();
const _nMat = new THREE.Matrix3();
const _ray = new THREE.Ray();
// Candidate triangles (nearTriangles): six numbers a corner (position, normal).
let _tris = new Float32Array(18 * 512);

function isIdentity(m) {
  const e = m.elements;
  for (let i = 0; i < 16; i++) if (e[i] !== (i % 5 === 0 ? 1 : 0)) return false;
  return true;
}

// The triangles of the meshes `parent` carries itself that come within `radius`
// of `center` (all in the parent's frame), into _tris. Returns how many numbers.
function nearTriangles(parent, center, radius) {
  let n = 0;
  const r2 = radius * radius;
  for (const mesh of parent.children) {
    if (!mesh.isMesh || mesh.isInstancedMesh || mesh.userData.damageMarks) continue;
    const g = mesh.geometry;
    const pos = g.attributes.position,
      nor = g.attributes.normal;
    if (!pos || !nor || pos.isInterleavedBufferAttribute || nor.isInterleavedBufferAttribute) continue;
    // (A model's merged meshes sit in their part's frame; a stand-in's are placed in it.)
    const M = mesh.matrix;
    const moved = !isIdentity(M);
    _cen.copy(center);
    if (moved) {
      _cen.applyMatrix4(_mInv.copy(M).invert());
      _nMat.getNormalMatrix(M);
    }
    if (!g.boundingSphere) g.computeBoundingSphere();
    const bs = g.boundingSphere;
    if (bs.center.distanceToSquared(_cen) > (bs.radius + radius) ** 2) continue;
    const P = pos.array,
      Nr = nor.array;
    const idx = g.index ? g.index.array : null;
    const count = idx ? idx.length : pos.count;
    const cx = _cen.x,
      cy = _cen.y,
      cz = _cen.z;
    for (let i = 0; i + 2 < count; i += 3) {
      const a = (idx ? idx[i] : i) * 3,
        b = (idx ? idx[i + 1] : i + 1) * 3,
        c = (idx ? idx[i + 2] : i + 2) * 3;
      // Distance from the center to the triangle's bounding box, axis by axis.
      let lo = Math.min(P[a], P[b], P[c]),
        hi = Math.max(P[a], P[b], P[c]);
      let d = cx < lo ? lo - cx : cx > hi ? cx - hi : 0;
      let dd = d * d;
      if (dd > r2) continue;
      lo = Math.min(P[a + 1], P[b + 1], P[c + 1]);
      hi = Math.max(P[a + 1], P[b + 1], P[c + 1]);
      d = cy < lo ? lo - cy : cy > hi ? cy - hi : 0;
      dd += d * d;
      if (dd > r2) continue;
      lo = Math.min(P[a + 2], P[b + 2], P[c + 2]);
      hi = Math.max(P[a + 2], P[b + 2], P[c + 2]);
      d = cz < lo ? lo - cz : cz > hi ? cz - hi : 0;
      dd += d * d;
      if (dd > r2) continue;
      if (n + 18 > _tris.length) {
        const t = new Float32Array(_tris.length * 2);
        t.set(_tris);
        _tris = t;
      }
      for (const k of [a, b, c]) {
        _tv.set(P[k], P[k + 1], P[k + 2]);
        _tn.set(Nr[k], Nr[k + 1], Nr[k + 2]);
        if (moved) {
          _tv.applyMatrix4(M);
          _tn.applyMatrix3(_nMat).normalize();
        }
        _tris[n++] = _tv.x;
        _tris[n++] = _tv.y;
        _tris[n++] = _tv.z;
        _tris[n++] = _tn.x;
        _tris[n++] = _tn.y;
        _tris[n++] = _tn.z;
      }
    }
  }
  return n;
}

// Where a ray from o along d first meets the front of the candidate triangles,
// within len: fills p and that triangle's normal. False when it meets none.
function rayTriangles(n, o, d, len, p, nrm) {
  _ray.origin.copy(o);
  _ray.direction.copy(d);
  let best = len,
    found = false;
  for (let i = 0; i < n; i += 18) {
    _ta.fromArray(_tris, i);
    _tb.fromArray(_tris, i + 6);
    _tc.fromArray(_tris, i + 12);
    if (!_ray.intersectTriangle(_ta, _tb, _tc, true, _th)) continue;
    const t = _th.distanceTo(o);
    if (t > best) continue;
    best = t;
    found = true;
    p.copy(_th);
    nrm.subVectors(_tb, _ta).cross(_e2.subVectors(_tc, _ta)).normalize();
  }
  return found;
}

// Keep the part of a polygon (corners [x, y, z, nx, ny, nz, u, v]) on one side
// of corner[k] = lim (above it when `above`).
function clipPoly(poly, k, above, lim) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const A = poly[i],
      B = poly[(i + 1) % poly.length];
    const ia = above ? A[k] >= lim : A[k] <= lim;
    const ib = above ? B[k] >= lim : B[k] <= lim;
    if (ia) out.push(A);
    if (ia !== ib) {
      const t = (lim - A[k]) / (B[k] - A[k]);
      out.push(A.map((x, j) => x + (B[j] - x) * t));
    }
  }
  return out;
}

// Lay a w x h mark centered on p and facing out along nrm (its width along
// `along`, or turned any way) onto the candidate triangles that face the same way
// within `depth` of it, clipped to the mark's square: { pos, nor, uv }, or null.
function projectMark(n, p, nrm, w, h, along, depth) {
  if (along && Math.abs(along.dot(nrm)) < 0.97) _T.copy(along).addScaledVector(nrm, -along.dot(nrm)).normalize();
  else {
    _T.set(Math.abs(nrm.y) < 0.9 ? 0 : 1, Math.abs(nrm.y) < 0.9 ? 1 : 0, 0).cross(nrm).normalize();
    _B.crossVectors(nrm, _T);
    const ang = Math.random() * Math.PI * 2;
    _T.multiplyScalar(Math.cos(ang)).addScaledVector(_B, Math.sin(ang));
  }
  _B.crossVectors(nrm, _T);
  const pos = [],
    nor = [],
    uv = [];
  const corner = (i, q) => {
    _e1.subVectors(q, p);
    return [q.x, q.y, q.z, _tris[i + 3], _tris[i + 4], _tris[i + 5], _e1.dot(_T) / w + 0.5, _e1.dot(_B) / h + 0.5];
  };
  for (let i = 0; i < n; i += 18) {
    _ta.fromArray(_tris, i);
    _tb.fromArray(_tris, i + 6);
    _tc.fromArray(_tris, i + 12);
    _fn.subVectors(_tb, _ta).cross(_e2.subVectors(_tc, _ta));
    const len = _fn.length();
    // (Facing away, or edge on: a mark there would only smear.)
    if (len < 1e-12 || _fn.dot(nrm) < 0.25 * len) continue;
    const da = _e1.subVectors(_ta, p).dot(nrm),
      db = _e1.subVectors(_tb, p).dot(nrm),
      dc = _e1.subVectors(_tc, p).dot(nrm);
    if (Math.min(da, db, dc) > depth || Math.max(da, db, dc) < -depth) continue;
    let poly = [corner(i, _ta), corner(i + 6, _tb), corner(i + 12, _tc)];
    if (poly.every((c) => c[6] < 0) || poly.every((c) => c[6] > 1) || poly.every((c) => c[7] < 0) || poly.every((c) => c[7] > 1)) continue;
    poly = clipPoly(clipPoly(clipPoly(clipPoly(poly, 6, true, 0), 6, false, 1), 7, true, 0), 7, false, 1);
    for (let j = 1; j + 1 < poly.length; j++) {
      for (const c of [poly[0], poly[j], poly[j + 1]]) {
        _tn.set(c[3], c[4], c[5]).normalize();
        pos.push(c[0] + _tn.x * 0.0015, c[1] + _tn.y * 0.0015, c[2] + _tn.z * 0.0015);
        nor.push(_tn.x, _tn.y, _tn.z);
        uv.push(c[6], c[7]);
      }
    }
  }
  return pos.length ? { pos: new Float32Array(pos), nor: new Float32Array(nor), uv: new Float32Array(uv) } : null;
}

// Lay a mark in the frame of the object carrying it (see projectMark). `tris`:
// candidates already gathered round p, or -1 to gather them here.
function markLocal(v, parent, kind, p, nrm, w, h, along = null, tris = -1) {
  if (tris < 0) tris = nearTriangles(parent, p, Math.hypot(w, h) / 2 + 0.05);
  const rec = projectMark(tris, p, nrm, w, h, along, Math.max(0.03, 0.25 * Math.max(w, h)));
  if (!rec) return null;
  const d = dmg(v);
  const key = `${parent.uuid}:${kind}`;
  let set = d.marks.get(key);
  if (!set) {
    // (A single instance: then it shares its shader with the world's bullet
    // holes, and the first mark of a battle doesn't stall it compiling one.)
    const mesh = new THREE.InstancedMesh(new THREE.BufferGeometry(), markMaterial(v.game, kind), 1);
    mesh.setColorAt(0, _white);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.renderOrder = MARK_ORDER[kind];
    mesh.name = `marks-${kind}`;
    mesh.userData.damageMarks = true;
    parent.add(mesh);
    set = { mesh, recs: [], next: 0 };
    d.marks.set(key, set);
  }
  if (set.recs.length < MARK_CAP[kind]) set.recs.push(rec);
  else set.recs[set.next] = rec;
  set.next = (set.next + 1) % MARK_CAP[kind];
  // One geometry for all of them.
  let total = 0;
  for (const r of set.recs) total += r.pos.length;
  const P = new Float32Array(total),
    Nr = new Float32Array(total),
    U = new Float32Array((total / 3) * 2);
  let o = 0,
    ou = 0;
  for (const r of set.recs) {
    P.set(r.pos, o);
    Nr.set(r.nor, o);
    U.set(r.uv, ou);
    o += r.pos.length;
    ou += r.uv.length;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(Nr, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  g.computeBoundingSphere();
  set.mesh.geometry.dispose();
  set.mesh.geometry = g;
  set.mesh.computeBoundingSphere();
  return set.mesh;
}

// A round that struck a vehicle leaves its mark where it landed: a bullet
// through thin metal a small hole; a shell that got in a hole ringed with soot;
// one that failed to get in a gouge (a streak where it glanced off), with a
// scorch if it burst. Tracks, wheels and tires keep none (they turn), nor do
// bicycles (too thin to show one); bullets only smear lead on armor.
export function addHitMark(v, info, ammo) {
  if (!v.model?.root || v.pedal || !ammo || ammo.thrown) return;
  const kind = info.kind;
  if (kind !== 'penetrate' && kind !== 'nonpen' && kind !== 'ricochet') return;
  const plate = info.plate;
  if (plate?.kind) return;
  const shell = ammo.diameter >= 0.019 || !!ammo.heat || !!ammo.explosive;
  if (!shell && kind !== 'penetrate') return;
  const cal = Math.max(0.005, ammo.diameter || 0);
  const blast = ammo.explosive ? Math.sqrt(ammo.explosive.blast || 0) : 0;
  // What it leaves: [kind, width, height], soot first (it lies underneath).
  const marks = [];
  if (!shell) marks.push(['hole', 0.07 + cal * 4]);
  else if (kind === 'penetrate') marks.push(['scorch', 0.35 + cal * 4 + (ammo.filler || ammo.heat ? 0.15 : 0) + blast * 0.4], ['hole', 0.06 + cal * 2.2 + (ammo.heat ? 0.04 : 0)]);
  else if (kind === 'ricochet') marks.push(['gouge', 0.1 + cal * 9, 0.04 + cal * 2.5]);
  else {
    if (ammo.explosive || ammo.heat) marks.push(['scorch', 0.45 + blast * 0.8 + (ammo.heat ? 0.2 : 0)]);
    const s = 0.06 + cal * 3.2;
    marks.push(['gouge', s, s * (0.75 + Math.random() * 0.25)]);
  }
  // Into the frame of the part that was hit as it stands now (the armor boxes
  // were placed from the same matrices), so the marks ride with it from here on.
  const parent = markParent(v, plate?.part || 'body');
  _mInv.copy(parent.matrixWorld).invert();
  _pt.set(info.x, info.y, info.z).applyMatrix4(_mInv);
  _nm.set(info.nx, info.ny, info.nz).transformDirection(_mInv);
  _dir.set(info.dirX, info.dirY, info.dirZ).transformDirection(_mInv);
  let reach = 0;
  for (const [, w, h = w] of marks) reach = Math.max(reach, Math.hypot(w, h) / 2);
  const tris = nearTriangles(parent, _pt, reach + 0.4);
  // The model's own skin there: the armor boxes only approximate rounded
  // castings and a motorcycle's tubes. A bullet that meets no skin leaves no
  // mark; for a shell the box's face will do.
  if (!rayTriangles(tris, _a.copy(_pt).addScaledVector(_dir, -0.35), _dir, 0.7, _pt, _nm) && !shell) return;
  if (_nm.dot(_dir) > 0) _nm.negate();
  for (const [k, w, h = w] of marks) markLocal(v, parent, k, _pt, _nm, w, h, k === 'gouge' && kind === 'ricochet' ? _dir : null, tris);
}

// How many marks a vehicle carries now (all parts and kinds).
export function markCount(v) {
  let n = 0;
  for (const set of v._dmg?.marks?.values() || []) n += set.recs.length;
  return n;
}
