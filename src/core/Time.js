// Fixed-timestep accumulator.
// Physics and the hop gait run at a locked 60 Hz so the saltation cycle is
// frame-rate independent; rendering interpolates between the last two states.

export const FIXED_DT = 1 / 60;
const MAX_STEPS = 5;          // clamp so a tab-switch stall can't death-spiral

export class Time {
  constructor() {
    this.acc = 0;
    this.last = performance.now() / 1000;
    this.elapsed = 0;          // total simulated seconds
    this.alpha = 0;            // render interpolation factor [0,1)
    this.frameDt = 0;          // real wall-clock delta, for UI easing only
  }

  // Calls step(FIXED_DT) zero or more times, then returns.
  tick(step) {
    const now = performance.now() / 1000;
    let dt = now - this.last;
    this.last = now;

    if (dt > 0.25) dt = 0.25;  // paused tab / breakpoint guard
    this.frameDt = dt;
    this.acc += dt;

    let n = 0;
    while (this.acc >= FIXED_DT && n < MAX_STEPS) {
      step(FIXED_DT);
      this.acc -= FIXED_DT;
      this.elapsed += FIXED_DT;
      n++;
    }
    if (n === MAX_STEPS) this.acc = 0;   // gave up catching up; drop the debt

    this.alpha = this.acc / FIXED_DT;
  }
}
