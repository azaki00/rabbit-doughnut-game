import * as THREE from 'three';
import { ST } from './Rabbit.js';
import { makeMutant } from './mutate.js';

// COURTSHIP.
//
// Left alone, two grazing rabbits will find each other. Hearts appear over the
// pair, they spend ten seconds barging into one another, the hearts pop, and
// what walks out is bigger than either of them.
//
// The ten seconds are the mechanic. It is a long, loud, visible tell in the
// middle of the field: you can see it from anywhere, you know exactly how long
// you have, and you have to decide whether to interrupt it for two ordinary
// rabbits or leave it and come back for one very large one. Scaring either
// parent cancels it — so the gun, which scares everything for 40m, cannot be
// used anywhere near a pair you wanted to keep.

export const MATE = {
  courtship: 10.0,      // seconds, as specified
  searchRadius: 9,      // how far apart two rabbits can notice each other
  // ONE MUTANT EVERY 90 SECONDS, and only ever one courtship at a time.
  // At 7s the field filled with enormous rabbits inside two minutes and the
  // mechanic stopped being an event. Measured from the last BIRTH, so a
  // courtship you interrupt does not cost you the next one.
  cooldown: 90.0,
  firstDelay: 60.0,     // nothing breeds in the first minute
  maxPairs: 1,
  bumpPeriod: 1.15,     // seconds per barge in-and-out
  bumpNear: 0.10,       // they properly collide at the near end
  bumpFar: 1.60,        // and back right off at the far end, so it is legible
  heartRate: 0.28,      // seconds between heart spawns
  minPopulation: 4,     // do not breed the field down to nothing
};

// ── the heart sprite ──
// Canvas-drawn, because a heart is four curves and loading a PNG for it would
// be silly.
let HEART_TEX = null;
function heartTexture() {
  if (HEART_TEX) return HEART_TEX;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ff5a7a';
  g.beginPath();
  g.moveTo(32, 56);
  g.bezierCurveTo(2, 34, 8, 10, 22, 10);
  g.bezierCurveTo(29, 10, 32, 16, 32, 20);
  g.bezierCurveTo(32, 16, 35, 10, 42, 10);
  g.bezierCurveTo(56, 10, 62, 34, 32, 56);
  g.fill();
  // a highlight, so it does not read as a flat blob
  g.fillStyle = 'rgba(255,255,255,.5)';
  g.beginPath();
  g.ellipse(23, 22, 5, 7, -0.5, 0, Math.PI * 2);
  g.fill();
  HEART_TEX = new THREE.CanvasTexture(c);
  HEART_TEX.colorSpace = THREE.SRGBColorSpace;
  return HEART_TEX;
}

const _v = new THREE.Vector3();
const _mid = new THREE.Vector3();

export class Mating {
  constructor(scene, world, sfx) {
    this.scene = scene;
    this.world = world;
    this.sfx = sfx;

    this.pairs = [];
    this.hearts = [];
    this.cool = MATE.firstDelay;
    this.born = 0;
    this.onBorn = null;      // (typeDef, position) => void

    this.group = new THREE.Group();
    this.group.userData.noChatBlock = true;   // hearts are not obstructions
    scene.add(this.group);

    this.heartMat = new THREE.SpriteMaterial({
      map: heartTexture(),
      transparent: true,
      depthWrite: false,
    });
  }

  get courting() { return this.pairs.length; }

  // ── pairing ──
  _findPair(rabbits) {
    // Only calm, unengaged, ordinary rabbits. The Black Rabbit does not do
    // this, and neither does anything already running from you.
    const eligible = rabbits.filter(r =>
      r.alive && !r.caught && !r.mate && !r.lure &&
      !r.type.circler &&
      (r.state === ST.GRAZE || r.state === ST.LURED));

    if (eligible.length < 2) return null;

    // nearest available couple
    let best = null, bestD = MATE.searchRadius;
    for (let i = 0; i < eligible.length; i++) {
      for (let j = i + 1; j < eligible.length; j++) {
        const d = eligible[i].position.distanceTo(eligible[j].position);
        if (d < bestD) { bestD = d; best = [eligible[i], eligible[j]]; }
      }
    }
    return best;
  }

  start(a, b) {
    const pair = {
      a, b,
      t: 0,
      heartT: 0,
      mid: a.position.clone().lerp(b.position, 0.5),
    };
    a.mate = new THREE.Vector3();
    b.mate = new THREE.Vector3();
    this.pairs.push(pair);
    this.sfx?.courtship?.();
    return pair;
  }

  // Something frightened one of them, or one got caught. No baby — and the
  // clock is NOT reset, so an interrupted courtship costs you only the wait
  // already served, not another ninety seconds.
  _cancel(pair, index, { retry = true } = {}) {
    if (pair.a) pair.a.mate = null;
    if (pair.b) pair.b.mate = null;
    this.pairs.splice(index, 1);
    if (retry) this.cool = Math.min(this.cool, MATE.courtship);
  }

