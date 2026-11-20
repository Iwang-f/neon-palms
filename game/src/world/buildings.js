// NEON PALMS — buildings. Facades are painted once per (style, colour) into a
// small canvas texture whose UVs are scaled per building, so a hundred blocks
// share two dozen textures. Roofs get the props that make a skyline read as a
// city: AC units, water tanks, stair heads, dishes, helipads and neon signs.

import * as THREE from 'three';
import { FACADES, SIGN_NAMES, PALETTE } from '../core/config.js';
import { makeRng } from '../core/util.js';

const TILE_W = 12;   // metres one texture tile covers horizontally
const TILE_H = 24;   // and vertically (eight 3 m floors)

const facadeCache = new Map();
const materialCache = new Map();
const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x4a4550 });
const roofDark = new THREE.MeshLambertMaterial({ color: 0x37333f });
const metal = new THREE.MeshLambertMaterial({ color: 0x8d8a92 });
const awningColors = [0xff7a59, 0x43e8ff, 0xffc24a, 0xff3fd0, 0x9fe0c8];

/** Glass in one window: a lit room, a dark room, or a blind pulled half down. */
function paintWindow(ctx, x, y, w, h, rng, warm) {
  const lit = rng.chance(0.4);
  ctx.fillStyle = '#1b1d26';
  ctx.fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
  if (lit) {
    const c = rng.chance(warm) ? '#ffcf92' : '#a8ddff';
    ctx.fillStyle = c;
    ctx.globalAlpha = rng.range(0.75, 1);
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x, y, w, 2);
    if (rng.chance(0.4)) {
      ctx.fillStyle = 'rgba(40,30,20,0.35)';
      ctx.fillRect(x, y, w, h * rng.range(0.2, 0.5));
    }
  } else {
    ctx.fillStyle = rng.chance(0.5) ? '#2b3040' : '#232634';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, y, w * 0.35, h);
  }
}

