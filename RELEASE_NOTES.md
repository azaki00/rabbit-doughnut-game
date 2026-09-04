# Release notes

## v0.4.0 — “Weather and Consequences”

Suggested tag: `v0.4.0`

The sky arrived, and so did dying properly.

### Clouds and the storm

- **A sky dome and clouds.** A three-stop gradient dome replaces the flat
  background colour, with 46 instanced low-poly clouds drifting overhead.
- **The boss brings weather.** One `storm` value eases 0 → 1 when the shell
  cracks and drives everything: near-black sky overhead with a bruised red band
  at the horizon, fog closing from 190 m to 78, clouds darkening and dropping to
  46 m, the sun dimming and going cold, **1800 rain streaks**, and **lightning**
  on a timer that tightens with the Sovereign's rage. It clears again, more
  slowly, on its death.
- **Thunder**, in a frequency band nothing else in the game occupies.

### Dying

- **WASTED.** The canvas desaturates and blurs, a vignette closes in, and one
  enormous serif word crawls up out of nothing.
- **The death camera** collapses to 25 cm off the grass, rolls onto its side and
  looks up at the sky.
- **Fifteen seconds** of a countdown, while `skill issue, dying in this game`
  types itself out one character at a time.
- **The cell.** You wake up in a stone box at the edge of the meadow: three
  solid walls, a barred front with real collision, and the door standing wide
  open. You keep everything except 20% of your coins; the walk back is the rest
  of the punishment.

### The Stranger

- The Tenderiser is **no longer sold at the cooking table**. It belongs to a
  merchant in the far corner, standing in the mouth of a shack
  (`OBJECTS/small-shack`) with a broken cart (`OBJECTS/broken-wagon`) beside it.
- **A real conversation.** `E` takes the camera off your head and eases it in on
  his face, Elder-Scrolls style, with a dialogue box of numbered replies —
  pickable with `1`-`9`, the arrow keys, or the mouse. He talks about his wares,
  the rabbits, doughnuts, and the egg.
- On the sale: *"Thank you for paying. But I don't know what's it for. But it
  does some decent damage."*

### Also

- The player death sound is now the recorded **player-dying.mp3**.
- The clinic keeper is now the purpose-made **shop-old-man** model.
- **Chicken audio**: the recorded clip plays in full and quietly on spawn — only
  one at a time, or a burst of two becomes a wall — and each bird mutters at low
  volume about once a second while it chases you.
- The three cases are **spaced along an arc** so only one is ever in range.

### Fixes

- `backdrop-filter` does not composite over a WebGL canvas. The first WASTED
  screen came out full colour with a faint vignette over it; the desaturation is
  now applied to the canvas element itself.
- **Opening the dialogue opened the settings menu.** `input.onUnlock` treated
  every pointer-lock release as an Esc press; the conversation, the case reel
  and the death screen all release the cursor deliberately, and each now says so.
- The merchant model is authored facing +Z, so he greeted you with the back of
  his hood until it was yawed 180°.
- The cell was placed inside a pine clump twice. Tree models load
  asynchronously, so a clearance scan against `world.colliders` at build time
  passes everything — the clump centres are now declared synchronously on the
  Greybox and checked directly.

### New files

```
src/world/Sky.js        src/world/JailCell.js    src/ui/Wasted.js
src/world/Merchant.js   src/ui/Dialogue.js
```

---

## v0.3.0 — “The Sovereign, the Saddle and the Toothbrush”

Suggested tag: `v0.3.0`

The biggest content drop so far. The boss fight got a first phase and a second
one, the meadow got horses and a clinic, rabbits started breeding, and skins
stopped being recolours.

### The Sunny-Side Sovereign

- **Sealed shell phase.** The boss now begins as an intact egg
  (`OBJECTS/EggWithShell`) with six procedural crack lines that light up one per
  hammer blow. The sixth blow bursts the shell into shards and reveals the fried
  egg underneath.
- **The yolk is yellow.** It was white because the model was being loaded
  without its MTL at all, so both material groups collapsed to OBJLoader's
  default. It now loads the MTL for the group split and forces the two colours
  explicitly.
- **Phase two — chickens.** At or below 50% health the Sovereign throws live
  chickens. They arc out, land short of you, and charge; one shell kills a
  chicken, and contact costs you 9 health and a cloud of feathers.
- **Boss music** starts on summon and ends on death.
- **Protein Shake** drops when it dies. Purpose deliberately undefined for now.

### Wild horses

- Four of them graze around the meadow. `E` within 3.6 m to mount.
- **Four seconds** of gallop at 13 m/s — roughly three times your sprint — then
  the horse throws you over its head and bolts for 4.5 s.
- **Fall and get-up animation**: you spin through the air, land face-first, the
  camera slumps to the grass and then rights itself, with a body-fall thump and
  a winded grunt. And a fart.

### Weapons

