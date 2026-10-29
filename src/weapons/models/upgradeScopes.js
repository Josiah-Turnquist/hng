// Scope upgrades: an ordinary rifle with a scope bought for it, as the original
// game sold them. Each model is the rifle's own model, then a mount, then the
// scope (optics.js), registered in MODELS as `${rifle}+${family}`. Where the
// pair was really issued it sits in its wartime mount (the same as the sniper
// rifle of us.js, german.js or soviet.js); where the pairing was the game's
// own, in a period mount that fits the rifle. Bolt actions with a scope over
// the action get the sniper's bent bolt handle, as the real conversions did.
// Same conventions as kit.js.
//
// Scope families: m84 (US M84 2.2x), m73b1 (Weaver 330C 2.75x), unertl (Unertl
// 8x), zf39 (Zeiss Zielvier 4x), zf4 (ZF 4 4x), zf41 (ZF 41 1.5x), zielacht
// (Zeiss Zielacht 8x), pu (PU 3.5x), pe (PE / PEM 4x).
//
// SCOPE_MOUNTS says what the mount does to the rifle:
//   clipsBlocked  the scope covers the clip guide or the en-bloc opening, so
//                 the rifle is loaded a round at a time (never on a rifle fed
//                 from a detachable magazine)
//   irons         the iron sights can still be used, beside or under the scope
//   mountMass     the mount's weight (kg, est.; with the cheek pad on the
//                 Garand)
import { m1_garand, m1_carbine, m1a1_carbine, m2_carbine, m1903 } from './us.js';
import { kar98k, gewehr43, fg42_zfg42, stg44 } from './german.js';
import { mosin_9130, svt40, avs36 } from './soviet.js';
import { m84, weaver330, zf4, zf41, zielacht, pem, SIDE_FIT, M1C_SCOPES, sideMount, m1cMount, redfieldMount, unertlMount, turretMount, railMount, zf41Mount, tunnelRings, puMount, pemMount, svtBracket } from './optics.js';

// Each family's magnification.
const MAG = { m84: 2.2, m73b1: 2.75, unertl: 7.8, zf39: 4, zf4: 4, zf41: 1.5, zielacht: 8, pu: 3.5, pe: 4 };

// The rifle's model with a mount and its scope on it.
const on = (rifle, mount) => (b) => {
  rifle(b);
  b.body();
  mount(b);
};

// The scopes on the carbines' side mount: the rings on the tube clear of the
// eyepiece and the turret.
const CARBINE_SCOPES = {
  m73b1: { body: weaver330, r: 0.0096, zEye: 0.01 },
  m84: { body: m84, r: 0.011, zEye: 0.038 },
};

