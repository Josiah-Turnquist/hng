// Telescopic sights that the armies of 1939 to 1945 really put on their rifles,
// and what each one did to the rifle. Sources are in docs/research/weapons.md,
// section 9; values marked "est." were not found there and are estimates.
//
//   SCOPES    the scopes: magnification, true field of view, eye relief (how
//             far behind the eyepiece the eye sees the whole picture), reticle,
//             the range settings of the elevation drum, weight, and the rifles
//             each was issued on. No other rifle may take it.
//   FITTINGS  one scope on one rifle in the mount it was issued in, and what
//             that changed: whether clips can still be pushed in (a scope over
//             the action covers the clip guide, so the rifle is loaded a round
//             at a time), whether the iron sights can still be used, the weight
//             of the mount, and any change the sniper version needed.
//
// defs.js makes a weapon of every fitting (WEAPONS[id]), so a loadout names it
// like any other gun. The three scoped rifles of earlier versions keep their
// ids (m1903a4, kar98k_zf39, mosin_pu), so saved loadouts that name them load.

// Range settings from..to in steps.
const steps = (from, to, step) => {
  const out = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(v);
  return out;
};

// Reticles (drawn by hud.js): crosshair (fine), crosshairMedium (thicker
// wires), post (tapered post from below), german1 (pointed post and two thick
// side bars, "Absehen 1"), germanPost (pointed post alone), soviet (pointed post
// and thin tapered side bars).
//
// drum: the range settings, in the army's unit. US scopes have no range drum,
// only an elevation knob in minutes of angle; the game sets them by range in
// yards, as the sniper did from his range table.
export const SCOPES = {
  weaver330: {
    name: 'Weaver 330 (M73B1)',
    army: 'US',
    mag: 2.75,
    fieldDeg: 6.7, // 35 ft at 100 yd
    eyeRelief: 0.089, // 3.5 in
    reticle: 'crosshair',
    mass: 0.29, // 10.25 oz
    length: 0.267,
    drum: { unit: 'yd', from: 100, to: 800, step: 50, zero: 200 },
    rifles: ['m1903'],
  },
  unertl8: {
    name: 'Unertl 8x (USMC)',
    army: 'US',
    mag: 7.8, // marked 8x
    fieldDeg: 2.2, // est.
    eyeRelief: 0.06, // est.
    reticle: 'crosshairMedium',
    mass: 0.7, // est.
    length: 0.56, // est.
    drum: { unit: 'yd', from: 100, to: 1000, step: 50, zero: 200 },
    rifles: ['m1903'],
  },
  m81: {
    name: 'M81 (Lyman Alaskan)',
    army: 'US',
    mag: 2.5,
    fieldDeg: 6.7, // 35 ft at 100 yd
    eyeRelief: 0.127, // about 5 in
    reticle: 'crosshair',
    mass: 0.26, // 8 oz, and the sunshade and eyeshield (est.)
    length: 0.267,
    drum: { unit: 'yd', from: 100, to: 800, step: 50, zero: 200 },
    rifles: ['m1_garand'],
  },
  m82: {
    name: 'M82 (Lyman Alaskan)',
    army: 'US',
    mag: 2.5,
    fieldDeg: 6.7,
    eyeRelief: 0.127,
    reticle: 'post',
    mass: 0.26,
    length: 0.267,
    drum: { unit: 'yd', from: 100, to: 800, step: 50, zero: 200 },
    rifles: ['m1_garand'],
  },
  zf39: {
    name: 'Zeiss Zielvier 4x (ZF 39)',
    army: 'GE',
    mag: 4,
    fieldDeg: 6, // est.
    eyeRelief: 0.085, // est.
    reticle: 'german1',
    mass: 0.45, // est.
    length: 0.266,
    drum: { unit: 'm', from: 100, to: 800, step: 50, zero: 200 },
    rifles: ['kar98k'],
  },
  zf41: {
    name: 'ZF 41 (1.5x)',
    army: 'GE',
    mag: 1.5,
    fieldDeg: 7, // est. (a narrow field: the sources give no figure)
    eyeRelief: 0.3, // est. (over 12 in)
    reticle: 'germanPost',
    mass: 0.2, // est.
    length: 0.13,
    drum: { unit: 'm', from: 100, to: 800, step: 100, zero: 200 },
    rifles: ['kar98k'],
  },
  zf4: {
    name: 'ZF 4 (4x)',
    army: 'GE',
    mag: 4,
    fieldDeg: 6, // est.
    eyeRelief: 0.085, // est.
    reticle: 'german1',
    mass: 0.4, // est.
    length: 0.265,
    drum: { unit: 'm', from: 100, to: 800, step: 50, zero: 200 },
    rifles: ['gewehr43'],
  },
  zfg42: {
    name: 'ZFG 42 (4x)',
    army: 'GE',
    mag: 4,
    fieldDeg: 6, // est.
    eyeRelief: 0.085, // est.
    reticle: 'german1',
    mass: 0.4, // est.
    length: 0.265,
    drum: { unit: 'm', from: 100, to: 800, step: 50, zero: 200 },
    rifles: ['fg42'],
  },
  pu: {
    name: 'PU (3.5x)',
    army: 'SU',
    mag: 3.5,
    fieldDeg: 4.5, // 4 deg 30 min
    eyeRelief: 0.072,
    reticle: 'soviet',
    mass: 0.27,
    length: 0.169,
    drum: { unit: 'm', from: 100, to: 1300, step: 100, zero: 200 },
    rifles: ['mosin_9130', 'svt40'],
  },
  pem: {
    name: 'PEM (4x)',
    army: 'SU',
    mag: 4,
    fieldDeg: 5.5, // est.
    eyeRelief: 0.085, // est.
    reticle: 'soviet',
    mass: 0.6, // est.
    length: 0.28,
    drum: { unit: 'm', from: 100, to: 1400, step: 100, zero: 200 },
    rifles: ['mosin_9130'],
  },
};

