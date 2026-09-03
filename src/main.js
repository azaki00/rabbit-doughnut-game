import * as THREE from 'three';
import { Engine } from './core/Engine.js';
import { Time } from './core/Time.js';
import { Input } from './core/Input.js';
import { Controller, MOVE } from './player/Controller.js';
import { Glove, LUNGE } from './player/Glove.js';
import { Gun, GUN } from './player/Gun.js';
import { Greybox } from './world/Greybox.js';
import { Rabbit, ST } from './rabbits/Rabbit.js';
import { TYPES, SPAWNABLE } from './rabbits/types.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { RabbitVoice } from './audio/RabbitVoice.js';
import { Sfx } from './audio/Sfx.js';
import { Hud } from './ui/Hud.js';
import { Chest } from './world/Chest.js';
import { Pickups } from './world/Pickups.js';
import { CaseReel } from './ui/CaseReel.js';
import { EggBoss, BOSS } from './world/EggBoss.js';

// HARE & GLAZE — M1 "Feel" + the M2 saltation gait.
// The one question this build exists to answer: does the lunge feel good?

const canvas = document.getElementById('view');
const engine = new Engine(canvas);
const input = new Input(canvas);
const time = new Time();
const hud = new Hud();

const world = new Greybox(engine.scene);
const player = new Controller(world);

const audio = new AudioEngine();
const sfx = new Sfx(audio);
const voice = new RabbitVoice(audio, () => player.pos);

const glove = new Glove(engine, player, {
  windUp: () => sfx.windUp(),
  lunge: c => sfx.lunge(c),
  whiff: () => sfx.whiff(),
});

const gun = new Gun(engine, player, {
  gunshot: () => sfx.gunshot(),
  dryFire: () => sfx.dryFire(),
  reload:  () => sfx.reload(),
});

// The glove can never be unequipped (§17.6) — swapping only decides which of
// the two is IN HAND. Slot 1 is always the glove.
let weapon = 'glove';
function swapTo(w) {
  if (w === weapon) return;
  if (glove.busy || gun.busy) return;          // no swap-cancelling a lunge
  weapon = w;
  hud.say(w === 'gun' ? 'The Culling Piece' : 'Red Glove', 'good', 0.9);
}

player.bob.onFootfall = i => sfx.footstep(i);

const state = { coins: 0, health: 1, caught: 0, shot: 0, day: 1, skins: [] };
const rabbits = [];

// ── the chest: where glove skins are unlocked ── §9.1
// Beside the cooking table, always visible in the world.
const CASE_COST = 250;
const chest = new Chest(engine.scene, new THREE.Vector3(3.6, 0, 1.9));
const reel = new CaseReel(sfx);
const promptEl = document.getElementById('prompt');

reel.onFinish = inst => {
  state.skins.push(inst);
  glove.applySkin(inst);           // equip it immediately
};
reel.onHide = () => { if (!input.locked) return; input.lock(); };

// ── hidden coins ── scattered behind cover, so exploring pays
const pickups = new Pickups(engine.scene, world);
pickups.onCollect = v => {
  state.coins += v;
  sfx.coin();
  hud.say(`+${v}c`, 'good', 0.8);
};
const hiddenCount = pickups.scatterHidden();
console.log(`[world] ${hiddenCount} coins hidden`);

// ── THE SUNNY-SIDE SOVEREIGN ──
// Sits at the far end of the meadow and does not care about you until you are
// within 26m. Then it does.
// Placed in the clear south-east corner — the original spot sat inside a tree
// clump, which buried both the boss and anyone walking up to it.
const boss = new EggBoss(engine.scene, world, new THREE.Vector3(34, 0, -37), sfx);

const bossBar = document.getElementById('bossBar');
const bossFill = bossBar.querySelector('.bossFill');
const bossChip = bossBar.querySelector('.bossChip');
const bossHpNum = document.getElementById('bossHpNum');
const hurtEl = document.getElementById('hurt');

let hurtT = 0;
boss.onDamagePlayer = (amount, kind) => {
  if (state.health <= 0) return;
  state.health = Math.max(0, state.health - amount / 100);
  hurtT = 0.45;
  hurtEl.classList.add('flash');
  sfx.playerHurt();
  hud.say(kind === 'slam' ? 'SLAMMED' : 'YOLKED', 'bad', 0.9);
  if (state.health <= 0) {
    state.health = 1;                       // §3.4 — death is embarrassing, not punishing
    state.coins = Math.floor(state.coins * 0.8);
    player.pos.set(0, 1.65, 9);
    hud.say('You woke up back at the table.', 'bad', 2.4);
  }
};

