// Firing range: paper targets and steel gongs from 25 m to 800 m straight north of
// the firing line, plus a penetration test lane with real materials. A range card
// shows where your last shot landed, its flight time, speed and energy.
import * as THREE from 'three';
import { Box, FLAG_DEFAULT, FLAG_BULLET, FLAG_SIGHT } from '../../physics/collision.js';
import { projectUVs } from '../../weapons/models/kit.js';

const DISTANCES = [25, 50, 100, 150, 200, 300, 400, 500, 600, 800];

export class RangeMode {
  constructor(game) {
    this.game = game;
    this.targets = [];
    this.last = null;
    this.group = new THREE.Group();
    this.group.name = 'range';
  }

  playerSpawn() {
    return { x: 0, z: 6, yaw: 0 };
  }

  start() {
    const g = this.game;
    const hf = g.world.hf;
    const tex = g.world.textures;
    const wood = tex.standard('woodPlanks');
    const steelMat = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.55, metalness: 0.3 });
    const paperTex = makeTargetTexture();
    const paper = new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.9 });
    const earth = tex.standard('dirt');

    DISTANCES.forEach((d, i) => {
      const lane = (i % 2 === 0 ? -1 : 1) * (6 + (i % 5) * 3.5);
      const x = lane,
        z = -d;
      const y = hf.getHeight(x, z);
      const size = d >= 300 ? 1.6 : d >= 150 ? 1.2 : 0.9; // bigger boards far away
      // Paper target on a wooden frame.
      const board = new THREE.Mesh(new THREE.BoxGeometry(size, size, 0.02), [wood, wood, wood, wood, paper, wood]);
      board.position.set(x, y + 1.0 + size / 2, z);
      board.castShadow = board.receiveShadow = true;
      this.group.add(board);
      for (const s of [-1, 1]) {
        const post = new THREE.Mesh(projectUVs(new THREE.BoxGeometry(0.08, 1.2 + size, 0.08), 1.4), wood);
        post.position.set(x + s * (size / 2 + 0.04), y + (1.2 + size) / 2 - 0.1, z + 0.02);
        post.castShadow = true;
        this.group.add(post);
      }
      const box = new Box(x, y + 1.0 + size / 2, z, size / 2, size / 2, 0.01, 0, 'wood', FLAG_BULLET | FLAG_SIGHT);
      box.owner = { target: true, distance: d, cx: x, cy: y + 1.0 + size / 2, size };
      g.world.collision.add(box);
      // Steel gong beside it.
      const gong = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.28, size * 0.28, 0.012, 24), steelMat);
      gong.rotation.x = Math.PI / 2;
      gong.position.set(x + (lane < 0 ? -1 : 1) * (size + 0.6), y + 1.2, z);
      gong.castShadow = true;
      this.group.add(gong);
      const gbox = new Box(gong.position.x, gong.position.y, z, size * 0.28, size * 0.28, 0.006, 0, 'steel', FLAG_BULLET | FLAG_SIGHT);
      gbox.owner = { gong: true, distance: d, mesh: gong };
      g.world.collision.add(gbox);
      this.targets.push({ d, x, z, box, gong });
      // Distance sign.
      const sign = makeSign(`${d} m`);
      sign.position.set(x, y + 0.45, z + 0.6);
      this.group.add(sign);
    });

    // Earth berm behind the far targets as a backstop.
    const berm = new THREE.Mesh(projectUVs(new THREE.BoxGeometry(120, 8, 14), 3), earth);
    const by = hf.getHeight(0, -830);
    berm.position.set(0, by + 2, -830);
    berm.receiveShadow = true;
    this.group.add(berm);
    g.world.collision.add(new Box(0, by + 2, -830, 60, 4, 7, 0, 'soil'));

    // Penetration test lane at 30 m: what stops a bullet?
    const lane = [
      { name: 'Pine planks 2.5 cm', mat: 'wood', t: 0.025, look: wood },
      { name: 'Oak beam 20 cm', mat: 'wood', t: 0.2, look: tex.standard('woodDark') },
      { name: 'Brick wall 12 cm', mat: 'brick', t: 0.12, look: tex.standard('brick') },
      { name: 'Brick wall 25 cm', mat: 'brick', t: 0.25, look: tex.standard('brick') },
      { name: 'Sandbags 40 cm', mat: 'sandbag', t: 0.4, look: tex.standard('burlap') },
      { name: 'Concrete 15 cm', mat: 'concrete', t: 0.15, look: tex.standard('concrete') },
      { name: 'Mild steel 6 mm', mat: 'steel', t: 0.006, look: steelMat },
      { name: 'Mild steel 12 mm', mat: 'steel', t: 0.012, look: steelMat },
    ];
    lane.forEach((l, i) => {
      const x = 40 + i * 4,
        z = -30;
      const y = hf.getHeight(x, z);
      const m = new THREE.Mesh(projectUVs(new THREE.BoxGeometry(2.2, 2, Math.max(l.t, 0.006)), 1.5), l.look);
      m.position.set(x, y + 1, z);
      m.castShadow = m.receiveShadow = true;
      this.group.add(m);
      const b = new Box(x, y + 1, z, 1.1, 1, Math.max(l.t, 0.006) / 2, 0, l.mat, FLAG_DEFAULT);
      b.owner = { test: l.name };
      g.world.collision.add(b);
      // Witness board 2 m behind: shows whether rounds got through.
      const wb = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2, 0.02), paper);
      wb.position.set(x, y + 1, z - 2);
      this.group.add(wb);
      const wbb = new Box(x, y + 1, z - 2, 1.1, 1, 0.01, 0, 'wood', FLAG_BULLET);
      wbb.owner = { witness: l.name };
      g.world.collision.add(wbb);
      const sign = makeSign(l.name, 2.2);
      sign.position.set(x, y + 2.25, z + 0.3);
      this.group.add(sign);
    });

    g.world.add(this.group);

    // Motor pool behind the firing line, and tanks downrange to shoot at.
    this.vehicleSpots = [
      ['willys_mb', -26, 28, 0],
      ['kubelwagen', -20, 28, 0],
      ['gaz67', -14, 28, 0],
      ['opel_blitz', -36, 30, 0],
      ['m4a1_sherman', 2, 32, 0],
      ['panzer4_h', 12, 32, 0],
      ['t34_76', 22, 32, 0],
      ['m5a1_stuart', 2, 44, 0],
      ['tiger1', 13, 45, 0],
      ['t34_85', 24, 45, 0],
      ['panzer4_h', -42, -300, Math.PI],
      ['m4a1_sherman', 44, -200, Math.PI / 2],
      ['t34_76', -44, -500, Math.PI],
    ].map(([id, x, z, yaw]) => ({ id, x, z, yaw, v: g.spawnVehicle(id, x, z, yaw), deadT: 0 }));

    // Range card UI.
    const card = document.createElement('div');
    card.className = 'range-card';
    card.innerHTML = '<h3>Range card</h3><div class="body">Shoot a target. Targets stand at 25 to 800 m to the north; the penetration test lane is 30 m to the north-east.</div>';
    g.hud.root.appendChild(card);
    this.card = card.querySelector('.body');
    g.hud.hint('Firing range. RMB aims through the real sights; mouse wheel while aiming raises the sight for longer range. Targets: 25 to 800 m north; tanks at 200, 300 and 500 m. Vehicles are parked behind you: F gets in.', 14);
  }

  onImpact(p, info) {
    if (p.owner !== this.game.player.soldier) return;
    if (info.target?.isVehicle) {
      if (p.rangeReported) return;
      p.rangeReported = true;
      const v = info.target;
      const d = Math.hypot(info.x - p.owner.body.x, info.z - p.owner.body.z);
      const result = { penetrate: 'penetrated', nonpen: 'did not penetrate', ricochet: 'ricocheted' }[info.kind] || info.kind;
      this.show(v.def.name, [
        ['Plate', `${info.part || '?'} ${info.armorMM ?? '?'} mm`],
        ['Impact angle', `${Math.round(((info.angle || 0) * 180) / Math.PI)} deg`],
        ['Effective', `${Math.round(info.effMM || 0)} mm`],
        ['Round could pierce', `${Math.round(info.penMM || 0)} mm`],
        ['Result', result],
        ['Distance', `${d.toFixed(0)} m`],
        ['Speed', `${info.speed.toFixed(0)} m/s`],
      ]);
      return;
    }
    const o = info.box?.owner;
    // Report the first thing a round hits (it may carry on through a paper target).
    if (p.rangeReported) return;
    if (o?.target || o?.gong || o?.test || info.ground) p.rangeReported = true;
    const fly = p.age;
    const v = info.speed;
    const e = 0.5 * p.mass * v * v;
    if (o?.target) {
      // Offset from the bull's-eye in centimeters (right/up from the shooter's view).
      const dx = (info.x - o.cx) * 100,
        dy = (info.y - o.cy) * 100;
      this.show(`${o.distance} m target`, [
        ['Impact', `${dx >= 0 ? 'R' : 'L'} ${Math.abs(dx).toFixed(0)} cm, ${dy >= 0 ? 'high' : 'low'} ${Math.abs(dy).toFixed(0)} cm`],
        ['Flight time', `${fly.toFixed(3)} s`],
        ['Speed', `${v.toFixed(0)} m/s`],
        ['Energy', `${e.toFixed(0)} J`],
        ['Sight set', `${this.game.player.soldier.weapon.zeroRange} ${this.game.player.soldier.weapon.def.sight.unit}`],
      ]);
    } else if (o?.gong) {
      this.game.audio?.impact('steel', info.x, info.y, info.z, e * 3);
      o.mesh.rotation.z += 0.08;
      this.show(`${o.distance} m steel`, [
        ['Hit!', ''],
        ['Flight time', `${fly.toFixed(3)} s`],
        ['Speed', `${v.toFixed(0)} m/s`],
      ]);
    } else if (o?.test) {
      const through = info.kind === 'through';
      this.show(o.test, [
        ['Result', through ? 'went through' : info.kind === 'ricochet' ? 'ricocheted' : 'stopped'],
        ['Speed in', `${v.toFixed(0)} m/s`],
        ['Speed out', through ? `${info.exitSpeed.toFixed(0)} m/s` : '-'],
        ['Energy in', `${e.toFixed(0)} J`],
      ]);
    } else if (info.ground) {
      const d = Math.hypot(info.x - p.owner.body.x, info.z - p.owner.body.z);
      this.show('Ground', [
        ['Distance', `${d.toFixed(0)} m`],
        ['Flight time', `${fly.toFixed(3)} s`],
        ['Speed', `${v.toFixed(0)} m/s`],
      ]);
    }
  }

  show(title, rows) {
    this.card.innerHTML = `<div><b>${title}</b></div>` + rows.map(([a, b]) => `<div class="row"><span>${a}</span><span>${b}</span></div>`).join('');
  }

  // Wrecks are towed away and replaced after a while.
  update(dt) {
    const g = this.game;
    for (const spot of this.vehicleSpots || []) {
      const v = spot.v;
      if (v.alive) continue;
      spot.deadT += dt;
      if (spot.deadT < 20 || v.occupants.some((o) => o)) continue;
      v.removeFromWorld();
      g.vehicles.splice(g.vehicles.indexOf(v), 1);
      spot.v = g.spawnVehicle(spot.id, spot.x, spot.z, spot.yaw);
      spot.deadT = 0;
    }
  }
}

function makeTargetTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e8e2cf';
  g.fillRect(0, 0, 256, 256);
  for (let r = 10; r >= 1; r--) {
    g.beginPath();
    g.arc(128, 128, r * 12, 0, Math.PI * 2);
    g.fillStyle = r <= 4 ? '#1d1d1b' : '#e8e2cf';
    g.fill();
    g.strokeStyle = r <= 4 ? '#e8e2cf' : '#1d1d1b';
    g.lineWidth = 1.5;
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeSign(text, width = 1) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ddd6c0';
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#222';
  g.font = 'bold 30px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 34, 240);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, side: THREE.DoubleSide }));
  return m;
}
