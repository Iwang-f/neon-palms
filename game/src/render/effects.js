// NEON PALMS — the small stuff that sells impact: sparks, smoke, tyre dust,
// muzzle flash lights and explosions. One pooled point cloud, one additive
// sprite batch, no per-hit allocation.

import * as THREE from 'three';
import { makeRng } from '../core/util.js';

const MAX = 900;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.rng = makeRng(55);
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.maxLife = new Float32Array(MAX);
    this.gravity = new Float32Array(MAX);
    this.head = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: /* glsl */ `
        attribute float size;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (260.0 / max(-mv.z, 1.0));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        void main() {
          vec2 d = gl_PointCoord - vec2(0.5);
          float a = smoothstep(0.5, 0.1, length(d));
          if (a < 0.02) discard;
          gl_FragColor = vec4(vColor, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    this.flashes = [];
    for (let i = 0; i < 3; i++) {
      const light = new THREE.PointLight(0xffb060, 0, 26, 2);
      light.visible = false;
      scene.add(light);
      this.flashes.push({ light, life: 0 });
    }
    this.flashIndex = 0;
  }

  _emit(x, y, z, vx, vy, vz, color, size, life, gravity = -9) {
    const i = this.head;
    this.head = (this.head + 1) % MAX;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = color.r; this.col[i * 3 + 1] = color.g; this.col[i * 3 + 2] = color.b;
    this.size[i] = size;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.gravity[i] = gravity;
  }

  sparks(x, y, z, count = 8, color = new THREE.Color(0xffc070), power = 5) {
    for (let i = 0; i < count; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const up = this.rng.range(0.2, 1);
      const sp = this.rng.range(power * 0.3, power);
      this._emit(x, y, z, Math.cos(a) * sp, up * sp, Math.sin(a) * sp, color, this.rng.range(0.5, 1.4), this.rng.range(0.25, 0.6), -12);
    }
  }

  smoke(x, y, z, count = 4, color = new THREE.Color(0x8a8a92), spread = 1.2) {
    for (let i = 0; i < count; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const sp = this.rng.range(0.2, spread);
      this._emit(x, y, z, Math.cos(a) * sp, this.rng.range(0.6, 2.2), Math.sin(a) * sp, color, this.rng.range(2.5, 6), this.rng.range(0.6, 1.6), 0.6);
    }
  }

  blood(x, y, z, count = 6) {
    for (let i = 0; i < count; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const sp = this.rng.range(0.6, 3);
      this._emit(x, y, z, Math.cos(a) * sp, this.rng.range(0.2, 2), Math.sin(a) * sp, new THREE.Color(0x8e1420), this.rng.range(0.6, 1.6), this.rng.range(0.3, 0.7), -14);
    }
  }

  dust(x, z, count = 3) {
    this.smoke(x, 0.2, z, count, new THREE.Color(0x9a8a7a), 0.8);
  }

  flash(x, y, z, color = 0xffb060, power = 26, life = 0.07) {
    const slot = this.flashes[this.flashIndex];
    this.flashIndex = (this.flashIndex + 1) % this.flashes.length;
    slot.light.position.set(x, y, z);
    slot.light.color.setHex(color);
    slot.light.intensity = power;
    slot.light.visible = true;
    slot.life = life;
  }

  explosion(x, y, z) {
    this.sparks(x, y, z, 26, new THREE.Color(0xffa040), 12);
    this.smoke(x, y + 1, z, 14, new THREE.Color(0x2a2a30), 4);
    this.flash(x, y + 1, z, 0xff8030, 90, 0.35);
  }

  update(dt) {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) { this.size[i] = 0; continue; }
      this.life[i] -= dt;
      const i3 = i * 3;
      this.vel[i3 + 1] += this.gravity[i] * dt;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.pos[i3 + 1] < 0.05) {
        this.pos[i3 + 1] = 0.05;
        this.vel[i3 + 1] *= -0.35;
        this.vel[i3] *= 0.7;
        this.vel[i3 + 2] *= 0.7;
      }
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      this.size[i] *= 0.995;
      this.col[i3] *= 0.995; this.col[i3 + 1] *= 0.995; this.col[i3 + 2] *= 0.995;
      if (t <= 0) this.size[i] = 0;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    this.points.geometry.attributes.size.needsUpdate = true;
    for (const f of this.flashes) {
      if (f.life > 0) {
        f.life -= dt;
        f.light.intensity *= 0.72;
        if (f.life <= 0) { f.light.visible = false; f.light.intensity = 0; }
      }
    }
  }
}
