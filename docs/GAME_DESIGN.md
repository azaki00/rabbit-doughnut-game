# HARE & GLAZE
### Master Design Document — v1.0

> A first-person bakery game about catching rabbits with a red glove and turning
> them into doughnuts. Cheerful pastel bakery. Screaming rabbits. Recipe cards
> that get worse the more of them you read.

---

## 0. Locked Decisions (do not re-litigate)

| # | Decision | Value |
|---|----------|-------|
| 1 | Tone | Cozy-sinister base, **absurd comedy dominant** |
| 2 | Structure | **Day cycle + multiple maps (levels)** |
| 3 | Currency | **One — Coins** |
| 4 | Gambling | Small garish **goat room**, CS-exact spinning ticket reel |
| 5 | Skins | **Cosmetic only**, swapped at a physical **clothing rack** |
| 6 | Art style | **Low-poly + lo-fi post FX** (procedural geometry, no downloaded assets) |
| 7 | Catching | **Lunge grab** — hold to wind up, release to lunge |
| 8 | Black Rabbit | **Risky power source** — eat raw for a buff at a health cost |
| 9 | First build | **Full vertical slice** — one map, everything wired |
| 10 | Rabbit audio | Procedural WebAudio **funny noises** — squeaks, honks, kazoos |
| 11 | Tech | HTML + CSS + vanilla JS + Three.js. Browser only. No build step. |

---

## 1. Design Pillars

**1. The joke covers the dread.**
Every system is presented cheerfully. The UI is pastel. The music is a music box.
The rabbits make cartoon honking noises. Nothing in the game ever acknowledges
that what you are doing is monstrous — except the recipe cards, the goat room,
and the Black Rabbit. Players who don't read anything have a silly cooking game.
Players who read everything get slowly unsettled. **Never break this by having a
character state the horror out loud.**

**2. The catch is the game.**
Baking is the reward; catching is the challenge. The lunge must feel physical —
weight, commitment, whiff-punishment. If the lunge feels good, the game works.
Everything else is scaffolding around that one interaction.

**3. Rabbits are characters, not targets.**
Lore-accurate hop locomotion. Distinct personalities per type. Each one makes an
undignified noise. The player should feel a flicker of guilt, then bake it anyway.

**4. Cosmetics are the long tail.**
Skins never affect gameplay. The chase item exists to be chased. The reel exists
to be watched. Gambling is optional and never gates progression.

**5. Everything is procedural.**
All geometry, all audio, all textures generated in JavaScript at runtime.
Zero downloaded assets. Instant load, no licensing, coherent look.

---

## 2. Core Loop

```
        +--------------------------------------------------+
        |                   DAY PHASE                      |
        |                                                  |
        |   Read orders  ->  Hunt rabbits  ->  Return to   |
        |   at counter       (lunge grab)     cooking table|
        |                                          |       |
        |                    Bake doughnuts  <--  Combine  |
        |                          |             ingredients|
        |                    Serve orders                   |
        |                          |                        |
        |                    Earn Coins                     |
        +--------------------------+-----------------------+
                                   |  (day timer expires)
        +--------------------------v-----------------------+
        |                  NIGHT PHASE                     |
        |                                                  |
        |   Chest (store)  ·  Clothing Rack (equip glove)   |
        |   Goat Room (open cases)  ·  Recipe Book (unlock) |
        |                          |                        |
        |                   Sleep -> next Day               |
        +--------------------------------------------------+
```

**Session length target:** a day is 5 real minutes. Night is untimed.
**Progression target:** ~30 days to see all content on the first map set.

---

## 3. The Player

### 3.1 Movement

| Property | Value | Notes |
|----------|-------|-------|
| Walk speed | 4.0 m/s | |
| Sprint speed | 7.2 m/s | Hold `Shift` |
| Crouch speed | 1.8 m/s | Hold `Ctrl` — reduces noise radius by 70% |
| Acceleration | 40 m/s² ground, 6 m/s² air | Snappy, not floaty |
| Friction | 10 (ground) | Quake-style |
| Jump height | 1.1 m | `Space` |
| Gravity | -22 m/s² | Heavier than real, feels better |
| Eye height | 1.65 m | 1.15 m crouched |
| FOV | 75° base -> 82° sprinting (lerp 0.2s) | |
| Sensitivity | default 0.0022 rad/px | Pointer Lock API |

### 3.2 Head Bob (required feature)

Two-axis sine bob driven by a **distance-accumulated** `bobPhase`, not by time —
so the bob stops instantly when the player stops, with no drift.

