// Simple stand-in models (boxes and cylinders at the right size) used when a
// vehicle has no detailed model. Same conventions as the real models: meters,
// -Z forward, origin on the ground at the middle of the wheelbase/tracks.
import * as THREE from 'three';

export function buildPlaceholder(def, color = 0x4b5320) {
  const root = new THREE.Group();
  root.name = def.name;
  const parts = {};
  const anchors = {};
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.9, metalness: 0.1 });
  const mesh = (geo, mat, x, y, z, parent = root) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const part = (name, x, y, z) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    root.add(g);
    parts[name] = g;
    return g;
  };
  const [W, H, L] = def.dims;
  if (def.kind === 'wheeled') {
    const r = def.wheelRadius;
    mesh(new THREE.BoxGeometry(W * 0.92, 0.55, L), paint, 0, r + 0.35, 0);
    mesh(new THREE.BoxGeometry(W * 0.8, 0.25, L * 0.35), paint, 0, r + 0.75, -L * 0.28);
    const wheel = new THREE.CylinderGeometry(r, r, 0.18, 20).rotateZ(Math.PI / 2);
    for (const [n, sx, sz] of [
      ['wheelFL', -1, -1],
      ['wheelFR', 1, -1],
      ['wheelRL', -1, 1],
      ['wheelRR', 1, 1],
    ]) {
      const g = part(n, (sx * def.track) / 2, r, (sz * def.wheelbase) / 2);
      mesh(wheel, dark, 0, 0, 0, g);
      mesh(new THREE.BoxGeometry(0.05, r * 0.6, 0.05), paint, sx * 0.1, 0, 0, g);
    }
    anchors.driverEye = new THREE.Vector3(-0.32, 1.35, 0.05);
    anchors.seat1 = new THREE.Vector3(0.32, 0.7, 0.05);
    anchors.seat2 = new THREE.Vector3(-0.32, 0.75, 0.8);
    anchors.seat3 = new THREE.Vector3(0.32, 0.75, 0.8);
    anchors.exhaustL = new THREE.Vector3(-0.5, 0.35, L / 2);
  } else {
    const r = def.roadWheelRadius;
    const hullH = H * 0.55;
    mesh(new THREE.BoxGeometry(W * 0.75, hullH, L), paint, 0, 0.45 + hullH / 2, 0);
    const turret = part('turret', 0, 0.45 + hullH, -0.2);
    mesh(new THREE.BoxGeometry(W * 0.6, H * 0.35, W * 0.7), paint, 0, H * 0.175, 0, turret);
    const gun = part('gun', 0, 0.45 + hullH + H * 0.18, -0.2 - W * 0.35);
    mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 12).rotateX(Math.PI / 2), paint, 0, 0, -1.3, gun);
    const n = def.roadWheels || 6;
    const wheel = new THREE.CylinderGeometry(r, r, 0.25, 16).rotateZ(Math.PI / 2);
    for (const [side, sx] of [
      ['L', -1],
      ['R', 1],
    ]) {
      for (let i = 0; i < n; i++) {
        const z = -def.contactLength / 2 + (def.contactLength * i) / Math.max(1, n - 1);
        const g = part(`road${side}${i}`, (sx * def.trackCenters) / 2, r, z);
        mesh(wheel, dark, 0, 0, 0, g);
      }
    }
    anchors.muzzle = new THREE.Vector3(0, gun.position.y, gun.position.z - 2.6);
    anchors.coaxMuzzle = new THREE.Vector3(0.25, gun.position.y, gun.position.z - 0.5);
    anchors.gunnerEye = new THREE.Vector3(-0.35, gun.position.y + 0.12, gun.position.z + 0.5);
    anchors.commanderEye = new THREE.Vector3(0.3, turret.position.y + H * 0.4, turret.position.z + 0.3);
    anchors.bowMgMuzzle = new THREE.Vector3(0.45, 0.45 + hullH * 0.75, -L / 2 - 0.05);
    anchors.driverEye = new THREE.Vector3(-0.45, 0.45 + hullH + 0.05, -L / 2 + 0.6);
  }
  return { root, parts, anchors, meta: { placeholder: true } };
}
