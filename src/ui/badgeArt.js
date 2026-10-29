// The combat badges drawn as pin badges: a metal plate in a laurel wreath,
// dark enamel in the middle with the badge's own symbol struck in the metal,
// one to three stars above for the tier. The metal follows the tier: bronze
// for I, silver for II, gold for III. A badge not yet open is drawn grey.
// Worn like the army emblems: fine scratches and rubbed spots.
//
//   badgeSvg(id, tier, { grey })     // SVG markup, 64 x 72 units
//
// The symbols (in a 32 x 32 box), one for each badge in game/badges.js.
const GLYPH = {
  // A pistol coming out fast: speed lines behind it.
  quickdraw: '<path d="M9 11h17v4h-7l-1 2h-3l-1.5 7H9.5l1.5-7H9z"/><path d="M1 12h6M2.5 15.5h5M1 19h5" stroke-width="1.6" fill="none"/>',
  // A winged boot.
  marathonMan: '<path d="M9 9h6v12h8c2.5 0 4 1.3 4 3.5V27H9z"/><path d="M15 12c4-5 10-7 15-6-3 1-7 3-9 6 2-1 5-1.5 7-1-3 1-5 2.5-6.5 4H15z"/>',
  // An anvil.
  heavySet: '<path d="M3 9h22c3 0 4 2 4 3-4 0-6 2-9 3v4h3v4H9v-4h3v-4c-5-1-8-3-9-6z"/>',
  // A magazine and the arrow round it.
  fastReload: '<path d="M12 5h8l2.5 15h-8z"/><path d="M5 19a11 11 0 0 0 21 3" stroke-width="2.4" fill="none"/><path d="M28 17l-1 8-6-3z"/>',
  // A pistol fired from the hip, its line of fire.
  pointShooter: '<path d="M3 13h15v4h-6l-1 2H8l-1.5 7H3.5L5 19H3z"/><circle cx="22" cy="15" r="1.3"/><circle cx="26" cy="15" r="1.3"/><circle cx="30" cy="15" r="1.3"/>',
  // A clenched fist.
  tightGrip: '<path d="M7 11c0-2 1.5-3 3-3h12c2.5 0 4 1.5 4 4v7c0 4-3 7-7 7h-6c-3.5 0-6-2.5-6-6z"/><path d="M11 8.5v6M15 8.5v6M19 8.5v6M8 17h9" stroke="#1c1f15" stroke-width="1.3" fill="none"/>',
  // An eye in the crosshairs.
  deadEye: '<path d="M2 16c6-8.5 22-8.5 28 0-6 8.5-22 8.5-28 0zm14-5a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" fill-rule="evenodd"/><circle cx="16" cy="16" r="2.2"/><path d="M16 2v6M16 24v6M2 16h0M30 16h0" stroke-width="1.6" fill="none"/>',
  // Leaves and grass: the ghillie suit.
  ghillie: '<path d="M16 29C11 22 10 12 16 3c6 9 5 19 0 26z"/><path d="M14 29C8 26 4 20 4 12c6 3 9 9 10 17zM18 29c6-3 10-9 10-17-6 3-9 9-10 17z"/>',
  // A pineapple grenade and its arc.
  grenadier: '<path d="M8 13a7 8.5 0 1 0 14 0 7 8.5 0 1 0-14 0z"/><path d="M12 4h6v4h-6z"/><path d="M18 5h6l-1 3" stroke-width="1.6" fill="none"/><path d="M9.5 10h11M8.5 14h13M9.5 18h11M13 6.5v16M17 6.5v16" stroke="#1c1f15" stroke-width="1" fill="none"/><path d="M20 30c3-6 7-9 11-9" stroke-width="1.4" stroke-dasharray="2 2" fill="none"/>',
  // Three sticks of dynamite, the fuse lit.
  dynamiteLover: '<path d="M6 12h6v16H6zM13 11h6v17h-6zM20 12h6v16h-6z"/><path d="M16 11c0-4 3-6 6-6" stroke-width="1.6" fill="none"/><path d="M23 1l1 3 3-1-2 3 3 2-3 0-1 3-1-3-3 1 2-3-2-2 3 0z"/>',
  // Spare magazines, stacked.
  hoarder: '<path d="M5 8h22v5H5zM5 15h22v5H5zM5 22h22v5H5z"/><path d="M8 10.5h10M8 17.5h10M8 24.5h10" stroke="#1c1f15" stroke-width="1.2" fill="none"/>',
  // Two cartridges picked up.
  scavenger: '<path d="M8 27V13l2-6 2 6v14zM15 27V13l2-6 2 6v14z"/><path d="M8 14h4M15 14h4" stroke="#1c1f15" stroke-width="1" fill="none"/><path d="M22 23c2-6 6-8 9-8l-2 3h-3" stroke-width="1.8" fill="none"/>',
  // A roll of bandage, its end unrolled.
  firstAid: '<path d="M13 5a9 9 0 1 0 0.1 0zm0 5a4 4 0 1 1-0.1 0z" fill-rule="evenodd"/><path d="M21 17h9v6h-9z"/>',
  // The medic's cross in a ring.
  combatMedic: '<path d="M16 2a14 14 0 1 0 0.1 0zm0 3a11 11 0 1 1-0.1 0z" fill-rule="evenodd"/><path d="M13 8h6v5h5v6h-5v5h-6v-5H8v-6h5z"/>',
  // An open hand, a cross on the palm.
  handOfGod: '<path d="M9 30c-3-4-5-8-5-12 0-2 2-2 3 0l2 3V8c0-1.5 2.5-1.5 2.5 0v8V5c0-1.5 2.5-1.5 2.5 0v11V6c0-1.5 2.5-1.5 2.5 0v10V9c0-1.5 2.5-1.5 2.5 0v11c0 5-2 8-4 10z"/><path d="M14.5 20h3v2.5H20v3h-2.5V28h-3v-2.5H12v-3h2.5z" fill="#1c1f15"/>',
  // A wrench.
  mechanic: '<path d="M21 3a7 7 0 0 0-6.5 9.5L4 23l5 5 10.5-10.5A7 7 0 0 0 29 11l-4 4-4.5-1-1-4.5 4-4c-.8-.3-1.6-.5-2.5-.5z"/>',
  // A steering wheel.
  driver: '<path d="M16 3a13 13 0 1 0 0.1 0zm0 3.5a9.5 9.5 0 1 1-0.1 0z" fill-rule="evenodd"/><path d="M16 13a3 3 0 1 0 .1 0z"/><path d="M7 15l6 1M25 15l-6 1M16 19v8" stroke-width="2.6" fill="none"/>',
  // A tank shell.
  gunner: '<path d="M16 2c3.5 2 5 6 5 11v15H11V13c0-5 1.5-9 5-11z"/><path d="M11 18h10M11 21h10" stroke="#1c1f15" stroke-width="1.2" fill="none"/><path d="M10 28h12v2H10z"/>',
};

