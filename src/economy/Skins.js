// Skins, rarity and float — GAME_DESIGN.md §8.2, §8.3
// Cosmetic only. Float never affects catching, shooting or brushing (§17.5).
//
// THREE COLLECTIONS, one per chest: the glove, the gun and the toothbrush each
// have their own case with their own case-exclusive skins. Nothing crosses over
// — a Culling Case will never give you a glove — so which chest you walk up to
// is a real decision about which 250c you are spending.
//
// Every skin names a PATTERN from SkinTextures.js and a palette. It is never a
// tint: two skins on the same weapon are different painted surfaces, with their
// own roughness, and you can tell them apart across the meadow.

export const TIERS = {
  consumer:   { name: 'Consumer',   color: '#b0c3d9', odds: 0.7992, base:  120 },
  industrial: { name: 'Industrial', color: '#5e98d9', odds: 0.1598, base:  340 },
  milspec:    { name: 'Mil-Spec',   color: '#4b69ff', odds: 0.0320, base:  900 },
  restricted: { name: 'Restricted', color: '#8847ff', odds: 0.0064, base: 2400 },
  classified: { name: 'Classified', color: '#d32ce6', odds: 0.0026, base: 6000 },
  covert:     { name: 'Covert',     color: '#eb4b4b', odds: 0.0020, base: 14000 },
  gold:       { name: '★ Rare Special', color: '#ffd700', odds: 0.00026, base: 90000 },
};

// ── THE MEADOW CASE — glove skins ───────────────────────────────────────────
const GLOVE_SKINS = [
  { id: 'g_kitchen',   name: 'Kitchen Standard', tier: 'consumer',   pattern: 'plain',
    palette: [0xc0392b, 0x8e2a1e], rough: 0.78 },
  { id: 'g_dishwater', name: 'Dishwater',        tier: 'consumer',   pattern: 'rust',
    palette: [0x8d7f72, 0x6d6157, 0x5a4f46], rough: 0.88 },
  { id: 'g_beige',     name: 'Beige Regret',     tier: 'consumer',   pattern: 'camo',
    palette: [0xc7b299, 0xa08e78, 0xb5a288, 0x8d7d68], rough: 0.85 },
  { id: 'g_flour',     name: 'Flour Dusted',     tier: 'consumer',   pattern: 'splatter',
    palette: [0xa8483c, 0xf3ece2, 0xd9c4ae], rough: 0.82 },

  { id: 'g_checker',   name: 'Checkerboard',     tier: 'industrial', pattern: 'checker',
    palette: [0xe8e2d6, 0x2a2724], rough: 0.6, repeat: 2 },
  { id: 'g_butcher',   name: "Butcher's Blue",   tier: 'industrial', pattern: 'stripes',
    palette: [0x3f6fa8, 0xf2f4f7, 0x2c4f78], rough: 0.7 },
  { id: 'g_sunday',    name: 'Sunday Best',      tier: 'industrial', pattern: 'scales',
    palette: [0xf0e3ea, 0xd0a8bc, 0xe8c6d6], rough: 0.55 },
  { id: 'g_hedgerow',  name: 'Hedgerow',         tier: 'industrial', pattern: 'camo',
    palette: [0x3f5c2e, 0x6d8347, 0x2a3d1f, 0x8fa05a], rough: 0.84 },

  { id: 'g_blood',     name: 'Bloodstained Velvet', tier: 'milspec', pattern: 'hydro',
    palette: [0x3d0d12, 0x7a1d24, 0xa8323c, 0x50161c], rough: 0.42 },
  { id: 'g_carrot',    name: 'Carrot Camo',      tier: 'milspec',    pattern: 'camo',
    palette: [0xd2762a, 0x5c7a3a, 0xa85a1e, 0x89a04a], rough: 0.8 },
  { id: 'g_wired',     name: 'Wired',            tier: 'milspec',    pattern: 'circuit',
    palette: [0x1d2026, 0x54d6a8, 0xd7b64a], rough: 0.5, roughContrast: 0.9 },
  { id: 'g_deepocean', name: 'Deep Ocean',       tier: 'milspec',    pattern: 'fade',
    palette: [0x081a26, 0x1b4f6b, 0x2f8fa8, 0x9fe3e8], rough: 0.35 },

  { id: 'g_chrome',    name: 'Chrome Warren',    tier: 'restricted', pattern: 'chrome',
    palette: [0x2a3038, 0x6e7a86, 0xb8c0c8, 0xf0f4f8], rough: 0.22, metal: 0.45 },
  { id: 'g_doughnut',  name: 'Doughnut Print',   tier: 'restricted', pattern: 'doodle',
    palette: [0xf2c4d2, 0x8a5a3b, 0xffffff, 0x6ac0d8], rough: 0.62 },
  { id: 'g_marbled',   name: 'Marbled Glaze',    tier: 'restricted', pattern: 'crackle',
    palette: [0xeadfd2, 0xc06a86, 0xf7efe4, 0x9c4a64], rough: 0.3 },

  { id: 'g_goat',      name: 'Goat Pattern',     tier: 'classified', pattern: 'crackle',
    palette: [0xcfc6b4, 0x2e2a26, 0x8a8070, 0x1a1714], rough: 0.45 },
  { id: 'g_fever',     name: 'Fever Dream',      tier: 'classified', pattern: 'hydro',
    palette: [0x2a1038, 0xd23ce0, 0x35e0c8, 0xffe14a], rough: 0.28 },

  { id: 'g_binky',     name: 'Binky',            tier: 'covert',     pattern: 'galaxy',
    palette: [0x120a24, 0x9ad8f2, 0xf2a2d8, 0x6a4ad8], rough: 0.24, iridescent: true },

  { id: 'g_golden',    name: 'Golden Glove',     tier: 'gold',       pattern: 'chrome',
    palette: [0x6a4a08, 0xb8860b, 0xffd24a, 0xfff2b8], rough: 0.18, metal: 0.6 },
];

