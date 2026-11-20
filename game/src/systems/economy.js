// NEON PALMS — money and reputation. Cash buys ammo and resprays; respect is the
// story's own scoreboard and gates nothing but pride.

import { ECONOMY } from '../core/config.js';
import { clamp } from '../core/util.js';

export class Economy {
  constructor(G) {
    this.G = G;
    this.cash = ECONOMY.startCash;
    this.respect = ECONOMY.startRespect;
    this.earned = 0;
    this.spent = 0;
  }

  add(amount) {
    this.cash += amount;
    this.earned += Math.max(0, amount);
    this.G.hud?.setMoney(this.cash);
    this.G.save?.write();
  }

  spend(amount) {
    if (this.cash < amount) return false;
    this.cash -= amount;
    this.spent += amount;
    this.G.hud?.setMoney(this.cash);
    return true;
  }

  reward(cash, respect) {
    this.cash += cash;
    this.earned += cash;
    this.respect = clamp(this.respect + respect, 0, 100);
    this.G.hud?.setMoney(this.cash);
    this.G.hud?.setRespect(this.respect);
    this.G.audio?.cash();
  }

  /** Respray at the garage: clears the wanted level for a fee. */
  respray() {
    if (!this.spend(ECONOMY.sprayCost)) {
      this.G.hud?.toast('NOT ENOUGH CASH FOR A RESPAY', 'alert');
      return false;
    }
    this.G.police.setWanted(0);
    this.G.hud?.toast('RESPAY DONE — PLATES CHANGED', 'cash');
    return true;
  }
}
