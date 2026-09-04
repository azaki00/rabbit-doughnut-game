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

| Key                      | Action                                               |
| ------------------------ | ---------------------------------------------------- |
| `W` `A` `S` `D`          | Move                                                 |
| `Shift`                  | Sprint — drains stamina                              |
| `C`                      | Crouch — cuts your noise radius by 70%               |
| `Space`                  | Jump                                                 |
| **Hold `LMB` → release** | **Lunge grab**                                       |
| `1` `2` `3` `4`          | Glove / Gun / Hammer / Toothbrush                    |
| `Q`                      | Cycle weapon                                         |
| `E`                      | Interact — talk, mount a horse, buy, open a case     |
| `B`                      | Buy a healing shake (at the clinic)                  |
| `H`                      | Drink a carried shake                                |
| `G`                      | Drop a carrot                                        |
| `R`                      | Reload                                               |
| `F1`                     | Debug readout                                        |
| `Esc`                    | Settings                                             |

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
real ballistic arc between contacts, and the powerful hind legs plant _outside
and ahead of_ the front feet. The ears are damped springs that flop backward on
launch and forward on landing.

The rule that matters when you are hunting: **a rabbit can only change direction
at the moment its hind feet plant.** Learn the rhythm and you can read the cut
before it happens.

They also freeze when alerted — which is real rabbit behaviour, and is your catch
window. And they have near-panoramic vision with a blind spot directly in front
of the nose, so sneaking up head-on genuinely works.

| Rabbit           | Speed   | Behaviour                                   | Value |
| ---------------- | ------- | ------------------------------------------- | ----- |
| **Cottontail**   | 3.4 m/s | Panics early, tires quickly                 | 10c   |
| **Lop**          | 2.4 m/s | Slow, dopey, trips over its own ears        | 15c   |
| **Jack**         | 6.0 m/s | Fast and long-legged. Corner it             | 45c   |
| **Black Rabbit** | 4.2 m/s | Doesn't flee. Circles you at 8 m and stares | 120c  |

### The Black Rabbit

It makes no sound. When it is near, the rest of the world's audio ducks away and
the colour drains out of the fog. It doesn't run — it circles at 8 m, always
facing you, and if you look away and back it will be closer.

Catching it is easy. It lets you. The difficulty is that catching it is a
decision rather than a skill test — and then you have to decide whether to bake
it, or eat it raw.

---

## The gun

**The Culling Piece** is deliberately the _worse_ way to take a rabbit:

- shot meat is **ruined** — worth 45% of a clean catch
- the report carries **40 m** and empties the field
- it has unlimited ammo, so it is always the lazy option and never the good one

It exists for the rabbit you cannot corner, and for the boss.

---

## 🥚 The Sunny-Side Sovereign

A giant **unbroken egg** sits inert in the south-east corner of the meadow.
Nothing you own can hurt it. Shoot it and the bullets ping off. Hit it with the
Tenderiser and another crack spreads across the shell.

To start the fight you have to:

1. **Earn 1000 coins**
2. **Buy The Tenderiser** at the cooking table (`E`)
3. **Crack the shell** — six good hammer blows

On the sixth blow the shell bursts apart and the Sovereign — a fried egg the
size of a car, yolk and all — is revealed underneath. It is extremely awake. It chases, it slams
with a telegraphed ground pound, and past a certain point it starts throwing
yolk. It gets faster and hits harder the more damage it has taken. The yolk is
its weak point, worth 2.2× damage.

### Phase two — the chickens

Below **half health** it stops relying on reach and starts **throwing live
chickens** at you. They arc out, land short, and run you down; on contact one
detonates into feathers and takes a bite out of your health.

They are the answer to kiting. The slam only threatens you within 5 m and the
yolk is dodgeable, so before this the correct play against a wounded boss is to
back away and shoot. Chickens follow you when you do — and the counterplay to a
chicken is one shell, which costs you the two seconds of reload you wanted to
spend on the boss.

Kill it and it drops a **Protein Shake**. What that is for has not been decided
yet. It is counted, it is yours, and it is waiting.

It is the only thing in the game that can meaningfully hurt you.

---

## 🐴 Wild horses

Four of them graze around the meadow. Walk up to one and press `E`.

You get **four seconds**. The horse runs wherever you look, at roughly three
times your sprint — far enough to cross the map — and then it decides it has had
enough of you and throws you over its head. You land stumbling, and it bolts.