```
bobPhase += horizontalSpeed * dt
vertical  = sin(bobPhase * 2.0 * FREQ) * AMP_Y * speedRatio
lateral   = sin(bobPhase * 1.0 * FREQ) * AMP_X * speedRatio
roll      = -lateral * 0.06   // subtle camera roll into the step
```

| State | FREQ | AMP_Y | AMP_X |
|-------|------|-------|-------|
| Walk | 1.15 | 0.045 | 0.035 |
| Sprint | 1.55 | 0.075 | 0.055 |
| Crouch | 0.85 | 0.025 | 0.020 |

A landing impulse adds a one-shot downward camera dip (0.12 m, 0.25 s ease-out).
The glove viewmodel inherits the bob at **0.6x amplitude** with a **60 ms lag**,
so the hand trails the head. Sprinting swings the glove in a wider arc across the
lower-right of the screen.

### 3.3 Stamina

- Max **100**, shown as an arc under the crosshair (fades out when full).
- Sprint drain **18/s**. Lunge cost **22** flat. Jump cost **8**.
- Regen **14/s** after a **0.9 s** delay since last expenditure.
- At 0: sprint locks out, screen edges pulse, breathing SFX, hard-capped to walk
  speed until stamina reaches 30 ("second wind").
- Stamina is the entire pacing mechanism of the hunt. Rabbits are faster than
  walking and slower than sprinting — you can catch anything, but not everything.

### 3.4 Health

- Max **100**. Bottom-left, segmented pastel heart bar.
- **The only source of damage is eating a Black Rabbit raw.** No fall damage,
  no enemies, no hazards.
- Regen **1.5/s** after **12 s** without damage.
- At 0 HP: collapse, white screen, wake up in the bakery having lost **all
  uncooked rabbits** and **20% of Coins**. Skins and recipes are never lost.
  Death is embarrassing, not punishing.

### 3.5 Controls

| Input | Action |
|-------|--------|
| `W A S D` | Move |
| `Shift` (hold) | Sprint |
| `Ctrl` (hold) | Crouch |
| `Space` | Jump |
| `LMB` (hold -> release) | **Lunge grab** |
| `RMB` | Inspect glove (viewmodel spin, shows skin name + float) |
| `E` | Interact (table, chest, rack, reel, counter, door) |
| `F` | **Eat raw** (context: holding a rabbit) |
| `Tab` | Inventory |
| `R` | Recipe book |
| `Esc` | Pause / release pointer lock |
| `1-4` | Quick-select inventory slot |

---

## 4. The Red Glove

The glove occupies a **fixed, permanent inventory slot**. It can never be
unequipped, dropped, or lost — only re-skinned. It is the only tool in the game.

### 4.1 Lunge Grab

```
 HOLD LMB              RELEASE                  RESOLUTION
 --------              -------                  ----------
 Wind-up 0.15->0.45s   Forward dash 3.2 m/s     HIT:  rabbit yanked to glove,
 Glove pulls back      over 0.35s, grab arc           squeal, +1 inventory
 FOV -4 deg            active frames 0.10-0.28s MISS: stumble, 1.2s recovery
 Charge ring fills                                    lockout, -22 stamina,
 Stamina greys out                                    camera tilt, rabbits
                                                      within 12 m flee
```

- **Charge scaling:** wind-up scales grab radius **0.9 m -> 1.5 m** and dash
  distance **1.1 m -> 2.4 m**. Overcharging past 0.45 s does nothing extra —
  the ring flashes to signal max.
- **Grab arc** is a forward cone: 1.5 m reach, 70° horizontal, 50° vertical,
  originating at the glove, not the camera.
- **Whiff punishment is the core skill test.** The 1.2 s recovery is long enough
  that a missed lunge on open ground means the rabbit is gone.
- Max-charge lunge landing on a **fleeing** rabbit = **CLUTCH GRAB**: +25% coin
  value and a distinct triumphant honk.

### 4.2 Glove viewmodel

Rendered on a separate camera layer with its own near-plane so it never clips
into world geometry. Idle sway, bob inheritance, wind-up, dash thrust, grab
clench, and a "shake off" flourish after a successful catch.

---

## 5. Rabbits

### 5.1 Lore-Accurate Hop Locomotion (critical — do not simplify)

Real rabbits do not run. They **saltate**: a bounding gait where the powerful
hind legs land *outside and ahead of* the front legs, the spine flexes and
extends like a spring, and the body follows a ballistic arc between contacts.
Implement as procedural animation, not a canned loop.

