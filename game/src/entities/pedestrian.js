// NEON PALMS — people on the pavement. Each walker keeps to a block's kerb line,
// turns at the corner, and breaks into a run when a gun goes off or a car comes
// at them. They are the cheapest way to make a street feel alive.

import * as THREE from 'three';
import { PEDS } from '../core/config.js';
import { clamp, damp, angleDamp, dist, makeRng, TAU } from '../core/util.js';
import { makeHuman } from './player.js';

export class Ped {
  constructor(scene, city, rng) {
    this.city = city;
    this.rng = rng;
    const body = makeHuman(rng, {});
    this.mesh = body.group;
    this.legs = body.legs;
    this.arms = body.arms;
    this.state = 'walk';
    this.speed = 0;
    this.phase = rng.range(0, TAU);
    this.fleeTimer = 0;
    this.dead = false;
    this.fallAngle = 0;
    this.pos = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.heading = 0;
    this.spawn(scene);
  }

  spawn(scene) {
    const spot = this.city.randomSidewalk(this.rng);
    this.pos.set(spot.x, 0, spot.z);
    this.target.copy(this.pos);
    this.pickTarget();
    this.mesh.visible = true;
    this.mesh.rotation.set(0, this.rng.range(0, TAU), 0);
    if (!this.mesh.parent) scene.add(this.mesh);
  }

  pickTarget() {
    const spot = this.city.randomSidewalk(this.rng);
    this.target.set(spot.x, 0, spot.z);
  }

  flee(fromX, fromZ, seconds = 6) {
    if (this.dead) return;
    this.state = 'flee';
    this.fleeTimer = seconds;
    const dx = this.pos.x - fromX, dz = this.pos.z - fromZ;
    const len = Math.hypot(dx, dz) || 1;
    this.target.set(this.pos.x + (dx / len) * 26, 0, this.pos.z + (dz / len) * 26);
  }

  update(dt) {
    if (this.dead) {
      this.fallAngle = damp(this.fallAngle, Math.PI / 2, 6, dt);
      this.mesh.rotation.x = this.fallAngle;
      return;
    }
    if (this.fleeTimer > 0) {
      this.fleeTimer -= dt;
      if (this.fleeTimer <= 0) { this.state = 'walk'; this.pickTarget(); }
    }
    const dx = this.target.x - this.pos.x;
    const dz = this.target.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.2) {
      if (this.state === 'flee') this.pickTarget();
      else this.pickTarget();
    }
    const speed = this.state === 'flee' ? 5.2 : PEDS.walk;
    this.speed = damp(this.speed, d > 1 ? speed : 0, 6, dt);
    if (d > 0.001) {
      this.heading = angleDamp(this.heading, Math.atan2(dx, dz), 8, dt);
      this.pos.x += (dx / d) * this.speed * dt;
      this.pos.z += (dz / d) * this.speed * dt;
    }
    this.city.colliders.resolveCircle(this.pos, 0.45);
    this.pos.x = clamp(this.pos.x, -468, 500);
    this.pos.z = clamp(this.pos.z, -468, 468);

    this.phase += dt * (2 + this.speed * 1.6);
    const swing = Math.sin(this.phase) * clamp(this.speed / 2.2, 0, 1);
    this.legs[0].rotation.x = swing * 0.8;
    this.legs[1].rotation.x = -swing * 0.8;
    this.arms[0].rotation.x = -swing * 0.6;
    this.arms[1].rotation.x = swing * 0.6;
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.heading;
  }

  kill() {
    this.dead = true;
    this.state = 'down';
  }
}

export class Pedestrians {
  constructor(scene, city, count = PEDS.count) {
    this.scene = scene;
    this.city = city;
    this.rng = makeRng(88);
    this.list = [];
    for (let i = 0; i < count; i++) this.list.push(new Ped(scene, city, this.rng));
    this.respawnTimer = 0;
  }

  update(dt, focus) {
    for (const p of this.list) {
      if (p.dead) continue;
      const d = dist(p.pos.x, p.pos.z, focus.x, focus.z);
      if (d > PEDS.despawnRadius) {
        // Recycle walkers far from the camera, so the pavement near the player stays full.
        p.spawn(this.scene);
        continue;
      }
      p.update(dt);
    }
  }

  /** Startle everyone within `radius` of a noise. */
  alarm(x, z, radius = 26) {
    for (const p of this.list) {
      if (p.dead) continue;
      if (dist(p.pos.x, p.pos.z, x, z) < radius) p.flee(x, z, 6 + Math.random() * 3);
    }
  }

  nearest(x, z, maxDist = 60) {
    let best = null, bestD = maxDist;
    for (const p of this.list) {
      if (p.dead) continue;
      const d = dist(p.pos.x, p.pos.z, x, z);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }
}
