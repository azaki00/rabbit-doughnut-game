# CODEMAP — Hare & Glaze

Per-module index. One line each: what it owns, and the fact you would otherwise
have to read the file to learn. Line counts are a size signal, not a target.

`CLAUDE.md` at the repo root is the syllabus and points here. This file is the
detail; that one is the reading order.

## The shape

```
                      ┌──────────────┐
                      │   main.js    │  1686 lines, 35 imports
                      │ composition  │  owns ALL cross-module wiring
                      │     root     │
                      └──────┬───────┘
         ┌───────────┬───────┼────────┬───────────┬──────────┐
       core        player  rabbits   world      economy     ui
      (engine,   (glove,  (AI,      (props,    (skins,    (hud,
       input,     gun,     mating,   boss,      value)     menus)
       clock)     hammer)  mutate)   sky)
                             └──── world/Loaders.js ────┘
                                  (11 importers — the only real hub)
```

**Star topology.** Modules almost never import each other: fan-in across the
whole of `src/` is `Loaders.js` 11, `applySkin.js` 3, `Engine.js` 3, and a tail
of 1-2. Everything else meets in `main.js`. This is deliberate — a system can be
deleted by removing its import and its `.update()` line — but it means `main.js`
is where every bug that crosses two systems lives.

## core/ — the loop

| File | Lines | Owns |
|---|---|---|
| `Engine.js` | 98 | Renderer, scene, two cameras. Exports `LAYER_WORLD` / `LAYER_VIEWMODEL` — the viewmodel camera draws held items so they never clip into walls. |
| `Time.js` | 38 | `FIXED_DT` (1/60) and the accumulator. Max 5 catch-up steps, so a stalled tab resumes rather than fast-forwarding. |
| `Input.js` | 181 | Action map + pointer lock. Six slot binds plus `wheel` (accumulated notches, locked-only). **Crouch is C/Z, never Ctrl** — see Traps. |
| `Save.js` | 150 | `localStorage` under `hareandglaze.save.v1`. Skins stored as `(skinId, float)` and re-minted on load. Settings are NOT here — `ui/Settings.js` owns its own key. |

## player/ — first person

| File | Lines | Owns |
|---|---|---|
| `Controller.js` | 309 | Walk/run/crouch, collision against `world.colliders`, `MOVE` tunables. |
| `Glove.js` | 299 | The red glove. `LUNGE` timings; the catch is a lunge with a hit window, not a raycast. |
| `Gun.js` | 290 | Shotgun. 2 shells then reload, infinite ammo. Muzzle flash at z −0.60. |
| `Hammer.js` | 229 | Big hammer. `HAMMER.price` (1000c). Bought from the merchant only. |
| `Toothbrush.js` | 211 | Starting melee weapon. |
| `RawBuff.js` | 104 | Eating the Black Rabbit (§13). Owns the timer and the numbers only — exposes `speedMul` / `drainMul` / `reachMul`, which `main.js` applies. |
| `HeadBob.js` / `Stamina.js` | 88 / 45 | Camera bob; sprint budget (`drainMul` scales sprint drain only). |

## rabbits/

| File | Lines | Owns |
|---|---|---|
| `Rabbit.js` | 494 | The state machine (`ST`): graze, flee, freeze, caught. Hearing radius reacts to gunfire. |
| `RabbitMesh.js` | 295 | `buildRabbit()` — procedural body, so a rabbit needs no model file. Geometry and materials are cached page-wide, so **nothing may dispose or mutate them per-rabbit**. |
| `types.js` | 75 | `TYPES` / `SPAWNABLE`, incl. the black rabbit that circles instead of fleeing. |
| `Mating.js` | 253 | 10s courtship, hearts, then a birth. `MATE.cooldown` 90s, `maxPairs` 1. |
| `mutate.js` | 114 | `makeMutant()`. Hard caps: `MAX_VALUE` 1000c, `MAX_SCALE` 2.4×, size derived from value. |
| `HopGait.js` | 133 | Hop cycle driven by speed. |

## world/

