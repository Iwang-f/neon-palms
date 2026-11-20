// NEON PALMS — the story. Six jobs for Dalia Márquez, each a small state machine
// of stages: drive here, steal that, hold the corner, lose the cops. Every stage
// owns a beacon in the world and one line of HUD, and finishing a job pays and
// saves.

import * as THREE from 'three';
import { GRID } from '../core/config.js';
import { clamp, dist, makeRng, money, mmss } from '../core/util.js';
import { Vehicle } from '../entities/vehicle.js';

const beaconGeo = new THREE.CylinderGeometry(1.5, 2.4, 46, 14, 1, true);
const ringGeo = new THREE.TorusGeometry(2.6, 0.09, 6, 28);

function makeBeacon(color) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    beaconGeo,
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.16, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }),
  );
  beam.position.y = 23;
  g.add(beam);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  g.add(ring);
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.8),
    new THREE.MeshBasicMaterial({ color, toneMapped: false }),
  );
  gem.position.y = 3.2;
  g.add(gem);
  g.userData = { beam, ring, gem };
  return g;
}

/** The six jobs. Coordinates are on Palma Sol's grid; each target sits on a road
 *  or a landmark so the beacon is reachable by car. */
export const STORY = [
  {
    id: 'job-1',
    title: 'The Long Way Home',
    client: 'DALIA MÁRQUEZ',
    tagline: 'A car, a curb, a client who does not like waiting.',
    stages: [
      { kind: 'steal', x: -330, z: 40, car: 'coupe', objective: 'Take the Pelicano from the kerb' },
      { kind: 'drive', x: 40, z: 392, radius: 9, objective: 'Drive it to the marina' },
      { kind: 'goto', x: 40, z: 414, radius: 5, objective: 'Hand the keys to Dalia' },
    ],
    intro: [
      ['DALIA MÁRQUEZ', 'Rafa. There is a red Pelicano parked on Calle Luna with the keys in it.'],
      ['RAFA CRUZ', 'And the owner?'],
      ['DALIA MÁRQUEZ', 'Is not invited. Marina, south gate. Do not scratch it.'],
    ],
    outro: [
      ['DALIA MÁRQUEZ', 'Clean. Maybe you are worth the trouble after all.'],
      ['RAFA CRUZ', 'That is the nicest thing anyone has said to me this week.'],
    ],
    reward: 900,
    respect: 6,
  },
  {
    id: 'job-2',
    title: 'Tip Jar',
    client: 'DALIA MÁRQUEZ',
    tagline: 'Three envelopes, one strip, a lot of eyes.',
    stages: [
      { kind: 'collect', points: [[-330, -96], [-234, -96], [-234, -192]], objective: 'Collect the three envelopes on Ocean Drive' },
      { kind: 'goto', x: -360, z: 6, radius: 5, objective: 'Get back to the car' },
      { kind: 'escape', objective: 'Lose the patrol' },
    ],
    intro: [
      ['DALIA MÁRQUEZ', 'Three clients owe me. Three envelopes, all on the strip.'],
      ['RAFA CRUZ', 'And if someone calls the cops?'],
      ['DALIA MÁRQUEZ', 'Then you get to practise losing them.'],
    ],
    outro: [
      ['DALIA MÁRQUEZ', 'All three. Good. You keep the change.'],
    ],
    reward: 1200,
    respect: 8,
  },
  {
    id: 'job-3',
    title: 'Night Shift',
    client: 'DALIA MÁRQUEZ',
    tagline: 'The hotel valet is asleep. The car is not.',
    stages: [
      { kind: 'steal', x: 40, z: 120, car: 'muscle', objective: 'Take the Mantarraya from the hotel forecourt' },
      { kind: 'escape', objective: 'Lose the patrol before the bridge' },
      { kind: 'drive', x: 430, z: -60, radius: 12, objective: 'Deliver it to the docks' },
    ],
    intro: [
      ['DALIA MÁRQUEZ', 'Hotel Aurora. Green Mantarraya, second bay.'],
      ['RAFA CRUZ', 'That is Sarno\'s car.'],
      ['DALIA MÁRQUEZ', 'Which is why it is worth so much. Go.'],
    ],
    outro: [
      ['DALIA MÁRQUEZ', 'Sarno will be furious. Try to look surprised.'],
    ],
    reward: 1600,
    respect: 10,
  },
  {
    id: 'job-4',
    title: 'The Quiet Room',
    client: 'VITO SARNO',
    tagline: 'A meeting at the docks. Bring your manners.',
    stages: [
      { kind: 'goto', x: 420, z: 96, radius: 6, objective: 'Meet the broker at Pier Nine' },
      { kind: 'hold', x: 420, z: 96, radius: 18, seconds: 26, objective: 'Hold the corner while the deal closes' },
      { kind: 'escape', objective: 'Get clear of the response' },
    ],
    intro: [
      ['VITO SARNO', 'The driver. You cost me a car.'],
      ['RAFA CRUZ', 'I deliver cars. Sometimes they change hands.'],
      ['VITO SARNO', 'Then keep this one safe for ten minutes and we are even.'],
    ],
    outro: [
      ['VITO SARNO', 'You are still breathing. That is a good sign.'],
    ],
    reward: 2000,
    respect: 12,
  },
  {
    id: 'job-5',
    title: 'Sunset Clause',
    client: 'DALIA MÁRQUEZ',
    tagline: 'A courier with a briefcase and a very fast car.',
    stages: [
      { kind: 'chase', x: 40, z: 96, car: 'coupe', objective: 'Run the courier off the road' },
      { kind: 'goto', x: -300, z: 392, radius: 7, objective: 'Collect the briefcase at the pier' },
    ],
    intro: [
      ['DALIA MÁRQUEZ', 'Courier left the tower with the ledger. Heading for the coast.'],
      ['RAFA CRUZ', 'You want me to follow him or stop him?'],
      ['DALIA MÁRQUEZ', 'Yes.'],
    ],
    outro: [
      ['DALIA MÁRQUEZ', 'The ledger. Now every name in this city owes us a favour.'],
    ],
    reward: 2600,
    respect: 16,
  },
  {
    id: 'job-6',
    title: 'Last Call',
    client: 'DALIA MÁRQUEZ',
    tagline: 'One tower, one vault, one very long night.',
    stages: [
      { kind: 'goto', x: 40, z: -200, radius: 7, objective: 'Reach the tower service door' },
      { kind: 'hold', x: 40, z: -200, radius: 14, seconds: 34, objective: 'Hold the lobby while Dalia opens the vault' },
      { kind: 'escape', objective: 'Lose the city and get to the pier' },
      { kind: 'goto', x: -470, z: 118, radius: 8, objective: 'Reach the pier' },
    ],
    intro: [
      ['DALIA MÁRQUEZ', 'Centro tower. Service door, sub-level two.'],
      ['RAFA CRUZ', 'And the alarm?'],
      ['DALIA MÁRQUEZ', 'Will be your problem in about ninety seconds.'],
    ],
    outro: [
      ['DALIA MÁRQUEZ', 'That is the last call, Rafa. Whatever happens now, we did it right.'],
      ['RAFA CRUZ', 'We did it loud.'],
    ],
    reward: 6000,
    respect: 30,
  },
];

