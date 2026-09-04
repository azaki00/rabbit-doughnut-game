import * as THREE from 'three';
import { loadModel } from './Loaders.js';

// THE GOAT ROOM — GAME_DESIGN.md §8
//
// The garish half. Everything else in this game is pastel meadow; this is a
// 7x7 metre box with magenta carpet, lime walls, orange trim and a cyan
// ceiling, lit by an RGB strip that will not stop cycling. §8 is emphatic that
// it should look slightly too warm, and it does.
//
// The walls are covered floor to ceiling in framed goats in wildly different
// styles — all drawn procedurally to canvas, because forty authored goat
// paintings is forty asset files for one joke. ONE FRAME IS EMPTY. That is in
// the spec and it is the best thing in the room.
//
// It also owns the bleat: every ~90 seconds, from no visible source, never
// acknowledged by anything.

// §8 specifies 5x5 at 2.4 m and calls it cramped. Built at that size it was
// cramped in the wrong way — you could not get far enough from a wall to see
// the goats hung on it, which is the entire content of the room. 7x7 at 2.9 m
// still reads as a small back room and lets you stand and look.
export const GOAT = {
  inner: 7.0,
  height: 2.9,
  wall: 0.22,
  doorWidth: 2.0,    // wide enough to walk through without aiming at it
  bleatMin: 78,
  bleatMax: 104,
  radius: 2.6,       // how close you must be to the machine to use it
};

const GOAT_URL = 'OBJECTS/goat/Goat.obj';

const CARPET = 0xb0208a;
const WALLS  = 0x8ad12a;
const TRIM   = 0xff8a1e;
const CEIL   = 0x21c9d9;

// Deterministic per-room randomness, so the same goat hangs in the same place
// every session. A wall that reshuffles itself on reload is a different room.
function rng(seed) {
  let x = (seed * 1103515245 + 12345) & 0x7fffffff;
  return () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return x / 0x7fffffff;
  };
}

export class GoatRoom {
  constructor(scene, world, position, yaw = 0) {
    this.world = world;
    this.pos = position.clone();
    this.pos.y = world.groundHeight(position.x, position.z);

    // QUARTER TURNS ONLY.
    //
    // The world's colliders are axis-aligned boxes. At any other angle the
    // visual walls rotate away from the collision and you get invisible walls
    // in the open and doorways you cannot walk through — the same reason
    // JailCell is pinned to yaw 0. Snapping to the nearest 90 degrees keeps the
    // boxes valid (a quarter turn just swaps hw and hd) and still points the
    // door at whichever side of the room the caller asked for.
    this.yaw = Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2);
    this.quarter = ((Math.round(yaw / (Math.PI / 2)) % 4) + 4) % 4;
    this.t = 0;
    this.bleatIn = GOAT.bleatMin;
    this.sfx = null;          // set by main.js; the bleat needs it

    this.root = new THREE.Group();
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    scene.add(this.root);

