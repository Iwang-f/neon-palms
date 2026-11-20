// NEON PALMS — the Palma Sol Department. Crimes raise a five-star wanted level;
// cruisers spawn off-screen and close in, officers get out and shoot, a helicopter
// joins at three stars, roadblocks go up at four, and the meter cools only when
// nobody has seen you for a while.

import * as THREE from 'three';
import { POLICE, VEHICLES, GRID } from '../core/config.js';
import { clamp, damp, angleDamp, dist, makeRng, TAU } from '../core/util.js';
import { Vehicle } from '../entities/vehicle.js';
import { makeHuman } from '../entities/player.js';

const R = (i) => GRID.origin + i * GRID.pitch;
const CALLSIGNS = ['CORAL', 'MARLIN', 'ANCHOR', 'TIDE', 'REEF', 'DUNE', 'SHELL', 'BREAKER'];
const TACTICS = ['PURSUING', 'RAMMING', 'FLANKING', 'BLOCKING', 'ON FOOT', 'MARKSMAN'];

let unitSeq = 40;

class Officer {
  constructor(police, x, z, car = null) {
    this.police = police;
    this.scene = police.scene;
    const body = makeHuman(police.rng, { shirt: 0x1b2a4a, pants: 0x141a26, skin: 0xc08a5e });
    this.mesh = body.group;
    this.legs = body.legs;
    this.arms = body.arms;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = 0;
    this.speed = 0;
    this.health = 100;
    this.dead = false;
    this.fireTimer = police.rng.range(0.6, 1.6);
    this.car = car;
    this.phase = police.rng.range(0, TAU);
    this.aim = 0;
    this.scene.add(this.mesh);
    this.sync();
  }

  sync() {
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.heading;
  }

  hurt(amount) {
    this.health -= amount;
    if (this.health <= 0 && !this.dead) {
      this.dead = true;
      this.mesh.rotation.z = Math.PI / 2;
      this.police.G.policeReport?.('officer down');
    }
  }

  update(dt, player) {
    if (this.dead) return;
    const px = player.inCar && player.vehicle ? player.vehicle.pos.x : player.pos.x;
    const pz = player.inCar && player.vehicle ? player.vehicle.pos.z : player.pos.z;
    const d = dist(this.pos.x, this.pos.z, px, pz);
    this.aim = Math.atan2(px - this.pos.x, pz - this.pos.z);
    this.heading = angleDamp(this.heading, this.aim, 7, dt);

    const want = player.inCar ? 3.5 : clamp(d - 7, 0, 1) * 4.2;
    const move = d > 9 || player.inCar;
    this.speed = damp(this.speed, move ? 4.4 : 0, 8, dt);
    if (move) {
      this.pos.x += Math.sin(this.aim) * this.speed * dt;
      this.pos.z += Math.cos(this.aim) * this.speed * dt;
      this.police.G.city.colliders.resolveCircle(this.pos, 0.45);
    }

    this.phase += dt * (2 + this.speed * 1.8);
    const swing = Math.sin(this.phase) * clamp(this.speed / 3, 0, 1);
    this.legs[0].rotation.x = swing * 0.8;
    this.legs[1].rotation.x = -swing * 0.8;
    this.arms[0].rotation.x = -1.3;
    this.arms[1].rotation.x = -1.4;

    this.fireTimer -= dt;
    if (this.fireTimer <= 0 && d < POLICE.shootRange) {
      this.fireTimer = this.police.rng.range(0.75, 1.5);
      this.police.G.combat.fire('police', this.pos.x, 1.35, this.pos.z, this.aim, 'pistol');
    }

    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.heading;
    this.mesh.rotation.x = 0;
  }
}

class Unit {
  constructor(police, x, z, heading, existing = null) {
    this.police = police;
    this.car = existing ?? new Vehicle(police.scene, police.G.city, 'police', x, z, heading);
    this.car.driver = 'police';
    this.car.sirenOn = true;
    this.car.unit = this;
    this.callsign = `${police.rng.pick(CALLSIGNS)}-${unitSeq++}`;
    this.officers = [];
    this.deployed = false;
    this.state = 'PURSUING';
    this.stuck = 0;
  }