class FleeCar {
  constructor(scene, city, x, z, heading, type) {
    this.vehicle = new Vehicle(scene, city, type, x, z, heading);
    this.vehicle.driver = 'ai';
    this.city = city;
    this.rng = makeRng(19);
    this.turnTimer = 0;
    this.target = { x, z };
  }
  update(dt, from) {
    const v = this.vehicle;
    if (v.dead) return;
    const d = dist(v.pos.x, v.pos.z, from.x, from.z);
    this.turnTimer -= dt;
    if (this.turnTimer <= 0 || dist(v.pos.x, v.pos.z, this.target.x, this.target.z) < 12) {
      this.turnTimer = 2.2;
      const away = Math.atan2(v.pos.x - from.x, v.pos.z - from.z);
      // Keep to the grid: run along whichever road direction is closest.
      const snapped = Math.round((away + Math.PI / 2) / (Math.PI / 2)) * (Math.PI / 2) - Math.PI / 2;
      const len = 70 + this.rng.range(0, 40);
      this.target = { x: v.pos.x + Math.sin(snapped) * len, z: v.pos.z + Math.cos(snapped) * len };
    }
    const want = Math.atan2(this.target.x - v.pos.x, this.target.z - v.pos.z);
    const err = ((want - v.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    const panic = clamp(1.15 - d / 90, 0.35, 1);
    v.update(dt, { throttle: 1, steer: clamp(err, -1, 1) * panic, handbrake: false });
  }
}

export class Missions {
  constructor(scene, G) {
    this.scene = scene;
    this.G = G;
    this.index = 0;
    this.active = null;
    this.stage = 0;
    this.beacon = null;
    this.collected = 0;
    this.stageTimer = 0;
    this.stageProgress = 0;
    this.targetCar = null;
    this.jobCar = null;
    this.dialogueQueue = [];
    this.dialogueTimer = 0;
    this.currentLine = null;
    this.completed = new Set();
    this.briefing = 0;
    this.elapsed = 0;
  }

  get job() { return this.active; }

  start(index) {
    const job = STORY[index];
    if (!job) return;
    this.clearStageObjects();
    this.index = index;
    this.active = job;
    this.stage = 0;
    this.collected = 0;
    this.stageTimer = 0;
    this.stageProgress = 0;
    this.briefing = 0;
    this.elapsed = 0;
    this.queueDialogue(job.intro);
    this.beginStage();
    this.G.hud?.toast(`JOB: ${job.title}`, 'story');
  }

  next() {
    if (this.index + 1 < STORY.length) this.start(this.index + 1);
    else {
      this.active = null;
      this.G.hud?.toast('STORY COMPLETE — THE CITY IS YOURS', 'story');
      this.G.onStoryComplete?.();
    }
  }

  queueDialogue(lines) {
    this.dialogueQueue.push(...lines);
  }

  beginStage() {
    const stage = this.active.stages[this.stage];
    this.clearStageObjects();
    this.stageTimer = 0;
    this.stageProgress = 0;
    this.collected = 0;
    this.G.hud?.setObjective(this.active.title, stage.objective, this.stage, this.active.stages.length);

    if (stage.kind === 'steal') {
      this.jobCar = new Vehicle(this.scene, this.G.city, stage.car, stage.x, stage.z, Math.PI / 2);
      this.jobCar.driver = null;
      this.beacon = makeBeacon(0xffc24a);
      this.beacon.position.set(stage.x, 0, stage.z);
      this.scene.add(this.beacon);
    } else if (stage.kind === 'collect') {
      this.pickups = stage.points.map(([x, z]) => {
        const b = makeBeacon(0xff3fd0);
        b.position.set(x, 0, z);
        this.scene.add(b);
        return { x, z, beacon: b, taken: false };
      });
      this.beacon = this.pickups[0]?.beacon ?? null;
    } else if (stage.kind === 'chase') {
      this.targetCar = new FleeCar(this.scene, this.G.city, stage.x, stage.z, 0, stage.car);
      this.beacon = makeBeacon(0xff4a5a);
      this.scene.add(this.beacon);
    } else {
      this.beacon = makeBeacon(stage.kind === 'escape' ? 0x43e8ff : 0xffc24a);
      this.beacon.position.set(stage.x ?? 0, 0, stage.z ?? 0);
      this.scene.add(this.beacon);
    }
  }

  clearStageObjects() {
    if (this.beacon) { this.scene.remove(this.beacon); this.beacon = null; }
    if (this.pickups) { for (const p of this.pickups) this.scene.remove(p.beacon); this.pickups = null; }
    if (this.targetCar) { this.targetCar.vehicle.dispose(); this.targetCar = null; }
    if (this.jobCar) { this.jobCar.dispose(); this.jobCar = null; }
  }

  update(dt) {
    // Dialogue: one line at a time, timed to reading speed.
    if (this.currentLine) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) {
        this.currentLine = null;
        this.G.hud?.hideDialogue();
      }
    } else if (this.dialogueQueue.length > 0) {
      const [speaker, text] = this.dialogueQueue.shift();
      this.currentLine = { speaker, text };
      this.dialogueTimer = clamp(2.4 + text.length * 0.045, 3, 9);
      this.G.hud?.showDialogue(speaker, text);
    }

    if (!this.active) return;
    this.elapsed += dt;
    const stage = this.active.stages[this.stage];
    const player = this.G.player;
    const px = player.inCar && player.vehicle ? player.vehicle.pos.x : player.pos.x;
    const pz = player.inCar && player.vehicle ? player.vehicle.pos.z : player.pos.z;

    if (this.beacon) {
      const b = this.beacon.userData;
      const t = performance.now() / 1000;
      b.gem.rotation.y = t * 1.6;
      b.gem.position.y = 3.2 + Math.sin(t * 2) * 0.35;
      b.ring.scale.setScalar(1 + Math.sin(t * 2.2) * 0.06);
      b.beam.material.opacity = 0.12 + Math.sin(t * 1.4) * 0.04;
    }

    let done = false;
    let distance = null;

    switch (stage.kind) {
      case 'goto':
      case 'drive': {
        distance = dist(px, pz, stage.x, stage.z);
        if (distance < stage.radius) done = true;
        break;
      }
      case 'steal': {
        distance = this.jobCar ? dist(px, pz, this.jobCar.pos.x, this.jobCar.pos.z) : 0;
        if (player.inCar && player.vehicle === this.jobCar) done = true;
        break;
      }
      case 'collect': {
        for (const p of this.pickups) {
          if (p.taken) continue;
          if (dist(px, pz, p.x, p.z) < 3) {
            p.taken = true;
            this.collected++;
            this.scene.remove(p.beacon);
            this.G.audio?.pickup();
            this.G.effects.sparks(p.x, 1.2, p.z, 10, new THREE.Color(0xff3fd0), 4);
            this.G.hud?.toast(`ENVELOPE ${this.collected}/${this.pickups.length}`, 'story');
            const next = this.pickups.find((q) => !q.taken);
            if (next) {
              this.beacon = next.beacon;
            } else {
              this.beacon = null;
              done = true;
            }
          }
        }
        const left = this.pickups.filter((p) => !p.taken);
        distance = left.length ? Math.min(...left.map((p) => dist(px, pz, p.x, p.z))) : 0;
        this.stageProgress = this.collected / this.pickups.length;
        break;
      }
      case 'hold': {
        distance = dist(px, pz, stage.x, stage.z);
        const inside = distance < stage.radius;
        if (inside) this.stageTimer += dt;
        else this.stageTimer = Math.max(0, this.stageTimer - dt * 0.6);
        this.stageProgress = clamp(this.stageTimer / stage.seconds, 0, 1);
        if (this.stageTimer >= stage.seconds) done = true;
        if (inside && Math.random() < dt * 0.5) {
          this.G.police.report('heist', px, pz);
        }
        break;
      }
      case 'chase': {
        const car = this.targetCar.vehicle;
        this.targetCar.update(dt, { x: px, z: pz });
        distance = dist(px, pz, car.pos.x, car.pos.z);
        this.beacon.position.set(car.pos.x, 0, car.pos.z);
        this.stageProgress = clamp(1 - car.health / 100, 0, 1);
        if (car.health <= 25) done = true;
        break;
      }
      case 'escape': {
        distance = 0;
        this.stageProgress = 1 - this.G.police.wanted / 5;
        if (this.G.police.wanted === 0) done = true;
        break;
      }
    }

    if (done) this.completeStage();
    this.hudDistance = distance;
  }

