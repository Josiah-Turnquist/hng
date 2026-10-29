// The war map on the Generals screen: Europe from the original game's map
// points, each army's land tinted in its colour, the supply lines, capitals
// as stars, the assault teams as unit markers, battles as crossed swords.
// Drag to move it, wheel or pinch to zoom, tap to pick a team or a point.
//
//   const v = new WarMapView(canvas, { army, onPick, onFrame })
//   v.setWar(war); v.selected = { team } | { point } | null; v.start(); v.stop()
//   v.focus(point, scale)           // centre the map on a point
import { MAP, distance } from '../war/warMap.js';
import { TEAMS, armyCode } from '../war/war.js';

export const ARMY_COLORS = { US: '#7c9b45', GE: '#6383a8', SU: '#b8493e', '': '#8b8778' };
const COLOR_OF = ['#8b8778', ARMY_COLORS.US, ARMY_COLORS.GE, ARMY_COLORS.SU];
const SEA = '#161c1f';
const LAND = '#34352b';
// The territory picture is drawn at this many map units a pixel.
const TERR = 8;

export class WarMapView {
  constructor(canvas, { army, onPick = () => {}, onFrame = () => {} } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.army = army;
    this.onPick = onPick;
    this.onFrame = onFrame;
    this.selected = null;
    this.war = null;
    this.view = { x: 0, y: 0, s: 0.05 };
    this._terrKey = '';
    this._pointers = new Map();
    this._bind();
    this.resize();
    this.fit();
  }

  setWar(war) {
    this.war = war;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
  }