It is a traversal tool with a hard timer and a punishing exit. You do not tame
it; it tolerates you, briefly. Hooves also carry: every rabbit within 26m is
gone by the time you land.

---

## Skins — three cases

Straight out of the Counter-Strike playbook, and honest about it.

**Three chests** stand in a row beside the cooking table, each with its own case
and its own pool. Nothing crosses over, so which one you walk up to is a real
decision about where your 250c goes:

| Chest            | Case             | Paints                |
| ---------------- | ---------------- | --------------------- |
| 🧤 Meadow Case   | the Red Glove    | 19 skins              |
| 🔫 Culling Case  | the Culling Piece | 19 skins             |
| 🪥 Enamel Case   | the Toothbrush   | 19 skins              |

Cases open with a horizontal spinning ticket reel: six seconds, quintic
ease-out, a tick each time a ticket crosses the marker so the audio _is_ the
deceleration curve, and a deliberately off-centre landing so near-misses feel
like near-misses.

### They are patterns, not tints

A skin is never a recolour. Every one names a **procedural pattern** — fade,
camo, hydro-dip marbling, case-hardened crackle, circuit traces, fish scales,
star fields, thrown paint, hand-drawn doodles, corrosion, banded chrome,
nebulae — drawn to a canvas at load time from a palette, seeded off the skin's
id so it is identical in the case, in your hand, and in anyone else's game.

Each one also emits a matching **roughness map**, so the pattern changes how the
light sits on the material rather than only its colour. The reel tickets show
the real paint, not an approximation of it.

**57 skins across 7 rarity tiers**, with a wear/float value so no two drops are
identical — a Factory New Bloodstained Velvet at 0.041 is a different item from a
Battle-Scarred one. The odds are shown openly on the machine.

| Tier               | Odds       |
| ------------------ | ---------- |
| Consumer           | 79.92%     |
| Industrial         | 15.98%     |
| Mil-Spec           | 3.20%      |
| Restricted         | 0.64%      |
| Classified         | 0.26%      |
| Covert             | 0.20%      |
| ★ **Rare Special** | **0.026%** |

**Skins are cosmetic. Always.** Catching, shooting and brushing never change —
otherwise gambling becomes mandatory and the game becomes a grind.

There are also **28 coins hidden** around the meadow, tucked behind rocks, along
the blind sides of fences, under the cooking table, and out in the far corners.

---

## The toothbrush

You start the game holding one. It is not good.

It is, however, **fast and silent**, and that gives it a real place between the
other two: the glove catches a rabbit whole for full value but needs a lunge;
the gun kills anything at range but ruins the meat and empties the field for
40 m. The toothbrush kills at arm's length, keeps **75%** of the meat, and
carries barely five metres — so nothing else in the field finds out.

Its niche is the rabbit that has stopped for a carrot.

---

## Meat on the ground

Shooting or brushing a rabbit no longer pays you. It drops a **slab of meat**
where it fell, and you are paid when you walk over and pick it up.

This is the point of the gun's whole cost structure. The report empties the
field for 40 m, and now the shot also forces you to walk *into* that emptied
space to collect — so the easy option makes you commit, out in the open, while
everything worth catching is still running.

Every slab is the size and colour of what it came off: a Jack leaves a long dark
cut, a Lop leaves a pale fatty one, and the Black Rabbit leaves something you
probably should not eat.

---

## Rabbits breed

Left alone, two grazing rabbits find each other. **Hearts appear over the pair
for ten seconds** while they barge into one another, the hearts pop, and what
walks out is bigger than either of them.

Mutants come with re-rolled proportions, extra ear pairs sprouting from the
back, too many eyes, lumps along the spine, mismatched legs, and occasionally a
second head. They are slow, which is what stops them being a punishment.

**Size and price are the same number seen twice.** A mutant's value is capped at
**1000c** and its scale is derived directly from that value, so you can price
one by looking at it — and two mutants breeding cannot compound into a
building-sized rabbit worth more than the boss. One is born roughly **every 90
seconds**, and only one courtship runs at a time.

Scaring either parent cancels it. So the gun, which frightens everything within
40 m, cannot be fired anywhere near a pair you wanted to keep — and "clear the
field fast" becomes a real argument against "leave them and come back".

---

## The clinic

Health is otherwise unrecoverable. The **healing booth** is pitched in front of
the Cottage with the old shop man standing beside it:

