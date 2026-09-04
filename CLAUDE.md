# Hare & Glaze — working syllabus

First-person browser game: catch rabbits with a red glove, sell them, bake them
into doughnuts. Three.js r169 from a CDN import map. **No build step** — plain ES
modules served straight off disk.

```
python serve.py            # http://localhost:8177, sends no-store on everything
```

`python -m http.server` will serve you a cached copy of the module you just
edited, which looks exactly like "my change did nothing". Use `serve.py`.

## Read in this order

1. **`docs/CODEMAP.md`** — every module, one line each. Start here to find a file.
2. **`src/main.js`** — the composition root. 1686 lines, 35 imports, owns all
   cross-module wiring. Any bug spanning two systems is in here.
3. **`docs/GAME_DESIGN.md`** — intent and numbered sections; the source of truth
   for *why*.
4. **`ARCHITECTURE.md`** — the long-form version of the code map.
5. **`progress.html`** — what shipped, what is planned, estimates vs actuals.
   Keep it current; it is the running ledger.

## The shape, in one paragraph

Modules do not talk to each other. Fan-in across `src/` is `Loaders.js` 11,
`applySkin.js` 3, `Engine.js` 3, then a tail of ones. Everything else is wired
in `main.js`. A system is added by importing it and calling `.update(dt)`, and
removed by deleting those two lines. Respect that: **a new module should import
from `world/Loaders.js` and little else**, and reach other systems through
arguments `main.js` passes it, not through imports.

## The frame contract

Fixed timestep, `FIXED_DT = 1/60`, at most 5 catch-up steps. `step(dt)` runs in
this order, and the order matters:

```
raw + dayCycle  (ABOVE the guards — see below)
mating → carrots → (player, rabbits) → horses → healing → jail → merchant
       → rack → goatRoom → sky → impacts → meat → chickens → … → pickups
```

`step()` returns early for `chat.on` and `state.dead` — a system that must keep
running during a conversation or on the death screen has to go above those
guards, not below. The raw-meat buff and the day clock both live up there: below
them you could park a 45-second buff, or an entire day, by talking to the
Stranger.

## Traps that have already cost hours

Each of these presents as something other than what it is.

- **A model loads, sizes and positions perfectly, and renders 100% invisible.**
  Its MTL says `d 0.000000`. Fixed centrally in `Loaders.prepare()`; the hamster
  and the chicken both had it. If a new model is invisible, check this first.
- **A model loads flat white.** Several asset packs name the material file
  `materials.mtl`, not `<model>.mtl`, so the MTL was never read.
- **Placement logic passes a clearance check and lands inside a tree anyway.**
  Models load asynchronously; `world.colliders` is empty when synchronous
  placement runs. Check the declared `world.treeClumps` centres, not the live
  colliders. This put the jail cell inside a pine clump twice.
- **A skin's pattern renders as one flat colour.** The mesh's authored UVs pack
  every face into one texel. `applySkinTo()` box-projects UVs in **root space** —
  compute in the same space or parts drift apart.
- **A click does nothing but Enter works.** Something rebuilt the DOM between
  mousedown and mouseup; `click` only fires when both land on the same node.
  This was `mouseenter` calling a destructive re-render in `Dialogue.js`.
- **Holding a key quits the game.** `Ctrl+W` closes the tab and a page cannot
  `preventDefault` a reserved browser shortcut. Crouch is `C`/`Z`. Do not move
  any binding onto Ctrl.
- **Sharing a geometry turns `dispose()` into a bug.** `RabbitMesh` caches
  geometry and materials page-wide, so disposing one rabbit's box blanks every
  rabbit sharing it. `Rabbit.dispose()` removes from the scene and nothing else.
- **A `.length` check on options is always 0.** Node `options` is a *function*;
  `Function.length` is arity. Count the rendered list.
- **`backdrop-filter` does nothing over the game.** It does not composite over a
  WebGL canvas. Filter the `#view` element itself, as `Wasted` does.
- **An automated browser test says the game is broken.** Chrome throttles rAF in
  background tabs, and synthetic coordinate clicks do not land on the canvas.
  Verify with dispatched DOM events; this is a harness limit, not a game bug.

## Conventions

- Comments explain **why**, in prose, at the density of the surrounding file.
  Constants that were tuned by feel say what they were tuned against.
- Tunables live in an exported uppercase object per module (`MOVE`, `GUN`,
  `BOSS`, `MATE`, `HEAL`, `JAIL`, `SKY`). Put new knobs there, not inline.
- Procedural over authored where it is cheap: rabbits, textures, and most props
  are built in code, so they need no asset file and no load wait.
- New sound effects must differ from their neighbours in source, register, or
  envelope — not merely in pitch.
- Verify in the real game before reporting done. `node --check` over `src/` is
  the cheap syntax gate.

## Hard constraints

- **Do no git operations.** No commit, no tag, no push — the user does all of
  it manually. This is standing and not negotiable.
- When shipping a feature, update `README.md`, `RELEASE_NOTES.md` (with a
  suggested tag) and `progress.html` so the user's own commit is complete.

## Not built yet

The baking half — grinder, mixer, fryer minigame, recipes, orders — plus the
goat room, clothing rack, save/load, day cycle, and maps 2-4. `progress.html`
holds the current list and estimates.
