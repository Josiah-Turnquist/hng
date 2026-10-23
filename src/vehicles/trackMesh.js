// Animated tank tracks: individual links laid along the track's path (around the
// drive sprocket, over the return rollers, round the idler and under the road
// wheels). Links move with the track speed, and the bottom run follows the road
// wheels as the suspension works.
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _x = new THREE.Vector3(1, 0, 0);
const _x2 = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();

// A plain track path when the model has none: a loop around the road wheels with
// the sprocket at one end and the idler at the other.
export function defaultTrackPath(def) {
  const r = def.roadWheelRadius;
  const L = def.contactLength;
  const rs = def.sprocketRadius;
  const front = -L / 2 - rs * 0.9;
  const rear = L / 2 + rs * 0.9;
  const top = Math.max(r * 2 + 0.05, rs * 2 + 0.25);
  const pts = [];
  const arc = (cz, cy, rad, a0, a1, n) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push([cz + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
    }
  };
  // Bottom run (front to back), rear idler, top run (back to front), front sprocket.
  pts.push([-L / 2, 0.015], [L / 2, 0.015]);
  arc(rear, top / 2, top / 2, -Math.PI / 2, Math.PI / 2, 8);
  pts.push([L / 2, top], [-L / 2, top]);
  arc(front, top / 2, top / 2, Math.PI / 2, (3 * Math.PI) / 2, 8);
  return pts;
}

export class TrackRenderer {
  constructor(vehicle, material) {
    const def = vehicle.def;
    const t = vehicle.model.meta?.track || {};
    this.vehicle = vehicle;
    this.path = (t.path && t.path.length > 3 ? t.path : defaultTrackPath(def)).map(([z, y]) => [z, y]);
    this.width = t.width ?? def.trackWidth;
    this.pitch = t.pitch ?? 0.15;
    this.thick = t.linkThickness ?? 0.03;
    this.offsetX = t.offsetX ?? def.trackCenters / 2;
    // Path length and direction (we want links on the ground run to move backward
    // as the tank drives forward).
    let len = 0;
    let lowest = 0;
    for (let i = 0; i < this.path.length; i++) {
      const a = this.path[i],
        b = this.path[(i + 1) % this.path.length];
      len += Math.hypot(b[0] - a[0], b[1] - a[1]);
      if ((a[1] + b[1]) / 2 < (this.path[lowest][1] + this.path[(lowest + 1) % this.path.length][1]) / 2) lowest = i;
    }
    const la = this.path[lowest],
      lb = this.path[(lowest + 1) % this.path.length];
    this.dirSign = lb[0] > la[0] ? 1 : -1;
    this.count = Math.max(8, Math.round(len / this.pitch));
    // One link: a flat shoe with a raised grouser and guide horn.
    const shoe = new THREE.BoxGeometry(this.width, this.thick, this.pitch * 0.92);
    const grouser = new THREE.BoxGeometry(this.width * 0.9, this.thick * 0.7, this.pitch * 0.18).translate(0, -this.thick * 0.8, 0);
    const horn = new THREE.BoxGeometry(this.width * 0.12, this.thick * 1.6, this.pitch * 0.45).translate(0, this.thick * 1.2, 0);
    const geo = mergeSimple([shoe, grouser, horn]);
    this.meshes = [-1, 1].map((side) => {
      const m = new THREE.InstancedMesh(geo, material, this.count);
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      m.userData.side = side;
      vehicle.model.root.add(m);
      return m;
    });
    // Road wheels per side, for bending the bottom run.
    this.wheels = [[], []];
    for (const w of vehicle.wheels) this.wheels[w.track].push(w);
    for (const list of this.wheels) list.sort((a, b) => a.model.z - b.model.z);
    this.work = this.path.map(() => [0, 0]);
    this.cum = new Float32Array(this.path.length + 1);
  }

  update(v) {
    for (let side = 0; side < 2; side++) {
      const pts = this._deform(side);
      const n = pts.length;
      const cum = this.cum;
      cum[0] = 0;
      for (let i = 0; i < n; i++) {
        const a = pts[i],
          b = pts[(i + 1) % n];
        cum[i + 1] = cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]);
      }
      const total = cum[n];
      const spacing = total / this.count;
      let off = ((v.trackDist[side] * this.dirSign) % total) + total;
      const mesh = this.meshes[side];
      const x = (side === 0 ? -1 : 1) * this.offsetX;
      let seg = 0;
      for (let k = 0; k < this.count; k++) {
        const s = (off + k * spacing) % total;
        while (seg > 0 && cum[seg] > s) seg--;
        while (cum[seg + 1] < s && seg < n - 1) seg++;
        const a = pts[seg],
          b = pts[(seg + 1) % n];
        const sl = cum[seg + 1] - cum[seg] || 1;
        const f = (s - cum[seg]) / sl;
        const z = a[0] + (b[0] - a[0]) * f;
        const y = a[1] + (b[1] - a[1]) * f;
        // Link lies along the path with its grousers facing out of the loop
        // (local +Y points into the loop).
        _z.set(0, b[1] - a[1], b[0] - a[0]).normalize();
        _x2.copy(_x);
        _y.crossVectors(_z, _x2).normalize();
        if (this.dirSign < 0) {
          _y.negate();
          _x2.negate();
        }
        _m.makeBasis(_x2, _y, _z);
        _q.setFromRotationMatrix(_m);
        // The path is the links' centerline.
        _p.set(x, y, z);
        _m.compose(_p, _q, _s);
        mesh.setMatrixAt(k, _m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  // Bottom run follows the road wheels' suspension travel.
  _deform(side) {
    const list = this.wheels[side];
    const out = this.work;
    for (let i = 0; i < this.path.length; i++) {
      const [z, y] = this.path[i];
      out[i][0] = z;
      out[i][1] = y;
      if (!list.length) continue;
      const r = list[0].radius;
      if (y > r * 1.4) continue;
      // Interpolate the travel of the nearest wheels along the hull.
      let travel;
      if (z <= list[0].model.z) travel = trav(list[0]) * Math.max(0, 1 - (list[0].model.z - z) / (r * 2));
      else if (z >= list[list.length - 1].model.z) {
        const w = list[list.length - 1];
        travel = trav(w) * Math.max(0, 1 - (z - w.model.z) / (r * 2));
      } else {
        let j = 0;
        while (j < list.length - 2 && list[j + 1].model.z < z) j++;
        const a = list[j],
          b = list[j + 1];
        const f = (z - a.model.z) / (b.model.z - a.model.z || 1);
        travel = trav(a) + (trav(b) - trav(a)) * f;
      }
      out[i][1] = y + travel * (1 - Math.max(0, y) / (r * 1.4));
    }
    return out;
  }

  dispose() {
    for (const m of this.meshes) {
      m.removeFromParent();
      m.dispose();
    }
  }
}

function trav(w) {
  return Math.max(-w.droop, Math.min(w.bump + 0.05, w.compression - w.droop));
}

function mergeSimple(geos) {
  const pos = [],
    nor = [],
    uv = [],
    idx = [];
  let base = 0;
  for (const g of geos) {
    const p = g.attributes.position,
      n = g.attributes.normal,
      u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      uv.push(u.getX(i), u.getY(i));
    }
    for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base);
    base += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}