    this._build();
    this._hangGoats();
    this._addColliders();
    this._loadGoat();
  }

  // THE GOAT.
  //
  // An actual goat, standing in the corner of a room covered in paintings of
  // goats, which nothing in the game ever mentions. §8 says the bleat has no
  // visible source; it has one now, and it is still never acknowledged.
  //
  // No collider: you can walk through it. A goat you can bump into is a prop.
  async _loadGoat() {
    const m = await loadModel(GOAT_URL, { mtl: true, height: 0.95 });
    if (!m) return;              // the room is complete without it
    const I = GOAT.inner;
    m.position.set(-I / 2 + 1.15, 0, I / 2 - 1.3);
    m.rotation.y = -0.9;         // facing the machine, more or less
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.root.add(m);
    this.goat = m;
  }

  // The machine sits at the centre; you use it from anywhere in the room.
  get machinePos() {
    return new THREE.Vector3(this.pos.x, this.pos.y, this.pos.z);
  }

  canUse(playerPos) {
    return playerPos.distanceTo(this.machinePos) < GOAT.radius;
  }

  _build() {
    const I = GOAT.inner, H = GOAT.height, W = GOAT.wall;
    const half = I / 2 + W / 2;

    const mat = (c, rough = 0.9, metal = 0) =>
      new THREE.MeshStandardMaterial({
        color: c, roughness: rough, metalness: metal, flatShading: true });

    // ── casino carpet ──
    const carpet = new THREE.Mesh(new THREE.BoxGeometry(I, 0.05, I), mat(CARPET, 1));
    carpet.position.y = 0.025;
    carpet.receiveShadow = true;
    this.root.add(carpet);

    // ── ceiling ──
    const ceil = new THREE.Mesh(
      new THREE.BoxGeometry(I + W * 2, W, I + W * 2), mat(CEIL, 0.95));
    ceil.position.y = H + W / 2;
    this.root.add(ceil);

    // ── walls: three solid, one with a doorway ──
    const gap = GOAT.doorWidth / 2;
    const seg = (w, x, z, rotY = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, W), mat(WALLS));
      m.position.set(x, H / 2, z);
      m.rotation.y = rotY;
      m.castShadow = true; m.receiveShadow = true;
      this.root.add(m);
      return m;
    };
    seg(I + W * 2, 0, -half);                       // back
    seg(I, -half, 0, Math.PI / 2);                  // left
    seg(I, half, 0, Math.PI / 2);                   // right
    const side = (I + W * 2) / 2 - gap;             // front, split around the door
    for (const sx of [-1, 1]) seg(side, sx * (gap + side / 2), half);

    // ── orange trim, at skirting and picture-rail height ──
    for (const y of [0.12, H - 0.14]) {
      for (const [x, z, w, r] of [
        [0, -half + W / 2, I, 0],
        [-half + W / 2, 0, I, Math.PI / 2],
        [half - W / 2, 0, I, Math.PI / 2],
      ]) {
        const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.09, 0.05), mat(TRIM, 0.6));
        t.position.set(x, y, z);
        t.rotation.y = r;
        this.root.add(t);
      }
    }

    // ── the machine ──
    // A plinth, not a cabinet: the reel itself is DOM (§8.1), so anything more
    // detailed here would be a second, worse version of the same thing.
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.52, 1.02, 10), mat(0x2a1e34, 0.5, 0.3));
    body.position.y = 0.51;
    body.castShadow = true;
    this.root.add(body);

    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.09, 10), mat(0xffd24a, 0.35, 0.6));
    top.position.y = 1.06;
    this.root.add(top);

    this.machineGlow = new THREE.PointLight(0xffd24a, 0.6, 4, 2);
    this.machineGlow.position.y = 1.35;
    this.root.add(this.machineGlow);

    // ── the cheap plastic chair nobody sits in ──
    const chair = new THREE.Group();
    chair.position.set(I / 2 - 0.75, 0, -I / 2 + 0.75);
    chair.rotation.y = -0.7;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.42), mat(0xe8e4d8, 0.8));
    seat.position.y = 0.45;
    chair.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.44, 0.05), mat(0xe8e4d8, 0.8));
    back.position.set(0, 0.67, -0.19);
    chair.add(back);
    for (const [lx, lz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.45, 6), mat(0xd8d4c8, 0.8));
      leg.position.set(lx, 0.225, lz);
      chair.add(leg);
    }
    this.root.add(chair);

    // ── the doorway ──
    // Two jambs and a lintel. Without them a gap in a lime wall reads as a
    // hole rather than a way in, and you have to be looking straight at it to
    // realise you can walk through.
    for (const sx of [-1, 1]) {
      const jamb = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, H, W * 1.6), mat(TRIM, 0.55));
      jamb.position.set(sx * gap, H / 2, half);
      jamb.castShadow = true;
      this.root.add(jamb);
    }
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(GOAT.doorWidth + 0.28, 0.16, W * 1.6), mat(TRIM, 0.55));
    lintel.position.set(0, H - 0.08, half);
    this.root.add(lintel);

    // A strip of carpet spilling out of the door.
    const mat_ = new THREE.Mesh(
      new THREE.BoxGeometry(GOAT.doorWidth, 0.03, 1.1), mat(CARPET, 1));
    mat_.position.set(0, 0.015, half + 0.55);
    mat_.receiveShadow = true;
    this.root.add(mat_);

    // ── the RGB strip ──
    // Three lights cycling out of phase. §8 asks for slot-machine lighting, and
    // one light on a hue rotation reads as a disco rather than a machine.
    this.strip = [];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight(0xffffff, 1.2, I * 1.5, 2);
      const a = (i / 3) * Math.PI * 2;
      // Radius scales with the room: fixed at 1.7 the three lights huddled in
      // the middle of a 7 m floor and left the corners dark.
      const rad = I * 0.32;
      l.position.set(Math.cos(a) * rad, H - 0.22, Math.sin(a) * rad);
      this.root.add(l);
      this.strip.push({ light: l, phase: (i / 3) * Math.PI * 2 });
    }
  }

  // ── the goats ──
  //
  // Every goat is the same underlying shape drawn a different way, which is
  // exactly the joke: a crayon goat and an oil goat are the same goat.
  _goatCanvas(style, r) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');

    const grounds = ['#e8e0cc', '#2a2418', '#f4f0e6', '#c8b898', '#1a2430', '#ffffff'];
    g.fillStyle = grounds[Math.floor(r() * grounds.length)];
    g.fillRect(0, 0, 128, 128);

    const inkPool = ['#3a2e22', '#111111', '#5a4a38', '#7a6a52', '#8a3a2a', '#2a3a5a'];
    const ink = inkPool[Math.floor(r() * inkPool.length)];

    if (style === 'crayon') {
      // wobbly, overshooting strokes, and it is not centred
      g.lineWidth = 3 + r() * 3;
      g.lineCap = 'round';
      g.strokeStyle = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad'][Math.floor(r() * 4)];
      const ox = 44 + r() * 22, oy = 52 + r() * 20;
      for (const [dx, dy, dx2, dy2] of [
        [-22, 0, 22, 0], [-22, 0, -18, 22], [22, 0, 18, 22],
        [-14, -4, -20, -22], [12, -6, 20, -24],
      ]) {
        g.beginPath();
        g.moveTo(ox + dx + (r() - 0.5) * 5, oy + dy + (r() - 0.5) * 5);
        g.lineTo(ox + dx2 + (r() - 0.5) * 7, oy + dy2 + (r() - 0.5) * 7);
        g.stroke();
      }
    } else if (style === 'photo') {
      // a soft grey shape under a vignette — a photograph from far enough away
      const grad = g.createRadialGradient(64, 60, 8, 64, 64, 70);
      grad.addColorStop(0, '#9a9488');
      grad.addColorStop(1, '#4a463e');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#d8d2c4';
      g.beginPath(); g.ellipse(64, 70, 26, 20, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(64, 44, 13, 15, 0, 0, 7); g.fill();
      g.fillStyle = ink;
      g.beginPath(); g.moveTo(54, 32); g.lineTo(48, 14); g.lineTo(58, 28); g.fill();
      g.beginPath(); g.moveTo(74, 32); g.lineTo(80, 14); g.lineTo(70, 28); g.fill();
    } else if (style === 'stock') {
      // corporate: flat, centred, unreasonably clean, watermarked
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#cfcabc';
      g.beginPath(); g.ellipse(64, 74, 28, 19, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(64, 46, 14, 16, 0, 0, 7); g.fill();
      g.fillStyle = '#6a655a';
      g.fillRect(52, 40, 4, 4);
      g.fillRect(72, 40, 4, 4);
      g.save();
      g.translate(64, 64);
      g.rotate(-0.42);
      g.fillStyle = 'rgba(120,120,120,.30)';
      g.font = 'bold 15px system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText('STOCK', 0, 4);
      g.restore();
    } else {
      // oil: layered blocky strokes. The default, and the most common.
      for (let i = 0; i < 90; i++) {
        g.fillStyle = `hsl(${28 + r() * 34}, ${18 + r() * 26}%, ${16 + r() * 44}%)`;
        g.fillRect(r() * 128, r() * 128, 6 + r() * 12, 4 + r() * 9);
      }
      g.fillStyle = ink;
      g.beginPath(); g.ellipse(64, 74, 25, 18, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(62, 48, 13, 15, 0, 0, 7); g.fill();
      g.beginPath(); g.moveTo(52, 34); g.lineTo(46, 16); g.lineTo(56, 30); g.fill();
      g.beginPath(); g.moveTo(72, 34); g.lineTo(78, 16); g.lineTo(68, 30); g.fill();
      // The eyes. §8: some goats look at the camera, some look at the player.
      g.fillStyle = '#f0e8d0';
      const stare = r() < 0.45 ? 0 : (r() - 0.5) * 5;
      g.fillRect(55 + stare, 45, 4, 3);
      g.fillRect(67 + stare, 45, 4, 3);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _hangGoats() {
    const I = GOAT.inner;
    const styles = ['oil', 'oil', 'oil', 'crayon', 'photo', 'stock', 'oil', 'crayon', 'oil'];
    const frameMats = [0x6a4a22, 0xd4af37, 0x2a2a2a, 0x8a6a3a, 0xc0c0c0, 0x4a2a1a];

    // Fixed seed: it is always the same frame, in the same place. A room with a
    // randomly empty frame is a glitch; a room with THE empty frame is a room
    // with a story.
    const r = rng(20260905);
    const walls = [
      { n: 8, x: 0, z: -I / 2 + 0.06, rotY: 0, span: I - 0.6 },
      { n: 7, x: -I / 2 + 0.06, z: 0, rotY: Math.PI / 2, span: I - 0.6 },
      { n: 7, x: I / 2 - 0.06, z: 0, rotY: -Math.PI / 2, span: I - 0.6 },
    ];

    let index = 0;
    const emptyAt = 11;   // counted across all walls, back wall first
    for (const w of walls) {
      for (let row = 0; row < 2; row++) {
        for (let i = 0; i < w.n; i++) {
          const along = (i / (w.n - 1) - 0.5) * w.span;
          const y = 0.72 + row * 0.82 + (r() - 0.5) * 0.07;
          const size = 0.26 + r() * 0.14;
          const isEmpty = index === emptyAt;
          index++;

          const frame = new THREE.Mesh(
            new THREE.PlaneGeometry(size * 1.18, size * 1.18),
            new THREE.MeshStandardMaterial({
              color: frameMats[Math.floor(r() * frameMats.length)],
              roughness: 0.55, metalness: 0.25, side: THREE.DoubleSide,
            }),
          );

          const art = new THREE.Mesh(
            new THREE.PlaneGeometry(size, size),
            isEmpty
              // The empty one shows the wall through it — not a blank canvas,
              // which would read as a texture that failed to load.
              ? new THREE.MeshStandardMaterial({
                  color: 0x6a9a20, roughness: 1, side: THREE.DoubleSide })
              : new THREE.MeshBasicMaterial({
                  map: this._goatCanvas(styles[Math.floor(r() * styles.length)], r),
                  side: THREE.DoubleSide,
                }),
          );

          const nx = Math.sin(w.rotY), nz = Math.cos(w.rotY);
          const px = w.x + (w.rotY === 0 ? along : 0);
          const pz = w.z + (w.rotY === 0 ? 0 : along);
          frame.position.set(px + nx * 0.012, y, pz + nz * 0.012);
          art.position.set(px + nx * 0.026, y, pz + nz * 0.026);
          frame.rotation.y = w.rotY;
          art.rotation.y = w.rotY;
          // Every frame is very slightly crooked, and none by the same amount.
          frame.rotation.z = art.rotation.z = (r() - 0.5) * 0.055;

          this.root.add(frame);
          this.root.add(art);
        }
      }
    }
  }

  _addColliders() {
    const I = GOAT.inner, W = GOAT.wall;
    const half = I / 2 + W / 2;
    const outer = I / 2 + W;
    const gap = GOAT.doorWidth / 2;
    // Rotate each local offset by the room's quarter turn before it becomes a
    // world-space box, and swap the half-extents on the odd turns.
    const q = this.quarter;
    const push = (x, z, hw, hd) => {
      let wx = x, wz = z, w = hw, d = hd;
      if (q === 1)      { wx = z;  wz = -x; w = hd; d = hw; }
      else if (q === 2) { wx = -x; wz = -z; }
      else if (q === 3) { wx = -z; wz = x;  w = hd; d = hw; }
      this.world.colliders.push({ x: this.pos.x + wx, z: this.pos.z + wz, hw: w, hd: d });
    };

    push(0, -half, outer, W / 2);
    push(-half, 0, W / 2, I / 2);
    push(half, 0, W / 2, I / 2);
    const side = outer - gap;
    for (const sx of [-1, 1]) push(sx * (gap + side / 2), half, side / 2, W / 2);
    push(0, 0, 0.52, 0.52);   // the machine
  }

  update(dt) {
    this.t += dt;

    // RGB cycle. Out of phase per light, and slow enough to read as a strip
    // rather than a strobe.
    for (const s of this.strip) {
      const h = (this.t * 0.14 + s.phase / (Math.PI * 2)) % 1;
      s.light.color.setHSL(h, 0.85, 0.55);
      s.light.intensity = 1.0 + Math.sin(this.t * 2.4 + s.phase) * 0.25;
    }
    this.machineGlow.intensity = 0.55 + Math.sin(this.t * 3.1) * 0.18;

    // It breathes. Barely. A perfectly still goat in a room of goat paintings
    // reads as one more painting, and the joke needs it to be alive.
    if (this.goat) {
      this.goat.scale.y = 1 + Math.sin(this.t * 1.15) * 0.008;
      this.goat.rotation.y = -0.9 + Math.sin(this.t * 0.31) * 0.05;
    }

    // ── the bleat ── §8
    // Every ~90 seconds, from nowhere, and nothing in the game ever mentions it.
    this.bleatIn -= dt;
    if (this.bleatIn <= 0) {
      this.bleatIn = GOAT.bleatMin + Math.random() * (GOAT.bleatMax - GOAT.bleatMin);
      this.sfx?.goatBleat?.();
    }
  }
}
