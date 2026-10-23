// The static world: landscape, sky, shadows, roads, water, buildings, plants and the
// collision data that physics and bullets use.
import * as THREE from 'three';
import { generateTerrain } from '../world/terrainGen.js';
import { TerrainRenderer } from '../world/terrainMesh.js';
import { buildRoads, buildRiver } from '../world/roadsWater.js';
import { CollisionWorld } from '../physics/collision.js';
import { SkySystem } from '../render/sky.js';
import { Shadows } from '../render/shadows.js';
import { TextureLibrary } from '../render/textures.js';
import { Atmosphere } from '../ballistics/atmosphere.js';

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

    progress(0.3, 'Building the sky');
    await nextFrame();
    this.sky = new SkySystem(this.renderer, this.scene, q);
    this.sky.setSun(this.def.sun.elevation, this.def.sun.azimuth);
    this.sky.refresh();
    this.shadows = new Shadows(this.renderer, this.scene, this.camera, this.sky, q);

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

    progress(0.95, 'Final touches');
    await nextFrame();
    this.shadows.prepare(this.scene);
    progress(1, 'Ready');
  }

  // Add a dynamic object (vehicle, soldier, effect) to the world scene.
  add(obj) {
    this.scene.add(obj);
    this.shadows.prepare(obj);
    return obj;
  }

  update(time, cameraPos) {
    this.sky.update(time);
    this.terrainRenderer.update(cameraPos);
    for (const u of this.updaters) u(time, cameraPos);
  }
}
