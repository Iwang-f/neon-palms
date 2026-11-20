// NEON PALMS — street furniture and greenery. Palms, lamp posts, traffic signals,
// benches, bins, containers, cranes, beach umbrellas and the marina's boats.
// Anything that appears more than twenty times is instanced.

import * as THREE from 'three';
import { makeRng } from '../core/util.js';

const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
const poleMat = new THREE.MeshLambertMaterial({ color: 0x3c3a44 });
const metalMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a6 });
const darkMat = new THREE.MeshLambertMaterial({ color: 0x2b2833 });

function leafTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 64, 256);
  // A solid feathered frond: a filled blade with a darker rib, so the crown
  // reads as foliage from a distance instead of wire.
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#6a9a4a');
  grad.addColorStop(0.6, '#4f7a38');
  grad.addColorStop(1, '#3d5f2c');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(32, 2);
  for (let y = 4; y <= 250; y += 4) {
    const t = y / 250;
    const w = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 30 + 2;
    ctx.lineTo(32 + w, y);
  }
  for (let y = 250; y >= 4; y -= 4) {
    const t = y / 250;
    const w = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 30 + 2;
    ctx.lineTo(32 - w, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,70,30,0.9)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(32, 2);
  ctx.lineTo(32, 252);
  ctx.stroke();
  // Notches, cut back to the rib, so the edge is ragged rather than a blade.
  ctx.globalCompositeOperation = 'destination-out';
  for (let y = 14; y < 246; y += 12) {
    const t = y / 250;
    const w = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 30 + 2;
    ctx.beginPath();
    ctx.moveTo(32 + w * 0.25, y);
    ctx.lineTo(32 + w + 4, y + 6);
    ctx.lineTo(32 + w * 0.3, y + 8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(32 - w * 0.25, y + 6);
    ctx.lineTo(32 - w - 4, y + 12);
    ctx.lineTo(32 - w * 0.3, y + 14);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function glowCard(color = 0xffd7a0, size = 1) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({
    map: tex, color, transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, toneMapped: false, opacity: 0.85,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  return mesh;
}

function crownGeometry(len = 3.6, wid = 1.15) {
  const pos = [], uv = [], idx = [];
  const fronds = 9;
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2;
    const dx = Math.cos(a), dz = Math.sin(a);
    const px = -dz * wid * 0.5, pz = dx * wid * 0.5;
    const base = pos.length / 3;
    pos.push(0, 0.1, 0);
    pos.push(dx * len * 0.5 + px, 0.5, dz * len * 0.5 + pz);
    pos.push(dx * len, -1.25, dz * len);
    pos.push(dx * len * 0.5 - px, 0.5, dz * len * 0.5 - pz);
    uv.push(0.5, 0, 0, 0.45, 0.5, 1, 1, 0.45);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Palms: one instanced trunk mesh and one instanced crown mesh, same transforms. */
export function addPalms(scene, spots) {
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 7.4, 7);
  trunkGeo.translate(0, 3.7, 0);
  const crownGeo = crownGeometry();
  const crownMat = new THREE.MeshLambertMaterial({
    map: leafTexture(), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide,
  });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, spots.length);
  trunks.castShadow = crowns.castShadow = true;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  spots.forEach((spot, i) => {
    const lean = (spot.lean ?? 0.05);
    e.set(lean * Math.cos(spot.angle ?? i), spot.angle ?? i * 1.7, lean * Math.sin(spot.angle ?? i));
    q.setFromEuler(e);
    p.set(spot.x, spot.y ?? 0, spot.z);
    s.set(spot.scale ?? 1, spot.scale ?? 1, spot.scale ?? 1);
    m.compose(p, q, s);
    trunks.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(spot.x, (spot.y ?? 0) + 7.1 * (spot.scale ?? 1), spot.z), q, s);
    crowns.setMatrixAt(i, m);
  });
  scene.add(trunks, crowns);
  return { trunks, crowns };
}

/** Lamp posts along the kerb; the heads are emissive so they read at night. */
export function addStreetlights(scene, spots) {
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.13, 6.4, 6);
  poleGeo.translate(0, 3.2, 0);
  const armGeo = new THREE.BoxGeometry(1.7, 0.11, 0.11);
  armGeo.translate(0.85, 6.3, 0);
  const headGeo = new THREE.BoxGeometry(0.9, 0.16, 0.34);
  headGeo.translate(1.55, 6.2, 0);
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, spots.length);
  const arms = new THREE.InstancedMesh(armGeo, poleMat, spots.length);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshBasicMaterial({ color: 0xffd7a0, toneMapped: false }), spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3(1, 1, 1);
  spots.forEach((spot, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), spot.angle);
    m.compose(new THREE.Vector3(spot.x, 0, spot.z), q, s);
    poles.setMatrixAt(i, m);
    arms.setMatrixAt(i, m);
    heads.setMatrixAt(i, m);
  });
  scene.add(poles, arms, heads);

  // One additive point cloud for every lamp's halo: a single draw call.
  const pts = new Float32Array(spots.length * 3);
  spots.forEach((spot, i) => {
    pts[i * 3] = spot.x + Math.sin(spot.angle + Math.PI / 2) * 1.55;
    pts[i * 3 + 1] = 6.15;
    pts[i * 3 + 2] = spot.z + Math.cos(spot.angle + Math.PI / 2) * 1.55;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  const halo = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xffcf92, size: 7.5, map: glowCard().material.map, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    opacity: 0.85, toneMapped: false,
  }));
  halo.frustumCulled = false;
  scene.add(halo);
  return heads;
}

