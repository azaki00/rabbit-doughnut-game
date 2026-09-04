import * as THREE from "three";
import { Engine } from "./core/Engine.js";
import { Time } from "./core/Time.js";
import { Input } from "./core/Input.js";
import { Save } from "./core/Save.js";
import { Controller, MOVE } from "./player/Controller.js";
import { STAM as STAM_DEF } from "./player/Stamina.js";
const STAM_MAX = STAM_DEF.max;
import { Glove, LUNGE } from "./player/Glove.js";
import { RawBuff, RAW } from "./player/RawBuff.js";
import { Gun, GUN } from "./player/Gun.js";
import { Hammer, HAMMER, buildTenderiser } from "./player/Hammer.js";
import { Toothbrush, BRUSH } from "./player/Toothbrush.js";
import { Greybox } from "./world/Greybox.js";
import { DayCycle, DAY } from "./world/DayCycle.js";
import { ClothingRack, RACK } from "./world/ClothingRack.js";
import { GoatRoom, GOAT } from "./world/GoatRoom.js";
import { Wardrobe } from "./ui/Wardrobe.js";
import { Bakery } from "./ui/Bakery.js";
import { SUPPLIES, missingFor, consume } from "./economy/Recipes.js";
import { Rabbit, ST } from "./rabbits/Rabbit.js";
import { TYPES, SPAWNABLE } from "./rabbits/types.js";
import { Mating, MATE } from "./rabbits/Mating.js";
import { AudioEngine } from "./audio/AudioEngine.js";
import { RabbitVoice } from "./audio/RabbitVoice.js";
import { Sfx } from "./audio/Sfx.js";
import { Hud } from "./ui/Hud.js";
import { Chest } from "./world/Chest.js";
import { Pickups } from "./world/Pickups.js";
import { CaseReel } from "./ui/CaseReel.js";
import { Settings } from "./ui/Settings.js";
import { EggBoss, BOSS } from "./world/EggBoss.js";
import { Carrots, CARROT } from "./world/Carrots.js";
import { Horses, HORSE } from "./world/Horses.js";
import { Chickens, CHICKEN } from "./world/Chickens.js";
import { MeatDrops } from "./world/MeatDrops.js";
import { Impacts } from "./world/Impacts.js";
import { Music } from "./audio/Music.js";
import { HealingBooth, HEAL, clinicSpot } from "./world/HealingBooth.js";
import { Sky } from "./world/Sky.js";
import { JailCell, findCellSpot } from "./world/JailCell.js";
import { Merchant, MERCHANT } from "./world/Merchant.js";
import { Dialogue } from "./ui/Dialogue.js";
import { Wasted, WASTED } from "./ui/Wasted.js";

// HARE & GLAZE — M1 "Feel" + the M2 saltation gait.
// The one question this build exists to answer: does the lunge feel good?

const canvas = document.getElementById("view");
const engine = new Engine(canvas);
const input = new Input(canvas);
const time = new Time();
const hud = new Hud();

const world = new Greybox(engine.scene);
const player = new Controller(world);

const audio = new AudioEngine();
const sfx = new Sfx(audio);
const music = new Music(audio);
const voice = new RabbitVoice(audio, () => player.pos);

const glove = new Glove(engine, player, {
  windUp: () => sfx.windUp(),
  lunge: (c) => sfx.lunge(c),
  whiff: () => sfx.whiff(),
});

const gun = new Gun(engine, player, {
  gunshot: () => sfx.gunshot(),
  dryFire: () => sfx.dryFire(),
  reload: () => sfx.reload(),
});

const hammer = new Hammer(engine, player, {
  hammerSwing: () => sfx.hammerSwing(),
});

// The one you start with. No purchase, no unlock — it is in your pocket.
const brush = new Toothbrush(engine, player, {
  brushSwing: () => sfx.brushSwing(),
});

// The glove can never be unequipped (§17.6) — swapping only decides which is
// IN HAND. Slot 1 is always the glove; slot 3 is locked until bought.
// ── THE SIX SLOTS ──
//
// 1-6 select directly; the wheel steps through them in order and wraps at both
// ends. Slots 1-4 are the weapons; 5 and 6 are the two carried consumables, and
// they are slots rather than bare hotkeys so the bar means one thing all the
// way across rather than "weapons, then some other stuff".
//
// Locked slots are STEPPED OVER by the wheel but still refuse a direct number
// press with a reason. Scrolling past a hammer you cannot afford four times a
// minute would be maddening; pressing 3 and being told why is information.
const SLOTS = ["glove", "gun", "hammer", "brush", "kit", "shake"];
const WEAPON_NAMES = {
  glove: "Red Glove",
  gun: "The Culling Piece",
  hammer: "The Tenderiser",
  brush: "Toothbrush",
  kit: "Healing Shake",
  shake: "Protein Shake",
};

// Why a slot is unavailable, or null if it is fine. One place, so the wheel and
// the number keys can never disagree about what you own.
function slotBlocked(w) {
  if (w === "hammer" && !hammer.owned) {
    return `The Tenderiser — ${HAMMER.price}c from the Stranger`;
  }
  if (w === "kit" && state.healKits <= 0) {
    return `No shakes — ${HEAL.itemPrice}c at the booth`;
  }
  if (w === "shake" && state.proteinShake <= 0) {
    return "No Protein Shake — the Sovereign drops it";
  }
  return null;
}

let weapon = "glove";
function swapTo(w) {
  if (w === weapon) return;
  const why = slotBlocked(w);
  if (why) {
    sfx.deny();
    hud.say(why, "bad");
    return;
  }
  if (glove.busy || gun.busy || hammer.busy || brush.busy) return; // no swap-cancelling
  weapon = w;
  hud.say(WEAPON_NAMES[w], "good", 0.9);
}

// The wheel. Steps `dir` slots and keeps going past anything locked, so it can
// never leave you holding something you do not have. Bails after one full lap.
function cycleSlot(dir) {
  if (glove.busy || gun.busy || hammer.busy || brush.busy) return;
  let i = SLOTS.indexOf(weapon);
  for (let n = 0; n < SLOTS.length; n++) {
    i = (i + dir + SLOTS.length) % SLOTS.length;
    const w = SLOTS[i];
    if (!slotBlocked(w)) {
      weapon = w;
      sfx.uiMove?.();
      hud.say(WEAPON_NAMES[w], "good", 0.9);
      return;
    }
  }
}

player.bob.onFootfall = (i) => sfx.footstep(i);

const state = {
  coins: 0,
  health: 1,
  caught: 0,
  shot: 0,
  day: 1,
  skins: [],
  dead: false,
  carrots: 0,
  proteinShake: 0, // dropped by the Sovereign. Purpose to be decided.
  healKits: 0, // shakes bought at the booth, drunk with H
  blackMeat: 0, // uneaten black rabbits. §13 — the only ones you can eat raw
  // ── the bakery ── §6
  meat: [], // collected slabs: { type, value, label }. Sell them or grind them.
  dough: {}, // rabbit-type key -> portions, ground from meat
  supplies: {}, // flour/sugar/yeast/cinnamon/glaze/sprinkles -> count
  baked: {}, // recipe id -> how many; drives recipe-book completion
  caughtByType: {}, // the unlock conditions in §6.4 count these
  binkyCatches: 0,
};
const rabbits = [];

// ── persistence ── §14
// Which instance is on each weapon. The weapons themselves do not remember —
// applySkin() paints and forgets — so the record lives here, where it is also
// what gets written to the save.
const equipped = { glove: null, gun: null, brush: null };
const save = new Save();

// ── the black rabbit, eaten raw ── §13
const raw = new RawBuff(sfx);
// Coalesce bursts: buying three carrots in a second is one write, not three.
let saveQueued = false;
function autosave() {
  if (saveQueued) return;
  saveQueued = true;
  queueMicrotask(() => {
    saveQueued = false;
    save.write({ state, hammer, equipped });
  });
}

// ── the three chests: where skins are unlocked ── §9.1
// A row of them beside the cooking table, always visible in the world. One per
// weapon, with entirely separate skin pools — walking to the middle chest is a
// decision about which 250c you are spending, not a formality.
// the chests' placards turn to face the middle of the map
const TABLE_POS_EARLY = new THREE.Vector3(0, 0, 9);
const CASE_COST = 250;
// Spread along an arc around the east side of the table. They need real space
// between them: the interaction radius is 2.6m, so at the original 1.75m
// spacing all three were live at once and picking one was a coin toss.
const CHEST_ROW = [
  { kind: "glove", label: "MEADOW CASE", tint: 0xe0596f, x: 3.4, z: 5.2 },
  { kind: "gun", label: "CULLING CASE", tint: 0x8fb7d9, x: 6.2, z: 2.6 },
  { kind: "brush", label: "ENAMEL CASE", tint: 0x3ec8a8, x: 7.4, z: -1.4 },
];
const chests = CHEST_ROW.map((c) => {
  const ch = new Chest(engine.scene, new THREE.Vector3(c.x, 0, c.z), {
    kind: c.kind,
    label: c.label,
    tint: c.tint,
  });
  ch.faceTarget = TABLE_POS_EARLY;
  return ch;
});
const reel = new CaseReel(sfx);
const promptEl = document.getElementById("prompt");

// ── the clothing rack ── §7
// West of the chest arc, facing the table: you unbox on one side of the
// clearing and decide what to wear on the other, so the two are separate acts.
const rack = new ClothingRack(
  engine.scene,
  world,
  new THREE.Vector3(-4.6, 0, 5.8),
  Math.atan2(4.6, 3.2),
);
const wardrobe = new Wardrobe(sfx);
const bakery = new Bakery(sfx);

// ── the bakery ── §6
//
// Grinding is the decision the whole gun economy hangs on: a Cottontail slab
// sells for about 45c, but ground into dough it becomes a 40c Plain Hopper at
// worst and a 700c Warren at best. Selling is never wrong — it is just the
// answer for someone who needs coins today.
const SUPPLY_PRICE = Object.fromEntries(
  Object.entries(SUPPLIES).map(([k, v]) => [k, v.price]),
);
const missingForRecipe = (r) => missingFor(r, state.dough, state.supplies);
const consumeForRecipe = (r) => consume(r, state.dough, state.supplies);

bakery.getState = () => state;

bakery.onSellMeat = (i) => {
  const m = state.meat[i];
  if (!m) return;
  state.meat.splice(i, 1);
  state.coins += m.value;
  hud.say(`Sold ${m.label}  +${m.value}c`, "good", 1.4);
  autosave();
};

