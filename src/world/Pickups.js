import * as THREE from 'three';
import { loadModel } from './Loaders.js';

// Hidden coins scattered around the map.
//
// Deliberately tucked BEHIND cover — the far side of rocks, the backs of fence
// runs, the map edges — so exploring the level pays, and so there is a reason to
// walk somewhere other than the straight line between you and a rabbit.
// Uses OBJECTS/Coin by Quaternius with a procedural fallback.

const COIN_URL = 'OBJECTS/Coin by Quaternius - 7IrL01B97W/Coin.fbx';

export class Pickups {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.coins = [];
    this.onCollect = null;

    this.group = new THREE.Group();
    scene.add(this.group);

    this._proto = this._fallbackMesh();
    this._loadReal();
  }

  _fallbackMesh() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.035, 12),
      new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: .45, metalness: .25,
        emissive: 0x7a5a12, emissiveIntensity: .55, flatShading: true })
    );
    m.rotation.x = Math.PI / 2;
    m.castShadow = true;
    g.add(m);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.022, 5, 14),
      new THREE.MeshStandardMaterial({ color: 0xb8860b, roughness: .5, metalness: .25,
        emissive: 0x5c4208, emissiveIntensity: .5 })
    );
    g.add(rim);
    return g;
  }

  async _loadReal() {
    const m = await loadModel(COIN_URL, { height: 0.34, color: 0xf2c14e, roughness: 0.45 });
    if (!m) return;
    // High metalness with no environment map reflects nothing and reads as
    // black. Keep it mostly dielectric and fake the shine with emissive.
    m.traverse(o => {
      if (!o.isMesh) return;
      o.material.metalness = 0.25;
      o.material.emissive = new THREE.Color(0x7a5a12);
      o.material.emissiveIntensity = 0.55;
    });
    this._proto = m;
    // swap any already-spawned coins over to the real mesh
    for (const c of this.coins) {
      if (c.taken) continue;
      const fresh = this._proto.clone(true);
      fresh.position.copy(c.obj.position);
      this.group.remove(c.obj);
      this.group.add(fresh);
      c.obj = fresh;
    }
  }

  // Placed by hand rather than at random: every one of these is behind
  // something, so it has to be looked for.
  scatterHidden() {
    const spots = [
      // tucked behind the rock clusters
      [-10.2,  10.4], [-6.6, 12.1], [15.1, -7.4], [17.3, -9.2], [-19.4, -5.1],
      [5.2, 16.3], [8.9, 18.2], [23.1, 4.2],
      // along the blind sides of the fence runs
      [-16, -15.4], [-9, -15.4], [-22, -15.4],
      [11.4, -22], [11.4, -14], [17.4, 13.5], [23, 13.5], [9.5, 13.5],
      [-21.2, 3], [-21.2, 9], [-5, 21.4], [1, 21.4],
      // under the cooking table, which nobody looks at
      [-1.4, 0.9], [1.5, -0.8],
      // far corners of the meadow
      [-40, -40], [40, -40], [-40, 40], [40, 40], [0, -43], [-43, 0],
    ];

    for (const [x, z] of spots) this.spawn(x, z);
    return this.coins.length;
  }

  spawn(x, z, value = 25) {
    const obj = this._proto.clone(true);
    const y = this.world.groundHeight(x, z) + 0.42;
    obj.position.set(x, y, z);
    this.group.add(obj);
    const c = {
      obj, value, taken: false,
      baseY: y,
      spin: Math.random() * Math.PI * 2,
      pull: 0,
    };
    this.coins.push(c);
    return c;
  }

  update(dt, playerPos) {
    const t = performance.now() * 0.001;

    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      if (c.taken) {
        // fly to the player and shrink out
        c.pull += dt * 3.2;
        c.obj.position.lerp(playerPos, Math.min(1, dt * 9));
        c.obj.scale.multiplyScalar(1 - Math.min(1, dt * 4));
        c.obj.rotation.y += dt * 22;
        if (c.pull > 0.45) {
          this.group.remove(c.obj);
          this.coins.splice(i, 1);
        }
        continue;
      }

      c.spin += dt * 1.9;
      c.obj.rotation.y = c.spin;
      c.obj.position.y = c.baseY + Math.sin(t * 2.1 + c.spin) * 0.07;

      // generous pickup radius — finding it is the challenge, not touching it
      const dx = c.obj.position.x - playerPos.x;
      const dz = c.obj.position.z - playerPos.z;
      const dy = c.obj.position.y - playerPos.y;
      if (dx * dx + dz * dz < 2.1 * 2.1 && Math.abs(dy) < 2.4) {
        c.taken = true;
        this.onCollect?.(c.value);
      }
    }
  }

  get remaining() { return this.coins.filter(c => !c.taken).length; }
}
