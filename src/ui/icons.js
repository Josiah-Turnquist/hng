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

export function emblem(faction) {
  if (faction === 'GE')
    // Balkenkreuz: a black cross edged in white.
    return svg('<path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z" fill="#f2f0ea"/><path d="M10.4 3.4h3.2v7h7v3.2h-7v7h-3.2v-7h-7v-3.2h7z" fill="#151515"/>', '0 0 24 24', 'emblem');
  if (faction === 'SU')
    // The Red Army star, edged in gold.
    return svg(`<polygon points="${star(12, 12.8, 11)}" fill="#d9a441"/><polygon points="${star(12, 12.8, 9.3)}" fill="#b8261f"/>`, '0 0 24 24', 'emblem');
  // US: the white star in a white ring on olive drab.
  return svg(`<circle cx="12" cy="12" r="11" fill="#4b5228"/><circle cx="12" cy="12" r="9.6" fill="none" stroke="#f2f0ea" stroke-width="1.4"/><polygon points="${star(12, 12.6, 8.1)}" fill="#f2f0ea"/>`, '0 0 24 24', 'emblem');
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
  // A gold coin standing on another (the stack shows its thickness), a raised
  // rim and a star struck in the middle.
  coin: svg('<circle cx="12" cy="14.2" r="8.4" fill="currentColor" opacity="0.45"/><circle cx="12" cy="11.6" r="8.4" fill="currentColor"/><circle cx="12" cy="11.6" r="6.5" fill="none" stroke="#000" stroke-opacity="0.32" stroke-width="1"/><path d="M12 7.7 L13.03 10.48 L15.99 10.6 L13.66 12.44 L14.47 15.3 L12 13.65 L9.53 15.3 L10.34 12.44 L8.01 10.6 L10.97 10.48Z" fill="#000" fill-opacity="0.32"/>'),
  wrench: svg('<path d="M14.5 3.5a5 5 0 0 0-4.6 6.9L3.5 16.8a1.9 1.9 0 0 0 2.7 2.7l6.4-6.4a5 5 0 0 0 6.9-4.6l-3 3-2.6-.6-.6-2.6 3-3a5 5 0 0 0-1.8-.8z" fill="currentColor"/>'),
  close: svg('<path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2.4"/>'),
  turn: svg('<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M18 2v5h-5M6 22v-5h5" fill="none" stroke="currentColor" stroke-width="2"/>'),
};
