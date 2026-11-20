// NEON PALMS — small maths, a seeded random source, a spatial hash for the city's
// collision boxes, and the little event bus the systems talk through.

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const TAU = Math.PI * 2;

export function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}
export function angleTo(a, b) { return wrapAngle(b - a); }
export function angleDamp(a, b, lambda, dt) { return a + angleTo(a, b) * (1 - Math.exp(-lambda * dt)); }

export const dist2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
export const dist = (ax, az, bx, bz) => Math.sqrt(dist2(ax, az, bx, bz));
export const heading = (dx, dz) => Math.atan2(dx, dz);

/** Mulberry32: a small deterministic generator, so a seed always builds the same city. */
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo, hi) => lo + next() * (hi - lo),
    int: (lo, hi) => Math.floor(lo + next() * (hi - lo + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (p) => next() < p,
    sign: () => (next() < 0.5 ? -1 : 1),
  };
}

/** A uniform grid of axis-aligned boxes: buildings, walls, containers. */
export class BoxGrid {
  constructor(cell = 24) {
    this.cell = cell;
    this.map = new Map();
  }
  key(ix, iz) { return ix * 73856093 ^ iz * 19349663; }
  insert(box) {
    const c = this.cell;
    const x0 = Math.floor(box.minX / c), x1 = Math.floor(box.maxX / c);
    const z0 = Math.floor(box.minZ / c), z1 = Math.floor(box.maxZ / c);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const k = this.key(ix, iz);
        let list = this.map.get(k);
        if (!list) { list = []; this.map.set(k, list); }
        list.push(box);
      }
    }
  }
  near(x, z, out = []) {
    out.length = 0;
    const c = this.cell;
    const list = this.map.get(this.key(Math.floor(x / c), Math.floor(z / c)));
    if (list) for (const b of list) out.push(b);
    return out;
  }
  /** Pushes a circle out of any box it overlaps; returns the corrected centre. */
  resolveCircle(pos, radius) {
    const boxes = this.near(pos.x, pos.z, this._scratch || (this._scratch = []));
    for (const b of boxes) {
      const cx = clamp(pos.x, b.minX, b.maxX);
      const cz = clamp(pos.z, b.minZ, b.maxZ);
      const dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * radius;
          pos.z = cz + (dz / d) * radius;
        } else {
          // Centre inside the box: leave by the nearest face.
          const left = pos.x - b.minX, right = b.maxX - pos.x;
          const back = pos.z - b.minZ, front = b.maxZ - pos.z;
          const m = Math.min(left, right, back, front);
          if (m === left) pos.x = b.minX - radius;
          else if (m === right) pos.x = b.maxX + radius;
          else if (m === back) pos.z = b.minZ - radius;
          else pos.z = b.maxZ + radius;
        }
      }
    }
    return pos;
  }
  /** True when the straight segment a->b crosses a box (bullets, line of sight). */
  blocked(ax, az, bx, bz, pad = 0) {
    const steps = Math.max(1, Math.ceil(dist(ax, az, bx, bz) / 3));
    const out = [];
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = lerp(ax, bx, t), z = lerp(az, bz, t);
      const boxes = this.near(x, z, out);
      for (const b of boxes) {
        if (x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad) return true;
      }
    }
    return false;
  }
}

/** on/off/emit, so a system can announce a crime without importing the police. */
export class Events {
  constructor() { this.map = new Map(); }
  on(name, fn) {
    let list = this.map.get(name);
    if (!list) { list = []; this.map.set(name, list); }
    list.push(fn);
    return () => this.off(name, fn);
  }
  off(name, fn) {
    const list = this.map.get(name);
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }
  emit(name, payload) {
    const list = this.map.get(name);
    if (list) for (const fn of list) fn(payload);
  }
}

export const money = (n) => '$' + Math.max(0, Math.round(n)).toLocaleString('en-US');
export const clock = (hours) => {
  const h = ((hours % 24) + 24) % 24;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};
export const mmss = (seconds) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** The district under a world position, for the HUD and the minimap. */
export function districtAt(x, z, districts) {
  for (const d of districts) if (d.test(x, z)) return d;
  return districts[districts.length - 1];
}

/** A canvas with its own 2D context, sized in device pixels but drawn in CSS pixels. */
export function makeCanvas(width, height, dpr = 1) {
  const c = document.createElement('canvas');
  c.width = Math.round(width * dpr);
  c.height = Math.round(height * dpr);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  return { canvas: c, ctx, width, height };
}