// ── THE CULLING CASE — gun skins ────────────────────────────────────────────
const GUN_SKINS = [
  { id: 'n_service',   name: 'Service Issue',    tier: 'consumer',   pattern: 'plain',
    palette: [0x5b6068, 0x3e4248], rough: 0.6 },
  { id: 'n_barnwood',  name: 'Barn Wood',        tier: 'consumer',   pattern: 'stripes',
    palette: [0x6b4327, 0x54341e, 0x7d5233], rough: 0.85 },
  { id: 'n_saltpit',   name: 'Salt Pit',         tier: 'consumer',   pattern: 'rust',
    palette: [0x7e7a72, 0xa89e94, 0x5d5952], rough: 0.9 },
  { id: 'n_pheasant',  name: 'Pheasant',         tier: 'consumer',   pattern: 'scales',
    palette: [0x4a3520, 0x8a6a3a, 0xc8a05a], rough: 0.72 },

  { id: 'n_grousemoor', name: 'Grouse Moor',     tier: 'industrial', pattern: 'camo',
    palette: [0x4a4632, 0x6d6a45, 0x2f2d20, 0x8a8258], rough: 0.8 },
  { id: 'n_pinstripe', name: 'Gamekeeper',       tier: 'industrial', pattern: 'stripes',
    palette: [0x22262c, 0x3d4550, 0xb8c0c8], rough: 0.5 },
  { id: 'n_buckshot',  name: 'Buckshot',         tier: 'industrial', pattern: 'splatter',
    palette: [0x30343a, 0x9aa0aa, 0xd8b463], rough: 0.55 },
  { id: 'n_frost',     name: 'First Frost',      tier: 'industrial', pattern: 'fade',
    palette: [0xdfe9f0, 0x9ab8cc, 0x5c7a92], rough: 0.42 },

  { id: 'n_poacher',   name: 'Poacher',          tier: 'milspec',    pattern: 'hydro',
    palette: [0x15181c, 0x2f4a2a, 0x50743f, 0x1f2a1c], rough: 0.48 },
  { id: 'n_copper',    name: 'Copperhead',       tier: 'milspec',    pattern: 'crackle',
    palette: [0x3a2410, 0xb87333, 0x7a4a1e, 0xe0a860], rough: 0.35, metal: 0.35 },
  { id: 'n_hazard',    name: 'Hazard Tape',      tier: 'milspec',    pattern: 'stripes',
    palette: [0x1a1a1a, 0xf2c518, 0x111111], rough: 0.58 },
  { id: 'n_circuitry', name: 'Fowl Circuit',     tier: 'milspec',    pattern: 'circuit',
    palette: [0x0e2018, 0x3ad88a, 0xd7b64a], rough: 0.45, roughContrast: 0.9 },

  { id: 'n_nightshift', name: 'Night Shift',     tier: 'restricted', pattern: 'stars',
    palette: [0x0a0e1a, 0x1c2848, 0xdfe6ff], rough: 0.3 },
  { id: 'n_glazed',    name: 'Glazed & Confused', tier: 'restricted', pattern: 'doodle',
    palette: [0xf2d8b8, 0xe0596f, 0x6ac0d8, 0x8a5a3b], rough: 0.5 },
  { id: 'n_damascus',  name: 'Damascus Fold',    tier: 'restricted', pattern: 'chrome',
    palette: [0x1d2126, 0x555c66, 0x99a4b0, 0xdfe6ee], rough: 0.25, metal: 0.5 },

  { id: 'n_yolk',      name: 'Yolk Spill',       tier: 'classified', pattern: 'splatter',
    palette: [0xf7f2e6, 0xf6b91a, 0xd18a08, 0xfff0c0], rough: 0.34 },
  { id: 'n_aurora',    name: 'Aurora',           tier: 'classified', pattern: 'hydro',
    palette: [0x081428, 0x35e0c8, 0x6a4ad8, 0xd23ce0], rough: 0.26 },

  { id: 'n_sovereign', name: 'Sovereign',        tier: 'covert',     pattern: 'crackle',
    palette: [0x2a1a04, 0xf6b91a, 0xfff3d0, 0x8a5c06], rough: 0.22, metal: 0.4 },

  { id: 'n_bigbang',   name: 'The Big Bang',     tier: 'gold',       pattern: 'galaxy',
    palette: [0x140820, 0xff6a3a, 0xffd24a, 0x6ad8ff], rough: 0.18, metal: 0.35, iridescent: true },
];

