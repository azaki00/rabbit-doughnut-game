# Release notes

## v0.5.0 — "It Remembers You"

Suggested tag: `v0.5.0`

Progress survives a refresh. Until now it did not.

### Saving

- **One key, one blob.** `localStorage` under `hareandglaze.save.v1`, exactly the
  schema §14 specifies. A full save with a skin in it is 266 bytes.
- **Skins are stored as a triple**, not whole. Everything on a minted instance —
  palette, pattern, metalness, wear name — is a pure function of `(skinId,
  float)`, so only those are written and the instance is re-minted on load. A
  rebalance of the skin tables therefore reaches old saves instead of being
  frozen into them.
- **Autosave on the events that matter**: every purchase, every case opened,
  every skin equipped, every rabbit caught, every slab collected. Writes inside
  one tick coalesce into a single write, so buying three carrots costs one.
- **Restored before the first frame.** The hammer is already in its slot and the
  skin is already on the glove by the time anything renders.
- **A bad save never blocks the boot.** Corrupt JSON, an unknown version, a
  deleted skin id, or `coins: "abc"` each degrade to a clean start rather than
  a black screen. Private browsing is detected up front, once, instead of
  throwing on your first purchase.
- **DEV TOOLS → Wipe save**, for seeing what a first boot looks like.

Settings deliberately stay in their own key, where they already lived. Two
sources of truth for FOV would have been decided by module import order.

### Eat it raw

§13 has been sitting there with `F` bound to nothing since the first build.

- **Catching the Black Rabbit now leaves you holding it.** You get the coins and
  the carcass. Nothing explains this.
- **`F` eats it. −35 HP.** For 45 seconds: +60% move speed, sprint drain cut by
  70%, lunge reach +40%. Eating another while buffed extends the timer and
  **doubles** the cost — 35, then 70, then 140.
- **The screen desaturates**, but does not blur. You are faster and you can see
  further; you are not impaired. The cool shift is what makes it read as wrong.
- **Whispers.** The only sustained sound in `Sfx.js` — three bandpass layers on
  one noise source, each swept by an LFO at a rate sharing no divisor with the
  others, so they drift and never settle into a pitch you could hum or a rhythm
  you could count. Mid-band, where nothing else in the game lives. The third of
  a day narrows Q and lifts the top layer: nearly words, never words.
- **It ends on a hard cut**, not a fade. The silence is the point.
- The game never comments. No tutorial line, no confirmation, no achievement.
  Dying cancels it outright, so it cannot follow you into the cell.

### The day

§2 asked for a five-minute day since the first draft. The HUD has said `DAY 1`
that whole time and nothing ever changed it.

- **A day is five real minutes**, then night falls and stays. §2 is explicit that
  night is untimed: the day is the pressure, the night is what you do with it.
- **The light goes in the last 65 seconds**, on a quadratic — so it goes
  suddenly, the way it actually does. The horizon warms before it darkens.
- **Dusk is a second axis in `Sky`, not a repaint of the storm.** The two are
  applied in series, because a storm at four in the afternoon and a storm at
  nightfall are different skies and blending one into the other would make the
  boss fight look like evening.
- **Sleep at the cooking table to end the night.** The table lost its purpose
  when the Tenderiser moved to the Stranger; this is it earning the slot back.
- **Waking restocks the field**, and not identically: the count drifts up with
  the day number and the mix reaches further into the rarer types. Gentle on
  purpose — §2 wants thirty days of content, so day 30 should feel richer than
  day 1, not unrecognisable.
- **The Black Rabbit is now the coin flip §13 asks for** — max one per day, ~18%.
  Day one still guarantees it, because a mechanic nobody has met cannot be
  judged. After that, its absence is what makes it worth seeing.
- The clock keeps running through conversations and through the fifteen-second
  death hold. Standing in the WASTED screen is already part of your day.

### The wardrobe

§7 has specified sell-back since the first draft, and `valueOf()` has computed
`baseValue * (1 - float) * 0.55` for just as long without a single caller.

- **A clothing rack**, west of the chests, facing the table. One rack, three
  rails — not three racks, which would have put three interaction radii inside a
  two-metre span, the mistake the chests already had to be spread out to fix.
- **Each hanger is painted with the skin on that weapon.** Your loadout is
  readable from across the clearing without opening anything.
- **Wear anything you own**, sorted rarest first and then least worn.
- **Sell anything for §7's price.** A Consumer returns 0–66c against a 250c
  case, which is the floor under gambling the section asks for; a Factory New
  Mil-Spec returns 495c.
- **Selling arms, then commits.** The first click turns the button red and reads
  SURE?; the second sells. It is the only destructive action in the game, and a
  dismiss-anywhere modal is exactly how you sell a Covert by accident.
- **You cannot sell the last skin you are wearing.** There would be nothing to
  swap onto, and none of the three weapons know how to return to bare paint —
  so the case is refused rather than papered over.
- Wearing now goes through a single `equip()`, so the weapon, the saved
  `equipped` record and the hanger can never disagree.

### The goat room

- **A 5×5 metre room** off the north-west corner: magenta carpet, lime walls,
  orange trim, cyan ceiling, and three RGB lights cycling out of phase. §8 asks
  for slot-machine lighting, and one light on a hue rotation reads as a disco
  rather than a machine.
- **Forty-four framed goats**, in four styles — oil, crayon, photograph and a
  watermarked corporate stock photo. All drawn to canvas in code: forty authored
  paintings is forty asset files for one joke. Every frame hangs slightly
  crooked, and none by the same amount. Some goats look at the camera; some look
  at you.
