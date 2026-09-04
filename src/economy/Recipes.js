// BAKING — GAME_DESIGN.md §6
//
// The other half of the premise, and the reason the gun is worth carrying: a
// glove catch pays coins on the spot, but a shot rabbit leaves a slab on the
// ground, and a slab is the only thing you can bake with. So the two weapons
// are two economies — cash now, or ingredients for something worth far more.
//
// This module is DATA AND RULES ONLY. It builds nothing, draws nothing and
// knows nothing about the table; `Bakery.js` renders it and `main.js` owns the
// inventory it reads. That keeps the eight recipes editable without touching a
// line of scene code.

// ── ingredients bought at the counter ── §6.2
export const SUPPLIES = {
  flour:    { name: 'Flour',    price: 6 },
  sugar:    { name: 'Sugar',    price: 8 },
  yeast:    { name: 'Yeast',    price: 12 },
  cinnamon: { name: 'Cinnamon', price: 14 },
  glaze:    { name: 'Glaze',    price: 10 },
  sprinkles:{ name: 'Sprinkles',price: 5 },
};

// ── the fryer's quality bands ── §6.3
// Time in the green over the bake, as a fraction, to a multiplier.
export const QUALITY = [
  { min: 0.90, name: 'PERFECT', mult: 1.5, tone: 'good' },
  { min: 0.70, name: 'GOLDEN',  mult: 1.2, tone: 'good' },
  { min: 0.40, name: 'FINE',    mult: 1.0, tone: '' },
  { min: 0.00, name: 'BURNT',   mult: 0.4, tone: 'bad' },
];

export function gradeBake(greenFraction) {
  return QUALITY.find((q) => greenFraction >= q.min) ?? QUALITY[QUALITY.length - 1];
}

// ── §6.4 ──
//
// `dough` is a map of rabbit-type key -> how many portions. `any` means any
// dough at all. `distinct` means N portions that must come from N DIFFERENT
// types, which is The Warren's whole idea and is why it cannot be expressed as
// a plain count.
export const RECIPES = [
  {
    id: 'plain_hopper', name: 'Plain Hopper', value: 40,
    dough: { cottontail: 1 }, supplies: ['flour', 'sugar'],
    unlock: { kind: 'start' },
    flavour: 'A doughnut. Roundly, unarguably a doughnut.',
  },
  {
    id: 'cinnamon_cottontail', name: 'Cinnamon Cottontail', value: 75,
    dough: { cottontail: 2 }, supplies: ['cinnamon'],
    unlock: { kind: 'start' },
    flavour: 'Twice the rabbit, and something warm on top of it.',
  },
  {
    id: 'lop_long_john', name: 'Lop-Eared Long John', value: 110,
    dough: { lop: 1 }, supplies: ['yeast'],
    unlock: { kind: 'day', day: 2 },
    flavour: 'A double portion, because a Lop is mostly ear and ear goes far.',
  },
  {
    id: 'jackrabbit_twist', name: 'Jackrabbit Twist', value: 190,
    dough: { jack: 1, cottontail: 1 }, supplies: ['flour', 'sugar'],
    unlock: { kind: 'caught', type: 'jack', n: 5 },
    flavour: 'Twisted, because a Jack will not lie flat even now.',
  },
  {
    id: 'sugar_binky', name: 'Sugar Binky', value: 240,
    dough: { binky: 1 }, supplies: ['sugar'],
    unlock: { kind: 'binky' },
    flavour: 'It was happy. That is, apparently, an ingredient.',
  },
  {
    id: 'midnight_cruller', name: 'Midnight Cruller', value: 420,
    dough: { black: 1, any: 2 }, supplies: ['glaze'],
    unlock: { kind: 'caught', type: 'black', n: 1 },
    flavour: 'The recipe card changes wording every time you read it.',
  },
  {
    id: 'the_warren', name: 'The Warren', value: 700,
    dough: { distinct: 5 }, supplies: ['flour', 'sugar', 'yeast'],
    unlock: { kind: 'completion', pct: 0.6 },
    flavour: 'Five rabbits who never met, and now share a plate.',
  },
  {
    id: 'dukes_old_fashioned', name: "Duke's Old Fashioned", value: 1400,
    dough: { duke: 1 }, supplies: ['flour', 'sugar', 'yeast', 'glaze'],
    unlock: { kind: 'caught', type: 'duke', n: 1 },
    flavour: 'One per Duke. There is only ever one Duke.',
  },
];

