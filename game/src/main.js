// NEON PALMS — boot, input and the frame loop. One fixed 60 Hz simulation step
// drives every system in a fixed order; rendering happens once per animation
// frame. The title, pause and end screens are DOM overlays; the world keeps
// running behind the title so the city is the menu's backdrop.

import * as THREE from 'three';
import { Renderer } from './render/renderer.js';
import { Sky } from './render/sky.js';
import { Effects } from './render/effects.js';
import { City } from './world/city.js';
import { Player } from './entities/player.js';
import { CameraRig } from './entities/camera.js';
import { Pedestrians } from './entities/pedestrian.js';
import { Traffic } from './systems/traffic.js';
import { Police } from './systems/police.js';
import { Combat } from './systems/combat.js';
import { Missions, STORY } from './systems/missions.js';
import { Economy } from './systems/economy.js';
import { Hud } from './ui/hud.js';
import { Menu } from './ui/menu.js';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { Save } from './core/save.js';
import { Vehicle } from './entities/vehicle.js';
import { TIME, PLAYER, WEAPONS, RADIO, CAMERA } from './core/config.js';
import { clamp, dist, makeRng } from './core/util.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('view');
const renderer = new Renderer(canvas);
const sky = new Sky(renderer.scene);
const city = new City(renderer.scene);

const G = {
  THREE, renderer, sky, city,
  state: { hour: TIME.start, time: 0, mode: 'title', ready: false, fps: 0, paused: false },
  events: null,
};
G.events = new (class {
  constructor() { this.map = new Map(); }
  on(n, f) { (this.map.get(n) ?? this.map.set(n, []).get(n)).push(f); }
  emit(n, p) { for (const f of this.map.get(n) ?? []) f(p); }
})();

G.effects = new Effects(renderer.scene);
G.player = new Player(renderer.scene, city);
G.traffic = new Traffic(renderer.scene, city);
G.peds = new Pedestrians(renderer.scene, city);
G.combat = new Combat(renderer.scene, G);
G.police = new Police(renderer.scene, G);
G.missions = new Missions(renderer.scene, G);
G.economy = new Economy(G);
G.audio = new Audio();
G.save = new Save(G);
G.hud = new Hud(G);
G.menu = new Menu(G);
G.input = new Input(canvas);
G.cam = new CameraRig(renderer.camera, canvas);
G.vehicles = {
  all: [],
  refresh() { this.all = G.traffic.vehicles.concat(G.police.units.map((u) => u.car), G.police.roadblocks); },
};
G.vehicles.refresh();

// ---- game state transitions -------------------------------------------------

function newGame() {
  G.audio.start();
  G.menu.hideTitle();
  G.hud.show();
  G.state.mode = 'play';
  G.player.respawn(-360, 6);
  G.player.setWeapon('pistol', 90);
  G.police.setWanted(0);
  G.missions.start(0);
}

function continueGame() {
  if (!G.save.load()) return newGame();
  G.audio.start();
  G.menu.hideTitle();
  G.hud.show();
  G.state.mode = 'play';
  G.hud.setMoney(G.economy.cash);
  G.hud.setRespect(G.economy.respect);
  G.missions.start(Math.min(G.missions.index, STORY.length - 1));
}

function pause(on) {
  if (G.state.mode !== 'play' && G.state.mode !== 'pause') return;
  G.state.mode = on ? 'pause' : 'play';
  if (on) G.menu.showPause(); else G.menu.hidePause();
}

function toTitle() {
  G.state.mode = 'title';
  G.menu.hidePause();
  G.menu.hideOverlay();
  G.menu.showTitle();
  G.hud.hide();
}

function wipe(kind) {
  if (G.state.mode !== 'play') return;
  G.state.mode = kind;
  G.player.exitVehicle();
  const stats = [['CASH', `$${G.economy.cash}`], ['JOBS', `${G.missions.completed.size}/${STORY.length}`]];
  G.menu.showOverlay(kind, stats);
}

G.onBusted = () => {
  G.police.setWanted(0);
  wipe('busted');
};
G.onWasted = () => wipe('wasted');
G.onStoryComplete = () => G.menu.showOverlay('complete', [['CASH', `$${G.economy.cash}`], ['RESPECT', `${Math.round(G.economy.respect)}%`]]);
G.onMissionComplete = (job) => {
  if (G.missions.index + 1 < STORY.length) {
    setTimeout(() => {
      if (G.state.mode === 'play') G.missions.start(G.missions.index + 1);
    }, 4200);
  } else {
    setTimeout(() => G.onStoryComplete(), 4200);
  }
};

