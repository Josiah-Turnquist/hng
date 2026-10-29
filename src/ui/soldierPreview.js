// The chosen soldier in 3D on the Heroes screen, standing at ease with his weapon
// in a pool of warm evening light, turned by dragging. Drawn with the game's own
// renderer into its canvas behind the menus, only while the menus show. It also
// takes side-view pictures of guns for the weapon cards, and pictures of the
// parts their upgrades fit.
//
//   const pv = new SoldierPreview(app.renderer);
//   pv.show({ faction, cls, seed, variant, primary });   // weapon id
//   pv.frame(el);          // where on the page he stands (the middle of el)
//   pv.start(); pv.stop(); pv.dispose();
//   const url = pv.gunPicture('m1_garand');   // data: URL, cached
//   pv.partPicture('kar98k', 'u80');          // the part an upgrade fits, the same
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TextureLibrary } from '../render/textures.js';
import { makeGunMaterials } from '../weapons/models/kit.js';
import { MODELS, buildGun } from '../weapons/models/index.js';
import { partOf, partKey, buildPart } from '../weapons/models/upgradeParts.js';
import { WEAPONS } from '../weapons/defs.js';
import { SoldierModel } from '../actors/soldierModel.js';

const KIND = { rifle: 'rifle', semi: 'rifle', sniper: 'rifle', assault: 'rifle', carbine: 'rifle', atRifle: 'rifle', smg: 'smg', lmg: 'lmg', pistol: 'pistol', revolver: 'pistol', launcher: 'launcher', grenade: 'grenade', binoculars: 'binoculars', firstaid: 'grenade', medkit: 'grenade', wrench: 'grenade' };
const ROLE = { smg: 'smg', lmg: 'mg', launcher: 'at', atRifle: 'at' };

// A perspective camera looking at obj along dir (from obj toward the camera),
// as close as it can be with obj inside `fill` of the picture both ways,
// centered. In the camera's own axes (z toward the camera) a point (x, y, z)
// is in view when |x - cx| <= a (cz - z) with a = tan(fov / 2) * aspect * fill,
// and likewise for y: the nearest camera (cx, cy, cz) follows directly from the
// extremes of z +- x / a and z +- y / b. focus = [z0, z1]: frame only the part
// of obj between those z (its own), the rest may run out of the picture.
function frameView(obj, dir, fov, aspect, fill, focus = null) {
  const cam = new THREE.PerspectiveCamera(fov, aspect, 0.001, 50);
  cam.position.set(...dir);
  cam.lookAt(0, 0, 0);
  const inv = cam.quaternion.clone().invert();
  const tan = Math.tan((fov * Math.PI) / 360);
  const a = tan * aspect * fill,
    b = tan * fill;
  let A = -Infinity,
    B = -Infinity,
    C = -Infinity,
    D = -Infinity,
    zMin = Infinity,
    zMax = -Infinity;
  const v = new THREE.Vector3();
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      if (focus && (v.z < focus[0] || v.z > focus[1])) continue;
      v.applyQuaternion(inv);
      A = Math.max(A, v.z + v.x / a);
      B = Math.max(B, v.z - v.x / a);
      C = Math.max(C, v.z + v.y / b);
      D = Math.max(D, v.z - v.y / b);
      zMin = Math.min(zMin, v.z);
      zMax = Math.max(zMax, v.z);
    }
  });
  const cz = Math.max((A + B) / 2, (C + D) / 2);
  cam.position.set((a * (A - B)) / 2, (b * (C - D)) / 2, cz).applyQuaternion(cam.quaternion);
  cam.near = Math.max(0.0005, (cz - zMax) * 0.5);
  cam.far = cz - zMin + 3; // (what runs out of focus goes on behind)
  cam.updateProjectionMatrix();
  return cam;
}

function modelId(id) {
  const d = WEAPONS[id];
  if (!d) return null;
  return MODELS[d.model] ? d.model : MODELS[id] ? id : null;
}