bakery.onGrind = (i) => {
  const m = state.meat[i];
  if (!m) return;
  state.meat.splice(i, 1);
  state.dough[m.type] = (state.dough[m.type] ?? 0) + 1;
  // §6.3: comedy, not gore. A hand-crank and a very brief muffled honk.
  sfx.grind?.();
  hud.say(`Ground — ${state.dough[m.type]}× ${m.type} dough`, "good", 1.4);
  autosave();
};

bakery.onBuy = (key) => {
  const price = SUPPLY_PRICE[key];
  if (state.coins < price) return;
  state.coins -= price;
  state.supplies[key] = (state.supplies[key] ?? 0) + 1;
  autosave();
};

// Spends the ingredients and returns whether the fryer may start. Doing it here
// rather than in the panel keeps every mutation of `state` in main.js.
bakery.onBake = (recipe) => {
  const missing = missingForRecipe(recipe);
  if (missing) { sfx.deny(); hud.say(missing, "bad"); return false; }
  consumeForRecipe(recipe);
  autosave();
  return true;
};

bakery.onFinish = (recipe, grade, coins) => {
  state.coins += coins;
  state.baked[recipe.id] = (state.baked[recipe.id] ?? 0) + 1;
  sfx.coin();
  if (grade.name === "BURNT") sfx.deny();
  hud.say(`${recipe.name} — ${grade.name}  +${coins}c`, grade.tone || "good", 2.4);
  autosave();
};

bakery.onClose = () => {
  if (!input.locked) input.lock();
};

// ── the goat room ── §8
//
// Off the north-west corner of the clearing, far enough that you have to choose
// to go. §8 wants a room you enter, not a menu you open.
//
// THE DOOR HAS TO FACE THE MAP. The doorway is on the room's local +Z face, so
// the yaw is derived from the room's own position rather than typed in: the
// first version was yawed a flat Math.PI, which pointed the only entrance at
// the treeline and made the room a sealed box you could walk all the way around
// without ever finding the way in.
//
// findCellSpot is the same clearance search the jail uses — the room is 7 m
// square now and the trees load asynchronously, so a hand-picked coordinate is
// exactly how the cell ended up inside a pine clump twice.
const goatSpot = findCellSpot(world, new THREE.Vector3(-15, 0, 14), {
  clear: 8,
  fromBuildings: 13,
});
const goatRoom = new GoatRoom(
  engine.scene,
  world,
  goatSpot,
  Math.atan2(-goatSpot.x, -goatSpot.z),
);
goatRoom.sfx = sfx;   // it owns the bleat

// Which weapon a skin lands on is decided by the case it came out of.
const SKIN_TARGET = {
  glove: (inst) => glove.applySkin(inst),
  gun: (inst) => gun.applySkin(inst),
  brush: (inst) => brush.applySkin(inst),
};

// ONE path to wearing something. The reel, the wardrobe and the save restore
// all go through here, so the weapon, the `equipped` record and the hanger on
// the rack can never disagree about what you have on.
function equip(inst) {
  if (!inst) return;
  SKIN_TARGET[inst.collection]?.(inst);
  equipped[inst.collection] = inst.instId;
  rack.setEquipped(inst.collection, inst);
}

reel.onFinish = (inst) => {
  state.skins.push(inst);
  equip(inst); // straight onto the weapon, as it always has
  autosave(); // §14: case open and skin equip both trigger a write
};

wardrobe.getSkins = () => state.skins;
wardrobe.getEquipped = () => equipped;

wardrobe.onEquip = (inst) => {
  equip(inst);
  hud.say(`${inst.name} — ${inst.wear}`, "good", 1.6);
  autosave();
};

// §7: baseValue * (1 - float) * 0.55, which is what valueOf() computes and the
// wardrobe has already shown on the button.
wardrobe.onSell = (inst, worth) => {
  const i = state.skins.findIndex((x) => x.instId === inst.instId);
  if (i < 0) return;
  state.skins.splice(i, 1);
  state.coins += worth;

  // Selling what you are wearing swaps you onto the next one of that
  // collection. There is always one to swap to: the wardrobe refuses to sell
  // your last worn skin, precisely so this branch never has to unpaint a
  // weapon — none of the three know how, and teaching them would mean keeping
  // a copy of every default material alive for a case that need not exist.
  if (equipped[inst.collection] === inst.instId) {
    const next = state.skins.filter((x) => x.collection === inst.collection).pop();
    if (next) equip(next);
  }
  hud.say(`Sold ${inst.name}  +${worth}c`, "good", 1.8);
  autosave();
};

wardrobe.onClose = () => {
  if (!input.locked) input.lock();
};
reel.onHide = () => {
  if (!input.locked) return;
  input.lock();
};

// ── the hamster trader and his carrots ──
const carrots = new Carrots(engine.scene, world, sfx);

// ── wild horses ── four seconds of gallop, then the ground
const horses = new Horses(engine.scene, world, sfx);
horses.onScare = (origin, radius) => {
  // hooves, not gunfire: they bolt, but they do not all scream at once
  for (const r of rabbits) r.scare(origin, radius, player, { silent: true });
};

// ── the Stranger ──
// Far corner of the map, with a cart and a brazier. He has the only Tenderiser
// in the world and does not know what it is.
const merchant = new Merchant(
  engine.scene,
  world,
  findCellSpot(world, MERCHANT.prefer.clone(), { clear: 7, fromBuildings: 12 }),
  sfx,
);
const dialogue = new Dialogue(sfx);

// ── the cell ──
// Out at the south-west edge, so dying also costs you the walk back. Kept
// axis-aligned: the world's colliders are AABBs and one building is not worth
// teaching them about rotation.
const jail = new JailCell(
  engine.scene,
  world,
  findCellSpot(world, new THREE.Vector3(-27, 0, -27)),
  0,
);
const wasted = new Wasted();

// ── sky, clouds and weather ──
// Clear and blue until the Sovereign is out, then it is not.
const sky = new Sky(engine, sfx);
// none of the weather counts as something standing in the way of a conversation
sky.dome.userData.noChatBlock = true;
sky.rain.userData.noChatBlock = true;

// ── bullet marks ── every shot leaves something behind for 4 seconds
const impacts = new Impacts(engine.scene);
impacts.group.userData.noChatBlock = true;

// ── the meat you shot ── shot rabbits pay on collection, not on the shot
const meat = new MeatDrops(engine.scene, world, sfx);
// §6: a slab is an INGREDIENT now, not a payout. It goes in the satchel, and
// at the table you decide: sell it for what it is worth, or grind it into dough
// and bake something worth several times more. That decision is the whole
// reason the gun is worth carrying.
meat.onCollect = (value, label, typeKey) => {
  state.meat.push({ type: typeKey ?? "cottontail", value, label });
  autosave();
  sfx.meatPickup();
  hud.say(`${label} — ${state.meat.length} in the satchel`, "good", 1.4);
};

// ── the Sovereign's chickens ── phase two
const chickens = new Chickens(engine.scene, world, sfx);

// ── the healing booth ── the only way to get health back
// Pitched out in front of the Cottage with the old shop man beside it, so the
// clinic is its own destination rather than a fourth counter round the table.
const healing = new HealingBooth(engine.scene, world, clinicSpot(world), sfx);

function healToFull() {
  state.health = 1;
  sfx.heal?.();
  hud.say("Patched up", "good", 1.6);
}

// ── hidden coins ── scattered behind cover, so exploring pays
const pickups = new Pickups(engine.scene, world);
pickups.onCollect = (v) => {
  state.coins += v;
  sfx.coin();
  hud.say(`+${v}c`, "good", 0.8);
};
const hiddenCount = pickups.scatterHidden();
console.log(`[world] ${hiddenCount} coins hidden`);

// ── THE SUNNY-SIDE SOVEREIGN ──
// Sits at the far end of the meadow and does not care about you until you are
// within 26m. Then it does.
// Placed in the clear south-east corner — the original spot sat inside a tree
// clump, which buried both the boss and anyone walking up to it.
const boss = new EggBoss(
  engine.scene,
  world,
  new THREE.Vector3(34, 0, -37),
  sfx,
);

const TABLE_POS = new THREE.Vector3(0, 0, 0); // cooking table, map centre §6.1

// The Tenderiser is no longer sold here. It belongs to the Stranger in the
// far corner, and you have to go and talk to him for it — see Merchant.js.
const shellBar = document.getElementById("shellBar");
const shellPips = shellBar.querySelector(".shellPips");
const shellHint = shellBar.querySelector(".shellHint");
const bossBar = document.getElementById("bossBar");
const bossFill = bossBar.querySelector(".bossFill");
const bossChip = bossBar.querySelector(".bossChip");
const bossHpNum = document.getElementById("bossHpNum");
const hurtEl = document.getElementById("hurt");

let hurtT = 0;
function damagePlayer(amount, kind) {
  if (state.health <= 0 || state.dead) return;
  state.health = Math.max(0, state.health - amount / 100);
  hurtT = 0.45;
  hurtEl.classList.add("flash");
  sfx.playerHurt();
  // §13: eating it raw is a decision, not an attack. The game does not name it.
  if (kind !== "raw") hud.say(kind === "slam" ? "SLAMMED" : "YOLKED", "bad", 0.9);
  if (state.health <= 0) die();
}

// ── death ──
// §3.4 — death is embarrassing, not punishing. Fifteen seconds of a countdown
// insulting you is exactly that, and it costs you nothing but the time and the
// walk back from the cell.
function die() {
  if (state.dead) return;
  raw.cancel();   // §13: the buff and its whispers do not survive you
  state.dead = true;
  state.coins = Math.floor(state.coins * 0.8);

  // stop everything the player was in the middle of
  if (horses.riding) horses.buck(player);
  player.vel.set(0, 0, 0);
  player.dashTime = 0;
  promptEl.className = "";

  player.collapse();       // the camera falls to the grass and stays there
  sfx.playerDeath?.();
  wasted.show();
  document.exitPointerLock?.();
}

wasted.onRelease = () => {
  state.dead = false;
  state.health = 1;

  const at = jail.spawnPoint;
  player.pos.set(at.x, MOVE.eyeStand, at.z);
  player.vel.set(0, 0, 0);
  player.yaw = jail.spawnYaw;
  player.pitch = 0;
  player.frozen = 0;
  player.tumble = 0;
  player.standUp();
  player.stamina.value = STAM_MAX;

  hud.say("The door is open. Walk out.", "bad", 3.2);
  if (!input.locked) input.lock();
};