boss.onDeath = () => {
  state.coins += 5000;
  hud.say('THE SOVEREIGN IS BREAKFAST  +5000c', 'good', 4);
  bossBar.classList.remove('show');
};

// ── spawning ─────────────────────────────────────────────────────────────────

function spawn(typeKey, x, z) {
  const t = TYPES[typeKey];
  const r = new Rabbit(t, new THREE.Vector3(x, 0, z), world, voice);
  engine.scene.add(r.obj);
  rabbits.push(r);
  return r;
}

function populate() {
  const n = 14;
  for (let i = 0; i < n; i++) {
    const key = SPAWNABLE[Math.floor(Math.random() * SPAWNABLE.length)];
    const a = Math.random() * Math.PI * 2;
    const d = 10 + Math.random() * 30;
    spawn(key, Math.cos(a) * d, Math.sin(a) * d);
  }
  // One Black Rabbit so its circling behaviour can be evaluated. §13
  spawn('black', 18, -18);
}
populate();

// ── the grab query ───────────────────────────────────────────────────────────
// A forward cone originating at the glove, not the camera. §4.1

glove.onGrab = (radius, origin, dir) => {
  // punching an egg the size of a barn is a valid, if unwise, strategy
  if (boss.alive && boss.awake &&
      boss.root.position.distanceTo(origin) < BOSS.bodyRadius + radius + 1.2) {
    boss.hit(BOSS.gloveDamage, origin);
    hud.say(`${BOSS.gloveDamage}`, 'bad', 0.5);
    return null;
  }

  const flat = new THREE.Vector3(dir.x, 0, dir.z).normalize();
  let best = null, bestD = Infinity;

  for (const r of rabbits) {
    if (!r.alive || r.caught) continue;
    const to = r.position.clone().sub(origin);
    const d = to.length();
    if (d > radius + 0.35) continue;

    const toFlat = new THREE.Vector3(to.x, 0, to.z);
    if (toFlat.lengthSq() > 1e-6) {
      toFlat.normalize();
      const hAng = Math.acos(THREE.MathUtils.clamp(flat.dot(toFlat), -1, 1));
      if (hAng > LUNGE.coneH / 2) continue;
    }
    const vAng = Math.atan2(Math.abs(to.y), Math.max(0.001, Math.hypot(to.x, to.z)));
    if (vAng > LUNGE.coneV / 2) continue;

    if (d < bestD) { bestD = d; best = r; }
  }

  if (!best) return null;

  // CLUTCH GRAB — max charge onto a fleeing rabbit. §4.1
  const fleeing = best.state === ST.FLEE || best.state === ST.EVADE;
  const clutch = glove.charge >= 0.98 && fleeing;
  const value = Math.round(best.type.value * (clutch ? 1.25 : 1));

  best.catchIt();
  state.coins += value;
  state.caught++;

  sfx.coin();
  if (clutch) { sfx.clutch(); hud.say(`CLUTCH GRAB  +${value}c`, 'good', 1.6); }
  else hud.say(`${best.type.name}  +${value}c`, 'good');

  return best;
};

// A whiffed lunge sends everything nearby bolting. §4.1
glove.onScare = (origin, radius) => {
  for (const r of rabbits) r.scare(origin, radius, player);
};

// ── the gun ──────────────────────────────────────────────────────────────────
// Hitscan against rabbit bounding spheres. Deliberately generous to aim, and
// deliberately unrewarding to use: shot meat is ruined. §GUN

const _seg = new THREE.Vector3();
// Generous on purpose. The gun is supposed to be the EASY option — its cost is
// the ruined meat and the emptied field, not a demanding shot.
const HIT_RADIUS = 0.55;
const BODY_OFFSET = 0.26;    // aim point sits at the carriage, not the feet