**Gait cycle (normalized phase `p` in [0,1)):**

| Phase | Name | Description |
|-------|------|-------------|
| 0.00 – 0.12 | **Hind plant** | Hind feet contact together, spine at max flexion (curled), body lowest |
| 0.12 – 0.28 | **Extension / launch** | Spine snaps from flexed to extended, hind legs drive back, body accelerates up and forward |
| 0.28 – 0.62 | **Flight** | No contact. Ballistic parabola. Ears trail backward with lag. Legs tuck. Spine fully extended, then begins to gather |
| 0.62 – 0.78 | **Fore plant** | Front feet contact, one slightly before the other (asymmetric — this is what reads as *real*) |
| 0.78 – 1.00 | **Gather** | Front legs absorb and push, spine flexes, hind legs swing forward *outside* the front legs to plant ahead of them |

**Implementation rules:**
- **Vertical position** is a real parabola during flight: `y = h * 4p'(1-p')`
  where `p'` is the normalized flight sub-phase. Apex scales with speed.
- **Spine flex drives everything else.** Model the body as two segments (chest,
  haunch) joined by a spine angle oscillating roughly **-25° to +18°**. The
  haunch leads; the chest follows with a small delay.
- **Ears lag.** Driven by a damped spring chasing head orientation
  (stiffness ~90, damping ~11). They flop backward on launch, forward on landing,
  and wobble on impact. **This single detail sells the whole animation.**
- **Speed scaling:** faster = longer hops more than faster hops.
  Idle hop 1.6 Hz / 0.35 m. Panic bound 3.1 Hz / 1.9 m.
- **Landing squash:** body scale Y x0.86 for 90 ms on hind plant, eased out.
- **Turning:** rabbits cannot turn mid-flight. Direction changes commit only at
  the hind plant. This is what makes them read as rabbits and what makes them
  dodgeable — learn the plant rhythm and you can predict the cut.
- **Idle behaviours** (unaware): nose twitch (8-14 Hz micro-motion on the snout),
  ear swivel toward sounds, sit-up-and-scan, graze, and a rare full-body
  **binky** — the joyful mid-air twist real rabbits do when happy.
  **The binky is the emotional trap of the game.**

### 5.2 Rabbit AI

Small state machine. Perception: vision cone **300°** (rabbits have near-
panoramic vision with a blind spot directly in front of the nose — *use this*,
head-on sneaking is viable) at 18 m, plus a hearing radius scaled by player
noise (sprint 22 m, walk 11 m, crouch 3.5 m).

| State | Behaviour |
|-------|-----------|
| `GRAZE` | Wanders slowly within a home radius, idle behaviours, occasional binky |
| `ALERT` | Freezes completely. Ears rotate to the player. 0.6–1.4 s. **Freezing is real rabbit behaviour and is the player's catch window.** |
| `FLEE` | Bounds directly away at panic speed with a **zigzag** — direction re-rolls ±35° at every hind plant |
| `EVADE` | Within 4 m: sharp 90–150° cuts on the plant, aiming for cover or a burrow |
| `BURROW` | Reached a burrow entrance -> gone for the day |
| `CAUGHT` | Flailing kick animation in the glove, panicked noise |

**Design intent:** rabbits flee *away from the player*, so the hunt is about
herding them into corners, rocks, and fences rather than out-running them in the
open. Maps are built around this.

### 5.3 Rabbit Types

Four in the vertical slice; eight in the full design.

| # | Type | Look | Speed | Behaviour | Value | Slice |
|---|------|------|-------|-----------|-------|-------|
| 1 | **Cottontail** | Small, beige, white puff tail | 5.0 m/s | Baseline, common. Panics early, tires fast (flees 6 s then grazes) | 10c | yes |
| 2 | **Lop** | Fat, cream, enormous floppy ears | 3.6 m/s | Slow and dopey. Ears drag. Trips over them ~15% of hops | 15c | yes |
| 3 | **Jack** | Long-legged, lean, grey-brown, huge upright ears | 8.4 m/s | Faster than sprint in a straight line. Must be cornered or cut off. Vision 24 m | 45c | yes |
| 4 | **Black Rabbit** | Matte black, no specular, faint red eye glow, slightly too large | 6.2 m/s | Doesn't flee — **circles** the player at 8 m and stares. Ambient audio drops out near it. Never binkies | 120c | yes |
| 5 | **Angora** | Absurd ball of fluff, legs invisible | 4.2 m/s | Rolls instead of hopping when fleeing downhill. Double dough | 35c | — |
| 6 | **Harlequin** | Two-tone split down the middle, mismatched | 6.0 m/s | Fakes direction — plays a launch animation, then cuts the opposite way | 70c | — |
| 7 | **Snowshoe** | White, oversized hind feet | 6.6 m/s | Frost map only. Near-invisible against snow; find it by sound | 85c | — |
| 8 | **The Grand Duke** | Ancient, enormous, one notched ear, carries himself like he's wearing something | 7.0 m/s | Unique. ~2%/day per map. Cannot be caught with an uncharged lunge. Unlocks the Duke's Recipe | 800c | — |