function respawnAtHospital() {
  G.police.setWanted(0);
  G.economy.cash = Math.max(0, G.economy.cash - 200);
  G.hud.setMoney(G.economy.cash);
  G.player.respawn(-234, 96);
  G.player.health = PLAYER.maxHealth;
  G.player.armor = 0;
  G.menu.hideOverlay();
  G.hud.show();
  G.state.mode = 'play';
  if (!G.missions.active) G.missions.start(Math.min(G.missions.index, STORY.length - 1));
}

G.menu.on('new', newGame);
G.menu.on('continue', continueGame);
G.menu.on('resume', () => pause(false));
G.menu.on('save', () => { G.save.write(); G.hud.toast('GAME SAVED', 'cash'); });
G.menu.on('quit', toTitle);
G.menu.on('retry', () => {
  G.menu.hideOverlay();
  G.hud.show();
  G.state.mode = 'play';
  G.player.respawn(-360, 6);
  G.player.health = PLAYER.maxHealth;
  if (!G.missions.active) G.missions.start(Math.min(G.missions.index, STORY.length - 1));
});
G.menu.on('hospital', respawnAtHospital);
G.menu.on('missions', () => {
  // Jump to the next unplayed job: the fastest way back into the story.
  const next = Math.min(G.missions.index, STORY.length - 1);
  G.menu.hideTitle();
  G.hud.show();
  G.state.mode = 'play';
  G.player.respawn(-360, 6);
  G.missions.start(next);
});

// ---- per-frame input --------------------------------------------------------

function handleInput(dt) {
  const input = G.input;
  if (input.hit('Escape')) pause(G.state.mode === 'play');
  if (G.state.mode !== 'play') return;

  if (input.hit('KeyM')) {
    const muted = G.audio.toggleMute();
    G.hud.toast(muted ? 'SOUND OFF' : 'SOUND ON', 'story');
  }
  if (input.hit('KeyR')) {
    const st = G.audio.setStation(G.audio.station + 1);
    G.hud.toast(`${st.station} · ${st.track}`, 'story');
  }
  if (input.hit('Tab')) {
    G.hud.minimap.range = G.hud.minimap.range > 200 ? 110 : 260;
    G.hud.toast(`RADAR ${G.hud.minimap.range > 200 ? 'CITY' : 'LOCAL'}`, 'story');
  }

  // Enter / exit / carjack.
  if (input.hit('KeyE')) {
    if (G.player.inCar) {
      G.player.exitVehicle();
    } else {
      const car = G.traffic.nearest(G.player.pos.x, G.player.pos.z, 5.5);
      if (car && !car.dead) {
        if (car.driver === 'ai') {
          car.ai = null;
          car.setDriver(null);
          G.police.report('carjack', car.pos.x, car.pos.z);
          G.hud.toast('CARJACKED', 'alert');
        }
        G.player.enterVehicle(car);
        G.audio.start();
      }
    }
  }

  // Weapons: 1 pistol, 2 SMG, 3 shotgun.
  if (input.hit('Digit1')) G.player.setWeapon('pistol');
  if (input.hit('Digit2') && (G.player.ammo.smg ?? 0) > 0) G.player.setWeapon('smg');
  if (input.hit('Digit3') && (G.player.ammo.shotgun ?? 0) > 0) G.player.setWeapon('shotgun');

  // Aim from the cursor.
  const aim = G.cam.aimPoint(input.mouse);
  if (aim) G.player.aimAt(aim.x, aim.z);

  // Fire.
  if ((input.mouse.down || input.hit('Space')) && !G.player.inCar && G.player.fireCooldown <= 0) {
    const w = G.player.weaponDef;
    if (w.ammo === Infinity || (G.player.ammo[G.player.weapon] ?? 0) > 0) {
      G.combat.fire('player', G.player.pos.x, 1.35, G.player.pos.z, G.player.aimAngle, G.player.weapon);
      G.cam.addShake(0.08);
      G.hud.setCrosshair(true);
    } else if (G.player.fireCooldown <= 0) {
      G.player.fireCooldown = 0.5;
      G.hud.toast('OUT OF AMMO', 'alert');
    }
  }
  G.hud.setCrosshair(!G.player.inCar);
}

// ---- the simulation step ----------------------------------------------------

let acc = 0;
const STEP = 1 / 60;

