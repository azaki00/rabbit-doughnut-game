import * as THREE from 'three';
import { buildRabbit } from './RabbitMesh.js';
import { HopGait } from './HopGait.js';

// Rabbit entity — GAME_DESIGN.md §5.1–5.3
//
// AI states: GRAZE ALERT FLEE EVADE CAUGHT
// Direction only changes at the hind plant, so the AI proposes a heading and the
// gait decides when it is allowed to take effect.

export const ST = {
  GRAZE: 'GRAZE', ALERT: 'ALERT', FLEE: 'FLEE',
  EVADE: 'EVADE', CAUGHT: 'CAUGHT', CIRCLE: 'CIRCLE',
};

let NEXT_ID = 1;
const _v = new THREE.Vector3();

export class Rabbit {
  constructor(type, pos, world, voice) {
    this.id = NEXT_ID++;
    this.type = type;
    this.world = world;
    this.voice = voice;

    this.parts = buildRabbit(type);
    this.obj = this.parts.root;
    this.obj.position.copy(pos);
    this.obj.position.y = world.groundHeight(pos.x, pos.z);

    this.home = pos.clone();
    this.yaw = Math.random() * Math.PI * 2;
    this.desiredYaw = this.yaw;
    this.speed = 0;
    this.targetSpeed = 0;

    this.gait = new HopGait(this.id);
    this.gait.onPlant = () => this._onPlant();

    this.state = ST.GRAZE;
    this.stateTime = 0;
    this.fleeFuel = type.fleeStamina;
    this.alive = true;
    this.caught = false;

    // per-rabbit voice character — §5.4
    this.voicePitch = 0.8 + (this.id * 0.6180339887 % 1) * 0.5;

    this.noseT = Math.random() * 10;
    this.idleTimer = 1 + Math.random() * 4;
    this.binky = 0;
    this.tripping = 0;
    this._pendingYaw = null;
    this._circleDir = Math.random() < 0.5 ? -1 : 1;
    this._lastSeen = false;
  }

  get position() { return this.obj.position; }

  // ── perception — §5.2 ──
  // 300° vision with a blind spot straight ahead of the nose, plus hearing
  // scaled by how much noise the player is making.
  _senses(player) {
    _v.subVectors(player.pos, this.obj.position);
    const dist = _v.length();
    if (dist > this.type.vision && dist > player.noiseRadius) return { dist, aware: false };

    const heard = dist < player.noiseRadius;

    let seen = false;
    if (dist < this.type.vision) {
      const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const to = _v.clone().setY(0).normalize();
      const dot = fwd.dot(to);
      const ang = Math.acos(THREE.MathUtils.clamp(dot, -1, 1));
      const half = (this.type.fov * Math.PI / 180) / 2;
      // the blind spot: a narrow cone directly in front of the nose
      const blind = 0.16;
      seen = ang <= half && ang > blind;
    }
    return { dist, aware: seen || heard, seen, heard };
  }

  update(dt, player) {
    if (!this.alive) return;
    this.stateTime += dt;

    if (this.state === ST.CAUGHT) { this._updateCaught(dt); return; }

    const s = this._senses(player);
    this._think(dt, player, s);

    // ── locomotion ──
    const accel = this.state === ST.GRAZE ? 6 : 22;
    this.speed += (this.targetSpeed - this.speed) * Math.min(1, accel * dt);

    // Yaw only turns while grounded; mid-flight a rabbit is committed.
    if (!this.gait.airborne) {
      let d = this.desiredYaw - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * Math.min(1, 14 * dt);
    }

    this.gait.setSpeed(this.speed, this.type);
    this.gait.update(dt);

    if (this.tripping > 0) {
      this.tripping -= dt;
      this.speed *= 0.86;
    }

    const dx = -Math.sin(this.yaw) * this.speed * dt;
    const dz = -Math.cos(this.yaw) * this.speed * dt;
    const np = this.obj.position.clone();
    np.x += dx; np.z += dz;
    this.world.resolveHorizontal(np, 0.25);

    // turn away from anything we bumped into rather than grinding along it
    if (Math.abs(np.x - (this.obj.position.x + dx)) > 1e-4 ||
        Math.abs(np.z - (this.obj.position.z + dz)) > 1e-4) {
      this.desiredYaw = this.yaw + (Math.random() < .5 ? 1 : -1) * (0.7 + Math.random());
    }
    this.obj.position.x = np.x;
    this.obj.position.z = np.z;
    this.obj.position.y = this.world.groundHeight(np.x, np.z);

    this._pose(dt);
  }

