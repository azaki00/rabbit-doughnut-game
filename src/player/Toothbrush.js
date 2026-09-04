import * as THREE from 'three';
import { LAYER_VIEWMODEL } from '../core/Engine.js';

// THE TOOTHBRUSH — the melee weapon you start the game holding.
//
// It is a toothbrush. It is not good. It is, however, FAST and SILENT, and
// that gives it a real place between the other two:
//
//   · the glove    catches a rabbit whole, for full value, and needs a lunge
//   · the gun      kills anything at range, ruins the meat, empties the field
//   · the toothbrush kills at arm's length, keeps most of the meat, and makes
//     no noise at all — so the rest of the field never knows
//
// You will never crack the egg with it and you will not fight the Sovereign
// with it, but a rabbit that has stopped for a carrot is well within reach.

const BRUSH_URL = 'OBJECTS/toothbrush/toothbrush.obj';

export const BRUSH = {
  swingTime: 0.30,
  impactAt: 0.12,       // seconds into the swing when the bristles land
  cooldown: 0.10,       // it is a toothbrush, you can flail with it
  range: 2.3,
  arc: 70 * Math.PI / 180,
  staminaCost: 3,

  meatKeep: 0.75,       // of the rabbit's value — better than the gun's 0.45
  bossDamage: 18,       // yes, really
  scareRadius: 5,       // barely carries; that is the whole point
};

export class Toothbrush {
  constructor(engine, controller, audio) {
    this.engine = engine;
    this.ctrl = controller;
    this.audio = audio;

    // The starting weapon: owned from the first frame, unlike the Tenderiser.
    this.owned = true;
    this.swing = 0;
    this.cooldown = 0;
    this.didImpact = false;

    this.onImpact = null;   // (origin, dir) => void

    this.root = new THREE.Group();
    this.engine.vmScene.add(this.root);
    this._build();
    this._loadReal();

    this._swayX = 0; this._swayY = 0;
    this._lagX = 0;  this._lagY = 0;
  }

  // Blocky stand-in until the real model arrives.
  _build() {
    const handle = new THREE.MeshStandardMaterial({
      color: 0x1b3a8f, roughness: .55, metalness: 0, flatShading: true });
    const bristle = new THREE.MeshStandardMaterial({
      color: 0xf4f1ea, roughness: .85, metalness: 0, flatShading: true });

    this.tool = new THREE.Group();

    const stick = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.012, 0.17), handle);
    stick.position.set(0, 0, 0.02);
    this.tool.add(stick);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.010, 0.045), handle);
    head.position.set(0, 0, -0.085);
    this.tool.add(head);

    const tufts = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.012, 0.042), bristle);
    tufts.position.set(0, 0.010, -0.085);
    this.tool.add(tufts);

    this.root.add(this.tool);
    this.root.traverse(o => o.layers.set(LAYER_VIEWMODEL));

    this.root.scale.setScalar(1);
    // held low and close, the way you hold something you are embarrassed by
    this.restPos = new THREE.Vector3(0.20, -0.20, -0.32);
    this.restRot = new THREE.Euler(0.22, -0.20, 0.30);
    this.root.position.copy(this.restPos);
    this.root.rotation.copy(this.restRot);
    this.root.visible = false;
  }

  async _loadReal() {
    const { loadModel } = await import('../world/Loaders.js');
    // Long and thin — fit by the largest axis. A real toothbrush is ~19cm.
    const m = await loadModel(BRUSH_URL, { maxSize: 0.19, mtl: true });
    if (!m) return;

    m.traverse(o => {
      o.layers.set(LAYER_VIEWMODEL);
      if (!o.isMesh) return;
      o.castShadow = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const mat of mats) {
        // the MTL's blue is nearly black under our lighting; lift it to a
        // toothbrush blue and leave the bristles white
        const c = mat.color;
        const lum = c ? 0.299 * c.r + 0.587 * c.g + 0.114 * c.b : 1;
        mat.color?.setHex(lum < 0.5 ? 0x2a5fd4 : 0xf6f3ec);
        mat.roughness = 0.6;
        mat.metalness = 0;
      }
    });

    this.root.remove(this.tool);
    // Authored lying along +Z with the brush head at the far end, which in
    // viewmodel space points the bristles straight back at your face. Yaw it
    // round so the head leads.
    m.rotation.set(0, Math.PI, 0);
    this.tool = m;
    this.root.add(m);
  }

  get busy() { return this.swing > 0; }

  update(dt, input, active) {
    this.root.visible = active;
    if (this.cooldown > 0) this.cooldown -= dt;

    if (this.swing > 0) {
      const prev = this.swing;
      this.swing += dt;
      if (!this.didImpact && prev < BRUSH.impactAt && this.swing >= BRUSH.impactAt) {
        this.didImpact = true;
        this._impact();
      }
      if (this.swing >= BRUSH.swingTime) {
        this.swing = 0;
        this.cooldown = BRUSH.cooldown;
      }
    } else if (active && input.lmbDown && this.cooldown <= 0 && this.ctrl.frozen <= 0) {
      this.swing = 0.0001;
      this.didImpact = false;
      this.ctrl.stamina.spend(BRUSH.staminaCost);
      this.audio?.brushSwing?.();
    }

    if (active) this._animate(dt, input);
  }

  _impact() {
    // Arm's length, at about waist height — you are scrubbing a rabbit, not
    // fencing with it.
    const origin = this.ctrl.pos.clone()
      .addScaledVector(this.ctrl.flatForward, 0.5)
      .setY(this.ctrl.pos.y - 0.7);
    this.onImpact?.(origin, this.ctrl.forward);
  }

  _animate(dt, input) {
    const k = 1 - Math.exp(-16 * dt);
    this._swayX += (-input.mouseDX * 0.0018 - this._swayX) * k;
    this._swayY += (-input.mouseDY * 0.0018 - this._swayY) * k;
    this._swayX = THREE.MathUtils.clamp(this._swayX, -0.08, 0.08);
    this._swayY = THREE.MathUtils.clamp(this._swayY, -0.08, 0.08);

    const lagK = 1 - Math.exp(-18 * dt);
    this._lagX += (this.ctrl.bob.x * 0.6 - this._lagX) * lagK;
    this._lagY += (this.ctrl.bob.y * 0.6 - this._lagY) * lagK;

    let px = this.restPos.x + this._swayX + this._lagX;
    let py = this.restPos.y + this._swayY + this._lagY;
    let pz = this.restPos.z;
    let rx = this.restRot.x, ry = this.restRot.y, rz = this.restRot.z;

    if (this.ctrl.sprinting) {
      const s = Math.sin(this.ctrl.bob.phase * 3.1);
      px += 0.05 + s * 0.04;
      py -= 0.04;
      rz += 0.30 + s * 0.09;
    }

    // A short flick across the body, not an overhead chop. It is 20 grams.
    if (this.swing > 0) {
      const t = THREE.MathUtils.clamp(this.swing / BRUSH.swingTime, 0, 1);
      const impactT = BRUSH.impactAt / BRUSH.swingTime;
      if (t < impactT) {
        const w = t / impactT;
        px += w * 0.09;
        ry += w * 0.55;
        rz += w * 0.30;
      } else {
        const d = (t - impactT) / (1 - impactT);
        const arc = Math.sin(Math.min(1, d * 1.6) * Math.PI);
        px -= arc * 0.20;
        pz -= arc * 0.18;
        ry -= arc * 0.85;
        rx += arc * 0.22;
      }
    }

    this.root.position.set(px, py, pz);
    this.root.rotation.set(rx, ry, rz);
  }
}
