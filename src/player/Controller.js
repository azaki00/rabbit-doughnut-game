import * as THREE from 'three';
import { HeadBob } from './HeadBob.js';
import { Stamina, STAM } from './Stamina.js';

// First-person controller — GAME_DESIGN.md §3.1
// Quake-style accelerate/friction. Snappy, not floaty.

export const MOVE = {
  walk: 4.0, sprint: 7.2, crouch: 1.8,
  accelGround: 40, accelAir: 6, friction: 10,
  jumpHeight: 1.1, gravity: -22,
  eyeStand: 1.65, eyeCrouch: 1.15,
  radius: 0.34,
  fovBase: 75, fovSprint: 82,
};

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _wish = new THREE.Vector3();

export class Controller {
  constructor(world) {
    this.world = world;
    this.pos = new THREE.Vector3(0, MOVE.eyeStand, 9);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;

    this.grounded = true;
    this.crouching = false;
    this.sprinting = false;
    this.eyeHeight = MOVE.eyeStand;

    this.bob = new HeadBob();
    this.stamina = new Stamina();

    // external movement override (the lunge dash drives this)
    this.dashVel = new THREE.Vector3();
    this.dashTime = 0;
    this.frozen = 0;          // stumble recovery lockout

    this.speed2D = 0;
    this.noiseRadius = 11;
    this.invertY = false;

    // ── the fall ──
    // Being thrown off a horse is the one time the camera stops being a
    // floating eye and becomes a body that hits the ground. `tumble` runs a
    // three-beat animation: airborne (spinning), the landing (a hard drop and
    // a bounce), and getting back up (the view climbing back to eye height).
    this.tumble = 0;          // seconds remaining
    this.tumbleTotal = 0;
    this.tumbleLanded = false;
    this.tumbleSpin = 0;      // roll rate while airborne
    this.tumbleRoll = 0;
    this.tumblePitch = 0;
    this.tumbleDrop = 0;      // how far the eye is below normal
    this.onTumbleLand = null;

    // ── death camera ──
    // Separate from the tumble because it never gets back up. The view drops
    // to just above the grass and rolls onto its side, which is the whole
    // reason the death screen reads as a body rather than as a menu.
    this.dying = false;
    this.dieT = 0;
    this.dieRoll = 0;
  }

  // Collapse where you stand. Runs for as long as you are dead.
  collapse() {
    this.dying = true;
    this.dieT = 0;
    this.dieRoll = (Math.random() < 0.5 ? -1 : 1) * (1.05 + Math.random() * 0.45);
    this.dieYawDrift = (Math.random() - 0.5) * 0.5;
    this.tumble = 0;
  }

  standUp() {
    this.dying = false;
    this.dieT = 0;
    this.tumbleDrop = 0;
    this.tumbleRoll = 0;
    this.tumblePitch = 0;
  }

  // Driven directly while dead — the rest of the controller is not running.
  updateDeathCam(dt) {
    if (!this.dying) return;
    this.dieT += dt;

    // A fast fall with a small settle at the bottom, rather than a linear
    // slide: you drop, you land, you stop.
    const t = Math.min(1, this.dieT / 0.85);
    const fall = 1 - Math.pow(1 - t, 3);
    const settle = Math.sin(Math.min(1, this.dieT / 1.5) * Math.PI) * 0.05 * (1 - t);

    // eye ends about 25cm off the grass
    this.tumbleDrop = (this.eyeHeight - 0.25) * fall - settle;
    this.tumbleRoll = this.dieRoll * fall;
    // face turned up toward the sky, which is where GTA leaves you
    this.tumblePitch = -0.42 * fall;
    this.yaw += this.dieYawDrift * dt * (1 - t);
  }

  // Called when something throws you. `seconds` is the whole animation, from
  // leaving the saddle to standing back up.
  startTumble(seconds = 2.0) {
    this.tumble = seconds;
    this.tumbleTotal = seconds;
    this.tumbleLanded = false;
    this.tumbleSpin = (Math.random() < 0.5 ? -1 : 1) * (3.0 + Math.random() * 2.0);
    this.tumbleRoll = 0;
    this.tumblePitch = 0;
    this.tumbleDrop = 0;
  }

  get tumbling() { return this.tumble > 0; }

  _updateTumble(dt) {
    if (this.dying) return;          // the death camera owns the view instead
    if (this.tumble <= 0) return;
    this.tumble = Math.max(0, this.tumble - dt);

    if (!this.grounded && !this.tumbleLanded) {
      // ── airborne ── spinning, pitching forward over the horse's head
      this.tumbleRoll += this.tumbleSpin * dt;
      this.tumblePitch = Math.min(1.15, this.tumblePitch + 2.6 * dt);
      this.tumbleDrop = Math.min(0.35, this.tumbleDrop + 0.9 * dt);
      return;
    }

    if (!this.tumbleLanded) {
      // ── the landing ── face-first, and it hurts
      this.tumbleLanded = true;
      this.tumbleLandT = 0;
      this.onTumbleLand?.();
    }

    // ── getting back up ──
    // A short slump at the bottom, then a spring back to standing. Overshoot
    // slightly on the way up so it reads as effort, not as a lerp.
    this.tumbleLandT += dt;
    const rise = Math.min(1, this.tumbleLandT / Math.max(0.35, this.tumble + this.tumbleLandT));
    const settle = 1 - Math.pow(1 - rise, 3);
    const overshoot = Math.sin(rise * Math.PI) * 0.10;

    // slumped low on landing (eye almost at the grass), back to standing
    this.tumbleDrop = THREE.MathUtils.lerp(1.05, -overshoot * 0.5, settle);
    // rolled onto one side, righting itself
    this.tumbleRoll = this.tumbleRoll * (1 - Math.min(1, 3.2 * dt));
    // staring at the ground, then lifting the head
    this.tumblePitch = THREE.MathUtils.lerp(0.95, 0, settle) - overshoot * 0.35;

    if (this.tumble <= 0) {
      this.tumbleRoll = 0;
      this.tumblePitch = 0;
      this.tumbleDrop = 0;
    }
  }

