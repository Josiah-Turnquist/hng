// Player settings (saved in the browser) and graphics options.
//
// Graphics come from a preset (Low, Medium, High, Ultra) whose options can then be
// changed one by one (the preset then shows as "Custom"). settings.quality turns the
// options into the numbers the renderer uses. Most options apply at once in a running
// battle (see GRAPHICS_OPTIONS[].live); the first time the game starts, the preset is
// picked from the graphics card (detectQuality).

const pct = (v) => `${Math.round(v * 100)}%`;
const meters = (v) => `${Math.round(v)} m`;
const ON_OFF = [
  [false, 'Off'],
  [true, 'On'],
];

// Every graphics option the settings show, in order (group starts a new heading).
// type 'choice' has choices [value, label]; type 'range' has min, max, step and fmt.
// live: applies at once in a battle; otherwise from the next battle.
export const GRAPHICS_OPTIONS = [
  {
    key: 'renderScale',
    group: 'Picture',
    label: 'Render resolution',
    type: 'range',
    min: 0.5,
    max: 1,
    step: 0.05,
    fmt: pct,
    live: true,
    note: 'Draws the 3D view with fewer pixels and stretches it to the screen. The biggest speed-up on a slow computer; the picture gets softer.',
  },
  {
    key: 'antiAliasing',
    label: 'Edge smoothing',
    type: 'choice',
    choices: [
      ['off', 'Off'],
      ['fxaa', 'Fast'],
      ['msaa', 'Sharp'],
      ['taa', 'Smoothest'],
    ],
    live: true,
    note: 'Removes jagged, flickering edges. Fast costs almost nothing but softens the picture a little. Sharp keeps fine detail and smooth leaves and grass, but needs a stronger graphics card. Smoothest also calms shimmering in the distance, with a slight blur when you move.',
  },
  {
    key: 'shadows',
    group: 'Light and shadow',
    label: 'Shadow quality',
    type: 'choice',
    choices: [
      ['off', 'Off'],
      ['low', 'Low'],
      ['medium', 'Medium'],
      ['high', 'High'],
      ['ultra', 'Ultra'],
    ],
    live: true,
    note: 'How sharp and smooth shadows are. Shadows are among the most expensive things to draw; Low or Off helps a lot on slow computers.',
  },
  {
    key: 'shadowDistance',
    label: 'Shadow distance',
    type: 'range',
    min: 40,
    max: 600,
    step: 10,
    fmt: meters,
    live: true,
    note: 'How far away shadows are still drawn.',
  },
  {
    key: 'ambientOcclusion',
    label: 'Contact shadows',
    type: 'choice',
    choices: [
      ['off', 'Off'],
      ['normal', 'Normal'],
      ['high', 'High'],
    ],
    live: true,
    note: 'Soft darkening in corners, under eaves, in doorways and where things meet the ground.',
  },
  {
    key: 'bloom',
    label: 'Glow',
    type: 'choice',
    choices: ON_OFF,
    live: true,
    note: 'Very bright light (the sun, fire, muzzle flashes) glows softly into its surroundings.',
  },
  {
    key: 'lightShafts',
    label: 'Sun rays',
    type: 'choice',
    choices: ON_OFF,
    live: true,
    note: 'Rays of sunlight through trees, smoke and dust when you look toward the sun.',
  },
  {
    key: 'viewDistance',
    group: 'Landscape',
    label: 'View distance',
    type: 'range',
    min: 600,
    max: 3000,
    step: 100,
    fmt: meters,
    live: true,
    note: 'How far the landscape and trees are drawn.',
  },
  {
    key: 'treeDetail',
    label: 'Tree detail',
    type: 'choice',
    choices: [
      ['low', 'Low'],
      ['medium', 'Medium'],
      ['high', 'High'],
      ['ultra', 'Ultra'],
    ],
    live: true,
    note: 'How far trees, bushes and hedges are drawn in full 3D before they change to simple flat pictures.',
  },
  {
    key: 'grassDensity',
    label: 'Grass density',
    type: 'range',
    min: 0.2,
    max: 1.4,
    step: 0.05,
    fmt: pct,
    live: true,
    note: 'How thick grass, wheat and ferns grow near you. Lower it if the game slows down in open fields.',
  },
  {
    key: 'grassDistance',
    label: 'Grass distance',
    type: 'range',
    min: 20,
    max: 100,
    step: 5,
    fmt: meters,
    live: true,
    note: 'How far away grass is drawn.',
  },
  {
    key: 'textureQuality',
    label: 'Texture detail',
    type: 'choice',
    choices: [
      ['low', 'Low'],
      ['medium', 'Medium'],
      ['high', 'High'],
    ],
    live: false,
    note: 'Sharpness of walls, ground and vehicles up close. Uses more graphics memory and loads a little slower.',
  },
  {
    key: 'effects',
    group: 'Effects',
    label: 'Effects',
    type: 'choice',
    choices: [
      ['low', 'Low'],
      ['medium', 'Medium'],
      ['high', 'High'],
    ],
    live: true,
    note: 'Amount and quality of smoke, dust, sparks and clouds, and whether muzzle flashes and explosions light up their surroundings.',
  },
  {
    key: 'depthOfField',
    label: 'Focus when aiming',
    type: 'choice',
    choices: ON_OFF,
    live: true,
    note: 'When you aim down the sights, the back of the gun close to your eye goes slightly out of focus, as it does for a real shooter.',
  },
  {
    key: 'motionBlur',
    label: 'Motion blur',
    type: 'choice',
    choices: ON_OFF,
    live: true,
    note: 'Blurs the view a little when you turn quickly.',
  },
];

