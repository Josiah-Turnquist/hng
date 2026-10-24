// Uniforms and equipment of 1944 soldiers per army and class, and the person
// wearing them. The outfits themselves are in soldierKitUS.js, soldierKitGE.js
// and soldierKitSU.js; this module has the shared garment pieces (an Outfit
// builder with jackets, collars, pockets, buttons, trousers, footwear, belts and
// harness), the weathering, and the person parameters (face, skin, hair).
//
//   buildOutfit('GE', 'infantry', 3, 0, 'rifle') -> { b: SkinBuilder, info }
//   personParams('GE', rng); buildPerson(params, 0, info) -> SkinBuilder
//
// Variants are seeded: each (army, class, variant) always builds the same kit.
import * as THREE from 'three';
import { B, BIND, HEAD_CENTER } from './soldierRig.js';
import { SkinBuilder, torsoWeights, armWeights, legWeights, rigid, smooth01, weightsAt } from './soldierGeo.js';
import { CELL, CAMO_GREY } from './soldierMaterials.js';
import { buildTorsoGarment, buildSeat, buildSleeve, buildElbowPatch, buildTrouserLeg, buildLegWrap, buildPuttee, buildBoot, garmentPoint, garmentOffset, torsoPoint, torsoNormal, torsoTheta, chainPoint, armChain, legChain, interpRows, frontness, backness, hash1, noise3, lerp, TORSO_ROWS } from './soldierBody.js';
import { buildHead, buildNeck, buildHand, buildForearm } from './soldierHead.js';
import { Frame, torsoFrame, torsoBand, torsoStrap, rigidAt, pouch, buckle, starDecal } from './soldierGear.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;
export { PI, V };

export function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// The outfit builder: one SkinBuilder for the whole kit (cloth, leather and
// steel share the soldier material), plus what the person under it needs to
// know (headgear, rolled sleeves, gloves).
export class Outfit {
  constructor(faction, cls, variant, lod, role, rng) {
    this.faction = faction;
    this.cls = cls;
    this.variant = variant;
    this.lod = lod;
    this.role = role;
    this.rng = rng;
    this.b = new SkinBuilder(1);
    this.b.lowPoly = lod === 2;
    this.b.lod = lod;
    this.g = null;
    this.info = { headgear: 'helmet', rolled: 0, gloves: null, faction, cls, variant };
    this.dirt = 0.4;
  }
  r() {
    return this.rng();
  }
  chance(p) {
    return this.rng() < p;
  }
  pick(list) {
    return list[Math.floor(this.rng() * list.length) % list.length];
  }
  // Uniform colors vary from issue to issue and fade in the sun: a small
  // random shift of a color (sRGB hex) -> THREE.Color.
  shade(hex, amount = 0.05, fade = 0) {
    const c = new THREE.Color(hex);
    const k = 1 + (this.r() - 0.5) * 2 * amount;
    c.multiplyScalar(k);
    if (fade) c.lerp(new THREE.Color(0.55, 0.53, 0.47), fade);
    return c;
  }

  // ---- torso piece -------------------------------------------------------
  // g: garment cut (see garmentOffset): hem, belt, cinch, blouse, flare, grow,
  // folds, seed, top / neckline. color, cell. colorFn(x, y, z, c) optional.
  torso(g, { color, cell = CELL.wool, colorFn = null }) {
    const b = this.b;
    this.g = { seed: this.variant * 7 + 1, ...g };
    b.material(cell);
    b.paint(color);
    if (colorFn) this.g.colorFn = colorFn;
    buildTorsoGarment(b, this.g, this.lod);
    return this.g;
  }

  // Trousers: seat and legs. end: where the legs stop (distance along the leg
  // from the hip joint: ~0.84 at the ankle, ~0.5 inside tall boots).
  trousers({ color, cell = CELL.wool, style = 'straight', end = 0.84, blouse = 0, tuck, seatTop = 1.06, waistband = false, bulk = 0.004, folds = 1 }) {
    const b = this.b;
    b.material(cell);
    b.paint(color);
    buildSeat(b, { top: seatTop, lod: this.lod, waistband });
    for (const s of [-1, 1]) buildTrouserLeg(b, s, { lod: this.lod, end, style, blouse, tuck, bulk, folds, seed: this.variant + s });
  }

