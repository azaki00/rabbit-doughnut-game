import * as THREE from 'three';
import { loadModel } from './Loaders.js';

// WILD HORSES.
//
// Four of them graze around the meadow. Walk up, press E, and you get exactly
// four seconds of gallop before the horse decides it has had enough of you and
// throws you over its head.
//
// That is the whole design. It is a traversal tool with a hard timer and a
// punishing exit — fast enough to cross the map, short enough that you have to
// plan where you point it, and loud enough that every rabbit within 26m is gone
// by the time you land. You do not tame it. It tolerates you, briefly.

const HORSE_URL = 'OBJECTS/horse/WildHorse.obj';

// The OBJ is authored facing along +Z; our world yaw convention has forward at
// -Z, so the mesh is turned 180° inside its own group.
const MODEL_YAW = Math.PI;

export const HORSE = {
  count: 4,
  height: 2.2,

  mountRadius: 3.6,
  rideTime: 4.0,          // §the whole point
  rideSpeed: 13.0,
  rideAccel: 15,
  turnRate: 2.6,          // rad/s the horse swings toward where you are looking
  saddleEye: 2.45,

  buckStun: 1.5,
  buckForward: 8.0,
  buckUp: 6.2,

  fleeTime: 4.5,
  fleeSpeed: 9.5,
  cooldown: 7.0,          // before it will let you near it again

  grazeSpeed: 1.0,
  wanderRadius: 14,
  scareRadius: 26,        // a galloping horse empties the field
  bodyRadius: 0.85,
};

const ST = { GRAZE: 'GRAZE', RIDDEN: 'RIDDEN', FLEE: 'FLEE' };
export { ST as HORSE_STATE };

const _v = new THREE.Vector3();

// ── one horse ──
class Horse {
  constructor(scene, world, home) {
    this.world = world;
    this.home = home.clone();
    this.state = ST.GRAZE;
    this.yaw = Math.random() * Math.PI * 2;
    this.speed = 0;
    this.cooldown = 0;
    this.rideT = 0;
    this.stateT = 0;
    this.bobT = Math.random() * 10;
    this.target = home.clone();

    this.root = new THREE.Group();
    this.root.position.copy(home);
    this.root.position.y = world.groundHeight(home.x, home.z);
    scene.add(this.root);

    // the model hangs off a body group so the gallop lean never fights the yaw
    this.body = new THREE.Group();
    this.root.add(this.body);

    this._buildFallback();
    this._loadReal();
  }

  get pos() { return this.root.position; }
  get rideable() { return this.state === ST.GRAZE && this.cooldown <= 0; }

  // Blocky stand-in, so a failed load still leaves something to ride.
  _buildFallback() {
    const hide = new THREE.MeshStandardMaterial({ color: 0x8a5a37, roughness: .9, flatShading: true });
    this.fallback = new THREE.Group();

    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.82, 1.7), hide);
    barrel.position.y = 1.32;
    this.fallback.add(barrel);

    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, 0.42), hide);
    neck.position.set(0, 1.75, -0.85);
    neck.rotation.x = 0.35;
    this.fallback.add(neck);

    for (const [x, z] of [[-0.24, -0.6], [0.24, -0.6], [-0.24, 0.62], [0.24, 0.62]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.95, 0.18), hide);
      leg.position.set(x, 0.47, z);
      this.fallback.add(leg);
    }
    this.fallback.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.body.add(this.fallback);
  }

  async _loadReal() {
    const m = await loadModel(HORSE_URL, { height: HORSE.height, mtl: true });
    if (!m) { console.warn('[horses] model unavailable, using fallback'); return; }
    m.rotation.y = MODEL_YAW;
    m.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
    });
    this.body.remove(this.fallback);
    this.body.add(m);
    this.real = m;
  }

  // ── the wandering half ──
  _graze(dt) {
    this.stateT -= dt;
    if (this.stateT <= 0) {
      // pick somewhere new near home, or stand still and eat for a while
      this.stateT = 3 + Math.random() * 5;
      if (Math.random() < 0.45) {
        this.target.copy(this.pos);          // stand and graze
      } else {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * HORSE.wanderRadius;
        this.target.set(this.home.x + Math.cos(a) * d, 0, this.home.z + Math.sin(a) * d);
      }
    }

    const to = _v.subVectors(this.target, this.pos).setY(0);
    const dist = to.length();
    if (dist > 0.6) {
      this._steer(to, dt, 1.6);
      this.speed += (HORSE.grazeSpeed - this.speed) * Math.min(1, 2 * dt);
    } else {
      this.speed += (0 - this.speed) * Math.min(1, 4 * dt);
    }
  }

  _flee(dt) {
    this.stateT -= dt;
    this.speed += (HORSE.fleeSpeed - this.speed) * Math.min(1, 3 * dt);
    if (this.stateT <= 0) {
      this.state = ST.GRAZE;
      this.stateT = 0;
      // wherever it ended up is home now
      this.home.copy(this.pos);
    }
  }

  _steer(to, dt, rate) {
    if (to.lengthSq() < 1e-6) return;
    this.yawTo(Math.atan2(-to.x, -to.z), dt, rate);
  }

  yawTo(want, dt, rate) {
    let d = want - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * Math.min(1, rate * dt);
  }

  // Move along the current heading and settle onto the ground.
  advance(dt) {
    if (this.speed > 0.001) {
      const p = this.pos.clone();
      p.x += -Math.sin(this.yaw) * this.speed * dt;
      p.z += -Math.cos(this.yaw) * this.speed * dt;
      this.world.resolveHorizontal(p, HORSE.bodyRadius);
      this.pos.x = p.x;
      this.pos.z = p.z;
    }
    this.pos.y = this.world.groundHeight(this.pos.x, this.pos.z);
  }

  // Gait: a two-beat lope at a graze, a hard four-beat gallop under a rider.
  pose(dt) {
    const gallop = this.speed / HORSE.rideSpeed;
    this.bobT += dt * (2.4 + gallop * 9);
    this.root.rotation.y = this.yaw;

    const amp = 0.05 + gallop * 0.16;
    this.body.position.y = Math.abs(Math.sin(this.bobT)) * amp;
    this.body.rotation.x = -Math.sin(this.bobT) * (0.03 + gallop * 0.14);
    this.body.rotation.z = Math.sin(this.bobT * 0.5) * gallop * 0.08;
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;

    switch (this.state) {
      case ST.GRAZE: this._graze(dt); break;
      case ST.FLEE:  this._flee(dt);  break;
      case ST.RIDDEN: break;          // driven by Horses.updateRide
    }
    this.advance(dt);
    this.pose(dt);
  }
}

