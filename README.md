# 🧤 Hare & Glaze

> A first-person baking game about catching rabbits with a red glove and turning
> them into doughnuts.
>
> Warm pastel bakery. Screaming rabbits. Recipe cards that get worse the more of
> them you read.

Runs in the browser. No install, no build step, no downloads. Plain HTML, CSS,
JavaScript and Three.js.

---

## Play it

ES modules will not load from `file://`, so serve the folder over HTTP:

```bash
git clone <this-repo>
cd _game
python -m http.server 8177
```

Then open **<http://localhost:8177>** and click **CLICK TO PLAY**.

Any static server works — `npx serve`, `php -S localhost:8177`, VS Code Live
Server. Chrome or Edge recommended.

---

## Controls

| Key | Action |
|---|---|
| `W` `A` `S` `D` | Move |
| `Shift` | Sprint — drains stamina |
| `Ctrl` | Crouch — cuts your noise radius by 70% |
| `Space` | Jump |
| **Hold `LMB` → release** | **Lunge grab** |
| `1` / `2` / `3` | Glove / Gun / Hammer |
| `Q` | Cycle weapon |
| `E` | Interact — buy at the table, open cases at the chest |
| `F1` | Debug readout |
| `Esc` | Settings |

---

## The loop

**Catch rabbits → bake doughnuts → earn coins → gamble them on glove skins.**

The lunge is the whole game. Hold the left mouse button to wind up — the charge
ring fills around the crosshair, your field of view pulls in, and the glove draws
back. Release and you lunge forward with the glove outstretched.

Charging longer extends your reach from 0.9 m to 1.5 m. **Miss and you stumble
for 1.2 seconds** while every rabbit within 12 m bolts. That whiff penalty is the
skill test; everything else is scaffolding around it.

Land a fully-charged lunge on a fleeing rabbit and you get a **CLUTCH GRAB** —
25% more coins and a triumphant honk.

---

## Rabbits

They do not run. They **bound**.

The locomotion is procedurally animated saltation, built from how rabbits
actually move: the spine flexes and extends like a spring, the body follows a
real ballistic arc between contacts, and the powerful hind legs plant *outside
and ahead of* the front feet. The ears are damped springs that flop backward on
launch and forward on landing.

The rule that matters when you are hunting: **a rabbit can only change direction
at the moment its hind feet plant.** Learn the rhythm and you can read the cut
before it happens.

They also freeze when alerted — which is real rabbit behaviour, and is your catch
window. And they have near-panoramic vision with a blind spot directly in front
of the nose, so sneaking up head-on genuinely works.

| Rabbit | Speed | Behaviour | Value |
|---|---|---|---|
| **Cottontail** | 3.4 m/s | Panics early, tires quickly | 10c |
| **Lop** | 2.4 m/s | Slow, dopey, trips over its own ears | 15c |
| **Jack** | 6.0 m/s | Fast and long-legged. Corner it | 45c |
| **Black Rabbit** | 4.2 m/s | Doesn't flee. Circles you at 8 m and stares | 120c |

### The Black Rabbit

It makes no sound. When it is near, the rest of the world's audio ducks away and
the colour drains out of the fog. It doesn't run — it circles at 8 m, always
facing you, and if you look away and back it will be closer.

Catching it is easy. It lets you. The difficulty is that catching it is a
decision rather than a skill test — and then you have to decide whether to bake
it, or eat it raw.

---

## The gun

**The Culling Piece** is deliberately the *worse* way to take a rabbit:

- shot meat is **ruined** — worth 45% of a clean catch
- the report carries **40 m** and empties the field
- it has unlimited ammo, so it is always the lazy option and never the good one

It exists for the rabbit you cannot corner, and for the boss.

---

## 🥚 The Sunny-Side Sovereign

A giant egg sits inert in the south-east corner of the meadow. Nothing you own
can hurt it. Shoot it and the bullets ping off.

To start the fight you have to:

1. **Earn 2000 coins**
2. **Buy The Tenderiser** at the cooking table (`E`)
3. **Crack the shell** — six good hammer blows

Then the Sovereign is summoned, and it is extremely awake. It chases, it slams
with a telegraphed ground pound, and past a certain point it starts throwing
yolk. It gets faster and hits harder the more damage it has taken. The yolk is
its weak point, worth 2.2× damage.

It is the only thing in the game that can meaningfully hurt you.

---

## Glove skins

Straight out of the Counter-Strike playbook, and honest about it.

The chest sits beside the cooking table. Cases cost **250c** and open with a
horizontal spinning ticket reel: six seconds, quintic ease-out, a tick each time
a ticket crosses the marker so the audio *is* the deceleration curve, and a
deliberately off-centre landing so near-misses feel like near-misses.

**19 skins across 7 rarity tiers**, with a wear/float value so no two drops are
identical — a Factory New Bloodstained Velvet at 0.041 is a different item from a
Battle-Scarred one. The odds are shown openly on the machine.

| Tier | Odds |
|---|---|
| Consumer | 79.92% |
| Industrial | 15.98% |
| Mil-Spec | 3.20% |
| Restricted | 0.64% |
| Classified | 0.26% |
| Covert | 0.20% |
| ★ **Golden Glove** | **0.026%** |

**Skins are cosmetic. Always.** The glove's catching stats never change —
otherwise gambling becomes mandatory and the game becomes a grind.

There are also **28 coins hidden** around the meadow, tucked behind rocks, along
the blind sides of fences, under the cooking table, and out in the far corners.

---

## Almost everything is generated

Apart from a single recorded shotgun sample, every sound is synthesized with
WebAudio at runtime: the rabbits' squeaks and honks, the descending resonant kazoo when you
catch one, the three-note arpeggio when a rabbit does a happy binky, the
gunshot's crack and rolling tail, the reel ticks.

Each rabbit gets a pitch seeded from its ID, so a field of six fleeing at once
sounds like a broken orchestra.

The rabbits themselves are built from primitives in code — one parameterised
builder produces every type — as are the cooking table, the gun, the hammer, the
fences and the rocks. The ground texture is drawn to a canvas at load time in
two layers, so the tiling never becomes obvious at distance.

---

## Built with

- **Three.js** r169 via CDN import map — no bundler, no `npm install`
- **WebAudio** for all sound
- **Pointer Lock API** for mouse look
- **localStorage** for settings
- Vanilla ES modules. Edit a file, reload the page.

---

## Documentation

| Document | What it is |
|---|---|
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | Codebase map. Start here to contribute |
| **[docs/GAME_DESIGN.md](docs/GAME_DESIGN.md)** | The design bible — every system, and why |
| **[docs/ASSETS.md](docs/ASSETS.md)** | Every model in `OBJECTS/` and its role |

---

## Status

Playable vertical slice. Movement, the lunge, rabbit AI and locomotion, the gun,
the hammer, the boss fight, hidden coins, case opening and settings are all in.

**Not yet built:** the baking half — grinder, mixer, fryer minigame, recipes and
customer orders — plus the goat room, the clothing rack, and maps 2 through 4.
See `docs/GAME_DESIGN.md` §16 for the plan.

---

## Credits

3D models in `OBJECTS/` are free assets from **Quaternius**, **Kenney**, and
**Poly by Google**, plus individual creators credited in their folder names.
See `docs/ASSETS.md`.

No rabbits were harmed. They were, however, thoroughly baked.
