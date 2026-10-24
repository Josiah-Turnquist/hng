// The static world: landscape, sky, shadows, roads, water, buildings, plants and the
// collision data that physics and bullets use.
import * as THREE from 'three';
import { generateTerrain } from '../world/terrainGen.js';
import { TerrainRenderer } from '../world/terrainMesh.js';
import { buildRoads, buildRiver } from '../world/roadsWater.js';
import { CollisionWorld } from '../physics/collision.js';
import { SkySystem } from '../render/sky.js';
import { Shadows } from '../render/shadows.js';
import { SHARED_UNIFORMS, setAlphaToCoverage } from '../render/pipeline.js';
import { TextureLibrary } from '../render/textures.js';
import { Atmosphere } from '../ballistics/atmosphere.js';
import { planVillage, buildVillage } from '../world/village/index.js';
import { buildVegetation } from '../world/vegetation.js';
import { RNG } from '../core/math.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

export class World {
  constructor(renderer, camera, settings, mapDef) {
    this.renderer = renderer;
    this.camera = camera;
    this.settings = settings;
    this.quality = settings.quality;
    this.def = mapDef;
    this.scene = new THREE.Scene();
    this.updaters = [];
    this.fogColor = new THREE.Color(0.62, 0.68, 0.75);
  }

  async build(progress = () => {}) {
    const q = this.quality;
    progress(0.02, 'Painting textures');
    await nextFrame();
    this.textures = new TextureLibrary(this.renderer, { size: q.textureSize, anisotropy: q.anisotropy });

    progress(0.12, 'Shaping the land');
    await nextFrame();
    this.terrain = generateTerrain(this.def);
    this.hf = this.terrain.hf;
    this.collision = new CollisionWorld(this.hf);
    this.atmosphere = new Atmosphere(this.def.altitude, this.def.temperatureC);
    if (this.def.wind) this.atmosphere.setWind(this.def.wind.speed, this.def.wind.from);
    // Water surface height at a point (rivers), or null on dry land.
    const riverData = this.terrain.river;
    this.waterLevelAt = (x, z) => {
      if (!riverData) return null;
      const [gx, gz] = this.hf.toGrid(x, z);
      const i = Math.round(gz) * this.hf.res + Math.round(gx);
      const d = riverData.distField.dist[i];
      if (!(d < riverData.half)) return null;
      return riverData.level[riverData.distField.nearest[i]] - 0.25;
    };
    this.collision.waterLevelAt = this.waterLevelAt;

    // The village shapes the ground under it, so plan it before the terrain mesh.
    if (this.def.objectives && this.def.village) {
      progress(0.22, 'Surveying the village');
      await nextFrame();
      this.villagePlan = planVillage(this.terrain, this.def, new RNG(this.def.seed * 7 + 3));
      this.hf.computeRange();
    }

    progress(0.3, 'Building the sky');
    await nextFrame();
    this.sky = new SkySystem(this.renderer, this.scene, q);
    this.sky.setSun(this.def.sun.elevation, this.def.sun.azimuth);
    this.sky.refresh();
    this.shadows = new Shadows(this.renderer, this.scene, this.camera, this.sky, q);
    // Summer haze: a thin, even haze plus denser air low over the ground (the map
    // can set its own: fog { density, falloff, base, haze }).
    const f = this.def.fog || {};
    SHARED_UNIFORMS.uFog.value.set(f.density ?? 0.0003, f.falloff ?? 0.006, f.base ?? this.hf.minH ?? 0, f.haze ?? 0.00008);

    progress(0.4, 'Laying out fields');
    await nextFrame();
    this.terrainRenderer = new TerrainRenderer(this.hf, this.textures, q);
    this.scene.add(this.terrainRenderer.group);

    progress(0.55, 'Roads and river');
    await nextFrame();
    this.scene.add(buildRoads(this.terrain, this.textures));
    const river = buildRiver(this.terrain, this.textures);
    if (river) {
      this.scene.add(river);
      this.updaters.push((t) => river.userData.update(t));
    }

    if (this.villagePlan) {
      progress(0.7, 'Building the village');
      await nextFrame();
      const t0 = performance.now();
      this.village = buildVillage(this.villagePlan, { terrain: this.terrain, def: this.def, collision: this.collision, textures: this.textures, textureSize: q.textureSize });
      this.scene.add(this.village.group);
      console.log(`village built in ${Math.round(performance.now() - t0)} ms`, this.village.stats);
    }

    progress(0.85, 'Planting trees and hedges');
    await nextFrame();
    this.vegetation = buildVegetation({ terrain: this.terrain, def: this.def, collision: this.collision, textures: this.textures, quality: q, village: this.village, plan: this.villagePlan, shadows: this.shadows, camera: this.camera });
    this.scene.add(this.vegetation.group);
    this.updaters.push((t, cam) => this.vegetation.update(cam, t));
    console.log(`vegetation built in ${this.vegetation.stats.buildMs} ms`, this.vegetation.stats.colliders);

    progress(0.95, 'Final touches');
    await nextFrame();
    this.shadows.prepare(this.scene);
    setAlphaToCoverage(this.scene, q.msaa > 0);
    progress(1, 'Ready');
  }

  // New graphics settings while playing (a resolved quality from settings.js).
  applyQuality(q) {
    this.quality = q;
    this.sky.setQuality(q);
    this.shadows.apply(q);
    this.terrainRenderer.quality = q;
    this.vegetation?.setQuality?.(q);
    setAlphaToCoverage(this.scene, q.msaa > 0);
  }

  // Add a dynamic object (vehicle, soldier, effect) to the world scene.
  add(obj) {
    this.scene.add(obj);
    this.shadows.prepare(obj);
    setAlphaToCoverage(obj, this.quality.msaa > 0);
    return obj;
  }

  update(time, cameraPos) {
    this.sky.update(time);
    this.terrainRenderer.update(cameraPos);
    for (const u of this.updaters) u(time, cameraPos);
  }
}
