import * as THREE from 'three';
import { LAYER_VIEWMODEL } from '../core/Engine.js';
import { STAM } from './Stamina.js';
import { loadModel } from '../world/Loaders.js';
import { applySkinTo } from '../economy/applySkin.js';

// The red glove — GAME_DESIGN.md §4
//
// Fixed inventory slot, never unequipped. The lunge grab is the entire skill
// expression of the game, so the numbers here are the ones worth tuning first.

export const LUNGE = {
  windMin: 0.15, windMax: 0.45,
  radiusMin: 1.35, radiusMax: 2.10,
  dashMin: 1.1,  dashMax: 2.4,
  dashDuration: 0.35,
  activeFrom: 0.10, activeTo: 0.28,   // grab hitbox live window, seconds into the dash
  coneH: 110 * Math.PI / 180,
  coneV: 50 * Math.PI / 180,
  recovery: 1.2,
  scareRadius: 12,
  fovPull: -4,
};

const S = { IDLE: 0, WIND: 1, DASH: 2, RECOVER: 3 };

export class Glove {
  constructor(engine, controller, audio) {
    this.engine = engine;
    this.ctrl = controller;
    this.audio = audio;

    this.state = S.IDLE;
    this.t = 0;
    this.reachMul = 1;   // external multiplier; see the raw-meat buff (§13)
    this.charge = 0;          // 0..1
    this.chargeSeconds = 0;
    this.didHit = false;
    this.clench = 0;          // 0..1 visual

    this.onGrab = null;       // (radius, origin, dir) => rabbit|null
    this.onScare = null;      // (origin, radius) => void

    this.root = new THREE.Group();
    this.engine.vmScene.add(this.root);
    this._build();
    this._loadReal();

    // viewmodel sway state
    this._swayX = 0; this._swayY = 0;
    this._lagX = 0;  this._lagY = 0;
  }