  completeStage() {
    const job = this.active;
    const stage = job.stages[this.stage];
    this.G.audio?.confirm();
    if (this.stage + 1 < job.stages.length) {
      this.stage++;
      this.G.hud?.toast('STAGE CLEAR', 'cash');
      this.beginStage();
    } else {
      this.G.economy?.reward(job.reward, job.respect);
      this.completed.add(job.id);
      this.queueDialogue(job.outro);
      this.clearStageObjects();
      this.active = null;
      this.G.hud?.clearObjective();
      this.G.hud?.toast(`JOB COMPLETE  +${money(job.reward)}`, 'cash');
      this.G.save?.write();
      this.G.onMissionComplete?.(job);
    }
  }

  hud() {
    if (!this.active) return null;
    const stage = this.active.stages[this.stage];
    return {
      title: this.active.title,
      objective: stage.objective,
      stage: this.stage + 1,
      total: this.active.stages.length,
      distance: stage.kind === 'escape' || stage.kind === 'hold' ? null : this.hudDistance,
      distanceLabel: stage.kind === 'escape' ? 'EVADE' : stage.kind === 'hold' ? 'HOLD' : null,
      progress: this.stageProgress,
      timer: stage.kind === 'hold' ? mmss(Math.max(0, stage.seconds - this.stageTimer)) : mmss(this.elapsed),
    };
  }

  /** A mission marker position for the minimap, if there is one. */
  marker() {
    if (!this.active) return null;
    const stage = this.active.stages[this.stage];
    if (stage.kind === 'chase' && this.targetCar) return { x: this.targetCar.vehicle.pos.x, z: this.targetCar.vehicle.pos.z };
    if (stage.kind === 'steal' && this.jobCar) return { x: this.jobCar.pos.x, z: this.jobCar.pos.z };
    if (stage.kind === 'collect' && this.beacon) return { x: this.beacon.position.x, z: this.beacon.position.z };
    if (stage.x !== undefined) return { x: stage.x, z: stage.z };
    return null;
  }
}

export { GRID };