  // The whole of Europe in view.
  fit() {
    const b = MAP.bounds;
    const s = Math.min(this.w / (b.x1 - b.x0 + 400), this.h / (b.y1 - b.y0 + 400));
    this.view = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, s };
    this.minScale = s * 0.8;
  }

  focus(p, s = null) {
    this.view.x = MAP.x[p];
    this.view.y = MAP.y[p];
    if (s) this.view.s = s;
  }

  zoom(f, cx = this.w / 2, cy = this.h / 2) {
    const [mx, my] = this.toMap(cx, cy);
    this.view.s = Math.max(this.minScale, Math.min(1.6, this.view.s * f));
    const [nx, ny] = this.toMap(cx, cy);
    this.view.x += mx - nx;
    this.view.y += my - ny;
  }

  toScreen(x, y) {
    return [(x - this.view.x) * this.view.s + this.w / 2, (y - this.view.y) * this.view.s + this.h / 2];
  }
  toMap(sx, sy) {
    return [(sx - this.w / 2) / this.view.s + this.view.x, (sy - this.h / 2) / this.view.s + this.view.y];
  }

  start() {
    let last = performance.now();
    const loop = (now) => {
      if (!this.canvas.isConnected) return;
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      this.onFrame(dt);
      this.draw(now / 1000);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }
  stop() {
    cancelAnimationFrame(this._raf);
  }

  // Where a team is now: at its point, or part way along its line.
  teamXY(t) {
    if (t.at === null) return null;
    let x = MAP.x[t.at],
      y = MAP.y[t.at];
    if (t.path.length && t.leg > 0) {
      const to = t.path[0];
      const k = Math.min(1, t.leg / (distance(t.at, to) || 1));
      x += (MAP.x[to] - x) * k;
      y += (MAP.y[to] - y) * k;
    }
    return [x, y];
  }

  // --- Drawing ---------------------------------------------------------------

  draw(time = 0) {
    const { ctx, war } = this;
    if (!war) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = SEA;
    ctx.fillRect(0, 0, this.w, this.h);
    this._territory();
    const b = MAP.bounds;
    const [tx, ty] = this.toScreen(b.x0 - 400, b.y0 - 400);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this._terr, tx, ty, this._terr.width * TERR * this.view.s, this._terr.height * TERR * this.view.s);
    ctx.restore();
    this._lines();
    this._points();
    this._capitals();
    this._paths();
    this._battles(time);
    this._teams();
  }

  // Land and each army's territory, redrawn when the land changes hands.
  _territory() {
    const war = this.war;
    let key = 0;
    for (let i = 0; i < MAP.count; i++) key = (key * 31 + war.owner[i] * (i + 7)) | 0;
    if (this._terr && key === this._terrKey) return;
    this._terrKey = key;
    const b = MAP.bounds;
    const W = Math.ceil((b.x1 - b.x0 + 800) / TERR),
      H = Math.ceil((b.y1 - b.y0 + 800) / TERR);
    if (!this._terr) {
      this._terr = document.createElement('canvas');
      this._terr.width = W;
      this._terr.height = H;
      // The land: a soft blob round every point (the map has no coastline).
      const land = document.createElement('canvas');
      land.width = W;
      land.height = H;
      const lc = land.getContext('2d');
      lc.fillStyle = LAND;
      for (let i = 0; i < MAP.count; i++) {
        lc.beginPath();
        lc.arc((MAP.x[i] - b.x0 + 400) / TERR, (MAP.y[i] - b.y0 + 400) / TERR, 150 / TERR, 0, Math.PI * 2);
        lc.fill();
      }
      this._land = land;
    }
    const tc = this._terr.getContext('2d');
    tc.clearRect(0, 0, W, H);
    tc.filter = 'blur(2px)';
    tc.drawImage(this._land, 0, 0);
    // Each army's points, as overlapping discs, laid over the land.
    const tint = document.createElement('canvas');
    tint.width = W;
    tint.height = H;
    const c = tint.getContext('2d');
    for (let code = 1; code <= 3; code++) {
      c.fillStyle = COLOR_OF[code];
      c.beginPath();
      for (let i = 0; i < MAP.count; i++) {
        if (war.owner[i] !== code) continue;
        const x = (MAP.x[i] - b.x0 + 400) / TERR,
          y = (MAP.y[i] - b.y0 + 400) / TERR;
        c.moveTo(x + 95 / TERR, y);
        c.arc(x, y, 95 / TERR, 0, Math.PI * 2);
      }
      c.fill();
    }
    tc.globalAlpha = 0.42;
    tc.filter = 'blur(3px)';
    tc.drawImage(tint, 0, 0);
    tc.globalAlpha = 1;
    tc.filter = 'none';
  }

  _visible(x, y, pad = 40) {
    const [sx, sy] = this.toScreen(x, y);
    return sx > -pad && sy > -pad && sx < this.w + pad && sy < this.h + pad;
  }

  _lines() {
    const { ctx, war } = this;
    const L = MAP.lines;
    const batches = [[], [], [], []];
    for (let k = 0; k < L.length; k += 2) {
      const a = L[k],
        b = L[k + 1];
      if (!this._visible(MAP.x[a], MAP.y[a], 400) && !this._visible(MAP.x[b], MAP.y[b], 400)) continue;
      const oa = war.owner[a];
      batches[oa === war.owner[b] ? oa : 0].push(a, b);
    }
    ctx.lineWidth = Math.max(0.6, Math.min(2, this.view.s * 4));
    batches.forEach((list, code) => {
      ctx.strokeStyle = code ? COLOR_OF[code] : 'rgba(170, 165, 150, 0.35)';
      ctx.globalAlpha = code ? 0.75 : 1;
      ctx.beginPath();
      for (let i = 0; i < list.length; i += 2) {
        const [x1, y1] = this.toScreen(MAP.x[list[i]], MAP.y[list[i]]);
        const [x2, y2] = this.toScreen(MAP.x[list[i + 1]], MAP.y[list[i + 1]]);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  _points() {
    const { ctx, war } = this;
    const s = this.view.s;
    const r = Math.max(1, Math.min(4, s * 9));
    const labels = s > 0.55;
    ctx.font = '600 11px "Barlow Condensed", "Arial Narrow", sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < MAP.count; i++) {
      if (MAP.isCapital(i) || !this._visible(MAP.x[i], MAP.y[i])) continue;
      const [x, y] = this.toScreen(MAP.x[i], MAP.y[i]);
      ctx.fillStyle = COLOR_OF[war.owner[i]];
      const k = MAP.kind[i];
      if (s > 0.3 && (k === 'f' || k === 'a' || k === 'w')) {
        // Factories as squares, airfields as triangles.
        ctx.beginPath();
        if (k === 'f') ctx.rect(x - r * 1.2, y - r * 1.2, r * 2.4, r * 2.4);
        else {
          ctx.moveTo(x, y - r * 1.6);
          ctx.lineTo(x + r * 1.4, y + r);
          ctx.lineTo(x - r * 1.4, y + r);
        }
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (this.selected?.point === i) {
        ctx.strokeStyle = '#e2ac46';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, r + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (labels) {
        ctx.fillStyle = 'rgba(233, 228, 214, 0.75)';
        ctx.fillText(MAP.name(i), x, y - r - 4);
      }
    }
    // Points being taken: a ring that fills.
    for (const t of war.teams) {
      if (t.at === null || !(t.hold > 0) || !this._visible(MAP.x[t.at], MAP.y[t.at])) continue;
      const [x, y] = this.toScreen(MAP.x[t.at], MAP.y[t.at]);
      const total = MAP.isCapital(t.at) ? 7200 : 600;
      ctx.strokeStyle = ARMY_COLORS[t.army];
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - t.hold / total));
      ctx.stroke();
    }
  }

  _capitals() {
    const { ctx, war } = this;
    ctx.font = '700 13px "Barlow Condensed", "Arial Narrow", sans-serif';
    ctx.textAlign = 'center';
    for (const c of MAP.capitals) {
      const [x, y] = this.toScreen(MAP.x[c.point], MAP.y[c.point]);
      const code = war.owner[c.point];
      star(ctx, x, y, 9, 4);
      ctx.fillStyle = code ? COLOR_OF[code] : '#bdb8a6';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = this.selected?.point === c.point ? '#e2ac46' : 'rgba(10,10,8,0.9)';
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(10, 11, 9, 0.85)';
      ctx.strokeText(MAP.name(c.point).replace(' City', '').replace(' am Main', ''), x, y + 22);
      ctx.fillStyle = '#efe9d8';
      ctx.fillText(MAP.name(c.point).replace(' City', '').replace(' am Main', ''), x, y + 22);
    }
  }

  // Where the player's teams are going: a dashed line along their way.
  _paths() {
    const { ctx, war } = this;
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;
    for (const t of war.teams) {
      if (t.at === null || !t.path.length) continue;
      const mine = t.army === this.army;
      if (!mine && this.selected?.team !== t.id) continue;
      ctx.strokeStyle = mine ? '#efe3b8' : ARMY_COLORS[t.army];
      ctx.beginPath();
      const [x0, y0] = this.toScreen(...this.teamXY(t));
      ctx.moveTo(x0, y0);
      for (const p of t.path) ctx.lineTo(...this.toScreen(MAP.x[p], MAP.y[p]));
      ctx.stroke();
      const end = t.path[t.path.length - 1];
      const [ex, ey] = this.toScreen(MAP.x[end], MAP.y[end]);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(ex, ey, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([5, 5]);
    }
    ctx.setLineDash([]);
  }

  _battles(time) {
    const { ctx, war } = this;
    for (const b of war.battles) {
      const [x, y] = this.toScreen(MAP.x[b.point], MAP.y[b.point]);
      const pulse = 0.5 + 0.5 * Math.sin(time * 4);
      const mine = b.att === this.army || b.def === this.army;
      ctx.fillStyle = `rgba(214, 74, 52, ${0.18 + pulse * 0.2})`;
      ctx.beginPath();
      ctx.arc(x, y, 20 + pulse * 4, 0, Math.PI * 2);
      ctx.fill();
      // Crossed swords.
      ctx.strokeStyle = mine ? '#ffd36e' : '#e6dcc4';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - 8, y - 8);
      ctx.lineTo(x + 8, y + 8);
      ctx.moveTo(x + 8, y - 8);
      ctx.lineTo(x - 8, y + 8);
      ctx.moveTo(x - 9, y + 3);
      ctx.lineTo(x - 3, y + 9);
      ctx.moveTo(x + 9, y + 3);
      ctx.lineTo(x + 3, y + 9);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
  }

  // Unit markers: a box in the army's colour with the branch's sign, the
  // way staff maps drew them (X infantry, oval armour, slash recon).
  _teams() {
    const { ctx, war } = this;
    const stacks = new Map();
    this._hits = [];
    for (const t of war.teams) {
      const xy = this.teamXY(t);
      if (!xy || !this._visible(xy[0], xy[1])) continue;
      const key = t.path.length && t.leg > 0 ? `m${t.id}` : `p${t.at}`;
      const n = stacks.get(key) || 0;
      stacks.set(key, n + 1);
      let [x, y] = this.toScreen(xy[0], xy[1]);
      x += n * 8;
      y -= 18 + n * 8;
      const w = 26,
        h = 17;
      const sel = this.selected?.team === t.id;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(x - w / 2 + 2, y - h / 2 + 2, w, h);
      ctx.fillStyle = ARMY_COLORS[t.army];
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.lineWidth = sel ? 2.5 : 1.2;
      ctx.strokeStyle = sel ? '#ffd36e' : t.army === this.army ? '#f3eedd' : 'rgba(20,20,16,0.9)';
      ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      ctx.strokeStyle = '#f3eedd';
      ctx.lineWidth = 1.3;
      branchSign(ctx, TEAMS[t.type].branch, x, y, w - 6, h - 6, t.air);
      // A stalk down to its point.
      ctx.strokeStyle = 'rgba(243,238,221,0.6)';
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + 1, y + h / 2);
      ctx.lineTo(x - w / 2 + 1, y + h / 2 + 9 + n * 8);
      ctx.stroke();
      this._hits.push({ id: t.id, x, y });
    }
  }

  // --- Input -----------------------------------------------------------------

  _bind() {
    const c = this.canvas;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this._pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY, x0: e.offsetX, y0: e.offsetY });
      this._moved = false;
    });
    c.addEventListener('pointermove', (e) => {
      const p = this._pointers.get(e.pointerId);
      if (!p) return;
      if (this._pointers.size === 2) {
        const [a, b] = [...this._pointers.values()];
        const before = Math.hypot(a.x - b.x, a.y - b.y);
        p.x = e.offsetX;
        p.y = e.offsetY;
        const after = Math.hypot(a.x - b.x, a.y - b.y);
        if (before > 0) this.zoom(after / before, (a.x + b.x) / 2, (a.y + b.y) / 2);
        this._moved = true;
        return;
      }
      const dx = e.offsetX - p.x,
        dy = e.offsetY - p.y;
      p.x = e.offsetX;
      p.y = e.offsetY;
      if (Math.hypot(p.x - p.x0, p.y - p.y0) > 5) this._moved = true;
      if (this._moved) {
        this.view.x -= dx / this.view.s;
        this.view.y -= dy / this.view.s;
      }
    });
    const up = (e) => {
      const p = this._pointers.get(e.pointerId);
      this._pointers.delete(e.pointerId);
      if (p && !this._moved && e.type === 'pointerup') this._pick(e.offsetX, e.offsetY);
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoom(Math.exp(-e.deltaY * 0.0015), e.offsetX, e.offsetY);
      },
      { passive: false },
    );
  }

  _pick(sx, sy) {
    const hit = (this._hits || []).filter((h) => Math.abs(h.x - sx) < 15 && Math.abs(h.y - sy) < 11).pop();
    if (hit) return this.onPick({ team: hit.id });
    let best = null,
      bd = 14 ** 2;
    for (let i = 0; i < MAP.count; i++) {
      const [x, y] = this.toScreen(MAP.x[i], MAP.y[i]);
      const d = (x - sx) ** 2 + (y - sy) ** 2 - (MAP.isCapital(i) ? 120 : 0);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    this.onPick(best === null ? null : { point: best });
  }
}