// ── THE ENAMEL CASE — toothbrush skins ──────────────────────────────────────
const BRUSH_SKINS = [
  { id: 'b_minty',     name: 'Minty',            tier: 'consumer',   pattern: 'plain',
    palette: [0x3ec8a8, 0x2a9c82], rough: 0.45 },
  { id: 'b_bathroom',  name: 'Bathroom Beige',   tier: 'consumer',   pattern: 'plain',
    palette: [0xd8cdb8, 0xb3a892], rough: 0.6 },
  { id: 'b_bristle',   name: 'Split Bristle',    tier: 'consumer',   pattern: 'rust',
    palette: [0x9aa4b0, 0x6e7682, 0xbfc7d0], rough: 0.75 },
  { id: 'b_gum',       name: 'Bubblegum',        tier: 'consumer',   pattern: 'plain',
    palette: [0xf59ec0, 0xd8709c], rough: 0.4 },

  { id: 'b_candy',     name: 'Candy Stripe',     tier: 'industrial', pattern: 'stripes',
    palette: [0xffffff, 0xe0455f, 0x3aa3d8], rough: 0.35 },
  { id: 'b_tiles',     name: 'Bathroom Tiles',   tier: 'industrial', pattern: 'checker',
    palette: [0xeef4f6, 0x5ba8c0], rough: 0.3, repeat: 3 },
  { id: 'b_plaque',    name: 'Plaque',           tier: 'industrial', pattern: 'camo',
    palette: [0xe8e0b8, 0xc4b880, 0xf2eccc, 0xa89a5c], rough: 0.7 },
  { id: 'b_fluoride',  name: 'Fluoride',         tier: 'industrial', pattern: 'fade',
    palette: [0x0d3a5c, 0x2a86c0, 0x7fd8f0], rough: 0.3 },

  { id: 'b_cavity',    name: 'Cavity',           tier: 'milspec',    pattern: 'crackle',
    palette: [0xf4f0e4, 0x2a1a12, 0xc8b898, 0x0f0a06], rough: 0.5 },
  { id: 'b_electric',  name: 'Electric',         tier: 'milspec',    pattern: 'circuit',
    palette: [0x14181e, 0x4ad8f0, 0xf2f4f7], rough: 0.4, roughContrast: 0.9 },
  { id: 'b_koi',       name: 'Koi',              tier: 'milspec',    pattern: 'scales',
    palette: [0xf2f0e8, 0xe0553a, 0x1a1a1a, 0xf2a03a], rough: 0.34 },
  { id: 'b_grape',     name: 'Grape Rinse',      tier: 'milspec',    pattern: 'hydro',
    palette: [0x2a0f38, 0x8a3ad8, 0xd07ff0, 0x4a1a6a], rough: 0.3 },

  { id: 'b_dentist',   name: "Dentist's Nightmare", tier: 'restricted', pattern: 'doodle',
    palette: [0xf7f4ec, 0xe0455f, 0x2a3a5c, 0x3ec8a8], rough: 0.42 },
  { id: 'b_porcelain', name: 'Porcelain',        tier: 'restricted',  pattern: 'crackle',
    palette: [0xfbfaf6, 0x8aa8c0, 0xe8eef2, 0x5c7a92], rough: 0.2 },
  { id: 'b_mouthwash', name: 'Mouthwash',        tier: 'restricted',  pattern: 'fade',
    palette: [0x0a3a2a, 0x1ec89a, 0x8ff0d0, 0xf0fff8], rough: 0.22 },

  { id: 'b_rootcanal', name: 'Root Canal',       tier: 'classified',  pattern: 'splatter',
    palette: [0xf4f0e4, 0xa8121a, 0x5c0a10, 0xe0453f], rough: 0.36 },
  { id: 'b_enamel',    name: 'Enamel Fever',     tier: 'classified',  pattern: 'hydro',
    palette: [0xfdfcf8, 0xf2c518, 0x35e0c8, 0xd23ce0], rough: 0.24 },

  { id: 'b_molar',     name: 'The Golden Molar', tier: 'covert',      pattern: 'chrome',
    palette: [0x5c4208, 0xb8860b, 0xffd24a, 0xfff8d8], rough: 0.2, metal: 0.55 },

  { id: 'b_dreamscape', name: 'Night Brushing',  tier: 'gold',        pattern: 'galaxy',
    palette: [0x0a0818, 0x4a6aff, 0x9ad8f2, 0xffd24a], rough: 0.18, iridescent: true },
];

