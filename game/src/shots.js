// NEON PALMS — staged stills for the entry's screenshots. Each shot sets the
// clock, puts the cast where the frame needs them and fills the HUD with a real
// game state, then freezes the simulation so the capture is reproducible.
// Reached with ?shot=cover | onfoot | chase | heist, or window.__np.stage(name).
//
// Palma Sol's roads run at x/z = -384 + i*96; the shots are framed on them so the
// city's own blocks become the backdrop.

import { STORY } from './systems/missions.js';
import { makeRng } from './core/util.js';

const rng = makeRng(4242);

function freezeSoon(G, ms = 420) {
  setTimeout(() => { G.state.freeze = true; window.__np.shotReady = true; }, ms);
}

function hudBase(G, money, respect, weapon, ammo) {
  G.economy.cash = money;
  G.economy.respect = respect;
  G.hud.setMoney(money);
  G.hud.setRespect(respect);
  G.player.setWeapon(weapon, ammo);
}

function mission(G, index, stageIndex, dialogue) {
  G.missions.start(index);
  if (stageIndex > 0) {
    G.missions.stage = stageIndex;
    G.missions.beginStage();
  }
  // A still is a moment mid-job, so give it a believable clock and gap.
  G.missions.elapsed = 74 + index * 31;
  G.missions.hudDistance = 180 + index * 40;
  if (dialogue) G.hud.showDialogue(dialogue[0], dialogue[1]);
}

function moveTraffic(G, spots) {
  const cars = G.traffic.list;
  spots.forEach((s, i) => {
    const car = cars[i % cars.length];
    if (!car) return;
    car.vehicle.pos.set(s.x, 0, s.z);
    car.vehicle.heading = s.h;
    car.vehicle.speed = s.speed ?? 9;
    car.vehicle.sync();
  });
}

function movePeds(G, spots) {
  const peds = G.peds.list;
  spots.forEach((s, i) => {
    const p = peds[i % peds.length];
    if (!p) return;
    p.pos.set(s.x, 0, s.z);
    p.heading = s.h ?? 0;
    p.state = s.flee ? 'flee' : 'walk';
    p.fleeTimer = s.flee ? 8 : 0;
    p.mesh.position.set(s.x, 0, s.z);
    p.mesh.rotation.y = p.heading;
  });
}

/** A fixed cinema camera for the stills, overriding the follow rig. */
function cine(G, px, py, pz, lx, ly, lz) {
  G.cam.override = {
    pos: new G.THREE.Vector3(px, py, pz),
    look: new G.THREE.Vector3(lx, ly, lz),
  };
}

function unitsBehind(G, x, z, heading, count = 3) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const back = 8 + i * 8.5;
    const side = (i % 2 === 0 ? -1 : 1) * 4.2;
    const u = G.police.spawnUnit(
      x - Math.sin(heading) * back + Math.cos(heading) * side,
      z - Math.cos(heading) * back - Math.sin(heading) * side,
      heading,
    );
    u.car.sirenOn = true;
    u.car.speed = 14;
    out.push(u);
  }
  return out;
}

