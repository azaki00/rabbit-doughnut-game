import * as THREE from 'three';
import { loadModel } from './Loaders.js';

// MEAT ON THE GROUND.
//
// Shooting a rabbit no longer pays you. It drops a slab of meat where it fell,
// and you are paid when you walk over and pick it up.
//
// This is the point of the gun's whole cost structure. The report empties the
// field for 40m, and now the shot also forces you to walk INTO that emptied
// space to collect — so the easy option makes you commit, out in the open,
// while everything worth catching is still running.
//
// Every slab is the size and colour of what it came off: a Jack leaves a long
// dark cut, a Lop leaves a pale fatty one, and the Black Rabbit leaves
// something you probably should not eat.

const STEAK_DIR = 'OBJECTS/Raw Steak by S. Paul Michael - ewc8PTlad7b/';
const STEAK_URL = STEAK_DIR + 'model.obj';
// Its MTL is `materials.mtl`, NOT `model.mtl` — the same trap the grass set.
// Without the explicit path the whole slab arrives flat white and every cut
// looks identical.
const STEAK_MTL = STEAK_DIR + 'materials.mtl';
// and the two materials inside it: the lean and the marbling
const LEAN_MAT = 'mat8';

export const MEAT = {
  pickupRadius: 1.9,
  verticalReach: 2.4,
  life: 90,             // eventually rots away, so a bad session does not litter
  bob: 0.06,
};

export class MeatDrops {
  constructor(scene, world, sfx) {
    this.scene = scene;
    this.world = world;
    this.sfx = sfx;
    this.list = [];
    this.onCollect = null;      // (value, label) => void

    this.group = new THREE.Group();
    scene.add(this.group);

    this.proto = null;
    this.fallback = this._buildFallback();
    this._loadReal();
  }

  _buildFallback() {
    const g = new THREE.Group();
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.09, 0.30),
      new THREE.MeshStandardMaterial({ color: 0xb8241c, roughness: .78, flatShading: true }));
    slab.castShadow = true;
    g.add(slab);
    const fat = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.035, 0.09),
      new THREE.MeshStandardMaterial({ color: 0xf0c08a, roughness: .85, flatShading: true }));
    fat.position.set(0, 0.03, -0.13);
    g.add(fat);
    return g;
  }

  async _loadReal() {
    // The slab is long and thin — fit by the largest axis, never by height.
    const m = await loadModel(STEAK_URL, { maxSize: 0.62, mtl: STEAK_MTL });
    if (!m) { console.warn('[meat] steak model unavailable, using fallback'); return; }
    m.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true;
    });
    this.proto = m;
  }

  // `cut` describes the animal: { scale, color, fat, label, value }.
  drop(position, cut) {
    const obj = (this.proto ?? this.fallback).clone(true);

    // Recolour per-material: the model's two materials are the lean (a deep
    // red) and the fat (a pale cream). Tint each toward the cut's colours so a
    // Jack steak and a Lop steak are visibly different objects.
    obj.traverse(o => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const rebuilt = mats.map(src => {
        // Go by material NAME, not by brightness: `prepare()` can lift a dark
        // source colour and then both materials look like fat.
        let lean = src?.name === LEAN_MAT;
        if (!src?.name && src?.color) {
          const c = src.color;
          lean = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b < 0.45;
        }
        return new THREE.MeshStandardMaterial({
          name: src?.name ?? '',
          color: lean ? cut.color : cut.fat,
          roughness: 0.74,
          metalness: 0,
          flatShading: true,
        });
      });
      o.material = Array.isArray(o.material) ? rebuilt : rebuilt[0];
    });

    // The model is authored standing on its edge — thin along X, long along Z.
    // Roll it a quarter turn so the thin axis is vertical and it lies flat on
    // the grass like something dropped, not like a fin planted in the dirt.
    const lay = new THREE.Group();
    obj.rotation.z = Math.PI / 2;
    lay.add(obj);

    const y = this.world.groundHeight(position.x, position.z) + 0.07 * cut.scale;
    lay.position.set(position.x, y, position.z);
    lay.scale.setScalar(cut.scale);
    lay.rotation.y = Math.random() * Math.PI * 2;
    this.group.add(lay);

    const drop = {
      obj: lay,
      value: cut.value,
      label: cut.label,
      baseY: y,
      spin: Math.random() * Math.PI * 2,
      life: MEAT.life,
      taken: false,
      pull: 0,
    };
    this.list.push(drop);
    this.sfx?.meatDrop?.();
    return drop;
  }

  get pending() { return this.list.filter(d => !d.taken).length; }

  update(dt, playerPos) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const d = this.list[i];

      if (d.taken) {
        // fly to the player and shrink out, same as a coin
        d.pull += dt * 3.2;
        d.obj.position.lerp(playerPos, Math.min(1, dt * 9));
        d.obj.scale.multiplyScalar(1 - Math.min(1, dt * 4));
        d.obj.rotation.y += dt * 16;
        if (d.pull > 0.45) {
          this.group.remove(d.obj);
          this.list.splice(i, 1);
        }
        continue;
      }

      d.spin += dt * 0.9;
      d.obj.rotation.y = d.spin;
      d.obj.position.y = d.baseY + Math.sin(d.spin * 2.1) * MEAT.bob;

      d.life -= dt;
      if (d.life <= 0) {
        this.group.remove(d.obj);
        this.list.splice(i, 1);
        continue;
      }

      const dx = d.obj.position.x - playerPos.x;
      const dz = d.obj.position.z - playerPos.z;
      const dy = d.obj.position.y - playerPos.y;
      if (dx * dx + dz * dz < MEAT.pickupRadius * MEAT.pickupRadius &&
          Math.abs(dy) < MEAT.verticalReach) {
        d.taken = true;
        this.onCollect?.(d.value, d.label);
      }
    }
  }
}
