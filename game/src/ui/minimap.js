// NEON PALMS — the radar. A north-up disc of the streets around Rafa: blocks,
// roads, the job marker, PSD units and the player's arrow, drawn every frame on
// a small canvas.

import { UI, WORLD } from '../core/config.js';
import { TAU } from '../core/util.js';

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.size = canvas.clientWidth || 186;
    canvas.width = Math.round(this.size * dpr);
    canvas.height = Math.round(this.size * dpr);
    this.ctx = canvas.getContext('2d');
    this.ctx.scale(dpr, dpr);
    this.range = UI.minimapRange;
  }

  draw(G) {
    const ctx = this.ctx;
    const size = this.size;
    const half = size / 2;
    const scale = half / this.range;
    const p = G.player;
    const px = p.inCar && p.vehicle ? p.vehicle.pos.x : p.pos.x;
    const pz = p.inCar && p.vehicle ? p.vehicle.pos.z : p.pos.z;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(half, half, half, 0, TAU);
    ctx.clip();

    ctx.fillStyle = '#12101e';
    ctx.fillRect(0, 0, size, size);

    const tx = (x) => half + (x - px) * scale;
    const tz = (z) => half + (z - pz) * scale;

    // Sea to the west and south.
    ctx.fillStyle = '#16394d';
    ctx.fillRect(tx(-700), 0, (-452 - -700) * scale, size);
    ctx.fillRect(0, tz(392), size, size);

    // Blocks and their buildings.
    ctx.fillStyle = '#2c2a3a';
    for (const b of G.city.blocks) {
      const x = tx(b.cx - 38), z = tz(b.cz - 38);
      ctx.fillRect(x, z, 76 * scale, 76 * scale);
    }
    ctx.fillStyle = '#413e54';
    for (const b of G.city.buildings) {
      const x = tx(b.x - b.w / 2), z = tz(b.z - b.d / 2);
      ctx.fillRect(x, z, Math.max(1, b.w * scale), Math.max(1, b.d * scale));
    }

    // Road grid.
    ctx.strokeStyle = '#6a6478';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      const r = -384 + i * 96;
      ctx.beginPath();
      ctx.moveTo(tx(-450), tz(r));
      ctx.lineTo(tx(450), tz(r));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tx(r), tz(-450));
      ctx.lineTo(tx(r), tz(450));
      ctx.stroke();
    }

    // Job marker.
    const marker = G.missions?.marker();
    if (marker) {
      const x = tx(marker.x), z = tz(marker.z);
      const pulse = 1 + Math.sin(performance.now() / 260) * 0.18;
      ctx.save();
      ctx.translate(x, z);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = '#ffc24a';
      ctx.beginPath();
      ctx.moveTo(0, -6); ctx.lineTo(6, 0); ctx.lineTo(0, 6); ctx.lineTo(-6, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // PSD units.
    for (const u of G.police?.units ?? []) {
      ctx.fillStyle = '#ff4a5a';
      ctx.beginPath();
      ctx.arc(tx(u.car.pos.x), tz(u.car.pos.z), 2.6, 0, TAU);
      ctx.fill();
    }

    // Traffic, faint.
    ctx.fillStyle = 'rgba(230,225,240,0.55)';
    for (const car of G.traffic?.list ?? []) {
      ctx.fillRect(tx(car.vehicle.pos.x) - 1, tz(car.vehicle.pos.z) - 1, 2, 2);
    }

    // Player arrow.
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(-p.heading + Math.PI);
    ctx.fillStyle = '#43e8ff';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();

    // Rim.
    ctx.strokeStyle = 'rgba(255,226,180,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(half, half, half - 1, 0, TAU);
    ctx.stroke();
  }
}