### 5.4 Rabbit Audio — the weird funny noises

**All sounds synthesized at runtime via WebAudio. No files.** Every rabbit has a
randomized `voicePitch` (0.8–1.3) and `voiceTimbre` seeded from its ID, so
individual rabbits are recognizable by sound.

| Event | Synthesis recipe |
|-------|------------------|
| **Idle chirp** | Two detuned square oscillators, 380–620 Hz, 40 ms, fast pitch ramp up. A squeaky toy having a thought |
| **Alert** | Single short "boop" — sine, sharp attack, 220 Hz, 60 ms |
| **Flee squeal** | Sawtooth, portamento 700 -> 1400 Hz over 300 ms, tremolo at 14 Hz, bandpass sweep. A rubber duck being outrun |
| **Hop grunt** | Filtered noise burst, 30 ms, one per hind plant, pitched per rabbit. In a group this becomes a comedic rhythm section |
| **Caught** | The showpiece. **Descending kazoo** — sawtooth through a resonant bandpass (Q ~14) sliding 900 -> 180 Hz over 700 ms, vibrato widening as it falls, ending in a wet "blorp" (sine drop + lowpass) |
| **Lop trip** | Comedy slide-whistle down + a small "bonk" (sine, 120 Hz, fast decay) |
| **Binky** | Ascending 3-note arpeggio, pure sine, unreasonably cheerful. **Make this genuinely lovely.** It should hurt a little to catch one right after |
| **Black Rabbit** | No voice. Instead all other audio ducks 12 dB within 15 m, and a sub-bass 42 Hz sine fades in. Its silence is the sound |
| **Grand Duke** | One dignified, absurdly low foghorn on spawn |

Comedy rule: **pitch variance is the joke.** Randomize aggressively. Six rabbits
fleeing at once should sound like a broken orchestra.

---

## 6. Baking

### 6.1 The Cooking Table

A large stone-and-wood table at the **exact centre of every map**. It is the hub;
players orbit it all day. Four visible zones — **Grinder**, **Mixer**, **Fryer**,
**Glaze station** — plus a recipe stand.

### 6.2 Ingredients

| Ingredient | Source |
|------------|--------|
| **Rabbit Dough** | Grind any rabbit. Yield and quality vary by type |
| **Black Essence** | Grind a Black Rabbit. Required by the darkest recipes |
| **Flour, Sugar, Yeast** | Bought at the counter. Consumed per bake |
| **Glaze (5 colours)** | Bought. Sets the finish and part of the value |
| **Sprinkles** | Optional. +8c flat and a small customer-happiness bonus |

### 6.3 Baking flow

1. `E` at the **Grinder** with rabbits in inventory -> dough. Cheerful hand-crank
   sound and a *very* brief muffled honk. Comedy, not gore — **no visible blood
   anywhere in the game.** Rabbits go in; dough comes out.
2. `E` at the **Mixer** -> ring menu of known recipes. Missing ingredients greyed
   out with requirements listed.
3. **Fryer minigame:** the doughnut floats in oil; a temperature needle drifts.
   Hold `E` to raise heat, release to let it fall. Keep the needle in the green
   band. Time in green over the ~6 s bake sets quality:
   - `PERFECT` (>90%) -> x1.5 value, golden sheen VFX
   - `GOLDEN` (>70%) -> x1.2
   - `FINE` (>40%) -> x1.0
   - `BURNT` (<40%) -> x0.4, blackened mesh, sad trombone
4. **Glaze station:** click to dip, free colour choice. Orders specify a colour;
   wrong colour = 60% payout.

### 6.4 Doughnut Types

