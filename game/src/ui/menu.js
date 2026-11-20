// NEON PALMS — the title, pause and end screens, and the job list. Pure DOM: the
// 3D scene keeps rendering behind the title so the city sells itself before you
// press anything.

import { STORY } from '../systems/missions.js';
import { money } from '../core/util.js';

const $ = (id) => document.getElementById(id);

export class Menu {
  constructor(G) {
    this.G = G;
    this.title = $('title');
    this.pause = $('pause');
    this.overlay = $('overlay');
    this.pauseGrid = $('pause-grid');
    this.handlers = {};
    $('btn-new').addEventListener('click', () => this.act('new'));
    $('btn-continue').addEventListener('click', () => this.act('continue'));
    $('btn-missions').addEventListener('click', () => this.act('missions'));
    $('btn-resume').addEventListener('click', () => this.act('resume'));
    $('btn-save').addEventListener('click', () => this.act('save'));
    $('btn-quit').addEventListener('click', () => this.act('quit'));
    $('btn-retry').addEventListener('click', () => this.act('retry'));
    $('btn-hospital').addEventListener('click', () => this.act('hospital'));
  }

  on(name, fn) { this.handlers[name] = fn; }
  act(name) { this.G.audio?.start(); this.G.audio?.ui(); this.handlers[name]?.(); }

  showTitle() {
    this.title.classList.remove('hidden');
    this.pause.classList.add('hidden');
    this.overlay.classList.add('hidden');
    const save = this.G.save?.read();
    const btn = $('btn-continue');
    btn.disabled = !save;
    btn.textContent = save ? `CONTINUE · JOB ${Math.min(6, (save.job ?? 0) + 1)}` : 'CONTINUE';
  }

  hideTitle() { this.title.classList.add('hidden'); }

  showPause() {
    this.pause.classList.remove('hidden');
    const G = this.G;
    const stats = [
      ['CASH', money(G.economy.cash)],
      ['RESPECT', `${Math.round(G.economy.respect)}%`],
      ['JOBS DONE', `${G.missions.completed.size}/${STORY.length}`],
      ['DISTRICT', G.city.district(G.player.pos.x, G.player.pos.z)],
      ['WANTED', G.police.wanted === 0 ? 'CLEAR' : `${G.police.wanted} STAR`],
      ['CLOCK', G.hud.el.clock.textContent],
    ];
    this.pauseGrid.innerHTML = stats.map(([k, v]) => `<div class="stat"><span>${k}</span><strong>${v}</strong></div>`).join('');
  }

  hidePause() { this.pause.classList.add('hidden'); }

  showOverlay(kind, stats = []) {
    this.overlay.classList.remove('hidden');
    const title = $('overlay-title');
    const sub = $('overlay-sub');
    if (kind === 'busted') {
      title.textContent = 'BUSTED';
      sub.textContent = 'The PSD have your name and your keys.';
    } else if (kind === 'wasted') {
      title.textContent = 'WASTED';
      sub.textContent = 'The city wins this round.';
    } else {
      title.textContent = 'STORY COMPLETE';
      sub.textContent = 'Six jobs. One city. Nobody left to owe.';
    }
    $('overlay-stats').innerHTML = stats.map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join('');
  }

  hideOverlay() { this.overlay.classList.add('hidden'); }

  /** The job list, used both for the title's MISSIONS button and after a wipe. */
  jobList(selectable = true) {
    const G = this.G;
    const list = STORY.map((job, i) => {
      const done = G.missions.completed.has(job.id);
      const locked = i > G.missions.index;
      return { i, job, done, locked };
    });
    return list;
  }
}
