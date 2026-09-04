import * as THREE from 'three';
import { loadModel } from './Loaders.js';

// THE TRADER and THE CARROT.
//
// A hamster stands near the cooking table and sells carrots at 5c. Drop one and
// every rabbit that notices it abandons whatever it was doing, walks over, and
// stands there eating. It lasts 5 seconds, or less if a rabbit actually reaches
// it and finishes it off.
//
// This is the counterplay to the lunge: instead of chasing a rabbit that flees
// at the sound of you, you pay 5c to make it come to you and hold still.

const HAMSTER_URL = 'OBJECTS/Hamster by Poly by Google - aRz6-f8rnMq/Hamster_01.obj';

export const CARROT = {
  price: 5,
  lifetime: 5.0,        // seconds before it rots away untouched
  // Only lure rabbits that can actually ARRIVE inside the 5s life. Pulling in
  // one from 25m just showed it sprinting at a carrot that vanished first,
  // which reads as broken rather than as a near miss.
  lureRadius: 14,
  eatRadius: 0.9,       // how close a rabbit must get to start eating
  eatTime: 1.6,         // how long one rabbit needs to finish it
  throwDistance: 4.5,
  throwSpeed: 9,
};

// ── procedural carrot ──
function buildCarrot() {
  const g = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.085, 0.34, 7),
    new THREE.MeshStandardMaterial({ color: 0xe8761f, roughness: .72, flatShading: true })
  );
  body.rotation.x = Math.PI;          // point down
  body.position.y = 0.17;
  body.castShadow = true;
  g.add(body);

  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4f9c34, roughness: .85, flatShading: true });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.15, 0.028), leafMat);
    leaf.position.set(Math.cos(a) * 0.03, 0.40, Math.sin(a) * 0.03);
    leaf.rotation.set(Math.cos(a) * 0.4, 0, Math.sin(a) * -0.4);
    leaf.castShadow = true;
    g.add(leaf);
  }
  return g;
}

export class Carrots {
  constructor(scene, world, sfx) {
    this.scene = scene;
    this.world = world;
    this.sfx = sfx;

    this.active = [];                 // dropped carrots
    this.proto = buildCarrot();

    this.group = new THREE.Group();
    scene.add(this.group);

    // ── the trader ──
    // Tucked in BEHIND the timber house rather than out on the green. You have
    // to walk round the back of it to find him, which is the right shape for a
    // man selling you a carrot that makes rabbits stand still.
    this.traderPos = this._behindHouse();
    this.trader = new THREE.Group();
    this.trader.position.copy(this.traderPos);
    // The stall's front is its +Z side (posts at the back, carrots on the front
    // of the counter). Turn it to face back toward the meadow, so the moment
    // you come round the corner of the house you are looking at the counter.
    this.trader.rotation.y = Math.atan2(-this.traderPos.x, -this.traderPos.z);
    scene.add(this.trader);

    this._buildStall();
    this._buildTraderFallback();
    this._loadTrader();

    // a big slowly-turning carrot floating over the stall — the shop sign
    this.sign = this.proto.clone(true);
    this.sign.scale.setScalar(3.2);
    this.sign.position.set(0, 1.75, 0);
    this.trader.add(this.sign);

    // A warm light so the stall is findable across the meadow — hung at the
    // FRONT edge of the awning, not at the middle of the counter. At (0,1.5,0)
    // it sat inside the hamster: with DoubleSide materials that lit his inner
    // faces, blew out his middle, and left the outside we actually look at in
    // shadow. He read as a featureless dark cone.
    this.glow = new THREE.PointLight(0xffc46b, 1.5, 9, 2);
    this.glow.position.set(0, 1.95, 0.62);
    this.trader.add(this.glow);

    this.bobT = 0;
    // The model is authored facing -Z; the stall's customer side is +Z, so he
    // needs turning right round or you get a shopkeeper's back.
    this.faceYaw = Math.PI;
  }

  // Behind House_1 — the first of the world's building spots — measured from
  // the map centre, so if the house moves the stall moves with it.
  _behindHouse() {
    const house = this.world.buildingSpots?.[0];
    if (!house) return new THREE.Vector3(-4.6, 0, 3.2);

    const len = Math.hypot(house.x, house.z) || 1;
    const ax = house.x / len, az = house.z / len;   // outward, away from centre

    // far enough past the house to leave room to stand at the counter, and
    // nudged out of anything solid it would otherwise be standing in
    const p = new THREE.Vector3(house.x + ax * 8.5, 0, house.z + az * 8.5);
    this.world.resolveHorizontal(p, 2.4);
    return p;
  }

