# Asset Inventory & Requests

## Format preference (for anything new)

**GLB / glTF 2.0** wherever possible — Three.js loads it natively with one loader,
embedded textures, embedded animations, correct scale, PBR materials. FBX needs an
extra loader and frequently arrives at 100x scale. OBJ has no rig and no animation
at all.

Priority: `.glb` > `.gltf` > `.fbx` > `.obj`

---

## What we already have (17 assets)

| Asset | Format | Rig | Verdict |
|-------|--------|-----|---------|
| Bunny by Quaternius | GLB | **Humanoid biped**, 14 anims (Idle/Walk/Run/Jump/Death/Punch/Wave...) | ❌ Wrong body plan for hunting rabbits. **Repurpose: bakery shopkeeper / customer NPC** |
| Rabbit_Bald by Quaternius | FBX 9MB | **Humanoid biped**, Chop/Assembly/Death anims | ❌ Same. Repurpose as an NPC |
| Rabbit_Green (pigtails) by Quaternius | FBX 9MB | **Humanoid biped**, same rig | ❌ Same. Repurpose as an NPC |
| Rabbit by madtrollstudio | FBX 93KB | No rig, no anims | ⚠️ Static quadruped — usable as a fallback/prop only |
| Rabbit_01 by Poly (Google) | OBJ | No rig, 162 verts, **single fused mesh** | ⚠️ True quadruped shape but unriggable as-is |
| Jerboa by Poly | OBJ + 3.6MB texture | No rig, 706 verts | ✅ Great silhouette. Reskin as a **Jack** variant if we get it rigged |
| Hamster by Poly | OBJ | No rig, 326 verts | ✅ Reskin as a small round rabbit / **Angora** base |
| Chest_Open by Quaternius | FBX | Static | ✅ **Ships as the Chest.** Need a closed variant or animate the lid ourselves |
| Coin by Quaternius | FBX | Static | ✅ Coins / pickup VFX |
| Small Table by Quaternius | FBX | Static | ✅ Prop, but too small to be the Cooking Table |
| Donut Chocolate (Kenney) | OBJ | Static | ✅ Doughnut variant |
| Donut Sprinkles (Kenney) | OBJ | Static | ✅ Doughnut variant |
| Glazed Donut (Jarlan Perez) | OBJ | Static | ✅ Doughnut variant |
| Lil Glazey (Julius Ross) | OBJ 960KB | Static | ✅ Doughnut character — **mascot / signage** |
| Donut Guy (Mark Creasy) | OBJ 520KB | Static | ✅ Doughnut character — **customer / counter mascot** |
| Raw Steak (S. Paul Michael) | OBJ | Static | ✅ **Raw rabbit meat** in inventory. Perfect |
| Park by Zebo | OBJ 11MB | Static, 44k verts, ~1000 groups | ✅ Whole park scene — strong **Meadow map** base or greybox reference |

**Coverage:** doughnuts ✅ · chest ✅ · coins ✅ · meat ✅ · map base ✅ · NPCs ✅
**Missing:** the rabbits themselves, the glove, the entire bakery, the goat room.

---

## FINAL PLAN — "make do" (locked)

Only one new asset is coming: **the glove**. Everything else is sourced from the
17 existing assets or generated in code.

### Rabbits: fully procedural

The Poly `Rabbit_01.obj` was evaluated and rejected as the hunted-rabbit mesh:
Z-up, 162 verts, a single fused mesh, and posed **sitting upright with erect
ears** (height 234 vs length 263). A bounding gait cannot be recovered from a
static sitting pose.

`RabbitMesh.js` therefore builds rabbits from primitives at runtime, with a
code-defined bone hierarchy purpose-built for the saltation rig in
GAME_DESIGN.md §5.1: `root -> haunch -> spine -> chest -> neck -> head`, plus
`ear.L/R` (3 bones each) and four legs. One parameterized builder produces all
8 rabbit types by varying body proportions, ear length, leg length, and colour.