function star(ctx, x, y, R, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r : R;
    ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

export function branchSign(ctx, branch, x, y, w, h, air = false) {
  ctx.beginPath();
  if (branch === 'infantry' || branch === 'paratrooper') {
    ctx.moveTo(x - w / 2, y - h / 2);
    ctx.lineTo(x + w / 2, y + h / 2);
    ctx.moveTo(x + w / 2, y - h / 2);
    ctx.lineTo(x - w / 2, y + h / 2);
  }
  if (branch === 'tanker') ctx.ellipse(x, y, w * 0.38, h * 0.32, 0, 0, Math.PI * 2);
  if (branch === 'recon') {
    ctx.moveTo(x - w / 2, y + h / 2);
    ctx.lineTo(x + w / 2, y - h / 2);
  }
  ctx.stroke();
  // Airborne: the wings across the top.
  if (branch === 'paratrooper') {
    ctx.beginPath();
    ctx.moveTo(x - w * 0.3, y - h * 0.05);
    ctx.quadraticCurveTo(x - w * 0.15, y - h * 0.4, x, y - h * 0.05);
    ctx.quadraticCurveTo(x + w * 0.15, y - h * 0.4, x + w * 0.3, y - h * 0.05);
    ctx.stroke();
  }
  if (air) {
    ctx.fillStyle = '#f3eedd';
    ctx.fillRect(x - w / 2, y + h / 2 + 1, w, 1.5);
  }
}

export { armyCode };
