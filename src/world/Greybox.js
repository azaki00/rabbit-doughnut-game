import * as THREE from 'three';
import { loadModel, flattenToGeometry } from './Loaders.js';

// M1 greybox — a flat meadow with the cooking table at the exact centre
// (§6.1) and enough fences and rocks to make herding readable (§5.2).
// Replaced by the real Meadow map in M5; the collision interface stays.

export class Greybox {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];        // axis-aligned boxes: {x,z,hw,hd}
    this.bounds = 48;

    // Building plots, declared up front so the tree scatter can avoid them —
    // otherwise a clump lands on the Cottage and hides it completely.
    this.buildingSpots = [
      { x: -34, z:   6, yaw: Math.PI * 0.42 },   // House_1
      { x:  14, z:  33, yaw: -Math.PI * 0.30 },  // Cottage
    ];

    // Where the interior tree clumps go. Declared HERE rather than inside the
    // async `_trees()`, because anything that needs to avoid the trees — the
    // cell, for one — is placed long before the models finish loading, and a
    // clearance check against a collider list that is still empty passes
    // everything.
    this.treeClumps = [[-27, 22], [26, 26], [-30, -26], [31, -20], [-4, -30], [34, 8]];
    this.clumpRadius = 7;   // spread of a clump plus its canopy

    this._ground();
    this._table();
    this._fences();
    this._rocks();
    this._perimeter();
    this._trees();
    this._buildings();
    this._grass();
  }

  // Pine trees — OBJECTS/Resource_PineTree_Group.fbx
  // Placed in a loose ring outside the play area plus a few clumps inside it,
  // so the meadow has a horizon and the interior has more cover to herd against.
  async _trees() {
    const [pine, leafy] = await Promise.all([
      loadModel('OBJECTS/Resource_PineTree_Group.fbx', {
        height: 7.5, recolor: { Wood: 0x6f4a2c, Green: 0x3f6b31 } }),
      loadModel('OBJECTS/Resource_Tree_Group.fbx', {
        height: 6.4, recolor: { Wood: 0x7a5433, Green: 0x5c8a3a } }),
    ]);
    const protos = [pine, leafy].filter(Boolean);
    if (!protos.length) { console.warn('[world] trees unavailable'); return; }

    const place = (x, z, scale, collide) => {
      // mix the two species so the treeline isn't a wall of identical pines
      const proto = protos[Math.random() < 0.55 ? 0 : protos.length - 1];
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
    const clumps = this.treeClumps
      .filter(([cx, cz]) => !this.buildingSpots.some(b => Math.hypot(cx - b.x, cz - b.z) < 15));
    for (const [cx, cz] of clumps) {
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        place(cx + (Math.random() - .5) * 6, cz + (Math.random() - .5) * 6,
              0.75 + Math.random() * 0.5, true);
      }
    }
  }

  // Procedurally generated grass texture. Two layers at different scales: a
  // fine tiling one for close-up detail, and a large low-frequency "macro"
  // overlay that breaks up the obvious repetition when you look into the
  // distance. Generating it beats shipping a PNG and keeps the palette in code.
  _grassTexture(size = 512, tint = [0.42, 0.62, 0.30]) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const [hr, hg, hb] = tint;

    ctx.fillStyle = `rgb(${hr * 255 | 0},${hg * 255 | 0},${hb * 255 | 0})`;
    ctx.fillRect(0, 0, size, size);

    // soft mottling — patches of lighter and darker turf
    for (let i = 0; i < 260; i++) {
      const r = 12 + Math.random() * 64;
      const x = Math.random() * size, y = Math.random() * size;
      const d = (Math.random() - 0.5) * 0.22;
      const cr = Math.min(255, Math.max(0, (hr + d) * 255)) | 0;
      const cg = Math.min(255, Math.max(0, (hg + d) * 255)) | 0;
      const cb = Math.min(255, Math.max(0, (hb + d * 0.7) * 255)) | 0;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},0.5)`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    // individual blades, so it reads as grass rather than as noise
    for (let i = 0; i < 5200; i++) {
      const x = Math.random() * size, y = Math.random() * size;
      const len = 3 + Math.random() * 7;
      const lean = (Math.random() - 0.5) * 4;
      const d = (Math.random() - 0.5) * 0.34;
      const cr = Math.min(255, Math.max(0, (hr + d) * 255)) | 0;
      const cg = Math.min(255, Math.max(0, (hg + d) * 255)) | 0;
      const cb = Math.min(255, Math.max(0, (hb + d * 0.6) * 255)) | 0;
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.55)`;
      ctx.lineWidth = 1 + Math.random();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + lean, y - len);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  _ground() {
    const detail = this._grassTexture(512, [0.42, 0.62, 0.30]);
    detail.repeat.set(70, 70);

    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200, 1, 1),
      new THREE.MeshStandardMaterial({ map: detail, roughness: 1, metalness: 0 })
    );
    g.rotation.x = -Math.PI / 2;
    g.receiveShadow = true;
    this.scene.add(g);
    this.groundMat = g.material;

    // Macro layer: the same generator at a huge scale, laid just above the
    // ground and blended in. Kills the visible tiling grid at distance.
    const macro = this._grassTexture(512, [0.40, 0.60, 0.28]);
    macro.repeat.set(5, 5);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200, 1, 1),
      new THREE.MeshStandardMaterial({
        map: macro, transparent: true, opacity: 0.38,
        roughness: 1, metalness: 0, depthWrite: false,
      })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.012;
    this.scene.add(m);

    // worn dirt ring around the cooking table, where the player actually walks
    const dirt = new THREE.Mesh(
      new THREE.CircleGeometry(7.5, 40),
      new THREE.MeshStandardMaterial({
        color: 0x8a7550, roughness: 1, transparent: true, opacity: 0.42,
        depthWrite: false,
      })
    );
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.y = 0.02;
    this.scene.add(dirt);
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

    // four station markers: grinder, mixer, fryer, glaze.
    // `stations` is the world position of each box's TOP face — anything meant
    // to sit or float above a station hangs off these rather than re-deriving
    // the layout. Station 0 carries the Tenderiser on display.
    const cols = [0x6d6a75, 0xd9c9a8, 0xd08a3a, 0xe4a8c0];
    const BOX_H = 0.42;
    this.stations = [];
    cols.forEach((c, i) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, BOX_H, 0.62),
        new THREE.MeshStandardMaterial({ color: c, roughness: .8, flatShading: true }));
      m.position.set(-1.6 + i * 1.07, 1.32, 0);
      m.castShadow = true;
      g.add(m);
      this.stations.push(new THREE.Vector3(m.position.x, m.position.y + BOX_H / 2, m.position.z));
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

  // House_1 and the Cottage. Set off to the sides of the meadow so they frame
  // the play area without blocking the run between the table and the hunting
  // ground.
  async _buildings() {
    // Fit by LARGEST dimension, not height: the Cottage ships with a wide base
    // plate (14.5m across for a 5.4m building), so height-fitting made its
    // footprint big enough to swallow the player.
    const [house, cottage] = await Promise.all([
      loadModel('OBJECTS/House_1.fbx', { maxSize: 8.0 }),
      loadModel('OBJECTS/Cottage.obj', { maxSize: 9.0, mtl: true }),
    ]);

    const put = (model, x, z, yaw) => {
      if (!model) return;
      model.position.set(x, this.groundHeight(x, z), z);
      model.rotation.y = yaw;
      model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.scene.add(model);

      // Collider derived from what actually loaded rather than a guess, so you
      // cannot walk inside a building and see its backfaces.
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const centre = new THREE.Vector3();
      box.getCenter(centre);
      this.colliders.push({
        x: centre.x, z: centre.z,
        hw: Math.max(1, size.x * 0.42),
        hd: Math.max(1, size.z * 0.42),
      });
    };

    const [hs, cs] = this.buildingSpots;
    put(house,   hs.x, hs.z, hs.yaw);
    put(cottage, cs.x, cs.z, cs.yaw);

    if (!house)   console.warn('[world] House_1 unavailable');
    if (!cottage) console.warn('[world] Cottage unavailable');
  }

  // Grass tufts. The source model is ~100 tiny meshes, so it is flattened into
  // a single geometry with baked vertex colours and drawn as ONE InstancedMesh:
  // several hundred tufts for the cost of a single draw call.
  async _grass() {
    const model = await loadModel('OBJECTS/grass/model.obj', { height: 0.55, mtl: 'OBJECTS/grass/materials.mtl' });
    if (!model) { console.warn('[world] grass unavailable'); return; }

    const geo = flattenToGeometry(model);
    if (!geo) { console.warn('[world] grass had no geometry'); return; }

    // The source greens are darker and more saturated than the meadow palette,
    // so lift the baked vertex colours toward the ground tone before use.
    const col = geo.attributes.color;
    for (let i = 0; i < col.array.length; i += 3) {
      col.array[i]     = Math.min(1, col.array[i]     * 1.55 + 0.06);
      col.array[i + 1] = Math.min(1, col.array[i + 1] * 1.42 + 0.10);
      col.array[i + 2] = Math.min(1, col.array[i + 2] * 1.55 + 0.04);
    }
    col.needsUpdate = true;

    const COUNT = 420;
    const mesh = new THREE.InstancedMesh(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }),
      COUNT
    );
    mesh.castShadow = false;
    mesh.receiveShadow = true;

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const tint = new THREE.Color();

    let placed = 0, guard = 0;
    while (placed < COUNT && guard++ < COUNT * 12) {
      const x = (Math.random() - 0.5) * (this.bounds * 2 - 6);
      const z = (Math.random() - 0.5) * (this.bounds * 2 - 6);

      // keep the worn ring around the cooking table clear
      if (Math.hypot(x, z) < 8) continue;
      // and don't grow tufts inside anything solid
      if (this.colliders.some(c =>
            Math.abs(x - c.x) < c.hw + 0.4 && Math.abs(z - c.z) < c.hd + 0.4)) continue;

      pos.set(x, this.groundHeight(x, z), z);
      q.setFromAxisAngle(up, Math.random() * Math.PI * 2);
      const sc = 0.7 + Math.random() * 0.9;
      scl.set(sc, sc * (0.8 + Math.random() * 0.5), sc);
      mesh.setMatrixAt(placed, m.compose(pos, q, scl));

      // per-instance tint, multiplied over the vertex colours — stops 420
      // copies of the same tuft from reading as wallpaper
      const v = 0.82 + Math.random() * 0.36;
      tint.setRGB(v * (0.94 + Math.random() * 0.12), v, v * (0.9 + Math.random() * 0.1));
      mesh.setColorAt(placed, tint);
      placed++;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.scene.add(mesh);
    console.log(`[world] ${placed} grass tufts (1 draw call)`);
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