export const recipeById = (id) => RECIPES.find((r) => r.id === id);

// Why a recipe is still locked, in words a player can act on — or null if it is
// available. The wording is the whole point: "Day 2" tells you to wait, "Catch
// 5 Jackrabbits (2/5)" tells you to go and do something.
export function lockReason(recipe, stats) {
  const u = recipe.unlock;
  switch (u.kind) {
    case 'start':
      return null;
    case 'day':
      return (stats.day ?? 1) >= u.day ? null : `Day ${u.day}`;
    case 'caught': {
      const got = stats.caughtByType?.[u.type] ?? 0;
      if (got >= u.n) return null;
      const label = TYPE_LABEL[u.type] ?? u.type;
      return u.n === 1
        ? `Catch a ${label}`
        : `Catch ${u.n} ${label}s (${got}/${u.n})`;
    }
    case 'binky':
      return stats.binkyCatches > 0 ? null : 'Catch a rabbit mid-binky';
    case 'completion': {
      // Completion counts only the recipes that do NOT gate on completion, or
      // the rule would be self-referential and could never be satisfied.
      const pool = RECIPES.filter((r) => r.unlock.kind !== 'completion');
      const have = pool.filter((r) => (stats.baked?.[r.id] ?? 0) > 0).length;
      const need = Math.ceil(pool.length * u.pct);
      return have >= need ? null : `Bake ${need} different recipes (${have}/${need})`;
    }
    default:
      return null;
  }
}

const TYPE_LABEL = {
  cottontail: 'Cottontail', lop: 'Lop', jack: 'Jackrabbit',
  black: 'Black Rabbit', duke: 'Grand Duke', binky: 'binkying rabbit',
};

// Can it be baked RIGHT NOW with what is in the pantry? Returns null when yes,
// otherwise the first thing that is missing.
export function missingFor(recipe, dough, supplies) {
  for (const [k, n] of Object.entries(recipe.dough)) {
    if (k === 'any') {
      const total = Object.values(dough).reduce((a, b) => a + b, 0);
      if (total < n) return `${n} dough (have ${total})`;
    } else if (k === 'distinct') {
      const kinds = Object.entries(dough).filter(([, v]) => v > 0).length;
      if (kinds < n) return `${n} different doughs (have ${kinds})`;
    } else {
      const have = dough[k] ?? 0;
      if (have < n) return `${n}× ${TYPE_LABEL[k] ?? k} dough (have ${have})`;
    }
  }
  for (const s of recipe.supplies) {
    if ((supplies[s] ?? 0) < 1) return SUPPLIES[s].name;
  }
  return null;
}

// Spend the ingredients. Mutates both maps and returns what it took, so the
// caller can report it. Assumes missingFor() already said yes.
export function consume(recipe, dough, supplies) {
  const took = [];
  for (const [k, n] of Object.entries(recipe.dough)) {
    if (k === 'any' || k === 'distinct') {
      // Spend the most plentiful first so a rare dough is not eaten by a recipe
      // that would have accepted anything. Distinct takes one of each instead.
      const order = Object.entries(dough)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1]);
      const want = k === 'distinct' ? 1 : n;
      let left = k === 'distinct' ? n : n;
      for (const [type] of order) {
        if (left <= 0) break;
        const take = k === 'distinct' ? 1 : Math.min(want, dough[type], left);
        dough[type] -= take;
        left -= take;
        took.push(`${take}× ${TYPE_LABEL[type] ?? type}`);
        if (dough[type] <= 0) delete dough[type];
      }
    } else {
      dough[k] -= n;
      took.push(`${n}× ${TYPE_LABEL[k] ?? k}`);
      if (dough[k] <= 0) delete dough[k];
    }
  }
  for (const s of recipe.supplies) supplies[s] = (supplies[s] ?? 0) - 1;
  return took;
}

// How much a finished doughnut is worth: base, the fryer's grade, and a flat
// bonus for sprinkles (§6.2).
export function payout(recipe, grade, sprinkled = false) {
  return Math.round(recipe.value * grade.mult) + (sprinkled ? 8 : 0);
}