| # | Doughnut | Recipe | Base value | Unlock |
|---|----------|--------|-----------|--------|
| 1 | **Plain Hopper** | 1 Cottontail dough + flour + sugar | 40c | Start |
| 2 | **Cinnamon Cottontail** | 2 Cottontail dough + cinnamon | 75c | Start |
| 3 | **Lop-Eared Long John** | 1 Lop dough (double portion) + yeast | 110c | Day 2 |
| 4 | **Jackrabbit Twist** | 1 Jack dough + 1 Cottontail dough | 190c | Catch 5 Jacks |
| 5 | **Sugar Binky** | Dough from a rabbit caught *mid-binky* | 240c | Catch a binkying rabbit |
| 6 | **Midnight Cruller** | 1 Black Essence + 2 any dough + black glaze | 420c | Catch a Black Rabbit |
| 7 | **The Warren** | 5 dough from 5 *different* rabbit types | 700c | 60% recipe book completion |
| 8 | **Duke's Old Fashioned** | Grand Duke dough. One per Duke | 1400c | Catch the Grand Duke |

Recipes 9–15 reserved for later maps (Frost, Hollow, Estate).

### 6.5 Orders

Each day the counter posts **3–6 orders**: doughnut type, glaze colour, quantity.
Filling all orders in a day = **+40% day bonus**. Unfilled orders simply expire —
no penalty beyond lost income. Non-matching doughnuts sell at 70% of value.

Customers are never shown. Orders appear on paper slips. **Their handwriting gets
worse over the campaign. This is the only "story".**

---

## 7. Economy

**One currency: Coins.** Earned only by selling doughnuts. Spent on:

| Sink | Cost |
|------|------|
| Ingredients (flour, sugar, yeast, glaze, sprinkles) | 3–20c each |
| **Case keys** (goat room) | 250c / 600c / 1500c by case tier |
| Map unlocks | 3,000c / 9,000c / 25,000c |
| Bakery upgrades (bigger chest, faster fryer, quieter boots) | 500–4,000c |

**Selling skins back:** any skin sells at the clothing rack for
`baseValue * (1 - float) * 0.55`. Closes the loop, makes duplicates useful, and
puts a floor under gambling.

---

## 8. The Goat Room

A small door behind the bakery, marked only by a hand-painted sign. Inside:

- **Walls covered floor to ceiling in framed pictures of goats.** Different
  goats, different frames, wildly different art styles — oil paintings,
  photographs, children's crayon drawings, a corporate stock photo. Some goats
  look at the camera. Some look at the player. **One frame is empty.**
- **Clashing saturated colours** — magenta carpet, lime walls, orange trim, cyan
  ceiling. Deliberately garish. Slot-machine RGB strip lighting that cycles.
- Cramped: ~5 m x 5 m, ceiling 2.4 m. Slightly too warm-looking.
- One machine in the middle. Casino carpet. A cheap plastic chair nobody sits in.
- Ambient: muffled synth loop, coin clinks, and a **goat bleat every ~90 s** with
  no visible source. Never acknowledged.

### 8.1 Case Opening — CS-exact spinning ticket reel

Replicate the Counter-Strike case animation precisely. It is the single
most-watched animation in the game.

**Structure**
- A horizontal strip of **~75 tickets**, each a fixed-width card showing the
  glove render, name, and a coloured rarity bar along the bottom edge.
- A fixed **centre marker** (vertical yellow line with arrow caps) over the strip.
- The winning item is placed at a **fixed index (68)**, decided *before* the
  animation starts. All other tickets are visual filler rolled from the case's
  rarity distribution. **The outcome is never determined by the animation.**

**Motion**
- Total duration **~6.0 s**.
- Easing: **strong ease-out**, `easeOutQuint`-like: `1 - (1-t)^5`. Extremely fast
  for the first second, then a long visible crawl for the final ~1.5 s.
- The final resting offset is randomized *within* the winning ticket so it does
  **not** land dead-centre. ~15% of the time it settles near a ticket edge,
  producing the near-miss feeling. **Essential — a perfectly centred landing
  kills the tension.**
- A **tick sound** fires each time a ticket boundary crosses the centre marker.
  As the reel decelerates the ticks stretch out naturally — the audio *is* the
  deceleration curve. Synthesized: short filtered noise click, 8 ms.
- On settle: flash, winning card scales up and slides forward, rarity-coloured
  light burst, rarity-scaled sting (higher tier = longer, richer).
- Restricted or above -> **screen-wide colour flash** and slow-motion on the
  final 0.4 s of the reel.

**Rarity tiers and odds** (mirroring CS proportions):

