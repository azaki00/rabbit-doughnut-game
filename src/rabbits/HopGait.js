// Procedural saltation — GAME_DESIGN.md §5.1
//
// Rabbits do not run. They bound: the hind legs land OUTSIDE AND AHEAD of the
// front legs, the spine flexes and extends like a spring, and the body follows a
// ballistic arc between contacts.
//
//   0.00–0.12  hind plant      feet together, spine max flexion, body lowest
//   0.12–0.28  extension       spine snaps open, hind legs drive back, launch
//   0.28–0.62  flight          no contact, parabola, ears trail, legs tuck
//   0.62–0.78  fore plant      front feet land, one slightly before the other
//   0.78–1.00  gather          absorb, spine flexes, hind legs swing forward
//
// Direction changes commit ONLY at the hind plant. That single rule is what
// makes rabbits read as rabbits and what makes them learnably dodgeable.

const TAU = Math.PI * 2;
const D2R = Math.PI / 180;

// Airborne span. Leaves the ground partway through extension, lands at fore plant.
const FLIGHT_IN = 0.12, FLIGHT_OUT = 0.72;

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Piecewise keyframe curve over the cyclic phase, smoothstep-interpolated.
function curve(keys, p) {
  for (let i = 0; i < keys.length - 1; i++) {
    const [p0, v0] = keys[i], [p1, v1] = keys[i + 1];
    if (p >= p0 && p <= p1) {
      const t = smoothstep(p0, p1, p);
      return v0 + (v1 - v0) * t;
    }
  }
  return keys[keys.length - 1][1];
}

// Spine: max flexion (curled) at the hind plant, max extension in early flight.
const SPINE = [
  [0.00, -22], [0.06, -25], [0.30,  18], [0.62,   8], [0.78, -10], [1.00, -22],
];

// Hind legs: planted under the body, drive back through launch, tuck and swing
// forward during flight, reach out ahead of the fore legs to plant.
const HIND = [
  [0.00, -10], [0.12,  22], [0.28,  45], [0.50,   0], [0.72, -45], [0.88, -30], [1.00, -10],
];

// Fore legs: pushed off behind, tuck, then reach down and forward to catch.
const FORE = [
  [0.00,  30], [0.20,  40], [0.50,  10], [0.66, -32], [0.74, -12], [0.86,  14], [1.00,  30],
];

export class HopGait {
  constructor(seed = 0) {
    this.phase = Math.random();
    this.freq = 1.6;          // hops per second
    this.length = 0.35;       // metres per hop
    this.apex = 0.10;         // metres

    this.y = 0;
    this.spine = 0;
    this.hind = 0;
    this.fore = 0;
    this.foreSkew = 0.035 + (seed % 7) * 0.004;   // fore feet land asymmetrically
    this.squash = 1;
    this.airborne = false;
    this.vy = 0;              // vertical velocity, feeds the ear springs

    this.onPlant = null;      // fired at the hind plant — the AI's decision point
    this._prev = this.phase;
  }

  // Map ground speed onto the gait. Faster means LONGER hops more than faster
  // hops — a panicked rabbit covers ground by extending its bound, not by
  // spinning its legs.
  setSpeed(speed, profile) {
    const s = Math.max(0, speed);
    const t = Math.min(1, s / profile.panicSpeed);

    this.length = 0.35 + (profile.hopLength - 0.35) * Math.pow(t, 0.62);
    this.freq = this.length > 0.001 ? s / this.length : profile.idleFreq;
    this.freq = Math.max(profile.idleFreq * 0.35, Math.min(profile.panicFreq, this.freq));
    this.apex = 0.10 + 0.34 * Math.pow(t, 0.8);
  }

  update(dt) {
    this._prev = this.phase;
    this.phase = (this.phase + this.freq * dt) % 1;

    // wrapped past 0 → the hind feet just planted
    if (this.phase < this._prev) this.onPlant?.();

    const p = this.phase;

    // ── ballistic vertical ──
    const prevY = this.y;
    if (p >= FLIGHT_IN && p <= FLIGHT_OUT) {
      const t = (p - FLIGHT_IN) / (FLIGHT_OUT - FLIGHT_IN);
      this.y = this.apex * 4 * t * (1 - t);
      this.airborne = true;
    } else {
      this.y = 0;
      this.airborne = false;
    }
    this.vy = dt > 0 ? (this.y - prevY) / dt : 0;

    // ── spine drives everything else ──
    this.spine = curve(SPINE, p) * D2R;
    this.hind  = curve(HIND,  p) * D2R;
    this.fore  = curve(FORE,  p) * D2R;

    // ── landing squash: 0.86 for ~90ms on the hind plant ──
    const squashWin = 0.09 * this.freq;   // 90ms expressed in phase units
    if (p < squashWin) {
      const t = p / squashWin;
      this.squash = 0.86 + 0.14 * (t * t);
    } else if (p > 0.66 && p < 0.66 + squashWin) {
      // softer absorb on the fore plant
      const t = (p - 0.66) / squashWin;
      this.squash = 0.93 + 0.07 * (t * t);
    } else {
      this.squash = 1;
    }
  }

  // Phase of the trailing fore foot, so the two front feet don't land together.
  get forePhaseR() { return (this.phase + this.foreSkew) % 1; }
  get foreR() { return curve(FORE, this.forePhaseR) * D2R; }
}

export { TAU };
