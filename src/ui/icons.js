// Small drawings for the menus, as SVG markup: the armies' emblems (the US white
// star, the German Balkenkreuz, the Soviet red star), class badges, rank
// insignia and a few interface symbols. Colors are fixed; sizes follow the font.

const svg = (body, vb = '0 0 24 24', cls = '') => `<svg class="ico ${cls}" viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;

// A five-pointed star centered at (cx, cy), outer radius r.
function star(cx, cy, r, inner = 0.382) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * inner : r;
    p.push(`${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)}`);
  }
  return p.join(' ');
}

// Battle wear for an emblem or a coin: a mask of fine scratches, small chips
// and grit (each kind its own, the same every time), so the drawing shows the
// dark ground through them.
function wearMask(id, seed) {
  let x = seed;
  const rnd = () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
  const n = (v) => v.toFixed(2);
  let marks = '';
  for (let i = 0; i < 16; i++) {
    // A scratch: short, fine, slightly bent, mostly running one way (the way
    // the thing was dragged), a few across.
    const ax = 2 + rnd() * 20,
      ay = 2 + rnd() * 20,
      a = (i < 11 ? 0.5 : 2.1) + (rnd() - 0.5) * 0.7,
      l = 1.2 + rnd() * 3.4;
    const bx = ax + Math.cos(a) * l,
      by = ay + Math.sin(a) * l;
    const cx = (ax + bx) / 2 + (rnd() - 0.5) * 0.6,
      cy = (ay + by) / 2 + (rnd() - 0.5) * 0.6;
    marks += `<path d="M${n(ax)} ${n(ay)}Q${n(cx)} ${n(cy)} ${n(bx)} ${n(by)}" stroke="#000" stroke-width="${n(0.1 + rnd() * 0.16)}" stroke-opacity="${n(0.35 + rnd() * 0.4)}" stroke-linecap="round" fill="none"/>`;
  }
  for (let i = 0; i < 9; i++) {
    // A chip, mostly near the edge where things get knocked.
    const a = rnd() * Math.PI * 2,
      r = 7 + rnd() * 4.5;
    marks += `<circle cx="${n(12 + Math.cos(a) * r)}" cy="${n(12 + Math.sin(a) * r)}" r="${n(0.15 + rnd() * 0.3)}" fill="#000" fill-opacity="${n(0.5 + rnd() * 0.4)}"/>`;
  }
  for (let i = 0; i < 40; i++) {
    // Fine grit: the paint and plating rubbed thin.
    marks += `<circle cx="${n(1 + rnd() * 22)}" cy="${n(1 + rnd() * 22)}" r="${n(0.08 + rnd() * 0.12)}" fill="#000" fill-opacity="${n(0.2 + rnd() * 0.3)}"/>`;
  }
  return `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><rect width="24" height="24" fill="#fff"/>${marks}</mask></defs>`;
}
const worn = (id, seed, body) => `${wearMask(id, seed)}<g mask="url(#${id})">${body}</g>`;

export function emblem(faction) {
  if (faction === 'GE')
    // Balkenkreuz: a black cross edged in white.
    return svg(worn('wear-ge', 911, '<path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z" fill="#e4e1d8"/><path d="M10.4 3.4h3.2v7h7v3.2h-7v7h-3.2v-7h-7v-3.2h7z" fill="#151515"/>'), '0 0 24 24', 'emblem');
  if (faction === 'SU')
    // The Red Army star, edged in gold.
    return svg(worn('wear-su', 4242, `<polygon points="${star(12, 12.8, 11)}" fill="#c99a40"/><polygon points="${star(12, 12.8, 9.3)}" fill="#a8241d"/>`), '0 0 24 24', 'emblem');
  // US: the white star in a white ring on olive drab.
  return svg(worn('wear-us', 1944, `<circle cx="12" cy="12" r="11" fill="#4b5228"/><circle cx="12" cy="12" r="9.6" fill="none" stroke="#e4e1d8" stroke-width="1.4"/><polygon points="${star(12, 12.6, 8.1)}" fill="#e4e1d8"/>`), '0 0 24 24', 'emblem');
}

export function classIcon(cls) {
  switch (cls) {
    case 'recon':
      // A scope's view.
      return svg('<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>');
    case 'paratrooper':
      // A parachute.
      return svg('<path d="M2 11a10 8 0 0 1 20 0z" fill="currentColor"/><path d="M3 11l8.2 8M21 11l-8.2 8M8.5 11l3 8M15.5 11l-3 8" stroke="currentColor" stroke-width="1.3" fill="none"/><rect x="10.4" y="18.6" width="3.2" height="3.6" rx="1" fill="currentColor"/>');
    case 'tanker':
      // A tank.
      return svg('<path d="M3 15h18l-2 5H5z" fill="currentColor"/><rect x="6" y="10" width="10" height="4.4" rx="1" fill="currentColor"/><path d="M15 11.6h7" stroke="currentColor" stroke-width="1.8"/><circle cx="7" cy="17.5" r="1.1" fill="#1a1a16"/><circle cx="12" cy="17.5" r="1.1" fill="#1a1a16"/><circle cx="17" cy="17.5" r="1.1" fill="#1a1a16"/>');
    default:
      // A rifle: stock, receiver and barrel, slung at a slant.
      return svg('<path d="M2.2 17.4l4.6-2.3 1.2 1.6 12.8-8.4.9 1.1-12.4 9.1.4 1.3-2 1.3-1.3-1.6-2.9 1.7z" fill="currentColor"/><path d="M9.6 15.7l1.2 2.4" stroke="currentColor" stroke-width="1.4"/>');
  }
}

// Rank insignia in a common style for all armies: chevrons for the ranks of
// soldiers and NCOs (rockers under them higher up), bars for junior officers,
// a leaf for field officers, stars for generals. Rank 0 wears none.
export function rankBadge(rank) {
  const chev = (y) => `<path d="M3 ${y + 4}l9-5 9 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>`;
  const rock = (y) => `<path d="M3 ${y}q9 4.5 18 0" fill="none" stroke="currentColor" stroke-width="2"/>`;
  let body = '';
  if (rank <= 0) body = '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/>';
  else if (rank <= 11) {
    const c = rank <= 1 ? 1 : rank <= 3 ? 2 : 3;
    const r = rank <= 5 ? 0 : Math.min(3, rank - 5 - (rank >= 9 ? 1 : 0));
    for (let i = 0; i < c; i++) body += chev(3 + i * 4.2);
    for (let i = 0; i < r; i++) body += rock(15.5 + i * 3);
  } else if (rank <= 14) {
    const n = rank - 11;
    for (let i = 0; i < n; i++) body += `<rect x="${12 - (n * 4.4) / 2 + i * 4.4 + 0.6}" y="5" width="3.2" height="14" rx="0.6" fill="currentColor"/>`;
  } else if (rank <= 17) body = '<path d="M12 3c5 3 6 8 0 18C6 11 7 6 12 3z" fill="currentColor"/><path d="M12 6v13" stroke="#1a1a16" stroke-width="0.9"/>';
  else {
    const n = Math.min(5, rank - 17);
    const w = 24 / n;
    for (let i = 0; i < n; i++) body += `<polygon points="${star(w * (i + 0.5), 12, Math.min(5.5, w * 0.46))}" fill="currentColor"/>`;
  }
  return svg(body, '0 0 24 24', 'rank');
}