| Tier | Colour | Odds |
|------|--------|------|
| Consumer | Grey `#b0c3d9` | 79.92% |
| Industrial | Light blue `#5e98d9` | 15.98% |
| Mil-Spec | Blue `#4b69ff` | 3.20% |
| Restricted | Purple `#8847ff` | 0.64% |
| Classified | Pink `#d32ce6` | 0.26% |
| **Covert** | Red `#eb4b4b` | 0.20% |
| **Golden Glove** | Gold `#ffd700` | **0.026%** |

Odds are **displayed openly** on the machine. The game is honest about being a
slot machine, which is funnier and more ethical than hiding it.

### 8.2 Float / Wear

Every skin instance rolls a `float` in [0, 1], displayed with the item.

| Range | Label |
|-------|-------|
| 0.00–0.07 | Factory New |
| 0.07–0.15 | Minimal Wear |
| 0.15–0.38 | Field-Tested |
| 0.38–0.45 | Well-Worn |
| 0.45–1.00 | Battle-Scarred |

Float drives a procedural wear map on the glove: scuffing, desaturation, fraying
at the fingertips, stain darkening. Two Bloodstained Velvets look genuinely
different. **Float never affects catching.**

### 8.3 Glove Skins (initial set — 18)

| Tier | Skins |
|------|-------|
| Consumer | Faded Red · Kitchen Standard · Dishwater · Beige Regret |
| Industrial | Flour Dusted · Checkerboard · Butcher's Blue · Sunday Best |
| Mil-Spec | Bloodstained Velvet · Carrot Camo · Deep Ocean · Wired |
| Restricted | Chrome Warren · Doughnut Print · Marbled Glaze |
| Classified | Goat Pattern · Fever Dream |
| Covert | **Binky** — iridescent, faint aurora shimmer, tiny rabbits leap across the fabric when you lunge |
| Rare Special | **Golden Glove** — solid gold, animated ripple, gold afterimage trail on lunge, its own fanfare on catch |

---

## 9. World Objects

**The Chest.** A large wooden chest with a visible open lid, beside the cooking
table — **always visible in the world**, never a pure menu. Stores rabbits,
dough, and doughnuts beyond the carry limit (6 slots + the fixed glove slot).
Opening plays a physical creak and shows contents as low-poly objects actually
sitting inside the chest mesh.

**The Clothing Rack.** A wooden rack near the bakery entrance with gloves hanging
on hooks. **Owned skins physically appear on the rack** — it visibly fills up
over the campaign, which is its own progress bar. Walk up, `E`, radial selector;
the chosen glove is physically taken off the hook with a first-person
pulling-the-glove-on animation. Right-click a hanging glove to inspect float and
name, or sell it.

**The Counter.** Posts orders, sells doughnuts, sells ingredients.

**The Recipe Book.** Bound in something the game never names. Unlocked recipes
show a photograph, ingredient list, and a short flavour note. **The flavour notes
are where the horror lives** — cheerful, domestic, and slightly wrong.

---

## 10. Maps

Each map is self-contained: bakery, cooking table, chest, rack, goat room, plus a
distinct hunting ground.

| # | Map | Theme | Rabbits | Terrain hook | Unlock |
|---|-----|-------|---------|--------------|--------|
| 1 | **Meadow** | Sunny pastel field, wooden fences, a windmill | Cottontail, Lop, Jack, Black | Open. Fences and rock clusters as natural corners. Teaches herding | Start |
| 2 | **Frost Hollow** | Snowfield, pines, frozen pond | + Snowshoe, Angora | Snow slows sprint. Ice sends rabbits sliding. White-on-white camouflage | 3,000c |
| 3 | **The Hollow** | Dense dark woodland, fog, hanging lanterns | + Harlequin | Low visibility. Black Rabbit rate x3. Sound matters more than sight | 9,000c |
| 4 | **Duke's Estate** | Overgrown manor gardens, hedge maze, statuary | All, + Grand Duke | Hedge maze creates natural dead-ends. Highest value, hardest catches | 25,000c |

---

## 11. UI

Pastel, rounded, hand-lettered. Diegetic where possible. The HUD stays
understated so the world stays visible.

```
+--------------------------------------------------------+
|  DAY 7                                    (sun) 03:41   |  <- top-centre
|                                                        |
|  ORDERS                                                |  <- top-left, small
|  > 2x Cinnamon Cottontail  (pink)                      |
|  > 1x Midnight Cruller     (black)                     |
|                                                        |
|                                                        |
|                          .                             |  <- crosshair (a dot)
|                        (   )                           |  <- stamina arc below
|                                                        |
|                                                        |
|                                              +-------+ |
|  [#######...]  HEALTH                        | glove | |  <- viewmodel
|                                              +-------+ |
|  (o) 1,240 c      [R][R][ ][ ][ ][ ]  ||[GLOVE]||      |  <- inv + fixed slot
+--------------------------------------------------------+
```

