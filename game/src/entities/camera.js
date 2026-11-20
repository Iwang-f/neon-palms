// NEON PALMS — the camera. A spring arm behind the player that leans out toward
// where you are aiming, drops low when you sprint, rides the car's heading when
// you drive, and takes a knock when something hits.

import * as THREE from 'three';
import { CAMERA } from '../core/config.js';
import { clamp, damp, angleDamp, wrapAngle } from '../core/util.js';

export class CameraRig {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    this.yaw = Math.PI * 0.5;
    this.pitch = 0.2;
    this.distance = CAMERA.footDistance;
    this.shake = 0;
    this.shakeTime = 0;
    this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.1);
    this.hitPoint = new THREE.Vector3();
    this.lookAt = new THREE.Vector3();
    this.desired = new THREE.Vector3();
    this.initialised = false;
  }

  /** Where the cursor points, on the chest-height plane. */
  aimPoint(mouse) {
    const ndc = new THREE.Vector2(
      (mouse.x / window.innerWidth) * 2 - 1,
      -(mouse.y / window.innerHeight) * 2 + 1,
    );
    this.ray.setFromCamera(ndc, this.camera);
    const hit = this.ray.ray.intersectPlane(this.plane, this.hitPoint);
    return hit ? hit : null;
  }

  addShake(amount) {
    this.shake = Math.min(1.4, this.shake + amount);
  }

  update(dt, player, vehicle, speed) {
    if (this.override) {
      this.camera.position.copy(this.override.pos);
      this.camera.lookAt(this.override.look);
      return;
    }
    const inCar = !!vehicle;
    // The camera trails the body's heading, never the aim point: aiming at the
    // cursor used to feed the yaw back into itself and spin the view.
    const targetYaw = inCar
      ? vehicle.heading + clamp(vehicle.steer * 0.35, -0.5, 0.5)
      : player.heading;
    this.yaw = angleDamp(this.yaw, targetYaw, inCar ? 3.2 : 7.5, dt);

    const wantDistance = inCar
      ? CAMERA.carDistance + clamp(speed / 40, 0, 1) * 2.4
      : CAMERA.footDistance + (player.sprinting ? 0.8 : 0);
    this.distance = damp(this.distance, wantDistance, 3, dt);

    const height = inCar ? CAMERA.carHeight : CAMERA.footHeight;
    const back = this.distance;

    this.desired.set(
      player.pos.x - Math.sin(this.yaw) * back,
      height,
      player.pos.z - Math.cos(this.yaw) * back,
    );

    if (!this.initialised) {
      this.camera.position.copy(this.desired);
      this.initialised = true;
    } else {
      this.camera.position.x = damp(this.camera.position.x, this.desired.x, CAMERA.lag, dt);
      this.camera.position.z = damp(this.camera.position.z, this.desired.z, CAMERA.lag, dt);
      this.camera.position.y = damp(this.camera.position.y, this.desired.y, CAMERA.lag * 0.8, dt);
    }

    const ahead = inCar ? 4.5 : 2.2;
    this.lookAt.set(
      player.pos.x + Math.sin(this.yaw) * ahead,
      1.25 + (inCar ? 0.35 : 0),
      player.pos.z + Math.cos(this.yaw) * ahead,
    );

    if (this.shake > 0.001) {
      this.shakeTime += dt * 42;
      const s = this.shake * 0.24;
      this.camera.position.x += Math.sin(this.shakeTime * 1.7) * s;
      this.camera.position.y += Math.cos(this.shakeTime * 2.3) * s * 0.7;
      this.camera.position.z += Math.sin(this.shakeTime * 1.1) * s;
      this.shake = Math.max(0, this.shake - dt * 2.6);
    }

    this.camera.lookAt(this.lookAt);
    this.camera.rotation.z += Math.sin(this.shakeTime * 0.9) * this.shake * 0.03;
  }
}

export { wrapAngle };
