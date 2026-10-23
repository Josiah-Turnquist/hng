// Materials for the village: procedural PBR textures from the TextureLibrary, tinted
// per object with vertex colors (so one plaster material covers every house color),
// plus a canvas atlas with painted lettering (signs, plaques, the church clock).
import * as THREE from 'three';

// sRGB color chip -> linear [r, g, b] for vertex colors.
export function rgb(r, g, b) {
  const c = new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
  return [c.r, c.g, c.b];
}

export function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function scale(a, k) {
  return [a[0] * k, a[1] * k, a[2] * k];
}

// Wall paint/render colors found on French village houses (crepi and lime wash).
export const PLASTER_COLORS = {
  cream: rgb(1.0, 0.95, 0.82),
  ochre: rgb(1.0, 0.84, 0.58),
  sand: rgb(0.95, 0.87, 0.72),
  grey: rgb(0.86, 0.85, 0.82),
  white: rgb(1.0, 0.99, 0.95),
  rose: rgb(1.0, 0.86, 0.76),
  dirty: rgb(0.8, 0.76, 0.66),
};

export const LIMEWASH = rgb(1.0, 0.98, 0.93);

// Shutter and door paints (faded).
export const PAINTS = {
  green: rgb(0.42, 0.52, 0.4),
  sage: rgb(0.58, 0.64, 0.52),
  blue: rgb(0.45, 0.56, 0.62),
  greyblue: rgb(0.56, 0.62, 0.66),
  oxblood: rgb(0.48, 0.24, 0.2),
  brown: rgb(0.42, 0.3, 0.22),
  cream: rgb(0.86, 0.82, 0.7),
  grey: rgb(0.6, 0.6, 0.58),
  bottle: rgb(0.2, 0.32, 0.26),
  navy: rgb(0.2, 0.25, 0.35),
};

export const WOOD = {
  natural: rgb(1.0, 1.0, 1.0),
  dark: rgb(0.62, 0.55, 0.5),
  weathered: rgb(0.85, 0.85, 0.82),
  charred: rgb(0.13, 0.11, 0.1),
  scorched: rgb(0.35, 0.3, 0.27),
};

// ---------------------------------------------------------------------------------------
// Sign atlas. Rects are [u0, v0, u1, v1] in texture space (v up).

const ATLAS_W = 2048;
const ATLAS_H = 2048;

function paintAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_W;
  canvas.height = ATLAS_H;
  const g = canvas.getContext('2d');
  const rects = {};
  const serif = '"DejaVu Serif", "Times New Roman", Georgia, serif';
  const sans = '"DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  // px rect -> uv rect (canvas y down, uv v up; the texture is flipped on upload).
  const reg = (name, x, y, w, h) => {
    rects[name] = [x / ATLAS_W, 1 - (y + h) / ATLAS_H, (x + w) / ATLAS_W, 1 - y / ATLAS_H];
    return { x, y, w, h };
  };
  // Grime: speckles and vertical streaks for age.
  const age = (r, amount = 0.25, seed = 1) => {
    let s = seed * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    g.save();
    g.beginPath();
    g.rect(r.x, r.y, r.w, r.h);
    g.clip();
    for (let i = 0; i < r.w * r.h * 0.0016 * amount * 4; i++) {
      g.fillStyle = `rgba(40,32,24,${0.05 + rnd() * 0.15 * amount * 3})`;
      const x = r.x + rnd() * r.w,
        y = r.y + rnd() * r.h;
      g.fillRect(x, y, 1 + rnd() * 4, 1 + rnd() * 4);
    }
    for (let i = 0; i < r.w / 18; i++) {
      const x = r.x + rnd() * r.w;
      const grad = g.createLinearGradient(0, r.y, 0, r.y + r.h);
      grad.addColorStop(0, `rgba(30,25,20,${0.12 * amount})`);
      grad.addColorStop(1, 'rgba(30,25,20,0)');
      g.fillStyle = grad;
      g.fillRect(x, r.y + rnd() * r.h * 0.3, 2 + rnd() * 6, r.h);
    }
    g.restore();
  };
  const text = (str, cx, cy, font, color, maxW, spacing = 0) => {
    g.font = font;
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if ('letterSpacing' in g) g.letterSpacing = `${spacing}px`;
    g.fillText(str, cx, cy, maxW);
    if ('letterSpacing' in g) g.letterSpacing = '0px';
  };

  // 1) GENDARMERIE NATIONALE carved on a stone band (2048 x 192).
  {
    const r = reg('gendarmerie', 0, 0, 2048, 192);
    g.fillStyle = '#cdbf9f';
    g.fillRect(r.x, r.y, r.w, r.h);
    g.strokeStyle = '#a8987a';
    g.lineWidth = 8;
    g.strokeRect(r.x + 10, r.y + 10, r.w - 20, r.h - 20);
    text('GENDARMERIE  NATIONALE', r.x + r.w / 2 + 3, r.y + r.h / 2 + 5, `bold 118px ${serif}`, 'rgba(255,250,235,0.55)', r.w - 80, 10);
    text('GENDARMERIE  NATIONALE', r.x + r.w / 2, r.y + r.h / 2 + 2, `bold 118px ${serif}`, '#2c2f3a', r.w - 80, 10);
    age(r, 0.35, 3);
  }
  // 2) CAFE DE LA PLACE painted board (1536 x 192).
  {
    const r = reg('cafe', 0, 200, 1536, 192);
    g.fillStyle = '#2d4a3a';
    g.fillRect(r.x, r.y, r.w, r.h);
    g.strokeStyle = '#c8b27a';
    g.lineWidth = 10;
    g.strokeRect(r.x + 14, r.y + 14, r.w - 28, r.h - 28);
    text('CAFÉ  DE  LA  PLACE', r.x + r.w / 2, r.y + r.h / 2 + 4, `bold 112px ${serif}`, '#e9dcb5', r.w - 90, 6);
    age(r, 0.4, 5);
  }
  // 3) BOULANGERIE (1536 x 192).
  {
    const r = reg('boulangerie', 0, 400, 1536, 192);
    g.fillStyle = '#5a2620';
    g.fillRect(r.x, r.y, r.w, r.h);
    g.strokeStyle = '#d8b56a';
    g.lineWidth = 10;
    g.strokeRect(r.x + 14, r.y + 14, r.w - 28, r.h - 28);
    text('BOULANGERIE', r.x + r.w / 2, r.y + r.h / 2 + 4, `bold 120px ${serif}`, '#f0d48c', r.w - 90, 14);
    age(r, 0.4, 7);
  }
  // 4) Other shop boards: EPICERIE, TABAC, QUINCAILLERIE (1024 x 160 each).
  const shops = [
    ['epicerie', 'ÉPICERIE', '#253650', '#e8e0c8'],
    ['boucherie', 'BOUCHERIE', '#6b2a24', '#f1e6cc'],
    ['quincaillerie', 'QUINCAILLERIE', '#3b3b36', '#e3d6a8'],
  ];
  shops.forEach(([name, label, bg, fg], i) => {
    const r = reg(name, 1536, 200 + i * 168, 512, 160);
    g.fillStyle = bg;
    g.fillRect(r.x, r.y, r.w, r.h);
    g.strokeStyle = fg;
    g.lineWidth = 5;
    g.strokeRect(r.x + 9, r.y + 9, r.w - 18, r.h - 18);
    text(label, r.x + r.w / 2, r.y + r.h / 2 + 3, `bold 64px ${serif}`, fg, r.w - 40, 3);
    age(r, 0.5, 11 + i);
  });
  // 5) War memorial plaque (768 x 1024): marble with incised letters and names.
  {
    const r = reg('memorial', 0, 600, 768, 1024);
    const grad = g.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
    grad.addColorStop(0, '#d9d6cc');
    grad.addColorStop(1, '#bdb9ae');
    g.fillStyle = grad;
    g.fillRect(r.x, r.y, r.w, r.h);
    g.strokeStyle = '#8e8a80';
    g.lineWidth = 6;
    g.strokeRect(r.x + 16, r.y + 16, r.w - 32, r.h - 32);
    const ink = '#3d3a34';
    text('SAINT-AUBIN', r.x + r.w / 2, r.y + 90, `bold 64px ${serif}`, ink, r.w - 60, 4);
    text('À SES ENFANTS', r.x + r.w / 2, r.y + 170, `bold 50px ${serif}`, ink, r.w - 60, 3);
    text('MORTS POUR LA FRANCE', r.x + r.w / 2, r.y + 235, `bold 46px ${serif}`, ink, r.w - 60, 2);
    g.fillStyle = ink;
    g.fillRect(r.x + 200, r.y + 280, r.w - 400, 4);
    const names = [
      'ARNAUD J.', 'BERTIN L.', 'BOUCHER A.', 'CARON P.', 'CHEVALIER E.', 'DELMAS H.', 'DUBOIS R.', 'FAURE G.',
      'GARNIER M.', 'GIRAUD C.', 'LAMBERT F.', 'LEROUX A.', 'MARCHAND J.', 'MOREAU L.', 'PERRIN V.', 'RENAUD E.',
      'ROUSSEL M.', 'SIMON P.', 'TESSIER A.', 'VIDAL J.',
    ];
    names.forEach((n, i) => {
      const col = i < 10 ? 0 : 1;
      const row = i % 10;
      text(n, r.x + r.w * (col ? 0.72 : 0.28), r.y + 340 + row * 54, `34px ${serif}`, ink, r.w * 0.4, 1);
    });
    text('1914  —  1918', r.x + r.w / 2, r.y + r.h - 90, `bold 56px ${serif}`, ink, r.w - 60, 4);
    age(r, 0.5, 13);
  }
  // 6) Church clock face (512 x 512).
  {
    const r = reg('clock', 800, 600, 512, 512);
    const cx = r.x + 256,
      cy = r.y + 256;
    g.fillStyle = '#2b2b2b';
    g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle = '#ece6d4';
    g.beginPath();
    g.arc(cx, cy, 240, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#1e1e1e';
    g.lineWidth = 10;
    g.stroke();
    const roman = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      g.save();
      g.translate(cx + Math.cos(a) * 190, cy + Math.sin(a) * 190);
      g.rotate(a + Math.PI / 2);
      text(roman[i], 0, 0, `bold 42px ${serif}`, '#1e1e1e', 90);
      g.restore();
      g.fillStyle = '#1e1e1e';
      g.fillRect(cx + Math.cos(a) * 228 - 4, cy + Math.sin(a) * 228 - 4, 8, 8);
    }
    // Hands stopped at 6:51 (the hour the church was shelled).
    const hand = (ang, len, w) => {
      g.save();
      g.translate(cx, cy);
      g.rotate(ang);
      g.fillStyle = '#151515';
      g.fillRect(-w / 2, -len, w, len + 20);
      g.restore();
    };
    hand((6.85 / 12) * Math.PI * 2, 130, 16);
    hand((51 / 60) * Math.PI * 2, 200, 10);
    g.beginPath();
    g.arc(cx, cy, 14, 0, Math.PI * 2);
    g.fillStyle = '#151515';
    g.fill();
    age(r, 0.4, 17);
  }
  // 7) Faded painted wall advertisements (1024 x 512 each).
  {
    const r = reg('ad1', 1024, 1112, 1024, 512);
    g.fillStyle = '#5b2b28';
    g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle = '#d9c9a3';
    g.fillRect(r.x + 30, r.y + 30, r.w - 60, 140);
    text('VINS FINS', r.x + r.w / 2, r.y + 102, `bold 110px ${serif}`, '#5b2b28', r.w - 100, 12);
    text('LIQUEURS', r.x + r.w / 2, r.y + 270, `bold 130px ${sans}`, '#e8dcb8', r.w - 100, 10);
    text('MAISON ROUSSEL — SAINT-AUBIN', r.x + r.w / 2, r.y + 420, `bold 48px ${serif}`, '#e8dcb8', r.w - 100, 3);
    // Fade: wash with the plaster color.
    g.fillStyle = 'rgba(214,204,182,0.38)';
    g.fillRect(r.x, r.y, r.w, r.h);
    age(r, 0.9, 19);
  }
  {
    const r = reg('ad2', 1312, 600, 736, 500);
    g.fillStyle = '#1f3550';
    g.fillRect(r.x, r.y, r.w, r.h);
    text('CHOCOLAT', r.x + r.w / 2, r.y + 150, `bold 120px ${sans}`, '#f1d36b', r.w - 60, 6);
    text('DU', r.x + r.w / 2, r.y + 255, `bold 60px ${serif}`, '#f4ecd6', r.w - 60, 4);
    text('PETIT DÉJEUNER', r.x + r.w / 2, r.y + 360, `bold 76px ${serif}`, '#f4ecd6', r.w - 60, 3);
    g.fillStyle = 'rgba(214,204,182,0.42)';
    g.fillRect(r.x, r.y, r.w, r.h);
    age(r, 0.9, 23);
  }
  // 8) Blue enamel street plaques (512 x 128 each).
  const streets = [
    ['streetPlace', "PLACE DE L'ÉGLISE"],
    ['streetGrande', 'GRANDE RUE'],
    ['streetMoulin', 'RUE DU MOULIN'],
    ['streetGare', 'ROUTE DE LA GARE'],
  ];
  streets.forEach(([name, label], i) => {
    const r = reg(name, 0, 1640 + i * 100, 512, 96);
    g.fillStyle = '#e8e8e2';
    g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle = '#1d3f8a';
    g.fillRect(r.x + 6, r.y + 6, r.w - 12, r.h - 12);
    g.strokeStyle = '#e8e8e2';
    g.lineWidth = 3;
    g.strokeRect(r.x + 12, r.y + 12, r.w - 24, r.h - 24);
    text(label, r.x + r.w / 2, r.y + r.h / 2 + 2, `bold 44px ${sans}`, '#f2f2ec', r.w - 50, 1);
  });
  // 9) Village entry sign (white with red border).
  {
    const r = reg('entry', 520, 1640, 512, 200);
    g.fillStyle = '#efefe8';
    g.fillRect(r.x, r.y, r.w, r.h);
    g.strokeStyle = '#a3262a';
    g.lineWidth = 16;
    g.strokeRect(r.x + 12, r.y + 12, r.w - 24, r.h - 24);
    text('SAINT-AUBIN', r.x + r.w / 2, r.y + 80, `bold 62px ${sans}`, '#1b1b1b', r.w - 60, 2);
    text('SUR-LENNE', r.x + r.w / 2, r.y + 140, `bold 44px ${sans}`, '#1b1b1b', r.w - 60, 2);
    age(r, 0.3, 29);
  }
  // 10) MAIRIE / ECOLE carved band.
  {
    const r = reg('mairie', 1040, 1640, 1008, 120);
    g.fillStyle = '#cfc2a4';
    g.fillRect(r.x, r.y, r.w, r.h);
    text('MAIRIE', r.x + r.w / 2, r.y + r.h / 2 + 3, `bold 84px ${serif}`, '#2c2f3a', r.w - 60, 16);
    age(r, 0.35, 31);
  }
  {
    const r = reg('ecole', 1040, 1770, 1008, 120);
    g.fillStyle = '#cfc2a4';
    g.fillRect(r.x, r.y, r.w, r.h);
    text('ÉCOLE  DE  GARÇONS', r.x + r.w / 2, r.y + r.h / 2 + 3, `bold 72px ${serif}`, '#2c2f3a', r.w - 60, 8);
    age(r, 0.35, 37);
  }
  // 11) Soot / scorch decal (radial dark blotch, alpha via color on a plaster-like base).
  {
    const r = reg('soot', 1040, 1900, 300, 140);
    g.fillStyle = '#d6cfbf';
    g.fillRect(r.x, r.y, r.w, r.h);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return { texture: tex, rects };
}

