// NEON PALMS — Palma Sol itself. A deterministic eight-by-eight grid of blocks,
// ringed by beach and sea to the west, marina to the south, docks to the east and
// hills to the north. Everything static is built once: roads, kerbs, lane paint,
// buildings, palms, lamps, signals, the pier and its wheel, containers and boats.

import * as THREE from 'three';
import {
  GRID, WORLD, PALETTE, DISTRICTS, FACADES, SIGN_NAMES, blockCentre,
} from '../core/config.js';
import { BoxGrid, makeRng, districtAt } from '../core/util.js';
import { createBuilding, styleFor, pickSign } from './buildings.js';
import {
  addPalms, addStreetlights, addTrafficLight, addBench, addBin, addContainerStack,
  addCrane, addUmbrella, addBoat, addPier,
} from './props.js';

const R = (i) => GRID.origin + i * GRID.pitch;        // centre line of road i
const B = (i) => GRID.origin + i * GRID.pitch + GRID.pitch / 2; // centre of block i
const N = GRID.blocks;

// ---------------------------------------------------------------- water

const WATER_VERT = /* glsl */ `
uniform float time;
varying vec3 vWorld;
varying vec2 vUv;
void main() {
  vec3 p = position;
  float w = sin(p.x * 0.05 + time * 0.9) * 0.22 + sin(p.y * 0.08 - time * 1.3) * 0.16;
  p.z += w;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const WATER_FRAG = /* glsl */ `
uniform float time;
uniform vec3 deep;
uniform vec3 shallow;
uniform vec3 sunColor;
uniform vec3 sunDir;
uniform float night;
varying vec3 vWorld;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

