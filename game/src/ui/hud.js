// NEON PALMS — the HUD. Every panel is a DOM node updated from here: stars, cash,
// scanner feed, objective card, dialogue with a drawn portrait, speedo and the
// radar. Text updates are throttled to 8 Hz; the radar runs every frame.

import { RADIO, WEAPONS, UI } from '../core/config.js';
import { clamp, clock, money, mmss } from '../core/util.js';
import { Minimap } from './minimap.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor(G) {
    this.G = G;
    this.root = $('hud');
    this.el = {
      missionCard: $('mission-card'), missionTag: $('mission-tag'), missionStage: $('mission-stage'),
      missionTitle: $('mission-title'), missionObjective: $('mission-objective'),
      missionProgress: $('mission-progress'), missionTimer: $('mission-timer'), missionDistance: $('mission-distance'),
      stars: $('stars'), wantedLabel: $('wanted-label'),
      clock: $('clock'), district: $('district'), cash: $('cash'), weapon: $('weapon'), respect: $('respect-bar'),
      scannerUnits: $('scanner-units'), scannerList: $('scanner-list'),
      healthBar: $('health-bar'), healthNum: $('health-num'), armorBar: $('armor-bar'), armorNum: $('armor-num'),
      speed: $('speed'), gear: $('gear'), vehicleName: $('vehicle-name'), conditionBar: $('condition-bar'),
      radioStation: $('radio-station'), radioTrack: $('radio-track'),
      dialogue: $('dialogue'), dialogueSpeaker: $('dialogue-speaker'), dialogueText: $('dialogue-text'), portrait: $('portrait'),
      toasts: $('toasts'), crosshair: $('crosshair'), hint: $('hint'), mmZone: $('mm-zone'),
    };
    this.minimap = new Minimap($('minimap'));
    this.stars = [];
    for (let i = 0; i < 5; i++) {
      const s = document.createElement('i');
      this.el.stars.appendChild(s);
      this.stars.push(s);
    }
    this.hurtEl = document.createElement('div');
    Object.assign(this.hurtEl.style, {
      position: 'absolute', inset: '0', pointerEvents: 'none', opacity: '0',
      background: 'radial-gradient(120% 90% at 50% 50%, rgba(180,10,20,0) 35%, rgba(180,10,20,0.55) 100%)',
      transition: 'opacity 90ms linear', zIndex: '4',
    });
    document.getElementById('app').appendChild(this.hurtEl);
    this.hurtTimer = 0;
    this.last = 0;
    this.portraits = new Map();
    this.currentWanted = -1;
    this.objectiveShown = false;
  }

  show() { this.root.classList.remove('hidden'); }
  hide() { this.root.classList.add('hidden'); }

  toast(text, kind = '') {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    this.el.toasts.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity 320ms, transform 320ms';
      el.style.opacity = '0';
      el.style.transform = 'translateX(10px)';
      setTimeout(() => el.remove(), 340);
    }, 3200);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
  }

  setMoney(v) { this.el.cash.textContent = money(v); }

  setRespect(v) { this.el.respect.style.width = `${clamp(v, 0, 100)}%`; }

  setWanted(n) {
    if (n === this.currentWanted) return;
    this.currentWanted = n;
    this.stars.forEach((s, i) => {
      s.className = i < n ? (n >= 4 ? 'on hot' : 'on') : '';
    });
    const label = n === 0 ? 'CLEAR' : n === 1 ? 'PATROL ALERT' : n === 2 ? 'RESPONSE' : n === 3 ? 'PURSUING' : n === 4 ? 'LOCKDOWN' : 'CITYWIDE';
    this.el.wantedLabel.textContent = label;
    this.el.wantedLabel.classList.toggle('hot', n >= 2);
  }

  setObjective(title, objective, stage, total) {
    this.objectiveShown = true;
    this.el.missionCard.classList.remove('hidden');
    this.el.missionTitle.textContent = title;
    this.el.missionObjective.textContent = objective;
    this.el.missionStage.textContent = `${stage}/${total}`;
  }

  clearObjective() {
    this.objectiveShown = false;
    this.el.missionCard.classList.add('hidden');
  }

  showDialogue(speaker, text) {
    this.el.dialogue.classList.remove('hidden');
    this.el.dialogueSpeaker.textContent = speaker;
    this.el.dialogueText.textContent = text;
    this.drawPortrait(speaker);
  }

  hideDialogue() { this.el.dialogue.classList.add('hidden'); }

  /** A drawn portrait per speaker: face, hair, collar, in their own colours. */
  drawPortrait(name) {
    const canvas = this.el.portrait;
    const ctx = canvas.getContext('2d');
    let seed = 0;
    for (let i = 0; i < name.length; i++) seed = (seed * 31 + name.charCodeAt(i)) >>> 0;
    const hue = seed % 360;
    const skin = ['#d9a678', '#b87a4e', '#8a5a38', '#e8c39a'][seed % 4];
    const hair = ['#1a1512', '#3a2418', '#5a3a22', '#9a8a70'][(seed >> 3) % 4];
    const w = 96, h = 96;
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, `hsl(${hue}, 42%, 24%)`);
    bg.addColorStop(1, `hsl(${(hue + 40) % 360}, 46%, 12%)`);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Shoulders.
    ctx.fillStyle = `hsl(${(hue + 180) % 360}, 30%, 28%)`;
    ctx.beginPath();
    ctx.moveTo(8, h);
    ctx.quadraticCurveTo(48, 60, 88, h);
    ctx.closePath();
    ctx.fill();

    // Neck and head.
    ctx.fillStyle = skin;
    ctx.fillRect(40, 58, 16, 16);
    ctx.beginPath();
    ctx.ellipse(48, 44, 21, 24, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hair.
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.ellipse(48, 32, 22, 17, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(26, 30, 6, 16);
    ctx.fillRect(64, 30, 6, 16);

    // Eyes and mouth.
    ctx.fillStyle = '#20181a';
    ctx.fillRect(39, 43, 4, 3);
    ctx.fillRect(53, 43, 4, 3);
    ctx.strokeStyle = 'rgba(60,30,30,0.7)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(42, 57);
    ctx.quadraticCurveTo(48, 60, 54, 57);
    ctx.stroke();

    // Frame light.
    const glow = ctx.createRadialGradient(48, 30, 4, 48, 48, 70);
    glow.addColorStop(0, 'rgba(255,220,180,0.12)');
    glow.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }

  hurt() {
    this.hurtTimer = 0.35;
  }

  setCrosshair(on) { this.el.crosshair.classList.toggle('hidden', !on); }

  update(dt, G) {
    this.minimap.draw(G);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    const lowHealth = G.player.health < 30 && !G.player.dead;
    this.hurtEl.style.opacity = String(clamp(this.hurtTimer * 2.2 + (lowHealth ? 0.35 + Math.sin(performance.now() / 260) * 0.12 : 0), 0, 1));

    this.last += dt;
    if (this.last < 0.12) return;
    this.last = 0;

    const p = G.player;
    this.el.clock.textContent = clock(G.state.hour);
    this.el.district.textContent = G.city.district(p.pos.x, p.pos.z);
    this.el.mmZone.textContent = G.city.district(p.pos.x, p.pos.z);

    const hp = Math.round(p.health);
    const armor = Math.round(p.armor);
    this.el.healthBar.style.width = `${hp}%`;
    this.el.healthNum.textContent = String(hp);
    this.el.armorBar.style.width = `${armor}%`;
    this.el.armorNum.textContent = String(armor);

    const w = p.weaponDef;
    const ammo = w.ammo === Infinity ? '∞' : (p.ammo[p.weapon] ?? 0);
    this.el.weapon.textContent = `${w.name} ${w.ammo === Infinity ? '' : ammo}`.trim();

    const car = p.vehicle;
    if (car) {
      const kmh = Math.round(Math.abs(car.speed) * 3.6);
      this.el.speed.textContent = String(kmh);
      const gear = car.speed < -0.4 ? 'R' : Math.abs(car.speed) < 0.4 ? 'N' : String(Math.min(6, 1 + Math.floor(Math.abs(car.speed) / (car.def.top / 6))));
      this.el.gear.textContent = gear;
      this.el.vehicleName.textContent = car.def.name;
      this.el.conditionBar.style.width = `${clamp(car.health, 0, 100)}%`;
    } else {
      this.el.speed.textContent = String(Math.round(p.speed * 3.6));
      this.el.gear.textContent = p.sprinting ? '»' : 'N';
      this.el.vehicleName.textContent = 'ON FOOT';
      this.el.conditionBar.style.width = '100%';
    }

    const station = RADIO[G.audio?.station ?? 0];
    this.el.radioStation.textContent = station.station;
    this.el.radioTrack.textContent = station.track;

    this.setWanted(G.police.wanted);

    const units = G.police.scanner;
    this.el.scannerUnits.textContent = units.length === 0 ? 'NO UNITS' : `${units.length} UNIT${units.length > 1 ? 'S' : ''}`;
    this.el.scannerList.innerHTML = units
      .map((u) => `<li class="${u.tactic === 'RAMMING' || u.tactic === 'MARKSMAN' ? 'hot' : ''}"><b>${u.name}</b><span>${u.tactic} · ${u.distance} m</span></li>`)
      .join('');

    const m = G.missions?.hud();
    if (m) {
      this.setObjective(m.title, m.objective, m.stage, m.total);
      this.el.missionProgress.style.width = `${clamp((m.progress ?? 0) * 100, 0, 100)}%`;
      this.el.missionTimer.textContent = m.timer ?? mmss(G.missions.stageTimer ?? 0);
      this.el.missionDistance.textContent = m.distance !== null && m.distance !== undefined ? `${Math.round(m.distance)} m` : (m.distanceLabel ?? '—');
    } else if (this.objectiveShown) {
      this.clearObjective();
    }
  }
}
