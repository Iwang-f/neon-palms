// NEON PALMS — one save slot in localStorage: cash, respect, which job is next,
// where Rafa is standing and what he is carrying. Written after every job and on
// demand from the pause menu.

import { SAVE_KEY, PLAYER } from '../core/config.js';

export class Save {
  constructor(G) {
    this.G = G;
    this.available = (() => {
      try {
        localStorage.setItem('__np_probe', '1');
        localStorage.removeItem('__np_probe');
        return true;
      } catch {
        return false;
      }
    })();
  }

  read() {
    if (!this.available) return null;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.version !== 1) return null;
      return data;
    } catch {
      return null;
    }
  }

  has() { return !!this.read(); }

  write() {
    if (!this.available) return;
    const G = this.G;
    const p = G.player;
    const data = {
      version: 1,
      savedAt: new Date().toISOString(),
      cash: G.economy?.cash ?? 0,
      respect: G.economy?.respect ?? 0,
      job: G.missions?.index ?? 0,
      completed: [...(G.missions?.completed ?? [])],
      health: p?.health ?? PLAYER.maxHealth,
      armor: p?.armor ?? 0,
      weapon: p?.weapon ?? 'pistol',
      ammo: p?.ammo ?? {},
      x: p?.pos.x ?? 0,
      z: p?.pos.z ?? 0,
      hour: G.state?.hour ?? 18.5,
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* full or blocked */ }
  }

  load() {
    const data = this.read();
    if (!data) return false;
    const G = this.G;
    if (G.economy) {
      G.economy.cash = data.cash ?? 0;
      G.economy.respect = data.respect ?? 0;
    }
    if (G.player) {
      G.player.respawn(data.x ?? -360, data.z ?? 6);
      G.player.health = data.health ?? PLAYER.maxHealth;
      G.player.armor = data.armor ?? 0;
      G.player.weapon = data.weapon ?? 'pistol';
      G.player.ammo = { pistol: 60, smg: 0, shotgun: 0, ...(data.ammo ?? {}) };
      G.player.gun.visible = G.player.weapon !== 'fists';
    }
    if (G.missions) {
      G.missions.index = Math.min(data.job ?? 0, 5);
      G.missions.completed = new Set(data.completed ?? []);
    }
    if (G.state && data.hour !== undefined) G.state.hour = data.hour;
    return true;
  }

  clear() {
    if (!this.available) return;
    try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  }
}
