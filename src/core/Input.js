// Pointer lock + action map.
// Everything downstream reads actions, never raw key codes.

const BINDS = {
  KeyW: 'fwd',   ArrowUp:    'fwd',
  KeyS: 'back',  ArrowDown:  'back',
  KeyA: 'left',  ArrowLeft:  'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  ControlLeft: 'crouch', ControlRight: 'crouch', KeyC: 'crouch',
  Space: 'jump',
  KeyE: 'interact',
  KeyF: 'eatRaw',
  KeyR: 'reload',
  KeyQ: 'swapWeapon',
  KeyG: 'dropCarrot',
  Tab: 'inventory',
  Digit1: 'slot1',
  Digit2: 'slot2',
  Digit3: 'slot3',
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.actions = Object.create(null);   // held state
    this.pressed = Object.create(null);   // edge, cleared each fixed step
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.lmb = false;
    this.lmbDown = false;                 // edge
    this.lmbUp = false;                   // edge
    this.rmb = false;
    this.locked = false;
    this.sensitivity = 0.0022;
    this._freshLock = 0;        // frames to ignore after (re)acquiring the lock
    this._lastLockAttempt = 0;

    addEventListener('keydown', e => {
      const a = BINDS[e.code];
      if (a) {
        if (!this.actions[a]) this.pressed[a] = true;
        this.actions[a] = true;
        if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
      }
      if (e.code === 'F1') { e.preventDefault(); this.onToggleDebug?.(); }
    });

    addEventListener('keyup', e => {
      const a = BINDS[e.code];
      if (a) this.actions[a] = false;
    });

    // Losing focus must not leave keys stuck down.
    addEventListener('blur', () => this.releaseAll());

    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === this.canvas;
      document.body.classList.toggle('playing', this.locked);
      if (this.locked && !was) {
        // Chrome reports a huge movementX/Y on the first event after the lock
        // is (re)acquired — the delta since the cursor was last seen. Applying
        // it snaps the view hard to one side. Drop the first couple of events.
        this._freshLock = 2;
        this.mouseDX = this.mouseDY = 0;
      }
      if (!this.locked) { this.releaseAll(); this.onUnlock?.(); }
    });

    addEventListener('mousemove', e => {
      if (!this.locked) return;

      if (this._freshLock > 0) { this._freshLock--; return; }

      // Spike guard. A single real mouse movement is never hundreds of pixels;
      // values that large come from lock transitions, alt-tab, or a stalled
      // frame dumping a batch of coalesced events. Clamping keeps one bad
      // event from whipping the camera around.
      const MAX = 180;
      let dx = e.movementX, dy = e.movementY;
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
      if (Math.abs(dx) > MAX || Math.abs(dy) > MAX) {
        dx = Math.max(-MAX, Math.min(MAX, dx));
        dy = Math.max(-MAX, Math.min(MAX, dy));
      }
      this.mouseDX += dx;
      this.mouseDY += dy;
    });

    canvas.addEventListener('mousedown', e => {
      if (!this.locked) return;
      if (e.button === 0) { this.lmb = true; this.lmbDown = true; }
      if (e.button === 2) this.rmb = true;
    });
    addEventListener('mouseup', e => {
      if (e.button === 0 && this.lmb) { this.lmb = false; this.lmbUp = true; }
      if (e.button === 2) this.rmb = false;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  // Re-acquiring the lock right after the user pressed Esc is refused
  // ("cannot be acquired immediately after the user has exited the lock"), and
  // firing several requests in quick succession trips a separate "too many
  // pointer lock requests" limiter. So: rate-limit ourselves, make ONE attempt,
  // and report success so the caller can leave a clickable surface up.
  async lock() {
    if (this.locked) return true;

    const now = performance.now();
    if (now - this._lastLockAttempt < 700) return false;
    this._lastLockAttempt = now;

    // unadjustedMovement bypasses OS mouse acceleration, which makes aiming
    // consistent; not every browser accepts the option.
    try {
      const r = this.canvas.requestPointerLock?.({ unadjustedMovement: true });
      if (r?.then) await r;
      return true;
    } catch {
      try {
        const r = this.canvas.requestPointerLock?.();
        if (r?.then) await r;
        return true;
      } catch {
        return false;
      }
    }
  }

  releaseAll() {
    for (const k in this.actions) this.actions[k] = false;
    this.lmb = this.rmb = false;
  }

  down(a)  { return !!this.actions[a]; }
  hit(a)   { return !!this.pressed[a]; }

  // Consume per-frame edges and accumulated mouse delta.
  endStep() {
    this.pressed = Object.create(null);
    this.lmbDown = this.lmbUp = false;
    this.mouseDX = this.mouseDY = 0;
  }
}