  // ── decision making ──
  _think(dt, player, s) {
    const t = this.type;

    // The Black Rabbit does not flee. It circles and stares. §13
    if (t.circler) {
      this.state = ST.CIRCLE;
      const to = _v.subVectors(this.obj.position, player.pos).setY(0);
      const dist = to.length() || 0.001;

      // Aim at a point on the ring, a little way around it from where we stand.
      // Steering toward a moving target point gets both the approach and the
      // orbit out of the same two lines, instead of blending two behaviours.
      const around = Math.atan2(to.x, to.z);
      const step = this._circleDir * 0.55;              // radians ahead on the ring
      const aimX = player.pos.x + Math.sin(around + step) * t.circleRadius;
      const aimZ = player.pos.z + Math.cos(around + step) * t.circleRadius;
      this.desiredYaw = Math.atan2(-(aimX - this.obj.position.x),
                                   -(aimZ - this.obj.position.z));

      // always faces the player, whatever direction it is actually walking
      this.headYawTarget = Math.atan2(to.x, to.z) - this.yaw;

      // hurries to close a big gap, settles into a slow prowl on the ring
      const err = Math.abs(dist - t.circleRadius);
      this.targetSpeed = t.speed * (0.40 + Math.min(0.55, err * 0.09));
      return;
    }

    switch (this.state) {
      case ST.GRAZE: {
        this.targetSpeed = 0;
        this.idleTimer -= dt;
        if (this.idleTimer <= 0) {
          this.idleTimer = 1.5 + Math.random() * 4;
          if (Math.random() < 0.12) {
            // binky — the joyful mid-air twist. §5.1
            this.binky = 1;
            this.voice?.binky(this);
          } else if (Math.random() < 0.6) {
            const a = Math.random() * Math.PI * 2;
            this.desiredYaw = a;
            this.targetSpeed = t.speed * 0.22;
            this.idleTimer = 0.8 + Math.random() * 1.2;
          }
        }
        if (this.binky > 0) this.targetSpeed = t.speed * 0.3;

        if (s.aware) {
          this.state = ST.ALERT;
          this.stateTime = 0;
          this.alertFor = 0.6 + Math.random() * 0.8;
          this.targetSpeed = 0;
          this.voice?.alert(this);
        }
        break;
      }

      case ST.ALERT: {
        // Freezing is real rabbit behaviour, and it is the player's catch window.
        this.targetSpeed = 0;
        const to = _v.subVectors(player.pos, this.obj.position).setY(0);
        this.headYawTarget = Math.atan2(-to.x, -to.z) - this.yaw;
        if (this.stateTime >= this.alertFor) {
          if (s.aware) { this._startFlee(player); }
          else { this.state = ST.GRAZE; this.stateTime = 0; }
        }
        break;
      }

      case ST.FLEE: {
        this.fleeFuel -= dt;
        this.targetSpeed = t.panicSpeed;
        if (s.dist < 4) { this.state = ST.EVADE; this.stateTime = 0; break; }
        if (!s.aware && this.stateTime > 2) { this._calmDown(); break; }
        if (this.fleeFuel <= 0) { this._calmDown(); }
        break;
      }

      case ST.EVADE: {
        this.fleeFuel -= dt;
        this.targetSpeed = t.panicSpeed;
        if (s.dist > 7) { this.state = ST.FLEE; this.stateTime = 0; }
        break;
      }
    }
  }

  _startFlee(player) {
    this.state = ST.FLEE;
    this.stateTime = 0;
    this.fleeFuel = this.type.fleeStamina;
    this._awayFrom(player.pos, 0);
    this.voice?.squeal(this);
  }

  _calmDown() {
    this.state = ST.GRAZE;
    this.stateTime = 0;
    this.fleeFuel = this.type.fleeStamina;
    this.targetSpeed = 0;
    this.idleTimer = 0.5 + Math.random();
  }

  _awayFrom(p, jitter) {
    const to = _v.subVectors(this.obj.position, p).setY(0);
    if (to.lengthSq() < 1e-6) to.set(Math.random() - .5, 0, Math.random() - .5);
    this._pendingYaw = Math.atan2(-to.x, -to.z) + Math.PI + jitter;
  }