- **The glove slot is visually separated** by a heavier border and sits apart
  from the six general slots — it reads as permanent and non-removable.
- Health bar only appears when damaged, or for 5 s after healing.
- Stamina arc fades out entirely at full.
- The lunge charge ring draws around the crosshair dot.
- Black Rabbit proximity: the whole HUD desaturates and the crosshair jitters.

---

## 12. Post-Processing

| Effect | Setting |
|--------|---------|
| Render scale | 0.85 internal, upscaled — slight softness, big perf win |
| Fog | Exponential, colour matched per map |
| Film grain | Subtle, animated, 0.035 intensity |
| Vignette | 0.28, warm-tinted |
| Colour grade | Per-map curve. Meadow = lifted pastel, Hollow = crushed blue |
| Bloom | High threshold — only the sun and gold/covert skins bloom |
| **Black Rabbit proximity** | Desaturation ramp (to 25% at 8 m), chromatic aberration, slow radial screen warp |
| **Raw Black buff active** | Full desaturation + inverted vignette + slight barrel warp, over 45 s |

---

## 13. The Black Rabbit (full spec)

The keystone of the game's tone.

- **Spawn:** max 1 per day, ~18% chance on Meadow. Announced only by the ambient
  audio ducking out. There is no on-screen warning.
- **Behaviour:** does not flee. Circles the player at 8 m, always facing them. If
  the player looks away and back, it will be closer. It never hops toward the
  player while observed. It makes no sound. It never binkies.
- **Catching it is easy — it lets you.** The challenge is that catching it is a
  decision, not a skill test.

**Then the player chooses:**

| Option | Result |
|--------|--------|
| **Bake it** (Midnight Cruller) | 420c. Safe. The recipe card's flavour text changes each time you bake one |
| **Eat it raw** (`F`) | **-35 HP.** For 45 s: +60% move speed, stamina drain -70%, lunge range +40%, and time appears to slow slightly during wind-up. Screen desaturates. Faint layered whispers (synthesized filtered noise, no words). Ends with a hard cut to silence for 1.5 s |

Eating a second while buffed extends the buff but **doubles** the health cost.
Three in one day: the whispers become almost intelligible. There is no reward for
this. **The game never comments on it.**

---

## 14. Save Data

`localStorage`, single key `hareandglaze.save.v1`, JSON.

```jsonc
{
  "version": 1,
  "day": 7,
  "coins": 1240,
  "currentMap": "meadow",
  "unlockedMaps": ["meadow"],
  "unlockedRecipes": ["plain_hopper", "cinnamon_cottontail", "lop_long_john"],
  "equippedSkin": "inst_8f2a",
  "skins": [
    { "id": "inst_8f2a", "skin": "bloodstained_velvet", "float": 0.041 }
  ],
  "chest": { "cottontail": 3, "dough_jack": 1, "doughnut_plain": 2 },
  "stats": { "caught": {}, "baked": {}, "casesOpened": 12, "binkiesSeen": 4 },
  "settings": { "sensitivity": 0.0022, "fov": 75, "volume": 0.8 }
}
```

Autosave on: day end, case open, skin equip, purchase, map change.

---

## 15. Technical Architecture

**Stack:** HTML5 + CSS + vanilla ES modules + Three.js (CDN import map).
No bundler, no framework, no build step. Runs from any static host.

### 15.1 File structure