export const COLLECTIONS = {
  glove: { key: 'glove', case: 'MEADOW CASE',  weapon: 'Red Glove',        skins: GLOVE_SKINS },
  gun:   { key: 'gun',   case: 'CULLING CASE', weapon: 'The Culling Piece', skins: GUN_SKINS },
  brush: { key: 'brush', case: 'ENAMEL CASE',  weapon: 'Toothbrush',       skins: BRUSH_SKINS },
};

// every skin in the game, for lookups by id
export const SKINS = [...GLOVE_SKINS, ...GUN_SKINS, ...BRUSH_SKINS];
const BY_ID = new Map(SKINS.map(s => [s.id, s]));
export const skinById = (id) => BY_ID.get(id);

export const WEARS = [
  { max: 0.07, name: 'Factory New'   },
  { max: 0.15, name: 'Minimal Wear'  },
  { max: 0.38, name: 'Field-Tested'  },
  { max: 0.45, name: 'Well-Worn'     },
  { max: 1.01, name: 'Battle-Scarred'},
];

export function wearName(float) {
  return WEARS.find(w => float < w.max).name;
}

// tier → skins, per collection
const POOLS = {};
for (const [key, col] of Object.entries(COLLECTIONS)) {
  const byTier = {};
  for (const s of col.skins) (byTier[s.tier] ??= []).push(s);
  POOLS[key] = byTier;
}

export function rollTier() {
  let r = Math.random();
  // walk the table in ascending rarity so the common case exits immediately
  for (const key of ['consumer', 'industrial', 'milspec', 'restricted', 'classified', 'covert', 'gold']) {
    const t = TIERS[key];
    if (r < t.odds) return key;
    r -= t.odds;
  }
  return 'consumer';
}

// `collection` is 'glove' | 'gun' | 'brush'.
export function rollSkin(collection = 'glove') {
  const pools = POOLS[collection] ?? POOLS.glove;
  const tier = rollTier();
  const pool = pools[tier] ?? pools.consumer;
  const skin = pool[Math.floor(Math.random() * pool.length)];
  // float skews low — most drops are decent, a truly beaten one is its own find
  const float = Math.pow(Math.random(), 1.7);
  return { skin, tier, float, collection };
}

export function valueOf(skin, float) {
  return Math.round(TIERS[skin.tier].base * (1 - float) * 0.55);
}

let NEXT = 1;
export function mintInstance({ skin, tier, float, collection = 'glove' }) {
  return {
    instId: 'inst_' + (NEXT++).toString(36).padStart(4, '0'),
    skinId: skin.id,
    collection,
    name: skin.name,
    tier,
    pattern: skin.pattern,
    palette: skin.palette,
    // the dominant colour, for anything that only wants one number (HUD chips,
    // the ticket border, the drop light)
    color: skin.palette[skin.palette.length - 1] ?? 0xffffff,
    accent: skin.palette[0],
    metal: skin.metal ?? 0.05,
    rough: skin.rough ?? 0.65,
    iridescent: !!skin.iridescent,
    float: +float.toFixed(3),
    wear: wearName(float),
  };
}
