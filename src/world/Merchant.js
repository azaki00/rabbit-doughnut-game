import * as THREE from 'three';
import { loadModel } from './Loaders.js';

// THE STRANGER.
//
// He stands in the far corner of the meadow with the only Tenderiser in the
// world and no idea what it is for. Everything else in the game is a counter
// you press E at; he is a person you talk to, and the difference is the point —
// the hammer used to be a line item at the cooking table, which made the boss
// fight feel like a vending machine.
//
// He owns his own camera framing. `focus` is where the view sits during a
// conversation and `lookAt` is what it points at, both derived from his actual
// head position, so the Elder-Scrolls zoom does not need hand-tuned numbers.

const MERCHANT_DIR = 'OBJECTS/merchant-stranger/';
const MERCHANT_URL = MERCHANT_DIR + 'model.obj';
// its MTL is `materials.mtl`, not `model.mtl` — the usual trap
const MERCHANT_MTL = MERCHANT_DIR + 'materials.mtl';

const CART_URL = 'OBJECTS/broken-wagon/Cart.fbx';
const SHACK_URL = 'OBJECTS/small-shack/Houses_FirstAge_2_Level1.fbx';
const PINE_URL = 'OBJECTS/Resource_PineTree_Group.fbx';
const LEAFY_URL = 'OBJECTS/Resource_Tree_Group.fbx';

export const MERCHANT = {
  height: 1.72,
  talkRadius: 4.2,
  shackHeight: 3.8,
  // How far back the shack sits from him, in his local frame. +Z is BEHIND him
  // (forward is -Z), so this must be positive or the building ends up between
  // you and the man you are trying to talk to.
  //
  // Far enough back that he stands at its FRONT EDGE, under the eaves rather
  // than in the middle of the floor. Deep inside, the conversation camera —
  // which sits 1.15m in front of his face — ended up inside the roof beams
  // with the top half of the shot full of timber.
  shackBack: 4.7,
  // where the shack goes, before the clearance search nudges it
  prefer: new THREE.Vector3(38, 0, 36),
};

export class Merchant {
  constructor(scene, world, position, sfx) {
    this.scene = scene;
    this.world = world;
    this.sfx = sfx;
    this.pos = position.clone();
    this.pos.y = world.groundHeight(position.x, position.z);
    // Facing back toward the middle of the map, so you meet his front.
    // Our forward is (-sin y, -cos y): to point at the origin from (x, z) that
    // needs atan2(x, z), not atan2(-x, -z) — the latter turns his back to you.
    this.yaw = Math.atan2(this.pos.x, this.pos.z);

    this.root = new THREE.Group();
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    // He and his belongings never count as blocking the shot of him — see
    // clearChatSpot() in main.js. Otherwise the ray leaves his own face and
    // immediately hits his own coat.
    this.root.userData.noChatBlock = true;
    scene.add(this.root);

    this.bobT = Math.random() * 10;
    this.talking = false;

    this._buildStall();
    this._buildFallback();
    this._loadReal();
    this._loadCart();
    this._loadShack();
    this._loadTrees();

    // No collider for the man himself. You have to be able to get within 4.2m
    // to talk, and a box around him under a roof makes that fiddly.
  }

  // ── the grove ──
  //
  // Trees crowd the shack from behind and both sides so the whole thing sits in
  // shade and you have to come round to find it. The FRONT ARC IS KEPT CLEAR on
  // purpose: that is where you walk in from and where the conversation camera
  // lives, and a pine growing through the middle of a cutscene is exactly the
  // sort of thing nobody notices until it happens.
  async _loadTrees() {
    const [pine, leafy] = await Promise.all([
      loadModel(PINE_URL, { height: 7.5, recolor: { Wood: 0x6f4a2c, Green: 0x3f6b31 } }),
      loadModel(LEAFY_URL, { height: 6.4, recolor: { Wood: 0x7a5433, Green: 0x5c8a3a } }),
    ]);
    const protos = [pine, leafy].filter(Boolean);
    if (!protos.length) return;

    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    // Angles measured from his facing. 0 is straight ahead; the ±55° wedge in
    // front is left empty.
    // A wide clear wedge in front. The conversation camera lives in here, and
    // it re-checks its line every quarter second — but keeping the wedge empty
    // in the first place means it almost never has to fall back to a worse shot.
    const CLEAR = 78 * Math.PI / 180;
    this.trees = [];

    for (let i = 0; i < 16; i++) {
      let a = (i / 16) * Math.PI * 2 - Math.PI;
      if (Math.abs(a) < CLEAR) continue;          // keep the approach open
      a += (Math.random() - 0.5) * 0.22;

      const r = 8.5 + Math.random() * 4.5;
      const lx = Math.sin(a) * r;
      const lz = -Math.cos(a) * r;                // local -Z is forward

      const t = protos[Math.random() < 0.6 ? 0 : protos.length - 1].clone(true);
      const scale = 0.85 + Math.random() * 0.6;
      t.scale.multiplyScalar(scale);
      t.rotation.y = Math.random() * Math.PI * 2;
      t.position.set(
        this.pos.x + right.x * lx - fwd.x * lz,
        this.world.groundHeight(0, 0),
        this.pos.z + right.z * lx - fwd.z * lz,
      );
      t.traverse(o => { if (o.isMesh) o.castShadow = true; });
      this.scene.add(t);
      this.trees.push(t);
      this.world.colliders.push({
        x: t.position.x, z: t.position.z, hw: 0.9 * scale, hd: 0.9 * scale,
      });
    }
  }