// clips: 'blocked' (the scope covers the clip guide: one round at a time),
// 'free' (clips load as before) or 'magazine' (a detachable magazine, which the
// scope does not change). irons: the iron sights can still be used. mountMass:
// the mount (kg). handling: the original game's numbers for its three scoped
// rifles (bolt work, reloads, accuracy), kept as they were; a new bolt-action
// fitting with its scope over the action follows them. accuracy: rifles picked
// for accuracy when they were made into sniper rifles. scopeReturn: seconds to
// pull a target scope back into place after each shot. note: one line for the
// loadout screen.
export const FITTINGS = {
  m1903a4: {
    rifle: 'm1903',
    scope: 'weaver330',
    name: 'M1903A4 (2.75x)',
    mount: 'Redfield Junior base and rings over the action',
    clips: 'blocked',
    irons: false,
    mountMass: 0.12, // est.
    changes: ['Built from the M1903A3 with no iron sights at all', 'Bolt handle bent down and cut back to clear the scope', 'C-type pistol grip stock'],
    classes: ['recon'],
    handling: { bolt: { cycle: 1.4 }, reload: { boltOpen: 0.45, clip: 2.4, round: 0.75, boltClose: 0.5 }, accuracy: 1.8 },
    note: 'Loads one round at a time: the scope sits over the action. No iron sights.',
    info: 'The Army sniper Springfield of 1943: a Weaver scope over the action, so it is loaded one round at a time, and no iron sights.',
  },
  m1903a1_unertl: {
    rifle: 'm1903',
    scope: 'unertl8',
    name: 'M1903A1 Unertl (8x)',
    mount: 'Unertl target blocks on the receiver ring and the barrel, 7.2 in apart',
    clips: 'blocked',
    irons: false,
    mountMass: 0.1, // est.
    changes: ['C-type pistol grip stock (M1903A1)', 'Scope blocks dovetailed onto the receiver ring and the barrel'],
    classes: ['recon'],
    handling: { bolt: { cycle: 1.4 }, reload: { boltOpen: 0.45, clip: 2.4, round: 0.75, boltClose: 0.5 }, accuracy: 1.5 },
    scopeReturn: 0.5, // est.
    note: 'Loads one round at a time, and the scope slides forward with each shot: pulling it back takes a moment.',
    info: 'The Marine Corps sniper rifle: a long 8x target scope with no return spring, so it is pulled back by hand after every shot.',
  },
  m1c_m81: {
    rifle: 'm1_garand',
    scope: 'm81',
    name: 'M1C, M81 (2.5x)',
    mount: 'Griffin & Howe side mount, the scope offset to the left',
    clips: 'free',
    irons: true,
    mountMass: 0.3, // est., with the cheek pad
    changes: ['Mount base screwed and pinned to the left of the receiver', 'Leather cheek pad laced to the stock'],
    classes: ['recon'],
    accuracy: 2.5, // est.: rifles that failed the accuracy test were turned down
    note: 'Offset to the left: clips still load from the top and the iron sights stay usable. Crosshair.',
    info: 'Sniper Garand adopted in 1944. The scope sits to the left, so the en-bloc clip still goes in from the top and the iron sights can still be used.',
  },
  m1c_m82: {
    rifle: 'm1_garand',
    scope: 'm82',
    name: 'M1C, M82 (2.5x)',
    mount: 'Griffin & Howe side mount, the scope offset to the left',
    clips: 'free',
    irons: true,
    mountMass: 0.3, // est., with the cheek pad
    changes: ['Mount base screwed and pinned to the left of the receiver', 'Leather cheek pad laced to the stock'],
    classes: ['recon'],
    accuracy: 2.5, // est.
    note: 'Offset to the left: clips still load from the top and the iron sights stay usable. Tapered post.',
    info: 'Sniper Garand with the M82, the M81 with a post in place of the crosshair. Clips load from the top; the iron sights stay usable.',
  },
  kar98k_zf39: {
    rifle: 'kar98k',
    scope: 'zf39',
    name: 'Kar 98k ZF 39 (4x)',
    mount: 'High turret mount: turret base on the receiver ring, rear base on the bridge',
    clips: 'blocked',
    irons: true,
    mountMass: 0.25, // est.
    changes: ['Rifle picked for accuracy', 'Mount bases fitted to the receiver ring and the bridge'],
    classes: ['recon'],
    handling: { bolt: { cycle: 1.45 }, reload: { boltOpen: 0.5, clip: 2.6, round: 0.75, boltClose: 0.55 }, accuracy: 2 },
    note: 'Loads one round at a time: the scope sits over the action. The iron sights show through a gap under it.',
    info: 'Kar 98k with a 4x scope on the high turret mount. It covers the clip guide, so it is loaded round by round; the iron sights can be used under it.',
  },
  kar98k_zf41: {
    rifle: 'kar98k',
    scope: 'zf41',
    name: 'Kar 98k ZF 41 (1.5x)',
    mount: 'ZF 41 rail on the left of the rear sight base, ahead of the action',
    clips: 'free',
    irons: true,
    mountMass: 0.08, // est.
    changes: ['Rear sight base with a rail on its left side'],
    classes: ['infantry', 'recon'],
    accuracy: 2.5, // est.
    note: 'Small 1.5x scope ahead of the action: clips still load and the iron sights stay usable. Long eye relief.',
    info: "A marksman's rifle for ordinary infantry: a small 1.5x scope well forward, so stripper clips still go in and the iron sights still work.",
  },
  gewehr43_zf4: {
    rifle: 'gewehr43',
    scope: 'zf4',
    name: 'Gewehr 43 ZF 4 (4x)',
    mount: 'Clamp mount on the dovetail rail on the right of the receiver',
    clips: 'magazine',
    irons: false,
    mountMass: 0.25, // est.
    changes: [],
    classes: ['recon'],
    note: '4x scope over the receiver: magazines load as before, but the iron sights are covered.',
    info: 'Gewehr 43 with the ZF 4 on the rail every one of them had. It reloads with magazines as before.',
  },
  fg42_zfg42: {
    rifle: 'fg42',
    scope: 'zfg42',
    name: 'FG 42 ZFG 42 (4x)',
    mount: 'Clamp rings on the rail on top of the receiver',
    clips: 'magazine',
    irons: false,
    mountMass: 0.15, // est.
    changes: ['Front and rear sights folded down under the scope'],
    classes: ['paratrooper'],
    note: '4x scope on top of the receiver: the side magazine loads as before; the iron sights fold down under it.',
    info: "A paratrooper marksman's FG 42 with a 4x scope on its receiver rail. The folding sights lie flat under it.",
  },
  mosin_pu: {
    rifle: 'mosin_9130',
    scope: 'pu',
    name: 'Mosin-Nagant PU (3.5x)',
    mount: 'Side mount: base on the left of the receiver, two rings over the action',
    clips: 'blocked',
    irons: false,
    mountMass: 0.33, // est.
    changes: ['Bolt handle lengthened and bent down to clear the scope'],
    classes: ['recon'],
    handling: { bolt: { cycle: 1.5 }, reload: { boltOpen: 0.5, clip: 2.6, round: 0.75, boltClose: 0.55 }, accuracy: 2 },
    note: 'Loads one round at a time: the scope sits over the action. Bent bolt handle.',
    info: 'The Red Army sniper rifle from 1942: the light 3.5x PU on a side mount, a bent-down bolt handle, loaded round by round.',
  },
  mosin_pem: {
    rifle: 'mosin_9130',
    scope: 'pem',
    name: 'Mosin-Nagant PEM (4x)',
    mount: 'PEM side mount on the left of the receiver',
    clips: 'blocked',
    irons: false,
    mountMass: 0.35, // est.
    changes: ['Bolt handle lengthened and bent down to clear the scope'],
    classes: ['recon'],
    handling: { bolt: { cycle: 1.5 }, reload: { boltOpen: 0.5, clip: 2.6, round: 0.75, boltClose: 0.55 }, accuracy: 2 },
    note: 'Older, heavier 4x scope. Loads one round at a time; bent bolt handle.',
    info: 'The pre-war sniper rifle, still in service all through the war: a longer, heavier 4x scope over the action.',
  },
  svt40_pu: {
    rifle: 'svt40',
    scope: 'pu',
    name: 'SVT-40 PU (3.5x)',
    mount: 'Bracket on the rear of the receiver holding the scope high, open underneath',
    clips: 'magazine',
    irons: true,
    mountMass: 0.3, // est.
    changes: ['Receiver with the extra notch for the scope bracket'],
    classes: ['recon'],
    note: 'Magazines load as before, and the iron sights show under the high scope.',
    info: 'Sniper SVT-40 of 1941 and 1942: the PU on a high bracket over the receiver, with the iron sights still in view beneath it.',
  },
};