// Hidden per-preset values: the sharpest pixel ratio used on high-resolution
// screens, and how far the ground keeps its full detail.
const HIDDEN = ['maxPixelRatio', 'terrainLod'];

export const GRAPHICS_PRESETS = {
  low: {
    label: 'Low',
    renderScale: 0.75,
    antiAliasing: 'fxaa',
    shadows: 'low',
    shadowDistance: 60,
    ambientOcclusion: 'off',
    bloom: false,
    lightShafts: false,
    viewDistance: 1200,
    treeDetail: 'low',
    grassDensity: 0.3, // few but wide tufts (see GroundCover._configure)
    grassDistance: 30,
    textureQuality: 'low',
    effects: 'low',
    depthOfField: false,
    motionBlur: false,
    maxPixelRatio: 1,
    terrainLod: 0.6,
  },
  medium: {
    label: 'Medium',
    renderScale: 1,
    antiAliasing: 'fxaa',
    shadows: 'medium',
    shadowDistance: 160,
    ambientOcclusion: 'off',
    bloom: true,
    lightShafts: false,
    viewDistance: 2000,
    treeDetail: 'medium',
    grassDensity: 0.65,
    grassDistance: 50,
    textureQuality: 'medium',
    effects: 'medium',
    depthOfField: false,
    motionBlur: false,
    maxPixelRatio: 1,
    terrainLod: 1,
  },
  high: {
    label: 'High',
    renderScale: 1,
    antiAliasing: 'msaa',
    shadows: 'high',
    shadowDistance: 300,
    ambientOcclusion: 'normal',
    bloom: true,
    lightShafts: true,
    viewDistance: 3000,
    treeDetail: 'high',
    grassDensity: 1,
    grassDistance: 70,
    textureQuality: 'medium',
    effects: 'high',
    depthOfField: true,
    motionBlur: false,
    maxPixelRatio: 1.5,
    terrainLod: 1.4,
  },
  ultra: {
    label: 'Ultra',
    renderScale: 1,
    antiAliasing: 'taa',
    shadows: 'ultra',
    shadowDistance: 500,
    ambientOcclusion: 'high',
    bloom: true,
    lightShafts: true,
    viewDistance: 3000,
    treeDetail: 'ultra',
    grassDensity: 1.4,
    grassDistance: 90,
    textureQuality: 'high',
    effects: 'high',
    depthOfField: true,
    motionBlur: false,
    maxPixelRatio: 2,
    terrainLod: 2,
  },
};

const OPTION_KEYS = [...GRAPHICS_OPTIONS.map((o) => o.key), ...HIDDEN];

