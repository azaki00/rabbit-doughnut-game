import * as THREE from "three";
import { loadModel } from "./Loaders.js";

// THE SUNNY-SIDE SOVEREIGN — boss fight.
//
// A giant egg sits inert at the far end of the meadow. Nothing you own can hurt
// it: not the glove, not the gun. To start the fight you have to earn 1000
// coins, buy THE TENDERISER at the cooking table, and crack the shell open with
// it. Six good hits and the Sovereign is summoned.
//
// Phases scale with missing health: it gets faster, slams harder, and starts
// throwing yolk. The only sensible weapon is the gun (unlimited ammo); the
// glove does chip damage if you are brave enough to lunge at it.

// Two models, one creature. Sealed, it is an intact shell egg; the hammer
// cracks that open and the Sovereign underneath — the fried egg — is revealed.
const SHELL_URL = "OBJECTS/EggWithShell/model.obj";
const EGG_URL = "OBJECTS/eggSunnysideUp.obj";

// eggSunnysideUp.mtl names its two materials. The yolk one has to be forced
// yellow: the model was being loaded without its MTL at all, so BOTH the white
// and the yolk arrived as OBJLoader's default white and the boss read as a
// featureless pale blob.
const EGG_YOLK_MAT = "lambert3SG";
const YOLK_COLOR = 0xf6b91a;
const WHITE_COLOR = 0xf8f3e4;

export const BOSS = {
  maxHealth: 4000,
  size: 4.2, // largest world dimension — a big animal, not a building
  height: 1.9, // approximate standing height, for aim points
  bodyRadius: 2.0,

  wakeRadius: 26,
  chaseSpeed: 3.2,
  enrageSpeed: 6.4,

  slamRange: 5.0,
  slamWindup: 0.85,
  slamDamage: 26,
  slamRadius: 5.5,
  slamCooldown: 3.4,

  spitCooldown: 2.6,
  spitSpeed: 15,
  spitDamage: 14,

  gunDamage: 85,
  gloveDamage: 30,
  headshotMult: 2.2,

  // ── phase two ──
  // At half health it stops relying on reach and starts throwing live
  // chickens, which chase you down. This is the answer to backing away and
  // plinking: the Sovereign cannot follow you, so it sends something that can.
  chickenPhase: 0.5, // health ratio at or below which the chickens start
  chickenCooldown: 3.0,
  chickenBurst: 2, // per throw, rising with rage

  shellSize: 3.6, // the intact egg is taller than it is wide
  shellHits: 6, // hammer blows needed to crack it
  summonTime: 2.4,
};

const ST = {
  SHELL: "SHELL",
  SUMMONING: "SUMMONING",
  CHASE: "CHASE",
  SLAM: "SLAM",
  SPIT: "SPIT",
  DYING: "DYING",
  DEAD: "DEAD",
};
export { ST as BOSS_STATE };

const _v = new THREE.Vector3();

export class EggBoss {
  constructor(scene, world, position, audio) {
    this.scene = scene;
    this.world = world;
    this.audio = audio;

    this.health = BOSS.maxHealth;
    this.shell = BOSS.shellHits;
    this.state = ST.SHELL;
    this.stateTime = 0;
    this.slamCd = 0;
    this.spitCd = 3;
    this.chickenCd = 1.2;
    this.phaseTwo = false;
    this.hitFlash = 0;
    this.crackT = 0;
    this.onSummon = null;
    this.bobT = Math.random() * 10;
    this.yaw = Math.PI;
    this.wobble = 0;

    this.onDamagePlayer = null;
    this.onDeath = null;
    this.onThrowChicken = null; // (origin, targetPos) => void
    this.onPhaseTwo = null;

    this.root = new THREE.Group();
    this.root.position.copy(position);
    this.root.position.y = world.groundHeight(position.x, position.z);
    scene.add(this.root);

    this.body = new THREE.Group();
    this.root.add(this.body);

    this.projectiles = [];
    this.projGroup = new THREE.Group();
    scene.add(this.projGroup);

    this.shards = [];
    this.shardGroup = new THREE.Group();
    scene.add(this.shardGroup);

    this._buildFallback();
    this._loadShell();
    this._loadReal();
    this._buildTelegraph();
  }

