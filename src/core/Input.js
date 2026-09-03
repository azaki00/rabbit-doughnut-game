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
  Tab: 'inventory',
  Digit1: 'slot1',
  Digit2: 'slot2',
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
      this.locked = document.pointerLockElement === this.canvas;
      document.body.classList.toggle('playing', this.locked);
      if (!this.locked) { this.releaseAll(); this.onUnlock?.(); }
    });

    addEventListener('mousemove', e => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
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

  lock() { this.canvas.requestPointerLock?.(); }

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