  deploy() {
    if (this.deployed) return;
    this.deployed = true;
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const f = this.car.forward;
      const x = this.car.pos.x + f.z * 2.2 * side;
      const z = this.car.pos.z - f.x * 2.2 * side;
      this.officers.push(new Officer(this.police, x, z, this.car));
    }
  }

  update(dt, player) {
    const car = this.car;
    if (car.dead) return;
    const px = player.inCar && player.vehicle ? player.vehicle.pos.x : player.pos.x;
    const pz = player.inCar && player.vehicle ? player.vehicle.pos.z : player.pos.z;
    const d = dist(car.pos.x, car.pos.z, px, pz);
    const want = Math.atan2(px - car.pos.x, pz - car.pos.z);
    const err = Math.abs(((want - car.heading + Math.PI * 3) % TAU) - Math.PI);

    if (d < 26 && !player.inCar && !this.deployed) this.deploy();
    if (this.deployed && d > 55) {
      // The officers get back in when the chase moves on.
      this.deployed = false;
      for (const o of this.officers) { this.police.scene.remove(o.mesh); }
      this.officers = [];
    }

    const chase = this.deployed ? 0 : 1;
    const throttle = chase ? clamp(1.15 - err * 0.9, 0.15, 1) : 0;
    const steer = clamp(((want - car.heading + Math.PI * 3) % TAU) - Math.PI, -1, 1);
    if (car.speed < 1.2 && throttle > 0.6) this.stuck += dt; else this.stuck = Math.max(0, this.stuck - dt);
    car.update(dt, { throttle, steer, handbrake: false });
    car.sirenOn = true;
    this.state = this.deployed ? 'ON FOOT' : err > 0.8 ? 'TURNING' : d < 30 ? 'RAMMING' : 'PURSUING';
    if (this.stuck > 2.5) {
      // Back out and try again rather than grinding a wall.
      car.speed = -6;
      this.stuck = 0;
      car.heading += this.police.rng.range(-0.8, 0.8);
    }
    for (const o of this.officers) o.update(dt, player);
  }
}

class Helicopter {
  constructor(police) {
    this.police = police;
    this.scene = police.scene;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 5.2), new THREE.MeshLambertMaterial({ color: 0x1b2a4a }));
    body.castShadow = true;
    g.add(body);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.1, 1.6), new THREE.MeshLambertMaterial({ color: 0x0e1822 }));
    glass.position.set(0, 0.35, 1.9);
    g.add(glass);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.2), new THREE.MeshLambertMaterial({ color: 0x1b2a4a }));
    tail.position.set(0, 0.3, -4.2);
    g.add(tail);
    const rotor = new THREE.Mesh(
      new THREE.BoxGeometry(11, 0.08, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x22242c }),
    );
    rotor.position.y = 1.2;
    g.add(rotor);
    this.rotor = rotor;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.8), new THREE.MeshLambertMaterial({ color: 0x1b2a4a }));
    fin.position.set(0, 0.9, -6.1);
    g.add(fin);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3040, toneMapped: false }));
    lamp.position.set(0, -0.7, 2.6);
    g.add(lamp);

    this.spot = new THREE.SpotLight(0xdfe8ff, 0, 90, 0.42, 0.5, 1.6);
    this.spot.position.set(0, 0, 0);
    g.add(this.spot);
    const target = new THREE.Object3D();
    target.position.set(0, -40, 6);
    g.add(target);
    this.spot.target = target;

    this.mesh = g;
    this.pos = new THREE.Vector3(0, 30, 0);
    this.alive = false;
    this.health = 100;
    this.angle = 0;
    this.scene.add(g);
    g.visible = false;
  }

  activate(x, z) {
    this.alive = true;
    this.health = 100;
    this.mesh.visible = true;
    this.pos.set(x + 60, 30, z + 60);
  }

  deactivate() {
    this.alive = false;
    this.mesh.visible = false;
    this.spot.intensity = 0;
  }

  hurt(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.police.G.effects.explosion(this.pos.x, this.pos.y, this.pos.z);
      this.deactivate();
    }
  }

  update(dt, focus) {
    if (!this.alive) return;
    this.angle += dt * 0.42;
    const tx = focus.x + Math.cos(this.angle) * 34;
    const tz = focus.z + Math.sin(this.angle) * 34;
    this.pos.x = damp(this.pos.x, tx, 1.2, dt);
    this.pos.z = damp(this.pos.z, tz, 1.2, dt);
    this.pos.y = damp(this.pos.y, 30 + Math.sin(this.angle * 2) * 2, 1, dt);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = -this.angle + Math.PI / 2;
    this.rotor.rotation.y += dt * 32;
    this.spot.intensity = 420;
  }
}

export class Police {
  constructor(scene, G) {
    this.scene = scene;
    this.G = G;
    this.rng = makeRng(303);
    this.wanted = 0;
    this.heat = 0;
    this.units = [];
    this.heatDecayTimer = 0;
    this.lastSeen = 0;
    this.heli = new Helicopter(this);
    this.roadblocks = [];
    this.scanner = [];
    this._lastDistance = 999;
    this.cooldown = 0;
    this.bustTimer = 0;
    this.spawnTimer = 0;
  }

  get officers() {
    const out = [];
    for (const u of this.units) for (const o of u.officers) out.push(o);
    return out;
  }