  // A market stall, so the trader is a landmark rather than a small animal
  // lost in the grass.
  _buildStall() {
    const wood = new THREE.MeshStandardMaterial({ color: 0x9a6a3c, roughness: .88, flatShading: true });
    const cloth = new THREE.MeshStandardMaterial({ color: 0xe0596f, roughness: .95, flatShading: true, side: THREE.DoubleSide });

    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 1.1), wood);
    counter.position.y = 0.95;
    counter.castShadow = true; counter.receiveShadow = true;
    this.trader.add(counter);

    for (const [x, z] of [[-1.0, -0.45], [1.0, -0.45], [-1.0, 0.45], [1.0, 0.45]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.95, 0.14), wood);
      leg.position.set(x, 0.475, z);
      leg.castShadow = true;
      this.trader.add(leg);
    }

    // striped awning
    for (let i = 0; i < 5; i++) {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.44, 0.06, 1.5),
        i % 2 ? cloth : new THREE.MeshStandardMaterial({ color: 0xfdf3e3, roughness: .95, flatShading: true })
      );
      panel.position.set(-0.88 + i * 0.44, 2.05, 0);
      panel.rotation.x = 0.16;
      panel.castShadow = true;
      this.trader.add(panel);
    }
    for (const x of [-1.05, 1.05]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.05, 0.1), wood);
      post.position.set(x, 1.02, -0.5);
      post.castShadow = true;
      this.trader.add(post);
    }

    // a few carrots laid out on the counter
    for (let i = 0; i < 3; i++) {
      const c = buildCarrot();
      c.scale.setScalar(0.85);
      c.position.set(-0.5 + i * 0.5, 1.03, 0.15);
      c.rotation.z = Math.PI / 2;
      c.rotation.y = i * 0.5;
      this.trader.add(c);
    }
  }

  _buildTraderFallback() {
    this.fallback = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xc79a63, roughness: .9, flatShading: true })
    );
    this.fallback.scale.set(1, 0.85, 1.25);
    this.fallback.position.set(0, 1.42, -0.2);
    this.fallback.castShadow = true;
    this.trader.add(this.fallback);
  }

  async _loadTrader() {
    // Hamster_01.mtl ships `d 0.000000` (fully dissolved) on all four of its
    // materials, so for a long time he loaded, sized and positioned perfectly
    // and rendered nothing at all. That is un-dissolved centrally now — see
    // Loaders.prepare().
    //
    // 0.82m stood on a 1.03m counter puts his head at eye level for someone
    // walking up. He was 1.15m while invisible, which turned out to be taller
    // than the awning posts once he could actually be seen.
    const m = await loadModel(HAMSTER_URL, { height: 0.82, mtl: true });
    if (!m) { console.warn('[trader] hamster unavailable, using fallback'); return; }
    this.trader.remove(this.fallback);
    m.position.set(0, 1.03, -0.1);
    m.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
    });
    this.trader.add(m);
    this.hamster = m;
  }

  canTrade(playerPos) {
    return this.traderPos.distanceTo(playerPos) < 3.6;
  }

  // Lob one out in front of the player rather than dropping it at their feet —
  // a carrot underfoot would pull rabbits into lunge range from behind you.
  drop(fromPos, flatForward) {
    const p = fromPos.clone().addScaledVector(flatForward, CARROT.throwDistance);
    this.world.resolveHorizontal(p, 0.3);
    p.y = this.world.groundHeight(p.x, p.z);

    const obj = this.proto.clone(true);
    obj.position.copy(fromPos).setY(fromPos.y - 0.4);
    this.group.add(obj);

    const carrot = {
      obj,
      target: p.clone(),
      from: obj.position.clone(),
      flight: 0,
      flightTime: fromPos.distanceTo(p) / CARROT.throwSpeed,
      landed: false,
      life: CARROT.lifetime,
      eaten: 0,
      eater: null,
      spin: Math.random() * Math.PI * 2,
    };
    this.active.push(carrot);
    this.sfx?.carrotDrop?.();
    return carrot;
  }

  // The nearest live, landed carrot within lure range — what a rabbit walks to.
  lureFor(pos) {
    let best = null, bestD = CARROT.lureRadius;
    for (const c of this.active) {
      if (!c.landed) continue;
      const d = pos.distanceTo(c.target);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  update(dt, rabbits) {
    this.bobT += dt;

    // the hamster fidgets; the stall itself stays put
    const who = this.hamster ?? this.fallback;
    if (who) {
      // He faces out over the counter, glancing side to side for customers.
      who.rotation.y = this.faceYaw + Math.sin(this.bobT * 0.7) * 0.35;
      who.position.y = 1.03 + Math.abs(Math.sin(this.bobT * 2.6)) * 0.04;
    }
    this.sign.rotation.y = this.bobT * 1.1;
    this.sign.position.y = 1.75 + Math.sin(this.bobT * 1.8) * 0.12;
    this.glow.intensity = 1.4 + Math.sin(this.bobT * 2.0) * 0.35;

    for (let i = this.active.length - 1; i >= 0; i--) {
      const c = this.active[i];

      // ── in flight ──
      if (!c.landed) {
        c.flight += dt;
        const t = Math.min(1, c.flight / Math.max(0.001, c.flightTime));
        c.obj.position.lerpVectors(c.from, c.target, t);
        c.obj.position.y += Math.sin(t * Math.PI) * 1.1;     // arc
        c.obj.rotation.x += dt * 9;
        if (t >= 1) { c.landed = true; c.obj.rotation.set(0, 0, 0); }
        continue;
      }

      // ── on the ground ──
      c.spin += dt * 1.4;
      c.obj.rotation.y = c.spin;
      c.obj.position.y = c.target.y + Math.sin(this.bobT * 3 + c.spin) * 0.03;

      c.life -= dt;

      // Is anyone eating it? The first rabbit to arrive claims it.
      let eaterHere = false;
      for (const r of rabbits) {
        if (!r.alive || r.caught) continue;
        if (r.position.distanceTo(c.target) <= CARROT.eatRadius) { eaterHere = true; break; }
      }
      if (eaterHere) {
        c.eaten += dt;
        // wobble as it is nibbled, and visibly shrink
        const left = Math.max(0.15, 1 - c.eaten / CARROT.eatTime);
        c.obj.scale.setScalar(left);
      }

      if (c.eaten >= CARROT.eatTime || c.life <= 0) {
        this.group.remove(c.obj);
        this.active.splice(i, 1);
        if (c.eaten >= CARROT.eatTime) this.sfx?.carrotEaten?.();
      }
    }
  }
}
