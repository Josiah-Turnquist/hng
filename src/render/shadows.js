// Sun shadows. On medium and up we use cascaded shadow maps: several shadow maps,
// each covering a bigger slice of the view, so shadows are sharp up close and
// still present far away. On low there is a single shadow map that follows the camera.
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
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;

    if (quality.csm) {
      this.csm = new CSM({
        maxFar: quality.shadowDistance,
        cascades: quality.cascades,
        mode: 'practical',
        parent: scene,
        shadowMapSize: quality.shadowMapSize,
        lightDirection: sky.sunDir.clone().negate(),
        camera,
        lightIntensity: sky.sun.intensity,
        lightNear: 1,
        lightFar: 3000,
        lightMargin: 300,
        shadowBias: -0.00012,
      });
      this.csm.fade = true;
      for (const l of this.csm.lights) {
        l.shadow.normalBias = 0.035;
        l.shadow.radius = 2;
      }
    } else {
      const sun = sky.sun;
      sun.castShadow = true;
      sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
      const d = quality.shadowDistance;
      const c = sun.shadow.camera;
      c.left = -d;
      c.right = d;
      c.top = d;
      c.bottom = -d;
      c.near = 1;
      c.far = 2000;
      sun.shadow.bias = -0.0002;
      sun.shadow.normalBias = 0.04;
      scene.add(sun);
      scene.add(sun.target);
    }
  }

  // Every material drawn in the world must go through here, or (with cascades)
  // it would be lit once per cascade.
  setup(material) {
    if (!this.csm || material.userData.csm) return material;
    if (material.isShaderMaterial || material.isMeshBasicMaterial) return material;
    material.userData.csm = true;
    const prevOnBefore = material.onBeforeCompile;
    this.csm.setupMaterial(material);
    const csmHook = material.onBeforeCompile;
    material.onBeforeCompile = prevOnBefore;
    addPatch(material, 'csm', csmHook);
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

  updateFrustums() {
    if (this.csm) this.csm.updateFrustums();
  }

  update() {
    const sky = this.sky;
    if (this.csm) {
      this.csm.lightDirection.copy(sky.sunDir).negate();
      for (const l of this.csm.lights) {
        l.color.copy(sky.sun.color);
        l.intensity = sky.sun.intensity;
      }
      this.csm.update();
    } else {
      // Follow the camera, snapped to shadow-map texels to avoid shimmering.
      const sun = sky.sun;
      const cam = this.camera;
      const p = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
      const d = this.quality.shadowDistance;
      const texel = (2 * d) / this.quality.shadowMapSize;
      p.x = Math.round(p.x / texel) * texel;
      p.z = Math.round(p.z / texel) * texel;
      sun.target.position.copy(p);
      sun.position.copy(p).addScaledVector(sky.sunDir, 1000);
    }
  }
}