boss.onDamagePlayer = damagePlayer;
chickens.onDamage = damagePlayer;

// The chickens are the boss's, but the boss cannot see the herd — main owns it.
boss.onThrowChicken = (origin, target) => chickens.spawn(origin, target);
boss.onPhaseTwo = () => {
  hud.say("IT IS THROWING CHICKENS", "bad", 3.0);
};

boss.onSummon = () => {
  music.play("boss");
  sky.strike();          // the sky goes off the moment the shell breaks
};

boss.onDeath = () => {
  state.coins += 5000;
  state.proteinShake += 1;
  music.play("game"); // the meadow gets its own music back
  hud.say("THE SOVEREIGN IS BREAKFAST  +5000c", "good", 4);
  // The reward for the fight. What it is FOR is not decided yet; it exists,
  // it is counted, and it survives in the save state.
  setTimeout(
    () => hud.say("PROTEIN SHAKE acquired", "good", 4),
    1600,
  );
  bossBar.classList.remove("show");
  document.getElementById("shakeSlot")?.classList.remove("locked");
};

// ── courtship and mutants ────────────────────────────────────────────────────
// Two rabbits left alone will pair up, spend ten visible seconds at it, and
// leave you something considerably larger than either of them.
const mating = new Mating(engine.scene, world, sfx);
mating.onBorn = (typeDef, at) => {
  const r = new Rabbit(typeDef, at.clone(), world, voice);
  rabbits.push(r);
  engine.scene.add(r.obj);
  hud.say(`A ${typeDef.name} was born  (${typeDef.value}c)`, "bad", 3.2);
  console.log(
    `[mutant] ${typeDef.name} scale ${typeDef.scale.toFixed(2)} value ${typeDef.value}`,
  );
};

// ── talking to the Stranger ──────────────────────────────────────────────────
//
// Elder-Scrolls framing: the camera leaves the player's head, eases in to a
// spot beside his face, and stays there until you leave. The player is frozen
// for the duration, which is why the whole conversation is one state flag.

const CHAT = { easeIn: 0.9, easeOut: 0.55 };
const chat = {
  on: false,
  t: 0,
  from: new THREE.Vector3(),
  fromQuat: new THREE.Quaternion(),
  to: null,
  leaving: false,
};

const _lookM = new THREE.Matrix4();
const _lookQ = new THREE.Quaternion();

function merchantTree() {
  const bought = () => hammer.owned;
  const afford = () => state.coins >= HAMMER.price;
  const short = () => HAMMER.price - state.coins;

  // THE HAMMER IS THE FIRST OPTION ON THE FIRST SCREEN, and on most screens
  // after it. It is the only thing gating the boss fight, and burying it two
  // clicks behind small talk is how you get a player who has met the merchant,
  // liked him, and still cannot crack the egg.
  const buyOption = () =>
    bought()
      ? null
      : {
          label: afford()
            ? "Buy the big hammer."
            : `Buy the big hammer. (You need ${short()}c more.)`,
          cost: HAMMER.price + "c",
          disabled: !afford(),
          do: () => buyHammer(),
        };

  const withBuy = (rest) => {
    const b = buyOption();
    return b ? [b, ...rest] : rest;
  };

  return {
    speaker: "The Stranger",
    start: "greet",
    nodes: {
      greet: {
        text: () =>
          bought()
            ? "You again. Still got the hammer, I see. Still got all your fingers, " +
              "which is more than I had you down for. What is it this time?"
            : "Ah. A glove. A red one. You are the fourth this season, and the other " +
              "three stopped coming past, so either they got rich or they got eaten. " +
              "Sit. Do not sit. I have a fire, a hammer, and nowhere at all to be.",
        options: () =>
          withBuy([
            { label: "What else have you got?", to: "wares" },
            { label: "Tell me about the rabbits.", to: "rabbits" },
            { label: "What do you know about doughnuts?", to: "doughnuts" },
            { label: "Who are you, exactly?", to: "who" },
            { label: "Nothing. Goodbye.", to: null },
          ]),
      },

      // ── the sale ──
      sold: {
        text:
          "Thank you for paying. But I don't know what's it for. But it does some " +
          "decent damage.",
        options: () => [
          { label: "That is it? That is the whole pitch?", to: "soldMore" },
          { label: "...Right.", to: "greet" },
          { label: "Goodbye.", to: null },
        ],
      },

      soldMore: {
        text:
          "What else do you want? It is heavy. It has studs. It has never once " +
          "failed to hit a thing I swung it at. I would call that a complete " +
          "description of a hammer. The rest is between you and whatever you hit.",
        options: () => [
          { label: "Fair enough.", to: "greet" },
          { label: "Goodbye.", to: null },
        ],
      },

      wares: {
        text: () =>
          bought()
            ? "That was the stock. The rest of this cart is turnips, a broken axle, " +
              "and a jar I have decided not to open. You are welcome to the turnips."
            : "One item. Big hammer, studded head, weighs like a bad decision. A " +
              "woman traded it for one night by the fire and left before dawn " +
              "without it, which I have thought about more than I would like. " +
              HAMMER.price + " coins.",
        options: () =>
          withBuy([
            { label: "What is in the jar?", to: "jar" },
            { label: "Something else.", to: "greet" },
            { label: "Goodbye.", to: null },
          ]),
      },

      jar: {
        text:
          "It was a doughnut. In the spring. It is now a resident. I have named it " +
          "and I would rather not disturb the arrangement.",
        options: () =>
          withBuy([
            { label: "What else have you got?", to: "wares" },
            { label: "Goodbye.", to: null },
          ]),
      },

      // ── the rabbits ──
      rabbits: {
        text:
          "They hear you long before they see you, and they see very nearly " +
          "everything. Crouch and they forget you exist. Fire that gun and every " +
          "ear inside forty metres turns at once — and then you are alone in a " +
          "field you just emptied, walking out to fetch your own meat.",
        options: () =>
          withBuy([
            { label: "What about the black one?", to: "black" },
            { label: "They breed out here, don't they?", to: "breeding" },
            { label: "Any advice on catching them?", to: "catching" },
            { label: "Something else.", to: "greet" },
          ]),
      },

      black: {
        text:
          "It does not run. That is the part that should worry you. Everything else " +
          "out here has the decency to leave; that one circles. Stand near it long " +
          "enough and you will notice the meadow has gone quiet, and then you will " +
          "notice that you noticed. Do not eat it raw. Somebody always does.",
        options: () => [
          { label: "What happens if you do?", to: "blackEat" },
          { label: "Something else.", to: "greet" },
        ],
      },

      blackEat: {
        text:
          "You find out. That is the honest answer. A man came through last autumn " +
          "who found out, and he was extremely clear about it afterwards, and I " +
          "still did not understand one word.",
        options: () => [
          { label: "Right. Something else.", to: "greet" },
          { label: "Goodbye.", to: null },
        ],
      },

      breeding: {
        text:
          "They do, and you will want to be elsewhere when they finish. Ten seconds " +
          "of the pair of them shoving each other about with hearts over their " +
          "heads — very sweet, very public — and then out walks something with the " +
          "wrong number of ears and a price on it. It is slow. That is the mercy.",
        options: () => [
          { label: "That sounds horrifying.", to: "breeding2" },
          { label: "Something else.", to: "greet" },
        ],
      },

      breeding2: {
        text:
          "It is a living. Frighten either one and it stops, mind — so if you are " +
          "stood there with the gun deciding between two ordinary rabbits now and " +
          "one enormous one shortly, that is the entire trade. I would wait. I " +
          "never wait.",
        options: () =>
          withBuy([
            { label: "Something else.", to: "greet" },
            { label: "Goodbye.", to: null },
          ]),
      },

      catching: {
        text:
          "Buy a carrot from the hamster behind the timber house. Five coins, and " +
          "worth every one. Throw it and they stop dead to eat it, and a rabbit " +
          "that has stopped is a rabbit you can reach. That is the whole trick and " +
          "it took me two years.",
        options: () => [
          { label: "A hamster sells carrots.", to: "hamster" },
          { label: "Something else.", to: "greet" },
        ],
      },

      hamster: {
        text:
          "He does. He has a stall, an awning and a painted sign, and he is a " +
          "hamster. I stopped asking in my first month. Out here you take your " +
          "commerce as you find it.",
        options: () => [
          { label: "Something else.", to: "greet" },
          { label: "Goodbye.", to: null },
        ],
      },

      // ── doughnuts ──
      doughnuts: {
        text:
          "Ha! Rabbit into flour into ring into money. I have heard that pitch four " +
          "times now and I have never once seen a finished doughnut. Somebody " +
          "always gets distracted by the egg.",
        options: () =>
          withBuy([
            { label: "What egg?", to: "egg" },
            { label: "You don't believe in the plan?", to: "plan" },
            { label: "Something else.", to: "greet" },
          ]),
      },

      plan: {
        text:
          "I believe in the plan. I have watched four people believe in the plan " +
          "very hard, right up to the moment they picked up a hammer. Nobody has " +
          "ever come back and said 'I made the doughnut'. They come back and say " +
          "things about the egg.",
        options: () =>
          withBuy([
            { label: "What egg?", to: "egg" },
            { label: "Something else.", to: "greet" },
          ]),
      },

      egg: {
        text:
          "South-east. You will know it — it is the enormous one. Do not shoot it. " +
          "I have watched a man empty a gun into that shell and achieve nothing but " +
          "noise and a very great deal of attention. It wants breaking, not shooting.",
        options: () =>
          withBuy([
            { label: "Breaking with what, exactly?", to: "eggHammer" },
            { label: "What happens when it breaks?", to: "eggAfter" },
            { label: "Something else.", to: "greet" },
          ]),
      },

      eggHammer: {
        text: () =>
          bought()
            ? "You are holding it. I am not saying that is what it is for. I am " +
              "saying I have never heard a better argument for owning one."
            : "I could not say. I have a large hammer with studs on it and no use " +
              "for it, and there is a very large egg that wants hitting, and I have " +
              "drawn no connection between those two facts whatsoever.",
        options: () =>
          withBuy([
            { label: "Something else.", to: "greet" },
            { label: "Goodbye.", to: null },
          ]),
      },

      eggAfter: {
        text:
          "Then it is awake, and the weather turns, and you will wish it had not. " +
          "It gets worse as it gets hurt — starts throwing chickens. Live ones. " +
          "They land running. I would bring something to shoot them with and " +
          "something to drink.",
        options: () =>
          withBuy([
            { label: "Chickens.", to: "chickens" },
            { label: "Something else.", to: "greet" },
          ]),
      },

      chickens: {
        text:
          "Chickens. I said it plainly and you have made me say it twice. There is " +
          "a clinic out by the cottage — the old man there sells a shake that puts " +
          "you back together. Buy two. Carry them. Nobody in the history of this " +
          "meadow has regretted carrying two.",
        options: () =>
          withBuy([
            { label: "Something else.", to: "greet" },
            { label: "Goodbye.", to: null },
          ]),
      },

      // ── him ──
      who: {
        text:
          "A man with a cart and no wheel on it. I came out here to sell things to " +
          "people who bake, and instead I sell one hammer a year to whoever is " +
          "still walking. The fire is warm. The rabbits are quiet. It is not a bad " +
          "life, if you do not count the egg.",
        options: () =>
          withBuy([
            { label: "Why don't you fix the cart?", to: "cart" },
            { label: "Something else.", to: "greet" },
            { label: "Goodbye.", to: null },
          ]),
      },

      cart: {
        text:
          "And go where? Every direction from here is trees, and one direction is " +
          "trees and an egg. No. The axle stays broken. It is the only thing " +
          "keeping me sensible.",
        options: () => [
          { label: "Something else.", to: "greet" },
          { label: "Goodbye.", to: null },
        ],
      },
    },
  };
}