export function stageShot(G, name) {
  G.state.freeze = false;
  G.cam.override = null;
  G.hud.show();
  G.state.mode = 'play';
  G.menu.hideTitle();
  G.menu.hideOverlay();

  if (name === 'cover') {
    G.state.hour = 18.6;
    const car = G.spawnCar('coupe', -383, -38, 0);
    G.player.respawn(-383, -38);
    G.player.enterVehicle(car);
    car.speed = 21;
    hudBase(G, 18450, 62, 'pistol', 120);
    mission(G, 2, 1, ['DALIA MÁRQUEZ', 'They have air support. Lose them before the bridge.']);
    moveTraffic(G, [
      { x: -377, z: 12, h: 0 }, { x: -390, z: 34, h: Math.PI },
      { x: -377, z: 62, h: 0 }, { x: -390, z: 88, h: Math.PI },
      { x: -377, z: 116, h: 0 }, { x: -390, z: -4, h: Math.PI },
    ]);
    movePeds(G, [
      { x: -368, z: -6, h: 0 }, { x: -368, z: 16, h: Math.PI },
      { x: -368, z: 36, h: 0 }, { x: -399, z: 24, h: Math.PI },
      { x: -399, z: 48, h: 0 },
    ]);
    G.police.setWanted(3);
    unitsBehind(G, -383, -38, 0, 4);
    G.police.heli.activate(-383, -38);
    G.police.heli.pos.set(-330, 26, 6);
    G.hud.setCrosshair(false);
    G.hud.toast('AIR UNIT DEPLOYED', 'alert');
    // Front three-quarter from the sand side: the coupe is lit by the low sun,
    // and the patrol pack reads behind it down the boulevard.
    cine(G, -393, 3.1, -28, -383, 1.1, -44);
    freezeSoon(G);
  }

  if (name === 'onfoot') {
    G.state.hour = 19.15;
    G.player.respawn(-280, 82);
    G.player.aimAngle = 0.6;
    G.player.heading = 0.6;
    G.player.sync(0, { aiming: true });
    G.cam.yaw = 0.6;
    G.cam.initialised = false;
    hudBase(G, 18450, 62, 'pistol', 120);
    mission(G, 3, 1, ['DALIA MÁRQUEZ', 'Hold the corner. Make them work for it.']);
    movePeds(G, [
      { x: -268, z: 102, h: 2.2, flee: true }, { x: -272, z: 112, h: 2.8, flee: true },
      { x: -256, z: 88, h: 3.4, flee: true }, { x: -292, z: 96, h: 2.0, flee: true },
    ]);
    G.police.setWanted(2);
    const units = unitsBehind(G, -280, 82, 0, 2);
    for (const u of units) { u.car.pos.z -= 4; u.car.sync(); u.deploy(); }
    G.combat.fire('player', G.player.pos.x, 1.35, G.player.pos.z, 0.6, 'pistol');
    G.combat.tracers.forEach((t) => { if (t.visible) t.userData.life = 999; });
    G.player.muzzleTime = 999;
    G.hud.setCrosshair(true);
    G.hud.toast('AIR UNIT DEPLOYED', 'alert');
    // Behind and to the right: the player's car on the corner, the officers
    // fanning out in front of it.
    cine(G, -273, 2.6, 68, -281, 1.4, 86);
    freezeSoon(G);
  }

  if (name === 'chase') {
    G.state.hour = 19.5;
    const car = G.spawnCar('muscle', -5, 40, Math.PI);
    G.player.respawn(-5, 40);
    G.player.enterVehicle(car);
    car.speed = 24;
    G.cam.yaw = Math.PI + 0.03;
    G.cam.initialised = false;
    hudBase(G, 26400, 74, 'smg', 180);
    mission(G, 4, 0, ['RAFA CRUZ', 'He is not stopping. Neither am I.']);
    moveTraffic(G, [
      { x: 5, z: 8, h: Math.PI }, { x: -5, z: -14, h: 0 },
      { x: 5, z: -44, h: Math.PI }, { x: -5, z: -74, h: 0 },
    ]);
    G.police.setWanted(5);
    unitsBehind(G, -5, 40, Math.PI, 4);
    G.police.heli.activate(-5, 40);
    G.police.heli.pos.set(26, 22, 4);
    G.effects.smoke(car.pos.x, 0.4, car.pos.z + 2, 12, undefined, 2.6);
    G.effects.sparks(car.pos.x + 1, 0.5, car.pos.z + 3, 10, undefined, 6);
    G.hud.setCrosshair(false);
    cine(G, 6, 3.0, 58, -6, 1.3, 28);
    freezeSoon(G);
  }

  if (name === 'heist') {
    G.state.hour = 21.4;
    G.player.respawn(5, -182);
    G.player.aimAngle = Math.PI;
    G.player.heading = Math.PI;
    G.player.sync(0, { aiming: true });
    G.cam.yaw = Math.PI;
    G.cam.initialised = false;
    hudBase(G, 31200, 88, 'smg', 240);
    mission(G, 5, 1, ['DALIA MÁRQUEZ', 'Ninety seconds, Rafa. Then the whole city wakes up.']);
    moveTraffic(G, [
      { x: -5, z: -200, h: Math.PI / 2 }, { x: 5, z: -176, h: -Math.PI / 2 },
      { x: -5, z: -160, h: Math.PI / 2 }, { x: 5, z: -220, h: -Math.PI / 2 },
    ]);
    movePeds(G, [
      { x: -16, z: -196, h: 1.2, flee: true }, { x: 18, z: -190, h: 4.2, flee: true },
      { x: -10, z: -172, h: 2.4, flee: true },
    ]);
    G.police.setWanted(4);
    // The response comes out of the tower, facing the player: a firing line in
    // the light of the entrance rather than a queue behind the camera.
    const line = [[-6, -196], [4, -201], [13, -196], [-14, -205]];
    const units = [];
    for (const [x, z] of line) {
      const u = G.police.spawnUnit(x, z, Math.PI);
      u.car.sirenOn = true;
      u.car.speed = 0;
      units.push(u);
    }
    for (const u of units) u.deploy();
    G.combat.fire('police', -6, 1.4, -196, Math.PI, 'pistol');
    G.combat.fire('player', 5, 1.35, -182, Math.PI, 'smg');
    G.combat.tracers.forEach((t) => { if (t.visible) t.userData.life = 999; });
    G.player.muzzleTime = 999;
    G.police.heli.activate(5, -182);
    G.police.heli.pos.set(34, 24, -160);
    G.hud.setCrosshair(true);
    // Over the shoulder and down the street, so the tower, the crosswalk and the
    // line of officers all sit inside the frame.
    cine(G, 7.5, 2.7, -172, 2, 1.4, -198);
    freezeSoon(G);
  }

  if (name === 'title') {
    G.state.hour = 18.45;
    G.player.respawn(-379, 6);
    G.player.mesh.visible = false;
    G.cam.yaw = 0.06;
    G.cam.initialised = false;
    G.menu.showTitle();
    G.hud.hide();
    G.state.mode = 'title';
    cine(G, -373, 2.4, -18, -382, 2.2, 30);
    freezeSoon(G, 260);
  }
}

export { STORY };
