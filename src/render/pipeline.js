// The frame is drawn in stages:
//  1. the world (solid objects) into an HDR target with a depth texture; multisampled
//     when edge smoothing is "Sharp" (then leaves and grass use alpha to coverage)
//  2. contact shadows (ambient occlusion) from the depth, at half resolution
//  3. atmosphere: distance haze and height fog from the depth, so every material gets
//     the same aerial perspective; contact shadows are applied here
//  4. "Smoothest" edge smoothing (TAA): the camera moves by a fraction of a pixel
//     every frame and each pixel is blended with where it was in the frames before
//  5. see-through effects (smoke, dust, tracers, muzzle flashes) on top, depth-tested
//  6. motion blur from the camera's movement (optional)
//  7. the first-person weapon, drawn last with its own camera so it never clips
//     walls; when aiming with "focus when aiming" it goes on its own layer and the
//     parts near the eye are blurred
//  8. eye adaptation (exposure follows the brightness of the view), sun rays, bloom,
//     then tone mapping and a film-style grade, vignette and grain
//  9. FXAA or a light sharpening, scaled up to the screen
// Settings changes are applied with apply(quality) while running.
import * as THREE from 'three';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import * as FX from './postfx.glsl.js';

export const LAYER_WORLD = 0;
export const LAYER_FX = 1;

export { ATMOSPHERE_PARS } from './postfx.glsl.js';

// Uniforms shared with the shaders drawn after the atmosphere pass (smoke, dust,
// sparks, tracers), so they sit in the same air and fade where they meet solid
// surfaces. The sky (sun, sky cube) and the pipeline (depth, screen) keep them current.
export const SHARED_UNIFORMS = {
  tSceneDepth: { value: null },
  uScreen: { value: new THREE.Vector4(1, 1, 1, 1) }, // render size and 1 / size
  uCamNearFar: { value: new THREE.Vector2(0.1, 3000) },
  tSkyCube: { value: null },
  uFog: { value: new THREE.Vector4(0.0003, 0.0035, 0, 0.00007) },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunColor: { value: new THREE.Color(1, 0.95, 0.85) }, // hue of sunlight
  uSunLight: { value: new THREE.Color(4.6, 4.4, 3.9) }, // sunlight on a surface facing the sun
  uSkyScale: { value: 1 },
  uAmbient: { value: new THREE.Color(0.25, 0.3, 0.36) }, // sky light on a surface facing up
};

// Sub-pixel camera offsets for TAA (Halton 2, 3).
const HALTON = [];
for (let i = 1; i <= 8; i++) {
  const h = (b) => {
    let f = 1,
      r = 0,
      n = i;
    while (n > 0) {
      f /= b;
      r += f * (n % b);
      n = Math.floor(n / b);
    }
    return r;
  };
  HALTON.push([h(2) - 0.5, h(3) - 0.5]);
}

const BLOOM_LEVELS = 5;

function hdrTarget(w, h, { depth = false, depthTexture = false, samples = 0 } = {}) {
  const rt = new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    depthBuffer: depth || depthTexture,
    samples,
  });
  if (depthTexture) {
    rt.depthTexture = new THREE.DepthTexture(w, h);
    rt.depthTexture.type = THREE.UnsignedIntType;
  }
  rt.texture.generateMipmaps = false;
  return rt;
}

export class Pipeline {
  constructor(renderer, quality) {
    this.renderer = renderer;
    this.q = quality;
    this.width = 1;
    this.height = 1;
    this.pixelRatio = 1;
    this.rw = 1;
    this.rh = 1;
    this.frame = 0;
    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fsGeo = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(this.fsGeo);
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);
    this.prevViewProj = new THREE.Matrix4();
    this.hasPrev = false;
    this.prevCam = new THREE.Vector3();
    this.prevDir = new THREE.Vector3();
    this.savedProj = new THREE.Matrix4();
    this.savedProjInv = new THREE.Matrix4();
    this.tmpV = new THREE.Vector3();
    this.tmpV4 = new THREE.Vector4();
    this.clearColor = new THREE.Color();
    this.taaIndex = 0;
    this.adaptIndex = 0;
    this.adaptReset = true;
    this.exposure = 1.0 / 0.6; // matches three's ACES exposure before this pipeline