const FITS = {
  // M1 Garand: the M1C's Griffin & Howe side mount and cheek pad (the M84 was
  // the M1C's scope from 1945; G&H made rings for the Weaver too), the scope
  // to the left: clips go in from the top and the iron sights stay clear.
  'm1_garand+m73b1': { model: on(m1_garand, (b) => m1cMount(b, SIDE_FIT.garand, M1C_SCOPES.m73b1)), clipsBlocked: false, irons: true, mountMass: 0.3 },
  'm1_garand+m84': { model: on(m1_garand, (b) => m1cMount(b, SIDE_FIT.garand, M1C_SCOPES.m84)), clipsBlocked: false, irons: true, mountMass: 0.3 },
  // Springfield M1903: the A4's Redfield Junior base and rings over the action
  // (7/8 in rings for the M84, as on the A4s refitted after the war), or the
  // Marine Corps' Unertl blocks. The scope covers the clip guide and the line
  // of the iron sights.
  'm1903+m73b1': { model: on((b) => m1903(b, { bent: true }), (b) => redfieldMount(b)), clipsBlocked: true, irons: false, mountMass: 0.12 },
  'm1903+m84': { model: on((b) => m1903(b, { bent: true }), (b) => redfieldMount(b, { scope: m84, r: 0.011, yc: 0.046, zEye: 0.01 })), clipsBlocked: true, irons: false, mountMass: 0.12 },
  'm1903+unertl': { model: on((b) => m1903(b, { bent: true }), (b) => unertlMount(b)), clipsBlocked: true, irons: false, mountMass: 0.1 },
  // Kar 98k: the ZF 39's high turret mount (the Zielacht in the same 26 mm
  // rings), the ZF 41 on its rail ahead of the action, or the ZF 4 on a side
  // rail screwed to the left of the receiver, as on the late war side mounts.
  // Over the action they cover the clip guide; the iron sights show under them.
  'kar98k+zf39': { model: on(kar98k, (b) => turretMount(b)), clipsBlocked: true, irons: true, mountMass: 0.25 },
  'kar98k+zf4': { model: on(kar98k, (b) => railMount(b, { side: -1, face: 0.0205, base: 0.0163, clamp: [-0.194, -0.106], rings: [-0.183, -0.145], yc: 0.0525, r: 0.013, scope: zf4, zEye: 0.01 })), clipsBlocked: true, irons: true, mountMass: 0.25 },
  'kar98k+zf41': { model: on(kar98k, (b) => zf41Mount(b)), clipsBlocked: false, irons: true, mountMass: 0.08 },
  'kar98k+zielacht': { model: on(kar98k, (b) => turretMount(b, { scope: zielacht, zEye: 0.0375 })), clipsBlocked: true, irons: true, mountMass: 0.25 },
  // Gewehr 43: the clamp mount on its own rail; the ZF 41 sits forward, over
  // the rear sight, at its long eye relief. The saddles cover the line of the
  // iron sights beyond the lowest settings.
  'gewehr43+zf4': { model: on(gewehr43, (b) => railMount(b, { face: 0.0201, clamp: [-0.236, -0.124], rings: [-0.19, -0.13], yc: 0.0625, r: 0.013, scope: zf4, zEye: -0.03 })), clipsBlocked: false, irons: false, mountMass: 0.25 },
  'gewehr43+zf41': { model: on(gewehr43, (b) => railMount(b, { face: 0.0201, clamp: [-0.244, -0.124], rings: [-0.235, -0.19], yc: 0.0625, r: 0.0098, t: 0.0026, w: 0.013, scope: zf41, zEye: -0.14 })), clipsBlocked: false, irons: false, mountMass: 0.2 },
  // FG 42: the ZFG 42's rings on the receiver rail, the iron sights folded.
  'fg42+zf4': { model: fg42_zfg42, clipsBlocked: false, irons: false, mountMass: 0.15 },
  // StG 44: the ZF 4 in a clamp mount on a rail on the right of the receiver
  // behind the ejection port (as on the MP 43/1), or the ZF 41 in rings on
  // see-through bases on the receiver's top, ahead of the eye at its long eye
  // relief, the iron sights clear under it.
  'stg44+zf4': { model: on(stg44, (b) => railMount(b, { face: 0.0196, base: 0.0156, clamp: [-0.088, 0.024], rings: [-0.075, 0.01], yc: 0.06, r: 0.013, scope: zf4, zEye: 0.1 })), clipsBlocked: false, irons: false, mountMass: 0.25 },
  'stg44+zf41': { model: on(stg44, (b) => tunnelRings(b, { zs: [-0.16, -0.11], yBase: 0.031, yc: 0.062, r: 0.0098, scope: zf41, zEye: -0.06 })), clipsBlocked: false, irons: true, mountMass: 0.1 },
  // Mosin-Nagant: the PU and PEM side mounts on the left of the receiver (the
  // Zielacht in 26 mm rings on the PEM's), the bent handle, the scope over the
  // clip guide.
  'mosin_9130+pe': { model: on((b) => mosin_9130(b, { bent: true }), (b) => pemMount(b)), clipsBlocked: true, irons: false, mountMass: 0.35 },
  'mosin_9130+pu': { model: on((b) => mosin_9130(b, { bent: true }), (b) => puMount(b)), clipsBlocked: true, irons: false, mountMass: 0.33 },
  'mosin_9130+zielacht': { model: on((b) => mosin_9130(b, { bent: true }), (b) => pemMount(b, { scope: zielacht, r: 0.013, yc: 0.056, zEye: 0.01 })), clipsBlocked: true, irons: false, mountMass: 0.35 },
  // SVT-40 and AVS-36: the SVT's bracket on the rear of the receiver, high and
  // open underneath.
  'svt40+pe': { model: on(svt40, (b) => svtBracket(b, { scope: pem, zEye: 0.045 })), clipsBlocked: false, irons: true, mountMass: 0.3 },
  'svt40+pu': { model: on(svt40, (b) => svtBracket(b)), clipsBlocked: false, irons: true, mountMass: 0.3 },
  'avs36+pe': { model: on(avs36, (b) => svtBracket(b, { half: 0.0181, scope: pem, zEye: 0.045 })), clipsBlocked: false, irons: true, mountMass: 0.3 },
  'avs36+pu': { model: on(avs36, (b) => svtBracket(b, { half: 0.0181 })), clipsBlocked: false, irons: true, mountMass: 0.3 },
};

// The carbines: a Griffin & Howe type base on the left of the receiver, the
// scope to the left clear of the rear sight and the cases going out at the top.
for (const [id, rifle] of Object.entries({ m1_carbine, m1a1_carbine, m2_carbine })) {
  for (const family of ['m73b1', 'm84']) FITS[`${id}+${family}`] = { model: on(rifle, (b) => sideMount(b, SIDE_FIT.carbine, CARBINE_SCOPES[family])), clipsBlocked: false, irons: true, mountMass: 0.2 };
}

// The models for MODELS (id -> builder(b)), and what each mount does.
export const UPGRADE_MODELS = {};
export const SCOPE_MOUNTS = {};
for (const [id, f] of Object.entries(FITS)) {
  const mag = MAG[id.split('+')[1]];
  UPGRADE_MODELS[id] = (b) => {
    f.model(b);
    b.meta.sight = 'scope';
    b.meta.scopeMag = mag;
  };
  SCOPE_MOUNTS[id] = { clipsBlocked: f.clipsBlocked, irons: f.irons, mountMass: f.mountMass };
}