This restores design pillar 5 (§1) for rabbits specifically, and it means the
gait, the ear springs, and the landing squash all work exactly as specified.

The static Poly rabbit, Hamster, and Jerboa become **decorative critters** —
non-catchable ambient wildlife that make the world feel populated.

### Later additions (all in use)

| Asset | Used for | Notes |
|---|---|---|
| **Glove.fbx** | The player's red glove viewmodel | Authored with fingers along +Z — pointing at the camera. Yawed 180° in `Glove.js` |
| **Resource_PineTree_Group.fbx** | Treeline + interior clumps | Materials ship near-black (`Wood #3f250e`, `Green #182e03`); recoloured on load |
| **Resource_Tree_Group.fbx** | Deciduous variety, mixed with the pines | Same recolour treatment |
| **House_1.fbx** | Timber-framed house, north-west plot | Materials also very dark (`#271106` walls, `#090909` windows) — caught by the luminance floor |
| **Cottage.obj** + `Cottage Texture.png` | Log cabin, north-east plot | Needs MTL loading for its texture. Ships with a wide base plate — fit by `maxSize`, not height |
| **grass/model.obj** | 420 instanced grass tufts | MTL is `materials.mtl`, **not** `model.mtl`. Flattened to one geometry with baked vertex colours |
| **eggSunnysideUp.obj** | The Sunny-Side Sovereign boss | Wide and flat — must be fit by `maxSize` |
| **assets/audio/shotgun.mp3** | The gunshot | **The only recorded audio in the project.** Everything else is synthesized; `Sfx.gunshot()` falls back to synthesis if it fails to load |

### Three traps these assets exposed

1. **Near-black source materials.** Several packs are authored for a renderer
   with far more ambient light than ours. `Loaders.js` applies a luminance floor
   (0.20) to any untextured material, and `recolor` remaps specific ones by name.
2. **`fitToHeight` on wide, flat models.** The egg became 47 m across and the
   Cottage's base plate swallowed the player. Use `maxSize` for anything wider
   than it is tall.
3. **A shared `MTLLoader` is not safe for concurrent loads.** `setPath` mutates
   the instance, so the grass load clobbered the Cottage's resource path and its
   texture silently 404'd, rendering the building black. One loader per call.

### Asset assignments

| Need | Source |
|------|--------|
| Hunted rabbits (all 8 types) | **Procedural** (`RabbitMesh.js`) |
| Player glove viewmodel | **User-supplied** (procedural placeholder until it lands) |
| **Bakery NPC / the Baker** | Quaternius **Bunny GLB** — `Idle`, `Wave`, `Yes`, `No`. *A rabbit person who bakes rabbits.* This is the tone of the game in one asset |
| Counter customers | Rabbit_Bald + Rabbit_Green FBX (humanoid), `Idle` / `Chop_Loop` |
| Bakery mascot / exterior sign | **Donut Guy**, **Lil Glazey** |
| Doughnuts (8 types) | Kenney **Chocolate** + **Sprinkles**, **Glazed Donut** — recoloured and scaled per recipe |
| Chest | **Chest_Open.fbx** (lid animated in code for open/close) |
| Coins & pickup VFX | **Coin.fbx**, instanced |
| Raw rabbit meat (inventory + eat-raw) | **Raw Steak** |
| Meadow map base | **Park by Zebo** (44k verts) — culled, re-materialled, and re-dressed |
| World props | **Park Bench**, **Table_Small** |
| Ambient critters | Poly **Rabbit_01**, **Hamster**, **Jerboa** (static, non-catchable) |
| Cooking table (large, 4 stations) | **Procedural** — Table_Small is far too small for the map hub |
| Goat room shell, frames, goat paintings | **Procedural** — paintings drawn as 2D canvas textures |
| Case machine / slot cabinet | **Procedural** box + the DOM reel overlay |
| Clothing rack + hooks | **Procedural**, gloves hung as instances of the glove mesh |
| Fences, rocks, trees, windmill, hedges | **Procedural**, plus anything salvageable from the Park scene |

### What this costs us