// ---------------------------------------------------------------------------------------

export function makeVillageMaterials(textures, opts = {}) {
  const size = opts.textureSize; // undefined = library default
  const std = (preset, extra = {}) => {
    const m = textures.standard(preset, { size, side: extra.side });
    m.vertexColors = true;
    if (extra.normalScale !== undefined) m.normalScale.set(extra.normalScale, extra.normalScale);
    if (extra.roughness !== undefined) m.roughness = extra.roughness;
    m.name = `village:${preset}`;
    return m;
  };
  const plain = (name, params) => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, ...params });
    m.name = `village:${name}`;
    m.userData.texWorld = 1;
    return m;
  };
  const atlas = paintAtlas();
  const mats = {
    plaster: std('plasterWhite'),
    stone: std('stoneWall'),
    ashlar: std('ashlar'),
    brick: std('brick'),
    tiles: std('roofTiles'),
    slate: std('slate'),
    wood: std('woodPlanks'),
    paint: std('woodPaint'),
    floor: std('floorTiles'),
    concrete: std('concrete'),
    cobble: std('cobble'),
    rubble: std('rubble'),
    hay: std('hay'),
    burlap: std('burlap'),
    bark: std('planeBark'),
    leaves: std('leavesOak', { side: THREE.DoubleSide }),
    iron: plain('iron', { color: 0x2a2826, roughness: 0.55, metalness: 0.75 }),
    bronze: plain('bronze', { color: 0x5d6b52, roughness: 0.45, metalness: 0.7 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x2a3a44,
      roughness: 0.06,
      metalness: 0.1,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    water: plain('water', { color: 0x0e1a17, roughness: 0.05, metalness: 0.0 }),
    signs: new THREE.MeshStandardMaterial({ map: atlas.texture, roughness: 0.82, metalness: 0, vertexColors: true }),
    dark: plain('dark', { color: 0x0a0908, roughness: 0.95, metalness: 0 }),
  };
  mats.glass.name = 'village:glass';
  mats.glass.userData.texWorld = 1;
  mats.glass.userData.noShadow = true;
  mats.signs.name = 'village:signs';
  mats.signs.userData.texWorld = 1;
  mats.leaves.userData.noShadowReceive = false;
  return { mats, atlas: atlas.rects, atlasTexture: atlas.texture };
}