// Backdrops for the soldier: sky colors top to horizon to bottom, the fog and
// the ground's edge, and layers of shapes along the horizon, from far (pale,
// very blurred) to near (darker, less blurred). shapes: what stands in the haze.
const BACKDROPS = {
  dark: { sky: ['#0d0e0c', '#0d0e0c', '#0d0e0c'], fog: '#0d0e0c', ground: '#000000', shapes: null },
  smoke: { field: ['#3a3a36', '#0e0e0c'], sky: ['#15161a', '#3a3a38', '#151512'], fog: '#2a2a28', ground: '#141412', shapes: ['trees', 'village', 'trees'], tone: ['#4a4a46', '#2e2e2b', '#1e1e1c'], blur: [26, 16, 9], vignette: 'medium' },
  mist: { field: ['#8a8d89', '#3a3c37'], sky: ['#5c6266', '#a3a7a6', '#4a4c48'], fog: '#8d918f', ground: '#5d5f5a', shapes: ['trees', 'village', 'soldiers'], tone: ['#8a8e8d', '#6c706e', '#4c4f4c'], blur: [24, 14, 8], vignette: 'light', env: 0.42 },
  dusk: { field: ['#7a5636', '#1e160e'], sky: ['#2a2018', '#b8814a', '#2a2218'], fog: '#7a5a3a', ground: '#2e241a', shapes: ['ruins', 'trees', 'tank'], tone: ['#8e6440', '#5a3e26', '#2c2016'], blur: [28, 16, 9], vignette: 'medium', env: 0.36 },
  pale: { field: ['#b8b5a9', '#76726a'], sky: ['#9a9a92', '#d6d3c8', '#8e8b80'], fog: '#c4c1b6', ground: '#8f8b7f', shapes: ['trees', 'village'], tone: ['#bdbaaf', '#a3a094'], blur: [30, 18], vignette: 'none', env: 0.5 },
  night: { field: ['#1c2330', '#05060a'], sky: ['#06080e', '#1c2433', '#07090c'], fog: '#151b26', ground: '#07080b', shapes: ['trees', 'village', 'trees'], tone: ['#2a3343', '#1a2130', '#10141c'], blur: [24, 14, 8], vignette: 'medium' },
};
export const BACKDROP_NAMES = Object.keys(BACKDROPS);

