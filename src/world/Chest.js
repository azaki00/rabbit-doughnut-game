import * as THREE from 'three';
import { loadModel } from './Loaders.js';

// The Chests — GAME_DESIGN.md §9.1
//
// THREE of them, in a row beside the cooking table, and always visible in the
// world rather than hidden in a menu. Each one is a different case: the glove,
// the gun and the toothbrush have separate skin pools and never cross over.
// Walk up, look at one, press E.
//
// `kind` is the collection key ('glove' | 'gun' | 'brush'); `tint` is the
// colour of its glow and floating label, so you can tell them apart from
// across the clearing without reading anything.
//
// Uses OBJECTS/Chest by Quaternius (Chest_Open.fbx) with a procedural fallback,
// so the level still builds if the asset is missing.

const CHEST_URL = 'OBJECTS/Chest by Quaternius - IbCTSkyWDT/Chest_Open.fbx';

export class Chest {
  constructor(scene, position, { kind = 'glove', label = 'CASE', tint = 0xffd98e, yaw = 0 } = {}) {
    this.scene = scene;
    this.kind = kind;
    this.label = label;
    this.tint = tint;

    this.root = new THREE.Group();
    this.root.position.copy(position);
    this.root.rotation.y = yaw;
    scene.add(this.root);

    this.open = 0;          // 0..1 lid
    this.glow = 0;
    this.radius = 2.6;      // interaction range

    this._buildFallback();
    this._loadReal();
    this._buildGlow();
    this._buildSign();
  }

  // A floating placard in the chest's own colour. Three identical chests in a
  // row is a guessing game; three labelled ones is a choice.
  _buildSign() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(18,14,12,0.82)';
    g.fillRect(0, 0, 256, 64);
    g.strokeStyle = '#' + this.tint.toString(16).padStart(6, '0');
    g.lineWidth = 4;
    g.strokeRect(2, 2, 252, 60);
    g.fillStyle = '#' + this.tint.toString(16).padStart(6, '0');
    g.font = 'bold 26px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(this.label, 128, 34);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 0.29),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }),
    );
    this.sign.position.set(0, 1.42, 0);
    this.root.add(this.sign);
  }

  // Stand-in so the chest exists on frame one, replaced if the FBX loads.
  _buildFallback() {
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a28, roughness: .85, flatShading: true });
    const iron = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: .6, metalness: .5, flatShading: true });

    this.fallback = new THREE.Group();

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.62, 0.78), wood);
    body.position.y = 0.31;
    body.castShadow = true; body.receiveShadow = true;
    this.fallback.add(body);

    for (const z of [-0.30, 0.30]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(1.19, 0.09, 0.06), iron);
      band.position.set(0, 0.34, z);
      this.fallback.add(band);
    }

    // lid pivots at the back edge
    this.lid = new THREE.Group();
    this.lid.position.set(0, 0.62, -0.39);
    const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.16, 0.78), wood);
    lidMesh.position.set(0, 0.08, 0.39);
    lidMesh.castShadow = true;
    this.lid.add(lidMesh);
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.05), iron);
    latch.position.set(0, 0.04, 0.79);
    this.lid.add(latch);
    this.fallback.add(this.lid);

    this.root.add(this.fallback);
  }

  async _loadReal() {
    const m = await loadModel(CHEST_URL, { height: 0.95 });
    if (!m) return;                       // fallback stays
    this.root.remove(this.fallback);
    this.real = m;
    this.root.add(m);
    this.lid = null;                      // the FBX is modelled already-open
  }

  // A soft upward light so the chest reads as interactive from a distance.
  _buildGlow() {
    this.light = new THREE.PointLight(this.tint, 0, 6, 2);
    this.light.position.set(0, 1.0, 0);
    this.root.add(this.light);

    const ringGeo = new THREE.RingGeometry(0.95, 1.25, 24);
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color: this.tint, transparent: true, opacity: 0, side: THREE.DoubleSide,
    }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.02;
    this.root.add(this.ring);
  }

  // Is the player close enough AND looking at it?
  canUse(playerPos, forward) {
    const d = this.root.position.distanceTo(playerPos);
    if (d > this.radius) return false;
    const to = this.root.position.clone().sub(playerPos).setY(0);
    if (to.lengthSq() < 1e-5) return true;
    to.normalize();
    const f = new THREE.Vector3(forward.x, 0, forward.z).normalize();
    return f.dot(to) > 0.35;
  }

  pop() { this.open = 1; }

  update(dt, active) {
    this.glow += ((active ? 1 : 0.25) - this.glow) * Math.min(1, 6 * dt);
    this.light.intensity = this.glow * 2.2;
    this.ring.material.opacity = this.glow * 0.22;
    const pulse = 1 + Math.sin(performance.now() * 0.003) * 0.03 * this.glow;
    this.ring.scale.setScalar(pulse);

    // the placard bobs, and faces the camera on the yaw axis only
    if (this.sign) {
      this.sign.position.y = 1.42 + Math.sin(performance.now() * 0.0016) * 0.05;
      if (this.faceTarget) {
        this.sign.rotation.y =
          Math.atan2(this.faceTarget.x - this.root.position.x,
                     this.faceTarget.z - this.root.position.z) - this.root.rotation.y;
      }
    }

    if (this.open > 0) {
      this.open = Math.max(0, this.open - dt * 1.2);
      if (this.lid) this.lid.rotation.x = -Math.sin(this.open * Math.PI) * 1.15;
      this.light.intensity += Math.sin(this.open * Math.PI) * 6;
    }
  }
}
