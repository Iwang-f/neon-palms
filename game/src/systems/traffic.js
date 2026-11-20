// NEON PALMS — traffic. Cars run the grid on the right-hand lane, choose a new
// direction at each junction (straight first, then right, then left), brake for
// whatever is in front of them and scatter when a siren gets close.

import * as THREE from 'three';
import { TRAFFIC, VEHICLES, GRID } from '../core/config.js';
import { clamp, damp, angleDamp, dist, makeRng } from '../core/util.js';
import { Vehicle, parkedType } from '../entities/vehicle.js';

const R = (i) => GRID.origin + i * GRID.pitch;
const N = GRID.blocks;

class TrafficCar {
  constructor(traffic, type) {
    this.traffic = traffic;
    this.city = traffic.city;
    this.rng = traffic.rng;
    const lane = this.city.randomLane(this.rng);
    const pose = this.city.lanePose(lane);
    this.vehicle = new Vehicle(traffic.scene, this.city, type, pose.x, pose.z, pose.angle);
    this.vehicle.driver = 'ai';
    this.vehicle.ai = this;

    // Which junction we are driving toward, and which we came from.
    const axis = lane.axis;
    this.axis = axis;
    this.dir = lane.dir;
    this.from = axis === 'z'
      ? { i: lane.line, j: this.nearestIndex(pose.z) - lane.dir }
      : { i: this.nearestIndex(pose.x) - lane.dir, j: lane.line };
    this.to = axis === 'z'
      ? { i: lane.line, j: this.nearestIndex(pose.z) }
      : { i: this.nearestIndex(pose.x), j: lane.line };
    this.cruise = TRAFFIC.speed + this.rng.range(-TRAFFIC.speedSpread, TRAFFIC.speedSpread);
    this.speed = this.cruise * 0.6;
    this.stuck = 0;
    this.honk = 0;
  }

  nearestIndex(v) {
    let best = 0, bestD = Infinity;
    for (let i = 0; i <= N; i++) {
      const d = Math.abs(R(i) - v);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  targetPoint() {
    const { i, j } = this.to;
    if (this.axis === 'z') return { x: R(i) + this.dir * 5, z: R(j) };
    return { x: R(i), z: R(j) - this.dir * 5 };
  }

  chooseNext() {
    const { i, j } = this.to;
    const options = [];
    const straight = this.axis === 'z' ? { i, j: j + this.dir } : { i: i + this.dir, j };
    if (straight.i >= 0 && straight.i <= N && straight.j >= 0 && straight.j <= N) options.push({ node: straight, weight: 5 });
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || ni > N || nj < 0 || nj > N) continue;
      if (ni === this.from.i && nj === this.from.j) continue;
      if (ni === straight.i && nj === straight.j) continue;
      options.push({ node: { i: ni, j: nj }, weight: 1 });
    }
    if (options.length === 0) { this.dir = -this.dir; return; }
    let total = 0;
    for (const o of options) total += o.weight;
    let pick = this.rng.next() * total;
    let chosen = options[0];
    for (const o of options) { pick -= o.weight; if (pick <= 0) { chosen = o; break; } }
    const next = chosen.node;
    this.axis = next.i !== i ? 'x' : 'z';
    this.dir = this.axis === 'x' ? Math.sign(next.i - i) : Math.sign(next.j - j);
    this.from = { i, j };
    this.to = next;
  }

  update(dt, focus, playerCar) {
    const v = this.vehicle;
    if (v.dead) return;
    const t = this.targetPoint();
    const d = dist(v.pos.x, v.pos.z, t.x, t.z);
    if (d < 3.2) {
      this.from = this.to;
      this.chooseNext();
    }
    const t2 = this.targetPoint();
    const want = Math.atan2(t2.x - v.pos.x, t2.z - v.pos.z);
    const err = Math.abs(((want - v.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI);

    // Look ahead for the car in front, the player, or the kerb.
    let blockAhead = 0;
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    for (const other of this.traffic.list) {
      if (other === this || other.vehicle.dead) continue;
      const dx = other.vehicle.pos.x - v.pos.x, dz = other.vehicle.pos.z - v.pos.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < 12 && side < 2.4) blockAhead = Math.max(blockAhead, 1 - along / 12);
    }
    if (playerCar && !playerCar.dead) {
      const dx = playerCar.pos.x - v.pos.x, dz = playerCar.pos.z - v.pos.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < 14 && side < 2.6) blockAhead = Math.max(blockAhead, 1 - along / 14);
    }

    const cornerSlow = clamp(1 - err * 1.4, 0.35, 1);
    const targetSpeed = this.cruise * cornerSlow * (1 - blockAhead * 0.95);
    this.speed = damp(this.speed, targetSpeed, 2.4, dt);
    if (this.speed < 0.6 && blockAhead > 0.2) this.stuck += dt; else this.stuck = Math.max(0, this.stuck - dt);

    const steer = clamp(((want - v.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1, 1);
    v.update(dt, {
      throttle: this.speed > 0.4 ? clamp(this.speed / Math.max(v.speed, 1), 0, 1) : 0,
      steer: steer * 1.1,
      handbrake: false,
    });
    if (v.speed < -0.5) v.speed = 0;
    v.sirenOn = false;
  }
}

export class Traffic {
  constructor(scene, city, count = TRAFFIC.count) {
    this.scene = scene;
    this.city = city;
    this.rng = makeRng(1234);
    this.list = [];
    this.parked = [];
    this.spawnTimer = 0;
    for (let i = 0; i < count; i++) this.spawnCar();
    this._parkCars(22);
  }

  spawnCar(type) {
    const t = type ?? this.rng.pick(['sedan', 'sedan', 'taxi', 'coupe', 'van', 'muscle']);
    this.list.push(new TrafficCar(this, t));
  }

  _parkCars(count) {
    for (let i = 0; i < count; i++) {
      const spot = this.city.randomSidewalk(this.rng);
      const type = parkedType('ocean', this.rng);
      // Nose the car into the kerb, on the road side of the pavement.
      const angle = this.rng.pick([0, Math.PI, Math.PI / 2, -Math.PI / 2]);
      const car = new Vehicle(this.scene, this.city, type, spot.x, spot.z, angle);
      car.driver = null;
      car.parked = true;
      this.parked.push(car);
    }
  }

  get vehicles() { return this.list.map((c) => c.vehicle).concat(this.parked); }

  update(dt, focus, playerCar) {
    for (const car of this.list) {
      const d = dist(car.vehicle.pos.x, car.vehicle.pos.z, focus.x, focus.z);
      car.update(dt, focus, playerCar);
      if (d > TRAFFIC.despawnRadius) {
        // Teleport far-away cars back into the ring around the player.
        const pose = this.city.roadSpotNear(focus.x, focus.z, 180, 320, this.rng);
        car.vehicle.pos.set(pose.x, 0, pose.z);
        car.vehicle.heading = pose.angle;
        car.vehicle.speed = 6;
      }
    }
  }

  /** A moving car the player can steal (nearest within range). */
  nearest(x, z, maxDist = 5.5) {
    let best = null, bestD = maxDist;
    for (const car of this.list) {
      const d = dist(car.vehicle.pos.x, car.vehicle.pos.z, x, z);
      if (d < bestD) { bestD = d; best = car.vehicle; }
    }
    for (const car of this.parked) {
      if (car.dead) continue;
      const d = dist(car.pos.x, car.pos.z, x, z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }
}
