import * as THREE from 'three';
import { LAYER_VIEWMODEL } from '../core/Engine.js';

// THE TENDERISER — bought for 2000c, and the only thing that cracks the shell.
//
// It is not a weapon for rabbits: the swing is slow, the arc is short, and a
// rabbit is long gone before it lands. Its whole purpose is the egg.

export const HAMMER = {
  price: 2000,
  swingTime: 0.62,
  impactAt: 0.30,        // seconds into the swing when the head lands
  cooldown: 0.25,
  range: 3.6,
  shellDamage: 1,        // shell is measured in HITS, not hit points
  bossDamage: 140,       // once it is out, this still hurts
  staminaCost: 14,
};

export class Hammer {
  constructor(engine, controller, audio) {
    this.engine = engine;
    this.ctrl = controller;
    this.audio = audio;

    this.owned = false;
    this.swing = 0;        // 0 = idle, else seconds elapsed
    this.cooldown = 0;
    this.didImpact = false;

    this.onImpact = null;  // (origin, dir) => void

    this.root = new THREE.Group();
    this.engine.vmScene.add(this.root);
    this._build();

    this._swayX = 0; this._swayY = 0;
    this._lagX = 0; this._lagY = 0;
  }

  _build() {
    const wood = new THREE.MeshStandardMaterial({
      color: 0x8a5a33, roughness: .82, metalness: 0, flatShading: true });
    // metalness with no env map renders black — stay dielectric, fake the sheen
    const steel = new THREE.MeshStandardMaterial({
      color: 0x9aa0aa, roughness: .42, metalness: .3,
      emissive: 0x272b31, emissiveIntensity: .6, flatShading: true });
    const band = new THREE.MeshStandardMaterial({
      color: 0xb8863f, roughness: .5, metalness: .3,
      emissive: 0x3d2c0e, emissiveIntensity: .5, flatShading: true });

    this.tool = new THREE.Group();

    const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.026, 0.52, 8), wood);
    haft.position.set(0, -0.10, 0);
    this.tool.add(haft);

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.14, 8), band);
    grip.position.set(0, -0.30, 0);
    this.tool.add(grip);

    // head — a blunt slab with a tenderising face
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.105, 0.20), steel);
    head.position.set(0, 0.17, 0);
    head.castShadow = true;
    this.tool.add(head);
    this.head = head;

    // the studs that make it a tenderiser rather than a sledge
    for (let ix = -1; ix <= 1; ix++) {
      for (let iz = -1; iz <= 1; iz++) {
        const stud = new THREE.Mesh(new THREE.BoxGeometry(0.021, 0.018, 0.021), steel);
        stud.position.set(ix * 0.028, 0.226, iz * 0.055);
        this.tool.add(stud);
      }
    }

    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 0.075), steel);
    cheek.position.set(0, 0.17, -0.13);
    this.tool.add(cheek);

    this.root.add(this.tool);
    this.root.traverse(o => o.layers.set(LAYER_VIEWMODEL));

    this.root.scale.setScalar(0.85);
    this.restPos = new THREE.Vector3(0.24, -0.30, -0.42);
    this.restRot = new THREE.Euler(0.30, -0.30, 0.42);
    this.root.position.copy(this.restPos);
    this.root.rotation.copy(this.restRot);
    this.root.visible = false;
  }

  get busy() { return this.swing > 0; }

  update(dt, input, active) {
    this.root.visible = active && this.owned;
    if (this.cooldown > 0) this.cooldown -= dt;

    if (this.swing > 0) {
      const prev = this.swing;
      this.swing += dt;
      if (!this.didImpact && prev < HAMMER.impactAt && this.swing >= HAMMER.impactAt) {
        this.didImpact = true;
        this._impact();
      }
      if (this.swing >= HAMMER.swingTime) {
        this.swing = 0;
        this.cooldown = HAMMER.cooldown;
      }
    } else if (active && this.owned && input.lmbDown &&
               this.cooldown <= 0 && this.ctrl.frozen <= 0) {
      this.swing = 0.0001;
      this.didImpact = false;
      this.ctrl.stamina.spend(HAMMER.staminaCost);
      this.audio?.hammerSwing();
    }

    if (active && this.owned) this._animate(dt, input);
  }

  _impact() {
    const origin = this.ctrl.pos.clone()
      .addScaledVector(this.ctrl.flatForward, 0.6)
      .setY(this.ctrl.pos.y - 0.35);
    this.onImpact?.(origin, this.ctrl.forward);
  }

  _animate(dt, input) {
    const k = 1 - Math.exp(-14 * dt);
    this._swayX += (-input.mouseDX * 0.0014 - this._swayX) * k;
    this._swayY += (-input.mouseDY * 0.0014 - this._swayY) * k;
    this._swayX = THREE.MathUtils.clamp(this._swayX, -0.07, 0.07);
    this._swayY = THREE.MathUtils.clamp(this._swayY, -0.07, 0.07);

    const lagK = 1 - Math.exp(-16 * dt);
    this._lagX += (this.ctrl.bob.x * 0.55 - this._lagX) * lagK;
    this._lagY += (this.ctrl.bob.y * 0.55 - this._lagY) * lagK;

    let px = this.restPos.x + this._swayX + this._lagX;
    let py = this.restPos.y + this._swayY + this._lagY;
    let pz = this.restPos.z;
    let rx = this.restRot.x, ry = this.restRot.y, rz = this.restRot.z;

    if (this.ctrl.sprinting) {
      const s = Math.sin(this.ctrl.bob.phase * 3.1);
      px += 0.06 + s * 0.05;
      py -= 0.05;
      rz += 0.35 + s * 0.1;
    }

    if (this.swing > 0) {
      const t = THREE.MathUtils.clamp(this.swing / HAMMER.swingTime, 0, 1);
      const impactT = HAMMER.impactAt / HAMMER.swingTime;

      if (t < impactT) {
        // wind up and over the shoulder
        const w = t / impactT;
        rx -= w * 1.5;
        py += w * 0.22;
        pz += w * 0.16;
        rz += w * 0.25;
      } else {
        // drive down and through, then recover
        const d = (t - impactT) / (1 - impactT);
        const swingArc = Math.sin(Math.min(1, d * 1.5) * Math.PI);
        rx += (1 - d) * 1.9 * (1 - d) - 0.2;
        py -= swingArc * 0.30;
        pz -= swingArc * 0.34;
        px -= swingArc * 0.10;
        rz -= swingArc * 0.30;
      }
    }

    this.root.position.set(px, py, pz);
    this.root.rotation.set(rx, ry, rz);
  }
}