  // Fires exactly when the hind feet plant. This is the only moment a rabbit is
  // allowed to change direction — §5.1
  _onPlant() {
    if (this._pendingYaw !== null) {
      this.desiredYaw = this._pendingYaw;
      this._pendingYaw = null;
    }

    if (this.state === ST.FLEE) {
      // zigzag: re-roll +/-35 degrees off "directly away" at every plant
      const jitter = (Math.random() - 0.5) * 2 * (35 * Math.PI / 180);
      this.desiredYaw += jitter;
    } else if (this.state === ST.EVADE) {
      // sharp 90-150 degree cut
      const dir = Math.random() < 0.5 ? -1 : 1;
      const cut = (90 + Math.random() * 60) * Math.PI / 180;
      this.desiredYaw = this.yaw + dir * cut;
    }

    if (this.speed > 0.4) this.voice?.hopGrunt(this);

    // the Lop trips over its own ears
    if (this.type.tripChance && this.speed > 1 && Math.random() < this.type.tripChance) {
      this.tripping = 0.5;
      this.voice?.trip(this);
    }

    if (this.binky > 0) this.binky = Math.max(0, this.binky - 0.5);
  }

  // ── pose the rig from the gait ──
  _pose(dt) {
    const p = this.parts, g = this.gait;

    this.obj.rotation.y = this.yaw;

    // ballistic lift + landing squash
    p.carriage.position.y = g.y;
    p.carriage.scale.set(1, g.squash, 1);
    // stretch sideways a touch to conserve volume on the squash
    const bulge = 1 + (1 - g.squash) * 0.55;
    p.carriage.scale.x = bulge;
    p.carriage.scale.z = bulge;

    // spine: the haunch leads, the chest follows with a delay
    p.haunch.rotation.x = g.spine;
    p.chest.rotation.x = -g.spine * 0.62;

    // pitch the whole body along the arc it is travelling
    const arc = THREE.MathUtils.clamp(g.vy * 0.10, -0.35, 0.35);
    p.carriage.rotation.x = -arc;

    // legs
    p.hindLegs[0].hip.rotation.x = g.hind;
    p.hindLegs[1].hip.rotation.x = g.hind;
    p.hindLegs[0].knee.rotation.x = Math.max(0, -g.hind) * 1.1;
    p.hindLegs[1].knee.rotation.x = Math.max(0, -g.hind) * 1.1;
    // hind feet swing WIDE, outside the front legs
    const spread = Math.max(0, Math.sin(g.phase * Math.PI * 2)) * 0.18;
    p.hindLegs[0].hip.rotation.z =  spread;
    p.hindLegs[1].hip.rotation.z = -spread;

    p.foreLegs[0].hip.rotation.x = g.fore;
    p.foreLegs[1].hip.rotation.x = g.foreR;     // asymmetric — one lands first
    p.foreLegs[0].knee.rotation.x = Math.max(0, g.fore) * 0.5;
    p.foreLegs[1].knee.rotation.x = Math.max(0, g.foreR) * 0.5;

    // ── ears: damped springs chasing the head ── §5.1
    // They flop backward on launch and forward on landing. This is the detail
    // that sells the entire animation.
    const drive = -g.vy * 1.15 + this.speed * 0.045;
    const stiff = 90, damp = 11;
    for (const ear of p.ears) {
      const target = this.type.lopEars ? 2.05 + drive * 0.30 : drive;
      ear.springVel += (-(ear.springAngle - target) * stiff - ear.springVel * damp) * dt;
      ear.springAngle += ear.springVel * dt;
      ear.springAngle = THREE.MathUtils.clamp(ear.springAngle, -1.3, 2.6);

      const latTarget = ear.side * (this.state === ST.ALERT ? 0.05 : 0.14) +
                        Math.sin(this.noseT * 1.7 + ear.side) * 0.03;
      ear.lateralVel += (-(ear.lateral - latTarget) * 70 - ear.lateralVel * 10) * dt;
      ear.lateral += ear.lateralVel * dt;

      // distribute the bend down the 3 segments, most at the base
      ear.segs[0].rotation.x = ear.springAngle * 0.5;
      ear.segs[1].rotation.x = ear.springAngle * 0.32;
      ear.segs[2].rotation.x = ear.springAngle * 0.18;
      ear.base.rotation.z = ear.lateral + ear.side * 0.12;
    }

    // ── head ──
    this.noseT += dt;
    if (this.headYawTarget !== undefined) {
      let d = this.headYawTarget;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      d = THREE.MathUtils.clamp(d, -1.1, 1.1);
      p.neck.rotation.y += (d - p.neck.rotation.y) * Math.min(1, 9 * dt);
    } else {
      p.neck.rotation.y *= 1 - Math.min(1, 5 * dt);
    }
    // alert rabbits sit up and scan
    const rear = this.state === ST.ALERT ? 0.30 : 0;
    p.neck.rotation.x += (rear - p.neck.rotation.x) * Math.min(1, 8 * dt);

    // nose twitch — 8-14 Hz micro motion, only when not bounding
    const twitchAmp = this.speed < 0.6 ? 1 : 0.15;
    p.snout.rotation.x = Math.sin(this.noseT * 11.2) * 0.035 * twitchAmp;
    p.snout.position.y = Math.sin(this.noseT * 13.7) * 0.004 * twitchAmp;

    // binky: the joyful mid-air twist
    if (this.binky > 0) {
      this.binky = Math.max(0, this.binky - dt * 0.9);
      const b = Math.sin(this.binky * Math.PI);
      p.carriage.rotation.y = b * 1.5 * (this.id % 2 ? 1 : -1);
      p.carriage.rotation.z = b * 0.55;
      p.carriage.position.y += b * 0.18;
    } else {
      p.carriage.rotation.y *= 0.85;
      p.carriage.rotation.z *= 0.85;
    }

    if (this.tripping > 0) {
      p.carriage.rotation.z += Math.sin(this.tripping * 30) * 0.35;
      p.carriage.rotation.x += 0.4;
    }
  }

