import * as THREE from 'three';
import { loadModel } from './Loaders.js';

// THE SOVEREIGN'S CHICKENS — boss phase two.
//
// Below half health the Sovereign stops relying on reach and starts throwing
// live chickens at you. They arc out, land running, and chase you down; on
// contact one detonates into feathers and takes a bite out of your health.
//
// They are the answer to kiting. The slam only threatens you within 5m and the
// yolk is dodgeable, so before this the correct play against a wounded boss is
// to back away and shoot. Chickens follow you when you do.
//
// They are killable. That is deliberate: the counterplay to a chicken is one
// shell, and a shell costs you the two seconds of reload you wanted to spend
// shooting the boss.

const CHICKEN_URL = 'OBJECTS/chicken/Chicken_01.obj';

export const CHICKEN = {
  height: 0.62,
  throwSpeed: 13,
  gravity: -19,
  chaseSpeed: 5.0,
  turnRate: 4.5,
  damage: 9,
  hitRadius: 1.05,
  life: 16,              // gives up and wanders off
  maxAlive: 7,
  // Each bird mutters about once a second. Jittered per chicken so a flock
  // never clucks in unison.
  idleSound: 1.0,
  idleJitter: 0.55,
  bodyRadius: 0.3,
  meatValue: 8,
};

const ST = { FLIGHT: 'FLIGHT', CHASE: 'CHASE', DEAD: 'DEAD' };

const _v = new THREE.Vector3();

export class Chickens {
  constructor(scene, world, sfx) {
    this.scene = scene;
    this.world = world;
    this.sfx = sfx;
    this.list = [];
    this.onDamage = null;      // (amount, kind) => void
    this.onKilled = null;      // (chicken) => void   — meat drops hang off this

    this.group = new THREE.Group();
    scene.add(this.group);

    this.feathers = [];
    this.featherGroup = new THREE.Group();
    scene.add(this.featherGroup);

    this.proto = null;
    this.fallback = this._buildFallback();
    this._loadReal();
  }

  get liveCount() { return this.list.filter(c => c.state !== ST.DEAD).length; }