/** Four-lamp signal heads on a mast arm, one per intersection corner we place. */
export function addTrafficLight(scene, x, z, angle, green) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = angle;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 5.4, 6), poleMat);
  pole.position.y = 2.7;
  pole.castShadow = true;
  g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.12, 0.12), poleMat);
  arm.position.set(2.2, 5.3, 0);
  g.add(arm);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.0, 0.3), darkMat);
  box.position.set(4.2, 4.9, 0);
  g.add(box);
  const lamp = (y, color, on) => {
    const l = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 8, 6),
      new THREE.MeshBasicMaterial({ color: on ? color : 0x24222a, toneMapped: false }),
    );
    l.position.set(4.2, y, 0.17);
    g.add(l);
  };
  lamp(5.2, 0xff3b30, !green);
  lamp(4.9, 0xffc24a, false);
  lamp(4.6, 0x51ff7a, green);
  scene.add(g);
  return g;
}

export function addBench(scene, x, z, angle) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = angle;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.09, 0.5), new THREE.MeshLambertMaterial({ color: 0x7a5a3a }));
  seat.position.y = 0.45;
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.42, 0.08), new THREE.MeshLambertMaterial({ color: 0x7a5a3a }));
  back.position.set(0, 0.68, -0.22);
  g.add(seat, back);
  for (const dx of [-0.7, 0.7]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.42), darkMat);
    leg.position.set(dx, 0.22, 0);
    g.add(leg);
  }
  scene.add(g);
  return g;
}

export function addBin(scene, x, z) {
  const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.95, 8), new THREE.MeshLambertMaterial({ color: 0x3d6a52 }));
  bin.position.set(x, 0.48, z);
  bin.castShadow = true;
  scene.add(bin);
}

/** Shipping containers, stacked two or three high at the docks. */
export function addContainerStack(scene, x, z, rng, rows = 3, cols = 5) {
  const colors = [0xb5583a, 0x3d7f86, 0xc99a3e, 0x4a6a8a, 0x8c4b3a, 0x5c7a4a];
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const levels = rng.int(1, 3);
      for (let l = 0; l < levels; l++) {
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(6.1, 2.6, 2.45),
          new THREE.MeshLambertMaterial({ color: rng.pick(colors) }),
        );
        box.position.set(c * 6.4, 1.3 + l * 2.6, r * 2.6);
        box.castShadow = true;
        box.receiveShadow = true;
        g.add(box);
      }
    }
  }
  scene.add(g);
  return g;
}

