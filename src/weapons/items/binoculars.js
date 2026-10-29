// Binoculars: each army's 6x30 service glasses. Raised to the eyes (the aim
// key) they show the real 6x view with the army's reticle; pressing fire then
// spots the enemy in the middle of the view for the whole side (game/
// spotting.js). They fire nothing: the places that treat every item as a gun
// (defs.js's derived values, Weapon, the HUD, pickups) leave them out by type.
// Sources in docs/research/weapons.md, section 10; values marked "est." were
// not found there. See docs/ITEMS.md for the conventions.
//
// optic: what is seen through them, as a scope's data (scopes.js): mag, true
// field of view (deg), eye relief (m), and the reticle hud.js draws
// (binoUS: the M3's horizontal mil scale; binoGE: the Dienstglas's
// "Strichplatte"; binoSU: the Soviet scale in thousandths), and the eyepiece it
// sits in (-1 left, 1 right).
const optic = (reticle, side) => ({ mag: 6, fieldDeg: 8.5, eyeRelief: 0.014, reticle, side });

export const BINOCULARS = {
  binoc_us: {
    name: 'Binocular M3',
    faction: 'US',
    type: 'binoculars',
    slot: 'binoculars',
    classes: ['infantry', 'paratrooper', 'recon', 'tanker'],
    points: 1,
    mass: 0.58, // est. (6x30 Porro glasses of the period: 0.5 to 0.6 kg)
    length: 0.115,
    optic: optic('binoUS', -1), // TM 9-575: the reticle is in the left telescope
    info: 'US Army 6x30 glasses with a mil scale in the left eyepiece. Raise them and press fire to spot an enemy for your side.',
  },
  binoc_ge: {
    name: 'Dienstglas 6x30',
    faction: 'GE',
    type: 'binoculars',
    slot: 'binoculars',
    classes: ['infantry', 'paratrooper', 'recon', 'tanker'],
    points: 1,
    mass: 0.55, // est.
    length: 0.112,
    optic: optic('binoGE', 1), // the Strichplatte in the right eyepiece
    info: 'The German service glass, 6x30, with the Strich scale for judging width and range. Raise it and press fire to spot an enemy for your side.',
  },
  binoc_su: {
    name: 'Binocular B-6',
    faction: 'SU',
    type: 'binoculars',
    slot: 'binoculars',
    classes: ['infantry', 'paratrooper', 'recon', 'tanker'],
    points: 1,
    mass: 0.6, // est.
    length: 0.115,
    optic: optic('binoSU', 1), // est.
    info: 'Red Army 6x30 glasses with a scale in thousandths. Raise them and press fire to spot an enemy for your side.',
  },
};
