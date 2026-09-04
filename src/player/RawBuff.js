// EATING IT RAW — GAME_DESIGN.md §13
//
// The only way to lose health outside the boss fight, and the only thing in the
// game that costs you something for a purely mechanical gain.
//
// This module owns the *timer and the numbers*, nothing else. It does not touch
// the controller, the glove or the canvas — it exposes multipliers and a level,
// and main.js applies them. That keeps it in line with every other system here:
// it can be deleted by removing its import and its update() call.
//
// §13 is explicit that the game never comments on this. So: no HUD tutorial, no
// warning prompt, no achievement. The prompt to eat says what it costs and
// nothing else, and the whispers are the only acknowledgement you ever get.

export const RAW = {
  duration: 45,        // seconds of buff, per §13
  cost: 35,            // HP for the first one
  costDoubling: 2,     // each further one WHILE BUFFED doubles the cost
  speed: 1.6,          // +60% move speed
  staminaDrain: 0.3,   // drain reduced by 70%
  lungeRange: 1.4,     // +40% reach
  fadeOut: 1.5,        // the hard cut to silence lasts this long before normal
};

export class RawBuff {
  constructor(sfx) {
    this.sfx = sfx;
    this.t = 0;              // seconds remaining
    this.stacks = 0;         // how many eaten during THIS buff
    this.eatenToday = 0;     // resets with the day; drives the whisper level
    this._voice = null;
    this._cutting = 0;       // the 1.5s of silence after it ends
  }

  get active() { return this.t > 0; }

  // 0..1, used for the screen desaturation so it eases rather than snapping.
  get intensity() {
    if (!this.active) return 0;
    // full for the body of it, easing off over the last two seconds
    return Math.min(1, this.t / 2);
  }

  // What it costs to eat one RIGHT NOW. Doubles per stack, per §13.
  costNow() {
    return RAW.cost * Math.pow(RAW.costDoubling, this.stacks);
  }

  // Returns the HP that should be taken, or 0 if it could not be eaten.
  // The caller owns health; this module does not know what health is.
  eat() {
    const cost = this.costNow();
    const extending = this.active;

    this.t = RAW.duration;               // extends rather than stacks duration
    this.stacks++;
    this.eatenToday++;

    // Restart the voice at the new level. Three in one day is the tell, and it
    // is the whisper level that tells you — nothing on screen does.
    this._voice?.stop();
    this._voice = this.sfx?.whispers?.(this.eatenToday) ?? null;
    if (!extending) this._cutting = 0;

    return cost;
  }

  // The day rolls over: the count resets, an active buff does not.
  newDay() { this.eatenToday = 0; }

  // Dying ends it outright — the buff must not survive the fifteen-second
  // WASTED hold and follow you into the cell, and the whispers must not still
  // be playing when you stand up.
  cancel() {
    this.t = 0;
    this.stacks = 0;
    this._voice?.stop();
    this._voice = null;
    this._cutting = 0;
  }

  update(dt) {
    if (this._cutting > 0) this._cutting = Math.max(0, this._cutting - dt);
    if (!this.active) return;

    this.t -= dt;
    if (this.t <= 0) {
      this.t = 0;
      this.stacks = 0;
      this._voice?.stop();          // hard cut, no release — §13
      this._voice = null;
      this._cutting = RAW.fadeOut;
    }
  }

  // True while the world should be silent after it ends.
  get cutting() { return this._cutting > 0; }

  // Multipliers main.js reads. They are 1 when inactive, so the call site needs
  // no branch.
  get speedMul()   { return this.active ? RAW.speed : 1; }
  get drainMul()   { return this.active ? RAW.staminaDrain : 1; }
  get reachMul()   { return this.active ? RAW.lungeRange : 1; }
}