const METAL = {
  1: ['#e2ae7c', '#b07444', '#6e4222'],
  2: ['#f4f6f7', '#b9c0c5', '#6c747a'],
  3: ['#ffe39a', '#d8a83a', '#8a6414'],
};

// Laurel leaves along an arc on one side (s = -1 left, 1 right).
function laurel(s) {
  let out = '';
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.62 + i * 0.075);
    const x = 32 + s * Math.cos(a) * -27,
      y = 40 + Math.sin(a) * 27;
    const rot = (s > 0 ? -1 : 1) * (a * 180) / Math.PI + (s > 0 ? 180 : 0) - 20 * s;
    out += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="5.2" ry="2.1" transform="rotate(${rot.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
  }
  return out;
}

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

// Wear: fine scratches and rubbed specks, the same for each badge.
function wear(seed) {
  let x = seed;
  const rnd = () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
  let m = '';
  for (let i = 0; i < 14; i++) {
    const ax = 10 + rnd() * 44,
      ay = 12 + rnd() * 50,
      a = 0.5 + (rnd() - 0.5) * 0.9,
      l = 3 + rnd() * 7;
    m += `<path d="M${ax.toFixed(1)} ${ay.toFixed(1)}l${(Math.cos(a) * l).toFixed(1)} ${(Math.sin(a) * l).toFixed(1)}" stroke="#000" stroke-width="${(0.25 + rnd() * 0.3).toFixed(2)}" stroke-opacity="${(0.35 + rnd() * 0.35).toFixed(2)}"/>`;
  }
  for (let i = 0; i < 30; i++) m += `<circle cx="${(8 + rnd() * 48).toFixed(1)}" cy="${(8 + rnd() * 58).toFixed(1)}" r="${(0.2 + rnd() * 0.35).toFixed(2)}" fill="#000" fill-opacity="${(0.2 + rnd() * 0.3).toFixed(2)}"/>`;
  return m;
}

let uid = 0;
export function badgeSvg(id, tier = 1, { grey = false, cls = '' } = {}) {
  const t = Math.max(1, Math.min(3, tier || 1));
  const [lite, mid, dark] = METAL[t];
  const k = `bg${++uid}`;
  const seed = [...id].reduce((n, c) => n + c.charCodeAt(0) * 31, 7) % 2147483646 || 1;
  // The plate: a shield with a rounded top, its rim and a dark enamel field.
  const plate = 'M32 6c8 0 15 2 21 5v18c0 15-9 26-21 31C20 55 11 44 11 29V11c6-3 13-5 21-5z';
  const field = 'M32 11c6.5 0 12 1.5 16.5 4v14c0 12-7 21-16.5 25.5C22.5 50 15.5 41 15.5 29V15c4.5-2.5 10-4 16.5-4z';
  let stars = '';
  for (let i = 0; i < t; i++) stars += `<polygon points="${star(32 + (i - (t - 1) / 2) * 9, 5.5, 3.6)}" fill="url(#${k}m)" stroke="${dark}" stroke-width="0.5"/>`;
  return `<svg class="badge-art ${cls}" viewBox="0 0 64 72" aria-hidden="true" focusable="false"><defs>
<linearGradient id="${k}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${lite}"/><stop offset="0.55" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
<radialGradient id="${k}e" cx="0.45" cy="0.35" r="0.75"><stop offset="0" stop-color="#3a4030"/><stop offset="1" stop-color="#171a12"/></radialGradient>
<filter id="${k}g"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="0.6"/><feFuncG type="linear" slope="0.6"/><feFuncB type="linear" slope="0.6"/></feComponentTransfer></filter></defs>
<g${grey ? ` filter="url(#${k}g)"` : ''}>
<g fill="url(#${k}m)" stroke="${dark}" stroke-width="0.4">${laurel(-1)}${laurel(1)}</g>
<path d="${plate}" fill="url(#${k}m)" stroke="${dark}" stroke-width="0.8"/>
<path d="${field}" fill="url(#${k}e)" stroke="${dark}" stroke-width="0.6"/>
<g transform="translate(16 15) scale(1)" fill="url(#${k}m)" stroke="url(#${k}m)">${GLYPH[id] || ''}</g>
${stars}
<path d="M27 63h10l-1.5 5h-7z" fill="url(#${k}m)" stroke="${dark}" stroke-width="0.5"/>
${wear(seed)}</g></svg>`;
}
