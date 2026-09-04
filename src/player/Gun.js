import * as THREE from 'three';
import { LAYER_VIEWMODEL } from '../core/Engine.js';
import { applySkinTo } from '../economy/applySkin.js';

// The Culling Piece — a break-action varmint gun.
//
// Deliberately the WORSE way to get a rabbit, so the lunge stays the skill play:
//   · shot meat is RUINED — the dough is worth ~45% of a clean catch
//   · the report is heard 40m out, which empties the field
//   · ammo costs coins, so a bad day with it actually loses you money
// It exists for the rabbit you cannot corner, and for players who want it.

export const GUN = {
  magazine: 2,            // two shells, then it breaks open and reloads
  reloadTime: 1.9,
  fireDelay: 0.30,        // between shots
  range: 45,
  spread: 0.006,          // radians; tight, this is not a shotgun
  recoilPitch: 0.085,
  recoilKick: 0.16,
  scareRadius: 40,
  meatPenalty: 0.45,      // value multiplier on a shot rabbit
  ammoCost: 12,           // coins per shell — unused while the reserve is infinite
};

export class Gun {
  constructor(engine, controller, audio) {
    this.engine = engine;
    this.ctrl = controller;
    this.audio = audio;

    this.ammo = GUN.magazine;
    this.reserve = Infinity;      // unlimited — see _fire()
    this.cooldown = 0;
    this.reloading = 0;
    this.recoil = 0;
    this.recoilVel = 0;
    this.flash = 0;

    this.onShoot = null;    // (origin, dir) => rabbit|null
    this.onScare = null;

    this.root = new THREE.Group();
    this.engine.vmScene.add(this.root);
    this._build();

    this._swayX = 0; this._swayY = 0;
    this._lagX = 0;  this._lagY = 0;
  }