// Shadow quality levels: shadow maps (cascades: each covers a farther slice of the
// view) and their size in pixels.
const SHADOW_LEVELS = {
  off: { cascades: 0, size: 1024 },
  low: { cascades: 1, size: 1536 },
  medium: { cascades: 2, size: 2048 },
  high: { cascades: 3, size: 2048 },
  ultra: { cascades: 4, size: 3072 },
};
const TEXTURE_SIZE = { low: 512, medium: 1024, high: 2048 };
const ANISOTROPY = { low: 4, medium: 8, high: 16 };
// How far trees are drawn at all (as flat pictures), by tree detail.
const TREE_FAR = { low: 900, medium: 1500, high: 2400, ultra: 3000 };

// Graphics options -> what the renderer uses. Keeps the older flat keys (csm,
// cascades, shadowMapSize, ssao, fxaa, textureSize...) that the world code reads.
export function resolveQuality(g, name = 'custom') {
  const o = { ...GRAPHICS_PRESETS.high, ...g };
  delete o.label;
  const sh = SHADOW_LEVELS[o.shadows] || SHADOW_LEVELS.high;
  const preset = GRAPHICS_PRESETS[name];
  return {
    preset: preset ? name : 'custom',
    label: preset ? preset.label : 'Custom',
    options: o,
    renderScale: o.renderScale,
    maxPixelRatio: o.maxPixelRatio,
    aa: o.antiAliasing,
    fxaa: o.antiAliasing === 'fxaa',
    msaa: o.antiAliasing === 'msaa' ? 4 : 0,
    taa: o.antiAliasing === 'taa',
    shadows: sh.cascades > 0,
    shadowLevel: o.shadows,
    csm: true,
    cascades: Math.max(1, sh.cascades),
    shadowMapSize: sh.size,
    shadowDistance: o.shadowDistance,
    ssao: o.ambientOcclusion !== 'off',
    aoQuality: o.ambientOcclusion,
    bloom: !!o.bloom,
    lightShafts: !!o.lightShafts,
    depthOfField: !!o.depthOfField,
    motionBlur: !!o.motionBlur,
    textureSize: TEXTURE_SIZE[o.textureQuality] || 1024,
    anisotropy: ANISOTROPY[o.textureQuality] || 8,
    grassDensity: o.grassDensity,
    grassDistance: o.grassDistance,
    treeDetail: o.treeDetail,
    treeDistance: Math.min(o.viewDistance, TREE_FAR[o.treeDetail] || 2400),
    terrainLod: o.terrainLod,
    viewDistance: o.viewDistance,
    effects: o.effects,
  };
}

// The old flat presets, for code that still reads QUALITY_PRESETS[name].
export const QUALITY_PRESETS = Object.fromEntries(Object.keys(GRAPHICS_PRESETS).map((k) => [k, resolveQuality(GRAPHICS_PRESETS[k], k)]));

// Which preset these options match exactly, or 'custom'.
export function matchPreset(g) {
  for (const [name, p] of Object.entries(GRAPHICS_PRESETS)) if (OPTION_KEYS.every((k) => p[k] === g[k])) return name;
  return 'custom';
}