function facadeTexture(style, color, seed) {
  const key = `${style}|${color}`;
  const cached = facadeCache.get(key);
  if (cached) return cached;

  const rng = makeRng(seed);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 512);

  const floors = 8;
  const floorH = 512 / floors;

  if (style === 'tower') {
    // Curtain wall: continuous glass bands with slim mullions and a spandrel.
    for (let f = 0; f < floors; f++) {
      const y = f * floorH;
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(0, y + floorH - 12, 256, 12);
      const floorLit = rng.chance(0.55);
      for (let col = 0; col < 8; col++) {
        const x = col * 32 + 3;
        const lit = floorLit ? rng.chance(0.8) : rng.chance(0.12);
        ctx.fillStyle = lit ? (rng.chance(0.5) ? '#ffd8a2' : '#a9e0ff') : '#1d2330';
        ctx.globalAlpha = lit ? rng.range(0.7, 1) : 1;
        ctx.fillRect(x, y + 6, 26, floorH - 22);
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(x, y + 6, 26, 3);
      }
      ctx.fillStyle = 'rgba(20,24,34,0.55)';
      for (let col = 0; col <= 8; col++) ctx.fillRect(col * 32 - 1, y, 3, floorH);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(0, 0, 256, 5);
  } else if (style === 'deco') {
    // Pastel stucco: pilasters, a band per floor, paired windows with sills.
    for (let f = 0; f < floors; f++) {
      const y = f * floorH;
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(0, y + 2, 256, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.fillRect(0, y + 6, 256, 2);
      const floorLit = rng.chance(0.5);
      for (let col = 0; col < 4; col++) {
        const x = col * 64;
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(x, y, 7, floorH);
        for (let half = 0; half < 2; half++) {
          const wx = x + 16 + half * 22;
          if (floorLit || rng.chance(0.3)) paintWindow(ctx, wx, y + 16, 18, 30, rng, 0.8);
          else {
            ctx.fillStyle = '#2a2c38';
            ctx.fillRect(wx, y + 16, 18, 30);
          }
          ctx.fillStyle = 'rgba(255,255,255,0.28)';
          ctx.fillRect(wx - 2, y + 46, 22, 3);
        }
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(0, 0, 256, 9);
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.fillRect(0, 9, 256, 3);
  } else if (style === 'dock') {
    // Corrugated metal, high strip windows, rust bleeding down from the seams.
    for (let x = 0; x < 256; x += 10) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(x, 0, 3, 512);
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      ctx.fillRect(x + 6, 0, 4, 512);
    }
    for (let f = 0; f < 5; f++) {
      const y = 40 + f * 92;
      for (let col = 0; col < 4; col++) {
        const lit = rng.chance(0.25);
        ctx.fillStyle = lit ? '#ffd28a' : '#232833';
        ctx.fillRect(col * 64 + 16, y, 34, 20);
      }
      ctx.fillStyle = 'rgba(90,40,20,0.16)';
      ctx.fillRect(0, y + 20, 256, rng.range(10, 34));
    }
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, 0, 256, 8);
  } else {
    // Villa: stucco, shutters, a terracotta band under the roofline.
    for (let f = 0; f < 3; f++) {
      const y = 60 + f * 140;
      for (let col = 0; col < 3; col++) {
        const x = col * 85 + 22;
        paintWindow(ctx, x, y, 40, 54, rng, 0.9);
        ctx.fillStyle = 'rgba(60,90,70,0.9)';
        ctx.fillRect(x - 9, y, 8, 54);
        ctx.fillRect(x + 41, y, 8, 54);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(x - 11, y + 54, 62, 4);
      }
    }
    ctx.fillStyle = 'rgba(160,70,50,0.55)';
    ctx.fillRect(0, 0, 256, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.fillRect(0, 500, 256, 12);
  }

  // Grime: a few translucent vertical streaks, the same on every copy of a tile.
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = `rgba(20,16,26,${rng.range(0.02, 0.06)})`;
    ctx.fillRect(rng.range(0, 250), rng.range(0, 400), rng.range(2, 9), rng.range(40, 140));
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  facadeCache.set(key, tex);
  return tex;
}

function facadeMaterial(style, color, seed) {
  const key = `${style}|${color}`;
  let mat = materialCache.get(key);
  if (!mat) {
    const tex = facadeTexture(style, color, seed);
    mat = new THREE.MeshLambertMaterial({ map: tex });
    materialCache.set(key, mat);
  }
  return mat;
}

/** Box UVs scaled so the facade tile keeps its real-world size on every face. */
function scaleBoxUv(geo, w, h, d) {
  const uv = geo.attributes.uv;
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z; four vertices each.
  const us = [d / TILE_W, d / TILE_W, w / TILE_W, w / TILE_W, w / TILE_W, w / TILE_W];
  const vs = [h / TILE_H, h / TILE_H, d / TILE_H, d / TILE_H, h / TILE_H, h / TILE_H];
  for (let face = 0; face < 6; face++) {
    for (let i = 0; i < 4; i++) {
      const idx = face * 4 + i;
      uv.setXY(idx, uv.getX(idx) * us[face], uv.getY(idx) * vs[face]);
    }
  }
  uv.needsUpdate = true;
}

/** The face of the building that looks at the street: +z, -z, +x or -x. */
export function streetFacing(w, d, rng) {
  const options = [
    { axis: 'z', sign: 1, offset: d / 2 + 0.3 },
    { axis: 'z', sign: -1, offset: d / 2 + 0.3 },
    { axis: 'x', sign: 1, offset: w / 2 + 0.3 },
    { axis: 'x', sign: -1, offset: w / 2 + 0.3 },
  ];
  return rng.pick(options);
}

const signCache = new Map();

function signTexture(text, color) {
  const key = `${text}|${color}`;
  const cached = signCache.get(key);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 512, 128);
  ctx.font = '700 58px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 26;
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 66, 470);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.86)';
  ctx.font = '700 56px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText(text, 256, 64, 470);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  signCache.set(key, tex);
  return tex;
}

function glowTexture() {
  if (signCache.has('__glow')) return signCache.get('__glow');
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.28)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  signCache.set('__glow', tex);
  return tex;
}

/** A neon sign on a bracket, plus the soft bloom card that sells it at dusk. */
export function makeNeonSign(text, color, width = 8) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ map: signTexture(text, color), transparent: true, depthWrite: false, toneMapped: false });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), mat);
  plane.position.y = 0;
  group.add(plane);

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 1.6, width * 0.9),
    new THREE.MeshBasicMaterial({
      map: glowTexture(), color: new THREE.Color(color), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5, toneMapped: false,
    }),
  );
  glow.position.z = -0.06;
  group.add(glow);
  group.userData.glow = glow;
  return group;
}

