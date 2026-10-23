// A running match: the world, the people and vehicles in it, and the rules.
import * as THREE from 'three';
import { Loop } from '../core/loop.js';
import { World } from './world.js';
import { Pipeline } from '../render/pipeline.js';
import { MAPS } from '../world/maps.js';
import { clamp } from '../core/math.js';

export class Game {
  constructor(app, opts) {
    this.app = app;
    this.opts = opts;
    this.renderer = app.renderer;
    this.input = app.input;
    this.settings = app.settings;
    this.quality = app.settings.quality;
    this.time = 0;
    this.camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, this.quality.viewDistance);
    this.camera.rotation.order = 'YXZ';
    this.spectator = { yaw: 0, pitch: 0, speed: 12 };
  }

  async load(progress) {
    const def = MAPS[this.opts.map];
    this.world = new World(this.renderer, this.camera, this.settings, def);
    await this.world.build(progress);
    this.pipeline = new Pipeline(this.renderer, this.quality);
    this.pipeline.setSky(this.world.sky.skyCube);

    // Starting view (can be overridden with ?cam=x,y,z,yawDeg,pitchDeg for screenshots).
    const cam = this.app.params.get('cam');
    if (cam) {
      const [x, y, z, yaw, pitch] = cam.split(',').map(Number);
      this.camera.position.set(x, y, z);
      this.spectator.yaw = ((yaw || 0) * Math.PI) / 180;
      this.spectator.pitch = ((pitch || 0) * Math.PI) / 180;
    } else {
      this.camera.position.set(-420, this.world.hf.getHeight(-420, 30) + 12, 30);
      this.spectator.yaw = -Math.PI / 2;
      this.spectator.pitch = -0.05;
    }
    this.loop = new Loop({
      step: 1 / 120,
      update: (dt) => this.update(dt),
      render: (fdt, alpha) => this.render(fdt, alpha),
    });
    this.app.canvas.addEventListener('click', () => this.input.lock());
  }

  start() {
    this.loop.start();
  }

  resize(w, h, pr) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.pipeline.setSize(w, h, pr);
    this.world.shadows.updateFrustums();
  }

  update(dt) {
    this.time += dt;
  }

  render(frameDt) {
    const input = this.input;
    // Spectator flight (temporary until the player soldier exists).
    const [mx, my] = input.takeMouse();
    const s = this.spectator;
    s.yaw -= mx * 0.0022;
    s.pitch = clamp(s.pitch - my * 0.0022, -1.5, 1.5);
    this.camera.rotation.set(s.pitch, s.yaw, 0);
    const fwd = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation);
    const right = new THREE.Vector3(1, 0, 0).applyEuler(this.camera.rotation);
    const sp = s.speed * (input.is('sprint') ? 5 : 1) * frameDt;
    if (input.is('forward')) this.camera.position.addScaledVector(fwd, sp);
    if (input.is('back')) this.camera.position.addScaledVector(fwd, -sp);
    if (input.is('right')) this.camera.position.addScaledVector(right, sp);
    if (input.is('left')) this.camera.position.addScaledVector(right, -sp);
    const ground = this.world.hf.getHeight(this.camera.position.x, this.camera.position.z);
    if (this.camera.position.y < ground + 0.5) this.camera.position.y = ground + 0.5;
    input.endFrame();

    this.camera.updateMatrixWorld();
    this.world.update(this.time, this.camera.position);
    this.world.shadows.update();
    this.pipeline.render(this.world.scene, this.camera, null, null, this.time);
  }
}
