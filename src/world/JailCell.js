import * as THREE from 'three';

// THE CELL.
//
// Where you wake up after dying. Three solid walls, a barred front, and a door
// standing wide open — the point is not to trap you, it is to make you walk out
// past the bars under your own power and think about what you did.
//
// The collision is real: the walls and both bar segments push you out, and the
// only gap is the doorway. It is placed out at the south-west edge of the
// meadow, so respawning also costs you the walk back.

export const JAIL = {
  inner: 4.4,          // interior floor, metres square
  wall: 0.35,          // wall thickness
  height: 3.0,
  doorWidth: 1.5,      // the open gap in the barred face
  barSpacing: 0.34,
  barRadius: 0.055,
};

// Find somewhere the cell actually fits.
//
// Dropping it at a hardcoded corner put it inside a pine clump — the same trap
// the boss fell into. Tree trunks are in `world.colliders`, but their canopies
// are several metres wider than the trunk, so the clearance has to be generous.
//
// Searches rings outward from the preferred spot and takes the first position
// with nothing solid within `clear` metres and no building nearby.
export function findCellSpot(world, prefer, { clear = 9, fromBuildings = 16 } = {}) {
  const bounds = (world.bounds ?? 48) - 8;
  const ok = (x, z, need) => {
    if (Math.abs(x) > bounds || Math.abs(z) > bounds) return false;
    if (Math.hypot(x, z) < 14) return false;                 // not on top of the table
    for (const b of world.buildingSpots ?? []) {
      if (Math.hypot(x - b.x, z - b.z) < fromBuildings) return false;
    }
    // Tree clumps by their DECLARED centres, not by their colliders: the models
    // load asynchronously and the colliders do not exist yet when the cell is
    // placed. Checking the live list alone put the first cell inside a pine
    // clump and reported 9m of clearance while doing it.
    const clumpR = (world.clumpRadius ?? 7) + need;
    for (const [cx, cz] of world.treeClumps ?? []) {
      if (Math.hypot(x - cx, z - cz) < clumpR) return false;
    }
    for (const c of world.colliders) {
      // distance from the point to the collider box, inflated by its own size
      const dx = Math.max(0, Math.abs(x - c.x) - c.hw);
      const dz = Math.max(0, Math.abs(z - c.z) - c.hd);
      if (Math.hypot(dx, dz) < need) return false;
    }
    return true;
  };

  const search = (need) => {
    if (ok(prefer.x, prefer.z, need)) return prefer.clone();
    for (let r = 4; r <= 46; r += 2.5) {
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * Math.PI * 2;
        const x = prefer.x + Math.cos(a) * r;
        const z = prefer.z + Math.sin(a) * r;
        if (ok(x, z, need)) return new THREE.Vector3(x, 0, z);
      }
    }
    return null;
  };

  // Step the requirement down rather than giving up. Asking for 9m of clear
  // ground away from every fence, rock, tree and booth has no solution on this
  // map, and the first version silently fell back to the preferred spot —
  // which was inside a pine clump.
  for (const need of [clear, clear - 2, clear - 3.5, clear - 5]) {
    const found = search(Math.max(3, need));
    if (found) {
      console.log(`[jail] placed at ${found.x.toFixed(1)}, ${found.z.toFixed(1)} (${need.toFixed(1)}m clear)`);
      return found;
    }
  }

  console.warn('[jail] no clear spot found, using the preferred one');
  return prefer.clone();
}

export class JailCell {
  constructor(scene, world, position, yaw = 0) {
    this.world = world;
    this.pos = position.clone();
    this.pos.y = world.groundHeight(position.x, position.z);
    this.yaw = yaw;

    this.root = new THREE.Group();
    this.root.position.copy(this.pos);
    this.root.rotation.y = yaw;
    scene.add(this.root);

    this._build();
    this._addColliders();
  }

  // Where you stand up. Slightly back from the door, facing it.
  get spawnPoint() {
    const back = -JAIL.inner * 0.22;
    return new THREE.Vector3(
      this.pos.x + Math.sin(this.yaw) * back,
      0,
      this.pos.z + Math.cos(this.yaw) * back,
    );
  }

  // Facing the open door, so the first thing you see is the way out.
  get spawnYaw() { return this.yaw + Math.PI; }

