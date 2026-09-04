# Architecture

A map of the codebase for anyone picking it up cold. For *what the game is*, read
`README.md`. For *why it is that way*, read `docs/GAME_DESIGN.md` — the source
files cite its section numbers (`§5.1`, `§8.1`) rather than repeating its reasoning.

---

## Ground rules

Four constraints shape every file here. Break them and things start failing in
non-obvious ways.

**1. No build step.** Plain ES modules, Three.js from a CDN import map in
`index.html`. There is no bundler, no transpiler, no `package.json` for the game
itself. Edit a file, reload the page.

**2. Fixed timestep.** Simulation runs at a locked 60 Hz (`core/Time.js`).
Never read `performance.now()` inside game logic — take the `dt` you are handed.
The rabbit gait in particular is only frame-rate independent because of this.

**3. Almost everything is generated.** Audio is synthesized through WebAudio at
runtime — the sole exception is `assets/audio/shotgun.mp3`, and even that has
a synthesized fallback. Rabbits, the cooking table, fences, rocks, the gun, the
hammer and the ground texture are all built in code. Downloaded models are used
only where `OBJECTS/` actually has one (see *Assets* below).

**4. Assets are optional.** Every model load goes through `world/Loaders.js`,
which resolves to `null` on failure rather than throwing. Every caller has a
procedural fallback. A missing file degrades the visuals; it never breaks the
level.

---

## Directory layout

```
index.html            canvas, HUD markup, import map — the only HTML file
styles/
  hud.css             in-world HUD: reticle, stamina, health, slots
  case.css            case reel, boss bar, shell pips, settings, prompts
src/
  main.js             composition root and the game loop
  core/               engine plumbing, no game rules
  player/             everything the player directly controls
  rabbits/            the hunted
  world/              the level and the things standing in it
  economy/            skins, rarity, float
  audio/              synthesis
  ui/                 DOM overlays
OBJECTS/              3D models (see Assets)
docs/GAME_DESIGN.md   the design bible
```

---

## The loop

`src/main.js` is the composition root: it constructs every system, wires the
callbacks between them, and owns the frame loop. Systems do not import each
other — `main.js` connects them. If you need two subsystems to talk, add a
callback property and wire it there rather than importing across folders.

```
frame()                                    ← requestAnimationFrame
 ├─ time.tick(step)                        ← runs step() 0..5 times at 1/60
 │   └─ step(dt)
 │       ├─ player.look() / update()       ← only while pointer-locked
 │       ├─ weapon update (glove|gun|hammer)
 │       ├─ rabbit.update() for each
 │       ├─ boss.update()
 │       ├─ chest / pickups / prompts
 │       └─ input.endStep()                ← clears per-step edges
 ├─ player.applyToCamera()
 ├─ hud.update()
 └─ engine.render()
```

Two rules that matter:

- **`input.endStep()` must be last in `step()`.** It clears `pressed`, `lmbDown`,
  `lmbUp` and the accumulated mouse delta. Anything reading an edge after that
  call misses it.
- **Rendering never mutates simulation state.** `frame()` after `time.tick` is
  read-only with respect to game logic.

---

## `core/` — engine plumbing

| File | Responsibility |
|---|---|
| `Engine.js` | Renderer, scene, fog, lights, and the **two-camera rig** |
| `Time.js` | Fixed-step accumulator, capped at 5 catch-up steps |
| `Input.js` | Pointer lock, keybind→action map, held vs edge state |

### The two-camera rig — the one thing that surprises people

Viewmodels (glove, gun, hammer) live in a **separate scene** (`engine.vmScene`)
rendered by a **separate camera** (`engine.vmCamera`) with a tiny near-plane, so
they can never clip into world geometry. `Engine.render()` draws the world,
clears depth, then draws the viewmodel on top.

**Three.js layer-filters lights exactly like meshes.** A light on layer 0 is not
even collected for a camera rendering layer 1, and your viewmodel renders pure
black with no error. Every viewmodel object *and* every viewmodel light must call
`.layers.set(LAYER_VIEWMODEL)`. This has already cost one debugging session.

---

## `player/`

| File | Responsibility |
|---|---|
| `Controller.js` | Quake-style movement, collision, crouch/sprint, camera |
| `HeadBob.js` | Distance-driven bob and landing dip |
| `Stamina.js` | Sprint/lunge/jump budget, exhaustion and second wind |
| `Glove.js` | The lunge grab state machine + viewmodel (§4) |
| `Gun.js` | Hitscan, recoil, unlimited ammo |
| `Hammer.js` | Slow melee swing; the only thing that cracks the egg |