  look(dx, dy, sens) {
    if (this.frozen > 0) sens *= 0.35;   // stumbling makes aiming hard
    this.yaw   -= dx * sens;
    this.pitch -= dy * sens * (this.invertY ? -1 : 1);
    const lim = Math.PI / 2 - 0.02;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  dash(dir, speed, duration) {
    this.dashVel.copy(dir).multiplyScalar(speed);
    this.dashTime = duration;
  }

  stumble(seconds) {
    this.frozen = seconds;
    this.dashTime = 0;
    this.vel.x *= 0.2; this.vel.z *= 0.2;
  }

  update(dt, input) {
    const stunned = this.frozen > 0 || this.tumble > 0;
    if (this.frozen > 0) this.frozen -= dt;

    // ── intent ──
    let f = 0, r = 0;
    if (!stunned) {
      if (input.down('fwd'))   f += 1;
      if (input.down('back'))  f -= 1;
      if (input.down('right')) r += 1;
      if (input.down('left'))  r -= 1;
    }
    const moving = (f !== 0 || r !== 0);

    this.crouching = !stunned && input.down('crouch');
    const wantSprint = !stunned && input.down('sprint') && moving && f > 0 && !this.crouching;
    this.sprinting = wantSprint && this.stamina.canSprint;

    this.stamina.update(dt, this.sprinting);

    const maxSpeed = this.crouching ? MOVE.crouch
                   : this.sprinting ? MOVE.sprint
                   : MOVE.walk;

    // ── wish direction, in the yaw plane ──
    _fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    _wish.set(0, 0, 0).addScaledVector(_fwd, f).addScaledVector(_right, r);
    if (_wish.lengthSq() > 0) _wish.normalize();

    // ── friction (ground only, and only when not being dashed) ──
    if (this.grounded && this.dashTime <= 0) {
      const sp = Math.hypot(this.vel.x, this.vel.z);
      if (sp > 0.01) {
        const drop = Math.max(sp, 2.0) * MOVE.friction * dt;
        const scale = Math.max(0, sp - drop) / sp;
        this.vel.x *= scale; this.vel.z *= scale;
      } else { this.vel.x = this.vel.z = 0; }
    }

    // ── acceleration ──
    if (moving && this.dashTime <= 0) {
      const accel = this.grounded ? MOVE.accelGround : MOVE.accelAir;
      const current = this.vel.x * _wish.x + this.vel.z * _wish.z;
      const add = Math.min(maxSpeed - current, accel * dt * maxSpeed / MOVE.walk);
      if (add > 0) {
        this.vel.x += _wish.x * add;
        this.vel.z += _wish.z * add;
      }
    }

    // ── dash override (lunge) ──
    if (this.dashTime > 0) {
      this.dashTime -= dt;
      const decay = Math.max(0, this.dashTime / 0.35);
      this.vel.x = this.dashVel.x * decay;
      this.vel.z = this.dashVel.z * decay;
    }

    // ── jump ──
    if (!stunned && this.grounded && input.hit('jump') && this.stamina.value > STAM.jumpCost) {
      this.vel.y = Math.sqrt(-2 * MOVE.gravity * MOVE.jumpHeight);
      this.grounded = false;
      this.stamina.spend(STAM.jumpCost);
    }

    // ── gravity + integrate ──
    this.vel.y += MOVE.gravity * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vel.y * dt;

    this.world.resolveHorizontal(this.pos, MOVE.radius);

    // ── ground ──
    const targetEye = this.crouching ? MOVE.eyeCrouch : MOVE.eyeStand;
    this.eyeHeight += (targetEye - this.eyeHeight) * (1 - Math.exp(-14 * dt));

    const floor = this.world.groundHeight(this.pos.x, this.pos.z) + this.eyeHeight;
    if (this.pos.y <= floor) {
      if (!this.grounded) this.bob.land(-this.vel.y);
      this.pos.y = floor;
      this.vel.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    // ── bob ──
    this.speed2D = Math.hypot(this.vel.x, this.vel.z);
    this.bob.update(dt, {
      speed: this.speed2D, grounded: this.grounded,
      sprinting: this.sprinting, crouching: this.crouching,
      maxSpeed,
    });

    this._updateTumble(dt);

    // noise radius drives rabbit hearing — §5.2
    this.noiseRadius = this.crouching ? 3.5 : this.sprinting ? 22 : (moving ? 11 : 2);
  }

  // Where the camera actually sits this frame, bob included — plus whatever
  // the tumble is doing to it.
  applyToCamera(camera) {
    camera.position.set(
      this.pos.x + _right.x * this.bob.x,
      this.pos.y + this.bob.y - this.tumbleDrop,
      this.pos.z + _right.z * this.bob.x
    );
    camera.rotation.set(
      this.pitch - this.tumblePitch,
      this.yaw,
      this.bob.roll + this.tumbleRoll,
      'YXZ',
    );
  }

  get forward() {
    return new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
       Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    );
  }

  get flatForward() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }
}
