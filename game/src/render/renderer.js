// NEON PALMS — the renderer, camera and light rig. One sun, low over the sea,
// warm fog, soft shadows; the shadow camera rides along with the player so a
// 768 m city still gets crisp contact shadows where the camera is.

import * as THREE from 'three';
import { PALETTE } from '../core/config.js';

// Where the sun sits: low over the sea to the west-south-west. The sky dome and
// the directional light both read this, so the disc in the sky is always the
// light that is casting the shadows.
export const SUN_DIR = new THREE.Vector3(-0.9, 0.24, 0.36).normalize();
export const SUN_DISTANCE = 340;

export class Renderer {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(new THREE.Color(PALETTE.fog), 150, 820);

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.35, 2400);
    this.camera.position.set(0, 8, 20);

    this.hemi = new THREE.HemisphereLight(0xffd2a8, 0x2a2436, 0.72);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffc089, 2.9);
    this.sun.position.set(-260, 150, 190);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = 95;
    this.sun.shadow.camera.left = -s;
    this.sun.shadow.camera.right = s;
    this.sun.shadow.camera.top = s;
    this.sun.shadow.camera.bottom = -s;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 520;
    this.sun.shadow.bias = -0.0012;
    this.sun.shadow.normalBias = 0.045;
    // three only computes the ortho projection once, at construction, so the
    // bounds above do nothing until the matrix is rebuilt by hand.
    this.sun.shadow.camera.updateProjectionMatrix();
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.fill = new THREE.DirectionalLight(0x6f7bff, 0.32);
    this.fill.position.set(120, 60, -140);
    this.scene.add(this.fill);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** The shadow frustum follows the action; the sky light does not. */
  follow(target) {
    const x = Math.round(target.x / 2) * 2;
    const z = Math.round(target.z / 2) * 2;
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(
      x + SUN_DIR.x * SUN_DISTANCE,
      SUN_DIR.y * SUN_DISTANCE,
      z + SUN_DIR.z * SUN_DISTANCE,
    );
    this.sun.target.updateMatrixWorld();
  }

  /** Dusk palette, drifting into night as the clock passes 20:00. */
  setHour(hour, sky) {
    const t = THREE.MathUtils.clamp((hour - 19.1) / 3.2, 0, 1);
    const sunColor = new THREE.Color(PALETTE.sun).lerp(new THREE.Color('#ff8f5a'), 0.12 + t * 0.3);
    this.sun.color.copy(sunColor);
    this.sun.intensity = THREE.MathUtils.lerp(1.15, 0.18, t);
    this.hemi.intensity = THREE.MathUtils.lerp(0.85, 0.3, t);
    this.hemi.color.set(PALETTE.skyHorizon).lerp(new THREE.Color('#2a3a7a'), t);
    this.fill.intensity = THREE.MathUtils.lerp(0.28, 0.5, t);
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(1.0, 1.18, t);
    const fog = new THREE.Color(PALETTE.fog).lerp(new THREE.Color('#141530'), t);
    this.scene.fog.color.copy(fog);
    this.scene.fog.near = THREE.MathUtils.lerp(150, 110, t);
    this.scene.fog.far = THREE.MathUtils.lerp(820, 620, t);
    if (sky) sky.setHour(hour, t);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
