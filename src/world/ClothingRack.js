import * as THREE from 'three';

// THE CLOTHING RACK — GAME_DESIGN.md §7
//
// Where skins stop being a slot machine payout and become a wardrobe. §7 puts
// sell-back here specifically ("any skin sells at the clothing rack"), so this
// one object is both the equip screen and the cash-out counter.
//
// ONE rack, THREE rails — one per collection. Three separate racks would have
// meant three interaction radii overlapping in a two-metre span, which is the
// mistake the chests already made once and had to be spread out to fix.
//
// Entirely procedural: a frame, three rails, and a hanger per rail whose
// colour is the skin currently equipped there. That last part is the point —
// you can see what you are wearing from across the clearing without opening
// anything.

export const RACK = {
  radius: 2.8,          // interaction range, a little wider than a chest
  width: 2.4,
  height: 2.0,
  railGap: 0.52,
};

const RAILS = ['glove', 'gun', 'brush'];
const RAIL_LABEL = { glove: 'GLOVE', gun: 'GUN', brush: 'BRUSH' };

export class ClothingRack {
  constructor(scene, world, position, yaw = 0) {
    this.world = world;
    this.pos = position.clone();
    this.pos.y = world.groundHeight(position.x, position.z);
    this.radius = RACK.radius;

    this.root = new THREE.Group();
    this.root.position.copy(this.pos);
    this.root.rotation.y = yaw;
    scene.add(this.root);

    this.glow = 0;
    this.hangers = {};      // collection -> mesh, recoloured on equip

    this._build();
    this._addCollider();
  }

  _build() {
    const steel = new THREE.MeshStandardMaterial({
      color: 0x8b8f96, roughness: 0.42, metalness: 0.65, flatShading: true });
    const wood = new THREE.MeshStandardMaterial({
      color: 0x6b4a30, roughness: 0.88, flatShading: true });

    const W = RACK.width, H = RACK.height;

    // ── uprights and feet ──
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, H, 8), steel);
      post.position.set(sx * W / 2, H / 2, 0);
      post.castShadow = true;
      this.root.add(post);

      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.72), wood);
      foot.position.set(sx * W / 2, 0.035, 0);
      foot.castShadow = true; foot.receiveShadow = true;
      this.root.add(foot);
    }

    // ── the three rails, and a hanger on each ──
    RAILS.forEach((kind, i) => {
      const y = H - 0.28 - i * RACK.railGap;

      const rail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.032, W, 8), steel);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, y, 0);
      rail.castShadow = true;
      this.root.add(rail);

      // The hanger is the readout. It starts grey — no skin equipped — and is
      // recoloured by setEquipped() the moment one is.
      const hanger = new THREE.Group();
      hanger.position.set(0, y, 0);

      const hook = new THREE.Mesh(
        new THREE.TorusGeometry(0.055, 0.012, 6, 12, Math.PI * 1.4),
        steel);
      hook.rotation.x = Math.PI / 2;
      hook.position.y = -0.02;
      hanger.add(hook);

      const cloth = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.34, 0.05),
        new THREE.MeshStandardMaterial({
          color: 0x55585e, roughness: 0.72, metalness: 0.05, flatShading: true }),
      );
      cloth.position.y = -0.26;
      cloth.castShadow = true;
      hanger.add(cloth);

      hanger.userData.cloth = cloth;
      this.hangers[kind] = hanger;
      this.root.add(hanger);

      this.root.add(this._label(RAIL_LABEL[kind], -W / 2 - 0.30, y - 0.1));
    });

    // ── the sign ──
    this.root.add(this._label('WARDROBE', 0, H + 0.20, 1.5, 0.34, 30));

    // A low warm light so the rails read at dusk, which is when you will
    // actually be standing here.
    this.lamp = new THREE.PointLight(0xffe0b0, 0.0, 6, 2);
    this.lamp.position.set(0, H + 0.1, 0.3);
    this.root.add(this.lamp);
  }

  _label(text, x, y, w = 0.62, h = 0.17, size = 26) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = Math.round(256 * (h / w));
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(18,14,12,0.80)';
    g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = '#d8c9a8'; g.lineWidth = 3;
    g.strokeRect(2, 2, c.width - 4, c.height - 4);
    g.fillStyle = '#d8c9a8';
    g.font = `bold ${size}px system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, c.width / 2, c.height / 2);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }),
    );
    m.position.set(x, y, 0);
    return m;
  }

  // Paint a hanger to match what is on that weapon. `inst` may be null, which
  // returns the rail to bare grey.
  setEquipped(kind, inst) {
    const cloth = this.hangers[kind]?.userData.cloth;
    if (!cloth) return;
    cloth.material.color.setHex(inst?.color ?? 0x55585e);
    cloth.material.metalness = inst?.metal ?? 0.05;
    cloth.material.roughness = inst?.rough ?? 0.72;
  }

  _addCollider() {
    // Half-depth is generous: the rails are thin, but walking through a
    // wardrobe reads worse than being stopped slightly early.
    this.world.colliders.push({
      x: this.pos.x, z: this.pos.z, hw: RACK.width / 2 + 0.1, hd: 0.42,
    });
  }

  canUse(playerPos) {
    return playerPos.distanceTo(this.pos) < this.radius;
  }

  update(dt, playerPos, night = false) {
    const near = playerPos ? this.canUse(playerPos) : false;
    this.glow += ((near ? 1 : 0) - this.glow) * Math.min(1, dt * 5);
    // Lit when you are close, and dimly lit all night so it is findable.
    this.lamp.intensity = this.glow * 1.5 + (night ? 0.5 : 0);

    // hangers sway, very slightly, and only when you are near enough to notice
    this._t = (this._t ?? 0) + dt;
    let i = 0;
    for (const kind of RAILS) {
      const h = this.hangers[kind];
      if (h) h.rotation.z = Math.sin(this._t * 0.9 + i) * 0.035 * this.glow;
      i++;
    }
  }
}