// Paint a backdrop's sky and its shapes on a canvas (seeded, so the same each time).
function paintBackdrop(b) {
  const W = 1600,
    H = 900;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, b.sky[0]);
  g.addColorStop(0.58, b.sky[1]);
  g.addColorStop(1, b.sky[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  let x0 = 7;
  const rnd = () => ((x0 = (x0 * 16807) % 2147483647) - 1) / 2147483646;
  const horizon = H * 0.6;
  b.shapes.forEach((kind, layer) => {
    ctx.save();
    ctx.filter = `blur(${b.blur[layer]}px)`;
    ctx.fillStyle = b.tone[layer];
    const base = horizon + layer * 24;
    const scale = 1 + layer * 0.45;
    if (kind === 'trees')
      for (let x = -60; x < W + 60; x += 30 + rnd() * 50) {
        const h = (60 + rnd() * 110) * scale;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.ellipse(x + (rnd() - 0.5) * 30, base - h * (0.45 + k * 0.2), h * 0.28, h * 0.3, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillRect(x - 4, base - h * 0.4, 8, h * 0.4);
      }
    if (kind === 'village' || kind === 'ruins')
      for (let x = 40 + rnd() * 80; x < W; x += 120 + rnd() * 160) {
        const w = (70 + rnd() * 90) * scale,
          h = (50 + rnd() * 70) * scale;
        ctx.beginPath();
        if (kind === 'ruins') {
          // Broken walls: jagged tops.
          ctx.moveTo(x, base);
          for (let k = 0; k <= 6; k++) ctx.lineTo(x + (w * k) / 6, base - h * (0.4 + rnd() * 0.6));
          ctx.lineTo(x + w, base);
        } else {
          ctx.moveTo(x, base);
          ctx.lineTo(x, base - h);
          ctx.lineTo(x + w / 2, base - h - h * 0.55);
          ctx.lineTo(x + w, base - h);
          ctx.lineTo(x + w, base);
        }
        ctx.fill();
        if (kind === 'village' && rnd() < 0.18) {
          // A church spire.
          ctx.beginPath();
          ctx.moveTo(x + w * 0.4, base - h);
          ctx.lineTo(x + w * 0.5, base - h - 190 * scale);
          ctx.lineTo(x + w * 0.6, base - h);
          ctx.fill();
        }
      }
    if (kind === 'soldiers')
      for (let k = 0; k < 9; k++) {
        const x = rnd() * W,
          h = (70 + rnd() * 30) * scale;
        ctx.beginPath();
        ctx.ellipse(x, base - h * 0.92, h * 0.07, h * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x - h * 0.1, base - h * 0.82, h * 0.2, h * 0.45);
        ctx.fillRect(x - h * 0.08, base - h * 0.4, h * 0.07, h * 0.4);
        ctx.fillRect(x + h * 0.01, base - h * 0.4, h * 0.07, h * 0.4);
        ctx.fillRect(x + h * 0.08, base - h * 0.8, h * 0.4, h * 0.03); // his rifle
      }
    if (kind === 'tank')
      for (const x of [W * 0.18, W * 0.8]) {
        const s = 1.6 * scale;
        ctx.fillRect(x - 80 * s, base - 34 * s, 160 * s, 34 * s);
        ctx.fillRect(x - 40 * s, base - 60 * s, 80 * s, 28 * s);
        ctx.fillRect(x + 30 * s, base - 50 * s, 90 * s, 8 * s);
      }
    ctx.restore();
  });
  // The ground running down from the horizon to the bottom of the picture:
  // rolling fields in bands, paler and sharper far off, darker and more
  // blurred near (out of focus in front of him), strewn with bushes, rocks,
  // fence posts, shell craters and grass, bigger the nearer they are.
  const far = b.field?.[0] || b.tone[0],
    near = b.field?.[1] || b.sky[2];
  const mix = (t) => {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const A = p(far),
      B = p(near);
    return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
  };
  const bands = 7;
  for (let k = 0; k < bands; k++) {
    const t = k / (bands - 1);
    const y = horizon + 10 + Math.pow(t, 1.6) * (H - horizon);
    ctx.save();
    ctx.filter = `blur(${(6 + t * 22).toFixed(0)}px)`;
    ctx.fillStyle = mix(t);
    ctx.beginPath();
    ctx.moveTo(-80, H + 80);
    const amp = 10 + t * 40,
      freq = 0.002 + rnd() * 0.004,
      ph = rnd() * 10;
    for (let x = -80; x <= W + 80; x += 40) ctx.lineTo(x, y + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 2.7 + ph * 2) * amp * 0.4);
    ctx.lineTo(W + 80, H + 80);
    ctx.fill();
    ctx.restore();
  }
  // Things on the ground, near ones bigger and more blurred.
  for (let i = 0; i < 70; i++) {
    const t = Math.pow(rnd(), 0.8);
    const y = horizon + 18 + t * (H - horizon);
    const x = rnd() * W;
    const s = 6 + t * 70;
    ctx.save();
    ctx.filter = `blur(${(4 + t * 16).toFixed(0)}px)`;
    ctx.fillStyle = mix(Math.min(1, t + 0.25));
    const kind = rnd();
    ctx.beginPath();
    if (kind < 0.4) {
      // A bush or a clump of grass.
      for (let k = 0; k < 4; k++) ctx.ellipse(x + (rnd() - 0.5) * s, y - s * 0.3, s * (0.4 + rnd() * 0.3), s * (0.25 + rnd() * 0.2), 0, 0, Math.PI * 2);
    } else if (kind < 0.6) {
      // A rock.
      ctx.ellipse(x, y, s * 0.5, s * 0.25, 0, 0, Math.PI * 2);
    } else if (kind < 0.75) {
      // A shell crater: a dark hollow with a rim.
      ctx.ellipse(x, y, s * 1.2, s * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = mix(Math.max(0, t - 0.3));
      ctx.beginPath();
      ctx.ellipse(x, y - s * 0.12, s * 1.3, s * 0.12, 0, Math.PI, Math.PI * 2);
    } else if (kind < 0.88) {
      // A fence post, leaning.
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((rnd() - 0.5) * 0.3);
      ctx.fillRect(-s * 0.05, -s * 0.9, s * 0.1, s * 0.9);
      ctx.restore();
    } else {
      // Tall grass.
      for (let k = 0; k < 6; k++) {
        const gx = x + (rnd() - 0.5) * s;
        ctx.moveTo(gx, y);
        ctx.lineTo(gx + (rnd() - 0.5) * s * 0.4, y - s * (0.6 + rnd() * 0.6));
        ctx.lineTo(gx + s * 0.06, y);
      }
    }
    ctx.fill();
    ctx.restore();
  }
  // Haze over all of it, thickest along the horizon.
  const h = ctx.createLinearGradient(0, horizon - 260, 0, horizon + 140);
  h.addColorStop(0, 'rgba(0,0,0,0)');
  h.addColorStop(0.6, `${b.fog}66`);
  h.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = h;
  ctx.fillRect(0, 0, W, H);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class SoldierPreview {
  constructor(renderer) {
    this.renderer = renderer;
    this.lib = new TextureLibrary(renderer, { size: 512 });
    this.gunMats = makeGunMaterials(this.lib);
    const scene = new THREE.Scene();
    this.scene = scene;
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = this.env;
    scene.environmentIntensity = 0.28;
    scene.background = new THREE.Color(0x0d0e0c);
    scene.fog = new THREE.Fog(0x0d0e0c, 6, 14);
    // A low sun from the left (warm), a cool fill from the right, a rim light behind.
    const key = new THREE.DirectionalLight(0xffd2a0, 3.2);
    key.position.set(-3.5, 3.2, 2.6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = key.shadow.camera.bottom = -1.6;
    key.shadow.camera.right = key.shadow.camera.top = 1.6;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 12;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    const fill = new THREE.DirectionalLight(0x9fb4d0, 0.55);
    fill.position.set(3, 1.6, 2);
    const rim = new THREE.DirectionalLight(0xffe6c0, 1.4);
    rim.position.set(1.2, 2.4, -3.5);
    scene.add(key, fill, rim, new THREE.HemisphereLight(0x8a96a0, 0x2a261e, 0.35));
    // Ground: trodden earth fading into the dark.
    const g = new THREE.CircleGeometry(4.5, 48);
    g.rotateX(-Math.PI / 2);
    const tex = this.lib.get('dirt');
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x8a8070, map: tex.map, normalMap: tex.normalMap, roughness: 1 });
    for (const t of [tex.map, tex.normalMap]) if (t) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    // (It fades out into the backdrop's ground color.)
    this.groundFade = new THREE.Color(0x000000);
    groundMat.onBeforeCompile = (sh) => {
      sh.uniforms.uFade = { value: this.groundFade };
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\n gl_FragColor.rgb = mix(gl_FragColor.rgb, uFade, smoothstep(1.2, 4.4, length(vGroundXZ)));',
      );
      sh.fragmentShader = 'uniform vec3 uFade;\nvarying vec2 vGroundXZ;\n' + sh.fragmentShader;
      sh.vertexShader = 'varying vec2 vGroundXZ;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vGroundXZ = position.xz;');
    };
    const ground = new THREE.Mesh(g, groundMat);
    ground.receiveShadow = true;
    ground.visible = false; // (no floor: he stands against the backdrop)
    scene.add(ground);
    this.camera = new THREE.PerspectiveCamera(26, 1, 0.1, 40);
    // Facing the camera (models face -z), turned a little toward the light.
    this.yaw = Math.PI - 0.45;
    this.targetYaw = this.yaw;
    this.model = null;
    this.key = '';
    this.running = false;
    this.cx = 0.5;
    this.pictures = new Map();
    this._state = { stance: 0, stanceBlend: 0, speed: 0, localVelX: 0, localVelZ: 0, sprinting: false, onGround: true, yaw: 0, aimPitch: -0.05, aimYawOffset: 0, aiming: false, lean: 0, recoil: 0, action: null, actionT: 0, alive: true, deathT: 0, seated: false };
  }

  // The backdrop behind him (BACKDROPS): a painted sky with blurred shapes
  // in the haze, the ground fading into it.
  setBackdrop(name = 'dark') {
    const b = BACKDROPS[name] || BACKDROPS.dark;
    if (this.backdrop === b) return;
    this.backdrop = b;
    this.scene.background?.dispose?.();
    this.scene.background = b.shapes ? paintBackdrop(b) : new THREE.Color(b.sky[1]);
    this.scene.fog.color.set(b.fog);
    this.groundFade.set(b.ground);
    this.scene.environmentIntensity = b.env ?? 0.28;
  }

  // Dress and arm the soldier (rebuilt only when something changed).
  show({ faction, cls, seed, variant, primary }) {
    const k = `${faction}|${cls}|${seed}|${variant}|${primary}`;
    if (k === this.key) return;
    this.key = k;
    if (this.model) {
      this.scene.remove(this.model.root);
      this.model.dispose?.();
    }
    const def = WEAPONS[primary];
    const kind = KIND[def?.type] || 'rifle';
    let m;
    try {
      m = new SoldierModel(faction, this.lib, { seed, lod: 0, cls, role: ROLE[def?.type] || 'rifle', variant });
    } catch (e) {
      console.warn('Soldier preview failed', e);
      this.model = null;
      return;
    }
    const mid = modelId(primary);
    if (mid) m.setWeapon(buildGun(mid, this.gunMats, { lod: 0 }), kind);
    m.setGround(() => 0);
    m.root.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    this.scene.add(m.root);
    this.model = m;
    // Settle into the pose.
    this._state.yaw = this.yaw;
    for (let i = 0; i < 90; i++) m.update(1 / 60, this._state);
  }

  // Stand him in the middle of el (a box on the page), the camera framing him there.
  frame(el) {
    this.el = el;
  }

  // Turn him by dragging across el.
  enableDrag(el) {
    let x0 = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest?.('button')) return; // (a button over him: its click, not a turn)
      x0 = e.clientX;
      el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (x0 === null) return;
      this.targetYaw += (e.clientX - x0) * 0.012;
      x0 = e.clientX;
    });
    const end = () => (x0 = null);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  start() {
    if (this.running) return;
    this.running = true;
    const r = this.renderer;
    this._saved = { tm: r.toneMapping, exp: r.toneMappingExposure, shadows: r.shadowMap.enabled, type: r.shadowMap.type };
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    let last = performance.now();
    const tick = () => {
      if (!this.running) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this._render(dt);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.raf);
    const r = this.renderer;
    const s = this._saved;
    r.toneMapping = s.tm;
    r.toneMappingExposure = s.exp;
    r.shadowMap.enabled = s.shadows;
    r.shadowMap.type = s.type;
    r.setClearColor(0x000000, 1);
    r.clear();
  }

  _render(dt) {
    const r = this.renderer;
    const W = r.domElement.clientWidth || innerWidth,
      H = r.domElement.clientHeight || innerHeight;
    const size = r.getSize(new THREE.Vector2());
    if (Math.abs(size.x - W) > 1 || Math.abs(size.y - H) > 1) r.setSize(W, H, false);
    // Where he stands on the page.
    let cx = W / 2,
      bottom = H * 0.92,
      top = H * 0.12;
    if (this.el?.isConnected) {
      const b = this.el.getBoundingClientRect();
      if (b.width > 40 && b.height > 80) {
        cx = b.left + b.width / 2;
        top = b.top + b.height * 0.07;
        // Feet above whatever sits under him (the name plate, or his badge),
        // if it is in the lower half of the box.
        const under = [...this.el.querySelectorAll('.fe-nameplate, .hx-badges')].map((e) => e.getBoundingClientRect()).filter((r) => r.height && r.top > b.top + b.height * 0.5);
        bottom = under.length ? Math.min(b.bottom, ...under.map((r) => r.top + r.height * 0.25)) : b.bottom - b.height * 0.04;
      }
    }
    const cam = this.camera;
    cam.aspect = W / H;
    // Frame a 2 m tall man from top to bottom of the box, from 5.2 m away.
    const dist = 5.2;
    const span = Math.max(0.2, (bottom - top) / H);
    cam.fov = (2 * Math.atan((2.05 / span / 2) / dist) * 180) / Math.PI;
    const midY = (top + bottom) / 2;
    // The view centered on the box: shift the image so the soldier stands there.
    cam.setViewOffset(W, H, W / 2 - cx, H / 2 - midY, W, H);
    cam.position.set(0, 1.12, dist);
    cam.lookAt(0, 0.98, 0);
    cam.updateProjectionMatrix();
    this.targetYaw += dt * 0.05; // a slow turn on his own
    this.yaw += (this.targetYaw - this.yaw) * Math.min(1, dt * 8);
    if (this.model) {
      // (The model takes its facing from the state it is given.)
      this._state.yaw = this.yaw;
      this.model.update(dt, this._state);
    }
    r.setRenderTarget(null);
    r.render(this.scene, cam);
  }

  // A side view of a gun on a clear background, muzzle to the right (data: URL).
  gunPicture(id, w = 240, h = 80) {
    const key = `${id}@${w}x${h}`;
    if (this.pictures.has(key)) return this.pictures.get(key);
    const mid = modelId(id);
    if (!mid) return '';
    const gun = buildGun(mid, this.gunMats, { lod: 0 });
    // Binoculars read best from behind and a little to the side and above (the
    // two eyecups side by side, the halves running off behind them). A kit or
    // tool is modeled as the hand holds it: meta.picture turns it to show its
    // face, lying along.
    if (gun.meta.binoculars) gun.root.rotation.set(0.35, Math.PI / 2 - 0.6, 0, 'YXZ');
    if (gun.meta.picture) gun.root.rotation.set(...gun.meta.picture);
    const scene = this._pictureScene(gun.root);
    const box = new THREE.Box3().setFromObject(gun.root);
    const c = box.getCenter(new THREE.Vector3());
    const s = box.getSize(new THREE.Vector3());
    // Seen from its right side (+x), muzzle (-z) to the right.
    const len = Math.max(s.z, (s.y * w) / h) * 1.08;
    const cam = new THREE.OrthographicCamera(-len / 2, len / 2, (len * h) / w / 2, (-len * h) / w / 2, 0.01, 10);
    cam.position.set(c.x + 3, c.y, c.z);
    cam.lookAt(c);
    const url = this._snapshot(scene, cam, w, h);
    this.pictures.set(key, url);
    return url;
  }

  // The part an upgrade (u...) or a round (a...) fits to this gun (barrel, bolt,
  // spring, trigger group, sights, scope, cartridge), seen from three quarters
  // and filling a picture on a clear background (data: URL). Guns that take the
  // same part share its picture.
  partPicture(gun, upgradeId, w = 160, h = 110) {
    const part = partOf(gun, upgradeId);
    if (!part) return '';
    const key = `part:${partKey(part)}@${w}x${h}`;
    if (this.pictures.has(key)) return this.pictures.get(key);
    const built = buildPart(part, this.gunMats, { lod: 0 });
    const scene = this._pictureScene(built.root);
    const view = built.meta.view || {};
    const cam = frameView(built.root, view.dir || [0.7, 0.5, 0.5], view.fov || 20, w / h, 0.88, view.focus);
    const url = this._snapshot(scene, cam, w, h);
    this.pictures.set(key, url);
    return url;
  }

  // A scene for a picture: obj under a warm key light and a cool fill.
  _pictureScene(obj) {
    const scene = new THREE.Scene();
    scene.environment = this.env;
    scene.environmentIntensity = 0.6;
    const k = new THREE.DirectionalLight(0xfff0dc, 2.4);
    k.position.set(2, 3, 1);
    const f = new THREE.DirectionalLight(0xc0d0e8, 0.8);
    f.position.set(2, -1, -2);
    scene.add(k, f, new THREE.AmbientLight(0xffffff, 0.25), obj);
    obj.updateMatrixWorld(true);
    return scene;
  }

  // Render a picture scene on a clear background (data: URL), then free its
  // geometry.
  _snapshot(scene, cam, w, h) {
    const r = this.renderer;
    // Twice the size, scaled down for smooth edges.
    const rt = new THREE.WebGLRenderTarget(w * 2, h * 2, { colorSpace: THREE.SRGBColorSpace });
    const saved = { clear: r.getClearColor(new THREE.Color()), alpha: r.getClearAlpha() };
    r.setRenderTarget(rt);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(scene, cam);
    const px = new Uint8Array(w * 2 * h * 2 * 4);
    r.readRenderTargetPixels(rt, 0, 0, w * 2, h * 2, px);
    r.setRenderTarget(null);
    r.setClearColor(saved.clear, saved.alpha);
    rt.dispose();
    scene.traverse((o) => o.geometry?.dispose?.());
    const big = document.createElement('canvas');
    big.width = w * 2;
    big.height = h * 2;
    const bctx = big.getContext('2d');
    const img = bctx.createImageData(w * 2, h * 2);
    // (Rows come bottom up.)
    for (let y = 0; y < h * 2; y++) img.data.set(px.subarray((h * 2 - 1 - y) * w * 8, (h * 2 - y) * w * 8), y * w * 8);
    bctx.putImageData(img, 0, 0);
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const octx = out.getContext('2d');
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(big, 0, 0, w, h);
    return out.toDataURL('image/png');
  }

  dispose() {
    this.stop();
    if (this.model) this.scene.remove(this.model.root);
    this.scene.traverse((o) => {
      o.geometry?.dispose?.();
    });
    this.env.dispose();
    this.lib.dispose?.();
  }
}