- **300c** — patched up on the spot, back to full
- **150c** — one shake to carry, drunk with `H` wherever you are, for half

The carried one costs half as much and heals half as much, which makes it the
better deal only if you actually take it *into* the fight.

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

## The Stranger

The Tenderiser is not sold at the cooking table. It belongs to a man in the far
corner of the meadow, standing in the mouth of a half-collapsed shack with a
broken cart beside it and a fire going.

Press `E` and the camera leaves your head, eases in on his face, and stays
there. You get a **conversation**: numbered replies you pick with `1`-`9`, the
arrow keys, or the mouse. Ask about his wares, about the rabbits, about
doughnuts — he has opinions on all three, and directions to the egg.

He will sell you the hammer for 1000c. He does not know what it is:

> "Thank you for paying. But I don't know what's it for. But it does some decent
> damage."

---

## Weather

The meadow has a sky: a gradient dome and forty-six low-poly clouds drifting
overhead.

**When the shell cracks, the weather turns.** One value eases from 0 to 1 over
five seconds and everything hangs off it — the sky goes near-black overhead with
a bruised red band at the horizon, the fog closes from 190 m to 78, the clouds
darken and drop and speed up, the sun dims and goes cold, eighteen hundred rain
streaks start falling around you, and lightning strikes on a timer that tightens
as the Sovereign gets angrier. It clears again, more slowly, when the thing dies.

None of it is a post-process. It is all real scene state, which is why the
rabbits, the meat on the ground and your own hands are all standing in it.

---

## Dying

You get **WASTED**, and it is not subtle about where it got that from. The world
desaturates and blurs, a vignette closes in, the camera collapses to twenty-five
centimetres off the grass and rolls onto its side, and one enormous serif word
crawls up out of nothing.

Then it makes you sit there for **fifteen seconds** while a countdown runs and a
line types itself out, one character at a time:

> `skill issue, dying in this game`

You wake up in a **cell** at the edge of the meadow. Three stone walls and a
barred front, all of it solid — except the door, which is standing wide open.
The wait is the punishment; the walk back is the rest of it. You keep everything
except 20% of your coins.

---

## Music

The meadow has a track. The Sovereign has a different one, and the switch
between them *is* the announcement that the fight has started — it comes in the
moment the shell cracks and ends when the Sovereign does. Both stream through a
`MediaElementSource` into the WebAudio graph, so the music bus obeys its own
volume slider and the black rabbit's ducking leaves it alone.

---

## Built with

- **Three.js** r169 via CDN import map — no bundler, no `npm install`
- **WebAudio** for all sound
- **Pointer Lock API** for mouse look
- **localStorage** for settings
- Vanilla ES modules. Edit a file, reload the page.

---

## Documentation

| Document                                       | What it is                               |
| ---------------------------------------------- | ---------------------------------------- |
| **[ARCHITECTURE.md](ARCHITECTURE.md)**         | Codebase map. Start here to contribute   |
| **[docs/GAME_DESIGN.md](docs/GAME_DESIGN.md)** | The design bible — every system, and why |
| **[docs/ASSETS.md](docs/ASSETS.md)**           | Every model in `OBJECTS/` and its role   |
| **[progress.html](progress.html)**             | Live task board with time estimates      |
| **[RELEASE_NOTES.md](RELEASE_NOTES.md)**       | What shipped in each version             |

---

## Status

Playable vertical slice. In: movement and the lunge, rabbit AI and locomotion,
courtship and mutants, four weapons, meat drops, the horses, the two-phase boss
fight with its chickens and its storm, three skin cases with procedural paints,
the carrot trader, the clinic, the Stranger and his conversation, the death
screen and the cell, clouds and weather, hidden coins, music and settings.

**Not yet built:** the baking half — grinder, mixer, fryer minigame, recipes and
customer orders — plus the goat room, the clothing rack, save/load, the day
cycle, and maps 2 through 4.

**[progress.html](progress.html)** is the live overhead: every step shipped, in
progress, planned or deliberately parked, with time estimates against actuals.
See `docs/GAME_DESIGN.md` §16 for the milestone plan.

---

## Credits

3D models in `OBJECTS/` are free assets from **Quaternius**, **Kenney**, and
**Poly by Google**, plus individual creators credited in their folder names.
See `docs/ASSETS.md`.

No rabbits were harmed. They were, however, thoroughly baked.