export const ICONS = {
  // A gear wheel: eight square teeth round a hub with its hole.
  gear: svg('<path fill-rule="evenodd" d="M19.83 9.58 L22.58 9.85 L22.58 14.15 L19.83 14.42 L19.58 15.14 L19.25 15.83 L21 17.97 L17.97 21 L15.83 19.25 L15.14 19.58 L14.42 19.83 L14.15 22.58 L9.85 22.58 L9.58 19.83 L8.86 19.58 L8.17 19.25 L6.03 21 L3 17.97 L4.75 15.83 L4.42 15.14 L4.17 14.42 L1.42 14.15 L1.42 9.85 L4.17 9.58 L4.42 8.86 L4.75 8.17 L3 6.03 L6.03 3 L8.17 4.75 L8.86 4.42 L9.58 4.17 L9.85 1.42 L14.15 1.42 L14.42 4.17 L15.14 4.42 L15.83 4.75 L17.97 3 L21 6.03 L19.25 8.17 L19.58 8.86Z M15.4 12 A3.4 3.4 0 1 0 8.6 12 A3.4 3.4 0 1 0 15.4 12Z" fill="currentColor"/>'),
  screen: svg('<path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6" fill="none" stroke="currentColor" stroke-width="2.2"/>'),
  info: svg('<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><rect x="11" y="10" width="2.2" height="7.5" fill="currentColor"/><circle cx="12.1" cy="7" r="1.4" fill="currentColor"/>'),
  plus: svg('<path d="M12 4v16M4 12h16" stroke="currentColor" stroke-width="2.6"/>'),
  // A coin in outline, in a darker gold: the rim, its edge showing below as a
  // band (the coin's thickness), an inner ring and a star struck in the
  // middle, worn and scratched like the emblems.
  coin: svg(
    worn(
      'wear-coin',
      1337,
      '<path d="M3.8 11.4A8.2 8.2 0 0 0 20.2 11.4V13.6A8.2 8.2 0 0 1 3.8 13.6Z" fill="#8a6626"/>' +
        '<g fill="none" stroke="#c4923a"><circle cx="12" cy="11.4" r="8.2" stroke-width="1.7"/><circle cx="12" cy="11.4" r="5.9" stroke-width="0.8"/></g>' +
        `<polygon points="${star(12, 11.8, 4.1)}" fill="#c4923a"/>`,
    ),
  ),
  wrench: svg('<path d="M14.5 3.5a5 5 0 0 0-4.6 6.9L3.5 16.8a1.9 1.9 0 0 0 2.7 2.7l6.4-6.4a5 5 0 0 0 6.9-4.6l-3 3-2.6-.6-.6-2.6 3-3a5 5 0 0 0-1.8-.8z" fill="currentColor"/>'),
  close: svg('<path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2.4"/>'),
  turn: svg('<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M18 2v5h-5M6 22v-5h5" fill="none" stroke="currentColor" stroke-width="2"/>'),
};