  _buildFallback() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xf6f2e8, roughness: .9, flatShading: true }));
    body.scale.set(1, 0.9, 1.25);
    body.position.y = 0.30;
    g.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.10, 7, 6),
      new THREE.MeshStandardMaterial({ color: 0xf6f2e8, roughness: .9, flatShading: true }));
    head.position.set(0, 0.50, -0.16);
    g.add(head);

    const comb = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.07, 0.10),
      new THREE.MeshStandardMaterial({ color: 0xe23b2e, roughness: .8, flatShading: true }));
    comb.position.set(0, 0.58, -0.16);
    g.add(comb);

    const beak = new THREE.Mesh(
      new THREE.ConeGeometry(0.035, 0.09, 5),
      new THREE.MeshStandardMaterial({ color: 0xf0a01e, roughness: .7, flatShading: true }));
    beak.rotation.x = -Math.PI / 2;
    beak.position.set(0, 0.48, -0.27);
    g.add(beak);

    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  async _loadReal() {
    const m = await loadModel(CHICKEN_URL, { height: CHICKEN.height, mtl: true });
    if (!m) { console.warn('[chickens] model unavailable, using fallback'); return; }

    // Chicken_01.mtl ships `d 0.000000` (fully dissolved) on four of its five
    // materials. That is un-dissolved centrally in Loaders.prepare() — see the
    // note there — so there is nothing to fix up here.
    m.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.proto = m;
  }

  // Lobbed from the boss toward where the player is standing.
  spawn(origin, targetPos) {
    if (this.liveCount >= CHICKEN.maxAlive) return null;

    const obj = (this.proto ?? this.fallback).clone(true);
    obj.position.copy(origin);
    this.group.add(obj);

    // ballistic toward the target: pick the flat direction, then the vertical
    // component that lands it roughly there
    const to = _v.subVectors(targetPos, origin).setY(0);
    const dist = Math.max(1, to.length());
    to.normalize();
    const t = dist / CHICKEN.throwSpeed;
    const vy = (targetPos.y - origin.y) / t - 0.5 * CHICKEN.gravity * t;

    const c = {
      obj,
      state: ST.FLIGHT,
      vel: new THREE.Vector3(to.x * CHICKEN.throwSpeed, vy, to.z * CHICKEN.throwSpeed),
      yaw: Math.atan2(-to.x, -to.z),
      life: CHICKEN.life,
      flap: Math.random() * 10,
      spin: (Math.random() - 0.5) * 12,
      // stagger the first mutter so a burst does not all speak at once
      talk: Math.random() * CHICKEN.idleSound,
    };
    this.list.push(c);
    this.sfx?.chickenThrow?.();
    return c;
  }

  // Shot, hammered, or otherwise ended. Returns true if it was alive.
  kill(c, { silent = false } = {}) {
    if (!c || c.state === ST.DEAD) return false;
    c.state = ST.DEAD;
    this._burst(c.obj.position);
    this.group.remove(c.obj);
    if (!silent) this.sfx?.chickenDie?.();
    this.onKilled?.(c);
    return true;
  }

  // Hitscan for the gun — nearest chicken along the ray.
  raycast(origin, dir, maxDist) {
    let best = null, bestT = Infinity;
    for (const c of this.list) {
      if (c.state === ST.DEAD) continue;
      _v.copy(c.obj.position).setY(c.obj.position.y + 0.32).sub(origin);
      const along = _v.dot(dir);
      if (along < 0 || along > maxDist) continue;
      const perp2 = _v.lengthSq() - along * along;
      if (perp2 > 0.55 * 0.55) continue;
      if (along < bestT) { bestT = along; best = c; }
    }
    return best ? { chicken: best, point: origin.clone().addScaledVector(dir, bestT) } : null;
  }

  _burst(at) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xfbf6ea, roughness: .95, flatShading: true, side: THREE.DoubleSide,
    });
    for (let i = 0; i < 12; i++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.10, 0.20), mat);
      f.position.copy(at).setY(at.y + 0.3);
      f.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      this.featherGroup.add(f);
      this.feathers.push({
        mesh: f,
        vel: new THREE.Vector3((Math.random() - .5) * 3.5, 1.5 + Math.random() * 2.5, (Math.random() - .5) * 3.5),
        spin: new THREE.Vector3((Math.random() - .5) * 6, (Math.random() - .5) * 6, (Math.random() - .5) * 6),
        life: 2.2,
      });
    }
  }

  update(dt, player) {
    // ── feathers ──
    for (let i = this.feathers.length - 1; i >= 0; i--) {
      const f = this.feathers[i];
      f.life -= dt;
      f.vel.y -= 3.2 * dt;                 // feathers fall slowly
      f.vel.multiplyScalar(1 - 1.6 * dt);  // and drift
      f.mesh.position.addScaledVector(f.vel, dt);
      f.mesh.rotation.x += f.spin.x * dt;
      f.mesh.rotation.y += f.spin.y * dt;
      f.mesh.rotation.z += f.spin.z * dt;
      if (f.life <= 0) {
        this.featherGroup.remove(f.mesh);
        f.mesh.geometry.dispose();
        this.feathers.splice(i, 1);
      }
    }

    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i];
      if (c.state === ST.DEAD) { this.list.splice(i, 1); continue; }

      c.life -= dt;
      c.flap += dt * (c.state === ST.FLIGHT ? 22 : 13);

      if (c.state === ST.FLIGHT) {
        c.vel.y += CHICKEN.gravity * dt;
        c.obj.position.addScaledVector(c.vel, dt);
        c.obj.rotation.z += c.spin * dt;
        c.obj.rotation.y = c.yaw;

        const ground = this.world.groundHeight(c.obj.position.x, c.obj.position.z);
        if (c.obj.position.y <= ground) {
          c.obj.position.y = ground;
          c.obj.rotation.set(0, c.yaw, 0);
          c.state = ST.CHASE;
          this.sfx?.chickenLand?.();
        }
      } else {
        // ── chasing ──
        // it complains, quietly, about once a second
        c.talk -= dt;
        if (c.talk <= 0) {
          c.talk = CHICKEN.idleSound + (Math.random() - 0.5) * 2 * CHICKEN.idleJitter;
          this.sfx?.chickenIdle?.();
        }

        const to = _v.subVectors(player.pos, c.obj.position).setY(0);
        const dist = to.length();

        if (dist > 0.01) {
          const want = Math.atan2(-to.x, -to.z);
          let d = want - c.yaw;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          c.yaw += d * Math.min(1, CHICKEN.turnRate * dt);
        }

        const p = c.obj.position.clone();
        p.x += -Math.sin(c.yaw) * CHICKEN.chaseSpeed * dt;
        p.z += -Math.cos(c.yaw) * CHICKEN.chaseSpeed * dt;
        this.world.resolveHorizontal(p, CHICKEN.bodyRadius);
        c.obj.position.x = p.x;
        c.obj.position.z = p.z;
        c.obj.position.y = this.world.groundHeight(p.x, p.z) + Math.abs(Math.sin(c.flap)) * 0.09;
        c.obj.rotation.set(Math.sin(c.flap) * 0.12, c.yaw, Math.sin(c.flap * 0.5) * 0.1);

        // ── contact ──
        if (dist < CHICKEN.hitRadius) {
          this.onDamage?.(CHICKEN.damage, 'chicken');
          this.sfx?.chickenHit?.();
          this.kill(c, { silent: true });
          continue;
        }
      }

      if (c.life <= 0) this.kill(c, { silent: true });
    }
  }
}