  // seconds until the next courtship may begin
  get nextIn() { return Math.max(0, this.cool); }

  // Wipe every courtship and every heart. Called when the day rolls over and
  // the whole field is replaced: the pairs hold direct references to rabbits,
  // and nothing about removing a rabbit from the world marks it dead — so
  // without this a pair keeps courting an object that is no longer in the
  // scene, and its hearts hang in the air over nobody.
  clear() {
    for (const p of this.pairs) {
      if (p.a) p.a.mate = null;
      if (p.b) p.b.mate = null;
    }
    this.pairs.length = 0;
    for (const h of this.hearts) {
      this.group.remove(h.sprite);
      h.sprite.material.dispose();
    }
    this.hearts.length = 0;
  }

  _spawnHeart(at, big = false) {
    const s = new THREE.Sprite(this.heartMat.clone());
    s.position.copy(at);
    s.position.x += (Math.random() - 0.5) * 0.5;
    s.position.z += (Math.random() - 0.5) * 0.5;
    const size = (big ? 0.42 : 0.24) * (0.8 + Math.random() * 0.5);
    s.scale.setScalar(size);
    this.group.add(s);
    this.hearts.push({
      sprite: s,
      life: big ? 1.3 : 1.6,
      maxLife: big ? 1.3 : 1.6,
      rise: (big ? 1.9 : 1.0) + Math.random() * 0.6,
      drift: (Math.random() - 0.5) * 0.7,
      size,
      pop: big,
    });
  }

  update(dt, rabbits) {
    // ── hearts ──
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const h = this.hearts[i];
      h.life -= dt;
      h.sprite.position.y += h.rise * dt;
      h.sprite.position.x += h.drift * dt;
      const k = h.life / h.maxLife;
      h.sprite.material.opacity = Math.min(1, k * 1.8);
      // the burst hearts swell as they go; the idle ones shrink
      h.sprite.scale.setScalar(h.size * (h.pop ? 1 + (1 - k) * 1.4 : 0.6 + k * 0.6));
      if (h.life <= 0) {
        this.group.remove(h.sprite);
        h.sprite.material.dispose();
        this.hearts.splice(i, 1);
      }
    }

    // ── existing courtships ──
    for (let i = this.pairs.length - 1; i >= 0; i--) {
      const p = this.pairs[i];
      const { a, b } = p;

      // either one dead, caught, or spooked cancels it
      const lost = !a.alive || !b.alive || a.caught || b.caught;
      const spooked =
        (a.state !== ST.MATE && a.state !== ST.GRAZE) ||
        (b.state !== ST.MATE && b.state !== ST.GRAZE);
      if (lost || spooked) {
        this._cancel(p, i);
        continue;
      }

      p.t += dt;
      _mid.copy(a.position).lerp(b.position, 0.5);
      p.mid.lerp(_mid, Math.min(1, 3 * dt));

      // Barge in and out. Each aims at a point PAST the other, so they collide
      // rather than politely stopping short, then back off and do it again.
      const phase = (p.t % MATE.bumpPeriod) / MATE.bumpPeriod;
      const close = Math.sin(phase * Math.PI * 2) * 0.5 + 0.5;
      const gap = THREE.MathUtils.lerp(MATE.bumpFar, MATE.bumpNear, close);

      _v.subVectors(b.position, a.position).setY(0);
      if (_v.lengthSq() < 1e-5) _v.set(1, 0, 0);
      _v.normalize();
      a.mate.copy(p.mid).addScaledVector(_v, -gap * 0.5);
      b.mate.copy(p.mid).addScaledVector(_v, gap * 0.5);

      // ── hearts over the pair, the whole time ──
      p.heartT -= dt;
      if (p.heartT <= 0) {
        p.heartT = MATE.heartRate;
        const from = Math.random() < 0.5 ? a : b;
        this._spawnHeart(
          _v.copy(from.position).setY(from.position.y + 0.55 + Math.random() * 0.25),
        );
      }

      // ── and then ──
      if (p.t >= MATE.courtship) {
        // the hearts pop
        for (let k = 0; k < 14; k++) {
          this._spawnHeart(
            _v.copy(p.mid).setY(p.mid.y + 0.5 + Math.random() * 0.4),
            true,
          );
        }
        this.sfx?.mutantBorn?.();

        const type = makeMutant(a.type, b.type);
        const at = p.mid.clone();
        this._cancel(p, i, { retry: false });
        this.born++;
        this.cool = MATE.cooldown;      // the next one is 90s from this birth
        this.onBorn?.(type, at);
      }
    }

    // ── look for a new couple ──
    this.cool -= dt;
    if (
      this.cool <= 0 &&
      this.pairs.length < MATE.maxPairs &&
      rabbits.length > MATE.minPopulation
    ) {
      const found = this._findPair(rabbits);
      // Only spend the cooldown if a couple was actually available. Otherwise
      // an empty field would silently eat the window.
      if (found) {
        this.cool = MATE.cooldown;
        this.start(found[0], found[1]);
      }
    }
  }
}