void main() {
  vec2 p = vWorld.xz;
  float n1 = sin(p.x * 0.11 + time * 1.1) * 0.5 + 0.5;
  float n2 = sin(p.y * 0.17 - time * 1.4) * 0.5 + 0.5;
  float n3 = sin((p.x + p.y) * 0.07 + time * 0.7) * 0.5 + 0.5;
  float ripple = (n1 + n2 + n3) / 3.0;

  vec3 col = mix(deep, shallow, ripple * 0.55 + 0.15);
  float dist = length(p - cameraPosition.xz);
  col = mix(col, deep * 0.85, clamp(dist / 900.0, 0.0, 0.7));

  vec3 viewDir = normalize(cameraPosition - vWorld);
  vec3 nrm = normalize(vec3((n1 - 0.5) * 0.35, 1.0, (n2 - 0.5) * 0.35));
  vec3 refl = reflect(-viewDir, nrm);
  float spec = pow(max(dot(refl, normalize(sunDir)), 0.0), 90.0);
  float glit = step(0.985, hash(floor(p * 2.4) + floor(time * 3.0))) * 0.5;
  col += sunColor * (spec * 1.9 + glit * (0.25 + 0.75 * ripple)) * (1.0 - night * 0.75);

  float fres = pow(1.0 - max(dot(viewDir, nrm), 0.0), 3.0);
  col = mix(col, mix(vec3(0.95, 0.55, 0.42), vec3(0.16, 0.16, 0.3), night), fres * 0.55);
  col += vec3(0.02, 0.03, 0.05) * ripple;
  gl_FragColor = vec4(col, 1.0);
}`;

// ---------------------------------------------------------------- city

export class City {
  constructor(scene, seed = 20261120) {
    this.scene = scene;
    this.rng = makeRng(seed);
    this.colliders = new BoxGrid(26);
    this.buildings = [];
    this.blocks = [];
    this.roadLines = [];
    this.intersections = [];
    this.time = 0;
    this.landmarks = {};
    this._buildGround();
    this._buildWater();
    this._buildRoads();
    this._buildBlocks();
    this._buildBeach();
    this._buildMarina();
    this._buildDocks();
    this._buildHills();
    this._buildStreetFurniture();
  }

  // ---- ground, kerbs, paint ------------------------------------------------

  _buildGround() {
    const g = new THREE.Group();
    const asphalt = new THREE.Mesh(
      new THREE.PlaneGeometry(820, 820),
      new THREE.MeshLambertMaterial({ color: PALETTE.asphalt }),
    );
    asphalt.rotation.x = -Math.PI / 2;
    asphalt.position.y = 0;
    asphalt.receiveShadow = true;
    g.add(asphalt);

    // Sidewalk slabs, one per block, with a kerb lip and a painted gutter line.
    const slabMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
    const kerbMat = new THREE.MeshLambertMaterial({ color: PALETTE.kerb });
    const slabGeo = new THREE.BoxGeometry(GRID.block, WORLD.sidewalk, GRID.block);
    const kerbGeo = new THREE.BoxGeometry(GRID.block + 0.7, 0.1, GRID.block + 0.7);
    const slabs = new THREE.InstancedMesh(slabGeo, slabMat, N * N);
    const kerbs = new THREE.InstancedMesh(kerbGeo, kerbMat, N * N);
    slabs.receiveShadow = true;
    kerbs.receiveShadow = true;
    const m = new THREE.Matrix4();
    let k = 0;
    for (let ix = 0; ix < N; ix++) {
      for (let iz = 0; iz < N; iz++) {
        m.makeTranslation(B(ix), WORLD.sidewalk / 2, B(iz));
        slabs.setMatrixAt(k, m);
        m.makeTranslation(B(ix), 0.03, B(iz));
        kerbs.setMatrixAt(k, m);
        k++;
      }
    }
    g.add(slabs, kerbs);
    this.scene.add(g);

    // The city's edge: a low sea wall and a promenade along the water.
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 830), new THREE.MeshLambertMaterial({ color: 0xb9ae9e }));
    wall.position.set(-402, 0.55, 0);
    wall.receiveShadow = true;
    this.scene.add(wall);
    const promenade = new THREE.Mesh(new THREE.PlaneGeometry(18, 830), new THREE.MeshLambertMaterial({ color: 0x9d938c }));
    promenade.rotation.x = -Math.PI / 2;
    promenade.position.set(-411, 0.06, 0);
    promenade.receiveShadow = true;
    this.scene.add(promenade);
  }

  _buildWater() {
    const uniforms = {
      time: { value: 0 },
      deep: { value: new THREE.Color(PALETTE.seaDeep) },
      shallow: { value: new THREE.Color(PALETTE.sea) },
      sunColor: { value: new THREE.Color(PALETTE.sun) },
      sunDir: { value: new THREE.Vector3(-0.86, 0.13, 0.49).normalize() },
      night: { value: 0 },
    };
    const geo = new THREE.PlaneGeometry(2600, 2600, 48, 48);
    this.water = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms, vertexShader: WATER_VERT, fragmentShader: WATER_FRAG,
    }));
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(-240, WORLD.water, -60);
    this.scene.add(this.water);

    // Sand between the promenade and the water, plus a wet strip at the tideline.
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(58, 830), new THREE.MeshLambertMaterial({ color: PALETTE.sand }));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(-440, 0.05, 0);
    sand.receiveShadow = true;
    this.scene.add(sand);
    const wet = new THREE.Mesh(new THREE.PlaneGeometry(14, 830), new THREE.MeshLambertMaterial({ color: 0xc9ab84 }));
    wet.rotation.x = -Math.PI / 2;
    wet.position.set(-462, 0.03, 0);
    this.scene.add(wet);

    const south = new THREE.Mesh(new THREE.PlaneGeometry(830, 46), new THREE.MeshLambertMaterial({ color: PALETTE.sand }));
    south.rotation.x = -Math.PI / 2;
    south.position.set(0, 0.05, 424);
    this.scene.add(south);
  }

  _buildRoads() {
    for (let i = 0; i <= N; i++) this.roadLines.push(R(i));

    const dashGeo = new THREE.BoxGeometry(0.16, 0.02, 2.6);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xd9d0b4 });
    const dashes = [];
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j < N; j++) {
        const start = R(j) + GRID.road / 2 + 3;
        const end = R(j + 1) - GRID.road / 2 - 3;
        for (let t = start; t < end; t += 7) {
          dashes.push({ x: R(i), z: t, rot: 0 });
          dashes.push({ x: t, z: R(i), rot: Math.PI / 2 });
        }
      }
    }
    const mesh = new THREE.InstancedMesh(dashGeo, dashMat, dashes.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    dashes.forEach((d, k) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), d.rot);
      m.compose(new THREE.Vector3(d.x, 0.015, d.z), q, s);
      mesh.setMatrixAt(k, m);
    });
    this.scene.add(mesh);

    // Solid edge lines and zebra crossings at every intersection.
    const edgeGeo = new THREE.BoxGeometry(0.14, 0.02, 1);
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xc9c0a4 });
    const stripes = [];
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        const cx = R(i), cz = R(j);
        for (let s2 = -8.5; s2 <= 8.5; s2 += 1.5) {
          stripes.push({ x: cx + s2, z: cz - GRID.road / 2 - 2.2, rot: 0 });
          stripes.push({ x: cx + s2, z: cz + GRID.road / 2 + 2.2, rot: 0 });
          stripes.push({ x: cx - GRID.road / 2 - 2.2, z: cz + s2, rot: Math.PI / 2 });
          stripes.push({ x: cx + GRID.road / 2 + 2.2, z: cz + s2, rot: Math.PI / 2 });
        }
        this.intersections.push({ x: cx, z: cz, i, j });
      }
    }
    const zebra = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.02, 3.4), edgeMat, stripes.length);
    stripes.forEach((d, k) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), d.rot);
      m.compose(new THREE.Vector3(d.x, 0.016, d.z), q, s);
      zebra.setMatrixAt(k, m);
    });
    this.scene.add(zebra);
  }

  // ---- blocks and buildings ------------------------------------------------

  _buildBlocks() {
    const rng = this.rng;
    for (let ix = 0; ix < N; ix++) {
      for (let iz = 0; iz < N; iz++) {
        const cx = B(ix), cz = B(iz);
        const district = districtAt(cx, cz, DISTRICTS).id;
        const inner = GRID.block - 8;
        const lots = this._lots(inner, district, rng);
        const block = { cx, cz, district, buildings: [] };
        for (const lot of lots) {
          const style = styleFor(district, rng);
          const h = this._height(district, rng);
          const w = lot.w, d = lot.d;
          const x = cx + lot.x, z = cz + lot.z;
          const sign = rng.chance(district === 'ocean' || district === 'playa' ? 0.55 : 0.22)
            ? pickSign(rng, SIGN_NAMES) : null;
          const { group } = createBuilding(rng, { x, z, w, d, h, style: style.style, color: style.color, sign });
          this.scene.add(group);
          this.colliders.insert({
            minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, height: h,
          });
          block.buildings.push({ x, z, w, d, h, district });
          this.buildings.push({ x, z, w, d, h, district });
        }
        this.blocks.push(block);
      }
    }
  }

  _height(district, rng) {
    if (district === 'centro') return rng.range(26, 92);
    if (district === 'ocean') return rng.range(9, 24);
    if (district === 'puerto') return rng.range(7, 15);
    if (district === 'colinas') return rng.range(5, 11);
    return rng.range(11, 30);
  }

  /** One to four lots inside a block, with alleys between them. */
  _lots(inner, district, rng) {
    const count = district === 'centro' ? rng.int(1, 2) : rng.int(2, 4);
    if (count === 1) return [{ x: 0, z: 0, w: inner, d: inner }];
    if (count === 2) {
      const w = inner * rng.range(0.42, 0.52);
      const gap = inner * 0.1;
      return [
        { x: -(w + gap) / 2, z: 0, w, d: inner * rng.range(0.8, 1) },
        { x: (w + gap) / 2, z: 0, w, d: inner * rng.range(0.8, 1) },
      ];
    }
    const half = inner / 2 - 2.5;
    const out = [];
    const quad = count === 3 ? 3 : 4;
    const spots = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (let i = 0; i < quad; i++) {
      const [sx, sz] = spots[i];
      const w = half * rng.range(0.8, 0.98);
      const d = half * rng.range(0.8, 0.98);
      out.push({ x: sx * (half / 2 + 1.2), z: sz * (half / 2 + 1.2), w, d });
    }
    return out;
  }

  // ---- the coast, marina and docks ----------------------------------------

  _buildBeach() {
    const rng = this.rng;
    for (let z = -330; z <= 330; z += 34) {
      if (rng.chance(0.75)) addUmbrella(this.scene, -424 + rng.range(-6, 6), z + rng.range(-8, 8), rng);
      if (rng.chance(0.4)) {
        const tower = new THREE.Group();
        const legMat = new THREE.MeshLambertMaterial({ color: 0xf6f1e7 });
        const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.4, 3.2), legMat);
        base.position.y = 0.2;
        tower.add(base);
        for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.2, 0.22), legMat);
          leg.position.set(dx, 1.3, dz);
          tower.add(leg);
        }
        const hut = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.2, 3.0), new THREE.MeshLambertMaterial({ color: 0xff9a7a }));
        hut.position.y = 3.4;
        hut.castShadow = true;
        tower.add(hut);
        tower.position.set(-434 + rng.range(-3, 3), 0, z + rng.range(-10, 10));
        this.scene.add(tower);
      }
    }

    // The pleasure pier with its wheel: the landmark the cover shot frames.
    const pierZ = 118;
    addPier(this.scene, -470, pierZ, 96, 16, rng);
    this._addFerrisWheel(-500, pierZ, 13);
    this.landmarks.pier = { x: -470, z: pierZ };
  }

  _addFerrisWheel(x, z, radius) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const steel = new THREE.MeshLambertMaterial({ color: 0xe8e2d6 });
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.9, radius * 1.6, 0.9), steel);
      leg.position.set(side * radius * 0.55, radius * 0.8, 0);
      leg.rotation.z = side * 0.32;
      leg.castShadow = true;
      g.add(leg);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.2, 10), steel);
    hub.rotation.x = Math.PI / 2;
    hub.position.y = radius;
    g.add(hub);

    this.wheel = new THREE.Group();
    this.wheel.position.y = radius;
    const rimMat = new THREE.MeshBasicMaterial({ color: 0xffc24a, toneMapped: false });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.16, 6, 40), rimMat);
    this.wheel.add(rim);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.12, radius * 2, 0.12), steel);
      spoke.rotation.z = a;
      this.wheel.add(spoke);
      const gondola = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 1.3, 1.3),
        new THREE.MeshLambertMaterial({ color: [0xff7a59, 0x43e8ff, 0xffc24a, 0xff3fd0][i % 4] }),
      );
      gondola.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
      this.wheel.add(gondola);
    }
    g.add(this.wheel);
    this.scene.add(g);
    this.landmarks.wheel = { x, z };
  }

  _buildMarina() {
    const rng = this.rng;
    // Boardwalk along the south shore.
    const board = new THREE.Mesh(new THREE.BoxGeometry(760, 0.25, 22), new THREE.MeshLambertMaterial({ color: 0x8d6f4f }));
    board.position.set(40, 0.14, 404);
    board.receiveShadow = true;
    this.scene.add(board);

    for (let i = 0; i < 4; i++) {
      const px = -140 + i * 120;
      addPier(this.scene, px, 436, 12, 46, rng);
      for (let b = 0; b < 3; b++) {
        addBoat(this.scene, px + (b - 1) * 5.2, 446 + rng.range(0, 8), 0, rng);
      }
    }
    this.landmarks.marina = { x: 40, z: 404 };

    // A harbour light and a row of palms along the boardwalk.
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.9, 16, 12), new THREE.MeshLambertMaterial({ color: 0xf2efe6 }));
    tower.position.set(330, 8, 412);
    tower.castShadow = true;
    this.scene.add(tower);
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 1.6, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff0c0, toneMapped: false }),
    );
    lamp.position.set(330, 16.4, 412);
    this.scene.add(lamp);
  }

  _buildDocks() {
    const rng = this.rng;
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(120, 760), new THREE.MeshLambertMaterial({ color: 0x6f6a66 }));
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(452, 0.04, 0);
    apron.receiveShadow = true;
    this.scene.add(apron);

    addContainerStack(this.scene, 408, -180, rng, 4, 6);
    addContainerStack(this.scene, 430, 40, rng, 3, 5);
    addContainerStack(this.scene, 400, 210, rng, 3, 4);
    addCrane(this.scene, 470, -120, -Math.PI / 2);
    addCrane(this.scene, 470, 90, -Math.PI / 2);
    this.landmarks.docks = { x: 430, z: -60 };

    for (const [x, z, w, d] of [[420, -180, 22, 60], [424, 44, 22, 54], [418, 216, 20, 40]]) {
      this.colliders.insert({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, height: 8 });
    }
  }

  _buildHills() {
    const rng = this.rng;
    const ridge = new THREE.Mesh(
      new THREE.PlaneGeometry(820, 260, 24, 8),
      new THREE.MeshLambertMaterial({ color: 0x3f5f45, flatShading: true }),
    );
    ridge.rotation.x = -Math.PI / 2;
    ridge.position.set(0, 0.08, -470);
    this.scene.add(ridge);
    for (let i = 0; i < 26; i++) {
      const hill = new THREE.Mesh(
        new THREE.ConeGeometry(rng.range(40, 90), rng.range(12, 34), 6),
        new THREE.MeshLambertMaterial({ color: rng.chance(0.5) ? 0x3f5f45 : 0x4e6f4a, flatShading: true }),
      );
      hill.position.set(rng.range(-380, 380), 0, rng.range(-520, -440));
      hill.rotation.y = rng.range(0, Math.PI);
      this.scene.add(hill);
    }
    this.landmarks.hills = { x: 0, z: -450 };
  }

  _buildStreetFurniture() {
    const rng = this.rng;
    const palmSpots = [];
    const lampSpots = [];
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const cx = B(i), cz = B(j);
        const edge = GRID.block / 2 - 1.6;
        const sides = [
          { x: cx + edge, z: cz + rng.range(-edge, edge), a: 0 },
          { x: cx - edge, z: cz + rng.range(-edge, edge), a: Math.PI },
          { x: cx + rng.range(-edge, edge), z: cz + edge, a: 0 },
          { x: cx + rng.range(-edge, edge), z: cz - edge, a: 0 },
        ];
        for (const s of sides) {
          if (rng.chance(0.55)) palmSpots.push({ x: s.x, z: s.z, angle: rng.range(0, 6.28), scale: rng.range(0.85, 1.25), lean: rng.range(0.02, 0.09) });
        }
        if (rng.chance(0.5)) addBench(this.scene, cx + edge - 1, cz + rng.range(-10, 10), -Math.PI / 2);
        if (rng.chance(0.35)) addBin(this.scene, cx - edge + 0.6, cz + rng.range(-10, 10));
      }
    }
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        const cx = R(i), cz = R(j);
        const off = GRID.road / 2 + 1.4;
        lampSpots.push({ x: cx + off, z: cz + off, angle: Math.PI });
        lampSpots.push({ x: cx - off, z: cz - off, angle: 0 });
        if ((i + j) % 2 === 0) addTrafficLight(this.scene, cx + off, cz - off, Math.PI, (i + j) % 4 === 0);
      }
    }
    // The promenade's own row of palms, the postcard shot.
    for (let z = -330; z <= 330; z += 26) {
      palmSpots.push({ x: -406, z, angle: rng.range(0, 6.28), scale: rng.range(0.95, 1.35), lean: rng.range(0.03, 0.1) });
    }
    addPalms(this.scene, palmSpots);
    this.lampHeads = addStreetlights(this.scene, lampSpots);
  }

  // ---- queries used by the systems ----------------------------------------

  district(x, z) { return districtAt(x, z, DISTRICTS).name; }

  onRoad(x, z) {
    for (const r of this.roadLines) {
      if (Math.abs(x - r) < GRID.road / 2 || Math.abs(z - r) < GRID.road / 2) return true;
    }
    return false;
  }

  /** A random lane pose for traffic: axis, direction, and the lane's centre line. */
  randomLane(rng) {
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const line = rng.int(0, N);
    const dir = rng.sign();
    return { axis, line, dir, t: rng.range(-360, 360) };
  }

  lanePose(lane) {
    const off = lane.dir * 5;
    if (lane.axis === 'z') return { x: R(lane.line) + off, z: lane.t, angle: lane.dir > 0 ? 0 : Math.PI };
    return { x: lane.t, z: R(lane.line) - off, angle: lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2 };
  }

  /** A sidewalk spot: on a block's slab, clear of its buildings. */
  randomSidewalk(rng) {
    for (let tries = 0; tries < 20; tries++) {
      const ix = rng.int(0, N - 1), iz = rng.int(0, N - 1);
      const cx = B(ix), cz = B(iz);
      const edge = GRID.block / 2 - 2;
      const side = rng.int(0, 3);
      const along = rng.range(-edge, edge);
      const x = side === 0 ? cx + edge : side === 1 ? cx - edge : cx + along;
      const z = side === 2 ? cz + edge : side === 3 ? cz - edge : cz + along;
      if (!this.blocked(x, z, 0.6)) return { x, z };
    }
    return { x: B(4), z: B(4) };
  }

  blocked(x, z, pad = 0.5) {
    const boxes = this.colliders.near(x, z, []);
    for (const b of boxes) {
      if (x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad) return true;
    }
    return false;
  }

  /** A clear point on the road, at least `min` metres from (x,z). */
  roadSpotNear(x, z, min, max, rng) {
    for (let i = 0; i < 30; i++) {
      const lane = this.randomLane(rng);
      const pose = this.lanePose(lane);
      const d = Math.hypot(pose.x - x, pose.z - z);
      if (d > min && d < max) return pose;
    }
    const lane = this.randomLane(rng);
    return this.lanePose(lane);
  }

  update(dt, hour) {
    this.time += dt;
    if (this.water) {
      this.water.material.uniforms.time.value = this.time;
      const night = THREE.MathUtils.clamp((hour - 19.1) / 3.2, 0, 1);
      this.water.material.uniforms.night.value = night;
    }
    if (this.wheel) this.wheel.rotation.z += dt * 0.06;
  }
}

export { blockCentre };