  _build() {
    const wood  = new THREE.MeshStandardMaterial({ color: 0x6b4327, roughness: .78, flatShading: true });
    // Same trap as the coins: high metalness with no environment map reflects
    // nothing and renders black. Stay mostly dielectric and fake the sheen.
    const steel = new THREE.MeshStandardMaterial({ color: 0x8d939e, roughness: .45, metalness: .3,
                                                   emissive: 0x22252b, emissiveIntensity: .6, flatShading: true });
    const brass = new THREE.MeshStandardMaterial({ color: 0xd8b463, roughness: .4, metalness: .3,
                                                   emissive: 0x4a3a10, emissiveIntensity: .6, flatShading: true });

    this.gun = new THREE.Group();

    // stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.10, 0.30), wood);
    stock.position.set(0, -0.028, 0.16);
    this.gun.add(stock);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.085, 0.09), wood);
    grip.position.set(0, -0.062, 0.05);
    grip.rotation.x = -0.32;
    this.gun.add(grip);

    // receiver
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.072, 0.16), steel);
    receiver.position.set(0, 0.005, -0.02);
    this.gun.add(receiver);

    // twin barrels
    this.barrels = new THREE.Group();
    this.barrels.position.set(0, 0.018, -0.10);
    this.gun.add(this.barrels);
    for (const x of [-0.017, 0.017]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.46, 8), steel);
      b.rotation.x = Math.PI / 2;
      b.position.set(x, 0, -0.23);
      this.barrels.add(b);
    }
    // fore-end
    const fore = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.036, 0.15), wood);
    fore.position.set(0, -0.022, -0.16);
    this.barrels.add(fore);

    // bead sight
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 6, 5), brass);
    bead.position.set(0, 0.017, -0.455);
    this.barrels.add(bead);

    // trigger guard
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 5, 10, Math.PI), steel);
    guard.position.set(0, -0.040, 0.03);
    guard.rotation.set(Math.PI / 2, 0, 0);
    this.gun.add(guard);

    // ── muzzle flash ──
    // Three parts, because one fading cone reads as a glow rather than a bang:
    // a hot cone of gas out of the bore, a four-point star across it, and a
    // light that actually throws the gun and your hands into relief for two
    // frames. All of it is hidden at rest and driven by `this.flash`.
    // In FRONT of the bore, not level with it. At z -0.52 the flash sat just
    // inside the barrel tip (which ends at -0.56) and was depth-tested away —
    // the whole effect was invisible without a single error to show for it.
    this.muzzle = new THREE.Group();
    this.muzzle.position.set(0, 0.018, -0.60);
    this.gun.add(this.muzzle);

    this.flashCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.075, 0.26, 7, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff0c0, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    this.flashCone.rotation.x = -Math.PI / 2;
    this.flashCone.position.z = -0.09;
    this.muzzle.add(this.flashCone);

    // the star: two crossed quads, spun a random amount every shot
    this.flashStar = new THREE.Group();
    const starMat = new THREE.MeshBasicMaterial({
      color: 0xffcf6a, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    for (const rot of [0, Math.PI / 2]) {
      const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.055), starMat);
      blade.rotation.z = rot;
      this.flashStar.add(blade);
    }
    this.flashStar.position.z = -0.02;
    this.muzzle.add(this.flashStar);
    this.flashStarMat = starMat;

    // Viewmodel lights live on the viewmodel layer or they light nothing —
    // Three filters lights by layer exactly as it filters meshes.
    this.flashLight = new THREE.PointLight(0xffc06a, 0, 2.2, 2);
    this.flashLight.position.set(0, 0.02, -0.1);
    this.muzzle.add(this.flashLight);

    this.root.add(this.gun);
    this.root.traverse(o => o.layers.set(LAYER_VIEWMODEL));

    this.root.scale.setScalar(0.72);
    this.restPos = new THREE.Vector3(0.135, -0.165, -0.34);
    this.restRot = new THREE.Euler(0.02, 0.045, 0);
    this.root.position.copy(this.restPos);
    this.root.rotation.copy(this.restRot);
    this.root.visible = false;
  }

  // Cosmetic only (§17.5). The flash rig keeps its own materials — a skinned
  // muzzle flash is not a skin, it is a bug.
  applySkin(inst) {
    if (inst.collection && inst.collection !== 'gun') return;
    // Detach the flash rig first. It is additive, unlit and depth-write-off;
    // repainting it as painted steel would turn the muzzle flash into a small
    // grey cone welded to the barrel.
    this.gun.remove(this.muzzle);
    applySkinTo(this.gun, inst);
    this.gun.add(this.muzzle);
    this.root.traverse(o => o.layers.set(LAYER_VIEWMODEL));
    this.equipped = inst;
  }

  get busy() { return this.reloading > 0; }

  update(dt, input, active) {
    this.root.visible = active;

    if (this.cooldown > 0) this.cooldown -= dt;

    if (this.reloading > 0) {
      this.reloading -= dt;
      // The reserve is infinite, so a reload always refills — but you still
      // spend the 1.9s, and that is the whole cost of the two-shell magazine.
      if (this.reloading <= 0) this.ammo = GUN.magazine;
    }

    if (active) {
      if (input.lmbDown) this._fire();
      // top up automatically the moment the barrels are empty; there is
      // nothing to decide about, so do not make the player press R
      if (this.ammo <= 0 && this.reloading <= 0 && this.cooldown <= 0) this._startReload();
      else if (input.hit?.('reload') && this.ammo < GUN.magazine && this.reloading <= 0) {
        this._startReload();
      }
    }

    // recoil spring back to zero
    const stiff = 150, damp = 15;
    this.recoilVel += (-stiff * this.recoil - damp * this.recoilVel) * dt;
    this.recoil += this.recoilVel * dt;

    // The flash is very short and very bright — ~70ms of visible life.
    this.flash = Math.max(0, this.flash - dt * 15);
    const f = this.flash;
    const punch = f * f;                       // fall off fast, not linearly
    this.flashCone.material.opacity = Math.min(1, punch * 1.5);
    this.flashStarMat.opacity = Math.min(0.9, punch * 1.0);
    this.flashCone.scale.set(0.7 + f * 0.7, 0.6 + f * 1.1, 0.7 + f * 0.7);
    this.flashStar.scale.setScalar(0.3 + punch * 0.8);
    this.flashLight.intensity = punch * 9;
    this.muzzle.visible = f > 0.001;

    if (active) this._animate(dt, input);
  }

  _startReload() {
    this.reloading = GUN.reloadTime;
    this.audio?.reload();
  }

  _fire() {
    if (this.cooldown > 0 || this.reloading > 0) return;
    if (this.ammo <= 0) { this.audio?.dryFire(); return; }

    // Two shells, then a reload — but the reserve is infinite, so you never
    // run dry, you only ever run LATE. The rhythm is the cost, not the count.
    this.ammo -= 1;
    this.cooldown = GUN.fireDelay;

    // recoil
    this.recoilVel -= 5.2;
    this.ctrl.pitch += GUN.recoilPitch * (0.75 + Math.random() * 0.5);
    this.flash = 1;
    this.flashStar.rotation.z = Math.random() * Math.PI;   // never the same shape twice
    this.muzzle.visible = true;

    // hitscan from the eye, with a little spread
    const dir = this.ctrl.forward.clone();
    dir.x += (Math.random() - 0.5) * GUN.spread;
    dir.y += (Math.random() - 0.5) * GUN.spread;
    dir.z += (Math.random() - 0.5) * GUN.spread;
    dir.normalize();

    this.audio?.gunshot();
    this.onShoot?.(this.ctrl.pos.clone(), dir);
    // Everything for 40m knows exactly where you are now.
    this.onScare?.(this.ctrl.pos, GUN.scareRadius);
  }

  _animate(dt, input) {
    const k = 1 - Math.exp(-14 * dt);
    this._swayX += (-input.mouseDX * 0.0012 - this._swayX) * k;
    this._swayY += (-input.mouseDY * 0.0012 - this._swayY) * k;
    this._swayX = THREE.MathUtils.clamp(this._swayX, -0.06, 0.06);
    this._swayY = THREE.MathUtils.clamp(this._swayY, -0.06, 0.06);

    const lagK = 1 - Math.exp(-16 * dt);
    this._lagX += (this.ctrl.bob.x * 0.5 - this._lagX) * lagK;
    this._lagY += (this.ctrl.bob.y * 0.5 - this._lagY) * lagK;

    let px = this.restPos.x + this._swayX + this._lagX;
    let py = this.restPos.y + this._swayY + this._lagY;
    let pz = this.restPos.z - this.recoil * GUN.recoilKick;
    let rx = this.restRot.x + this.recoil * 0.55;
    let ry = this.restRot.y, rz = this.restRot.z;

    // a long gun is unwieldy at a run — it swings out and points skyward
    if (this.ctrl.sprinting) {
      const s = Math.sin(this.ctrl.bob.phase * 3.1);
      px += 0.06 + s * 0.04;
      py -= 0.04;
      rz += 0.42 + s * 0.09;
      rx -= 0.30;
    }

    // reload: break the action open and tip it down
    if (this.reloading > 0) {
      const t = 1 - this.reloading / GUN.reloadTime;
      const swing = Math.sin(Math.min(1, t * 1.15) * Math.PI);
      py -= 0.10 * swing;
      rz += 0.55 * swing;
      rx -= 0.30 * swing;
      this.barrels.rotation.x = swing * 0.42;     // break open
    } else {
      this.barrels.rotation.x *= 1 - Math.min(1, 10 * dt);
    }

    this.root.position.set(px, py, pz);
    this.root.rotation.set(rx, ry, rz);
  }
}