**Head bob is driven by accumulated distance, not elapsed time** (§3.2). This is
deliberate and load-bearing: a time-driven bob keeps oscillating after the player
stops and drifts out of step with footfalls. `bobPhase += speed * dt`.

**Weapons never resolve their own hits.** `Glove.onGrab`, `Gun.onShoot` and
`Hammer.onImpact` are callbacks that `main.js` assigns. The weapon knows about
timing, animation and feel; `main.js` knows what is in the world. Keep it that
way — it is why adding the boss did not require touching `Glove.js`.

---

## `rabbits/`

| File | Responsibility |
|---|---|
| `types.js` | The 8 rabbit definitions — one parameterised builder drives all |
| `RabbitMesh.js` | Builds the transform hierarchy (the "rig") |
| `HopGait.js` | **Procedural saltation** — the heart of the game |
| `Rabbit.js` | Entity: perception, AI state machine, posing |

### The gait

`HopGait` is the single most important file in the project and the one to
understand before changing anything about rabbits. It implements real rabbit
bounding locomotion (§5.1): five phases, spine flexing −25°→+18°, a genuine
ballistic parabola between contacts, hind feet planting *outside and ahead of*
the front feet.

It exposes `onPlant`, fired the instant the hind feet contact. **This is the only
moment a rabbit may change direction.** `RabbitAI` proposes a heading; the gait
decides when it takes effect. That single constraint is what makes rabbits read
as rabbits and what makes them learnably dodgeable.

The rig is a plain `THREE.Group` hierarchy, not a `SkinnedMesh`. The gait needs
exact, direct control of every joint, and hand-built transforms are far easier to
reason about than skin weights.

```
root → carriage → haunch → chest → neck → head → ear.L/R (3 bones each)
                    ↳ hind legs        ↳ fore legs
```

Ears are damped springs chasing head orientation. They flop backward on launch
and forward on landing. Do not remove this — it is most of what sells the
animation.

---

## `world/`

| File | Responsibility |
|---|---|
| `Greybox.js` | The meadow: ground, cooking table, fences, rocks, trees |
| `Loaders.js` | Model loading, scale normalisation, graceful failure |
| `Chest.js` | Case-opening chest beside the table (§9.1) |
| `Pickups.js` | Hidden coins |
| `Carrots.js` | The hamster trader, and the carrots that freeze rabbits in place |
| `Horses.js` | Four wild horses. Mount with E, ride for 4s, get thrown |
| `EggBoss.js` | The Sunny-Side Sovereign — sealed shell phase and the boss itself |

### Riding

`Horses.updateRide()` is called **instead of** `Controller.update()` while
mounted (see `step()` in `main.js`). The horse owns the movement; the player is
written to its saddle position each step and their velocity is zeroed. Weapons
are neither updated nor drawn while mounted. `Horses.buck()` hands control back
by calling `player.stumble()` and then launching `player.vel` — in that order,
since `stumble()` damps whatever velocity it finds.

### The boss's two models

The Sovereign has two meshes and swaps between them exactly once.
`EggWithShell/model.obj` is the sealed phase you hammer, with procedural crack
lines that light up one per blow; `_revealSovereign()` hides it, bursts a shower
of shell shards, and shows `eggSunnysideUp.obj` underneath. That second model
**must** be loaded with `mtl: true` — without the MTL both of its material
groups collapse to one default white and the yolk is not yellow. `EggBoss`
then forces the two colours explicitly by material name.

### Collision

Deliberately primitive: a flat ground plane plus a list of axis-aligned boxes
(`world.colliders`). `resolveHorizontal(pos, radius)` pushes a point out along
the shallowest axis. There is no physics library and the game does not need one.
`groundHeight(x, z)` returns 0 today; make it a heightfield if terrain ever
arrives, and everything above keeps working.

### Loading models

`loadModel(url, opts)` normalises scale, because nothing in `OBJECTS/` shares a
unit or an up-axis:

- `{ height: n }` — fit so the model is `n` tall
- `{ maxSize: n }` — fit so its **largest** dimension is `n`
- `{ mtl: true | 'path/to.mtl' }` — load OBJ materials (needed for textures)
- `{ recolor: { MaterialName: 0xRRGGBB } }` — remap specific materials
- `{ brighten: n }` — scale all material colours

