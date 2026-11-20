// NEON PALMS — cars. Arcade physics (throttle, brake, steering that tightens with
// speed, a handbrake that breaks the rear loose) and a small procedural body per
// type: saloon, coupe, taxi, van, muscle and the PSD cruiser with its light bar.

import * as THREE from 'three';
import { VEHICLES } from '../core/config.js';
import { clamp, damp, lerp, TAU } from '../core/util.js';

const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10);
wheelGeo.rotateZ(Math.PI / 2);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x17161c });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x101a24 });
const chromeMat = new THREE.MeshLambertMaterial({ color: 0xb9b6ad });
const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8, toneMapped: false });

// One radial sprite texture, shared by every siren glow in the city.
const glowTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.42)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

function sirenGlow(color, scale) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false,
    transparent: true, toneMapped: false, opacity: 0,
  }));
  s.scale.setScalar(scale);
  return s;
}

let nextId = 1;

export class Vehicle {
  constructor(scene, city, type, x, z, heading = 0, opts = {}) {
    this.id = nextId++;
    this.scene = scene;
    this.city = city;
    this.type = type;
    this.def = VEHICLES[type];
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = opts.speed ?? 0;
    this.steer = 0;
    this.throttle = 0;
    this.handbrake = false;
    this.health = 100;
    this.driver = null;         // 'player' | 'ai' | 'police' | null
    this.ai = null;
    this.wanted = false;
    this.stolen = false;
    this.sirenOn = false;
    this.wheelSpin = 0;
    this.roll = 0;
    this.pitch = 0;
    this.lastHit = 0;
    this.build();
    this.sync();
  }