  // Sleeves, both sides.
  sleeves({ color, cell = CELL.wool, cuff = 'band', bulk = 0, rolled = 0, cuffColor = null, wide = 0 }) {
    const b = this.b;
    b.material(cell);
    b.paint(color);
    const end = rolled ? 0.235 + 0.02 * this.r() : 0.555;
    for (const s of [-1, 1]) buildSleeve(b, s, { lod: this.lod, bulk, cuff, end, roll: rolled ? 0.009 : 0, seed: this.variant * 3 + s, cuffColor, wide });
    if (rolled) this.info.rolled = end;
    this.sleeveCut = { bulk, wide };
  }

  // Canvas patches sewn over the elbows (field reinforcement), on the sleeves as cut.
  elbowPatches({ color, cell = CELL.duck } = {}) {
    if (this.lod > 0 || this.info.rolled) return;
    const b = this.b;
    b.material(cell);
    b.paint(color);
    for (const s of [-1, 1]) buildElbowPatch(b, s, this.sleeveCut || {});
  }

  // ---- collars -----------------------------------------------------------
  // kind: 'stand' (Soviet M43, closed), 'standFall' (German, closed), 'fold'
  // (shirt-style, lying on the shoulders), 'knit' (rolled knit), 'open'
  // (jacket open at the neck over the shirt collar). The neck is ~6.4 cm in
  // radius at the collar (40 cm round); a collar stands ~5 mm off it.
  collarRing(a, y, r) {
    // Collar band ring point: a = 0 at the front, + toward the soldier's right.
    return new THREE.Vector3(Math.sin(a) * r * 1.03, y, 0.021 - Math.cos(a) * r);
  }
  // A frame on the collar's outer face (for collar tabs).
  collarFrame(a, y, out = 0.001) {
    const c = this.collarSpec || { y0: 1.47, y1: 1.51, r0: 0.071, r1: 0.067 };
    const t = (y - c.y0) / (c.y1 - c.y0);
    const r = lerp(c.r0, c.r1, t) + 0.0015 + out;
    const p = this.collarRing(a, y, r);
    const n = V(Math.sin(a), 0.15, -Math.cos(a)).normalize();
    const X = new THREE.Vector3().crossVectors(V(0, 1, 0), n).normalize();
    const Y = new THREE.Vector3().crossVectors(n, X);
    return new Frame(p, new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, n)));
  }
  collar(kind, color, { cell = null, h = 0.04, open = 0, shirt = null } = {}) {
    const b = this.b;
    const lod = this.lod;
    const g = this.g || {};
    if (cell !== null) b.material(cell);
    b.paint(color);
    b.bones(torsoWeights);
    b.part();
    const seg = [24, 12, 7][lod];
    const y0 = 1.468;
    const thetaOf = (a) => Math.atan2(-Math.cos(a), Math.sin(a));
    // Band round the neck from the garment up; gap: half-angle of the front opening.
    const band = (yb0, yb1, r0, r1, gap) => {
      const us = [];
      for (let i = 0; i <= seg; i++) us.push(gap + ((2 * PI - 2 * gap) * i) / seg);
      b.grid(
        us,
        [0, 0.15, 0.85, 1],
        (a, v, o) => {
          const y = lerp(yb0, yb1, v);
          const r = lerp(r0, r1, v) + (v > 0.1 && v < 0.9 ? 0.0015 : 0);
          o.copy(this.collarRing(a, y, r));
        },
        { center: V(0, (yb0 + yb1) / 2, 0.021), wrapU: gap === 0 },
      );
      // Inner face: the top edge has the thickness of the cloth.
      if (lod < 2)
        b.grid(
          us,
          [0, 1],
          (a, v, o) => o.copy(this.collarRing(a, yb1 - 0.012 * v, r1 - 0.004)),
          { center: V(0, yb1, 0.021), flip: true },
        );
    };
    // The fall: folded down from the band's top edge onto the garment.
    const fall = (ytop, rtop, gap, edgeY) => {
      const us = [];
      for (let i = 0; i <= seg; i++) us.push(gap + ((2 * PI - 2 * gap) * i) / seg);
      const tmp = new THREE.Vector3();
      b.part();
      b.grid(
        us,
        [0, 0.35, 1],
        (a, v, o) => {
          const top = this.collarRing(a, ytop + 0.002, rtop + 0.004);
          const ye = edgeY(a);
          garmentPoint(g, thetaOf(a), Math.min(1.5, ye), tmp, 0.004);
          // Lift the middle so the fall rolls over instead of lying flat.
          o.copy(top).lerp(tmp, v);
          o.addScaledVector(V(Math.sin(a), 0, -Math.cos(a)), 0.006 * Math.sin(v * PI));
        },
        { center: V(0, 1.45, 0.02) },
      );
    };
    if (kind === 'stand' || kind === 'standFall') {
      const y1 = y0 + h;
      this.collarSpec = { y0, y1, r0: 0.071, r1: 0.067 };
      band(y0, y1, 0.071, 0.067, 0.045);
      if (kind === 'standFall' && lod === 0) {
        // Worn closed the fall covers the stand, its points down at the front.
        fall(y1, 0.067, 0.07, (a) => y1 - 0.022 - 0.014 * Math.pow(Math.max(0, Math.cos(a)), 4));
      }
    } else if (kind === 'fold' || kind === 'open' || kind === 'knit') {
      const gap = kind === 'open' ? 0.5 + open * 0.3 : kind === 'knit' ? 0.12 : 0.1;
      const y1 = y0 + (kind === 'knit' ? 0.045 : 0.026);
      this.collarSpec = { y0, y1, r0: 0.073, r1: 0.069 };
      band(y0, y1, kind === 'knit' ? 0.08 : 0.073, kind === 'knit' ? 0.074 : 0.069, gap);
      if (lod < 2 && kind !== 'knit') {
        // Collar points reach down the chest; an open collar lies wide as lapels.
        fall(y1, 0.069, gap, (a) => {
          const fr = Math.pow(Math.max(0, Math.cos(a)), 3);
          return 1.47 - 0.035 * fr - open * 0.06 * fr;
        });
      }
      if (kind === 'open' && shirt && lod < 2) {
        // The shirt's collar and front in the V.
        b.paint(shirt);
        b.part();
        band(y0 - 0.004, y0 + 0.03, 0.068, 0.063, 0.12);
        const us = [];
        for (let i = 0; i <= 6; i++) us.push(-0.75 + (1.5 * i) / 6);
        b.grid(us, [1.38, 1.43, 1.47], (a, y, o) => garmentPoint(g, thetaOf(a), y, o, -0.003), { normal: (p) => V(p.x, 0, p.z - 0.02) });
      }
    }
    b.bones(torsoWeights);
  }

  // Height of the top of the shoulder (garment surface) at x, and the point.
  shoulderTop(x, out = new THREE.Vector3(), lift = 0) {
    const g = this.g || {};
    let yBest = 1.505;
    for (let y = 1.505; y >= 1.43; y -= 0.0025) {
      const [, a] = interpRows(TORSO_ROWS, y);
      if (a + garmentOffset(g, 0, y) >= Math.abs(x)) {
        yBest = y;
        break;
      }
    }
    const [, , zf, zb] = interpRows(TORSO_ROWS, yBest);
    return out.set(x, yBest + lift, (zf + zb) / 2);
  }

  // ---- patches on the torso: pockets, flaps, plates ----------------------
  // A pillow-shaped piece of cloth on the garment at (x, y) (x across the front
  // or back), w x h, standing `thick` off with a bulge in the middle.
  // side: -1 front, 1 back. Returns the frame at its center.
  patch(x, y, w, h, { side = -1, thick = 0.003, bulge = 0.004, color = null, cell = null, edge = 0.006, shape = null, tilt = 0, lod = this.lod, castShadow = true } = {}) {
    const b = this.b;
    if (lod === 2) return null;
    if (color !== null) b.paint(color);
    if (cell !== null) b.material(cell);
    b.bones(torsoWeights);
    b.part(castShadow);
    const g = this.g;
    const th0 = torsoTheta(x, y, side);
    // Circumferential scale at y: meters per radian.
    const a = torsoPoint(th0 + 0.01, y, new THREE.Vector3()),
      c = torsoPoint(th0 - 0.01, y, new THREE.Vector3());
    const mpr = a.distanceTo(c) / 0.02;
    const n = lod ? 3 : 7;
    const ss = [],
      ts = [];
    for (let i = 0; i <= n; i++) ss.push(-0.5 + i / n);
    for (let j = 0; j <= n; j++) ts.push(-0.5 + j / n);
    const ct = Math.cos(tilt),
      st = Math.sin(tilt);
    b.grid(
      ss,
      ts,
      (s, t, o) => {
        // Edge profile: the border tucks onto the garment.
        let ex = Math.abs(s) * 2,
          ey = Math.abs(t) * 2;
        let wMul = 1;
        if (shape) wMul = shape(s, t); // e.g. pointed flaps
        const k = Math.max(ex, ey);
        const lift = k >= 0.999 ? -0.001 : thick * smooth01(1, 1 - edge / Math.min(w, h) * 2, k) + bulge * (1 - ex ** 4) * (1 - ey ** 4);
        const sx = s * w * wMul,
          ty = t * h;
        const rx = sx * ct - ty * st,
          ry = sx * st + ty * ct;
        const th = th0 + (side < 0 ? -rx : rx) / mpr;
        garmentPoint(g || {}, th, y + ry, o, lift);
      },
      { normal: (p) => torsoNormal(Math.atan2(p.z - 0.01, p.x), p.y) },
    );
    return torsoFrame(g, th0, y, thick + bulge);
  }

  // A patch pocket with a buttoned flap (German M40 pleated pockets, US M1943
  // jacket, Soviet officer pockets). flapShape: 'straight' | 'scallop' | 'point'.
  pocket(x, y, w, h, { side = -1, color, flapH = 0.045, flapShape = 'straight', button = null, buttonColor = 0x4a4a42, pleat = false, tilt = 0 } = {}) {
    if (this.lod === 2) return;
    this.patch(x, y - h / 2, w, h, { side, thick: 0.003, bulge: 0.005, color, tilt });
    if (pleat && this.lod === 0) this.patch(x, y - h / 2, 0.018, h * 0.96, { side, thick: 0.0055, bulge: 0.002, color, tilt });
    const shape =
      flapShape === 'point'
        ? (s, t) => (t < 0 ? 1 - 0.5 * Math.abs(t * 2) * Math.abs(s * 2) : 1)
        : flapShape === 'scallop'
          ? (s, t) => (t < -0.25 ? 1 - 0.25 * Math.abs(s * 2) ** 3 : 1)
          : null;
    const fy = y - flapH / 2 + 0.004;
    const f = this.patch(x, fy, w + 0.006, flapH, { side, thick: 0.0075, bulge: 0.003, color, shape, tilt });
    if (button && f) {
      const b = this.b;
      b.material(CELL.metal);
      b.paint(buttonColor);
      b.bones(rigidAt(f));
      b.part();
      f.ell(b, 0, -flapH * 0.25 - (flapShape === 'point' ? 0.004 : 0), 0.004, 0.0075, 0.0075, 0.0035, { nu: 8, nv: 3 });
    }
  }

  // Buttons down the front (or anywhere): list of [x, y] at the garment front.
  buttons(list, { color = 0x45443a, r = 0.0075, side = -1, out = 0.004, cell = CELL.metal } = {}) {
    if (this.lod === 2) return;
    const b = this.b;
    b.material(cell);
    b.paint(color);
    for (const [x, y] of list) {
      const th = torsoTheta(x, y, side);
      const f = torsoFrame(this.g, th, y, out, { plumb: false });
      b.bones(rigidAt(f));
      b.part();
      if (this.lod === 1) f.box(b, 0, 0, 0, r * 1.8, r * 1.8, 0.004, { r: 0.0015 });
      else f.ell(b, 0, 0, 0.0005, r, r, r * 0.45, { nu: 7, nv: 2 });
    }
  }

  // Shoulder straps / boards from the collar to the shoulder.
  shoulderStraps({ color, piping = null, w = 0.045, len = 0.12, thick = 0.006, button = 0x55554c, board = false } = {}) {
    if (this.lod === 2) return;
    const b = this.b;
    for (const s of [-1, 1]) {
      // Along the top of the shoulder from the collar seam out to the sleeve.
      // Over the torso's shoulder line, then down onto the sleeve cap.
      const pts = [];
      const xs = 0.072,
        xe = Math.min(0.158, xs + len - 0.02);
      for (let k = 0; k <= 4; k++) pts.push(this.shoulderTop(s * (xs + ((xe - xs) * k) / 4), new THREE.Vector3(), 0.001));
      const last = pts[pts.length - 1];
      pts.push(V(s * (xe + 0.022), last.y - 0.006, last.z - 0.002));
      const up = (p, k) => {
        const a = pts[Math.max(0, k - 1)],
          c = pts[Math.min(pts.length - 1, k + 1)];
        const t = c.clone().sub(a).normalize();
        return V(0, 1, 0).addScaledVector(t, -t.y).normalize();
      };
      b.bones(torsoWeights);
      b.material(board ? CELL.cotton : CELL.wool);
      if (piping) {
        b.paint(piping);
        b.part(false);
        b.strap(pts, w + 0.004, thick * 0.6, up);
      }
      b.paint(color);
      b.part();
      b.strap(pts.map((p) => p.clone().add(V(0, 0.0012, 0))), w, thick, up);
      if (button && this.lod === 0) {
        b.material(CELL.metal);
        b.paint(button);
        const p = pts[0].clone().lerp(pts[1], 0.6).add(V(0, thick + 0.002, 0));
        b.ellipsoid(p, [0.0065, 0.003, 0.0065], { nu: 8, nv: 3 });
      }
    }
  }

  // Flat insignia on a sleeve (patch, chevrons, flag): side, s along the arm,
  // drawn by fn(frame) in the frame of the sleeve's outer face.
  sleeveFrame(side, s, out = 0.054) {
    const P = armChain(side);
    const c = chainPoint(P, s, new THREE.Vector3());
    const n = V(side, 0, 0.0);
    const p = c.clone().addScaledVector(n, out);
    const X = V(0, 0, side), // toward the back on the right sleeve: viewer's right when looking at it
      Y = V(0, 1, 0);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, n));
    return new Frame(p, q);
  }
  sleevePatch(side, s, w, h, color, { cell = CELL.cotton, out = 0.053, shape = 'shield' } = {}) {
    if (this.lod > 0) return null;
    const b = this.b;
    const f = this.sleeveFrame(side, s, out);
    b.bones(armWeights(side));
    b.material(cell);
    b.paint(color);
    b.part(false);
    if (shape === 'round') f.ell(b, 0, 0, 0, w / 2, h / 2, 0.0015, { nu: 12, nv: 3 });
    else f.box(b, 0, 0, 0, w, h, 0.002, { r: shape === 'shield' ? Math.min(w, h) * 0.3 : 0.001 });
    return f;
  }

  // ---- belts and harness -------------------------------------------------
  // A belt band at height y (top edge), h high, on the garment.
  belt(y, h, { color, cell = CELL.leather, thick = 0.005 } = {}) {
    const b = this.b;
    b.material(cell);
    b.paint(color);
    torsoBand(b, this.g, y - h, y, thick, { lod: this.lod, extra: 0.001 });
  }
  // Frame on the belt (theta), facing out; y: top of the belt.
  beltFrame(theta, y, out = 0.006) {
    return torsoFrame({ ...this.g, blouse: 0, flare: 0 }, theta, y, out);
  }
  strap(cps, w, thick, { color, cell = CELL.leather, out = 0.003 } = {}) {
    const b = this.b;
    b.material(cell);
    b.paint(color);
    return torsoStrap(b, this.g, cps, w, thick, { out, lod: this.lod });
  }

  // ---- footwear ----------------------------------------------------------
  // US M1938 canvas leggings over service shoes: laced up the outside with
  // hooks, a strap under the instep. Top at ~25 cm over the ankle.
  leggings({ color, hooks = 0x3a3528 } = {}) {
    const b = this.b;
    b.material(CELL.duck);
    b.paint(color);
    for (const s of [-1, 1]) buildLegWrap(b, s, 0.53, 0.8, [0.058, 0.064], [0.05, 0.056], { lod: this.lod, flareTop: 0.004, rim: 0.002 });
    if (this.lod > 0) return;
    b.material(CELL.metal);
    b.paint(hooks);
    for (const s of [-1, 1]) {
      b.bones(s < 0 ? B.shinL : B.shinR);
      const P = legChain(s);
      for (let i = 0; i < 7; i++) {
        const sv = 0.56 + i * 0.036;
        const c = chainPoint(P, sv, new THREE.Vector3());
        const t = (sv - 0.53) / 0.27;
        const r = lerp(0.063, 0.054, t) + 0.002;
        // Hooks along a line on the outside, a little to the front.
        b.ellipsoid([c.x + s * r * 0.93, c.y, c.z + 0.004 - r * 0.32], [0.0035, 0.0035, 0.0035], { nu: 4, nv: 2 });
      }
      // The lace zig-zag: dark cord.
      b.material(CELL.duck);
      b.paint(0x4a4232);
      const pts = [];
      for (let i = 0; i < 15; i++) {
        const sv = 0.56 + i * 0.016;
        const c = chainPoint(P, sv, new THREE.Vector3());
        const t = (sv - 0.53) / 0.27;
        const r = lerp(0.064, 0.055, t) + 0.0025;
        const off = i % 2 ? 0.006 : -0.006;
        pts.push(V(c.x + s * r * 0.94, c.y, c.z + 0.004 - r * 0.32 + off));
      }
      b.part(false);
      b.strap(pts, 0.003, 0.0015, () => V(s, 0, -0.3).normalize(), { flat: true });
      b.material(CELL.metal);
      b.paint(hooks);
    }
  }

  // Tall leather boots: shaft from s0 (top) to the ankle, accordion folds.
  // Tall boots: the shaft runs down into the foot (rounded in at the ankle);
  // laces: rows of lacing up the front (jump boots), toeCap: a stitched cap.
  tallBoots({ color, sole, s0 = 0.47, gloss = 0.25, folds = 1, cell = CELL.leather, r0 = [0.065, 0.072], laces = 0, laceColor = null, toeCap = false } = {}) {
    const b = this.b;
    for (const s of [-1, 1]) {
      b.material(cell, gloss);
      b.paint(color);
      buildLegWrap(b, s, s0, 0.81, r0, [0.049, 0.054], { lod: this.lod, flareTop: 0.005, folds, seed: this.variant * 3 + s, laces, laceColor, capEnd: 0.5 });
      buildBoot(b, s, { lod: this.lod, upper: color, sole, high: 0.16, cell, gloss, laces: false, toeCap, seed: this.variant + s });
    }
    b.material(CELL.wool, 0);
  }
  shoes({ color, sole, high = 0.13, suede = false, toeCap = false, gloss = 0, laces = true } = {}) {
    for (const s of [-1, 1]) buildBoot(this.b, s, { lod: this.lod, upper: color, sole, high, suede, toeCap, gloss, laces, seed: this.variant + s });
    this.b.material(CELL.wool, 0);
  }
  // Short canvas gaiters (German M43 Gamaschen) with two leather straps.
  gaiters({ color, strap }) {
    const b = this.b;
    b.material(CELL.duck);
    b.paint(color);
    for (const s of [-1, 1]) buildLegWrap(b, s, 0.69, 0.8, [0.052, 0.058], [0.05, 0.055], { lod: this.lod, flareTop: 0.003, rim: 0.002 });
    if (this.lod) return;
    for (const s of [-1, 1]) {
      const P = legChain(s);
      b.bones(s < 0 ? B.shinL : B.shinR);
      for (const sv of [0.715, 0.765]) {
        const c = chainPoint(P, sv, new THREE.Vector3());
        b.material(CELL.leather);
        b.paint(strap);
        b.part();
        b.tube(
          [
            { c: c.clone().add(V(0, 0.008, 0.004)), rx: 0.0565, rz: 0.0625 },
            { c: c.clone().add(V(0, -0.008, 0.004)), rx: 0.0565, rz: 0.0625 },
          ],
          { seg: 16 },
        );
        b.material(CELL.metal);
        b.paint(0x55554c);
        b.box(V(c.x + s * 0.055, c.y, c.z - 0.01), [0.004, 0.018, 0.016], { r: 0.0015 });
      }
    }
  }
  puttees({ color }) {
    const b = this.b;
    b.material(CELL.wool);
    b.paint(color);
    for (const s of [-1, 1]) buildPuttee(b, s, 0.53, 0.8, { lod: this.lod });
  }

  // ---- finishing ---------------------------------------------------------
  // Field wear: dust and mud from the ground up, dirty knees and elbows, the
  // seat and front from lying prone, faded shoulders; leather scuffed.
  weather(level = 0.5, { mud = new THREE.Color(0.2, 0.16, 0.11), dust = new THREE.Color(0.42, 0.38, 0.3) } = {}) {
    const b = this.b;
    const c2 = new THREE.Color();
    const seed = this.variant * 3.7;
    b.recolor((x, y, z, nx, ny, nz, col, cell) => {
      if (cell === CELL.skin || cell === CELL.hair || cell === CELL.metal) return;
      const n = noise3(x * 40 + seed, y * 40, z * 40);
      const n2 = noise3(x * 9, y * 9 + seed, z * 9);
      // Mud and dust from the ground up (boots, leggings, trouser bottoms).
      const low = 1 - smooth01(0.02, 0.45, y + (n2 - 0.5) * 0.1);
      let m = low * (0.35 + 0.65 * level);
      // Knees (from kneeling) and the front of the thighs and jacket (from lying prone).
      const knee = Math.exp(-(((y - 0.5) / 0.07) ** 2)) * (z < 0.0 ? 1 : 0.3);
      m += knee * 0.45 * level;
      if (nz < -0.3 && y < 1.4) m += 0.12 * level * (0.5 + n2);
      // Elbows.
      const elbow = Math.exp(-(((y - 1.12) / 0.06) ** 2)) * (Math.abs(x) > 0.16 ? 1 : 0);
      m += elbow * 0.3 * level;
      m = Math.min(0.85, m * (0.7 + 0.6 * n));
      if (m > 0) {
        // Mud only round the soles; dry dust above (Normandy, June-August).
        c2.copy(y < 0.06 ? mud : dust);
        // (A linear-space blend: a little dust already greys black leather.)
        col.lerp(c2, m * (cell === CELL.leather ? 0.14 : cell === CELL.suede ? 0.28 : 0.55));
      }
      // Sun-faded shoulders and back; darker sweat under the arms.
      if (cell !== CELL.leather && cell !== CELL.paint) {
        if (y > 1.3 && ny > 0.3) col.multiplyScalar(1 + 0.08 * level);
        const pit = Math.exp(-(((y - 1.3) / 0.05) ** 2)) * (Math.abs(x) > 0.13 && Math.abs(x) < 0.2 ? 1 : 0);
        col.multiplyScalar(1 - 0.12 * pit * level);
      }
      // Dusty helmet tops.
      if (cell === CELL.paint && y > 1.7 && ny > 0.4) col.lerp(dust, 0.18 * level * (0.5 + n2));
    });
  }

  finish() {
    if (this.lod < 2) this.b.bakeContact(this.lod ? 0.05 : 0.028, this.lod ? 0.4 : 0.55);
    return { b: this.b, info: this.info };
  }
}