function buyHammer() {
  if (hammer.owned || state.coins < HAMMER.price) { sfx.deny(); return; }
  state.coins -= HAMMER.price;
  autosave();
  hammer.owned = true;
  sfx.purchase();
  document.getElementById("hammerSlot").classList.remove("locked");
  hud.say("THE TENDERISER — press 3", "good", 2.6);
  dialogue._goto("sold");
}

// ── an unobstructed shot, guaranteed ──
//
// The merchant stands in a shack, in a grove, next to a cart. Any fixed camera
// offset will eventually be inside one of them. So: try each of his framings in
// turn, raycast from his FACE out to that camera spot, and take the first with
// a clear line. If every one is blocked, pull the best one in to just short of
// whatever is in the way.
//
// Things that must never count as an obstruction — the sky, the rain, clouds,
// decals, hearts and the man himself — are flagged `noChatBlock` and skipped.
const _chatRay = new THREE.Raycaster();
const _chatDir = new THREE.Vector3();

function blocksChat(obj) {
  for (let o = obj; o; o = o.parent) if (o.userData?.noChatBlock) return false;
  return true;
}

// A clear LINE is not the same as a clear SPOT.
//
// The line test asks "can he see the camera", and a pine answers yes right up
// until the camera is standing inside its foliage. A canopy cone has no bottom
// cap, so a ray from his face can slip in under the skirt, reach the far end,
// and report nothing in the way — while the render is a wall of leaves.
//
// So probe the destination itself: six short rays out from the spot along the
// cardinal axes. Open air hits nothing. A spot buried in a canopy hits on most
// of them. The threshold is deliberately not 6 — standing beside the shack wall
// or under the cart's awning legitimately blocks one or two directions, and
// those are framings worth keeping.
const ENCLOSED = { probe: 0.85, need: 3 };
const _probeDirs = [
  new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
];

function enclosed(point) {
  let hit = 0;
  for (const dir of _probeDirs) {
    _chatRay.set(point, dir);
    _chatRay.near = 0.01;
    _chatRay.far = ENCLOSED.probe;
    const hits = _chatRay
      .intersectObjects(engine.scene.children, true)
      .filter((h) => blocksChat(h.object));
    if (hits.length && ++hit >= ENCLOSED.need) return true;   // early out
  }
  return false;
}

function clearChatSpot() {
  const look = merchant.lookAt;
  let fallback = null;
  let boxedIn = null;

  for (const want of merchant.focusCandidates()) {
    _chatDir.subVectors(want, look);
    const dist = _chatDir.length();
    _chatDir.normalize();
    _chatRay.set(look, _chatDir);
    _chatRay.far = dist;
    _chatRay.near = 0.02;

    const hits = _chatRay
      .intersectObjects(engine.scene.children, true)
      .filter((h) => blocksChat(h.object));

    if (!hits.length) {
      // The line is clear. Now make sure the far end is somewhere you would
      // want to stand.
      if (!enclosed(want)) return want;
      // Keep it, but only as a last resort — a buried camera still beats one
      // staring at the back of a shack.
      if (!boxedIn) boxedIn = want;
      continue;
    }
    if (!fallback) {
      // remember how far we COULD get along the best framing
      const d = Math.max(0.6, hits[0].distance - 0.25);
      fallback = look.clone().addScaledVector(_chatDir, d);
    }
  }

  // Pulling back short of an obstruction beats sitting inside one, so the
  // blocked-line fallback outranks the enclosed spot.
  return fallback ?? boxedIn ?? merchant.focus;
}

function startChat() {
  if (chat.on) return;
  chat.on = true;
  chat.leaving = false;
  chat.t = 0;
  chat.from.copy(engine.camera.position);
  chat.fromQuat.copy(engine.camera.quaternion);
  chat.to = clearChatSpot();
  chat.recheck = 0;
  merchant.talking = true;
  promptEl.className = "";
  document.exitPointerLock?.();
  dialogue.start(merchantTree());
}

function endChat() {
  if (!chat.on || chat.leaving) return;
  chat.leaving = true;
  chat.t = 0;
  merchant.talking = false;
}

dialogue.onClose = () => endChat();

// The camera move. Eased both ways, and it hands control back to the player
// controller only once it has finished returning.
function updateChatCamera(dt) {
  if (!chat.on) return false;
  chat.t += dt;

  // RE-CHECK, don't decide once.
  //
  // The grove around him loads asynchronously, so a spot chosen at the moment
  // you press E can have a pine grow through it a frame later — which is
  // exactly what happened. Re-testing four times a second also handles a horse
  // wandering between you and him mid-sentence.
  chat.recheck -= dt;
  if (!chat.leaving && chat.recheck <= 0) {
    chat.recheck = 0.25;
    const next = clearChatSpot();
    // ease toward it rather than cutting, so a re-check is never a jump
    if (chat.to) chat.to.lerp(next, chat.t < CHAT.easeIn ? 1 : 0.35);
    else chat.to = next;
  }

  const cam = engine.camera;
  const spot = chat.to ?? merchant.focus;
  if (!chat.leaving) {
    const k = Math.min(1, chat.t / CHAT.easeIn);
    const e = 1 - Math.pow(1 - k, 3);
    cam.position.lerpVectors(chat.from, spot, e);
    _lookM.lookAt(cam.position, merchant.lookAt, ENGINE_UP);
    _lookQ.setFromRotationMatrix(_lookM);
    cam.quaternion.slerpQuaternions(chat.fromQuat, _lookQ, e);
    return true;
  }

  // leaving: back to wherever the player is standing and looking
  player.applyToCamera(_returnCam);
  const k = Math.min(1, chat.t / CHAT.easeOut);
  const e = 1 - Math.pow(1 - k, 3);
  cam.position.lerpVectors(spot, _returnCam.position, e);
  _lookM.lookAt(spot, merchant.lookAt, ENGINE_UP);
  _lookQ.setFromRotationMatrix(_lookM);
  cam.quaternion.slerpQuaternions(_lookQ, _returnCam.quaternion, e);

  if (k >= 1) {
    chat.on = false;
    chat.leaving = false;
    if (!input.locked) input.lock();
  }
  return true;
}

const ENGINE_UP = new THREE.Vector3(0, 1, 0);
const _returnCam = new THREE.PerspectiveCamera();

// ── spawning ─────────────────────────────────────────────────────────────────

function spawn(typeKey, x, z) {
  const t = TYPES[typeKey];
  const r = new Rabbit(t, new THREE.Vector3(x, 0, z), world, voice);
  r.typeKey = typeKey;   // mutants are built elsewhere and have none; that is fine
  engine.scene.add(r.obj);
  rabbits.push(r);
  return r;
}

// The field, freshly stocked. Called once at boot and again every time you
// wake, so no two days look the same.
//
// The count drifts up slowly with the day number and the mix skews toward the
// rarer types, which is the only progression curve the game has until the
// bakery lands. It is deliberately gentle: §2 wants ~30 days of content, so a
// day-30 field should feel richer than day 1, not unrecognisable.
function populate(day = 1) {
  const n = Math.min(22, 12 + Math.floor(day * 0.6) + Math.floor(Math.random() * 3));
  for (let i = 0; i < n; i++) {
    // Later days reach deeper into SPAWNABLE, which is ordered common-first.
    const reach = Math.min(1, 0.45 + day * 0.055);
    const pick = Math.floor(Math.pow(Math.random(), 1 / reach) * SPAWNABLE.length);
    const key = SPAWNABLE[Math.min(SPAWNABLE.length - 1, pick)];
    const a = Math.random() * Math.PI * 2;
    const d = 10 + Math.random() * 30;
    spawn(key, Math.cos(a) * d, Math.sin(a) * d);
  }

  // §13: max one per day, ~18% chance. Day one is guaranteed, because a
  // mechanic nobody has met cannot be evaluated — after that it is the coin
  // flip the spec asks for, and its absence is what makes it worth seeing.
  if (day === 1 || Math.random() < 0.18) {
    const a = Math.random() * Math.PI * 2;
    spawn("black", Math.cos(a) * 22, Math.sin(a) * 22);
  }
}
populate();

// ── the day ── §2
const dayCycle = new DayCycle(state.day);
let skyDusk = 0;   // eased toward dayCycle.dusk; see step()
let machineKind = 0;   // which case the goat-room machine is set to

dayCycle.onNightfall = () => {
  sfx.deny?.();          // a flat, unhappy note — the day is over, not won
  hud.say("The light has gone. Sleep at the table.", "bad", 4.0);
  autosave();            // §14 lists day end as a save point
};

dayCycle.onWake = (day) => {
  state.day = day;
  // Clear the field and restock it. Rabbits are cheap — they are procedural
  // and hold no textures — so a wholesale replace is simpler and cheaper than
  // reconciling which ones survived the night.
  mating.clear();        // pairs hold rabbit refs; drop them before the wipe
  for (const r of rabbits) r.dispose(engine.scene);
  rabbits.length = 0;
  populate(day);
  raw.newDay();          // §13: the whisper count is per-day
  pickups.reset();       // wipes first — scatterHidden alone would duplicate
  skyDusk = 0;           // morning is a cut, not a slow sunrise
  hud.say(`DAY ${day}`, "good", 2.6);
  autosave();
};