  report(crime, x, z) {
    const weight = { gunfire: 0.5, assault: 1.4, carjack: 1.1, hit: 0.9, explosion: 2.4, officer: 2.6, heist: 2 }[crime] ?? 0.6;
    if (this.wanted >= POLICE.stars) return;
    this.heat += weight;
    this.lastSeen = 0;
    const need = 1.1 + this.wanted * 0.55;
    if (this.heat >= need) {
      this.heat = 0;
      this.setWanted(this.wanted + 1);
      this.G.events.emit('wanted', this.wanted);
    }
  }

  /** Place a unit by hand: roadblocks, and the staged screenshots. */
  spawnUnit(x, z, heading) {
    const u = new Unit(this, x, z, heading);
    this.units.push(u);
    return u;
  }

  setWanted(n) {
    const before = this.wanted;
    this.wanted = clamp(Math.round(n), 0, POLICE.stars);
    this.lastSeen = 0;
    if (this.wanted === 0) this._standDown();
    if (this.wanted >= POLICE.heliAt) {
      if (!this.heli.alive) this.heli.activate(this.G.player.pos.x, this.G.player.pos.z);
    } else if (this.heli.alive) this.heli.deactivate();
    if (this.wanted > before) this.G.hud?.toast(`WANTED LEVEL ${this.wanted}`, 'alert');
    if (this.wanted > 0) this.G.audio?.siren(true);
    else this.G.audio?.siren(false);
  }

  _standDown() {
    for (const u of this.units) {
      for (const o of u.officers) this.scene.remove(o.mesh);
      u.car.dispose();
    }
    this.units = [];
    this.heli.deactivate();
    for (const b of this.roadblocks) this.scene.remove(b);
    this.roadblocks = [];
  }

  update(dt) {
    const player = this.G.player;
    const focus = player.inCar && player.vehicle ? player.vehicle.pos : player.pos;
    this.bustTimer = Math.max(0, this.bustTimer - dt);

    if (this.wanted === 0) {
      for (const u of this.units) u.update(dt, player);
      return;
    }

    this.lastSeen += dt;
    const wantUnits = Math.min(POLICE.maxUnits, this.wanted * POLICE.unitsPerStar);

    // Keep the chase populated, but only off-screen.
    this.spawnTimer -= dt;
    if (this.units.length < wantUnits && this.spawnTimer <= 0) {
      this.spawnTimer = 1.4;
      const spot = this.G.city.roadSpotNear(focus.x, focus.z, 95, 190, this.rng);
      const u = new Unit(this, spot.x, spot.z, spot.angle);
      this.units.push(u);
    }

    let nearest = 999;
    for (const u of this.units) {
      u.update(dt, player);
      const d = dist(u.car.pos.x, u.car.pos.z, focus.x, focus.z);
      u.distance = d;
      nearest = Math.min(nearest, d);
      if (d < POLICE.sight) this.lastSeen = 0;
      // A cruiser touching the player on foot can bust them.
      if (!player.inCar && d < POLICE.bustRange && !player.dead) this.bustTimer += dt;
    }
    this._lastDistance = nearest;

    // Roadblock at four stars: two cruisers parked across the road ahead.
    if (this.wanted >= POLICE.roadblockAt && this.roadblocks.length === 0 && player.inCar) {
      const v = player.vehicle;
      const ahead = 130;
      const x = v.pos.x + Math.sin(v.heading) * ahead;
      const z = v.pos.z + Math.cos(v.heading) * ahead;
      for (const side of [-1, 1]) {
        const car = new Vehicle(this.scene, this.G.city, 'police', x + v.forward.z * side * 3.4, z - v.forward.x * side * 3.4, v.heading + Math.PI / 2);
        car.driver = 'police';
        car.sirenOn = true;
        this.roadblocks.push(car.mesh);
        this.units.push(new Unit(this, car.pos.x, car.pos.z, car.heading, car));
      }
    }

    this.heli.update(dt, focus);

    // Escape: out of sight long enough and the stars cool one at a time.
    if (this.lastSeen > POLICE.escapeSeconds) {
      this.heatDecayTimer += dt;
      if (this.heatDecayTimer > 2.5) {
        this.heatDecayTimer = 0;
        this.setWanted(this.wanted - 1);
        if (this.wanted > 0) this.G.hud?.toast('LOSING THEM', 'story');
      }
    } else {
      this.heatDecayTimer = 0;
    }

    if (this.bustTimer > POLICE.bustSeconds && !player.dead) {
      this.G.onBusted();
    }
    this.scanner = this.units
      .map((u) => ({
        name: u.callsign,
        tactic: u.state,
        distance: Math.round(u.distance ?? dist(u.car.pos.x, u.car.pos.z, focus.x, focus.z)),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
  }
}