    const S = SHARED_UNIFORMS;
    const mat = (frag, uniforms, extra = {}) =>
      new THREE.ShaderMaterial({ vertexShader: FX.FS_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, ...extra });

    this.ldrRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType, depthBuffer: false });
    this.hdrRT = hdrTarget(1, 1, { depth: true });

    // Contact shadows.
    this.aoMat = mat(FX.AO_FRAG, {
      tDepth: { value: null },
      uInvProj: { value: new THREE.Matrix4() },
      uProj: { value: new THREE.Matrix4() },
      uTexel: { value: new THREE.Vector2() },
      uAO: { value: new THREE.Vector4(0.6, 1, 120, 0) },
    });
    this.aoBlurMat = mat(FX.AO_BLUR_FRAG, { tAO: { value: null }, uTexel: { value: new THREE.Vector2() } });

    // Atmosphere (and contact shadows applied).
    this.atmos = mat(
      FX.ATMOS_FRAG,
      {
        tColor: { value: null },
        tDepth: { value: null },
        tAO: { value: null },
        uInvProj: { value: new THREE.Matrix4() },
        uCamWorld: { value: new THREE.Matrix4() },
        uCamPos: { value: new THREE.Vector3() },
        uAOParams: { value: new THREE.Vector4(0, 60, 120, 0) },
        uAOTexel: { value: new THREE.Vector2(1, 1) },
        uFar: { value: 3000 },
        tSkyCube: S.tSkyCube,
        uFog: S.uFog,
        uSunDir: S.uSunDir,
        uSunColor: S.uSunColor,
        uSkyScale: S.uSkyScale,
      },
      // Depth testing must be on (with "always pass") or the GPU won't write depth.
      { depthTest: true, depthFunc: THREE.AlwaysDepth, depthWrite: true },
    );

    // TAA.
    this.taaMat = mat(FX.TAA_FRAG, {
      tCurrent: { value: null },
      tHistory: { value: null },
      tDepth: { value: null },
      uInvProj: { value: new THREE.Matrix4() },
      uCamWorld: { value: new THREE.Matrix4() },
      uPrevViewProj: { value: new THREE.Matrix4() },
      uCamPos: { value: new THREE.Vector3() },
      uTexel: { value: new THREE.Vector2() },
      uReset: { value: 1 },
    });
    this.copyMat = mat(FX.COPY_FRAG, { tColor: { value: null } });

    // Motion blur.
    this.motionMat = mat(FX.MOTION_FRAG, {
      tColor: { value: null },
      tDepth: { value: null },
      uInvProj: { value: new THREE.Matrix4() },
      uCamWorld: { value: new THREE.Matrix4() },
      uPrevViewProj: { value: new THREE.Matrix4() },
      uTexel: { value: new THREE.Vector2() },
      uAmount: { value: 0.5 },
    });

    // Focus when aiming.
    this.dofMat = mat(FX.DOF_FRAG, {
      tColor: { value: null },
      tLayer: { value: null },
      tLayerDepth: { value: null },
      uNearFar: { value: new THREE.Vector2(0.01, 30) },
      uTexel: { value: new THREE.Vector2() },
      uAmount: { value: 0 },
      uMaxBlur: { value: 6 },
    });

    // Bloom chain.
    this.bloomDownMat = mat(FX.BLOOM_DOWN_FRAG, { tColor: { value: null }, uTexel: { value: new THREE.Vector2() }, uClamp: { value: 1e4 } });
    this.bloomUpMat = mat(FX.BLOOM_UP_FRAG, { tColor: { value: null }, tBase: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1 } });

    // Sun rays.
    this.shaftMaskMat = mat(FX.SHAFT_MASK_FRAG, { tColor: { value: null }, tDepth: { value: null }, uSun: { value: new THREE.Vector2() }, uAspect: { value: 1 } });
    this.shaftBlurMat = mat(FX.SHAFT_BLUR_FRAG, { tMask: { value: null }, uSun: { value: new THREE.Vector2() }, uStep: { value: 0.6 } });
    this.shaftColor = new THREE.Vector3();

    // Eye adaptation: 64 x 32 log luminance, adapted value in 1 x 1 targets.
    this.lumRT = hdrTarget(64, 32);
    this.adaptRTs = [hdrTarget(1, 1), hdrTarget(1, 1)];
    this.lumMat = mat(FX.LUM_FRAG, { tColor: { value: null } });
    this.adaptMat = mat(FX.ADAPT_FRAG, { tLum: { value: this.lumRT.texture }, tPrev: { value: null }, uRate: { value: new THREE.Vector2(0.05, 0.02) }, uReset: { value: 1 } });

    // A black 1 x 1 texture for passes that are switched off.
    this.black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.black.needsUpdate = true;

    this.grade = mat(FX.GRADE_FRAG, {
      tColor: { value: null },
      tBloom: { value: this.black },
      tShafts: { value: this.black },
      tAdapt: { value: this.black },
      uTime: { value: 0 },
      uExposure: { value: this.exposure },
      // Key (log2 of the average brightness the exposure is set for), the most it
      // darkens and brightens (stops), and how strongly it follows.
      uAdaptRange: { value: new THREE.Vector4(-4.2, -0.6, 1.2, 0.5) },
      uBloom: { value: new THREE.Vector2(0, 1) },
      uShaftColor: { value: this.shaftColor },
      uVignette: { value: 0.22 },
      uGrain: { value: 0.03 },
      uSaturation: { value: 0.9 },
      uContrast: { value: 0.12 },
      uShadowTint: { value: new THREE.Vector3(0.96, 0.99, 1.04) },
      uHighlightTint: { value: new THREE.Vector3(1.03, 1.0, 0.95) },
      uBlack: { value: 0.012 },
      uAberration: { value: 0 },
      uDamage: { value: 0 },
      uBlur: { value: 0 },
      uFlash: { value: 0 },
    });

    for (const [k, m] of Object.entries(this)) if (m?.isShaderMaterial) m.name = k.replace(/Mat$/, '');
    this.fxaa = new THREE.ShaderMaterial({
      vertexShader: FXAAShader.vertexShader,
      fragmentShader: FXAAShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(FXAAShader.uniforms),
      depthTest: false,
      depthWrite: false,
    });
    this.sharpenMat = mat(FX.SHARPEN_FRAG, { tColor: { value: this.ldrRT.texture }, uTexel: { value: new THREE.Vector2() }, uSharpness: { value: 0.3 } });
    this.fxaa.name = 'fxaa';
    this.sharpenMat.name = 'sharpen';
    this.passes = [];

    this.apply(quality);
  }

  // Apply graphics settings (a resolved quality, see settings.js). Can be called at
  // any time; targets are made or freed as needed.
  apply(q) {
    this.q = q;
    this.scale = q.renderScale ?? 1;
    const samples = q.msaa || 0;
    if (!this.sceneRT || this.sceneRT.samples !== samples) {
      this.sceneRT?.dispose();
      this.sceneRT?.depthTexture?.dispose();
      this.sceneRT = hdrTarget(this.rw, this.rh, { depthTexture: true, samples });
    }
    const want = (on, key, make) => {
      if (on && !this[key]) this[key] = make();
      else if (!on && this[key]) {
        const t = this[key];
        for (const rt of Array.isArray(t) ? t : [t]) {
          rt.dispose();
          rt.depthTexture?.dispose();
        }
        this[key] = null;
      }
    };
    want(q.ssao, 'aoRTs', () => [hdrTarget(1, 1), hdrTarget(1, 1)]);
    want(q.taa, 'taaRTs', () => [hdrTarget(1, 1), hdrTarget(1, 1)]);
    want(q.motionBlur || q.depthOfField, 'hdrB', () => hdrTarget(1, 1, { depth: true }));
    want(q.depthOfField, 'vmRT', () => hdrTarget(1, 1, { depthTexture: true }));
    want(q.bloom, 'bloomRTs', () => Array.from({ length: BLOOM_LEVELS * 2 }, () => hdrTarget(1, 1)));
    want(q.lightShafts, 'shaftRTs', () => [hdrTarget(1, 1), hdrTarget(1, 1)]);
    if (this.aoMat.defines.AO_SAMPLES !== (q.aoQuality === 'high' ? 16 : 8)) {
      this.aoMat.defines.AO_SAMPLES = q.aoQuality === 'high' ? 16 : 8;
      this.aoMat.needsUpdate = true;
    }
    this.aoMat.uniforms.uAO.value.set(q.aoQuality === 'high' ? 0.75 : 0.6, q.aoQuality === 'high' ? 1.1 : 1, q.aoQuality === 'high' ? 160 : 110, 0);
    this.atmos.uniforms.uAOParams.value.set(q.ssao ? 0.85 : 0, q.aoQuality === 'high' ? 90 : 60, q.aoQuality === 'high' ? 160 : 110, 0);
    this.taaReset = true;
    if (this.width > 1) this.setSize(this.width, this.height, this.pixelRatio);
  }

  setSize(w, h, pixelRatio) {
    this.width = w;
    this.height = h;
    this.pixelRatio = pixelRatio;
    const s = this.scale * pixelRatio;
    const rw = Math.max(1, Math.floor(w * s)),
      rh = Math.max(1, Math.floor(h * s));
    this.rw = rw;
    this.rh = rh;
    const half = (v) => Math.max(1, Math.floor(v / 2));
    this.sceneRT.setSize(rw, rh);
    this.hdrRT.setSize(rw, rh);
    this.ldrRT.setSize(rw, rh);
    this.hdrB?.setSize(rw, rh);
    this.vmRT?.setSize(rw, rh);
    this.taaRTs?.forEach((t) => t.setSize(rw, rh));
    this.aoRTs?.forEach((t) => t.setSize(half(rw), half(rh)));
    this.shaftRTs?.forEach((t) => t.setSize(Math.max(1, Math.floor(rw / 4)), Math.max(1, Math.floor(rh / 4))));
    if (this.bloomRTs) {
      for (let i = 0; i < BLOOM_LEVELS; i++) {
        const bw = Math.max(1, rw >> (i + 1)),
          bh = Math.max(1, rh >> (i + 1));
        this.bloomRTs[i].setSize(bw, bh);
        this.bloomRTs[BLOOM_LEVELS + i].setSize(bw, bh);
      }
    }
    this.fxaa.uniforms.resolution.value.set(1 / rw, 1 / rh);
    this.sharpenMat.uniforms.uTexel.value.set(1 / rw, 1 / rh);
    this.dofMat.uniforms.uMaxBlur.value = Math.max(3, rh * 0.012);
    SHARED_UNIFORMS.uScreen.value.set(rw, rh, 1 / rw, 1 / rh);
    this.taaReset = true;
  }

  setSky(cubeTexture) {
    SHARED_UNIFORMS.tSkyCube.value = cubeTexture;
  }

  _pass(material, target) {
    this.passes.push(material.name);
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.fsCam);
  }

  // scene/camera: the world; viewScene/viewCamera: the first-person weapon (or null).
  // info: { aim (0..1, how far the sights are raised), dt (s) }.
  render(scene, camera, viewScene, viewCamera, time, info = {}) {
    const r = this.renderer;
    const q = this.q;
    const S = SHARED_UNIFORMS;
    const dt = info.dt ?? 1 / 60;
    const autoClear = r.autoClear;
    this.frame++;
    // Names of the full-screen passes drawn this frame (for debugging and costs).
    this.passes = ['world'];

    // Big camera jumps (respawn, vehicle seat change) restart the history-based passes.
    const camPos = this.tmpV.setFromMatrixPosition(camera.matrixWorld);
    const dir = new THREE.Vector3(0, 0, -1).transformDirection(camera.matrixWorld);
    const jumped = !this.hasPrev || camPos.distanceTo(this.prevCam) > 6 || dir.dot(this.prevDir) < 0.6;

    // TAA moves the camera by a fraction of a pixel each frame.
    if (q.taa) {
      const j = HALTON[this.frame % HALTON.length];
      this.savedProj.copy(camera.projectionMatrix);
      this.savedProjInv.copy(camera.projectionMatrixInverse);
      camera.projectionMatrix.elements[8] -= (j[0] * 2) / this.rw;
      camera.projectionMatrix.elements[9] -= (j[1] * 2) / this.rh;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    }

    // 1) Solid world.
    r.shadowMap.needsUpdate = true;
    camera.layers.set(LAYER_WORLD);
    r.setRenderTarget(this.sceneRT);
    r.autoClear = true;
    r.render(scene, camera);
    r.autoClear = false;
    const depth = this.sceneRT.depthTexture;
    S.tSceneDepth.value = depth;
    S.uCamNearFar.value.set(camera.near, camera.far);

    // 2) Contact shadows.
    if (this.aoRTs) {
      const u = this.aoMat.uniforms;
      u.tDepth.value = depth;
      u.uInvProj.value.copy(camera.projectionMatrixInverse);
      u.uProj.value.copy(camera.projectionMatrix);
      u.uTexel.value.set(1 / this.rw, 1 / this.rh);
      u.uAO.value.w = q.taa ? (this.frame % 4) * 0.39 : 0;
      this._pass(this.aoMat, this.aoRTs[0]);
      this.aoBlurMat.uniforms.tAO.value = this.aoRTs[0].texture;
      this.aoBlurMat.uniforms.uTexel.value.set(1 / this.aoRTs[0].width, 1 / this.aoRTs[0].height);
      this._pass(this.aoBlurMat, this.aoRTs[1]);
    }

    // 3) Atmosphere into the HDR target, with the depth.
    const a = this.atmos.uniforms;
    a.tColor.value = this.sceneRT.texture;
    a.tDepth.value = depth;
    a.tAO.value = this.aoRTs ? this.aoRTs[1].texture : this.black;
    if (this.aoRTs) a.uAOTexel.value.set(1 / this.aoRTs[1].width, 1 / this.aoRTs[1].height);
    a.uInvProj.value.copy(camera.projectionMatrixInverse);
    a.uCamWorld.value.copy(camera.matrixWorld);
    a.uCamPos.value.copy(camPos);
    a.uFar.value = camera.far;
    r.setRenderTarget(this.hdrRT);
    r.clear(true, true, false);
    this.passes.push('atmosphere');
    this.quad.material = this.atmos;
    r.render(this.quadScene, this.fsCam);

    // 4) TAA: blend with the history, then put the result back for the effects.
    if (this.taaRTs) {
      const t = this.taaMat.uniforms;
      const prev = this.taaRTs[this.taaIndex],
        next = this.taaRTs[1 - this.taaIndex];
      t.tCurrent.value = this.hdrRT.texture;
      t.tHistory.value = prev.texture;
      t.tDepth.value = depth;
      t.uInvProj.value.copy(camera.projectionMatrixInverse);
      t.uCamWorld.value.copy(camera.matrixWorld);
      t.uPrevViewProj.value.copy(this.prevViewProj);
      t.uTexel.value.set(1 / this.rw, 1 / this.rh);
      t.uReset.value = this.taaReset || jumped ? 1 : 0;
      this._pass(this.taaMat, next);
      this.copyMat.uniforms.tColor.value = next.texture;
      this._pass(this.copyMat, this.hdrRT);
      this.taaIndex = 1 - this.taaIndex;
      this.taaReset = false;
    }
    if (q.taa) {
      camera.projectionMatrix.copy(this.savedProj);
      camera.projectionMatrixInverse.copy(this.savedProjInv);
    }

    // 5) See-through effects. (The scene's matrices were updated for the world pass
    // this frame; skipping that saves the CPU a second walk through every object.)
    r.setRenderTarget(this.hdrRT);
    camera.layers.set(LAYER_FX);
    const autoMatrix = scene.matrixWorldAutoUpdate;
    scene.matrixWorldAutoUpdate = false;
    this.passes.push('effects');
    r.render(scene, camera);
    scene.matrixWorldAutoUpdate = autoMatrix;
    camera.layers.set(LAYER_WORLD);
    let cur = this.hdrRT;

    // 6) Motion blur from the camera's movement.
    if (q.motionBlur && this.hdrB && !jumped) {
      const m = this.motionMat.uniforms;
      m.tColor.value = cur.texture;
      m.tDepth.value = depth;
      m.uInvProj.value.copy(camera.projectionMatrixInverse);
      m.uCamWorld.value.copy(camera.matrixWorld);
      m.uPrevViewProj.value.copy(this.prevViewProj);
      m.uTexel.value.set(1 / this.rw, 1 / this.rh);
      // Half a frame's movement, as a film camera's 180 degree shutter.
      m.uAmount.value = 0.5 * Math.min(1, 1 / 30 / Math.max(dt, 1e-3));
      this._pass(this.motionMat, this.hdrB);
      cur = this.hdrB;
    }

    // 7) First-person weapon.
    const aim = info.aim ?? 0;
    if (viewScene && viewCamera) {
      if (q.depthOfField && this.vmRT && aim > 0.05) {
        r.getClearColor(this.clearColor);
        const ca = r.getClearAlpha();
        r.setClearColor(0x000000, 0);
        r.setRenderTarget(this.vmRT);
        r.clear(true, true, false);
        this.passes.push('weapon layer');
        r.render(viewScene, viewCamera);
        r.setClearColor(this.clearColor, ca);
        const d = this.dofMat.uniforms;
        d.tColor.value = cur.texture;
        d.tLayer.value = this.vmRT.texture;
        d.tLayerDepth.value = this.vmRT.depthTexture;
        d.uNearFar.value.set(viewCamera.near, viewCamera.far);
        d.uTexel.value.set(1 / this.rw, 1 / this.rh);
        d.uAmount.value = Math.min(1, (aim - 0.05) / 0.6);
        const out = cur === this.hdrRT ? this.hdrB : this.hdrRT;
        this._pass(this.dofMat, out);
        cur = out;
      } else {
        r.setRenderTarget(cur);
        r.clearDepth();
        this.passes.push('weapon');
        r.render(viewScene, viewCamera);
      }
    }

    // 8) Eye adaptation, sun rays, bloom.
    this._adapt(cur, dt);
    this._shafts(camera);
    this._bloom(cur);

    // 9) Grade, then FXAA or sharpening to the screen.
    const g = this.grade.uniforms;
    g.tColor.value = cur.texture;
    g.uTime.value = time;
    const sharpen = q.taa ? 0.45 : this.scale < 0.99 ? 0.35 : q.msaa ? 0.15 : 0;
    if (q.fxaa) {
      this._pass(this.grade, this.ldrRT);
      this.fxaa.uniforms.tDiffuse.value = this.ldrRT.texture;
      this._pass(this.fxaa, null);
    } else if (sharpen > 0) {
      this._pass(this.grade, this.ldrRT);
      this.sharpenMat.uniforms.uSharpness.value = sharpen;
      this._pass(this.sharpenMat, null);
    } else {
      this._pass(this.grade, null);
    }
    r.autoClear = autoClear;

    // Remember this camera for the next frame (TAA, motion blur).
    this.prevViewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.prevCam.copy(camPos);
    this.prevDir.copy(dir);
    this.hasPrev = true;
  }

  _adapt(src, dt) {
    this.lumMat.uniforms.tColor.value = src.texture;
    this._pass(this.lumMat, this.lumRT);
    const prev = this.adaptRTs[this.adaptIndex],
      next = this.adaptRTs[1 - this.adaptIndex];
    const u = this.adaptMat.uniforms;
    u.tPrev.value = prev.texture;
    // About 0.7 s to adapt to brighter light, 2.5 s to darker.
    u.uRate.value.set(1 - Math.exp(-dt / 0.7), 1 - Math.exp(-dt / 2.5));
    u.uReset.value = this.adaptReset ? 1 : 0;
    this._pass(this.adaptMat, next);
    this.adaptIndex = 1 - this.adaptIndex;
    this.adaptReset = false;
    this.grade.uniforms.tAdapt.value = next.texture;
  }

  _shafts(camera) {
    const g = this.grade.uniforms;
    this.shaftColor.set(0, 0, 0);
    g.tShafts.value = this.black;
    if (!this.shaftRTs) return;
    const S = SHARED_UNIFORMS;
    const sun = S.uSunDir.value;
    if (sun.y < 0.02) return;
    const p = this.tmpV4.set(sun.x, sun.y, sun.z, 0).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
    if (p.w <= 0) return;
    const sx = (p.x / p.w) * 0.5 + 0.5,
      sy = (p.y / p.w) * 0.5 + 0.5;
    const off = Math.max(Math.abs(sx - 0.5), Math.abs(sy - 0.5));
    const vis = 1 - THREE.MathUtils.smoothstep(off, 0.55, 1.1);
    if (vis <= 0) return;
    const m = this.shaftMaskMat.uniforms;
    m.tColor.value = this.sceneRT.texture;
    m.tDepth.value = S.tSceneDepth.value;
    m.uSun.value.set(sx, sy);
    m.uAspect.value = this.rw / this.rh;
    this._pass(this.shaftMaskMat, this.shaftRTs[0]);
    const b = this.shaftBlurMat.uniforms;
    b.uSun.value.set(sx, sy);
    b.tMask.value = this.shaftRTs[0].texture;
    b.uStep.value = 0.7;
    this._pass(this.shaftBlurMat, this.shaftRTs[1]);
    b.tMask.value = this.shaftRTs[1].texture;
    b.uStep.value = 0.25;
    this._pass(this.shaftBlurMat, this.shaftRTs[0]);
    g.tShafts.value = this.shaftRTs[0].texture;
    const c = S.uSunColor.value;
    const k = 0.07 * vis * THREE.MathUtils.smoothstep(sun.y, 0.02, 0.12);
    this.shaftColor.set(c.r * k, c.g * k, c.b * k);
  }

  _bloom(src) {
    const g = this.grade.uniforms;
    if (!this.bloomRTs) {
      g.uBloom.value.set(0, 1);
      g.tBloom.value = this.black;
      return;
    }
    const down = this.bloomRTs.slice(0, BLOOM_LEVELS),
      up = this.bloomRTs.slice(BLOOM_LEVELS);
    const d = this.bloomDownMat.uniforms;
    let input = src;
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      d.tColor.value = input.texture;
      d.uTexel.value.set(1 / input.width, 1 / input.height);
      d.uClamp.value = i === 0 ? 40 : 1e4;
      this._pass(this.bloomDownMat, down[i]);
      input = down[i];
    }
    const u = this.bloomUpMat.uniforms;
    let small = down[BLOOM_LEVELS - 1];
    for (let i = BLOOM_LEVELS - 2; i >= 0; i--) {
      u.tColor.value = small.texture;
      u.tBase.value = down[i].texture;
      u.uTexel.value.set(1 / small.width, 1 / small.height);
      this._pass(this.bloomUpMat, up[i]);
      small = up[i];
    }
    g.tBloom.value = up[0].texture;
    // The result adds up all levels; a small share of the light is spread out.
    const k = 0.045;
    g.uBloom.value.set(k / BLOOM_LEVELS, 1 - k);
  }

  dispose() {
    for (const k of ['sceneRT', 'hdrRT', 'ldrRT', 'hdrB', 'vmRT', 'lumRT']) {
      this[k]?.dispose();
      this[k]?.depthTexture?.dispose();
    }
    for (const k of ['aoRTs', 'taaRTs', 'bloomRTs', 'shaftRTs', 'adaptRTs']) this[k]?.forEach((t) => t.dispose());
  }
}

// Alpha to coverage: with a multisampled target, alpha-tested leaves and grass get
// smooth edges instead of stair steps. Only right with multisampling (without it the
// whole card would be drawn), so it follows the edge smoothing setting.
export function setAlphaToCoverage(root, on) {
  root.traverse((o) => {
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (!(m.alphaTest > 0) || m.transparent || m.isMeshDepthMaterial || m.isMeshDistanceMaterial || m.alphaToCoverage === on) continue;
      m.alphaToCoverage = on;
      m.needsUpdate = true;
    }
  });
}
