// National markings painted on the tanks: the white star of the US Army, the
// German Balkenkreuz, the Soviet red star. Each is a small picture drawn in
// code, laid onto the hull's and turret's own skin so it follows their curves
// (effects.js surfaceMark), a little worn, and dusted over with the rest of
// the vehicle (weather.js).
import * as THREE from 'three';
import { surfaceMark } from '../effects.js';
import { weatherVehicleMaterial } from '../weather.js';
import { Noise } from '../../core/math.js';

// Where each tank carries them: [picture, part, y (m above the ground), z
// (m, + toward the rear), size (m)], put on both sides of that part.
const PLAN = {
  m4a1_sherman: [
    ['star', 'body', 1.36, 0.55, 0.5],
    ['star', 'turret', 2.2, -0.05, 0.36],
  ],
  m5a1_stuart: [
    ['star', 'body', 1.25, 0.35, 0.4],
    ['star', 'turret', 1.92, -0.3, 0.28],
  ],
  // (Its hull sides are behind the skirts: on the plates round the turret.)
  panzer4_h: [['cross', 'turret', 2.12, 0.15, 0.34]],
  tiger1: [['cross', 'body', 1.45, 0.4, 0.42]],
  t34_76: [['redStar', 'turret', 1.9, -0.85, 0.34]],
  t34_85: [['redStar', 'turret', 1.98, -0.6, 0.38]],
};

const N = 128;
const pictures = {};
// The pictures: paint on a clear ground, chipped and thin in places.
function picture(kind) {
  if (pictures[kind]) return pictures[kind];
  const data = new Uint8Array(N * N * 4);
  const noise = new Noise({ star: 5, cross: 9, redStar: 13 }[kind]);
  const A5 = Math.PI / 5;
  // A five-pointed star, one point up: 0 outside .. 1 inside (soft over a pixel).
  const star = (u, v, R, r) => {
    const rho = Math.hypot(u, v);
    let th = ((Math.atan2(u, v) % (2 * A5)) + 2 * A5) % (2 * A5);
    if (th > A5) th = 2 * A5 - th;
    const edge = (R * r * Math.sin(A5)) / (r * Math.sin(A5) * Math.cos(th) + (R - r * Math.cos(A5)) * Math.sin(th));
    return Math.min(1, Math.max(0, (edge - rho) * (N / 2) + 0.5));
  };
  const bar = (u, v, half, len) => Math.min(1, Math.max(0, (half - Math.abs(u)) * (N / 2) + 0.5)) * Math.min(1, Math.max(0, (len - Math.abs(v)) * (N / 2) + 0.5));
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const u = ((x + 0.5) / N) * 2 - 1,
        v = ((y + 0.5) / N) * 2 - 1;
      let R = 0,
        G = 0,
        B = 0,
        A = 0;
      if (kind === 'star') {
        A = star(u, v, 0.94, 0.36);
        [R, G, B] = [226, 224, 212];
      } else if (kind === 'redStar') {
        A = star(u, v, 0.94, 0.37);
        [R, G, B] = [150, 26, 20];
      } else {
        // The cross: black, with a white edge along its arms and open ends.
        const white = Math.max(bar(u, v, 0.31, 0.93), bar(v, u, 0.31, 0.93));
        const black = Math.max(bar(u, v, 0.17, 0.93), bar(v, u, 0.17, 0.93));
        A = white;
        const k = black;
        [R, G, B] = [222 - 204 * k, 220 - 203 * k, 208 - 192 * k];
      }
      // Worn: rubbed thin in patches, chipped away in specks.
      const thin = noise.noise2(x * 0.045, y * 0.045) * 0.5 + 0.5;
      const chips = noise.noise2(x * 0.42 + 30, y * 0.42) * 0.5 + 0.5;
      A *= (0.72 + 0.28 * Math.min(1, thin * 1.6)) * (chips > 0.78 ? 0.25 : 1);
      if (x === 0 || y === 0 || x === N - 1 || y === N - 1) A = 0;
      const i = (y * N + x) * 4;
      data[i] = R;
      data[i + 1] = G;
      data[i + 2] = B;
      data[i + 3] = Math.round(Math.min(1, Math.max(0, A)) * 255);
    }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return (pictures[kind] = t);
}

const materials = {};
function material(kind) {
  if (materials[kind]) return materials[kind];
  const m = new THREE.MeshStandardMaterial({ map: picture(kind), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, roughness: 0.88, metalness: 0 });
  m.name = `marking-${kind}`;
  weatherVehicleMaterial(THREE, m, { paint: false });
  return (materials[kind] = m);
}

const _from = new THREE.Vector3();
const _dir = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// Paint a built vehicle's markings onto its parts (they sit at their pivots,
// unturned, as built). Returns how many were laid.
export function addMarkings(id, parts) {
  let n = 0;
  for (const [kind, partName, y, z, size] of PLAN[id] || []) {
    const part = parts[partName];
    if (!part) continue;
    const pos = [],
      nor = [],
      uv = [];
    for (const side of [-1, 1]) {
      // From well outside the part, straight in at it (the part's own frame).
      _from.set(side * 4, y, z).sub(part.position);
      _dir.set(-side, 0, 0);
      const rec = surfaceMark(part, _from, _dir, 4, size, size, UP);
      if (!rec) continue;
      // (Read the right way round from outside: on one side the picture's
      // width runs backward along the hull.)
      pos.push(...rec.pos);
      nor.push(...rec.nor);
      uv.push(...rec.uv);
      n++;
    }
    if (!pos.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, material(kind));
    mesh.name = `marking-${kind}`;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.renderOrder = 0.5;
    // (Not part of the skin: hit marks are not laid onto it, and it is not counted as armor.)
    mesh.userData.damageMarks = true;
    mesh.userData.marking = true;
    part.add(mesh);
  }
  return n;
}
