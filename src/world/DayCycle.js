// THE DAY — GAME_DESIGN.md §2
//
// A day is five real minutes, then night falls and stays until you sleep. §2 is
// explicit that night is untimed: the day is the pressure, the night is where
// you spend what the day earned.
//
// The night rooms (goat room, clothing rack, recipe book) do not exist yet, so
// tonight is only the walk back to the table and a decision to end it. The
// phase machine is built for the rooms anyway — when they arrive they hang off
// `phase === 'night'` and nothing here has to change.
//
// This module owns TIME and nothing else. It does not touch the sky, the
// rabbits or the HUD; it publishes `dusk`, `phase` and `day`, and main.js wires
// those to whatever cares.

export const DAY = {
  length: 300,        // §2: five real minutes
  duskFrom: 0.78,     // the last ~65s of the day drain the light
  duskFloor: 0.12,    // how much daylight is left when night lands, 0..1
  nightDusk: 1,       // night sits at full dusk
};

export class DayCycle {
  constructor(day = 1) {
    this.day = day;
    this.t = 0;                 // seconds elapsed in the current day
    this.phase = 'day';         // 'day' | 'night'
    this.onNightfall = null;    // () => void, once per day
    this.onWake = null;         // (day) => void, after sleeping
  }

  get remaining() { return Math.max(0, DAY.length - this.t); }
  get isNight() { return this.phase === 'night'; }

  // 0 at high noon, 1 at full dark. Drives the sky, and nothing else should
  // read the raw timer to decide how dark it is.
  get dusk() {
    if (this.phase === 'night') return DAY.nightDusk;
    const p = this.t / DAY.length;
    if (p < DAY.duskFrom) return 0;
    const k = (p - DAY.duskFrom) / (1 - DAY.duskFrom);   // 0..1 across the tail
    return (1 - DAY.duskFloor) * k * k;                   // quadratic: it goes suddenly
  }

  // mm:ss of daylight left, for the HUD.
  get clock() {
    if (this.phase === 'night') return 'NIGHT';
    const s = Math.ceil(this.remaining);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  update(dt) {
    if (this.phase !== 'day') return;
    this.t += dt;
    if (this.t >= DAY.length) {
      this.t = DAY.length;
      this.phase = 'night';
      this.onNightfall?.();
    }
  }

  // Only legal at night. Returns the new day number, or 0 if it was refused —
  // the caller uses that to deny rather than having to re-check the phase.
  sleep() {
    if (this.phase !== 'night') return 0;
    this.day++;
    this.t = 0;
    this.phase = 'day';
    this.onWake?.(this.day);
    return this.day;
  }
}