gun.onShoot = (origin, dir) => {
  // the boss is enormous and takes priority over anything behind it
  const bossHit = boss.raycast(origin, dir, GUN.range);
  if (bossHit) {
    const dealt = boss.hit(BOSS.gunDamage, bossHit);
    hud.say(`${Math.round(dealt)}`, dealt > BOSS.gunDamage ? 'good' : 'bad', 0.5);
    return null;
  }

  let best = null, bestT = Infinity;

  for (const r of rabbits) {
    if (!r.alive || r.caught) continue;
    // aim at the body, not the ground point the origin sits on
    _seg.copy(r.position).setY(r.position.y + BODY_OFFSET).sub(origin);
    const along = _seg.dot(dir);
    if (along < 0 || along > GUN.range) continue;
    const perp = Math.sqrt(Math.max(0, _seg.lengthSq() - along * along));
    if (perp > HIT_RADIUS) continue;
    if (along < bestT) { bestT = along; best = r; }
  }

  if (!best) return null;

  const value = Math.round(best.type.value * GUN.meatPenalty);
  best.shoot();
  state.coins += value;
  state.shot++;

  hud.say(`${best.type.name} — RUINED MEAT  +${value}c`, 'bad', 1.5);
  return best;
};

gun.onScare = (origin, radius) => {
  for (const r of rabbits) r.scare(origin, radius, player);
};

// ── black rabbit proximity: the world goes quiet ── §5.4 / §13 ───────────────

let blackNear = 0;
function updateBlackRabbit(dt) {
  let nearest = Infinity;
  for (const r of rabbits) {
    if (r.alive && r.type.circler) nearest = Math.min(nearest, r.position.distanceTo(player.pos));
  }
  const target = nearest < 15 ? 1 - nearest / 15 : 0;
  blackNear += (target - blackNear) * Math.min(1, 3 * dt);

  if (audio.ready) {
    audio.duck('voice', 1 - blackNear * 0.75);
    audio.duck('world', 1 - blackNear * 0.5);
  }
  // desaturate the fog toward grey as it closes
  const f = engine.scene.fog;
  f.color.setRGB(
    THREE.MathUtils.lerp(0.784, 0.42, blackNear),
    THREE.MathUtils.lerp(0.894, 0.42, blackNear),
    THREE.MathUtils.lerp(0.949, 0.46, blackNear));
  engine.scene.background.copy(f.color);
}

// ── loop ─────────────────────────────────────────────────────────────────────

let wasExhausted = false;
let gaspT = 0;

function step(dt) {
  if (input.locked) {
    player.look(input.mouseDX, input.mouseDY, input.sensitivity);
    player.update(dt, input);

    if (input.hit('slot1')) swapTo('glove');
    if (input.hit('slot2')) swapTo('gun');
    if (input.hit('swapWeapon')) swapTo(weapon === 'glove' ? 'gun' : 'glove');

    if (weapon === 'glove') glove.update(dt, input);
    gun.update(dt, input, weapon === 'gun');
    glove.root.visible = weapon === 'glove';
  }

  for (const r of rabbits) r.update(dt, player);

  // reap caught rabbits, and keep the field populated
  for (let i = rabbits.length - 1; i >= 0; i--) {
    if (!rabbits[i].alive) {
      rabbits[i].dispose(engine.scene);
      rabbits.splice(i, 1);
      const key = SPAWNABLE[Math.floor(Math.random() * SPAWNABLE.length)];
      const a = Math.random() * Math.PI * 2;
      spawn(key, Math.cos(a) * 38, Math.sin(a) * 38);
    }
  }

  updateBlackRabbit(dt);

  // ── boss ──
  if (boss.alive) {
    boss.update(dt, player);
    bossBar.classList.toggle('show', boss.awake && boss.state !== 'DEAD');
    const pct = boss.healthRatio * 100;
    bossFill.style.width = pct + '%';
    bossChip.style.width = pct + '%';
    bossHpNum.textContent = Math.ceil(boss.health);
  }

  if (hurtT > 0) {
    hurtT -= dt;
    if (hurtT <= 0) hurtEl.classList.remove('flash');
  }

  // ── chest interaction ──
  const canUse = !reel.visible && chest.canUse(player.pos, player.forward);
  chest.update(dt, canUse);
  pickups.update(dt, player.pos);

  if (canUse) {
    const afford = state.coins >= CASE_COST;
    promptEl.className = 'show' + (afford ? '' : ' cant');
    promptEl.innerHTML = `<kbd>E</kbd>Open a case &nbsp;<span class="cost">${CASE_COST}c</span>`;
    if (input.hit('interact')) {
      if (afford) {
        state.coins -= CASE_COST;
        chest.pop();
        sfx.chestOpen();
        document.exitPointerLock?.();
        reel.open();
      } else {
        sfx.deny();
        hud.say('Not enough coins', 'bad');
      }
    }
  } else {
    promptEl.className = '';
  }

  // out-of-breath cue
  if (player.stamina.exhausted) {
    gaspT -= dt;
    if (gaspT <= 0) { sfx.gasp(); gaspT = 1.1; }
  } else gaspT = 0;
  wasExhausted = player.stamina.exhausted;

  // FOV pulls in while winding up, pushes out while sprinting
  const wantFov = MOVE.fovBase
    + (player.sprinting ? (MOVE.fovSprint - MOVE.fovBase) : 0)
    + (glove.charging ? LUNGE.fovPull * glove.charge : 0);
  engine.setFov(THREE.MathUtils.lerp(engine.camera.fov, wantFov, 1 - Math.exp(-9 * dt)));

  input.endStep();
}