```
_game/
├─ index.html                 # canvas, HUD DOM, import map
├─ styles/
│  ├─ hud.css                 # in-world HUD
│  ├─ menus.css               # inventory, recipe book, shop
│  └─ case.css                # goat room reel (DOM-based, not WebGL)
├─ src/
│  ├─ main.js                 # bootstrap, loop, phase manager
│  ├─ core/
│  │  ├─ Engine.js            # renderer, scene, camera rig, resize
│  │  ├─ Time.js              # fixed-step accumulator + interpolation
│  │  ├─ Input.js             # pointer lock, keybinds, action map
│  │  └─ Save.js              # localStorage schema + migration
│  ├─ player/
│  │  ├─ Controller.js        # movement, collision, sprint, crouch, jump
│  │  ├─ HeadBob.js           # distance-driven bob + landing dip
│  │  ├─ Stamina.js
│  │  ├─ Health.js
│  │  └─ Glove.js             # viewmodel, lunge state machine, grab query
│  ├─ rabbits/
│  │  ├─ Rabbit.js            # entity
│  │  ├─ HopGait.js           # * procedural saltation animation
│  │  ├─ RabbitAI.js          # perception + state machine
│  │  ├─ RabbitMesh.js        # procedural low-poly body builder
│  │  └─ types.js             # the 8 type definitions
│  ├─ baking/
│  │  ├─ CookingTable.js
│  │  ├─ Recipes.js
│  │  ├─ FryerMinigame.js
│  │  └─ Orders.js
│  ├─ economy/
│  │  ├─ Coins.js
│  │  ├─ Skins.js             # catalogue, rarity, float rolling
│  │  ├─ CaseReel.js          # * CS-exact reel (DOM + CSS transform)
│  │  └─ Rack.js
│  ├─ world/
│  │  ├─ MapLoader.js
│  │  ├─ maps/meadow.js       # procedural level definition
│  │  ├─ GoatRoom.js
│  │  ├─ Chest.js
│  │  └─ Props.js             # procedural mesh library
│  ├─ audio/
│  │  ├─ AudioEngine.js       # WebAudio graph, buses, ducking
│  │  ├─ RabbitVoice.js       # * the funny noises
│  │  ├─ Sfx.js               # ticks, footsteps, UI, fryer
│  │  └─ Music.js             # procedural music box
│  ├─ fx/
│  │  ├─ PostFX.js            # grain, vignette, grade, aberration
│  │  └─ BlackRabbitFX.js
│  └─ ui/
│     ├─ Hud.js
│     ├─ Inventory.js
│     ├─ RecipeBook.js
│     └─ Shop.js
└─ docs/
   └─ GAME_DESIGN.md          # this file
```

### 15.2 Key technical decisions

- **Fixed timestep** of 1/60 for physics and gait; render interpolates.
  Guarantees the hop animation is frame-rate independent.
- **Collision:** capsule vs AABB/heightfield, hand-rolled. No physics library —
  the game needs nothing a real engine would provide.
- **Rabbits use InstancedMesh** for shared body parts. Target 40 rabbits at
  60 fps on integrated graphics.
- **The case reel is DOM + CSS `transform: translateX`**, not WebGL. Far easier
  to match CS exactly, and it costs nothing to render.
- **All audio synthesized.** `AudioEngine` owns one `AudioContext` with buses for
  `master / world / voice / ui / music` and a compressor on master. Rabbit voices
  route through `voice` so the Black Rabbit can duck them.
- **Object pooling** for rabbits, doughnuts, particles. No per-frame allocation
  in the hot loop.

---

## 16. Build Milestones

**M1 — Feel** *(must be fun before anything else)*
Engine, fixed-step loop, pointer lock, movement, sprint, crouch, jump, head bob,
stamina, a greybox map, and the glove lunge against a single dumb Cottontail.
*Gate: is the lunge satisfying? If not, iterate here and nowhere else.*

**M2 — Rabbits**
Full `HopGait` saltation cycle, ear springs, AI state machine, perception, four
rabbit types, procedural meshes, `RabbitVoice` funny noises.
*Gate: does a field of six fleeing rabbits make you laugh?*

**M3 — Bakery**
Cooking table, grinder, mixer, fryer minigame, glaze, six doughnuts, recipe book,
orders, counter, coins, chest.

**M4 — Economy and Goat Room**
Skins catalogue, float, case reel with exact CS easing and ticks, goat room
build, clothing rack with physical gloves, sell-back.

**M5 — Polish**
Post FX, Black Rabbit full behaviour and raw-eat buff, HUD pass, procedural
music, Meadow art pass, localStorage saves, settings menu.

**M6 — Content**
Maps 2–4, rabbits 5–8, doughnuts 7–15, day-cycle progression tuning.

---

## 17. Things That Must Not Be Compromised

1. The hop gait is procedural saltation with spine flex and lagging ears — not a
   looping bounce.
2. Rabbits commit to direction only at the hind plant.
3. The lunge has a real whiff penalty.
4. The case reel uses ease-out quintic, ~6 s, ticks per ticket, and an
   off-centre landing.
5. Skins are cosmetic. Always.
6. The glove slot is fixed and can never be emptied.
7. No blood, ever. The horror is tonal, never visual.
8. The game never comments on what the player is doing.
9. The binky sound is genuinely lovely.
10. There is one empty picture frame in the goat room.