  get forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  build() {
    const d = this.def;
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: d.body });
    const L = d.length, W = d.width, H = d.height;

    const body = new THREE.Mesh(new THREE.BoxGeometry(W, H * 0.52, L), bodyMat);
    body.position.y = H * 0.36;
    body.castShadow = true;
    g.add(body);

    const cabinW = W * 0.86;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(cabinW, H * 0.44, L * (this.type === 'van' ? 0.62 : 0.5)), bodyMat);
    cabin.position.set(0, H * 0.72, this.type === 'van' ? -L * 0.08 : -L * 0.04);
    cabin.castShadow = true;
    g.add(cabin);

    const glass = new THREE.Mesh(new THREE.BoxGeometry(cabinW + 0.02, H * 0.3, L * (this.type === 'van' ? 0.5 : 0.42)), glassMat);
    glass.position.copy(cabin.position);
    glass.position.y += H * 0.03;
    g.add(glass);

    // Side and rear glazing, so the cabin reads as a car and not a crate.
    const sideGlass = new THREE.BoxGeometry(0.03, H * 0.24, L * (this.type === 'van' ? 0.46 : 0.36));
    for (const sx of [-1, 1]) {
      const pane = new THREE.Mesh(sideGlass, glassMat);
      pane.position.set(sx * (cabinW / 2 + 0.015), H * 0.75, cabin.position.z);
      g.add(pane);
    }
    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(cabinW * 0.92, H * 0.24, 0.04), glassMat);
    rearGlass.position.set(0, H * 0.75, cabin.position.z - L * (this.type === 'van' ? 0.26 : 0.21));
    g.add(rearGlass);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(cabinW * 0.96, 0.05, L * (this.type === 'van' ? 0.56 : 0.44)),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(d.body).multiplyScalar(0.82) }),
    );
    roof.position.set(0, H * 0.95, cabin.position.z);
    g.add(roof);

    // A nose and a boot, so the silhouette is not one brick.
    const nose = new THREE.Mesh(new THREE.BoxGeometry(W * 0.94, H * 0.26, L * 0.2), bodyMat);
    nose.position.set(0, H * 0.3, L * 0.42);
    nose.castShadow = true;
    g.add(nose);

    const bumperF = new THREE.Mesh(new THREE.BoxGeometry(W * 0.98, 0.18, 0.2), chromeMat);
    bumperF.position.set(0, H * 0.2, L * 0.5);
    g.add(bumperF);
    const bumperB = bumperF.clone();
    bumperB.position.z = -L * 0.5;
    g.add(bumperB);

    // Tail lamps are per-car: a shared material made every brake light in the
    // city flash together.
    this.tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a, toneMapped: false });
    const headGeo = new THREE.BoxGeometry(W * 0.2, 0.12, 0.06);
    for (const sx of [-1, 1]) {
      const lamp = new THREE.Mesh(headGeo, lightMat);
      lamp.position.set(sx * W * 0.32, H * 0.33, L * 0.5);
      g.add(lamp);
      const tail = new THREE.Mesh(headGeo, this.tailMat);
      tail.position.set(sx * W * 0.32, H * 0.33, -L * 0.5);
      g.add(tail);
    }

    // Wheels: two steer on the front axle.
    this.wheels = [];
    const wx = W * 0.5 + 0.02, wz = L * 0.31;
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(sx * wx, 0.34, sz * wz);
      w.castShadow = true;
      g.add(w);
      this.wheels.push(w);
    }

    if (this.type === 'police') {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(W * 0.6, 0.16, 0.3), new THREE.MeshLambertMaterial({ color: 0x1a1a22 }));
      bar.position.set(0, H * 0.98, -L * 0.02);
      g.add(bar);
      this.sirenRed = new THREE.Mesh(new THREE.BoxGeometry(W * 0.24, 0.14, 0.24), new THREE.MeshBasicMaterial({ color: 0xff2233, toneMapped: false }));
      this.sirenRed.position.set(-W * 0.16, H * 1.04, -L * 0.02);
      g.add(this.sirenRed);
      this.sirenBlue = new THREE.Mesh(new THREE.BoxGeometry(W * 0.24, 0.14, 0.24), new THREE.MeshBasicMaterial({ color: 0x2266ff, toneMapped: false }));
      this.sirenBlue.position.set(W * 0.16, H * 1.04, -L * 0.02);
      g.add(this.sirenBlue);
      // Bloom-ish halos: the flash has to spill onto the street, not just tint
      // two plastic blocks.
      this.sirenGlowRed = sirenGlow(0xff2233, 4.2);
      this.sirenGlowRed.position.set(-W * 0.16, H * 1.04, -L * 0.02);
      g.add(this.sirenGlowRed);
      this.sirenGlowBlue = sirenGlow(0x3a7bff, 4.2);
      this.sirenGlowBlue.position.set(W * 0.16, H * 1.04, -L * 0.02);
      g.add(this.sirenGlowBlue);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, 0.3, L * 0.5), new THREE.MeshLambertMaterial({ color: 0x1b2a4a }));
      stripe.position.set(0, H * 0.4, 0);
      g.add(stripe);
    }

    if (this.type === 'taxi') {
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.3), new THREE.MeshBasicMaterial({ color: 0xffd24a, toneMapped: false }));
      sign.position.set(0, H * 0.98, 0);
      g.add(sign);
    }

    if (this.type === 'coupe') {
      // Twin cream stripes over the boot and roof: the hero car has to be
      // identifiable at a glance in a chase.
      const stripeMat = new THREE.MeshLambertMaterial({ color: 0xf6efe0 });
      for (const sx of [-0.42, 0.42]) {
        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, L * 0.42), stripeMat);
        boot.position.set(sx, H * 0.52 + 0.01, -L * 0.28);
        g.add(boot);
        const lid = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, L * 0.4), stripeMat);
        lid.position.set(sx, H * 0.955, cabin.position.z);
        g.add(lid);
        const hood = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, L * 0.2), stripeMat);
        hood.position.set(sx, H * 0.435, L * 0.42);
        g.add(hood);
      }
    }

    if (this.type === 'van') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(W, H * 0.9, L * 0.66), new THREE.MeshLambertMaterial({ color: 0xdedad0 }));
      box.position.set(0, H * 0.55, -L * 0.12);
      box.castShadow = true;
      g.add(box);
    }

    this.mesh = g;
    this.scene.add(g);
  }

  setDriver(who) {
    this.driver = who;
    if (who === null) this.throttle = 0;
  }

  applyDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this.explode();
  }

  explode() {
    this.dead = true;
    if (this.mesh.parent) this.scene.remove(this.mesh);
  }

  /** Physics step. controls: { throttle -1..1, steer -1..1, handbrake bool }. */
  update(dt, controls) {
    if (this.dead) return;
    const d = this.def;
    const throttle = controls?.throttle ?? 0;
    const steerIn = controls?.steer ?? 0;
    this.handbrake = !!controls?.handbrake;

    const top = d.top;
    const accel = d.accel * (this.health < 40 ? 0.75 : 1);

    if (throttle > 0) {
      const headroom = clamp(1 - this.speed / top, 0, 1);
      this.speed += accel * throttle * headroom * dt;
    } else if (throttle < 0) {
      if (this.speed > 0.5) this.speed += throttle * accel * 1.6 * dt;   // brake
      else this.speed += throttle * accel * 0.5 * dt;                    // reverse
    }
    this.speed -= this.speed * 0.55 * dt;                                 // drag
    if (this.handbrake) this.speed -= this.speed * 2.4 * dt;
    this.speed = clamp(this.speed, -top * 0.35, top);

    const speedFactor = clamp(Math.abs(this.speed) / 9, 0, 1);
    const steerLimit = this.handbrake ? 1.35 : 1;
    this.steer = damp(this.steer, steerIn * steerLimit, 9, dt);
    const turn = this.steer * (1.7 - clamp(Math.abs(this.speed) / top, 0, 0.72)) * speedFactor;
    this.heading += turn * Math.sign(this.speed || 1) * dt * 1.35;

    const f = this.forward;
    const nx = this.pos.x + f.x * this.speed * dt;
    const nz = this.pos.z + f.z * this.speed * dt;

    // Building collision: the car is a circle of ~1.2 m at its centre.
    const probe = { x: nx, z: nz };
    const before = { x: probe.x, z: probe.z };
    this.city.colliders.resolveCircle(probe, 1.25);
    const hit = Math.hypot(probe.x - before.x, probe.z - before.z) > 0.001;
    if (hit) {
      const impact = Math.abs(this.speed);
      this.pos.x = probe.x;
      this.pos.z = probe.z;
      this.speed *= -0.18;
      if (impact > 6 && this.health > 0) this.applyDamage(impact * 0.9);
      this.lastHit = impact;
    } else {
      this.pos.x = nx;
      this.pos.z = nz;
    }

    // Keep the car on the island.
    this.pos.x = clamp(this.pos.x, -470, 505);
    this.pos.z = clamp(this.pos.z, -470, 470);

    this.wheelSpin += this.speed * dt * 3.2;
    this.roll = damp(this.roll, -this.steer * clamp(this.speed / top, 0, 1) * 0.06, 6, dt);
    this.pitch = damp(this.pitch, clamp((throttle > 0 ? -1 : 1) * Math.abs(this.speed) / top * 0.02, -0.03, 0.03), 5, dt);
    this.sync();
  }

  sync() {
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.set(this.pitch, this.heading, this.roll);
    const spin = this.wheelSpin;
    for (let i = 0; i < this.wheels.length; i++) {
      this.wheels[i].rotation.x = spin;
      if (i < 2) this.wheels[i].rotation.y = this.steer * 0.5;
    }
    if (this.sirenRed) {
      // Two-phase strobe: red leads, blue answers, with a short dark gap so the
      // bar reads as a real rotating beacon rather than a blinking texture.
      const phase = (performance.now() / 1000 * 4.4) % 1;
      const redOn = this.sirenOn && phase < 0.42;
      const blueOn = this.sirenOn && phase > 0.5;
      this.sirenRed.material.color.setHex(redOn ? 0xff2233 : 0x330a10);
      this.sirenBlue.material.color.setHex(blueOn ? 0x2266ff : 0x0a1033);
      this.sirenGlowRed.material.opacity = redOn ? 0.9 : 0;
      this.sirenGlowBlue.material.opacity = blueOn ? 0.9 : 0;
      this.sirenGlowRed.visible = this.sirenOn;
      this.sirenGlowBlue.visible = this.sirenOn;
    }
    const braking = this.throttle < 0 || this.handbrake;
    this.tailMat.color.setHex(braking ? 0xff5533 : 0xd01f22);
  }

  /** Where a passenger sits, in world space. */
  seatPosition(out = new THREE.Vector3()) {
    const f = this.forward;
    return out.set(this.pos.x - f.x * 0.4, 1.2, this.pos.z - f.z * 0.4);
  }

  /** A point just outside the driver's door, for getting out. */
  doorPosition(out = new THREE.Vector3()) {
    const f = this.forward;
    return out.set(this.pos.x + f.z * 1.8, 0, this.pos.z - f.x * 1.8);
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.traverse((o) => { if (o.geometry && o.geometry !== wheelGeo) o.geometry.dispose(); });
  }
}

/** Build one parked car of a plausible type for a district. */
export function parkedType(district, rng) {
  if (district === 'puerto') return rng.pick(['van', 'van', 'sedan', 'muscle']);
  if (district === 'centro') return rng.pick(['sedan', 'coupe', 'taxi', 'sedan', 'muscle']);
  if (district === 'colinas') return rng.pick(['sedan', 'van', 'coupe']);
  return rng.pick(['coupe', 'sedan', 'taxi', 'muscle', 'sedan']);
}

export { TAU, lerp };