// ── restore ── §14
//
// Runs after every system exists but before the first frame, so a restored
// hammer is already in the slot and a restored skin is already on the glove by
// the time anything renders. Failures here are non-fatal by design: a save that
// cannot be read leaves you at day one with nothing, which is the same place a
// new player starts.
function restore() {
  const d = save.read();
  if (!d) return false;

  state.day = d.day;
  dayCycle.day = d.day;   // built before restore(), so it has to be told
  state.coins = d.coins;
  state.carrots = d.carrots;
  state.healKits = d.healKits;
  state.proteinShake = d.proteinShake;
  state.blackMeat = d.blackMeat;
  state.meat = d.meat;
  state.dough = d.dough;
  state.supplies = d.supplies;
  state.baked = d.baked;
  state.caughtByType = d.caughtByType;
  state.binkyCatches = d.binkyCatches;
  state.caught = d.caught;
  state.shot = d.shot;
  state.skins = d.skins;

  if (d.hammer) {
    hammer.owned = true;
    document.getElementById("hammerSlot")?.classList.remove("locked");
  }

  // Re-equip by instance id. Falling back to the newest skin of a collection
  // matters for saves written before `equipped` existed and for any instance
  // whose skin has since been removed from the tables.
  for (const kind of ["glove", "gun", "brush"]) {
    const want = d.equipped?.[kind];
    const inst =
      d.skins.find((x) => x.instId === want && x.collection === kind) ??
      [...d.skins].reverse().find((x) => x.collection === kind);
    if (!inst) continue;
    equip(inst);
  }

  const age = d.savedAt ? Math.round((Date.now() - d.savedAt) / 60000) : null;
  console.log(
    `[save] restored day ${d.day}, ${d.coins}c, ${d.skins.length} skins` +
      (age === null ? "" : ` (${age} min old)`),
  );
  return true;
}
const restored = restore();

// ── the grab query ───────────────────────────────────────────────────────────
// A forward cone originating at the glove, not the camera. §4.1

glove.onGrab = (radius, origin, dir) => {
  // punching an egg the size of a barn is a valid, if unwise, strategy
  if (
    boss.alive &&
    boss.awake &&
    boss.root.position.distanceTo(origin) < BOSS.bodyRadius + radius + 1.2
  ) {
    boss.hit(BOSS.gloveDamage, origin);
    hud.say(`${BOSS.gloveDamage}`, "bad", 0.5);
    return null;
  }

  // The reach is HORIZONTAL with a vertical tolerance, not a cone from eye
  // height. A rabbit sits on the ground; measuring a 3D cone from the chest put
  // every rabbit ~63 degrees below the aim axis and rejected nearly all of them.
  const flat = new THREE.Vector3(dir.x, 0, dir.z).normalize();
  let best = null,
    bestD = Infinity;

  for (const r of rabbits) {
    if (!r.alive || r.caught) continue;

    const dx = r.position.x - origin.x;
    const dz = r.position.z - origin.z;
    const dy = r.position.y + GRAB_BODY_Y - origin.y;

    const flatDist = Math.hypot(dx, dz);
    if (flatDist > radius + GRAB_BONUS) continue;
    if (Math.abs(dy) > GRAB_VERTICAL) continue;

    // still has to be roughly in front of you
    if (flatDist > 0.05) {
      const hAng = Math.acos(
        THREE.MathUtils.clamp((flat.x * dx + flat.z * dz) / flatDist, -1, 1),
      );
      if (hAng > LUNGE.coneH / 2) continue;
    }

    if (flatDist < bestD) {
      bestD = flatDist;
      best = r;
    }
  }

  if (!best) return null;

  // CLUTCH GRAB — max charge onto a fleeing rabbit. §4.1
  const fleeing = best.state === ST.FLEE || best.state === ST.EVADE;
  const clutch = glove.charge >= 0.98 && fleeing;
  const value = Math.round(best.type.value * (clutch ? 1.25 : 1));

  // §6.4 counts catches by type and binky catches — those are the unlock
  // conditions for the Jackrabbit Twist, the Sugar Binky, the Midnight Cruller
  // and the Duke's Old Fashioned. Recorded BEFORE catchIt() clears the state
  // that says whether it was mid-binky.
  const wasBinky = best.binky > 0;   // Rabbit.binky is a 0..1 ramp, not a flag
  const key = best.typeKey ?? "cottontail";
  state.caughtByType[key] = (state.caughtByType[key] ?? 0) + 1;
  if (wasBinky) {
    state.binkyCatches++;
    // A rabbit caught mid-binky grinds into its own kind of dough (§6.4 #5).
    state.caughtByType.binky = (state.caughtByType.binky ?? 0) + 1;
  }

  best.catchIt();
  state.coins += value;
  autosave(); // a caught rabbit is the thing you would most hate to lose
  state.caught++;

  // §13: the black one is the only rabbit you can eat, so catching it leaves
  // you holding something as well as paying out. No warning, no explanation.
  if (best.typeKey === "black" || best.type.name === "Black Rabbit") {
    state.blackMeat++;
    hud.say(`${best.type.name}  +${value}c  ·  raw, in your hands`, "bad", 2.4);
  } else if (clutch) {
    sfx.clutch();
    hud.say(`CLUTCH GRAB  +${value}c`, "good", 1.6);
  } else hud.say(`${best.type.name}  +${value}c`, "good");
  sfx.coin();

  return best;
};

// ── the hammer: the only thing the shell answers to ──
hammer.onImpact = (origin, dir) => {
  if (
    boss.alive &&
    boss.root.position.distanceTo(origin) < BOSS.bodyRadius + HAMMER.range
  ) {
    const r = boss.hammer();
    if (r === "shell") {
      hud.say(`CRACK  —  ${boss.shell} to go`, "good", 1.1);
    } else if (typeof r === "number" && r > 0) {
      hud.say(`${Math.round(r)}`, "good", 0.5);
    }
    return;
  }
  // a chicken in swing range is a chicken no longer
  for (const c of chickens.list) {
    if (c.state === "DEAD") continue;
    if (c.obj.position.distanceTo(origin) < HAMMER.range) {
      chickens.kill(c);
      return;
    }
  }

  // swung at nothing; the noise still carries
  for (const rb of rabbits) rb.scare(origin, 14, player);
};

// ── the toothbrush ──
// Kills at arm's length, keeps most of the meat, and barely makes a sound.
brush.onImpact = (origin, dir) => {
  // chickens first — one flick and they are feathers
  for (const c of chickens.list) {
    if (c.state === "DEAD") continue;
    if (c.obj.position.distanceTo(origin) < BRUSH.range) {
      chickens.kill(c);
      return;
    }
  }

  if (
    boss.alive &&
    boss.awake &&
    boss.root.position.distanceTo(origin) < BOSS.bodyRadius + BRUSH.range
  ) {
    boss.hit(BRUSH.bossDamage, origin);
    hud.say(`${BRUSH.bossDamage}`, "bad", 0.5);
    return;
  }

  // nearest rabbit inside a short forward arc
  const flat = new THREE.Vector3(dir.x, 0, dir.z).normalize();
  let best = null,
    bestD = Infinity;
  for (const r of rabbits) {
    if (!r.alive || r.caught) continue;
    const dx = r.position.x - origin.x;
    const dz = r.position.z - origin.z;
    const dy = r.position.y + GRAB_BODY_Y - origin.y;
    const flatDist = Math.hypot(dx, dz);
    if (flatDist > BRUSH.range) continue;
    if (Math.abs(dy) > GRAB_VERTICAL) continue;
    if (flatDist > 0.05) {
      const hAng = Math.acos(
        THREE.MathUtils.clamp((flat.x * dx + flat.z * dz) / flatDist, -1, 1),
      );
      if (hAng > BRUSH.arc / 2) continue;
    }
    if (flatDist < bestD) {
      bestD = flatDist;
      best = r;
    }
  }

  if (!best) {
    // Almost nothing hears it. That is the toothbrush's whole advantage.
    for (const r of rabbits) r.scare(origin, BRUSH.scareRadius, player, { silent: true });
    return;
  }

  const value = Math.round(best.type.value * BRUSH.meatKeep);
  const where = best.position.clone();
  impacts.add(where.clone().setY(where.y + GRAB_BODY_Y), dir.clone().negate(), "flesh");
  best.shoot();
  state.shot++;

  const cut = best.type.meat ?? {
    scale: 1,
    color: 0xb8241c,
    fat: 0xf0c08a,
    label: `${best.type.name} cut`,
  };
  meat.drop(where, { ...cut, value });
  hud.say(`${best.type.name} — brushed. Collect the meat`, "good", 1.5);

  // a quiet kill still startles what is right next to it
  for (const r of rabbits) r.scare(origin, BRUSH.scareRadius, player, { silent: true });
};

// A whiffed lunge sends everything nearby bolting. §4.1
glove.onScare = (origin, radius) => {
  for (const r of rabbits) r.scare(origin, radius, player);
};

// ── the gun ──────────────────────────────────────────────────────────────────
// Hitscan against rabbit bounding spheres. Deliberately generous to aim, and
// deliberately unrewarding to use: shot meat is ruined. §GUN

// Grab tuning — see glove.onGrab
const GRAB_BODY_Y = 0.28; // rabbit body centre above the ground
const GRAB_VERTICAL = 1.6; // how far up/down the reach forgives
const GRAB_BONUS = 0.9; // flat extra reach on top of the charge radius

const _seg = new THREE.Vector3();
// Generous on purpose. The gun is supposed to be the EASY option — its cost is
// the ruined meat and the emptied field, not a demanding shot.
const HIT_RADIUS = 0.55;
const BODY_OFFSET = 0.26; // aim point sits at the carriage, not the feet

