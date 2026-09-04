# Release notes

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