  get alive() {
    return this.state !== ST.DEAD;
  }
  get awake() {
    return this.state !== ST.SHELL && this.state !== ST.DEAD;
  }
  get sealed() {
    return this.state === ST.SHELL;
  }
  get shellRatio() {
    return this.shell / BOSS.shellHits;
  }
  get healthRatio() {
    return Math.max(0, this.health / BOSS.maxHealth);
  }
  // 0 → fresh, 1 → nearly dead. Drives every escalation.
  get rage() {
    return 1 - this.healthRatio;
  }

  _buildFallback() {
    const white = new THREE.MeshStandardMaterial({
      color: 0xf7f2e6,
      roughness: 0.82,
      flatShading: true,
    });
    const yolk = new THREE.MeshStandardMaterial({
      color: 0xf0a92c,
      roughness: 0.55,
      flatShading: true,
      emissive: 0x996008,
      emissiveIntensity: 0.35,
    });
    this.fallback = new THREE.Group();

    const w = new THREE.Mesh(
      new THREE.SphereGeometry(BOSS.bodyRadius, 12, 8),
      white,
    );
    w.scale.set(1, 0.42, 1);
    w.position.y = BOSS.bodyRadius * 0.42;
    w.castShadow = true;
    this.fallback.add(w);

    const y = new THREE.Mesh(
      new THREE.SphereGeometry(BOSS.bodyRadius * 0.42, 10, 8),
      yolk,
    );
    y.scale.set(1, 0.6, 1);
    y.position.y = BOSS.bodyRadius * 0.72;
    y.castShadow = true;
    this.fallback.add(y);
    this.fallbackYolk = y;

    // The fried egg is what is INSIDE. Nothing of it shows until the shell goes.
    this.fallback.visible = false;
    this.body.add(this.fallback);

    // stand-in for the intact shell, replaced the moment the real model lands
    this.shellFallback = new THREE.Mesh(
      new THREE.SphereGeometry(BOSS.shellSize * 0.34, 14, 10),
      new THREE.MeshStandardMaterial({
        color: 0xfdf6e6,
        roughness: 0.7,
        flatShading: true,
      }),
    );
    this.shellFallback.scale.set(1, 1.35, 1);
    this.shellFallback.position.y = BOSS.shellSize * 0.46;
    this.shellFallback.castShadow = true;
    this.body.add(this.shellFallback);
  }

