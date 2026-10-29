// Ribbons drawn as the original game showed them: a woven bar in the ribbon's
// own stripes, with stars for the level reached. Each four levels make a tier:
// one to four bronze stars for levels 1 to 4, silver for 5 to 8, gold for 9 to
// 12 (as the original's ribbon track shows them; ours to confirm). A level not
// yet reached is drawn grey. Stripe colors are ours, after the original's
// where its screenshots show them (Combat Movement, Tactical, Infantry
// Assault, Physical Training).
//
//   ribbonSvg(key, level, { grey })   // SVG markup, 64 x 26 units
//   RIBBON_GROUPS                     // the overview's groups: [{ name, keys }]
import { WEAPONS } from '../weapons/defs.js';

// Half of each ribbon, from the edge to the middle: [width, color], 32 units
// in all; the other half mirrors it.
const STRIPES = {
  physicalTraining: [[4, '#6a8a2e'], [3, '#f0ece2'], [3, '#a82a2a'], [22, '#e4e0d6']],
  combatMovement: [[4, '#7a9a2e'], [3, '#e8e4da'], [2, '#a82a2a'], [23, '#cfcac0']],
  parachute: [[4, '#2a2a2a'], [2, '#8a8a8a'], [26, '#202020']],
  tactical: [[3, '#d6b54a'], [5, '#2c4f8a'], [3, '#b02e2e'], [21, '#2c4f8a']],
  defense: [[3, '#2c2c2c'], [4, '#b02e2e'], [3, '#2c4f8a'], [22, '#3a2f2f']],
  recon: [[3, '#3d2f5e'], [3, '#c7c2d8'], [26, '#4b3c7a']],
  medic: [[4, '#f0ece2'], [3, '#b8282a'], [25, '#f0ece2']],
  infantryAssault: [[3, '#1e1e1e'], [3, '#b42b2b'], [3, '#f1ece0'], [23, '#1e1e1e']],
  lmgAssault: [[3, '#3b4b2a'], [5, '#c9b37a'], [3, '#2a2a2a'], [21, '#6d7b4a']],
  smgAssault: [[4, '#2b2b2b'], [3, '#e3dfd3'], [25, '#4a5a6e']],
  handgunAssault: [[3, '#2a2a2a'], [3, '#c9a24a'], [26, '#3b3b45']],
  explosives: [[4, '#c8582d'], [3, '#1d1d1d'], [25, '#d2a04b']],
  tankDestruction: [[3, '#1d1d1d'], [4, '#7c2b2b'], [3, '#c9b37a'], [22, '#2f3524']],
  closeCombat: [[3, '#5e1d1d'], [4, '#1b1b1b'], [25, '#8a2a22']],
  armorAssault: [[3, '#1d1d1d'], [3, '#c9a24a'], [26, '#4a4a42']],
  armorDamage: [[3, '#4a4a42'], [3, '#b02e2e'], [26, '#2a2a2a']],
  tankDriver: [[4, '#3a3a3a'], [3, '#d0c38a'], [25, '#5a5a4a']],
  driver: [[3, '#4f6a2e'], [3, '#d0c38a'], [26, '#7a6a4a']],
  chauffeur: [[3, '#7a6a4a'], [3, '#2a2a2a'], [26, '#b9a77a']],
};

// A gun's Specialist ribbon: its army's colors, a stripe for its kind of gun.
const ARMY = { US: ['#5b6236', '#c9b98a'], GE: ['#4c5250', '#b9b4a6'], SU: ['#8a2a22', '#b8a676'] };
const KIND = { semi: '#2c4f8a', rifle: '#3a6a3a', sniper: '#4b3c7a', carbine: '#2c6a7a', assault: '#7a4a2a', smg: '#4a5a6e', lmg: '#6d7b4a', pistol: '#c9a24a', revolver: '#c9a24a', atRifle: '#7c2b2b', launcher: '#c8582d' };
function specialist(gun) {
  const d = WEAPONS[gun] || {};
  const [a, b] = ARMY[d.faction] || ARMY.US;
  return [[3, a], [3, b], [3, KIND[d.type] || '#555'], [3, b], [20, a]];
}

