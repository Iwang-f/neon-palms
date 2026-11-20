// NEON PALMS — sound, all synthesised at runtime: an engine that follows the
// throttle, a two-tone siren, gunshots and impacts from noise bursts, and four
// original radio loops (bass, pad, arpeggio and drums) written as note tables.

import { RADIO } from '../core/config.js';
import { clamp } from '../core/util.js';

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

// A minor, the city's key: Am – F – C – G, one bar each.
const PROGRESSION = [
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [48, 52, 55], // C
  [55, 59, 62], // G
];

const STATION_SOUND = [
  { bpm: 92, arp: 0.5, pad: 0.5, hats: 0.35, bass: 0.7 },
  { bpm: 104, arp: 0.7, pad: 0.4, hats: 0.55, bass: 0.8 },
  { bpm: 120, arp: 0.3, pad: 0.7, hats: 0.45, bass: 0.9 },
  { bpm: 80, arp: 0.35, pad: 0.75, hats: 0.2, bass: 0.55 },
];

export class Audio {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.muted = false;
    this.station = 0;
    this.step = 0;
    this.nextNoteTime = 0;
    this.timer = null;
    this.engine = null;
    this.sirenNode = null;
    this.sirenOn = false;
    this.skidOn = false;
    this.masterVolume = 0.75;
  }

  /** Called on the first key or click: browsers require a gesture. */
  start() {
    if (this.started) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.started = true;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.masterVolume;
    this.master.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.32;
    this.musicBus.connect(this.master);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.75;
    this.sfxBus.connect(this.master);
    this.noise = this._noiseBuffer();
    this._buildEngine();
    this._buildSiren();
    this._scheduleMusic();
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.masterVolume;
    return this.muted;
  }

  _noiseBuffer() {
    const len = this.ctx.sampleRate * 1.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ---- continuous voices ---------------------------------------------------

  _buildEngine() {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 4;
    const oscA = ctx.createOscillator();
    oscA.type = 'sawtooth';
    oscA.frequency.value = 60;
    const oscB = ctx.createOscillator();
    oscB.type = 'square';
    oscB.frequency.value = 90;
    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    oscA.start();
    oscB.start();
    this.engine = { gain, filter, oscA, oscB };
  }

  /** speed in m/s; throttle 0..1; null when on foot. */
  setEngine(speed, throttle) {
    if (!this.engine) return;
    const t = this.ctx.currentTime;
    const on = speed !== null;
    const s = on ? clamp(Math.abs(speed) / 40, 0, 1) : 0;
    this.engine.gain.gain.setTargetAtTime(on ? 0.05 + s * 0.1 : 0, t, 0.12);
    this.engine.oscA.frequency.setTargetAtTime(46 + s * 120, t, 0.08);
    this.engine.oscB.frequency.setTargetAtTime(70 + s * 190, t, 0.08);
    this.engine.filter.frequency.setTargetAtTime(320 + s * 1600 + (throttle ?? 0) * 500, t, 0.1);
  }

  _buildSiren() {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 700;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.42;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start();
    lfo.start();
    this.sirenNode = { gain, osc };
  }

  siren(on) {
    this.sirenOn = on;
    if (!this.sirenNode) return;
    this.sirenNode.gain.gain.setTargetAtTime(on ? 0.035 : 0, this.ctx.currentTime, 0.4);
  }

  // ---- one-shots -----------------------------------------------------------

  _burst(duration, freq, type = 'bandpass', gainValue = 0.5, q = 1) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(gainValue, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    src.start(t);
    src.stop(t + duration + 0.02);
  }

  _tone(freq, duration, type = 'sine', gainValue = 0.2, slide = 0) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + duration);
    gain.gain.setValueAtTime(gainValue, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  shot(x, z, weapon = 'pistol') {
    if (!this.started) return;
    const d = this._distance(x, z);
    const g = clamp(1 - d / 90, 0, 1) * (weapon === 'shotgun' ? 0.9 : 0.6);
    if (g <= 0.01) return;
    this._burst(weapon === 'shotgun' ? 0.32 : 0.16, weapon === 'shotgun' ? 900 : 1600, 'bandpass', g, 0.8);
    this._tone(weapon === 'shotgun' ? 90 : 150, 0.12, 'square', g * 0.25, -60);
  }

  hit() { if (this.started) this._burst(0.18, 300, 'lowpass', 0.5, 1); }
  skid(on) {
    if (!this.started) return;
    if (on === this.skidOn) return;
    this.skidOn = on;
    if (on) this._burst(0.5, 2200, 'highpass', 0.12, 0.7);
  }
  pickup() { if (this.started) { this._tone(880, 0.12, 'triangle', 0.18); this._tone(1320, 0.18, 'triangle', 0.12); } }
  cash() { if (this.started) { this._tone(660, 0.1, 'square', 0.12); this._tone(990, 0.16, 'square', 0.1); } }
  confirm() { if (this.started) { this._tone(520, 0.1, 'sine', 0.14); this._tone(780, 0.2, 'sine', 0.12); } }
  hurt() { if (this.started) this._burst(0.12, 180, 'lowpass', 0.35, 1); }
  explode() {
    if (!this.started) return;
    this._burst(0.9, 180, 'lowpass', 0.9, 0.8);
    this._tone(60, 0.7, 'sine', 0.4, -30);
  }
  ui() { if (this.started) this._tone(440, 0.06, 'square', 0.08); }

  _distance(x, z) {
    const p = window.__np?.G?.player;
    if (!p) return 0;
    return Math.hypot(p.pos.x - x, p.pos.z - z);
  }

  // ---- radio ---------------------------------------------------------------

  setStation(index) {
    this.station = ((index % RADIO.length) + RADIO.length) % RADIO.length;
    this.step = 0;
    return RADIO[this.station];
  }

  _scheduleMusic() {
    if (this.timer) clearInterval(this.timer);
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this._pump(), 60);
  }

  _pump() {
    if (!this.ctx) return;
    const sound = STATION_SOUND[this.station];
    const spb = 60 / sound.bpm / 4; // sixteenth note
    while (this.nextNoteTime < this.ctx.currentTime + 0.2) {
      this._playStep(this.step, this.nextNoteTime, sound);
      this.step = (this.step + 1) % 64;
      this.nextNoteTime += spb;
    }
  }

  _playStep(step, time, sound) {
    const ctx = this.ctx;
    const bar = Math.floor(step / 16) % 4;
    const chord = PROGRESSION[bar];
    const beat = step % 16;
    const bus = this.musicBus;

    const voice = (freq, dur, type, gainValue, detune = 0) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(gainValue, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      osc.connect(gain);
      gain.connect(bus);
      osc.start(time);
      osc.stop(time + dur + 0.05);
    };

    // Bass: root on the beat, an octave lift on the "and" of three.
    if (beat % 4 === 0) voice(NOTE(chord[0] - 24), 0.34, 'sawtooth', 0.16 * sound.bass);
    if (beat === 14) voice(NOTE(chord[0] - 12), 0.16, 'square', 0.1 * sound.bass);

    // Pad: one long chord at the top of the bar.
    if (beat === 0) {
      for (const n of chord) {
        voice(NOTE(n), 2.2, 'sawtooth', 0.022 * sound.pad, -8);
        voice(NOTE(n), 2.2, 'sawtooth', 0.022 * sound.pad, 8);
      }
    }

    // Arpeggio: chord tones an octave up, moving in sixteenths.
    if (beat % 2 === 0) {
      const n = chord[(step / 2) % chord.length | 0] + 12;
      voice(NOTE(n), 0.16, 'triangle', 0.05 * sound.arp);
    }

    // Drums.
    if (beat === 0 || beat === 8) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(120, time);
      osc.frequency.exponentialRampToValueAtTime(42, time + 0.12);
      gain.gain.setValueAtTime(0.5, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
      osc.connect(gain);
      gain.connect(bus);
      osc.start(time);
      osc.stop(time + 0.24);
    }
    if (beat % 4 === 2) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 5000;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.16 * sound.hats, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(bus);
      src.start(time);
      src.stop(time + 0.08);
    }
  }
}