  // ── caught ──
  catchIt() {
    this.state = ST.CAUGHT;
    this.caught = true;
    this.stateTime = 0;
    this.speed = 0;
    this.voice?.caught(this);
  }

  // Shot. Not caught — it drops where it stands and the meat is ruined, so this
  // is always the worse outcome. It also gets a much less funny sound.
  shoot() {
    this.state = ST.CAUGHT;
    this.caught = true;
    this.shot = true;
    this.stateTime = 0;
    this.speed = 0;
    this.voice?.shot(this);
  }

  _updateCaught(dt) {
    const p = this.parts;
    this.stateTime += dt;
    const t = this.stateTime;

    if (this.shot) {
      // crumples where it stood, tips onto its side, and is simply gone
      const g = this.world.groundHeight(this.obj.position.x, this.obj.position.z);
      this.obj.position.y += (g - this.obj.position.y) * Math.min(1, 12 * dt);
      this.obj.rotation.z += (1.35 - this.obj.rotation.z) * Math.min(1, 7 * dt);
      this.obj.scale.multiplyScalar(1 - Math.min(1, dt * 1.1));
      for (const ear of this.parts.ears) ear.segs[0].rotation.x += (1.1 - ear.segs[0].rotation.x) * Math.min(1, 6 * dt);
      if (t > 0.9) this.alive = false;
      return;
    }

    // yanked toward the glove, kicking
    this.obj.position.y += (this.world.groundHeight(this.obj.position.x, this.obj.position.z) + 1.2 - this.obj.position.y) * Math.min(1, 9 * dt);
    this.obj.rotation.z = Math.sin(t * 22) * 0.5;
    this.obj.rotation.x = Math.sin(t * 17) * 0.35;
    this.obj.scale.multiplyScalar(1 - Math.min(1, dt * 1.4));

    const kick = Math.sin(t * 26) * 0.8;
    p.hindLegs[0].hip.rotation.x = kick;
    p.hindLegs[1].hip.rotation.x = -kick;
    p.foreLegs[0].hip.rotation.x = -kick * 0.7;
    p.foreLegs[1].hip.rotation.x = kick * 0.7;
    for (const ear of p.ears) ear.segs[0].rotation.x = Math.sin(t * 19) * 0.7;

    if (t > 0.7) this.alive = false;
  }

  // Loud scare — a whiffed lunge sends everything nearby bolting. §4.1
  scare(origin, radius, player) {
    if (!this.alive || this.state === ST.CAUGHT) return;
    if (this.type.circler) return;
    if (this.obj.position.distanceTo(origin) > radius) return;
    this.state = ST.FLEE;
    this.stateTime = 0;
    this.fleeFuel = this.type.fleeStamina;
    this._awayFrom(origin, (Math.random() - 0.5) * 0.6);
    this.desiredYaw = this._pendingYaw;
    this.voice?.squeal(this);
  }

  dispose(scene) {
    scene.remove(this.obj);
    this.obj.traverse(o => {
      if (o.geometry) o.geometry.dispose();
    });
  }
}