let dbgT = 0;
function frame() {
  requestAnimationFrame(frame);
  time.tick(step);

  player.applyToCamera(engine.camera);

  hud.update(time.frameDt, {
    charging: glove.charging,
    charge: glove.charge,
    lunging: glove.state === 2,
    stamina: player.stamina.ratio,
    exhausted: player.stamina.exhausted,
    health: state.health,
    coins: state.coins,
    weapon,
    ammo: gun.ammo,
    reserve: gun.reserve,
    reloading: gun.reloading > 0,
  });

  dbgT -= time.frameDt;
  if (dbgT <= 0) {
    dbgT = 0.12;
    const near = rabbits
      .map(r => ({ r, d: r.position.distanceTo(player.pos) }))
      .sort((a, b) => a.d - b.d)[0];
    hud.setDebug(
`spd    ${player.speed2D.toFixed(2)} m/s   ${player.sprinting ? 'SPRINT' : player.crouching ? 'CROUCH' : 'walk'}
stam   ${player.stamina.value.toFixed(0)}${player.stamina.exhausted ? '  EXHAUSTED' : ''}
bob    y${player.bob.y.toFixed(3)} x${player.bob.x.toFixed(3)} ph${player.bob.phase.toFixed(1)}
glove  ${['IDLE','WIND','DASH','RECOVER'][glove.state]}  chg ${glove.charge.toFixed(2)}
noise  ${player.noiseRadius}m
coins  ${state.coins}   hidden left ${pickups.remaining}   skins ${state.skins.length}
weapon ${weapon}  ammo ${gun.ammo}/${gun.reserve}${gun.reloading > 0 ? ' RELOADING' : ''}
caught ${state.caught}  shot ${state.shot}  coins ${state.coins}  rabbits ${rabbits.length}
near   ${near ? `${near.r.type.name} ${near.d.toFixed(1)}m ${near.r.state} p${near.r.gait.phase.toFixed(2)}${near.r.gait.airborne ? ' AIR' : ''}` : '-'}
black  ${blackNear.toFixed(2)}
boss   ${boss.alive ? `${boss.state} ${Math.ceil(boss.health)}/${BOSS.maxHealth} rage ${boss.rage.toFixed(2)}` : 'DEAD'}`);
  }

  engine.render();
}

// ── start gate ───────────────────────────────────────────────────────────────

const gate = document.getElementById('gate');

function enterGame() {
  audio.start();
  gate.classList.add('hidden');
  input.lock();
}

document.getElementById('startBtn').addEventListener('click', enterGame);

// Clicking the world re-locks. Without this, any stray Esc drops you into a
// state where the keys look broken because movement is gated on pointer lock.
canvas.addEventListener('click', () => { if (!input.locked) enterGame(); });

input.onUnlock = () => gate.classList.remove('hidden');
input.onToggleDebug = () => hud.toggleDebug();

// Dev handle — lets tooling drive the camera without pointer lock.
window.GAME = { engine, player, glove, gun, rabbits, world, state, hud, input, spawn, THREE,
                chest, reel, pickups, boss,
                get weapon(){ return weapon; }, swapTo };

frame();