  _build() {
    const stone = new THREE.MeshStandardMaterial({
      color: 0x6e6a63, roughness: 0.98, metalness: 0, flatShading: true });
    const darkStone = new THREE.MeshStandardMaterial({
      color: 0x565249, roughness: 1, metalness: 0, flatShading: true });
    const iron = new THREE.MeshStandardMaterial({
      color: 0x3e3a36, roughness: 0.5, metalness: 0.35,
      emissive: 0x141210, emissiveIntensity: 0.6, flatShading: true });

    const I = JAIL.inner, W = JAIL.wall, H = JAIL.height;
    const half = I / 2 + W / 2;

    // ── floor ──
    const floor = new THREE.Mesh(new THREE.BoxGeometry(I + W * 2, 0.14, I + W * 2), darkStone);
    floor.position.y = 0.07;
    floor.receiveShadow = true;
    this.root.add(floor);

    // ── three solid walls: back (−Z), left (−X), right (+X) ──
    const back = new THREE.Mesh(new THREE.BoxGeometry(I + W * 2, H, W), stone);
    back.position.set(0, H / 2, -half);
    back.castShadow = true; back.receiveShadow = true;
    this.root.add(back);

    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(W, H, I), stone);
      side.position.set(sx * half, H / 2, 0);
      side.castShadow = true; side.receiveShadow = true;
      this.root.add(side);
    }

    // ── ceiling ──
    const roof = new THREE.Mesh(new THREE.BoxGeometry(I + W * 2, W, I + W * 2), darkStone);
    roof.position.y = H + W / 2;
    roof.castShadow = true;
    this.root.add(roof);

    // ── the barred front, with the doorway left open ──
    const z = half;
    const gapHalf = JAIL.doorWidth / 2;
    const edge = I / 2 + W;

    // lintel across the top of the whole face
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(I + W * 2, 0.3, W), stone);
    lintel.position.set(0, H - 0.15, z);
    lintel.castShadow = true;
    this.root.add(lintel);

    this.barSpans = [];
    for (const sx of [-1, 1]) {
      // one run of bars from the side wall in to the edge of the doorway
      const from = sx * gapHalf;
      const to = sx * edge;
      const width = Math.abs(to - from);
      if (width < 0.1) continue;
      this.barSpans.push({ centre: (from + to) / 2, width });

      const n = Math.max(2, Math.round(width / JAIL.barSpacing));
      for (let i = 0; i <= n; i++) {
        const x = from + (to - from) * (i / n);
        const bar = new THREE.Mesh(
          new THREE.CylinderGeometry(JAIL.barRadius, JAIL.barRadius, H - 0.3, 6), iron);
        bar.position.set(x, (H - 0.3) / 2, z);
        bar.castShadow = true;
        this.root.add(bar);
      }
      // a horizontal brace so the run does not read as loose sticks
      const brace = new THREE.Mesh(new THREE.BoxGeometry(width, 0.07, 0.07), iron);
      brace.position.set((from + to) / 2, H * 0.55, z);
      this.root.add(brace);
    }

    // ── the door itself, hanging open on its hinge ──
    // This is the tell. A closed door is a puzzle; a door standing open at
    // sixty degrees is an invitation with an opinion about you.
    const doorPivot = new THREE.Group();
    doorPivot.position.set(-gapHalf, 0, z);
    doorPivot.rotation.y = -1.05;
    this.root.add(doorPivot);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(JAIL.doorWidth, 0.09, 0.09), iron);
    frame.position.set(JAIL.doorWidth / 2, H - 0.35, 0);
    doorPivot.add(frame);
    const frameLow = frame.clone();
    frameLow.position.y = 0.12;
    doorPivot.add(frameLow);
    for (let i = 0; i <= 4; i++) {
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(JAIL.barRadius * 0.85, JAIL.barRadius * 0.85, H - 0.5, 6), iron);
      bar.position.set((JAIL.doorWidth / 4) * i, (H - 0.4) / 2, 0);
      bar.castShadow = true;
      doorPivot.add(bar);
    }
    this.door = doorPivot;

    // ── furnishing ──
    const bench = new THREE.Mesh(new THREE.BoxGeometry(I * 0.72, 0.16, 0.62), stone);
    bench.position.set(0, 0.55, -I * 0.3);
    bench.castShadow = true;
    this.root.add(bench);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.48, 0.5), darkStone);
      leg.position.set(sx * I * 0.28, 0.24, -I * 0.3);
      this.root.add(leg);
    }

    const bucket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.15, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x4a4640, roughness: 0.9, flatShading: true }));
    bucket.position.set(I * 0.3, 0.15, I * 0.22);
    bucket.castShadow = true;
    this.root.add(bucket);

    // a single weak light, so the interior is not a black box
    const lamp = new THREE.PointLight(0xffd9a0, 1.1, 8, 2);
    lamp.position.set(0, H - 0.5, 0);
    this.root.add(lamp);
    this.lamp = lamp;
  }

  // The world's colliders are axis-aligned, so a rotated cell would need real
  // OBBs. Keeping the cell axis-aligned (yaw 0) is far cheaper than making the
  // collision system understand rotation for one building.
  _addColliders() {
    const I = JAIL.inner, W = JAIL.wall;
    const half = I / 2 + W / 2;
    const outer = I / 2 + W;
    const push = (x, z, hw, hd) =>
      this.world.colliders.push({ x: this.pos.x + x, z: this.pos.z + z, hw, hd });

    // back wall and both sides
    push(0, -half, outer, W / 2);
    push(-half, 0, W / 2, I / 2);
    push(half, 0, W / 2, I / 2);

    // the barred face, minus the doorway — the two spans computed in _build
    for (const span of this.barSpans) {
      push(span.centre, half, span.width / 2, W / 2);
    }
  }

  update(dt) {
    // the lamp gutters, because of course it does
    this._t = (this._t ?? 0) + dt;
    this.lamp.intensity = 1.0 + Math.sin(this._t * 9) * 0.08 + Math.sin(this._t * 23) * 0.05;
  }
}