function simulate(dt) {
  const input = G.input;
  const p = G.player;

  if (G.state.mode === 'play') {
    handleInput(dt);
    const axis = input.axis();
    const controls = {
      throttle: -axis.z,
      steer: axis.x,
      handbrake: input.down('ShiftLeft') || input.down('ShiftRight'),
    };
    p.update(dt, {
      move: { x: axis.x, z: axis.z },
      sprint: input.down('ShiftLeft') || input.down('ShiftRight'),
      cameraYaw: G.cam.yaw,
      aiming: true,
      controls,
    });
    if (p.dead) G.onWasted();

    G.traffic.update(dt, p.inCar && p.vehicle ? p.vehicle.pos : p.pos, p.inCar ? p.vehicle : null);
    G.peds.update(dt, p.inCar && p.vehicle ? p.vehicle.pos : p.pos);
    G.police.update(dt);
    G.missions.update(dt);
    G.vehicles.refresh();

    // Engine and skid audio follow the car.
    if (p.inCar && p.vehicle) {
      G.audio.setEngine(p.vehicle.speed, p.vehicle.throttle);
      G.audio.skid(Math.abs(p.vehicle.steer) > 0.6 && Math.abs(p.vehicle.speed) > 8);
    } else {
      G.audio.setEngine(null, 0);
      G.audio.skid(false);
    }
  } else {
    // The city still breathes behind the title and the pause screen.
    G.traffic.update(dt, p.pos, null);
    G.peds.update(dt, p.pos);
    if (G.state.mode !== 'pause') G.police.update(dt);
    G.audio.setEngine(null, 0);
  }

  G.combat.update(dt);
  G.combat.fadeTracers(dt);
  G.effects.update(dt);
  G.city.update(dt, G.state.hour);
  G.cam.update(dt, p, p.inCar ? p.vehicle : null, p.inCar ? Math.abs(p.vehicle.speed) : p.speed);
  renderer.follow(p.pos);

  if (G.state.mode === 'play') {
    G.state.hour += (dt * TIME.minutesPerSecond) / 60;
    G.hud.update(dt, G);
  }
}

let last = performance.now();
let frames = 0, fpsTime = 0;

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  frames++;
  fpsTime += dt;
  if (fpsTime > 0.5) { G.state.fps = Math.round(frames / fpsTime); frames = 0; fpsTime = 0; }

  acc += dt;
  let steps = 0;
  if (G.state.freeze) {
    G.hud.update(dt, G);
    renderer.setHour(G.state.hour, sky);
    sky.update(0, G.state.time, renderer.camera);
    renderer.render();
    G.input.endFrame();
    requestAnimationFrame(loop);
    return;
  }
  while (acc >= STEP && steps < 5) {
    simulate(STEP);
    acc -= STEP;
    steps++;
  }

  renderer.setHour(G.state.hour, sky);
  sky.update(dt, G.state.time, renderer.camera);
  G.state.time += dt;
  renderer.render();
  G.input.endFrame();
  requestAnimationFrame(loop);
}

// ---- debug / screenshot hooks ----------------------------------------------

function setWanted(n) { G.police.setWanted(n); }
function teleport(x, z) { G.player.respawn(x, z); G.cam.initialised = false; }
function spawnCar(type, x, z, heading = 0) {
  const car = new Vehicle(renderer.scene, city, type, x, z, heading);
  G.traffic.parked.push(car);
  G.vehicles.refresh();
  return car;
}

window.__np = {
  THREE, G, renderer, sky, city,
  state: G.state,
  setHour: (h) => { G.state.hour = h; },
  setWanted, teleport, spawnCar,
  startMission: (i) => G.missions.start(i),
  setMoney: (n) => { G.economy.cash = n; G.hud.setMoney(n); },
  setRespect: (n) => { G.economy.respect = n; G.hud.setRespect(n); },
  giveWeapon: (id, ammo) => G.player.setWeapon(id, ammo),
  setDialogue: (speaker, text) => G.hud.showDialogue(speaker, text),
  look: (tx, ty, tz, yaw, pitch, distance) => {
    G.cam.yaw = yaw;
    G.cam.pitch = pitch;
    G.cam.distance = distance;
    G.cam.initialised = false;
    G.player.pos.set(tx, 0, tz);
    G.player.sync();
  },
  stage: (name) => stageShot(G, name),
};

// ---- start -----------------------------------------------------------------

G.spawnCar = spawnCar;
document.getElementById('loading').classList.add('hidden');
G.menu.showTitle();
G.hud.hide();
G.state.ready = true;
requestAnimationFrame(loop);

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  G.menu.hideTitle();
  G.hud.show();
  G.state.mode = 'play';
  // Let the first frames settle, then stage the requested still.
  setTimeout(() => stageShot(G, shot), 60);
}
