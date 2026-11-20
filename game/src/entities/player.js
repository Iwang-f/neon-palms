// NEON PALMS — Rafa Cruz on foot: a small stylised body with a walk cycle, a
// twin-stick aim, sprint, health and armour, and the enter/exit handshake with
// whatever car is closest. The same body builder dresses the pedestrians.

import * as THREE from 'three';
import { PLAYER, WEAPONS } from '../core/config.js';
import { clamp, damp, angleDamp, wrapAngle, TAU, makeRng } from '../core/util.js';

const SKIN = [0xd9a678, 0xb87a4e, 0x8a5a38, 0xe8c39a, 0x6f4526];
const SHIRT = [0x3f7d9c, 0xc94f3d, 0xe8e2d6, 0x4a6a4a, 0x6a4a8a, 0xd8a02e, 0x2a2a34];
const PANTS = [0x2a3240, 0x3b3a44, 0x5a4a3a, 0x1e2630, 0x6a6a72];
const HAIR = [0x1a1512, 0x3a2418, 0x5a3a22, 0x9a8a70, 0x22201e];

const limbGeo = new THREE.BoxGeometry(0.16, 0.62, 0.16);
const legGeo = new THREE.BoxGeometry(0.19, 0.82, 0.19);
const torsoGeo = new THREE.BoxGeometry(0.5, 0.62, 0.28);
const headGeo = new THREE.SphereGeometry(0.17, 10, 8);
const hairGeo = new THREE.SphereGeometry(0.178, 10, 8, 0, TAU, 0, Math.PI * 0.55);
const shoeGeo = new THREE.BoxGeometry(0.21, 0.12, 0.3);

/** A person: torso, head, hair, two arms and two legs, grouped at the feet. */
export function makeHuman(rng, opts = {}) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: opts.skin ?? rng.pick(SKIN) });
  const shirt = new THREE.MeshLambertMaterial({ color: opts.shirt ?? rng.pick(SHIRT) });
  const pants = new THREE.MeshLambertMaterial({ color: opts.pants ?? rng.pick(PANTS) });
  const hair = new THREE.MeshLambertMaterial({ color: opts.hair ?? rng.pick(HAIR) });

  const torso = new THREE.Mesh(torsoGeo, shirt);
  torso.position.y = 1.16;
  torso.castShadow = true;
  g.add(torso);

  const head = new THREE.Mesh(headGeo, skin);
  head.position.y = 1.62;
  head.castShadow = true;
  g.add(head);
  const cap = new THREE.Mesh(hairGeo, hair);
  cap.position.y = 1.64;
  g.add(cap);

  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.31, 1.42, 0);
    const arm = new THREE.Mesh(limbGeo, skin);
    arm.position.y = -0.3;
    arm.castShadow = true;
    pivot.add(arm);
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.26, 0.19), shirt);
    sleeve.position.y = -0.06;
    pivot.add(sleeve);
    g.add(pivot);
    arms.push(pivot);
  }

  const legs = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.13, 0.82, 0);
    const leg = new THREE.Mesh(legGeo, pants);
    leg.position.y = -0.41;
    leg.castShadow = true;
    pivot.add(leg);
    const shoe = new THREE.Mesh(shoeGeo, new THREE.MeshLambertMaterial({ color: 0x1a1a1e }));
    shoe.position.set(0, -0.78, 0.05);
    pivot.add(shoe);
    g.add(pivot);
    legs.push(pivot);
  }

  return { group: g, arms, legs, torso, head };
}

export class Player {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    const rng = makeRng(4);
    const body = makeHuman(rng, { shirt: 0x2e6f8a, pants: 0x24242c, skin: 0xd9a678 });
    this.mesh = body.group;
    this.arms = body.arms;
    this.legs = body.legs;
    this.torso = body.torso;
    this.head = body.head;