// ── the herd ──
export class Horses {
  constructor(scene, world, sfx) {
    this.world = world;
    this.sfx = sfx;
    this.list = [];
    this.rider = null;          // the horse currently being ridden, if any
    this.rideT = 0;
    this.onScare = null;        // (origin, radius) => void
    this._scareT = 0;

    for (let i = 0; i < HORSE.count; i++) {
      this.list.push(new Horse(scene, world, this._spawnPoint(i)));
    }
  }

  // Spread them around the ring between the table and the treeline, clear of
  // anything solid.
  _spawnPoint(i) {
    const base = (i / HORSE.count) * Math.PI * 2 + 0.6;
    for (let tries = 0; tries < 40; tries++) {
      const a = base + (Math.random() - 0.5) * 0.9;
      const d = 16 + Math.random() * 14;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      const blocked = this.world.colliders?.some(
        c => Math.abs(x - c.x) < c.hw + 1.6 && Math.abs(z - c.z) < c.hd + 1.6);
      if (!blocked) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(Math.cos(base) * 22, 0, Math.sin(base) * 22);
  }

  get riding() { return this.rider !== null; }
  get secondsLeft() { return Math.max(0, HORSE.rideTime - this.rideT); }

  // The nearest horse that would let you on, or null.
  mountable(playerPos) {
    let best = null, bestD = HORSE.mountRadius;
    for (const h of this.list) {
      if (!h.rideable) continue;
      const d = h.pos.distanceTo(playerPos);
      if (d < bestD) { bestD = d; best = h; }
    }
    return best;
  }

  mount(horse, player) {
    if (this.rider || !horse) return false;
    this.rider = horse;
    horse.state = ST.RIDDEN;
    horse.speed = 2;
    this.rideT = 0;
    this._scareT = 0;
    player.vel.set(0, 0, 0);
    player.dashTime = 0;
    player.frozen = 0;
    this.sfx?.horseMount?.();
    return true;
  }

  // Called INSTEAD of Controller.update while mounted. The player does not
  // move; the horse does, and the player is carried.
  updateRide(dt, input, player) {
    const h = this.rider;
    if (!h) return false;

    this.rideT += dt;

    // It runs where you look. W/S lean into or against it, but it is never
    // really yours to stop.
    let throttle = 1;
    if (input.down('back')) throttle = 0.45;
    if (input.down('fwd')) throttle = 1.15;

    h.yawTo(player.yaw, dt, HORSE.turnRate);
    const want = HORSE.rideSpeed * throttle;
    h.speed += (want - h.speed) * Math.min(1, HORSE.rideAccel * dt / 3);
    h.advance(dt);
    h.pose(dt);

    // seat the rider, with the gallop coming up through the saddle
    const sway = Math.sin(h.bobT) * 0.10;
    player.pos.set(
      h.pos.x,
      h.pos.y + HORSE.saddleEye + Math.abs(Math.sin(h.bobT)) * 0.14,
      h.pos.z,
    );
    player.pos.x += Math.cos(h.yaw) * sway * 0.4;
    player.pos.z += -Math.sin(h.yaw) * sway * 0.4;
    player.vel.set(0, 0, 0);
    player.grounded = true;
    player.speed2D = h.speed;
    player.sprinting = false;
    player.crouching = false;
    player.noiseRadius = HORSE.scareRadius;

    // hooves carry: everything nearby bolts, on a short repeat
    this._scareT -= dt;
    if (this._scareT <= 0) {
      this._scareT = 0.5;
      this.onScare?.(player.pos, HORSE.scareRadius);
    }

    if (this.rideT >= HORSE.rideTime) {
      this.buck(player);
      return false;
    }
    return true;
  }

  // Four seconds up, and then over the head.
  buck(player) {
    const h = this.rider;
    if (!h) return;

    const fx = -Math.sin(h.yaw), fz = -Math.cos(h.yaw);

    // stumble() damps the existing velocity, so launch AFTER it
    player.stumble(HORSE.buckStun);
    player.pos.y += 0.3;
    player.vel.set(fx * HORSE.buckForward, HORSE.buckUp, fz * HORSE.buckForward);
    player.grounded = false;

    h.state = ST.FLEE;
    h.stateT = HORSE.fleeTime;
    h.cooldown = HORSE.fleeTime + HORSE.cooldown;
    h.speed = HORSE.rideSpeed;
    // it wheels away from where it threw you
    h.yaw += (Math.random() < 0.5 ? 1 : -1) * (0.7 + Math.random() * 0.8);

    this.rider = null;
    this.rideT = 0;
    this.sfx?.horseBuck?.();
    // and the horse's editorial comment on your riding, a beat later
    this.sfx?.fart?.(0.12);
  }

  update(dt) {
    for (const h of this.list) {
      if (h === this.rider) continue;
      h.update(dt);
    }
  }
}
