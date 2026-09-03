import * as THREE from 'three';
import { loadModel } from './Loaders.js';

// M1 greybox — a flat meadow with the cooking table at the exact centre
// (§6.1) and enough fences and rocks to make herding readable (§5.2).
// Replaced by the real Meadow map in M5; the collision interface stays.

export class Greybox {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];        // axis-aligned boxes: {x,z,hw,hd}
    this.bounds = 48;

    this._ground();
    this._table();
    this._fences();
    this._rocks();
    this._perimeter();
    this._trees();
  }

  // Pine trees — OBJECTS/Resource_PineTree_Group.fbx
  // Placed in a loose ring outside the play area plus a few clumps inside it,
  // so the meadow has a horizon and the interior has more cover to herd against.
  async _trees() {
    const proto = await loadModel('OBJECTS/Resource_PineTree_Group.fbx', { height: 7.5 });
    if (!proto) { console.warn('[world] pine trees unavailable'); return; }

    const place = (x, z, scale, collide) => {
      const t = proto.clone(true);
      t.position.set(x, this.groundHeight(x, z), z);
      t.rotation.y = Math.random() * Math.PI * 2;
      t.scale.multiplyScalar(scale);
      this.scene.add(t);
      if (collide) this.colliders.push({ x, z, hw: 0.9 * scale, hd: 0.9 * scale });
    };

    // treeline ringing the meadow — no collision, they sit outside the bounds
    const b = this.bounds + 6;
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + Math.random() * 0.09;
      const r = b + Math.random() * 22;
      place(Math.cos(a) * r, Math.sin(a) * r, 0.85 + Math.random() * 0.7, false);
    }

    // interior clumps — these DO collide, and give rabbits something to break around
    const clumps = [[-27, 22], [26, 26], [-30, -26], [31, -20], [-4, -30], [34, 8]];
    for (const [cx, cz] of clumps) {
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        place(cx + (Math.random() - .5) * 6, cz + (Math.random() - .5) * 6,
              0.75 + Math.random() * 0.5, true);
      }
    }
  }

  _ground() {
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x87b563, roughness: 1, metalness: 0 })
    );
    g.rotation.x = -Math.PI / 2;
    g.receiveShadow = true;
    this.scene.add(g);

    // subtle patchwork so motion is readable against the ground
    const patchMat = new THREE.MeshStandardMaterial({ color: 0x7ba758, roughness: 1 });
    for (let i = 0; i < 40; i++) {
      const s = 3 + Math.random() * 7;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(s, s), patchMat);
      p.rotation.x = -Math.PI / 2;
      p.rotation.z = Math.random() * Math.PI;
      p.position.set((Math.random() - .5) * 90, 0.01, (Math.random() - .5) * 90);
      p.receiveShadow = true;
      this.scene.add(p);
    }
  }

  _addBox(mesh, hw, hd) {
    this.scene.add(mesh);
    this.colliders.push({ x: mesh.position.x, z: mesh.position.z, hw, hd });
  }

  // The cooking table sits at the exact centre of the map. §6.1
  _table() {
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a3b, roughness: .9, flatShading: true });
    const stone = new THREE.MeshStandardMaterial({ color: 0x9a9188, roughness: 1, flatShading: true });

    const g = new THREE.Group();

    const top = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.22, 2.8), wood);
    top.position.y = 1.0;
    top.castShadow = true; top.receiveShadow = true;
    g.add(top);

    for (const [x, z] of [[-2, -1.2], [2, -1.2], [-2, 1.2], [2, 1.2]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.0, 0.26), stone);
      leg.position.set(x, 0.5, z);
      leg.castShadow = true;
      g.add(leg);
    }

    // four station markers: grinder, mixer, fryer, glaze
    const cols = [0x6d6a75, 0xd9c9a8, 0xd08a3a, 0xe4a8c0];
    cols.forEach((c, i) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.42, 0.62),
        new THREE.MeshStandardMaterial({ color: c, roughness: .8, flatShading: true }));
      m.position.set(-1.6 + i * 1.07, 1.32, 0);
      m.castShadow = true;
      g.add(m);
    });

    this.scene.add(g);
    this.colliders.push({ x: 0, z: 0, hw: 2.3, hd: 1.5 });
  }

  // Fences give the player something to herd rabbits INTO. §5.2
  _fences() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xa8804f, roughness: .95, flatShading: true });
    const runs = [
      { x: -16, z: -14, len: 16, axis: 'x' },
      { x:  10, z: -18, len: 14, axis: 'z' },
      { x:  16, z:  12, len: 18, axis: 'x' },
      { x: -20, z:   6, len: 12, axis: 'z' },
      { x:  -4, z:  20, len: 12, axis: 'x' },
    ];
    for (const r of runs) {
      const n = Math.round(r.len / 2);
      for (let i = 0; i < n; i++) {
        const off = (i - n / 2) * 2;
        const px = r.axis === 'x' ? r.x + off : r.x;
        const pz = r.axis === 'x' ? r.z : r.z + off;

        const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 0.16), mat);
        post.position.set(px, 0.55, pz);
        post.castShadow = true;
        this.scene.add(post);

        const railGeo = r.axis === 'x'
          ? new THREE.BoxGeometry(2, 0.11, 0.08)
          : new THREE.BoxGeometry(0.08, 0.11, 2);
        for (const h of [0.45, 0.85]) {
          const rail = new THREE.Mesh(railGeo, mat);
          rail.position.set(px + (r.axis === 'x' ? 1 : 0), h, pz + (r.axis === 'z' ? 1 : 0));
          rail.castShadow = true;
          this.scene.add(rail);
        }
        this.colliders.push({
          x: px + (r.axis === 'x' ? 1 : 0), z: pz + (r.axis === 'z' ? 1 : 0),
          hw: r.axis === 'x' ? 1.0 : 0.14,
          hd: r.axis === 'z' ? 1.0 : 0.14,
        });
      }
    }
  }

  _rocks() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x8e8b86, roughness: 1, flatShading: true });
    const spots = [[-9, 9], [-7.5, 11], [14, -6], [16, -8], [-18, -4], [6, 15], [8, 17], [22, 3]];
    for (const [x, z] of spots) {
      const s = 0.7 + Math.random() * 0.9;
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat);
      r.position.set(x, s * 0.55, z);
      r.rotation.set(Math.random(), Math.random(), Math.random());
      r.castShadow = true; r.receiveShadow = true;
      this.scene.add(r);
      this.colliders.push({ x, z, hw: s * 0.8, hd: s * 0.8 });
    }
  }

  // Soft walls so nobody wanders into the void.
  _perimeter() {
    const b = this.bounds;
    const mat = new THREE.MeshStandardMaterial({ color: 0x6f9c52, roughness: 1, flatShading: true });
    for (const [x, z, w, d] of [[0, -b, b, 1], [0, b, b, 1], [-b, 0, 1, b], [b, 0, 1, b]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w * 2, 2.2, d * 2), mat);
      m.position.set(x, 1.1, z);
      m.receiveShadow = true;
      this.scene.add(m);
      this.colliders.push({ x, z, hw: w, hd: d });
    }
  }

  groundHeight() { return 0; }

  // Push a point out of any box it has entered, along the shallowest axis.
  resolveHorizontal(pos, radius) {
    for (const c of this.colliders) {
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const ox = c.hw + radius - Math.abs(dx);
      const oz = c.hd + radius - Math.abs(dz);
      if (ox > 0 && oz > 0) {
        if (ox < oz) pos.x += dx >= 0 ? ox : -ox;
        else         pos.z += dz >= 0 ? oz : -oz;
      }
    }
    const lim = this.bounds - 1.5;
    pos.x = Math.max(-lim, Math.min(lim, pos.x));
    pos.z = Math.max(-lim, Math.min(lim, pos.z));
    return pos;
  }
}