// Where a missed shot actually lands. Raycast the real scene so a mark ends up
// on the tree or the rock you hit, not floating at max range — the ground plane
// alone left every shot at a standing target unmarked.
const _rc = new THREE.Raycaster();
const _n = new THREE.Vector3();
function markMiss(origin, dir) {
  _rc.set(origin, dir);
  _rc.far = GUN.range;
  const hits = _rc.intersectObjects(engine.scene.children, true);
  for (const h of hits) {
    if (!h.face) continue; // skip anything without a surface to stick to
    _n.copy(h.face.normal)
      .transformDirection(h.object.matrixWorld)
      .normalize();
    // a back-facing hit means we went through the inside of something
    if (_n.dot(dir) > 0) _n.negate();
    impacts.add(h.point, _n, "world");
    return;
  }
}

gun.onShoot = (origin, dir) => {
  // the boss is enormous and takes priority over anything behind it
  const bossHit = boss.raycast(origin, dir, GUN.range);
  if (bossHit) {
    const dealt = boss.hit(BOSS.gunDamage, bossHit);
    impacts.add(bossHit, dir.clone().negate(), boss.sealed ? "world" : "yolk");
    hud.say(
      `${Math.round(dealt)}`,
      dealt > BOSS.gunDamage ? "good" : "bad",
      0.5,
    );
    return null;
  }

  // chickens next — they are between you and everything else by design
  const chick = chickens.raycast(origin, dir, GUN.range);
  if (chick) {
    impacts.add(chick.point, dir.clone().negate(), "flesh");
    chickens.kill(chick.chicken);
    return null;
  }

  let best = null,
    bestT = Infinity;

  for (const r of rabbits) {
    if (!r.alive || r.caught) continue;
    // aim at the body, not the ground point the origin sits on
    _seg
      .copy(r.position)
      .setY(r.position.y + BODY_OFFSET)
      .sub(origin);
    const along = _seg.dot(dir);
    if (along < 0 || along > GUN.range) continue;
    const perp = Math.sqrt(Math.max(0, _seg.lengthSq() - along * along));
    if (perp > HIT_RADIUS) continue;
    if (along < bestT) {
      bestT = along;
      best = r;
    }
  }

  if (!best) {
    markMiss(origin, dir);
    return null;
  }

  const value = Math.round(best.type.value * GUN.meatPenalty);
  const hitPoint = origin.clone().addScaledVector(dir, bestT);
  impacts.add(hitPoint, dir.clone().negate(), "flesh");

  const where = best.position.clone();
  best.shoot();
  state.shot++;

  // NOT paid here. The meat lands where the rabbit did and you have to go and
  // get it — which means walking into the 40m of field your own shot emptied.
  const cut = best.type.meat ?? {
    scale: 1,
    color: 0xb8241c,
    fat: 0xf0c08a,
    label: `${best.type.name} cut`,
  };
  meat.drop(where, { ...cut, value });

  hud.say(`${best.type.name} down — collect the meat`, "bad", 1.6);
  return best;
};

gun.onScare = (origin, radius) => {
  // Rabbits still bolt — that is the gun's cost — but they do it SILENTLY.
  // 15 squeals firing at once under the report was just noise on every shot.
  for (const r of rabbits) r.scare(origin, radius, player, { silent: true });
};

// ── black rabbit proximity: the world goes quiet ── §5.4 / §13 ───────────────

let blackNear = 0;
function updateBlackRabbit(dt) {
  let nearest = Infinity;
  for (const r of rabbits) {
    if (r.alive && r.type.circler)
      nearest = Math.min(nearest, r.position.distanceTo(player.pos));
  }
  const target = nearest < 15 ? 1 - nearest / 15 : 0;
  blackNear += (target - blackNear) * Math.min(1, 3 * dt);

  if (audio.ready) {
    audio.duck("voice", 1 - blackNear * 0.75);
    audio.duck("world", 1 - blackNear * 0.5);
  }
  // Desaturate the fog toward grey as it closes. Lerps from whatever the
  // weather set this frame, not from a hardcoded blue — otherwise the Black
  // Rabbit would quietly undo the storm.
  const f = engine.scene.fog;
  const base = sky.baseFog;
  if (base && blackNear > 0.005) {
    f.color.setRGB(
      THREE.MathUtils.lerp(base.r, 0.42, blackNear),
      THREE.MathUtils.lerp(base.g, 0.42, blackNear),
      THREE.MathUtils.lerp(base.b, 0.46, blackNear),
    );
  }
}

// ── loop ─────────────────────────────────────────────────────────────────────

let wasExhausted = false;
let gaspT = 0;
let respawnT = 0;
const POPULATION = 16;

