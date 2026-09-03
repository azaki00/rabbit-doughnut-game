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
  }

  look(dx, dy, sens) {
    if (this.frozen > 0) sens *= 0.35;   // stumbling makes aiming hard
    this.yaw   -= dx * sens;
    this.pitch -= dy * sens;
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
    const stunned = this.frozen > 0;
    if (stunned) this.frozen -= dt;

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

    // noise radius drives rabbit hearing — §5.2
    this.noiseRadius = this.crouching ? 3.5 : this.sprinting ? 22 : (moving ? 11 : 2);
  }

  // Where the camera actually sits this frame, bob included.
  applyToCamera(camera) {
    camera.position.set(
      this.pos.x + _right.x * this.bob.x,
      this.pos.y + this.bob.y,
      this.pos.z + _right.z * this.bob.x
    );
    camera.rotation.set(this.pitch, this.yaw, this.bob.roll, 'YXZ');
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