Two further traps: a **shared `MTLLoader` is unsafe across concurrent loads**
(`setPath` mutates it, so one model's resource path clobbers another's — this
turned the Cottage black), and several packs ship **near-black materials**, so
`prepare()` applies a luminance floor of 0.20 to untextured ones.

Use `maxSize` for anything wide and flat. Fitting the fried egg by height alone
scaled it to 47 m across, which is how that option came to exist.

**Watch for metalness.** These scenes have no environment map, so a material with
high `metalness` reflects nothing and renders **black**. Keep metalness ≤ 0.3 and
fake the sheen with `emissive`. This bit the coins, the gun and the hammer.

### The boss

State machine: `SHELL → SUMMONING → CHASE ⇄ SLAM/SPIT → DYING → DEAD`.

While `SHELL`, it is inert and immune — `hit()` returns 0 and plays a ping. Only
`hammer()` decrements the shell, and only after the player has bought The
Tenderiser for 1000 coins at the cooking table. Six blows summon the Sovereign.
Difficulty scales off `rage` (`1 - healthRatio`) rather than discrete phases.

---

## `economy/` and `ui/`

`economy/Skins.js` holds the catalogue, the CS-proportioned rarity table and
float rolling. `valueOf()` is the sell-back price. Skins are **cosmetic only**
(§17.5) — nothing here may ever touch a gameplay number.

`ui/CaseReel.js` is **DOM + CSS transforms, not WebGL**, because it is far easier
to match the Counter-Strike reel exactly in DOM and costs nothing to render. The
winner is chosen *before* the animation and placed at a fixed index; filler
tickets are decoration. Motion is `easeOutQuint` over 6 s, one tick sound per
ticket boundary crossing the marker — so the audio *is* the deceleration curve —
and it lands deliberately off-centre, because a perfectly centred stop kills the
near-miss feeling.

`ui/Settings.js` persists to `localStorage` and pushes changes through a single
`onChange(values)` that `main.js` applies. `ui/Hud.js` is a thin binding layer:
it reads a plain state object each frame and touches the DOM. No game logic.

---

## `audio/`

`AudioEngine.js` owns one `AudioContext` with buses `world / voice / ui / music`
into a compressor. It must be started from a user gesture. `duck()` is how the
Black Rabbit silences the world.

`AudioEngine` also decodes a small set of recorded samples (`_loadSamples`);
`assets/audio/shotgun.mp3` is currently the only one, and `Sfx.gunshot()`
falls back to its synthesized version if the file is unavailable. Everything
else is generated.

`RabbitVoice.js` and the rest of `Sfx.js` are pure synthesis. **Read the design rule at the
top of `Sfx.js` before adding a sound.** An earlier pass made nearly everything a
band-passed noise burst with a ~150 ms decay, and every action ended up sounding
identical. New sounds must differ in **source** (noise vs oscillator),
**register** (own a frequency band) and **envelope** (click vs thump vs ring vs
swell).

---

## Assets

`OBJECTS/` holds downloaded models. `docs/ASSETS.md` records what each one is and
what it is used for. Two things worth knowing up front:

- **The rigged "rabbit" models are bipedal humanoid characters** — Quaternius
  cartoon bunny *people* with shoulders, arms and fingers. They cannot do
  quadruped locomotion. The hunted rabbits are procedural for this reason. The
  humanoids are earmarked for bakery NPCs.
- **Zips in `ZIPPED/` are gitignored.** The extracted files are what the game
  loads.

---

## Debugging

- **`F1`** toggles the in-game readout: speed, stamina, bob phase, weapon state,
  nearest rabbit with its gait phase, boss state, coins.
- **`window.GAME`** exposes every system (`player`, `glove`, `gun`, `hammer`,
  `boss`, `chest`, `reel`, `pickups`, `rabbits`, `world`, `settings`, `THREE`).
  Drive the camera, teleport, spawn, or pose rabbits from the console.
- Serve over HTTP — ES modules will not load from `file://`:
  `python -m http.server 8177`
- After editing, **hard-reload** (`Ctrl+Shift+R`). Module caching will otherwise
  serve you a stale file and a confusing error.

---

## Where things are likely to go next

`docs/GAME_DESIGN.md` §16 has the milestone plan. The next substantial piece is
the bakery (grinder, mixer, fryer minigame, orders, doughnuts), which is where
the Kenney doughnut models finally get used. The cooking table already exists in
`Greybox.js` with four station markers waiting to become interactables, and the
purchase prompt there is already a working template for that interaction.