function step(dt) {
  // ABOVE THE GUARDS, deliberately. The raw buff is 45 seconds of wall clock,
  // and if it paused during a conversation you could park it indefinitely by
  // talking to the Stranger. It also has to be able to expire while you are
  // dead, so the whispers do not survive the respawn.
  raw.update(dt);
  canvas.classList.toggle("raw", raw.active);
  // The clock keeps running through a conversation and through the death hold.
  // Standing in the WASTED screen is already fifteen seconds of your day.
  dayCycle.update(dt);
  // Ease rather than assign. `dusk` steps 0.88 -> 1.0 the instant night lands,
  // and a one-frame jump in the sky colour reads as a bug even though the
  // number is correct. Fast enough to still feel like the light going.
  skyDusk += (dayCycle.dusk - skyDusk) * Math.min(1, dt * 1.6);
  sky.setDusk(skyDusk);

  // ── dead ──
  // Nothing the player owns updates: no look, no movement, no weapons. The
  // world keeps running underneath, which is the whole point of the shot.
  if (state.dead) {
    player.updateDeathCam(dt);
    wasted.update(dt);
    for (const r of rabbits) r.update(dt, player);
    carrots.update(dt, rabbits);
    horses.update(dt);
    chickens.update(dt, player);
    impacts.update(dt);
    meat.update(dt, player.pos);
    healing.update(dt);
    jail.update(dt);
    if (boss.alive) boss.update(dt, player);
    sky.setStorm(boss.alive && boss.awake, boss.rage);
    sky.update(dt, engine.camera);
    input.endStep();
    return;
  }

  // ── in conversation ──
  // The player is a spectator: no look, no movement, no weapons. The world
  // keeps running behind the box, which is what stops it feeling like a menu.
  if (chat.on) {
    dialogue.update(dt);
    merchant.update(dt);
    for (const r of rabbits) r.update(dt, player);
    carrots.update(dt, rabbits);
    mating.update(dt, rabbits);
    horses.update(dt);
    chickens.update(dt, player);
    impacts.update(dt);
    meat.update(dt, player.pos);
    healing.update(dt);
    jail.update(dt);
    if (boss.alive) boss.update(dt, player);
    sky.setStorm(boss.alive && boss.awake, boss.rage);
    sky.update(dt, engine.camera);
    glove.root.visible = false;
    gun.root.visible = false;
    hammer.root.visible = false;
    brush.root.visible = false;
    input.endStep();
    return;
  }

  if (input.locked) {
    player.look(input.mouseDX, input.mouseDY, input.sensitivity);

    // Mounted, the horse moves and the player is a passenger — Controller.update
    // is skipped entirely rather than fought with.
    if (horses.riding) {
      horses.updateRide(dt, input, player);
    } else {
      player.update(dt, input);
    }

    // 1-6 select a slot directly. At the goat-room machine 1/2/3 pick the case
    // instead, and `hit()` does not consume — so without this guard, choosing a
    // case would also swap your weapon.
    const atMachineNow = goatRoom.canUse(player.pos);
    for (let i = 0; i < SLOTS.length; i++) {
      if (atMachineNow && i < 3) continue;
      if (input.hit("slot" + (i + 1))) swapTo(SLOTS[i]);
    }

    // The wheel steps through the six in order, both ways. Accumulated over the
    // frame, so a fast flick moves several slots instead of dropping notches.
    if (input.wheel) {
      const dir = input.wheel > 0 ? 1 : -1;
      for (let n = Math.min(6, Math.abs(input.wheel)); n > 0; n--) cycleSlot(dir);
    }
    // Q is the wheel's keyboard twin, and shares its skip-the-locked rule
    // rather than keeping a second hand-maintained order list that could drift
    // out of step with what you actually own.
    if (input.hit("swapWeapon")) cycleSlot(1);

    // Both hands are on the mane: while mounted the weapons are not updated at
    // all, and every viewmodel is hidden.
    if (horses.riding) {
      glove.root.visible = false;
      gun.root.visible = false;
      hammer.root.visible = false;
      brush.root.visible = false;
    } else {
      if (weapon === "glove") glove.update(dt, input);
      gun.update(dt, input, weapon === "gun");
      hammer.update(dt, input, weapon === "hammer");
      brush.update(dt, input, weapon === "brush");
      glove.root.visible = weapon === "glove";
    }
  }

  for (const r of rabbits) r.update(dt, player);

  // reap caught rabbits
  for (let i = rabbits.length - 1; i >= 0; i--) {
    if (!rabbits[i].alive) {
      rabbits[i].dispose(engine.scene);
      rabbits.splice(i, 1);
    }
  }

  // ── endless spawning ──
  // Top the meadow back up to POPULATION on a timer rather than one-for-one on
  // each catch, so the field never empties and never all arrives at once.
  respawnT -= dt;
  if (respawnT <= 0 && rabbits.length < POPULATION) {
    respawnT = 1.1 + Math.random() * 1.4;
    const key = SPAWNABLE[Math.floor(Math.random() * SPAWNABLE.length)];
    const a = Math.random() * Math.PI * 2;
    const d = 30 + Math.random() * 14;
    spawn(key, Math.cos(a) * d, Math.sin(a) * d);
  }

  // Courtship runs BEFORE the carrot lure is assigned, because a rabbit in a
  // courtship must not have its `lure` overwritten out from under it.
  mating.update(dt, rabbits);

  // ── carrots ──
  carrots.update(dt, rabbits);
  for (const r of rabbits) {
    const c = carrots.lureFor(r.position);
    r.lure = c ? c.target : null;
  }

  // ── drink a shake, wherever you are ──
  // Deliberately usable mid-fight: that is what you paid the 150c for.
  // Slot 5 held: the left button drinks it, the same as H. A consumable in a
  // slot has to be usable the way everything else in a slot is.
  const drinkNow = input.hit("useHeal") || (weapon === "kit" && input.lmbDown);
  if (drinkNow) {
    if (state.healKits <= 0) {
      sfx.deny();
      hud.say(`No shakes — ${HEAL.itemPrice}c at the booth`, "bad");
    } else if (state.health >= 1) {
      sfx.deny();
      hud.say("Already at full health", "bad");
    } else {
      state.healKits--;
      state.health = Math.min(1, state.health + HEAL.itemHeal);
      sfx.heal?.();
      hud.say(`Shake — ${state.healKits} left`, "good", 1.4);
      autosave();
      // Drinking the last one leaves you holding nothing. Step off the slot
      // rather than standing there with an empty hand.
      if (state.healKits <= 0 && weapon === "kit") swapTo("glove");
    }
  }

  // ── eat it raw ── §13
  //
  // Deliberately terse. The game does not warn you, does not confirm, and does
  // not congratulate you — §13 is explicit that it never comments. The only
  // acknowledgement is the whispers, and they are not addressed to you.
  if (input.hit("eatRaw")) {
    if (state.blackMeat <= 0) {
      sfx.deny();
    } else {
      state.blackMeat--;
      const cost = raw.eat();
      damagePlayer(cost, "raw");
      // No hud.say on the buff itself. The desaturation and the whispers are
      // the feedback; a line of text would make it a power-up.
      hud.say(`−${cost} HP`, "bad", 1.2);
      autosave();
    }
  }

  player.speedMul = raw.speedMul;
  player.stamina.drainMul = raw.drainMul;
  glove.reachMul = raw.reachMul;
  if (input.hit("dropCarrot") && state.carrots > 0) {
    state.carrots--;
    carrots.drop(player.pos, player.flatForward);
    hud.say(`Carrot dropped — ${state.carrots} left`, "good", 1.0);
  } else if (input.hit("dropCarrot")) {
    sfx.deny();
    hud.say(`No carrots — ${CARROT.price}c from the hamster`, "bad");
  }

  horses.update(dt);
  healing.update(dt);
  jail.update(dt);
  merchant.update(dt);
  rack.update(dt, player.pos, dayCycle.isNight);
  goatRoom.update(dt);
  // The storm is on for exactly as long as the Sovereign is out of its shell.
  sky.setStorm(boss.alive && boss.awake, boss.rage);
  sky.update(dt, engine.camera);
  impacts.update(dt);
  meat.update(dt, player.pos);
  chickens.update(dt, player);

  updateBlackRabbit(dt);

  // ── boss ──
  if (boss.alive) {
    boss.update(dt, player);
    bossBar.classList.toggle("show", boss.awake && boss.state !== "DEAD");
    const pct = boss.healthRatio * 100;
    bossFill.style.width = pct + "%";
    bossChip.style.width = pct + "%";
    bossHpNum.textContent = Math.ceil(boss.health);
  }

  if (hurtT > 0) {
    hurtT -= dt;
    if (hurtT <= 0) hurtEl.classList.remove("flash");
  }

  // ── the horses ──
  // First in the prompt chain: if you are close enough to touch a horse, that
  // is what E means, whatever else is nearby.
  const nearHorse =
    !reel.visible && !horses.riding ? horses.mountable(player.pos) : null;

  if (horses.riding) {
    promptEl.className = "show";
    promptEl.innerHTML =
      `<span class="cost">${horses.secondsLeft.toFixed(1)}s</span>` +
      `&nbsp; <span style="opacity:.6">— hold on</span>`;
  } else if (nearHorse) {
    promptEl.className = "show";
    promptEl.innerHTML =
      `<kbd>E</kbd>Ride the horse` +
      `&nbsp; <span style="opacity:.5">— ${HORSE.rideTime}s, then it throws you</span>`;
    if (input.hit("interact") && horses.mount(nearHorse, player)) {
      hud.say("HOLD ON", "good", 1.3);
    }
  }
  const horsePrompt = horses.riding || !!nearHorse;

  // ── the Stranger ──
  const atMerchant =
    !reel.visible && !horsePrompt && merchant.canTalk(player.pos);
  if (atMerchant) {
    promptEl.className = "show";
    promptEl.innerHTML =
      `<kbd>E</kbd>Talk to the Stranger` +
      (hammer.owned ? "" : `&nbsp; <span style="opacity:.5">— he is selling something</span>`);
    if (input.hit("interact")) startChat();
  }

  // ── the healing booth ── 300c to be patched up, 150c to carry one
  const atHealing =
    !reel.visible && !horsePrompt && !atMerchant && healing.canUse(player.pos);
  if (atHealing) {
    const hurtNow = state.health < 1;
    const canFull = state.coins >= HEAL.fullPrice && hurtNow;
    const canBuy =
      state.coins >= HEAL.itemPrice && state.healKits < HEAL.maxCarried;
    promptEl.className = "show" + (canFull || canBuy ? "" : " cant");
    promptEl.innerHTML =
      `<kbd>E</kbd>Full health <span class="cost">${HEAL.fullPrice}c</span>` +
      `&nbsp;·&nbsp; <kbd>B</kbd>Buy a shake <span class="cost">${HEAL.itemPrice}c</span>` +
      `&nbsp; <span style="opacity:.5">— carried ${state.healKits}/${HEAL.maxCarried}, drink with H</span>`;

    if (input.hit("interact")) {
      if (!hurtNow) {
        sfx.deny();
        hud.say("Nothing to patch up", "bad");
      } else if (state.coins >= HEAL.fullPrice) {
        state.coins -= HEAL.fullPrice;
        autosave();
        sfx.purchase();
        healToFull();
      } else {
        sfx.deny();
        hud.say(`You need ${HEAL.fullPrice - state.coins}c more`, "bad");
      }
    }

    if (input.hit("buyHeal")) {
      if (state.healKits >= HEAL.maxCarried) {
        sfx.deny();
        hud.say(`You can only carry ${HEAL.maxCarried}`, "bad");
      } else if (state.coins >= HEAL.itemPrice) {
        state.coins -= HEAL.itemPrice;
        autosave();
        state.healKits++;
        sfx.purchase();
        hud.say(`Shake × ${state.healKits} — drink with H`, "good", 1.8);
      } else {
        sfx.deny();
        hud.say(`You need ${HEAL.itemPrice - state.coins}c more`, "bad");
      }
    }
  }

  // ── the hamster: carrots at 5c ──
  const atTrader =
    !reel.visible &&
    !horsePrompt &&
    !atMerchant &&
    !atHealing &&
    carrots.canTrade(player.pos);
  if (atTrader) {
    const afford = state.coins >= CARROT.price;
    promptEl.className = "show" + (afford ? "" : " cant");
    promptEl.innerHTML =
      `<kbd>E</kbd>Buy a carrot &nbsp;<span class="cost">${CARROT.price}c</span>` +
      `&nbsp; <span style="opacity:.5">— drop with G</span>`;
    if (input.hit("interact")) {
      if (afford) {
        state.coins -= CARROT.price;
        autosave();
        state.carrots++;
        sfx.purchase();
        hud.say(`Carrot × ${state.carrots} — press G to drop`, "good", 1.6);
      } else {
        sfx.deny();
        hud.say("Not enough coins", "bad");
      }
    }
  }

  // The cooking table sells nothing now. The Tenderiser is the Stranger's, and
  // `atTable` survives only so the other prompts keep their priority order.
  // The cooking table. §6.1 puts it at the exact centre of the map and calls it
  // the hub, and it now is one: the bakery by day, and at night the only way to
  // end the day.
  const nearTable =
    !reel.visible && !bakery.visible && !wardrobe.visible &&
    player.pos.distanceTo(TABLE_POS) < 3.2;
  const atTable = dayCycle.isNight && nearTable;
  const atBakery = !dayCycle.isNight && nearTable;

  if (atBakery) {
    promptEl.className = "show";
    const n = state.meat.length;
    promptEl.innerHTML =
      `<kbd>E</kbd>The cooking table &nbsp;<span class="cost">` +
      `${n} slab${n === 1 ? "" : "s"}</span>`;
    if (input.hit("interact")) {
      document.exitPointerLock?.();
      bakery.show();
    }
  }

  // ── the sealed egg ──
  if (boss.alive && boss.sealed) {
    const nearEgg = player.pos.distanceTo(boss.root.position) < 16;
    shellBar.classList.toggle("show", nearEgg);
    if (nearEgg && shellPips.childElementCount !== BOSS.shellHits) {
      shellPips.innerHTML = "<i></i>".repeat(BOSS.shellHits);
    }
    if (nearEgg) {
      [...shellPips.children].forEach((pip, i) =>
        pip.classList.toggle("gone", i >= boss.shell),
      );
      shellHint.textContent = hammer.owned
        ? "Press 3, then swing."
        : `Only the Tenderiser will crack this. The Stranger sells one, ${HAMMER.price}c.`;
    }
  } else {
    shellBar.classList.remove("show");
  }

  // ── chest interaction ──
  // Whichever of the three you are actually looking at wins; the other two
  // dim back down.
  let openChest = null;
  if (!reel.visible && !horsePrompt && !atMerchant && !atHealing) {
    let bestD = Infinity;
    for (const ch of chests) {
      if (!ch.canUse(player.pos, player.forward)) continue;
      const d = ch.root.position.distanceTo(player.pos);
      if (d < bestD) {
        bestD = d;
        openChest = ch;
      }
    }
  }
  for (const ch of chests) ch.update(dt, ch === openChest);
  const canUse = !!openChest;
  pickups.update(dt, player.pos);

  // ── the goat room machine ── §8
  //
  // The three chests by the table stay exactly where they are: they are the
  // shortcut, and they are what makes the case you are buying a physical
  // decision. The machine is the same three cases in the room the spec built
  // for them, with 1/2/3 to switch rather than a walk between chests.
  const atMachine =
    !reel.visible && !wardrobe.visible && !bakery.visible &&
    goatRoom.canUse(player.pos);
  if (atMachine) {
    for (let i = 0; i < CHEST_ROW.length; i++) {
      if (input.hit("slot" + (i + 1))) {
        machineKind = i;
        sfx.uiMove?.();
      }
    }
    const pick = CHEST_ROW[machineKind];
    const afford = state.coins >= CASE_COST;
    promptEl.className = "show" + (afford ? "" : " cant");
    promptEl.innerHTML =
      `<kbd>E</kbd>${pick.label} &nbsp;<span class="cost">${CASE_COST}c</span>` +
      `<span style="opacity:.45"> &nbsp;1/2/3 to switch</span>`;
    if (input.hit("interact")) {
      if (afford) {
        state.coins -= CASE_COST;
        autosave();
        sfx.chestOpen();
        document.exitPointerLock?.();
        reel.open(pick.kind);
      } else {
        sfx.deny();
        hud.say("Not enough coins", "bad");
      }
    }
  }

  // ── the rack ── §7
  const atRack = !reel.visible && !wardrobe.visible && rack.canUse(player.pos);
  if (atRack && !atTable) {
    promptEl.className = "show";
    const n = state.skins.length;
    promptEl.innerHTML =
      `<kbd>E</kbd>The wardrobe &nbsp;<span class="cost">${n} skin${n === 1 ? "" : "s"}</span>`;
    if (input.hit("interact")) {
      document.exitPointerLock?.();
      wardrobe.show("glove");
    }
  }

  // ── sleep ── §2: night is untimed, and this is the only way out of it
  if (atTable) {
    promptEl.className = "show";
    promptEl.innerHTML = `<kbd>E</kbd>Sleep &nbsp;<span class="cost">DAY ${dayCycle.day + 1}</span>`;
    if (input.hit("interact")) {
      sfx.purchase?.();
      dayCycle.sleep();
    }
  } else if (canUse && !atTrader && !atRack && !atMachine && !atBakery) {
    const afford = state.coins >= CASE_COST;
    promptEl.className = "show" + (afford ? "" : " cant");
    promptEl.innerHTML =
      `<kbd>E</kbd>Open the ${openChest.label} &nbsp;<span class="cost">${CASE_COST}c</span>`;
    if (input.hit("interact")) {
      if (afford) {
        state.coins -= CASE_COST;
        autosave();
        openChest.pop();
        sfx.chestOpen();
        document.exitPointerLock?.();
        reel.open(openChest.kind);
      } else {
        sfx.deny();
        hud.say("Not enough coins", "bad");
      }
    }
  } else if (
    !atTrader &&
    !atMerchant &&
    !atHealing &&
    !horsePrompt &&
    !atTable &&
    !atRack &&
    !atMachine &&
    !atBakery
  ) {
    promptEl.className = "";
  }

  // out-of-breath cue
  if (player.stamina.exhausted) {
    gaspT -= dt;
    if (gaspT <= 0) {
      sfx.gasp();
      gaspT = 1.1;
    }
  } else gaspT = 0;
  wasExhausted = player.stamina.exhausted;

  // FOV pulls in while winding up, pushes out while sprinting
  const wantFov =
    MOVE.fovBase +
    (player.sprinting ? MOVE.fovSprint - MOVE.fovBase : 0) +
    (glove.charging ? LUNGE.fovPull * glove.charge : 0);
  engine.setFov(
    THREE.MathUtils.lerp(engine.camera.fov, wantFov, 1 - Math.exp(-9 * dt)),
  );

  input.endStep();
}