- **The Toothbrush** — the melee weapon you start with, on slot `4`. Fast,
  silent, keeps 75% of the meat, and carries barely five metres.
- **Two-shell magazine** on the gun. It fires twice, auto-reloads over 1.9 s,
  and never runs dry — the rhythm is the cost, not the count.
- **Muzzle flash**: hot cone, four-point star and a real point light, ~70 ms,
  rolled to a new angle every shot.
- **Impact marks**: scorch, blood or yolk decals on whatever the shot hit,
  lasting 4 seconds. Misses raycast the real scene, so marks land on trees and
  rocks rather than nothing.

### Meat

- Shooting or brushing a rabbit no longer pays you. It drops a **slab of meat**
  where it fell and you are paid on collection — which means walking into the
  40 m of field your own shot just emptied.
- Every slab is sized and coloured by the rabbit it came off.

### Rabbits breed

- Two grazing rabbits pair up, **hearts appear for ten seconds** while they
  barge into each other, the hearts pop, and a **mutant** is born: re-rolled
  proportions, extra ear pairs, too many eyes, spinal lumps, mismatched legs,
  sometimes a second head.
- Scaring either parent cancels it.
- **Capped**: value ceiling of 1000c with scale derived from the value, one
  birth per 90 seconds, one courtship at a time.

### Three cases, real paints

- **Three chests** beside the table — Meadow (glove), Culling (gun), Enamel
  (toothbrush) — with separate pools that never cross over. Coloured, labelled
  placards.
- **57 skins**, each a **procedural pattern** rather than a tint: fade, camo,
  hydro-dip marbling, case-hardened crackle, circuit traces, scales, star
  fields, splatter, doodles, corrosion, banded chrome, nebulae. Each generates a
  matching roughness map, so the pattern changes how the light sits on the
  material. Reel tickets show the real paint.

### Shops and the world

- **The healing booth**, pitched in front of the Cottage with the old shop man
  beside it. `E` for a 300c full heal, `B` for a 150c shake to carry, `H` to
  drink one anywhere.
- **The carrot stall moved** behind House_1 — you have to walk round the back to
  find it.
- **The Tenderiser is on display**, floating and slowly turning over the first of
  the cooking table's four stations, and vanishes once you own it.
- **Music** for the meadow, crossfaded with the boss track.
- **Dev tools** in Settings: a `+10,000c` button.
- **Music volume** slider.

### Fixes

- **The hamster trader was invisible.** `Hamster_01.mtl` declares
  `d 0.000000` — fully dissolved — on all four of its materials, so it loaded,
  sized and positioned perfectly and rendered nothing at all. Every numeric
  probe reported a correct, visible, present object. The chicken has the same
  defect. Both are now un-dissolved centrally in `Loaders.prepare()`.
- The stall's warm light sat *inside* the hamster, lighting his inner faces
  through `DoubleSide` and leaving the outside in shadow.
- Steak meshes were flat white: the model's MTL is `materials.mtl`, not
  `model.mtl`.
- The muzzle flash was 4 cm inside the barrel and depth-tested away.
- Skin patterns sampled a single texel through the glove's authored UVs, and the
  toothbrush's raw OBJ coordinates blew its projected UVs out to −75. Both fixed
  with box-projected UVs computed in the weapon's root space.

### New files

```
src/player/Toothbrush.js      src/world/Chickens.js
src/world/HealingBooth.js     src/world/MeatDrops.js
src/world/Impacts.js          src/world/Horses.js
src/audio/Music.js            src/economy/SkinTextures.js
src/economy/applySkin.js      src/rabbits/Mating.js
src/rabbits/mutate.js         progress.html
```

### Controls added

| Key | Action |
| --- | ------ |
| `4` | Toothbrush |
| `B` | Buy a healing shake (at the clinic) |
| `H` | Drink a carried shake |

---

## v0.2.0 — Boss, hammer, trader

Suggested tag: `v0.2.0`

The egg became a gated boss fight, the Tenderiser became the key to it, and the
hamster started selling carrots.

- The Sunny-Side Sovereign: 4000 HP, chase, telegraphed slam, yolk spit.
- The Tenderiser at 2000c, and the shell that only it can crack.
- The hamster trader and 5c carrots that freeze every rabbit within 14 m.
- Endless rabbit spawning.
- Settings menu: sensitivity, FOV, volumes, head bob, invert Y.
- Distinctness pass on every sound.
- House_1, the Cottage, more tree variety, grass, and a ground texture.

---

## v0.1.0 — Milestone 1, “Feel”

Suggested tag: `v0.1.0`

The vertical slice that answered the only question that mattered: does the lunge
feel good?

- First-person controller, stamina, head bob.
- The red glove and the charged lunge grab.
- Procedural rabbits with a real saltation gait.
- Four rabbit types, including the Black Rabbit.
- The gun, hidden coins, the chest and the CS-exact case reel.
