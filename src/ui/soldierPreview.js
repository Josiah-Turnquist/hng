// The chosen soldier in 3D on the Heroes screen, standing at ease with his weapon
// in a pool of warm evening light, turned by dragging. Drawn with the game's own
// renderer into its canvas behind the menus, only while the menus show. It also
// takes side-view pictures of guns for the weapon cards.
//
//   const pv = new SoldierPreview(app.renderer);
//   pv.show({ faction, cls, seed, variant, primary });   // weapon id
//   pv.frame(el);          // where on the page he stands (the middle of el)
//   pv.start(); pv.stop(); pv.dispose();
//   const url = pv.gunPicture('m1_garand');   // data: URL, cached
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TextureLibrary } from '../render/textures.js';
import { makeGunMaterials } from '../weapons/models/kit.js';
import { MODELS, buildGun } from '../weapons/models/index.js';
import { WEAPONS } from '../weapons/defs.js';
import { SoldierModel } from '../actors/soldierModel.js';

const KIND = { rifle: 'rifle', semi: 'rifle', sniper: 'rifle', assault: 'rifle', carbine: 'rifle', atRifle: 'rifle', smg: 'smg', lmg: 'lmg', pistol: 'pistol', revolver: 'pistol', launcher: 'launcher', grenade: 'grenade', binoculars: 'binoculars' };
const ROLE = { smg: 'smg', lmg: 'mg', launcher: 'at', atRifle: 'at' };

function modelId(id) {
  const d = WEAPONS[id];
  if (!d) return null;
  return MODELS[d.model] ? d.model : MODELS[id] ? id : null;
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
    groundMat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\n gl_FragColor.rgb *= 1.0 - smoothstep(1.2, 4.4, length(vGroundXZ));',
      );
      sh.fragmentShader = 'varying vec2 vGroundXZ;\n' + sh.fragmentShader;
      sh.vertexShader = 'varying vec2 vGroundXZ;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vGroundXZ = position.xz;');
    };
    const ground = new THREE.Mesh(g, groundMat);
    ground.receiveShadow = true;
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
        // Feet above the name plate.
        const plate = this.el.querySelector('.fe-nameplate')?.getBoundingClientRect();
        bottom = plate && plate.height ? Math.min(b.bottom, plate.top + plate.height * 0.25) : b.bottom - b.height * 0.04;
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
    const r = this.renderer;
    const gun = buildGun(mid, this.gunMats, { lod: 0 });
    const scene = new THREE.Scene();
    scene.environment = this.env;
    scene.environmentIntensity = 0.6;
    const k = new THREE.DirectionalLight(0xfff0dc, 2.4);
    k.position.set(2, 3, 1);
    const f = new THREE.DirectionalLight(0xc0d0e8, 0.8);
    f.position.set(2, -1, -2);
    scene.add(k, f, new THREE.AmbientLight(0xffffff, 0.25), gun.root);
    // Binoculars read best from behind and a little to the side and above (the
    // two eyecups side by side, the halves running off behind them).
    if (gun.meta.binoculars) gun.root.rotation.set(0.35, Math.PI / 2 - 0.6, 0, 'YXZ');
    gun.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(gun.root);
    const c = box.getCenter(new THREE.Vector3());
    const s = box.getSize(new THREE.Vector3());
    // Seen from its right side (+x), muzzle (-z) to the right.
    const len = Math.max(s.z, (s.y * w) / h) * 1.08;
    const cam = new THREE.OrthographicCamera(-len / 2, len / 2, (len * h) / w / 2, (-len * h) / w / 2, 0.01, 10);
    cam.position.set(c.x + 3, c.y, c.z);
    cam.lookAt(c);
    // Twice the size, scaled down for smooth edges.
    const rt = new THREE.WebGLRenderTarget(w * 2, h * 2, { colorSpace: THREE.SRGBColorSpace });
    const saved = { tm: r.toneMapping, clear: r.getClearColor(new THREE.Color()), alpha: r.getClearAlpha() };
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
    const url = out.toDataURL('image/png');
    this.pictures.set(key, url);
    return url;
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