// ---------------------------------------------------------------------------
// Outfit registry: each army module adds { cls: { variants, build(o) } }.
export const OUTFITS = {};
export function registerOutfits(faction, table) {
  OUTFITS[faction] = table;
}
export function variantCount(faction, cls) {
  const t = OUTFITS[faction] || OUTFITS.US;
  return (t[cls] || t.infantry).variants;
}

// Build an outfit. role: the primary weapon's kind ('rifle' | 'smg' | 'mg' |
// 'at'), for the ammunition pouches.
export function buildOutfit(faction, cls = 'infantry', variant = 0, lod = 0, role = 'rifle') {
  const t = OUTFITS[faction] || OUTFITS.US;
  const def = t[cls] || t.infantry;
  const v = variant % def.variants;
  const rng = mulberry(hashStr(`${faction}|${cls}|${v}`));
  const o = new Outfit(faction, cls, v, lod, role, rng);
  def.build(o);
  return o.finish();
}

// ---------------------------------------------------------------------------
// The person under the uniform: face and hands, varied by a seeded RNG.
// Skin tones (sRGB) from fair to dark; weights per army for the men who fought
// in Normandy and on the Eastern Front in 1944 (est.).
const SKIN = [0xe8c4ab, 0xdcae92, 0xd0a184, 0xbe8d6e, 0xa8765a, 0x8e6047, 0x6e4835, 0x553628];
const SKIN_WEIGHTS = {
  US: [3, 4.5, 4, 2.5, 1.2, 0.4, 0.15, 0.05],
  GE: [3.5, 4.5, 3.5, 1.6, 0.4, 0.05, 0, 0],
  SU: [3, 4, 3.5, 2.5, 1.4, 0.5, 0.05, 0],
};
const HAIR = [0x2a1e16, 0x3a2a1e, 0x16120f, 0x5e4a33, 0x84693f, 0x5e3320, 0x9a7a4a, 0x4a3a2a];
const EYES = [0x4a3424, 0x3e5262, 0x56643e, 0x2a1e16, 0x5a6a78, 0x6a5a3a];