function addRoofProps(group, w, d, h, rng, style) {
  const props = new THREE.Group();
  props.position.y = h;
  const count = rng.int(1, 3);
  for (let i = 0; i < count; i++) {
    const bw = rng.range(1.2, 2.8), bd = rng.range(1.2, 2.6), bh = rng.range(0.5, 1.2);
    const box = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), rng.chance(0.5) ? metal : roofDark);
    box.position.set(rng.range(-w / 2 + 2, w / 2 - 2), bh / 2, rng.range(-d / 2 + 2, d / 2 - 2));
    box.castShadow = true;
    props.add(box);
  }
  if (h > 12 && rng.chance(0.45)) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2.4, 10), new THREE.MeshLambertMaterial({ color: 0x9a7a5a }));
    tank.position.set(rng.range(-w / 4, w / 4), 2.1, rng.range(-d / 4, d / 4));
    tank.castShadow = true;
    props.add(tank);
    for (const [lx, lz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), metal);
      leg.position.set(tank.position.x + lx, 0.6, tank.position.z + lz);
      props.add(leg);
    }
  }
  if (h > 30 && rng.chance(0.35)) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 9, 6), metal);
    mast.position.y = 4.5;
    props.add(mast);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff3b30, toneMapped: false }),
    );
    bulb.position.y = 9.1;
    props.add(bulb);
  }
  if (style === 'tower' && h > 40 && rng.chance(0.4)) {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 0.12, 24), new THREE.MeshLambertMaterial({ color: 0x2f2b36 }));
    pad.position.y = 0.07;
    props.add(pad);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(3.1, 3.3, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe08a, side: THREE.DoubleSide, toneMapped: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.14;
    props.add(ring);
  }
  group.add(props);
  return props;
}

/**
 * One city building: a shopfront plinth, a facade box, an optional stepped
 * upper tier, roof props and, on a street-facing wall, a neon sign.
 */
export function createBuilding(rng, opts) {
  const { x, z, w, d, h, style, color, sign } = opts;
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const geo = new THREE.BoxGeometry(w, h, d);
  scaleBoxUv(geo, w, h, d);
  const body = new THREE.Mesh(geo, facadeMaterial(style, color, (x * 31 + z * 17) | 0));
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  if (style !== 'villa' && h > 9) {
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.5, 4.0, d + 0.5),
      new THREE.MeshLambertMaterial({ color: 0x2a2530 }),
    );
    plinth.position.y = 2.0;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    group.add(plinth);

    // Shop windows and an awning: the street level has to look inhabited.
    const face = streetFacing(w, d, rng);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(face.axis === 'z' ? w * 0.72 : 0.12, 2.3, face.axis === 'z' ? 0.12 : d * 0.72),
      new THREE.MeshBasicMaterial({ color: rng.chance(0.5) ? 0xffd9a0 : 0x9fdcff, toneMapped: false }),
    );
    if (face.axis === 'z') {
      glass.position.set(0, 2.1, face.sign * (d / 2 + 0.31));
    } else {
      glass.position.set(face.sign * (w / 2 + 0.31), 2.1, 0);
    }
    group.add(glass);
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(face.axis === 'z' ? w * 0.8 : 1.5, 0.16, face.axis === 'z' ? 1.5 : d * 0.8),
      new THREE.MeshLambertMaterial({ color: rng.pick(awningColors) }),
    );
    awning.position.copy(glass.position);
    awning.position.y = 3.6;
    if (face.axis === 'z') awning.position.z = face.sign * (d / 2 + 0.9);
    else awning.position.x = face.sign * (w / 2 + 0.9);
    awning.castShadow = true;
    group.add(awning);
  }

  if (style === 'deco' && h > 14 && rng.chance(0.6)) {
    const tw = w * rng.range(0.55, 0.78), td = d * rng.range(0.55, 0.78), th = rng.range(2.5, 5.5);
    const top = new THREE.Mesh(new THREE.BoxGeometry(tw, th, td), facadeMaterial(style, color, (x * 7 + z * 3) | 0));
    top.position.y = h + th / 2;
    top.castShadow = true;
    group.add(top);
    addRoofProps(group, tw, td, h + th, rng, style);
  } else {
    addRoofProps(group, w, d, h, rng, style);
  }

  if (sign) {
    const face = streetFacing(w, d, rng);
    const board = makeNeonSign(sign.text, sign.color, sign.width);
    const y = Math.min(h - 1.2, rng.range(6.2, Math.max(7, h * 0.62)));
    if (face.axis === 'z') {
      board.position.set(rng.range(-w / 3, w / 3), y, face.sign * face.offset);
      board.rotation.y = face.sign > 0 ? 0 : Math.PI;
    } else {
      board.position.set(face.sign * face.offset, y, rng.range(-d / 3, d / 3));
      board.rotation.y = face.sign > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    group.add(board);
  }

  return { group, w, d, h };
}

/** Pick a facade style and colour for a district. */
export function styleFor(district, rng) {
  if (district === 'centro') return { style: 'tower', color: rng.pick(FACADES.tower) };
  if (district === 'puerto') return { style: 'dock', color: rng.pick(FACADES.dock) };
  if (district === 'colinas') return { style: 'villa', color: rng.pick(FACADES.villa) };
  return { style: 'deco', color: rng.pick(FACADES.deco) };
}

export function pickSign(rng, names = SIGN_NAMES) {
  return {
    text: rng.pick(names),
    color: rng.pick(FACADES.neon),
    width: rng.range(6.5, 10.5),
  };
}

export { PALETTE };