let dbgT = 0;
function frame() {
  requestAnimationFrame(frame);
  time.tick(step);

  // The fryer runs on REAL time, not the fixed step. §6.3 asks for a six-second
  // bake, and step() is paused whenever an overlay has the cursor — which is
  // exactly when the fryer is on screen.
  bakery.update(time.frameDt);

  // The conversation camera takes over from the controller while it is easing
  // in, held, and easing back out.
  if (!updateChatCamera(time.frameDt)) player.applyToCamera(engine.camera);

  hud.update(time.frameDt, {
    charging: glove.charging,
    charge: glove.charge,
    lunging: glove.state === 2,
    stamina: player.stamina.ratio,
    exhausted: player.stamina.exhausted,
    health: state.health,
    coins: state.coins,
    carrots: state.carrots,
    healKits: state.healKits,
    day: dayCycle.day,
    clock: dayCycle.clock,
    proteinShake: state.proteinShake,
    weapon,
    ammo: gun.ammo,
    reserve: gun.reserve,
    reloading: gun.reloading > 0,
  });

  dbgT -= time.frameDt;
  if (dbgT <= 0) {
    dbgT = 0.12;
    const near = rabbits
      .map((r) => ({ r, d: r.position.distanceTo(player.pos) }))
      .sort((a, b) => a.d - b.d)[0];
    hud.setDebug(
      `spd    ${player.speed2D.toFixed(2)} m/s   ${player.sprinting ? "SPRINT" : player.crouching ? "CROUCH" : "walk"}
stam   ${player.stamina.value.toFixed(0)}${player.stamina.exhausted ? "  EXHAUSTED" : ""}
bob    y${player.bob.y.toFixed(3)} x${player.bob.x.toFixed(3)} ph${player.bob.phase.toFixed(1)}
glove  ${["IDLE", "WIND", "DASH", "RECOVER"][glove.state]}  chg ${glove.charge.toFixed(2)}
noise  ${player.noiseRadius}m
coins  ${state.coins}   hidden left ${pickups.remaining}   skins ${state.skins.length}
carrot ${state.carrots} held, ${carrots.active.length} down   lured ${rabbits.filter((r) => r.lure).length}
weapon ${weapon}  ammo ${gun.ammo}/${gun.reserve}${gun.reloading > 0 ? " RELOADING" : ""}
caught ${state.caught}  shot ${state.shot}  coins ${state.coins}  rabbits ${rabbits.length}
near   ${near ? `${near.r.type.name} ${near.d.toFixed(1)}m ${near.r.state} p${near.r.gait.phase.toFixed(2)}${near.r.gait.airborne ? " AIR" : ""}` : "-"}
black  ${blackNear.toFixed(2)}  meat ${state.blackMeat}  raw ${raw.t.toFixed(0)}s   courting ${mating.courting}  hearts ${mating.hearts.length}  born ${mating.born}  next ${mating.nextIn.toFixed(0)}s
boss   ${boss.alive ? `${boss.state} shell ${boss.shell} hp ${Math.ceil(boss.health)} rage ${boss.rage.toFixed(2)}` : "DEAD"}
hammer ${hammer.owned ? "OWNED" : "not bought"}
horse  ${horses.riding ? `RIDING ${horses.secondsLeft.toFixed(1)}s` : horses.list.map((h) => h.state[0]).join("")}
chick  ${chickens.liveCount} live   meat ${meat.pending} on the ground   marks ${impacts.live.length}
music  ${music.current ?? "-"}   shake ${state.proteinShake}
dead   ${state.dead ? `YES ${wasted.t.toFixed(1)}s` : "no"}   chat ${chat.on ? (chat.leaving ? "leaving" : dialogue.node) : "-"}
storm  ${sky.storm.toFixed(2)}  rain ${sky.rain.visible ? "on" : "off"}  strike in ${sky.strikeIn.toFixed(1)}s
heal   ${(state.health * 100).toFixed(0)}%   kits ${state.healKits}   weapon4 ${brush.owned ? "toothbrush" : "-"}`,
    );
  }

  engine.render();
}

// ── settings ─────────────────────────────────────────────────────────────────

const settings = new Settings();

function applySettings(v) {
  input.sensitivity = v.sensitivity / 1000;
  player.invertY = v.invertY;
  player.bob.scale = v.headBob / 100;
  MOVE.fovBase = v.fov;
  MOVE.fovSprint = v.fov + 7;
  audio.setMasterVolume(v.masterVolume);
  audio.setSfxVolume(v.sfxVolume);
  music.setVolume(v.musicVolume);
}
settings.onChange = applySettings;
applySettings(settings.values);

// dev tool — skip the grind when testing the shops
settings.onDevCoins = (n) => {
  state.coins += n;
  sfx.coin();
  hud.say(`DEV  +${n}c`, "good", 2.0);
  autosave();
};

// dev tool — wipe the save. Does not reset the running session; the point is to
// see what a first boot looks like on the next reload.
settings.onWipeSave = () => {
  save.clear();
  sfx.deny();
  hud.say("SAVE WIPED — reload for a fresh start", "bad", 3.0);
};

// ── start gate ───────────────────────────────────────────────────────────────

const gate = document.getElementById("gate");

async function enterGame() {
  audio.start();
  music.build(); // needs a live AudioContext, so not before now
  applySettings(settings.values); // volumes need a live AudioContext
  settings.close();
  // The meadow track, unless the Sovereign is already out.
  music.play(boss.alive && boss.awake ? "boss" : "game");

  const ok = await input.lock();
  if (ok) {
    gate.classList.add("hidden");
    // Say it once, on the first entry only — not every time you close Settings.
    if (restored && !enterGame._said) {
      enterGame._said = true;
      hud.say(`DAY ${state.day} — progress restored`, "good", 2.6);
    }
  } else {
    // The browser refused (usually a cooldown right after Esc). Show the gate
    // so there is always something clickable rather than a frozen screen.
    gate.classList.remove("hidden");
  }
}

// Resuming from the settings menu is the same path as pressing play.
settings.onResume = enterGame;

document.getElementById("startBtn").addEventListener("click", enterGame);
document
  .getElementById("settingsBtn")
  ?.addEventListener("click", () => settings.open());

// Clicking the world re-locks. Without this, any stray Esc drops you into a
// state where the keys look broken because movement is gated on pointer lock.
canvas.addEventListener("click", () => {
  if (input.locked || settings.visible || reel.visible || wardrobe.visible ||
      bakery.visible) return;
  // clicking the world during a conversation or a death must not re-grab the
  // cursor — you need it to pick a reply
  if (chat.on || dialogue.visible || state.dead) return;
  enterGame();
});

// Esc leaves pointer lock; show settings rather than a bare gate.
//
// But NOT every unlock is an Esc. The case reel, a conversation and the death
// screen all release the cursor deliberately, and each of those released it
// straight into the settings menu until this list existed. Anything that takes
// the cursor on purpose has to be named here.
input.onUnlock = () => {
  if (reel.visible) return;      // opening a case
  if (wardrobe.visible) return;  // at the rack
  if (bakery.visible) return;    // at the cooking table
  if (chat.on) return;           // talking to the Stranger
  if (dialogue.visible) return;
  if (state.dead) return;        // the WASTED screen
  settings.open();
};
input.onToggleDebug = () => hud.toggleDebug();

// Dev handle — lets tooling drive the camera without pointer lock.
window.GAME = {
  engine,
  audio,
  sfx,
  player,
  glove,
  gun,
  rabbits,
  world,
  state,
  hud,
  input,
  spawn,
  THREE,
  settings,
  chests,
  reel,
  pickups,
  boss,
  hammer,
  carrots,
  horses,
  chickens,
  sky,
  jail,
  merchant,
  dialogue,
  chat,
  startChat,
  endChat,
  updateChatCamera,
  wasted,
  die,
  mating,
  meat,
  healing,
  brush,
  impacts,
  music,
  get weapon() {
    return weapon;
  },
  swapTo,
};

frame();