// Did this rifle really take this scope?
export function historical(rifle, scope) {
  return !!SCOPES[scope]?.rifles.includes(rifle);
}

// What loading looks like with a fitting: blocked, free or magazine.
export const LOADING = {
  blocked: 'one round at a time',
  free: 'clips as before',
  magazine: 'magazines as before',
};

// The weapon a fitting makes: the rifle's data (base: its definition, before
// defs.js fills in the derived values) with the scope's sight and the
// fitting's changes. The iron sights, when they stay usable, keep the rifle's
// own sight settings (irons).
export function scopedWeapon(id, base) {
  const f = FITTINGS[id];
  if (!f) throw new Error(`no fitting ${id}`);
  const s = SCOPES[f.scope];
  if (!historical(f.rifle, f.scope)) throw new Error(`${f.scope} was never fitted to ${f.rifle}`);
  const d = s.drum;
  const w = {
    ...base,
    name: f.name,
    type: base.type === 'rifle' ? 'sniper' : base.type,
    classes: [...f.classes],
    model: id,
    base: f.rifle,
    scopeId: f.scope,
    mass: Math.round((base.mass + s.mass + f.mountMass) * 100) / 100,
    sight: { kind: 'scope', unit: d.unit, ranges: steps(d.from, d.to, d.step), zero: d.zero },
    scope: { name: s.name, mag: s.mag, reticle: s.reticle, fieldDeg: s.fieldDeg, eyeRelief: s.eyeRelief },
    irons: f.irons ? { ...base.sight, ranges: [...base.sight.ranges] } : null,
    clipsBlocked: f.clips === 'blocked',
    scopeReturn: f.scopeReturn || 0,
    fitting: { mount: f.mount, clips: f.clips, irons: f.irons, changes: [...f.changes], note: f.note },
    accuracy: f.accuracy ?? base.accuracy,
    hipError: base.hipError + 0.5, // the scope gets in the way of pointing it from the hip
    info: f.info,
  };
  if (f.handling) Object.assign(w, structuredClone(f.handling));
  return w;
}
