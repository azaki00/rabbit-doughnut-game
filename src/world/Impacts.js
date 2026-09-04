import * as THREE from 'three';

// BULLET MARKS.
//
// Every shot leaves something behind for 4 seconds: a scorched pock on whatever
// it hit, a red splat on a rabbit, a yolk smear on the Sovereign. Without this
// the gun has no feedback at all beyond the report — you cannot tell a miss
// from a hit that did nothing.
//
// Pooled and pre-textured. A shot can happen three times a second and the marks
// last four, so a dozen live at once at the very worst.

const LIFE = 4.0;          // seconds, as specified
const FADE = 0.9;          // of which the last 0.9s is the fade-out
const POOL = 28;

// Canvas-drawn so there is nothing to load and nothing to 404.
function makeTexture(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  draw(g, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function scorchTexture() {
  return makeTexture((g, s) => {
    const r = s / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0.00, 'rgba(18,14,12,0.95)');
    grad.addColorStop(0.45, 'rgba(34,26,20,0.72)');
    grad.addColorStop(0.80, 'rgba(48,38,30,0.22)');
    grad.addColorStop(1.00, 'rgba(48,38,30,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    // a few chips around the rim, so it is not a perfect circle
    g.fillStyle = 'rgba(14,11,9,0.8)';
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = r * (0.35 + Math.random() * 0.45);
      g.beginPath();
      g.arc(r + Math.cos(a) * d, r + Math.sin(a) * d, 1.5 + Math.random() * 3.5, 0, Math.PI * 2);
      g.fill();
    }
  });
}

function splatTexture(inner, outer) {
  return makeTexture((g, s) => {
    const r = s / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r * 0.72);
    grad.addColorStop(0.0, inner);
    grad.addColorStop(0.7, outer);
    grad.addColorStop(1.0, outer.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = grad;
    g.beginPath(); g.arc(r, r, r * 0.62, 0, Math.PI * 2); g.fill();
    // thrown droplets
    g.fillStyle = inner;
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = r * (0.5 + Math.random() * 0.48);
      g.beginPath();
      g.arc(r + Math.cos(a) * d, r + Math.sin(a) * d, 1 + Math.random() * 3.2, 0, Math.PI * 2);
      g.fill();
    }
  });
}

const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 0, 1);

export class Impacts {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.kinds = {
      // scorch on the world, blood on a rabbit, yolk on the Sovereign
      // Sized to actually read on grass from ten metres. 0.30 was accurate to a
      // shotgun pellet pattern and completely invisible in play.
      world: { tex: scorchTexture(), size: 0.44 },
      flesh: { tex: splatTexture('rgba(150,18,14,0.95)', 'rgba(96,10,8,0.6)'), size: 0.52 },
      yolk:  { tex: splatTexture('rgba(246,185,26,0.95)', 'rgba(196,132,10,0.6)'), size: 0.70 },
    };

    this.free = [];
    this.live = [];
    const geo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < POOL; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        // pull the quad toward the camera in depth so it never z-fights with
        // the surface it is stuck to
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
        side: THREE.DoubleSide,
      }));
      m.visible = false;
      m.renderOrder = 3;
      this.group.add(m);
      this.free.push(m);
    }
  }

  // `normal` is the surface normal at the hit, in world space. Anything that
  // does not have one (a rabbit, the boss) can pass the shot direction reversed
  // and it will simply face the shooter.
  add(point, normal, kind = 'world') {
    const spec = this.kinds[kind] ?? this.kinds.world;
    const mesh = this.free.pop() ?? this._recycleOldest();
    if (!mesh) return null;

    mesh.material.map = spec.tex;
    mesh.material.opacity = 1;
    mesh.material.needsUpdate = true;

    const n = normal && normal.lengthSq() > 1e-6
      ? normal.clone().normalize()
      : new THREE.Vector3(0, 1, 0);

    // lift it just off the surface as well as offsetting in depth — a decal
    // flush with a flat ground plane still shimmers on some drivers
    mesh.position.copy(point).addScaledVector(n, 0.012);
    _q.setFromUnitVectors(_up, n);
    mesh.quaternion.copy(_q);
    mesh.rotateZ(Math.random() * Math.PI * 2);       // no two marks alike

    const size = spec.size * (0.82 + Math.random() * 0.4);
    mesh.scale.set(size, size, 1);
    mesh.visible = true;

    const rec = { mesh, t: LIFE };
    this.live.push(rec);
    return rec;
  }

  _recycleOldest() {
    const oldest = this.live.shift();
    if (!oldest) return null;
    return oldest.mesh;
  }

  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const r = this.live[i];
      r.t -= dt;
      if (r.t <= 0) {
        r.mesh.visible = false;
        this.live.splice(i, 1);
        this.free.push(r.mesh);
        continue;
      }
      // hold at full for the first 3.1s, then fade out over the last 0.9s
      r.mesh.material.opacity = Math.min(1, r.t / FADE);
    }
  }
}
