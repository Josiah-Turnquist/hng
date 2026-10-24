// Sun shadows with cascaded shadow maps: several shadow maps, each covering a farther
// slice of the view, so shadows are sharp up close and still present far away (Low
// uses a single map over a short distance). The shadow settings can be changed while
// playing (apply): the maps are remade and the materials recompiled.
//
// The near cascades are drawn every frame; the far ones every other frame, taking
// turns (they change slowly), unless the camera moves or turns quickly.
import * as THREE from 'three';
import { CSM } from 'three/addons/csm/CSM.js';
import { addPatch } from './materialPatch.js';

export class Shadows {
  constructor(renderer, scene, camera, sky, quality) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.sky = sky;
    this.quality = quality;
    this.materials = new Set();
    this.frame = 0;
    this.lastPos = new THREE.Vector3(1e9, 0, 0);
    this.lastDir = new THREE.Vector3();
    this.tmpDir = new THREE.Vector3();
    // Uniforms shared by every material (the cascade splits along the view).
    this.uCascades = { value: [] };
    this.uNear = { value: 0.1 };
    this.uFar = { value: 300 };
    this.hook = (shader) => {
      shader.uniforms.CSM_cascades = this.uCascades;
      shader.uniforms.cameraNear = this.uNear;
      shader.uniforms.shadowFar = this.uFar;
    };
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    this.apply(quality);
  }

  // Change shadow quality and distance (a resolved quality from settings.js).
  apply(q) {
    this.quality = q;
    const cascades = q.shadows ? Math.max(1, q.cascades) : 1;
    const size = q.shadowMapSize || 2048;
    if (!this.csm || this.csm.cascades !== cascades || this.csm.shadowMapSize !== size) this._build(cascades, size);
    this.csm.maxFar = q.shadowDistance;
    const cast = q.shadows !== false;
    for (const l of this.csm.lights) {
      if (l.castShadow !== cast) l.castShadow = cast;
    }
    this.updateFrustums();
    this.forceUpdate = true;
  }

  _build(cascades, size) {
    if (this.csm) {
      this.csm.remove();
      for (const l of this.csm.lights) {
        l.shadow.map?.dispose();
        l.dispose?.();
      }
    }
    // Note: the CSM shader chunks are installed globally when it is created; materials
    // without USE_CSM keep three's normal lighting.
    this.csm = new CSM({
      maxFar: this.quality.shadowDistance,
      cascades,
      mode: 'practical',
      parent: this.scene,
      shadowMapSize: size,
      lightDirection: this.sky.sunDir.clone().negate(),
      camera: this.camera,
      lightIntensity: this.sky.sun.intensity,
      lightNear: 1,
      lightFar: 1400,
      lightMargin: 250,
      shadowBias: -0.00004,
    });
    this.csm.fade = true;
    for (const l of this.csm.lights) {
      l.shadow.autoUpdate = false;
      l.shadow.needsUpdate = true;
    }
    for (const m of this.materials) this._defines(m);
  }

  _defines(m) {
    m.defines = m.defines || {};
    if (m.defines.CSM_CASCADES !== this.csm.cascades || !('CSM_FADE' in m.defines)) {
      m.defines.USE_CSM = 1;
      m.defines.CSM_CASCADES = this.csm.cascades;
      m.defines.CSM_FADE = '';
      m.needsUpdate = true;
    }
  }

  // Every lit material drawn in the world must go through here, or (with cascades)
  // it would be lit once per cascade.
  setup(material) {
    if (material.userData.csm) return material;
    if (material.isShaderMaterial || material.isMeshBasicMaterial || material.isMeshDepthMaterial || material.isMeshDistanceMaterial) return material;
    material.userData.csm = true;
    this._defines(material);
    addPatch(material, 'csm', this.hook);
    this.materials.add(material);
    return material;
  }

  // Walk an object tree and set up every material.
  prepare(root) {
    root.traverse((o) => {
      if (!o.material) return;
      if (Array.isArray(o.material)) o.material.forEach((m) => this.setup(m));
      else this.setup(o.material);
    });
  }

  // After the camera's field of view or far plane changed.
  updateFrustums() {
    const csm = this.csm;
    csm.updateFrustums();
    csm._getExtendedBreaks(this.uCascades.value);
    this.uNear.value = this.camera.near;
    this.uFar.value = Math.min(this.camera.far, csm.maxFar);
    // Push shadow lookups out along the surface normal by about one shadow-map texel
    // of each cascade (so far cascades, with bigger texels, don't speckle).
    for (const l of csm.lights) {
      const c = l.shadow.camera;
      const texel = (c.right - c.left) / csm.shadowMapSize;
      l.shadow.normalBias = Math.max(0.02, texel * 1.3);
    }
  }

  update() {
    const sky = this.sky;
    const csm = this.csm;
    csm.lightDirection.copy(sky.sunDir).negate();
    csm.lights.forEach((l, i) => {
      l.color.copy(sky.sun.color);
      // Without shadows every cascade light would light everything: keep one.
      l.intensity = l.castShadow || i === 0 ? sky.sun.intensity : 0;
    });
    csm.update();
    // Which cascades to redraw this frame.
    this.frame++;
    const cam = this.camera;
    const pos = cam.position;
    cam.getWorldDirection(this.tmpDir);
    const fast = this.forceUpdate || pos.distanceToSquared(this.lastPos) > 0.6 * 0.6 || this.tmpDir.dot(this.lastDir) < 0.9986;
    this.lastPos.copy(pos);
    this.lastDir.copy(this.tmpDir);
    this.forceUpdate = false;
    const n = csm.lights.length;
    csm.lights.forEach((l, i) => {
      l.shadow.needsUpdate = fast || i < 2 || n <= 2 || (this.frame + i) % 2 === 0;
    });
  }
}