- **One frame is empty**, exactly as §8 says. It shows the wall through it
  rather than a blank canvas, which would read as a texture that failed to load.
  Its position is seeded, so it is always the same frame — a randomly empty
  frame is a glitch, THE empty frame is a room with a story.
- **The cheap plastic chair nobody sits in.**
- **A goat bleats every ~90 seconds**, from no visible source, and nothing in
  the game ever mentions it. It is the only sawtooth in `Sfx.js`, and the bleat
  is a 19–26 Hz vibrato rather than a pitch — far faster than any other
  wobble in the game, so it cannot be mistaken for the music.
- **The machine opens any of the three cases**, 1/2/3 to switch. The chests by
  the table stay where they are: they are the shortcut, and standing in front of
  one is what makes buying a case a physical decision.

### Six slots, and the wheel

- **The bar is six slots, 1 to 6, left to right**: glove, gun, hammer,
  toothbrush, healing shake, protein shake. It used to be four weapons with the
  two consumables sitting off to the left as badges; now it reads as one row.
- **The mouse wheel steps through them**, forward and back, wrapping at both
  ends. `Q` does the same thing and shares the same rule, rather than keeping a
  second hand-maintained order list that could drift from what you own.
- **The wheel steps over what you do not have; the number keys explain it.**
  Scrolling past a hammer you cannot afford four times a minute would be
  maddening, but pressing `3` and being told the Stranger sells one is
  information. One `slotBlocked()` answers both, so they cannot disagree.
- **Slot 5 drinks.** Hold the shake and click, or press `H` from anywhere as
  before. Drinking your last one steps you back to the glove rather than
  leaving you holding an empty hand.
- Wheel input is only captured while pointer-locked, so the wardrobe list still
  scrolls normally.

### Performance

- **Rabbit geometry and materials are now shared.** A rabbit is 19 meshes; at 22
  rabbits that was 418 `BoxGeometry` objects and 110 materials on the heap,
  nearly all byte-identical — every Cottontail haunch is the same box as every
  other Cottontail haunch, because the dimensions come from the shared `type`.
  Both are cached for the life of the page, which also stops the day rollover
  re-uploading the same twelve boxes to the GPU every morning.
- **`Rabbit.dispose()` no longer disposes geometry**, and must not: it would
  blank every other rabbit sharing that box. It was dead code until the day
  cycle started replacing the field, which is exactly when it would have bitten.

### Baking (§6)

The other half of the premise, and the reason the gun is finally worth carrying.

- **Meat is an ingredient now, not a payout.** Collecting a slab used to hand
  you coins on the spot. It goes in the satchel instead, and at the table you
  decide: sell it for what it is worth, or grind it into dough. A glove catch
  still pays cash immediately — so the two weapons are two economies.
- **Slabs remember what they came from.** A slab that does not know it was a Lop
  cannot become Lop dough, so the rabbit's type now travels with the drop.
- **Eight recipes, six locked at the start.** Locked ones are shown and greyed
  with what they want — `Day 2`, `Catch 5 Jackrabbits (2/5)`, `Catch a rabbit
  mid-binky`. A book that hides what you have not unlocked tells you nothing; one
  that lists eight doughnuts and greys six is a to-do list.
- **The Warren wants five doughs from five different rabbits**, which is why the
  requirement is a `distinct` rule rather than a count — and why its unlock
  counts only recipes that do not themselves gate on completion, or it could
  never be satisfied.
- **The fryer minigame.** Hold `E` to raise the heat, release to let the needle
  fall, keep it in the green for six seconds: PERFECT ×1.5, GOLDEN ×1.2,
  FINE ×1.0, BURNT ×0.4. It runs on real time, because `step()` is paused
  whenever an overlay holds the cursor — which is exactly when the fryer is up.
- **A counter for flour, sugar, yeast, cinnamon, glaze and sprinkles.**
- **The grinder sounds like §6.3 asks:** a hand-crank ratchet of eight
  accelerating ticks, then one square-wave honk lowpassed hard enough to sound
  like it happened in another room. Comedy, not gore. Nothing else in `Sfx.js`
  ratchets and nothing else honks.
- The table is the bakery by day and the bed at night, which is §6.1's "hub"
  finally doing something in both halves of the cycle.

### The goat, and a room you can get into

- **The goat model you added is in the room**, standing in the corner, breathing
  very slightly — a perfectly still goat in a room of goat paintings reads as one
  more painting. No collider; you can walk through it. Nothing acknowledges it.
- **The room is 7×7 at 2.9 m**, up from §8's 5×5. Built at spec size it was
  cramped in the wrong way: you could not stand far enough from a wall to see the
  goats hung on it, which is the entire content of the room.
- **You can actually get in now.** Two bugs kept you out. The room was yawed a
  flat `Math.PI`, which pointed its only doorway at the treeline — the yaw is
  derived from the room's own position now, so the door always faces the map.
  And its colliders were built in local space while the room was rotated, so the
  walls and the collision had drifted apart; the room snaps to quarter turns and
  rotates its boxes to match.
- The doorway has jambs, a lintel and a strip of carpet spilling out of it, so it
  reads as a way in rather than a hole in a lime wall.

### Fixed

- **The conversation camera could sit inside a pine.** A clear line from his face
  was being treated as a clear camera position, and a canopy cone has no bottom
  cap — so the ray slipped in under the skirt and reported nothing in the way
  while the render was a wall of leaves. Each candidate framing is now also
  probed with six short rays from the destination itself; three or more hits
  means enclosed, and the framing is demoted.

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