export const RIBBON_GROUPS = [
  { name: 'Physical', keys: ['physicalTraining', 'combatMovement', 'parachute'] },
  { name: 'Tactical', keys: ['tactical', 'defense', 'recon', 'medic'] },
  { name: 'Combat', keys: ['infantryAssault', 'lmgAssault', 'smgAssault', 'handgunAssault', 'explosives', 'tankDestruction', 'closeCombat'] },
  { name: 'Vehicles', keys: ['armorAssault', 'armorDamage', 'tankDriver', 'driver', 'chauffeur'] },
];

const METAL = [null, ['#e0a878', '#9a5e33'], ['#f2f4f5', '#9aa2a8'], ['#ffe08a', '#b0841e']];

// A five-pointed star at (cx, cy), outer radius r.
function star(cx, cy, r) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.42 : r;
    p.push(`${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)}`);
  }
  return p.join(' ');
}

let uid = 0;
export function ribbonSvg(key, level = 0, { grey = level <= 0, cls = '' } = {}) {
  const half = STRIPES[key] || (key.startsWith('spec:') ? specialist(key.slice(5)) : STRIPES.parachute);
  const id = `rb${++uid}`;
  // The stripes, edge to edge.
  const cols = [...half, ...[...half].reverse()];
  let x = 0,
    body = '';
  for (const [w, c] of cols) {
    body += `<rect x="${x}" y="0" width="${w + 0.05}" height="26" fill="${c}"/>`;
    x += w;
  }
  // Stars: one to four of the tier's metal (a grey one stands for the tier).
  const lv = Math.max(0, Math.min(12, level));
  const tier = lv ? Math.ceil(lv / 4) : 1;
  const n = lv ? ((lv - 1) % 4) + 1 : 1;
  const [lite, dark] = METAL[tier];
  const r = n === 1 ? 7.6 : n === 2 ? 6.4 : n === 3 ? 5.6 : 4.8;
  const gap = r * 2.05;
  let stars = '';
  for (let i = 0; i < n; i++) {
    const cx = 32 + (i - (n - 1) / 2) * gap;
    const cy = n === 3 && i === 1 ? 12.2 : 13.4;
    stars += `<polygon points="${star(cx, cy + 0.5, r)}" fill="#000" opacity="0.35"/><polygon points="${star(cx, cy, r)}" fill="url(#${id}m)" stroke="${dark}" stroke-width="0.5"/>`;
  }
  return `<svg class="ribbon ${cls}" viewBox="0 0 64 26" aria-hidden="true" focusable="false"><defs>
<pattern id="${id}w" width="2" height="1.6" patternUnits="userSpaceOnUse"><rect width="2" height="0.8" fill="#fff" opacity="0.14"/><rect y="0.8" width="2" height="0.8" fill="#000" opacity="0.16"/><rect x="0.9" width="0.25" height="1.6" fill="#000" opacity="0.08"/></pattern>
<linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/></linearGradient>
<linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${lite}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
<filter id="${id}g"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="0.55"/><feFuncG type="linear" slope="0.55"/><feFuncB type="linear" slope="0.55"/></feComponentTransfer></filter>
<clipPath id="${id}c"><rect width="64" height="26" rx="1.2"/></clipPath></defs>
<g clip-path="url(#${id}c)"${grey ? ` filter="url(#${id}g)"` : ''}>${body}<rect width="64" height="26" fill="url(#${id}w)"/><rect width="64" height="26" fill="url(#${id}s)"/>${stars}</g>
<rect x="0.25" y="0.25" width="63.5" height="25.5" rx="1.2" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="0.5"/></svg>`;
}
