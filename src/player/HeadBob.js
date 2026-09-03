// Head bob — GAME_DESIGN.md §3.2
//
// Driven by ACCUMULATED DISTANCE, not by elapsed time. That is the whole trick:
// a time-driven bob keeps oscillating after the player stops and drifts out of
// step with the footfalls. A distance-driven phase freezes the instant you stop
// and resumes exactly where it left off.

const PROFILE = {
  walk:   { freq: 1.15, ampY: 0.045, ampX: 0.035 },
  sprint: { freq: 1.55, ampY: 0.075, ampX: 0.055 },
  crouch: { freq: 0.85, ampY: 0.025, ampX: 0.020 },
};

export class HeadBob {
  constructor() {
    this.phase = 0;
    this.offsetY = 0;
    this.offsetX = 0;
    this.roll = 0;

    // one-shot landing dip
    this.dip = 0;
    this.dipVel = 0;

    // smoothed so a profile change (walk→sprint) doesn't pop
    this._freq = PROFILE.walk.freq;
    this._ampY = PROFILE.walk.ampY;
    this._ampX = PROFILE.walk.ampX;

    this.onFootfall = null;
    this._lastFoot = 0;
    this.scale = 1;              // settings: head bob intensity
  }

  land(impactSpeed) {
    // 0.12 m at terminal-ish impact, scaled by how hard we hit
    const k = Math.min(1, impactSpeed / 12);
    this.dipVel -= 0.55 * k;
  }

  update(dt, { speed, grounded, sprinting, crouching, maxSpeed }) {
    const p = crouching ? PROFILE.crouch : sprinting ? PROFILE.sprint : PROFILE.walk;

    // ease profile params so transitions are smooth
    const k = 1 - Math.exp(-10 * dt);
    this._freq += (p.freq - this._freq) * k;
    this._ampY += (p.ampY - this._ampY) * k;
    this._ampX += (p.ampX - this._ampX) * k;

    const ratio = maxSpeed > 0 ? Math.min(1, speed / maxSpeed) : 0;

    if (grounded && speed > 0.3) {
      this.phase += speed * dt;
    } else {
      // airborne or standing — decay the bob out rather than freezing mid-swing
      this.offsetY *= 1 - Math.min(1, 8 * dt);
      this.offsetX *= 1 - Math.min(1, 8 * dt);
      this.roll     *= 1 - Math.min(1, 8 * dt);
      this._integrateDip(dt);
      return;
    }

    const f = this._freq;
    this.offsetY = Math.sin(this.phase * 2.0 * f) * this._ampY * ratio * this.scale;
    this.offsetX = Math.sin(this.phase * 1.0 * f) * this._ampX * ratio * this.scale;
    this.roll    = -this.offsetX * 0.06;

    // footfall fires at the bottom of each vertical cycle (twice per stride)
    const foot = Math.floor(this.phase * 2.0 * f / Math.PI);
    if (foot !== this._lastFoot) {
      this._lastFoot = foot;
      this.onFootfall?.(ratio);
    }

    this._integrateDip(dt);
  }

  // critically-damped spring back to zero
  _integrateDip(dt) {
    const stiff = 190, damp = 22;
    this.dipVel += (-stiff * this.dip - damp * this.dipVel) * dt;
    this.dip    += this.dipVel * dt;
    if (this.dip < -0.22) { this.dip = -0.22; this.dipVel = 0; }
  }

  get y() { return this.offsetY + this.dip; }
  get x() { return this.offsetX; }
}
