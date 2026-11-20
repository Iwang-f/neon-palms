// NEON PALMS — gunplay. Hitscan rounds drawn as short tracers, with spread,
// range, damage falloff and the consequences: peds run, cars take holes, the
// police get called. Player and PSD officers both fire through here.

import * as THREE from 'three';
import { WEAPONS } from '../core/config.js';
import { clamp, dist, dist2, makeRng } from '../core/util.js';

const MAX_TRACERS = 64;
const tracerGeo = new THREE.BoxGeometry(0.06, 0.06, 1.0);
const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe1a0, toneMapped: false });

export class Combat {
  constructor(scene, G) {
    this.scene = scene;
    this.G = G;
    this.rng = makeRng(7);
    this.bullets = [];
    this.tracers = [];
    for (let i = 0; i < MAX_TRACERS; i++) {
      const m = new THREE.Mesh(tracerGeo, tracerMat);
      m.visible = false;
      scene.add(m);
      this.tracers.push(m);
    }
    this.tracerIndex = 0;
  }

  /** shooter: 'player' | 'police' | 'ped'; origin in world metres. */
  fire(shooter, x, y, z, angle, weaponId, opts = {}) {
    const w = WEAPONS[weaponId] ?? WEAPONS.pistol;
    const pellets = w.pellets ?? 1;
    for (let p = 0; p < pellets; p++) {
      const spread = (this.rng.next() - 0.5) * 2 * w.spread;
      const a = angle + spread;
      this.bullets.push({
        x, y, z,
        dx: Math.sin(a), dz: Math.cos(a),
        speed: 240,
        travelled: 0,
        range: w.range,
        damage: w.damage,
        owner: shooter,
        weapon: weaponId,
      });
    }
    this.G.effects.flash(x + Math.sin(angle) * 0.6, y, z + Math.cos(angle) * 0.6, 0xffb060, 20, 0.06);
    this.G.effects.sparks(x + Math.sin(angle) * 0.7, y, z + Math.cos(angle) * 0.7, 3, new THREE.Color(0xffd090), 3);
    this.G.audio?.shot(x, z, weaponId);
    if (shooter === 'player') {
      this.G.peds?.alarm(x, z, 30);
      this.G.police?.report('gunfire', x, z);
      this.G.player.fireCooldown = w.rate;
      if (w.ammo !== Infinity) {
        const id = this.G.player.weapon;
        this.G.player.ammo[id] = Math.max(0, (this.G.player.ammo[id] ?? 0) - 1);
      }
    }
  }

  update(dt) {
    const G = this.G;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const step = b.speed * dt;
      const nx = b.x + b.dx * step;
      const nz = b.z + b.dz * step;
      let hit = false;

      if (G.city.colliders.blocked(b.x, b.z, nx, nz)) {
        G.effects.sparks(nx, b.y, nz, 5, new THREE.Color(0xffd090), 4);
        hit = true;
      }

      if (!hit && b.owner !== 'ped') {
        const ped = G.peds?.nearest(b.x, b.z, 60);
        if (ped && dist2(ped.pos.x, ped.pos.z, nx, nz) < 0.55 * 0.55) {
          ped.kill();
          G.effects.blood(ped.pos.x, 1.2, ped.pos.z, 8);
          G.police?.report('assault', ped.pos.x, ped.pos.z);
          G.peds.alarm(ped.pos.x, ped.pos.z, 40);
          hit = true;
        }
      }

      if (!hit && b.owner === 'player') {
        for (const officer of G.police?.officers ?? []) {
          if (officer.dead) continue;
          if (dist2(officer.pos.x, officer.pos.z, nx, nz) < 0.7 * 0.7) {
            officer.hurt(b.damage);
            G.effects.blood(officer.pos.x, 1.2, officer.pos.z, 5);
            hit = true;
            break;
          }
        }
        if (!hit && G.police?.heli && G.police.heli.alive) {
          const h = G.police.heli;
          if (dist2(h.pos.x, h.pos.z, nx, nz) < 3 && Math.abs(h.pos.y - b.y) < 2.5) {
            h.hurt(b.damage * 0.4);
            G.effects.sparks(nx, b.y, nz, 4, new THREE.Color(0xffe0a0), 3);
            hit = true;
          }
        }
      }

      if (!hit && (b.owner === 'police' || b.owner === 'ped')) {
        const target = G.player;
        const px = target.inCar && target.vehicle ? target.vehicle.pos.x : target.pos.x;
        const pz = target.inCar && target.vehicle ? target.vehicle.pos.z : target.pos.z;
        if (dist2(px, pz, nx, nz) < 0.75 * 0.75) {
          target.takeDamage(b.damage);
          G.effects.blood(px, 1.3, pz, 5);
          G.hud?.hurt();
          hit = true;
        }
      }

      if (!hit) {
        for (const car of G.vehicles?.all ?? []) {
          if (car.dead) continue;
          if (dist2(car.pos.x, car.pos.z, nx, nz) < 2.0 * 2.0) {
            car.applyDamage(b.damage * 0.8);
            G.effects.sparks(nx, 0.9, nz, 4, new THREE.Color(0xffc070), 4);
            hit = true;
            break;
          }
        }
      }

      this.drawTracer(b.x, b.y, b.z, nx, nz);
      b.travelled += step;
      b.x = nx; b.z = nz;
      if (hit || b.travelled >= b.range) this.bullets.splice(i, 1);
    }
  }

  drawTracer(x, y, z, nx, nz) {
    const m = this.tracers[this.tracerIndex];
    this.tracerIndex = (this.tracerIndex + 1) % this.tracers.length;
    const len = dist(x, z, nx, nz);
    m.visible = true;
    m.position.set((x + nx) / 2, y, (z + nz) / 2);
    m.scale.set(1, 1, Math.max(0.6, len));
    m.rotation.y = Math.atan2(nx - x, nz - z);
    m.userData.life = 0.06;
  }

  fadeTracers(dt) {
    for (const m of this.tracers) {
      if (!m.visible) continue;
      m.userData.life -= dt;
      if (m.userData.life <= 0) m.visible = false;
    }
  }
}

export { clamp };
