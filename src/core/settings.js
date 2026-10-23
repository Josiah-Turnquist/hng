// Player settings (saved in the browser) and graphics quality presets.

export const QUALITY_PRESETS = {
  low: {
    label: 'Low',
    renderScale: 0.75,
    maxPixelRatio: 1,
    csm: false,
    cascades: 1,
    shadowMapSize: 2048,
    shadowDistance: 70,
    ssao: false,
    bloom: false,
    fxaa: true,
    textureSize: 512,
    anisotropy: 4,
    grassDensity: 0.35,
    grassDistance: 35,
    treeDistance: 600,
    terrainLod: 0.6,
    viewDistance: 1500,
  },
  medium: {
    label: 'Medium',
    renderScale: 1,
    maxPixelRatio: 1,
    csm: true,
    cascades: 2,
    shadowMapSize: 2048,
    shadowDistance: 220,
    ssao: false,
    bloom: true,
    fxaa: true,
    textureSize: 1024,
    anisotropy: 8,
    grassDensity: 0.65,
    grassDistance: 50,
    treeDistance: 1000,
    terrainLod: 1,
    viewDistance: 2200,
  },
  high: {
    label: 'High',
    renderScale: 1,
    maxPixelRatio: 1.5,
    csm: true,
    cascades: 3,
    shadowMapSize: 2048,
    shadowDistance: 380,
    ssao: true,
    bloom: true,
    fxaa: true,
    textureSize: 1024,
    anisotropy: 16,
    grassDensity: 1,
    grassDistance: 70,
    treeDistance: 1500,
    terrainLod: 1.4,
    viewDistance: 3000,
  },
  ultra: {
    label: 'Ultra',
    renderScale: 1,
    maxPixelRatio: 2,
    csm: true,
    cascades: 4,
    shadowMapSize: 4096,
    shadowDistance: 600,
    ssao: true,
    bloom: true,
    fxaa: true,
    textureSize: 2048,
    anisotropy: 16,
    grassDensity: 1.4,
    grassDistance: 90,
    treeDistance: 2200,
    terrainLod: 2,
    viewDistance: 3000,
  },
};

const DEFAULTS = {
  quality: 'high',
  mouseSensitivity: 1.0, // multiplier; base is 0.0022 rad per pixel
  adsSensitivity: 0.8, // extra multiplier while aiming (scaled by zoom automatically)
  invertY: false,
  fov: 75, // horizontal-ish feel; we store vertical FOV derived from this
  masterVolume: 0.8,
  effectsVolume: 1.0,
  showFps: false,
  units: 'metric',
  holdToCrouch: false,
  autoGearbox: true,
};

const KEY = 'hng.settings.v1';

export class Settings {
  constructor() {
    this.values = { ...DEFAULTS };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) Object.assign(this.values, JSON.parse(raw));
    } catch {
      // Storage can be unavailable (private mode). Defaults are fine.
    }
    // Allow ?quality=low in the address bar (handy for slow machines and tests).
    try {
      const q = new URLSearchParams(location.search).get('quality');
      if (q && QUALITY_PRESETS[q]) this.values.quality = q;
    } catch {
      /* ignore */
    }
  }

  get(k) {
    return this.values[k];
  }

  set(k, v) {
    this.values[k] = v;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.values));
    } catch {
      /* ignore */
    }
  }

  get quality() {
    return QUALITY_PRESETS[this.values.quality] || QUALITY_PRESETS.high;
  }
}