function pickWeighted(rng, w) {
  let sum = 0;
  for (const x of w) sum += x;
  let r = rng() * sum;
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r <= 0) return i;
  }
  return w.length - 1;
}

export function personParams(faction, rng) {
  const tone = pickWeighted(rng, SKIN_WEIGHTS[faction] || SKIN_WEIGHTS.US);
  const dark = tone >= 5;
  // Soviet soldiers from Central Asia and the Far East (est. one in eight).
  const asian = faction === 'SU' && rng() < 0.13;
  let hairI = dark || asian ? (rng() < 0.75 ? 2 : 0) : pickWeighted(rng, [3, 3, 1.5, 2, 1.2, 0.6, 0.6, 2]);
  const r = () => rng();
  const skin = new THREE.Color(SKIN[asian ? Math.max(1, Math.min(4, tone + 1)) : tone]);
  // Small random warmth shift, and a summer in the field: tanned and weathered.
  skin.offsetHSL((r() - 0.5) * 0.015, (r() - 0.5) * 0.08, (r() - 0.5) * 0.03);
  skin.lerp(new THREE.Color(0x9a6a4c), 0.12 + 0.12 * r()).multiplyScalar(0.94);
  const hair = new THREE.Color(HAIR[hairI]).multiplyScalar(0.85 + 0.3 * r());
  const eyeI = dark || asian ? 3 : pickWeighted(rng, [3, 2.5, 1.2, 1.5, 1.2, 0.8]);
  return {
    tone,
    asian,
    skin,
    hair,
    brows: hair.clone().multiplyScalar(0.75),
    lips: skin.clone().lerp(new THREE.Color(0x9a4e44), dark ? 0.22 : 0.42),
    eyeColor: new THREE.Color(EYES[eyeI]),
    stubble: r() < 0.7 ? 0.25 + 0.75 * r() : 0.05 * r(),
    ruddy: 0.5 + r() * (dark ? 0.3 : 1.0),
    dirt: r() < 0.6 ? r() * 0.8 : 0,
    recede: r() < 0.2 ? r() : 0,
    sides: 0.55 + r() * 0.4,
    hairTop: 0.006 + r() * 0.012,
    shape: {
      jaw: 0.93 + r() * 0.14,
      chin: 0.95 + r() * 0.12,
      width: (asian ? 1.03 : 0.97) + r() * 0.06,
      nose: 0.85 + r() * 0.3,
      noseW: (asian ? 1.08 : 0.9) + r() * 0.22,
      noseBridge: asian ? 0.15 + r() * 0.3 : 0.75 + r() * 0.35,
      noseHook: r() < 0.25 ? r() : r() < 0.2 ? -r() : 0,
      brow: (asian ? 0.6 : 0.8) + r() * 0.45,
      cheek: (asian ? 1.25 : 0.8) + r() * 0.4,
      cheekY: (r() - 0.5) * 0.008,
      lips: 0.75 + r() * 0.45,
      eyeSize: 0.92 + r() * 0.14,
      eyeSpace: 0.96 + r() * 0.08,
      lid: asian ? 0.7 + r() * 0.3 : r() * 0.2,
      lidOpen: 0.9 + r() * 0.15,
      length: 0.95 + r() * 0.1,
      forehead: 0.9 + r() * 0.25,
      earSize: 0.92 + r() * 0.16,
      earOut: 0.6 + r() * 0.9,
      skull: 0.96 + r() * 0.07,
      gaunt: r() * 0.8,
    },
  };
}

// The person: head, neck, hands (and forearms for rolled sleeves). info: the
// outfit's info (headgear, rolled sleeves, gloves).
export function buildPerson(params, lod = 0, info = {}) {
  const skin = new SkinBuilder(1);
  skin.lowPoly = lod === 2;
  skin.lod = lod;
  const helmet = info.headgear === 'helmet' || info.headgear === 'tank';
  buildHead(skin, params, { lod, helmet, cap: info.headgear === 'cap' });
  buildNeck(skin, { lod, skin: params.skin });
  for (const s of [-1, 1]) buildHand(skin, s, { lod, skin: params.skin, glove: info.gloves, dirt: params.dirt });
  if (info.rolled) for (const s of [-1, 1]) buildForearm(skin, s, { lod, skin: params.skin, from: info.rolled - 0.03 });
  return skin;
}

// Helpers shared by the army modules.
export { CELL, CAMO_GREY, torsoTheta, torsoPoint, torsoNormal, garmentPoint, garmentOffset, chainPoint, armChain, legChain, interpRows, frontness, backness, hash1, lerp, smooth01, torsoWeights, armWeights, legWeights, rigid, weightsAt, B, BIND, HEAD_CENTER, Frame, torsoFrame, rigidAt, pouch, buckle, starDecal };