    this.gun = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.42), new THREE.MeshLambertMaterial({ color: 0x1e1e24 }));
    barrel.position.z = 0.18;
    this.gun.add(barrel);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.08), new THREE.MeshLambertMaterial({ color: 0x2a2a30 }));
    grip.position.set(0, -0.1, 0.02);
    this.gun.add(grip);
    this.gun.position.set(0.22, -0.52, 0.18);
    this.gun.rotation.x = Math.PI / 2;
    this.arms[1].add(this.gun);
    this.gun.visible = false;

    this.pos = new THREE.Vector3(-360, 0, 6);
    this.heading = Math.PI * 0.5;
    this.aimAngle = this.heading;
    this.vel = new THREE.Vector3();
    this.speed = 0;
    this.walkPhase = 0;
    this.state = 'foot';
    this.vehicle = null;
    this.health = PLAYER.maxHealth;
    this.armor = 0;
    this.weapon = 'pistol';
    this.ammo = { pistol: 120, smg: 0, shotgun: 0 };
    this.fireCooldown = 0;
    this.sprinting = false;
    this.aiming = false;
    this.hurtTimer = 0;
    this.dead = false;
    this.muzzle = null;
    this.muzzleTime = 0;

    this._buildMuzzle();
    scene.add(this.mesh);
    this.sync();
  }

  _buildMuzzle() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0, toneMapped: false });
    this.muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat);
    this.scene.add(this.muzzle);
  }

  get inCar() { return this.state === 'car'; }

  /** The weapon's stats; fists when the pockets are empty. */
  get weaponDef() {
    const w = WEAPONS[this.weapon];
    if (!w) return WEAPONS.fists;
    if (w.ammo !== Infinity && (this.ammo[this.weapon] ?? 0) <= 0) return WEAPONS.fists;
    return w;
  }

  setWeapon(id, ammo) {
    if (WEAPONS[id]) {
      this.weapon = id;
      if (ammo !== undefined) this.ammo[id] = ammo;
      this.gun.visible = id !== 'fists';
    }
  }

  giveAmmo(id, n) {
    this.ammo[id] = (this.ammo[id] ?? 0) + n;
  }

  takeDamage(amount) {
    if (this.dead) return;
    this.hurtTimer = 0.45;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, amount * 0.6);
      this.armor -= absorbed;
      amount -= absorbed;
    }
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this.dead = true;
  }

  heal(amount) {
    this.health = Math.min(PLAYER.maxHealth, this.health + amount);
  }

  enterVehicle(car) {
    if (!car || car.dead) return false;
    this.state = 'car';
    this.vehicle = car;
    car.setDriver('player');
    this.mesh.visible = false;
    this.gun.visible = false;
    return true;
  }

  exitVehicle() {
    if (!this.vehicle) return;
    const out = this.vehicle.doorPosition(new THREE.Vector3());
    this.vehicle.setDriver(null);
    this.vehicle.throttle = 0;
    this.vehicle = null;
    this.state = 'foot';
    this.pos.set(out.x, 0, out.z);
    this.city.colliders.resolveCircle(this.pos, PLAYER.radius);
    this.mesh.visible = true;
    this.gun.visible = this.weapon !== 'fists';
    this.heading = this.aimAngle;
  }

  /** Aim from the cursor's ground point; the body turns toward it. */
  aimAt(worldX, worldZ) {
    this.aimAngle = Math.atan2(worldX - this.pos.x, worldZ - this.pos.z);
  }

  update(dt, ctx) {
    if (this.dead) return;
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.muzzleTime = Math.max(0, this.muzzleTime - dt);
    if (this.muzzle) {
      this.muzzle.material.opacity = this.muzzleTime > 0 ? 1 : 0;
      this.muzzle.scale.setScalar(0.7 + (1 - this.muzzleTime / 0.07) * 1.6);
    }

    if (this.state === 'car' && this.vehicle) {
      const car = this.vehicle;
      const controls = ctx.controls;
      car.throttle = controls.throttle;
      car.update(dt, controls);
      this.pos.set(car.pos.x, 0, car.pos.z);
      this.heading = car.heading;
      if (car.dead) this.exitVehicle();
      return;
    }

    const ax = ctx.move.x;
    const az = ctx.move.z;
    const len = Math.hypot(ax, az);
    this.sprinting = ctx.sprint && len > 0;
    const target = len > 0 ? (this.sprinting ? PLAYER.run : PLAYER.walk) : 0;

    // Movement is camera-relative: forward is where the camera looks.
    let dirX = 0, dirZ = 0;
    if (len > 0) {
      const yaw = ctx.cameraYaw;
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const rx = Math.cos(yaw), rz = -Math.sin(yaw);
      dirX = (fx * -az + rx * ax) / len;
      dirZ = (fz * -az + rz * ax) / len;
      this.heading = angleDamp(this.heading, Math.atan2(dirX, dirZ), 12, dt);
    }
    this.speed = damp(this.speed, target, 10, dt);
    this.pos.x += dirX * this.speed * dt;
    this.pos.z += dirZ * this.speed * dt;

    // Kerbs are low enough to walk over; buildings are not.
    this.city.colliders.resolveCircle(this.pos, PLAYER.radius);
    this.pos.x = clamp(this.pos.x, -470, 505);
    this.pos.z = clamp(this.pos.z, -470, 470);

    if (this.speed > 0.2) this.walkPhase += dt * this.speed * 1.9;
    this.sync(dt, ctx);
  }

  sync(dt = 0, ctx = null) {
    if (this.state === 'car') return;
    const moving = this.speed > 0.25;
    const swing = moving ? Math.sin(this.walkPhase) * clamp(this.speed / 6, 0, 1) : 0;
    this.legs[0].rotation.x = swing * 0.7;
    this.legs[1].rotation.x = -swing * 0.7;
    if (ctx && ctx.aiming) {
      this.arms[0].rotation.x = -1.1;
      this.arms[1].rotation.x = -1.45;
      this.arms[0].rotation.z = 0.15;
      this.arms[1].rotation.z = -0.05;
    } else {
      this.arms[0].rotation.x = -swing * 0.55;
      this.arms[1].rotation.x = swing * 0.55;
      this.arms[0].rotation.z = 0;
      this.arms[1].rotation.z = 0;
    }
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    const face = ctx && ctx.aiming ? this.aimAngle : this.heading;
    this.mesh.rotation.y = face;
    this.torso.rotation.z = moving ? Math.sin(this.walkPhase * 2) * 0.03 : 0;
    if (this.muzzle) {
      const f = this.aimAngle;
      this.muzzle.position.set(this.pos.x + Math.sin(f) * 0.9, 1.35, this.pos.z + Math.cos(f) * 0.9);
    }
  }

  respawn(x, z) {
    this.dead = false;
    this.health = PLAYER.maxHealth;
    this.armor = 0;
    this.state = 'foot';
    this.vehicle = null;
    this.mesh.visible = true;
    this.pos.set(x, 0, z);
    this.speed = 0;
    this.sync();
  }
}

export { wrapAngle };
