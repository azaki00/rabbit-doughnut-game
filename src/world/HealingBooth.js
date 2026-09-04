import * as THREE from 'three';
import { loadModel } from './Loaders.js';

// THE HEALING BOOTH.
//
// Health is otherwise unrecoverable — the only things that take it are the
// Sovereign and its chickens, and nothing gives it back. This is where you buy
// it back, and it is deliberately expensive:
//
//   · 300c   patched up on the spot, back to full
//   · 150c   one shake to carry, used with H wherever you are
//
// The carried one costs half as much and heals half as much, which makes it
// the better deal only if you actually take it INTO the fight. Buying two and
// walking to the egg is the correct play; walking back here mid-fight is not.

// The purpose-made shopkeeper. Donut Guy stood in until this arrived.
const KEEPER_DIR = 'OBJECTS/shop-old-man/';
const KEEPER_URL = KEEPER_DIR + 'model.obj';
// its MTL is `materials.mtl`, not `model.mtl` — the usual trap
const KEEPER_MTL = KEEPER_DIR + 'materials.mtl';

export const HEAL = {
  fullPrice: 300,
  itemPrice: 150,
  itemHeal: 0.5,        // fraction of max health one carried item restores
  useRadius: 3.4,
  maxCarried: 4,
};

// The clinic is pitched in front of the Cottage — its own landmark on the far
// side of the meadow, rather than one more counter crowded round the table.
export function clinicSpot(world) {
  const cottage = world.buildingSpots?.[1];
  if (!cottage) return new THREE.Vector3(-4.6, 0, 3.2);
  const len = Math.hypot(cottage.x, cottage.z) || 1;
  // step back IN toward the meadow, so it faces the field and not the trees
  const p = new THREE.Vector3(
    cottage.x - (cottage.x / len) * 9,
    0,
    cottage.z - (cottage.z / len) * 9,
  );
  world.resolveHorizontal(p, 2.4);
  return p;
}

export class HealingBooth {
  constructor(scene, world, position, sfx) {
    this.world = world;
    this.sfx = sfx;
    this.pos = position.clone();
    this.pos.y = world.groundHeight(position.x, position.z);

    this.root = new THREE.Group();
    this.root.position.copy(this.pos);
    // face the middle of the map, so you walk up to the counter, not the back
    this.root.rotation.y = Math.atan2(-this.pos.x, -this.pos.z) + Math.PI;
    scene.add(this.root);

    this.bobT = Math.random() * 10;
    this._build();
    this._buildKeeperFallback();
    this._loadKeeper();

    // it is a solid thing you can walk into
    world.colliders.push({ x: this.pos.x, z: this.pos.z, hw: 1.2, hd: 0.75 });
  }

  _build() {
    const white = new THREE.MeshStandardMaterial({ color: 0xf3f6f8, roughness: .85, flatShading: true });
    const trim = new THREE.MeshStandardMaterial({ color: 0x3aa3a0, roughness: .7, flatShading: true });
    const red = new THREE.MeshStandardMaterial({
      color: 0xe0453f, roughness: .55, flatShading: true,
      emissive: 0x5a1210, emissiveIntensity: .8,
    });

    // counter
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.05, 1.0), white);
    counter.position.y = 0.525;
    counter.castShadow = true; counter.receiveShadow = true;
    this.root.add(counter);

    const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 1.2), trim);
    top.position.y = 1.10;
    top.castShadow = true;
    this.root.add(top);

    // back wall with a cabinet feel
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.3, 0.14), white);
    back.position.set(0, 1.15, -0.62);
    back.castShadow = true;
    this.root.add(back);

    // the cross, floating in front of the back wall, glowing
    this.cross = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.19, 0.10), red);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.62, 0.10), red);
    this.cross.add(bar, post);
    this.cross.position.set(0, 1.85, -0.5);
    this.root.add(this.cross);

    // a shelf of shakes, so what you are buying is visible on the counter
    this.bottles = [];
    for (let i = 0; i < 3; i++) {
      const b = buildShake();
      b.position.set(-0.6 + i * 0.6, 1.15, 0.15);
      b.scale.setScalar(0.9);
      this.root.add(b);
      this.bottles.push(b);
    }

    this.glow = new THREE.PointLight(0xff8f88, 1.3, 7, 2);
    this.glow.position.set(0, 1.7, 0.5);
    this.root.add(this.glow);
  }

  // THE OLD SHOP MAN.
  // Stands at the end of the counter rather than behind it, so he reads as a
  // person you walk up to and not as part of the furniture.
  _buildKeeperFallback() {
    const coat = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: .9, flatShading: true });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd8a883, roughness: .85, flatShading: true });

    this.keeper = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 4, 8), coat);
    body.position.y = 0.72;
    body.castShadow = true;
    this.keeper.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 9, 7), skin);
    head.position.y = 1.24;
    head.castShadow = true;
    this.keeper.add(head);

    this.keeper.position.set(1.55, 0, 0.15);
    this.root.add(this.keeper);
  }

  async _loadKeeper() {
    const m = await loadModel(KEEPER_URL, { height: 1.55, mtl: KEEPER_MTL });
    if (!m) { console.warn('[clinic] shop man unavailable, using fallback'); return; }
    m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.root.remove(this.keeper);
    this.keeper = m;
    // beside the counter, turned a few degrees toward the customer
    this.keeper.position.set(1.6, 0, 0.2);
    this.keeperYaw = -0.5;
    this.keeper.rotation.y = this.keeperYaw;
    this.root.add(m);
  }

  canUse(playerPos) {
    return this.pos.distanceTo(playerPos) < HEAL.useRadius;
  }

  update(dt) {
    this.bobT += dt;
    this.cross.rotation.y = Math.sin(this.bobT * 0.8) * 0.35;
    this.cross.position.y = 1.85 + Math.sin(this.bobT * 1.6) * 0.05;
    this.glow.intensity = 1.15 + Math.sin(this.bobT * 2.4) * 0.3;
    for (let i = 0; i < this.bottles.length; i++) {
      this.bottles[i].rotation.y = this.bobT * 0.6 + i * 1.2;
    }
    // he shifts his weight and glances about, the way a bored shopkeeper does
    if (this.keeper) {
      const yaw = this.keeperYaw ?? 0;
      this.keeper.rotation.y = yaw + Math.sin(this.bobT * 0.55) * 0.28;
      this.keeper.position.y = Math.abs(Math.sin(this.bobT * 1.3)) * 0.025;
    }
  }
}

// A protein-shake-shaped bottle. Also used for the viewmodel-free "you used
// one" flourish, and it is the same silhouette as the Sovereign's drop.
export function buildShake() {
  const g = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.088, 0.26, 9),
    new THREE.MeshStandardMaterial({ color: 0xe8556a, roughness: .5, flatShading: true }),
  );
  body.position.y = 0.13;
  body.castShadow = true;
  g.add(body);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.07, 9),
    new THREE.MeshStandardMaterial({ color: 0x3aa3a0, roughness: .55, flatShading: true }),
  );
  cap.position.y = 0.29;
  g.add(cap);

  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.07, 9),
    new THREE.MeshStandardMaterial({ color: 0xf7f2e6, roughness: .8, flatShading: true }),
  );
  band.position.y = 0.14;
  g.add(band);

  return g;
}