/** A container crane: tower, jib, counterweight. */
export function addCrane(scene, x, z, angle) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = angle;
  const tower = new THREE.Mesh(new THREE.BoxGeometry(2.2, 26, 2.2), new THREE.MeshLambertMaterial({ color: 0xc9a227 }));
  tower.position.y = 13;
  tower.castShadow = true;
  g.add(tower);
  const jib = new THREE.Mesh(new THREE.BoxGeometry(28, 1.1, 1.4), new THREE.MeshLambertMaterial({ color: 0xc9a227 }));
  jib.position.set(8, 26, 0);
  jib.castShadow = true;
  g.add(jib);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 2.2), new THREE.MeshLambertMaterial({ color: 0x2f4a5a }));
  cab.position.set(-2, 24.6, 0);
  g.add(cab);
  const cable = new THREE.Mesh(new THREE.BoxGeometry(0.08, 9, 0.08), darkMat);
  cable.position.set(16, 20.5, 0);
  g.add(cable);
  scene.add(g);
  return g;
}

/** Beach umbrella with a striped canopy. */
export function addUmbrella(scene, x, z, rng) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), metalMat);
  pole.position.y = 1.2;
  g.add(pole);
  const colors = [0xff7a59, 0x43e8ff, 0xffc24a, 0xff3fd0];
  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(1.55, 0.55, 12, 1, true),
    new THREE.MeshLambertMaterial({ color: rng.pick(colors), side: THREE.DoubleSide }),
  );
  canopy.position.y = 2.5;
  canopy.castShadow = true;
  g.add(canopy);
  const towel = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.04, 1.9),
    new THREE.MeshLambertMaterial({ color: rng.pick([0xf6f1e7, 0xff9a7a, 0x9fe0c8]) }),
  );
  towel.position.set(rng.range(-1, 1), 0.02, rng.range(0.8, 1.6));
  towel.rotation.y = rng.range(-0.4, 0.4);
  g.add(towel);
  scene.add(g);
  return g;
}

/** A moored motor yacht: hull, cabin, flybridge, radar mast. */
export function addBoat(scene, x, z, angle, rng) {
  const g = new THREE.Group();
  g.position.set(x, -0.35, z);
  g.rotation.y = angle;
  const hullColor = rng.pick([0xf6f1e7, 0x2f4a66, 0xe0432f, 0xd8d2c4]);
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.5, 9.5), new THREE.MeshLambertMaterial({ color: hullColor }));
  hull.position.y = 0.4;
  hull.castShadow = true;
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.2, 4), new THREE.MeshLambertMaterial({ color: hullColor }));
  bow.rotation.x = Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.position.set(0, 0.4, -6.2);
  g.add(bow);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.3, 4.2), new THREE.MeshLambertMaterial({ color: 0xe8e4da }));
  cabin.position.set(0, 1.8, 0.4);
  g.add(cabin);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(2.45, 0.55, 3.0),
    new THREE.MeshLambertMaterial({ color: 0x18303c }),
  );
  glass.position.set(0, 2.1, 0.4);
  g.add(glass);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5), metalMat);
  mast.position.set(0, 3.6, 1.0);
  g.add(mast);
  scene.add(g);
  return g;
}

/** Wooden pier planks and posts for the marina boardwalk. */
export function addPier(scene, x, z, w, d, rng) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, d), new THREE.MeshLambertMaterial({ color: 0x9a7a56 }));
  deck.position.y = 0.35;
  deck.receiveShadow = true;
  g.add(deck);
  const postGeo = new THREE.CylinderGeometry(0.16, 0.18, 3.4, 6);
  const count = Math.floor(w / 2.2);
  const posts = new THREE.InstancedMesh(postGeo, trunkMat, count * 2);
  const m = new THREE.Matrix4();
  let i = 0;
  for (let k = 0; k < count; k++) {
    for (const side of [-1, 1]) {
      m.makeTranslation(-w / 2 + k * 2.2 + 1, 0.2, side * (d / 2 - 0.3));
      posts.setMatrixAt(i++, m);
    }
  }
  posts.castShadow = true;
  g.add(posts);
  scene.add(g);
  return g;
}

export { makeRng };