  // ── placeholder viewmodel ──
  // Replaced wholesale when the real glove model lands; the transform rig and
  // every animation hook below stay exactly as they are.
  _build() {
    const red   = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: .72, metalness: .05, flatShading: true });
    const cuff  = new THREE.MeshStandardMaterial({ color: 0x8e2a1e, roughness: .85, flatShading: true });

    this.hand = new THREE.Group();

    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.135, 0.055), red);
    palm.castShadow = false;
    this.hand.add(palm);

    const cuffMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.052, 0.075, 8), cuff);
    cuffMesh.position.y = -0.10;
    this.hand.add(cuffMesh);

    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.07, 0.036), red);
    thumb.position.set(-0.066, 0.012, 0.006);
    thumb.rotation.z = 0.5;
    this.hand.add(thumb);
    this.thumb = thumb;

    // four fingers on a pivot so they can curl into a grab
    this.fingers = new THREE.Group();
    this.fingers.position.set(0, 0.066, 0);
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.023, 0.082, 0.034), red);
      f.position.set(-0.036 + i * 0.024, 0.041, 0);
      this.fingers.add(f);
    }
    this.hand.add(this.fingers);

    this.hand.traverse(o => o.layers.set(LAYER_VIEWMODEL));
    this.root.add(this.hand);
    this.root.traverse(o => o.layers.set(LAYER_VIEWMODEL));

    this.root.scale.setScalar(0.78);
    // hand enters from the lower right, reaching forward and slightly inward
    this.restPos = new THREE.Vector3(0.30, -0.255, -0.40);
    this.restRot = new THREE.Euler(0.16, 0.16, 0.14);

    // Seat it at rest immediately. _animate only runs once the pointer is
    // locked, and without this the glove sits at the camera origin — inside the
    // near plane, invisible — until the first input frame.
    this.root.position.copy(this.restPos);
    this.root.rotation.copy(this.restRot);
  }

  // OBJECTS/Glove.fbx replaces the placeholder. The transform rig, the finger
  // curl target and every animation hook stay exactly as they are — if the real
  // model has no separable fingers we simply lose the curl, not the lunge.
  async _loadReal() {
    // 0.30 filled a third of the screen. A first-person hand wants to read at
    // roughly a fifth of frame height at this near distance.
    const m = await loadModel('OBJECTS/Glove.fbx', { height: 0.135 });
    if (!m) return;

    m.traverse(o => {
      o.layers.set(LAYER_VIEWMODEL);
      if (o.isMesh) {
        o.castShadow = false;
        o.material = new THREE.MeshStandardMaterial({
          color: 0xc0392b, roughness: 0.72, metalness: 0.05, flatShading: false,
        });
      }
    });

    this.root.remove(this.hand);
    // Glove.fbx is authored lying flat with the fingers pointing along +Z —
    // straight back at the camera. Yaw it 180 so it reaches INTO the scene.
    // Tuned against the live viewmodel; see restPos/restRot below for the cant.
    m.rotation.set(0, Math.PI, 0);
    this.hand = m;
    this.realGlove = m;
    this.root.add(m);

    // the placeholder's finger/thumb pivots are gone; keep the calls harmless
    this.fingers = this.fingers ?? new THREE.Group();
    this.thumb = this.thumb ?? new THREE.Group();
  }

  // Re-material for a skin — cosmetic only, never touches the numbers (§17.5).
  // The pattern and the wear both come from applySkinTo; see economy/Skins.js.
  applySkin(inst) {
    if (inst.collection && inst.collection !== 'glove') return;
    applySkinTo(this.hand, inst);
    this.hand?.traverse(o => o.layers.set(LAYER_VIEWMODEL));
    this.equipped = inst;
  }

  get charging() { return this.state === S.WIND; }
  get busy()     { return this.state !== S.IDLE; }

  update(dt, input) {
    switch (this.state) {
      case S.IDLE:
        if (input.lmbDown && this.ctrl.stamina.canLunge && this.ctrl.frozen <= 0) {
          this.state = S.WIND;
          this.chargeSeconds = 0;
          this.charge = 0;
          this.audio?.windUp();
        }
        break;

      case S.WIND:
        this.chargeSeconds += dt;
        this.charge = THREE.MathUtils.clamp(
          (this.chargeSeconds - LUNGE.windMin) / (LUNGE.windMax - LUNGE.windMin), 0, 1);
        if (!input.lmb) this._release();
        break;

      case S.DASH: {
        const prev = this.t;
        this.t += dt;
        // grab query fires once, on the frame the active window opens
        if (!this.didHit && prev < LUNGE.activeFrom && this.t >= LUNGE.activeFrom) {
          this._resolveGrab();
        }
        if (this.t >= LUNGE.dashDuration) {
          if (this.didHit) { this.state = S.IDLE; this.t = 0; }
          else this._whiff();
        }
        break;
      }

      case S.RECOVER:
        this.t -= dt;
        if (this.t <= 0) { this.state = S.IDLE; this.t = 0; }
        break;
    }

    this._animate(dt, input);
  }

  _release() {
    const c = this.charge;
    this.ctrl.stamina.spend(STAM.lungeCost);

    const dist = THREE.MathUtils.lerp(LUNGE.dashMin, LUNGE.dashMax, c);
    const dir = this.ctrl.flatForward;
    this.ctrl.dash(dir, dist / LUNGE.dashDuration, LUNGE.dashDuration);

    this.state = S.DASH;
    this.t = 0;
    this.didHit = false;
    this.audio?.lunge(c);
  }

  _resolveGrab() {
    const radius =
      THREE.MathUtils.lerp(LUNGE.radiusMin, LUNGE.radiusMax, this.charge) * this.reachMul;
    // Grab originates at the glove, not the camera — §4.1
    // Low: you are scooping a rabbit off the ground, so the reach starts at
    // roughly waist height, not at the chest.
    const origin = this.ctrl.pos.clone()
      .addScaledVector(this.ctrl.flatForward, 0.45)
      .setY(this.ctrl.pos.y - 0.95);

    const hit = this.onGrab?.(radius, origin, this.ctrl.forward);
    if (hit) {
      this.didHit = true;
      this.clench = 1;
      this.state = S.IDLE;
      this.t = 0;
    }
  }

  _whiff() {
    this.state = S.RECOVER;
    this.t = LUNGE.recovery;
    this.ctrl.stumble(LUNGE.recovery);
    this.audio?.whiff();
    this.onScare?.(this.ctrl.pos, LUNGE.scareRadius);
  }

  // ── viewmodel animation ──
  _animate(dt, input) {
    const k = 1 - Math.exp(-14 * dt);

    // sway: hand lags the look direction
    this._swayX += (-input.mouseDX * 0.0016 - this._swayX) * k;
    this._swayY += (-input.mouseDY * 0.0016 - this._swayY) * k;
    this._swayX = THREE.MathUtils.clamp(this._swayX, -0.09, 0.09);
    this._swayY = THREE.MathUtils.clamp(this._swayY, -0.09, 0.09);

    // bob inheritance — 0.6x amplitude, ~60ms lag (§3.2)
    const lagK = 1 - Math.exp(-16 * dt);
    this._lagX += (this.ctrl.bob.x * 0.6 - this._lagX) * lagK;
    this._lagY += (this.ctrl.bob.y * 0.6 - this._lagY) * lagK;

    let px = this.restPos.x + this._swayX + this._lagX;
    let py = this.restPos.y + this._swayY + this._lagY;
    let pz = this.restPos.z;
    let rx = this.restRot.x, ry = this.restRot.y, rz = this.restRot.z;

    // sprinting swings the glove wider across the lower-right
    if (this.ctrl.sprinting) {
      const s = Math.sin(this.ctrl.bob.phase * 3.1);
      px += 0.07 + s * 0.05;
      py -= 0.05;
      rz += 0.30 + s * 0.10;
      ry -= 0.22;
    }

    switch (this.state) {
      case S.WIND: {
        // pull back and cock the wrist; grows with charge
        const c = this.charge;
        px += 0.10 * c;
        py -= 0.05 * c;
        pz += 0.17 * c;
        rx -= 0.42 * c;
        rz += 0.30 * c;
        break;
      }
      case S.DASH: {
        // thrust forward hard, then settle
        const t = THREE.MathUtils.clamp(this.t / LUNGE.dashDuration, 0, 1);
        const thrust = Math.sin(Math.min(1, t * 1.7) * Math.PI);
        pz -= 0.46 * thrust;
        py += 0.10 * thrust;
        px -= 0.10 * thrust;
        rx += 0.34 * thrust;
        break;
      }
      case S.RECOVER: {
        // stumble: hand drops out of frame and flails back up
        const t = 1 - this.t / LUNGE.recovery;
        const drop = Math.sin(Math.min(1, t * 1.25) * Math.PI);
        py -= 0.30 * drop;
        rz -= 0.75 * drop;
        rx += 0.25 * drop;
        break;
      }
    }

    this.root.position.set(px, py, pz);
    this.root.rotation.set(rx, ry, rz);

    // finger curl
    this.clench = Math.max(0, this.clench - dt * 2.2);
    const curl = Math.max(this.clench, this.charge * 0.45,
                          this.state === S.DASH ? 0.35 : 0);
    this.fingers.rotation.x = curl * 1.5;
    this.thumb.rotation.x = curl * 1.0;
  }
}
