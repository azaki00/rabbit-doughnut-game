// Stamina — GAME_DESIGN.md §3.3
// The pacing mechanism of the whole hunt: rabbits outpace a walk and lose to a
// sprint, so you can catch anything but not everything.

export const STAM = {
  max: 100,
  sprintDrain: 18,
  lungeCost: 22,
  jumpCost: 8,
  regen: 14,
  regenDelay: 0.9,
  secondWind: 30,   // must climb back to this before sprinting unlocks
};

export class Stamina {
  constructor() {
    this.value = STAM.max;
    this.cooldown = 0;
    this.exhausted = false;
  }

  get ratio() { return this.value / STAM.max; }
  get canSprint() { return !this.exhausted && this.value > 0.5; }
  get canLunge()  { return this.value >= STAM.lungeCost * 0.5; }

  spend(amount) {
    this.value = Math.max(0, this.value - amount);
    this.cooldown = STAM.regenDelay;
    if (this.value <= 0) this.exhausted = true;
  }

  update(dt, sprinting) {
    if (sprinting) {
      this.spend(STAM.sprintDrain * dt);
      return;
    }
    if (this.cooldown > 0) { this.cooldown -= dt; return; }

    this.value = Math.min(STAM.max, this.value + STAM.regen * dt);
    if (this.exhausted && this.value >= STAM.secondWind) this.exhausted = false;
  }
}