  // ── phase 1: the intact egg ──
  async _loadShell() {
    const m = await loadModel(SHELL_URL, { height: BOSS.shellSize });
    if (!m) {
      console.warn("[boss] shell egg unavailable, using fallback");
      return;
    }

    this.shellMats = [];
    m.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const mat of mats) {
        mat.color?.setHex(0xfdf6e6);
        mat.emissive = new THREE.Color(0x000000);
        this.shellMats.push(mat);
      }
    });

    this.body.remove(this.shellFallback);
    this.shellMesh = m;
    this.body.add(m);

    // cracks are drawn on, and one more lights up with every hammer blow
    this.cracks = this._buildCracks();
    this.body.add(this.cracks);
    const shown = BOSS.shellHits - this.shell;
    this.cracks.children.forEach((c, i) => (c.visible = i < shown));

    if (this.revealed || !this.sealed) this._revealSovereign(true);
  }

  // A cage of thin dark lines over the shell, so the damage state is legible
  // from across the meadow rather than only in the HUD pips.
  _buildCracks() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x2b2118 });

    // The shell is an ovoid roughly 0.77 as wide as it is tall. Lay each crack
    // ON that surface — a constant-radius ring sat inside the mesh and was
    // simply not there when I looked at it.
    const b = BOSS.shellSize / 2;              // semi-height
    const a = BOSS.shellSize * 0.384;          // semi-width
    const surfaceR = (y) => {
      const t = Math.min(0.97, Math.abs((y - b) / b));
      return a * Math.sqrt(1 - t * t) + 0.05;  // 5cm proud, so it never z-fights
    };

    for (let i = 0; i < BOSS.shellHits; i++) {
      const line = new THREE.Group();
      let ang = (i / BOSS.shellHits) * Math.PI * 2 + 0.4;
      let y = BOSS.shellSize * (0.78 - i * 0.045);
      for (let seg = 0; seg < 5; seg++) {
        const piece = new THREE.Mesh(
          new THREE.BoxGeometry(0.07, 0.34, 0.07),
          mat,
        );
        const r = surfaceR(y);
        piece.position.set(Math.sin(ang) * r, y, Math.cos(ang) * r);
        piece.rotation.set(0, -ang, (Math.random() - 0.5) * 1.1);
        line.add(piece);
        y -= 0.26;
        ang += (Math.random() - 0.5) * 0.5;
      }
      line.visible = false;
      g.add(line);
    }
    return g;
  }

  // The shell comes off. Called from the hammer blow that empties the shell
  // meter — or straight away, if a model finishes loading after that happened.
  _revealSovereign(instant = false) {
    if (this.revealed && !instant) return;
    this.revealed = true;

    if (this.shellMesh) this.shellMesh.visible = false;
    if (this.shellFallback) this.shellFallback.visible = false;
    if (this.cracks) this.cracks.visible = false;

    if (this.real) this.real.visible = true;
    else this.fallback.visible = true;

    if (!instant) this._burstShell();
  }

  // Shards thrown outward, so the swap between the two models reads as the egg
  // breaking rather than as one model popping into another.
  _burstShell() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xfdf6e6,
      roughness: 0.75,
      flatShading: true,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 22; i++) {
      const mesh = new THREE.Mesh(
        new THREE.TetrahedronGeometry(0.22 + Math.random() * 0.4, 0),
        mat,
      );
      const a = Math.random() * Math.PI * 2;
      const r = BOSS.shellSize * 0.3;
      mesh.position.copy(this.root.position);
      mesh.position.x += Math.sin(a) * r;
      mesh.position.z += Math.cos(a) * r;
      mesh.position.y += 0.6 + Math.random() * BOSS.shellSize * 0.8;
      mesh.castShadow = true;
      this.shardGroup.add(mesh);
      this.shards.push({
        mesh,
        vel: new THREE.Vector3(
          Math.sin(a) * (3 + Math.random() * 5),
          4 + Math.random() * 6,
          Math.cos(a) * (3 + Math.random() * 5),
        ),
        spin: new THREE.Vector3(
          (Math.random() - 0.5) * 9,
          (Math.random() - 0.5) * 9,
          (Math.random() - 0.5) * 9,
        ),
        life: 3.2,
      });
    }
  }

  _updateShards(dt) {
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      s.life -= dt;
      s.vel.y -= 18 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.rotation.x += s.spin.x * dt;
      s.mesh.rotation.y += s.spin.y * dt;
      s.mesh.rotation.z += s.spin.z * dt;

      const ground = this.world.groundHeight(
        s.mesh.position.x,
        s.mesh.position.z,
      );
      if (s.mesh.position.y < ground + 0.1) {
        s.mesh.position.y = ground + 0.1;
        s.vel.set(0, 0, 0);
        s.spin.set(0, 0, 0);
      }
      if (s.life <= 0) {
        this.shardGroup.remove(s.mesh);
        s.mesh.geometry.dispose();
        this.shards.splice(i, 1);
      }
    }
  }

  async _loadReal() {
    // fit by the LARGEST axis — the egg is a wide flat disc, and fitting by
    // height alone scaled it to 47m across
    // `mtl: true` matters: without it OBJLoader gives every material group the
    // same default white, which is why the yolk came out the colour of the
    // white. We take the MTL for the group split and then force the two colours
    // outright — the source Kd for the yolk is a muddy red-orange.
    const m = await loadModel(EGG_URL, { maxSize: BOSS.size, mtl: true });
    if (!m) {
      console.warn("[boss] egg model unavailable, using fallback");
      return;
    }
    this.body.remove(this.fallback);
    // A real fried egg is 9m across and 1.4m tall — accurate, but it reads as a
    // puddle. Stretch it vertically so it has presence to fight, while keeping
    // the wide, wobbling, unmistakably-an-egg silhouette.
    m.scale.y *= 2.0;
    this.real = m;
    m.visible = false;          // hidden underneath until the shell is cracked
    this.body.add(m);

    // collect materials so we can flash the whole thing red on a hit
    this.mats = [];
    this.yolkMats = [];
    m.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      const built = list.map((mat) => {
        const isYolk = mat?.name === EGG_YOLK_MAT;
        // Replace outright rather than tweak: the MTL ships an illum-4 phong,
        // and we want a flat-shaded standard material that survives the
        // hit-flash writes to `emissive`.
        const next = new THREE.MeshStandardMaterial({
          name: mat?.name ?? "",
          color: isYolk ? YOLK_COLOR : WHITE_COLOR,
          roughness: isYolk ? 0.5 : 0.82,
          metalness: 0,
          flatShading: true,
          side: THREE.DoubleSide,
          // a faint inner glow keeps the yolk yellow even in shadow
          emissive: new THREE.Color(isYolk ? 0x4a2f00 : 0x000000),
        });
        next.userData.baseEmissive = next.emissive.clone();
        this.mats.push(next);
        if (isYolk) this.yolkMats.push(next);
        return next;
      });
      o.material = Array.isArray(o.material) ? built : built[0];
    });

    // the yolk is the weak point — find the highest, most orange-ish mesh
    this._findWeakPoint(m);
    if (this.revealed) this._revealSovereign(true);
  }

  _findWeakPoint(m) {
    let best = null,
      bestScore = -Infinity;
    m.traverse((o) => {
      if (!o.isMesh) return;
      const box = new THREE.Box3().setFromObject(o);
      const c = new THREE.Vector3();
      box.getCenter(c);
      const col = o.material?.color;
      const orange = col ? col.r - col.b : 0;
      const score = c.y * 2 + orange * 6;
      if (score > bestScore) {
        bestScore = score;
        best = o;
      }
    });
    this.weakPoint = best;
  }

  // Red ring on the ground that fills as a slam winds up.
  _buildTelegraph() {
    this.tele = new THREE.Mesh(
      new THREE.RingGeometry(BOSS.slamRadius * 0.15, BOSS.slamRadius, 40),
      new THREE.MeshBasicMaterial({
        color: 0xe0392b,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      }),
    );
    this.tele.rotation.x = -Math.PI / 2;
    this.tele.position.y = 0.05;
    this.root.add(this.tele);
  }

  // ── damage in ──
  // While sealed, nothing gets through. Shooting it just chips paint off a
  // shell and tells the player, clearly, that they need another answer.
  hit(amount, worldPoint) {
    if (this.state === ST.SHELL) {
      this.hitFlash = 0.5;
      this.audio?.shellPing();
      return 0;
    }
    if (this.state === ST.DYING || this.state === ST.DEAD) return 0;

    let dmg = amount;
    let crit = false;
    if (this.weakPoint && worldPoint) {
      const wp = new THREE.Vector3();
      this.weakPoint.getWorldPosition(wp);
      if (wp.distanceTo(worldPoint) < 1.6) {
        dmg *= BOSS.headshotMult;
        crit = true;
      }
    }

    this.health -= dmg;
    this.hitFlash = 1;
    this.wobble = Math.min(1, this.wobble + 0.35);
    this.audio?.bossHit(crit);

    if (this.health <= 0) {
      this.health = 0;
      this.state = ST.DYING;
      this.stateTime = 0;
      this.audio?.bossDeath();
    }
    return crit ? dmg : dmg;
  }

  // The hammer. The only thing the shell answers to.
  hammer() {
    if (this.state !== ST.SHELL) {
      // once it is out, the hammer is simply a very good weapon
      return this.hit(BOSS.hammerDamage ?? 140, null);
    }
    this.shell -= 1;
    this.hitFlash = 1;
    this.wobble = 1;
    this.crackT = 1;
    this.audio?.shellCrack(1 - this.shellRatio);

    if (this.cracks) {
      const shown = BOSS.shellHits - this.shell;
      this.cracks.children.forEach((c, i) => (c.visible = i < shown));
    }

    if (this.shell <= 0) {
      this._revealSovereign();
      this.state = ST.SUMMONING;
      this.stateTime = 0;
      this.audio?.bossWake();
      this.onSummon?.();
    }
    return "shell";
  }

  wake() {
    if (this.state !== ST.SHELL) return;
    this.shell = 0;
    this._revealSovereign();
    this.state = ST.SUMMONING;
    this.stateTime = 0;
    this.audio?.bossWake();
    this.onSummon?.();
  }

  // ── ray test for the gun / lunge ──
  raycast(origin, dir, maxDist = 60) {
    if (!this.alive) return null;
    // sphere test against the body, generous because it is enormous
    _v.copy(this.root.position)
      .setY(this.root.position.y + BOSS.height * 0.42)
      .sub(origin);
    const along = _v.dot(dir);
    if (along < 0 || along > maxDist) return null;
    const perp2 = _v.lengthSq() - along * along;
    const r = BOSS.bodyRadius * 0.95;
    if (perp2 > r * r) return null;
    return origin.clone().addScaledVector(dir, along);
  }

  update(dt, player) {
    this.stateTime += dt;
    this.bobT += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 4);
    this.wobble = Math.max(0, this.wobble - dt * 1.6);
    if (this.slamCd > 0) this.slamCd -= dt;
    if (this.spitCd > 0) this.spitCd -= dt;
    if (this.chickenCd > 0) this.chickenCd -= dt;
    this._chickens(dt, player);

    this._updateProjectiles(dt, player);
    this._updateShards(dt);

    switch (this.state) {
      case ST.SHELL: {
        // Inert. It does not chase, it does not attack, it just sits there
        // being an egg. Only the hammer changes that.
        break;
      }

      case ST.SUMMONING: {
        // shell bursts, the Sovereign rises
        if (this.stateTime > BOSS.summonTime) {
          this.state = ST.CHASE;
          this.stateTime = 0;
        }
        break;
      }

      case ST.CHASE: {
        const to = _v.subVectors(player.pos, this.root.position).setY(0);
        const dist = to.length();
        this._face(to, dt);

        const speed = THREE.MathUtils.lerp(
          BOSS.chaseSpeed,
          BOSS.enrageSpeed,
          this.rage,
        );
        if (dist > 3.0) {
          to.normalize();
          const np = this.root.position.clone().addScaledVector(to, speed * dt);
          this.world.resolveHorizontal(np, BOSS.bodyRadius * 0.5);
          this.root.position.x = np.x;
          this.root.position.z = np.z;
        }

        if (dist < BOSS.slamRange && this.slamCd <= 0) {
          this.state = ST.SLAM;
          this.stateTime = 0;
        } else if (this.spitCd <= 0 && dist > 6 && this.rage > 0.2) {
          this.state = ST.SPIT;
          this.stateTime = 0;
          this.spitCd = BOSS.spitCooldown * (1 - this.rage * 0.5);
        }
        break;
      }

      case ST.SLAM: {
        const wind = BOSS.slamWindup * (1 - this.rage * 0.35);
        this.tele.material.opacity = Math.min(
          0.55,
          (this.stateTime / wind) * 0.55,
        );
        this.tele.scale.setScalar(0.4 + (this.stateTime / wind) * 0.6);

        if (this.stateTime >= wind) {
          // land it
          const d = this.root.position.distanceTo(player.pos);
          if (d < BOSS.slamRadius) {
            const falloff = 1 - d / BOSS.slamRadius;
            this.onDamagePlayer?.(
              BOSS.slamDamage * (0.5 + falloff * 0.5),
              "slam",
            );
          }
          this.audio?.bossSlam();
          this.tele.material.opacity = 0;
          this.tele.scale.setScalar(1);
          this.slamCd = BOSS.slamCooldown * (1 - this.rage * 0.4);
          this.state = ST.CHASE;
          this.stateTime = 0;
          this.wobble = 1;
        }
        break;
      }

      case ST.SPIT: {
        if (this.stateTime > 0.45) {
          const n = 1 + Math.floor(this.rage * 4);
          for (let i = 0; i < n; i++) {
            const spread = (i - (n - 1) / 2) * 0.16;
            this._spit(player, spread);
          }
          this.state = ST.CHASE;
          this.stateTime = 0;
        }
        break;
      }

      case ST.DYING: {
        const t = this.stateTime;
        this.body.rotation.z =
          Math.sin(t * 9) * 0.35 * Math.max(0, 1 - t / 2.4);
        this.body.position.y = -t * 0.55;
        this.body.scale.setScalar(Math.max(0.01, 1 - t / 2.6));
        this.tele.material.opacity = 0;
        if (t > 2.6) {
          this.state = ST.DEAD;
          this.scene.remove(this.root);
          this.onDeath?.();
        }
        break;
      }
    }

    this._pose(dt);
  }

  // Half health and below: throw chickens, regardless of what else it is
  // doing. It does not stop chasing or slamming to do this — the chickens are
  // an addition to the fight, not a replacement for it.
  _chickens(dt, player) {
    if (!this.awake) return;
    if (this.state === ST.SUMMONING || this.state === ST.DYING) return;
    if (this.healthRatio > BOSS.chickenPhase) return;

    if (!this.phaseTwo) {
      this.phaseTwo = true;
      this.onPhaseTwo?.();
    }

    if (this.chickenCd > 0) return;
    // the angrier it gets, the faster and the more of them
    const extra = Math.max(0, (this.rage - BOSS.chickenPhase) / (1 - BOSS.chickenPhase));
    this.chickenCd = BOSS.chickenCooldown * (1 - extra * 0.45);

    const n = BOSS.chickenBurst + Math.floor(extra * 2);
    const origin = this.root.position.clone();
    origin.y += BOSS.height * 0.8;

    for (let i = 0; i < n; i++) {
      // Land them SHORT of the player, not on them. Thrown directly at your
      // feet a chicken touches you the frame it lands and there is nothing to
      // react to; dropped a few metres out, you get a second to shoot it or
      // to move, which is the whole point of having them.
      const a = Math.random() * Math.PI * 2;
      const r = 1.5 + Math.random() * 2.5;
      const target = this.root.position.clone().lerp(player.pos, 0.66);
      target.x += Math.cos(a) * r;
      target.z += Math.sin(a) * r;
      target.y = this.world.groundHeight(target.x, target.z);
      this.onThrowChicken?.(origin.clone(), target);
    }
    this.audio?.bossCluck?.();
  }

  _face(to, dt) {
    if (to.lengthSq() < 1e-6) return;
    const want = Math.atan2(-to.x, -to.z);
    let d = want - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * Math.min(1, 3.5 * dt);
  }

  _spit(player, spreadAngle) {
    const origin = this.root.position.clone();
    origin.y += BOSS.height * 0.55;

    const to = player.pos.clone().sub(origin);
    const dist = to.length();
    to.normalize();
    // lead the shot a little, and arc it
    const dir = to
      .clone()
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), spreadAngle);
    dir.y += 0.12 + dist * 0.006;
    dir.normalize();

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.36, 8, 6),
      new THREE.MeshStandardMaterial({
        color: 0xf0a92c,
        emissive: 0x995f08,
        emissiveIntensity: 0.8,
        roughness: 0.4,
        flatShading: true,
      }),
    );
    mesh.position.copy(origin);
    mesh.castShadow = true;
    this.projGroup.add(mesh);

    this.projectiles.push({
      mesh,
      vel: dir.multiplyScalar(BOSS.spitSpeed),
      life: 5,
    });
    this.audio?.bossSpit();
  }

  _updateProjectiles(dt, player) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.vel.y -= 14 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 6;
      p.mesh.rotation.y += dt * 4;

      const ground = this.world.groundHeight(
        p.mesh.position.x,
        p.mesh.position.z,
      );
      const hitPlayer = p.mesh.position.distanceTo(player.pos) < 1.0;

      if (hitPlayer) this.onDamagePlayer?.(BOSS.spitDamage, "yolk");

      if (hitPlayer || p.mesh.position.y <= ground || p.life <= 0) {
        this.projGroup.remove(p.mesh);
        p.mesh.geometry.dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  _pose(dt) {
    this.body.rotation.y = this.yaw;

    if (this.state === ST.DYING) return;

    // crack recoil, while sealed
    if (this.crackT > 0) this.crackT = Math.max(0, this.crackT - dt * 2.6);

    // idle jiggle — it is, after all, a fried egg
    const jiggle = this.state === ST.SHELL ? 0.35 : 1;
    const speedish = this.state === ST.CHASE ? 1.6 : 1;
    this.body.position.y =
      Math.abs(Math.sin(this.bobT * 2.2 * speedish)) * 0.22 * jiggle;
    this.body.rotation.x =
      Math.sin(this.bobT * 2.2 * speedish) * 0.06 * jiggle +
      this.wobble * Math.sin(this.bobT * 26) * 0.09;
    this.body.rotation.z =
      Math.sin(this.bobT * 1.7 * speedish) * 0.05 * jiggle +
      this.wobble * Math.cos(this.bobT * 23) * 0.09;

    // squash into the slam
    if (this.state === ST.SLAM) {
      const wind = BOSS.slamWindup * (1 - this.rage * 0.35);
      const t = Math.min(1, this.stateTime / wind);
      this.body.scale.set(1 + t * 0.18, 1 - t * 0.25, 1 + t * 0.18);
      this.body.position.y += t * 1.4;
    } else if (this.state === ST.SUMMONING) {
      // swells, shudders, then bursts up to full size
      const t = Math.min(1, this.stateTime / BOSS.summonTime);
      const swell = Math.sin(t * Math.PI) * 0.5;
      const shudder = (1 - t) * 0.12;
      this.body.scale.set(1 + swell, 1 + swell * 1.4, 1 + swell);
      this.body.position.y += t * 1.2;
      this.body.rotation.z += Math.sin(this.bobT * 40) * shudder;
    } else if (this.state === ST.SHELL) {
      // sits low and still, with a recoil kick on each hammer blow
      this.body.scale.setScalar(1 + this.crackT * 0.1);
      this.body.position.y = this.crackT * -0.12;
      this.body.rotation.z = Math.sin(this.bobT * 34) * this.crackT * 0.18;
    } else {
      this.body.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, 8 * dt));
    }

    // hit flash
    const f = this.hitFlash;
    if (this.mats) {
      for (const m of this.mats) {
        const b = m.userData.baseEmissive;
        if (b) m.emissive.setRGB(b.r + f * 0.9, b.g + f * 0.12, b.b + f * 0.05);
        else m.emissive.setRGB(f * 0.9, f * 0.12, f * 0.05);
      }
    }
    if (this.shellMats) {
      for (const m of this.shellMats) {
        m.emissive?.setRGB(f * 0.7, f * 0.18, f * 0.1);
      }
    }
  }
}