| File | Lines | Owns |
|---|---|---|
| `Loaders.js` | 217 | **The most-imported file.** OBJ/FBX/MTL loading plus `prepare()`, which fixes fully-dissolved materials. Read this before debugging any invisible model. |
| `Greybox.js` | 416 | Ground, fences, buildings, `treeClumps`, `colliders`, `buildingSpots`. |
| `EggBoss.js` | 817 | Two-phase boss: shell → cracked → yolk. Throws chickens below 50% health. |
| `Sky.js` | 409 | Gradient dome, 46 instanced clouds, 1800 rain streaks. Two independent axes: `setStorm()` (the Sovereign's weather) and `setDusk()` (the hour), applied in series. |
| `DayCycle.js` | 72 | Five-minute day, untimed night, `sleep()`. Owns time only — publishes `dusk`, `phase`, `clock`. |
| `Horses.js` | 354 | Rideable 4s, then a buck and a tumble. |
| `Merchant.js` | 342 | The Stranger, his shack, cart, and tree grove. `focusCandidates()` returns camera framings for dialogue. |
| `Carrots.js` | 297 | The hamster's booth and thrown carrots (rabbits stop to eat). |
| `Chickens.js` | 263 | Boss-thrown chickens that chase and damage. |
| `GoatRoom.js` | 356 | §8. 5×5 m, magenta carpet, lime walls, cycling RGB. ~44 procedural goat paintings in four styles, one frame deliberately empty. Owns the 90-second bleat. |
| `JailCell.js` | 259 | Respawn cell. `findCellSpot()` steps its clearance requirement down rather than failing. |
| `HealingBooth.js` | 200 | 300c full heal, 150c carryable shake. |
| `MeatDrops.js` | 173 | Shotgun kills drop a slab; money is paid on pickup, not on kill. |
| `Impacts.js` | 162 | Hit marks, 4s lifetime. |
| `Chest.js` | 162 | The three skin cases. |
| `ClothingRack.js` | 177 | One rack, three rails (§7). Each hanger is painted with the skin equipped on that weapon, so your loadout is readable from across the clearing. |
| `Pickups.js` | 139 | Ground items. |

## economy/

| File | Lines | Owns |
|---|---|---|
| `Skins.js` | 244 | `TIERS`, `COLLECTIONS`, `SKINS`, wear levels, `rollSkin()`, `valueOf()`. |
| `SkinTextures.js` | 432 | 15 procedural pattern generators on canvas, albedo + derived roughness. Seeded, so a skin id always yields the same texture. |
| `Recipes.js` | 189 | §6. Eight doughnuts, their unlock rules and the fryer's grade bands. Pure data and rules — builds nothing, draws nothing. |
| `applySkin.js` | 148 | `applySkinTo()` — box-projects UVs **in root space**. See Traps. |

## ui/

| File | Lines | Owns |
|---|---|---|
| `Dialogue.js` | 191 | The merchant conversation box. `_render()` rebuilds; `_highlight()` only toggles a class. Keep hover on `_highlight`. |
| `Settings.js` | 148 | Menu + `DEFAULTS`. Contains the 10000c devtool. |
| `CaseReel.js` | 161 | Case-opening spinner. |
| `Bakery.js` | 306 | The cooking table's panel: satchel (sell or grind), counter, recipe book, and the fryer minigame. Ticked on **real** time from `frame()`, not the fixed step. |
| `Wardrobe.js` | 195 | The rack's panel: wear or sell. Selling arms on the first click and commits on the second — the only destructive action in the game. |
| `Hud.js` | 90 | Crosshair, coins, health. |
| `Wasted.js` | 91 | Death overlay; 15s hold, typed taunt. |

## audio/

| File | Lines | Owns |
|---|---|---|
| `Sfx.js` | 676 | Every synthesised effect. New sounds must differ in source, register, or envelope from their neighbours — not just pitch. |
| `AudioEngine.js` | 213 | Graph, buses, unlock-on-gesture. |
| `Music.js` | 114 | Streams `game-music.mp3` / `BOSSMUSIC.mp3` via MediaElementSource. |
| `RabbitVoice.js` | 178 | Per-rabbit vocalisations. |