Nothing structural. The one real loss is hand-authored rabbit silhouettes — the
procedural rabbits will read as clean low-poly rather than sculpted. Given the
locked art style (flat-shaded, chunky, saturated) that is on-style rather than a
compromise.

---

## Original download requests (superseded — kept for reference)

## DOWNLOAD REQUESTS

### 🔴 P0 — Blocker. The game does not work without this.

**1. A rigged QUADRUPED rabbit or hare.**

The single most important asset in the project. Requirements, in order:

- Four-legged, on all fours, natural rabbit proportions (large hind legs)
- **Rigged with a skeleton**, ideally: root, spine (2+ joints), neck, head,
  **2–3 bones per ear**, and four legs with at least hip/knee/foot each
- A hop or bound animation is a bonus but **not required** — the gait is
  procedural. What we need is the *skeleton*, so the code can drive it
- GLB preferred

*Fallback if nothing rigged exists:* a quadruped rabbit **exported as separate
objects** — `body`, `head`, `ear_L`, `ear_R`, `leg_FL`, `leg_FR`, `leg_HL`,
`leg_HR`, `tail` — as individual meshes in one file. I can build the rig in code
from separated parts. This is genuinely almost as good.

Search terms: `low poly rabbit rigged`, `hare rigged animated`, `quadruped rabbit
game ready`. Sketchfab filtered to *Animated* + *Downloadable* is the best bet.

---

### 🟠 P1 — Needed for the vertical slice

**2. First-person gloved hand / arm.**
A right hand + forearm, viewmodel-scale, ideally rigged with finger bones so it
can clench on the grab. A generic gloved hand is fine — we re-material it for
every skin. Search: `fps hands glove rigged`, `first person arm glove`.

**3. Bakery / kitchen props.** A set is ideal (Kenney's food or kitchen kits):
- **Deep fryer or large pot** (the Fryer station)
- **Mixing bowl** + whisk or rolling pin (the Mixer station)
- **Meat grinder or hand crank mill** (the Grinder — the one prop I really want)
- Flour sack, sugar jar, glaze/icing bottles
- A **large wooden work table** — the Small Table is too small to be the hub

**4. A shop counter / bakery display case.** Glass-fronted display counter for
selling. Kenney's *Furniture Kit* or *Retro Medieval* have candidates.

---

### 🟡 P2 — Goat room & economy

**5. Framed pictures / picture frames.** 3–5 empty frame meshes in different
shapes. I'll generate the goat paintings as procedural canvas textures — I just
need frames to hang them in.

**6. A goat.** One low-poly goat. It doesn't appear in the room, but I want it for
the paintings' source renders and for one thing I'm not going to describe here.

**7. Slot machine / arcade cabinet.** The case-opening machine in the goat room.
An arcade cabinet works fine and is easier to find than a slot machine.

**8. Clothing rack + coat hooks.** For displaying owned gloves. A clothes rail or
a wall hook set.

---

### 🟢 P3 — Map dressing (I can procedurally generate all of these if needed)

- Wooden fence sections (herding rabbits into corners — gameplay-relevant)
- Rocks / boulder cluster (same)
- Low-poly trees and bushes (Meadow + The Hollow)
- A windmill (Meadow landmark)
- A small cottage / bakery building exterior
- Pine trees + snow rocks (Frost Hollow)
- Hedge sections (Duke's Estate maze)
- Hanging lantern (The Hollow)

---

## Notes

- **Everything is re-materialable.** Don't worry about colour or texture on any
  download — I recolour in code. Shape and rig are all that matter.
- **Scale doesn't matter.** I normalize on load.
- **Don't buy anything.** Free CC0/CC-BY only. Kenney.nl, Quaternius.com, and
  Poly Pizza are all free and match the low-poly look we've locked.
- The design doc's "everything procedural" rule now relaxes to: **use real assets
  where we have them, generate the rest.** The procedural *animation* rule
  (§5.1 saltation) and the procedural *audio* rule (§5.4) both still stand
  absolutely.
