// NEON PALMS — the sky: a gradient dome, a low sun over the sea, drifting cloud
// banks and stars that come out as the clock runs past dusk. The palette follows
// the renderer's hour so the city and the sky always agree.

import * as THREE from 'three';
import { PALETTE } from '../core/config.js';
import { makeRng } from '../core/util.js';
import { SUN_DIR } from './renderer.js';

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
uniform vec3 topColor;
uniform vec3 midColor;
uniform vec3 horizonColor;
uniform vec3 sunColor;
uniform vec3 sunDir;
uniform float sunStrength;
uniform float night;
uniform float time;
varying vec3 vDir;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec3 dir = normalize(vDir);
  float h = clamp(dir.y, -1.0, 1.0);
  vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.34, h));
  col = mix(col, topColor, smoothstep(0.26, 0.95, h));

  float sun = max(dot(dir, normalize(sunDir)), 0.0);
  col += sunColor * pow(sun, 1400.0) * 2.6 * sunStrength;
  col += sunColor * pow(sun, 46.0) * 0.30 * sunStrength;
  col += vec3(1.0, 0.5, 0.32) * pow(sun, 3.0) * 0.09 * sunStrength;

  if (night > 0.01 && h > 0.02) {
    vec2 cell = floor(dir.xz / max(h, 0.08) * 150.0);
    float star = step(0.9975, hash(cell)) * hash(cell + 3.7);
    float twinkle = 0.65 + 0.35 * sin(time * 2.2 + hash(cell) * 30.0);
    col += vec3(0.85, 0.9, 1.0) * star * twinkle * night * smoothstep(0.05, 0.4, h);
  }
  // A sub-LSB dither: 8-bit gradients this wide band otherwise.
  col += (hash(gl_FragCoord.xy * 0.37) - 0.5) * 0.016;
  gl_FragColor = vec4(col, 1.0);
}`;

function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const ctx = c.getContext('2d');
  const rng = makeRng(77);
  for (let i = 0; i < 26; i++) {
    const x = rng.range(30, 226), y = rng.range(46, 96);
    const r = rng.range(18, 46);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.55, 'rgba(255,235,225,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.sunDir = SUN_DIR.clone();

    this.uniforms = {
      topColor: { value: new THREE.Color(PALETTE.skyTop) },
      midColor: { value: new THREE.Color(PALETTE.skyMid) },
      horizonColor: { value: new THREE.Color(PALETTE.skyHorizon) },
      sunColor: { value: new THREE.Color(PALETTE.sun) },
      sunDir: { value: this.sunDir.clone() },
      sunStrength: { value: 1 },
      night: { value: 0 },
      time: { value: 0 },
    };
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(1600, 32, 20),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: VERT,
        fragmentShader: FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    );
    this.dome.frustumCulled = false;
    this.group.add(this.dome);

    const tex = cloudTexture();
    this.clouds = [];
    const rng = makeRng(9);
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthWrite: false, fog: false,
        opacity: rng.range(0.18, 0.42), color: 0xffd9c4,
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(rng.range(220, 460), rng.range(70, 150)), mat);
      const a = rng.range(-Math.PI, Math.PI);
      const r = rng.range(520, 900);
      m.position.set(Math.cos(a) * r, rng.range(120, 260), Math.sin(a) * r);
      m.userData.drift = rng.range(0.6, 1.8);
      this.clouds.push(m);
      this.group.add(m);
    }
    scene.add(this.group);
  }

  setHour(hour, night) {
    const u = this.uniforms;
    const top = new THREE.Color(PALETTE.skyTop).lerp(new THREE.Color(PALETTE.nightTop), night);
    const mid = new THREE.Color(PALETTE.skyMid).lerp(new THREE.Color(PALETTE.nightMid), night);
    const hor = new THREE.Color(PALETTE.skyHorizon).lerp(new THREE.Color(PALETTE.nightHorizon), night);
    u.topColor.value.copy(top);
    u.midColor.value.copy(mid);
    u.horizonColor.value.copy(hor);
    u.night.value = night;
    u.sunStrength.value = 1 - night * 0.82;
    for (const c of this.clouds) {
      c.material.color.copy(new THREE.Color(0xffd9c4).lerp(new THREE.Color(0x2a2a4a), night));
      c.material.opacity = 0.34 * (1 - night * 0.65);
    }
  }

  update(dt, time, camera) {
    this.uniforms.time.value = time;
    this.group.position.set(camera.position.x, 0, camera.position.z);
    for (const c of this.clouds) {
      c.position.x += c.userData.drift * dt * 1.6;
      if (c.position.x > 950) c.position.x = -950;
      c.lookAt(camera.position.x, c.position.y, camera.position.z);
    }
  }
}