// Picks a preset from the graphics card the browser reports. Software renderers and
// older integrated graphics get Low; integrated graphics Medium (or Low); dedicated
// cards High. Returns { preset, gpu }.
export function detectQuality() {
  let gpu = '';
  let slow = false;
  try {
    const c = document.createElement('canvas');
    // Browsers refuse this flag on software rendering ("major performance caveat").
    let gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (!gl) {
      slow = true;
      gl = c.getContext('webgl2');
    }
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      gpu = String((ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '');
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    /* no WebGL here: the game will say so when it starts */
  }
  const s = gpu.toLowerCase();
  let preset = 'medium';
  if (slow || /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen/.test(s)) preset = 'low';
  else if (/geforce mx|\bmx ?\d{3}\b|\bgt \d{3,4}\b|geforce \d{3}m\b/.test(s)) preset = 'medium';
  else if (/rtx|gtx|quadro|radeon rx|radeon pro|radeon r9|arc a\d|geforce|firepro|apple m\d (pro|max|ultra)/.test(s)) preset = 'high';
  else if (/intel.*(hd|uhd) graphics|intel\(r\) graphics|mali|adreno|powervr|videocore|vega [3-8]\b|radeon\(tm\) r[2-5]/.test(s)) preset = 'low';
  else if (/iris|apple|radeon|intel|arc/.test(s)) preset = 'medium';
  // Very large screens have many pixels to fill.
  try {
    const px = screen.width * screen.height * Math.min(2, devicePixelRatio || 1) ** 2;
    if (px > 5e6 && preset === 'high') preset = 'medium';
  } catch {
    /* ignore */
  }
  return { preset, gpu };
}

const DEFAULTS = {
  quality: null, // preset name or 'custom'; null until chosen (detected on first start)
  graphics: null, // the graphics options (see GRAPHICS_OPTIONS)
  autoQuality: false, // the preset was picked automatically
  gpu: '',
  mouseSensitivity: 1.0, // multiplier; base is 0.0022 rad per pixel
  adsSensitivity: 0.8, // extra multiplier while aiming (scaled by zoom automatically)
  invertY: false,
  fov: 75, // horizontal-ish feel; we store vertical FOV derived from this
  masterVolume: 0.8,
  effectsVolume: 1.0,
  showFps: false,
  crosshair: true, // hip-fire crosshair (hidden when aiming through the sights)
  units: 'metric',
  holdToCrouch: false,
  autoGearbox: true,
};

const KEY = 'hng.settings.v1';

export class Settings {
  constructor() {
    this.values = { ...DEFAULTS };
    this.listeners = [];
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) Object.assign(this.values, JSON.parse(raw));
    } catch {
      // Storage can be unavailable (private mode, sandboxed page). Defaults are fine.
    }
    const v = this.values;
    if (GRAPHICS_PRESETS[v.quality]) {
      // Saved on a preset (or by an older version that kept only its name): take the
      // preset as it is now, since an update may have retuned its values. Otherwise
      // the menu would show "Custom" though the player never changed anything.
      v.graphics = this._presetOptions(v.quality);
    } else if (!v.graphics || typeof v.graphics !== 'object') {
      const d = detectQuality();
      v.quality = d.preset;
      v.graphics = this._presetOptions(d.preset);
      v.autoQuality = true;
      v.gpu = d.gpu;
      this._save();
    }
    // Options added since the settings were saved take the preset's value.
    const base = GRAPHICS_PRESETS[v.quality] || GRAPHICS_PRESETS.high;
    for (const k of OPTION_KEYS) if (v.graphics[k] === undefined) v.graphics[k] = base[k];
    v.quality = matchPreset(v.graphics);
    // ?quality=low in the address bar (handy for slow machines and tests) applies a
    // preset for this visit without saving it.
    try {
      const q = new URLSearchParams(location.search).get('quality');
      if (q && GRAPHICS_PRESETS[q]) {
        this.session = { quality: q, graphics: this._presetOptions(q) };
      }
    } catch {
      /* ignore */
    }
  }

  _presetOptions(name) {
    const p = GRAPHICS_PRESETS[name];
    return Object.fromEntries(OPTION_KEYS.map((k) => [k, p[k]]));
  }

  _save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.values));
    } catch {
      /* ignore */
    }
  }

  get(k) {
    return this.values[k];
  }

  set(k, v) {
    this.values[k] = v;
    this._save();
    this._changed(k);
  }

  // Called with the key whenever a setting changes ('graphics' for any graphics option).
  listen(fn) {
    this.listeners.push(fn);
    return () => (this.listeners = this.listeners.filter((f) => f !== fn));
  }

  _changed(k) {
    for (const f of this.listeners) {
      try {
        f(k);
      } catch (e) {
        console.warn('settings listener failed', e);
      }
    }
  }

  // Current graphics options (a copy) and the preset they match ('custom' otherwise).
  get graphics() {
    return { ...(this.session?.graphics || this.values.graphics) };
  }

  get preset() {
    return this.session ? this.session.quality : this.values.quality;
  }

  setPreset(name) {
    if (!GRAPHICS_PRESETS[name]) return;
    this.session = null;
    this.values.quality = name;
    this.values.graphics = this._presetOptions(name);
    this.values.autoQuality = false;
    this._save();
    this._changed('graphics');
  }

  setGraphics(key, value) {
    if (this.session) {
      // Leaving the address-bar preset: start from it.
      this.values.graphics = { ...this.session.graphics };
      this.session = null;
    }
    this.values.graphics[key] = value;
    this.values.quality = matchPreset(this.values.graphics);
    this.values.autoQuality = false;
    this._save();
    this._changed('graphics');
  }

  get quality() {
    return resolveQuality(this.graphics, this.preset);
  }
}
