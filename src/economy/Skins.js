// Glove skins, rarity and float — GAME_DESIGN.md §8.2, §8.3
// Cosmetic only. Float never affects catching (§17.5).

export const TIERS = {
  consumer:   { name: 'Consumer',   color: '#b0c3d9', odds: 0.7992, base:  120 },
  industrial: { name: 'Industrial', color: '#5e98d9', odds: 0.1598, base:  340 },
  milspec:    { name: 'Mil-Spec',   color: '#4b69ff', odds: 0.0320, base:  900 },
  restricted: { name: 'Restricted', color: '#8847ff', odds: 0.0064, base: 2400 },
  classified: { name: 'Classified', color: '#d32ce6', odds: 0.0026, base: 6000 },
  covert:     { name: 'Covert',     color: '#eb4b4b', odds: 0.0020, base: 14000 },
  gold:       { name: '★ Rare Special', color: '#ffd700', odds: 0.00026, base: 90000 },
};

export const SKINS = [
  { id: 'faded_red',      name: 'Faded Red',          tier: 'consumer',   color: 0xa8483c, accent: 0x8e3a30 },
  { id: 'kitchen',        name: 'Kitchen Standard',   tier: 'consumer',   color: 0xc0392b, accent: 0x8e2a1e },
  { id: 'dishwater',      name: 'Dishwater',          tier: 'consumer',   color: 0x8d7f72, accent: 0x6d6157 },
  { id: 'beige_regret',   name: 'Beige Regret',       tier: 'consumer',   color: 0xc7b299, accent: 0xa08e78 },

  { id: 'flour_dusted',   name: 'Flour Dusted',       tier: 'industrial', color: 0xd9c4ae, accent: 0xf3ece2 },
  { id: 'checkerboard',   name: 'Checkerboard',       tier: 'industrial', color: 0xe8e2d6, accent: 0x2a2724 },
  { id: 'butchers_blue',  name: "Butcher's Blue",     tier: 'industrial', color: 0x3f6fa8, accent: 0x2c4f78 },
  { id: 'sunday_best',    name: 'Sunday Best',        tier: 'industrial', color: 0xf0e3ea, accent: 0xd0a8bc },

  { id: 'bloodstained',   name: 'Bloodstained Velvet', tier: 'milspec',   color: 0x7a1d24, accent: 0x3d0d12 },
  { id: 'carrot_camo',    name: 'Carrot Camo',        tier: 'milspec',    color: 0xd2762a, accent: 0x5c7a3a },
  { id: 'deep_ocean',     name: 'Deep Ocean',         tier: 'milspec',    color: 0x1b4f6b, accent: 0x0d2b3c },
  { id: 'wired',          name: 'Wired',              tier: 'milspec',    color: 0x2c2f36, accent: 0x54d6a8 },

  { id: 'chrome_warren',  name: 'Chrome Warren',      tier: 'restricted', color: 0xb8c0c8, accent: 0x6e7a86, metal: 0.85 },
  { id: 'doughnut_print', name: 'Doughnut Print',     tier: 'restricted', color: 0xf2c4d2, accent: 0x8a5a3b },
  { id: 'marbled_glaze',  name: 'Marbled Glaze',      tier: 'restricted', color: 0xeadfd2, accent: 0xc06a86 },

  { id: 'goat_pattern',   name: 'Goat Pattern',       tier: 'classified', color: 0xcfc6b4, accent: 0x2e2a26 },
  { id: 'fever_dream',    name: 'Fever Dream',        tier: 'classified', color: 0xd23ce0, accent: 0x35e0c8 },

  { id: 'binky',          name: 'Binky',              tier: 'covert',     color: 0x9ad8f2, accent: 0xf2a2d8, iridescent: true },

  { id: 'golden_glove',   name: 'Golden Glove',       tier: 'gold',       color: 0xffd24a, accent: 0xb8860b, metal: 0.95 },
];

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

const byTier = {};
for (const s of SKINS) (byTier[s.tier] ??= []).push(s);

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

export function rollSkin() {
  const tier = rollTier();
  const pool = byTier[tier] ?? byTier.consumer;
  const skin = pool[Math.floor(Math.random() * pool.length)];
  // float skews low — most drops are decent, a truly beaten one is its own find
  const float = Math.pow(Math.random(), 1.7);
  return { skin, tier, float };
}

export function valueOf(skin, float) {
  return Math.round(TIERS[skin.tier].base * (1 - float) * 0.55);
}

let NEXT = 1;
export function mintInstance({ skin, tier, float }) {
  return {
    instId: 'inst_' + (NEXT++).toString(36).padStart(4, '0'),
    skinId: skin.id,
    name: skin.name,
    tier,
    color: skin.color,
    accent: skin.accent,
    metal: skin.metal ?? 0.05,
    iridescent: !!skin.iridescent,
    float: +float.toFixed(3),
    wear: wearName(float),
  };
}