  // The shack he lives out of. He stands in its doorway; the cart is broken
  // down beside it.
  async _loadShack() {
    const m = await loadModel(SHACK_URL, { height: MERCHANT.shackHeight });
    if (!m) { console.warn('[merchant] shack unavailable'); return; }
    m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    // set back behind him, so he stands under its roof near the front edge
    m.position.set(0, 0, MERCHANT.shackBack);
    this.shack = m;
    this.root.add(m);

    // It is an OPEN pavilion on posts, not a hut. A solid box collider for it
    // would wall off the man standing inside; only the four corner posts are
    // solid, so you can walk under the roof to talk to him.
    const box = new THREE.Box3().setFromObject(m);
    const size = new THREE.Vector3();
    box.getSize(size);
    const hw = Math.max(0.8, size.x / 2 - 0.45);
    const hd = Math.max(0.8, size.z / 2 - 0.45);
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        // local (sx*hw, sz*hd + shackBack) rotated into the world
        const lx = sx * hw;
        const lz = sz * hd + MERCHANT.shackBack;
        this.world.colliders.push({
          x: this.pos.x + right.x * lx - fwd.x * lz,
          z: this.pos.z + right.z * lx - fwd.z * lz,
          hw: 0.34,
          hd: 0.34,
        });
      }
    }
  }

  // The real cart, if it loads. Everything else in the stall is procedural and
  // stays either way, so a failed load costs a wagon and nothing else.
  async _loadCart() {
    const m = await loadModel(CART_URL, { height: 1.5 });
    if (!m) { console.warn('[merchant] cart unavailable, using the built one'); return; }
    m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    if (this.cart) this.root.remove(this.cart);
    // beside the shack, out from under the roof, listing on a broken axle
    m.position.set(-3.6, 0, 2.6);
    m.rotation.y = 0.75;
    m.rotation.z = 0.12;
    this.cart = m;
    this.root.add(m);
  }

  // A cart and a brazier, so a lone figure in a field reads as a shop. The cart
  // here is a stand-in, replaced by broken-wagon/Cart.fbx once that loads.
  _buildStall() {
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a5330, roughness: .92, flatShading: true });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x5a3f74, roughness: .95, flatShading: true, side: THREE.DoubleSide });
    const iron = new THREE.MeshStandardMaterial({ color: 0x3e3a36, roughness: .6, metalness: .3, flatShading: true });

    // the cart, behind and beside him
    const cart = new THREE.Group();
    cart.position.set(-3.6, 0, 2.6);
    cart.rotation.y = 0.75;
    this.root.add(cart);
    this.cart = cart;

    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 1.05), wood);
    bed.position.y = 0.78;
    bed.castShadow = true;
    cart.add(bed);
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.42, 0.09), wood);
      side.position.set(0, 1.0, sx * 0.48);
      cart.add(side);
    }
    for (const sx of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 5, 12), iron);
      wheel.position.set(0.55, 0.44, sx * 0.58);
      wheel.rotation.y = Math.PI / 2;
      wheel.castShadow = true;
      cart.add(wheel);
    }
    // a tarp humped over whatever else he is carrying
    const tarp = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), cloth);
    tarp.scale.set(1.25, 0.62, 0.72);
    tarp.position.set(-0.45, 0.87, 0);
    tarp.castShadow = true;
    cart.add(tarp);

    // a brazier, so he is findable in the dark and in the storm
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.18, 0.24, 8), iron);
    bowl.position.set(2.0, 0.62, -0.5);
    bowl.castShadow = true;
    this.root.add(bowl);
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.06), iron);
      const a = (i / 3) * Math.PI * 2;
      leg.position.set(2.0 + Math.cos(a) * 0.16, 0.27, -0.5 + Math.sin(a) * 0.16);
      this.root.add(leg);
    }
    this.fire = new THREE.Mesh(
      new THREE.ConeGeometry(0.19, 0.42, 6),
      new THREE.MeshBasicMaterial({ color: 0xff9a3a, transparent: true, opacity: 0.85 }),
    );
    this.fire.position.set(2.0, 0.9, -0.5);
    this.root.add(this.fire);

    this.glow = new THREE.PointLight(0xff9a4a, 1.6, 9, 2);
    this.glow.position.set(2.0, 1.1, -0.5);
    this.root.add(this.glow);
  }

  _buildFallback() {
    const robe = new THREE.MeshStandardMaterial({ color: 0x4a2f5c, roughness: .95, flatShading: true });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc9a07c, roughness: .85, flatShading: true });

    this.who = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.4, 1.2, 7), robe);
    body.position.y = 0.6;
    body.castShadow = true;
    this.who.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), skin);
    head.position.y = 1.4;
    head.castShadow = true;
    this.who.add(head);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.34, 7), robe);
    hood.position.y = 1.52;
    this.who.add(hood);

    this.root.add(this.who);
    this.fallbackWho = this.who;
  }

  async _loadReal() {
    const m = await loadModel(MERCHANT_URL, { height: MERCHANT.height, mtl: MERCHANT_MTL });
    if (!m) { console.warn('[merchant] model unavailable, using fallback'); return; }
    m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.root.remove(this.who);
    // Authored facing +Z; our convention is -Z, so without this he greets you
    // with the back of his hood and the conversation camera frames his shoulders.
    m.rotation.y = Math.PI;
    this.who = m;
    this.root.add(m);
  }

  // ── the conversation camera ──
  //
  // Framed for the dialogue box, which eats the bottom 40% of the screen: the
  // camera sits just above his eyeline and aims at his CHEST, which pushes his
  // head into the upper third where you can actually see it. Aiming at the head
  // centred him behind the box and left the shot full of trees.
  //
  // All of it derives from his own transform, so it stays correct wherever the
  // clearance search puts him.
  get headPos() {
    return new THREE.Vector3(this.pos.x, this.pos.y + MERCHANT.height * 0.88, this.pos.z);
  }

  get focus() { return this.focusCandidates()[0]; }

  // Several framings, best first. main.js raycasts each one back to his face
  // and takes the first with a clear line — so a tree, a roof beam or his own
  // cart can never end up between the camera and the man talking to you.
  focusCandidates() {
    const out = [];
    // angle off his facing, distance, side offset
    const shots = [
      [0.0, 1.15, 0.34],
      [0.0, 1.35, -0.34],
      [0.45, 1.25, 0.0],
      [-0.45, 1.25, 0.0],
      [0.85, 1.35, 0.0],
      [-0.85, 1.35, 0.0],
      [0.0, 0.85, 0.2],       // last resort: right up in his face
    ];
    for (const [turn, dist, side] of shots) {
      const y = this.yaw + turn;
      const fwd = new THREE.Vector3(-Math.sin(y), 0, -Math.cos(y));
      const right = new THREE.Vector3(Math.cos(y), 0, -Math.sin(y));
      out.push(
        this.headPos
          .clone()
          .addScaledVector(fwd, dist)
          .addScaledVector(right, side)
          .setY(this.pos.y + MERCHANT.height * 0.95),
      );
    }
    return out;
  }

  // chest height, which lifts his head clear of the dialogue box
  get lookAt() {
    return new THREE.Vector3(this.pos.x, this.pos.y + MERCHANT.height * 0.60, this.pos.z);
  }

  canTalk(playerPos) {
    return this.pos.distanceTo(playerPos) < MERCHANT.talkRadius;
  }

  update(dt) {
    this.bobT += dt;
    // he shifts his weight; the fire gutters
    if (this.who) {
      this.who.position.y = Math.abs(Math.sin(this.bobT * 1.1)) * 0.018;
      const base = this.who === this.fallbackWho ? 0 : Math.PI;
      this.who.rotation.y = base + (this.talking ? 0 : Math.sin(this.bobT * 0.4) * 0.22);
    }
    const flick = 1 + Math.sin(this.bobT * 11) * 0.1 + Math.sin(this.bobT * 27) * 0.06;
    this.fire.scale.set(1, flick, 1);
    this.fire.material.opacity = 0.72 + Math.sin(this.bobT * 17) * 0.12;
    this.glow.intensity = 1.5 * flick;
  }
}
