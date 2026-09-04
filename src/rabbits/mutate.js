// MUTANTS.
//
// Two rabbits that have spent ten seconds barging into each other produce a
// third that is bigger than both of them and wrong in a way neither parent is.
//
// ── THE CAP ──
// Size and price are the SAME NUMBER seen twice. A mutant's value is capped at
// 1000c, and its scale is derived directly from that value, so:
//
//   · nothing can ever be worth more than 1000c, however it was bred
//   · a 1000c mutant is exactly as big as a mutant can get
//   · a 300c mutant is visibly a smaller animal than a 900c one
//
// Without this, two mutants breeding produced a third worth four times either
// parent at three times the size, and a generation later the meadow was full of
// building-sized rabbits worth more than the boss. The cap is applied to the
// value first and the size follows from it, which is what keeps the two honest
// with each other: you can price a mutant by looking at it.
//
// Nothing here is a recolour. The proportions are re-rolled hard enough that a
// mutant reads as a different animal at fifty metres: ears longer than its
// body, a head twice the size it should be, legs that do not match.

const MAX_VALUE = 1000;   // hard ceiling, whatever the parents were worth
const MAX_SCALE = 2.4;    // and the size that goes with it
const MIN_SCALE = 1.25;   // the smallest a mutant can be

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rand = (lo, hi) => lo + Math.random() * (hi - lo);

// Deliberately unpleasant palettes. Rabbits are beige and grey; these are not.
const MUTANT_COATS = [
  { main: 0x6d3f7a, belly: 0x9a6ab0, ear: 0xd06ab8, tail: 0xe0a8f0, eye: 0xf2f24a },
  { main: 0x2f6d5a, belly: 0x58a888, ear: 0x8fe0b0, tail: 0xd0f0e0, eye: 0xff3a2a },
  { main: 0xc44a2a, belly: 0xe89a58, ear: 0xffcf6a, tail: 0xfff0c0, eye: 0x2a2a2a },
  { main: 0xd8d0a8, belly: 0xf0ecd0, ear: 0xc85a6a, tail: 0xffffff, eye: 0xd02a2a },
  { main: 0x1e2a4a, belly: 0x3a4a80, ear: 0x6a7ad0, tail: 0x9aa8f0, eye: 0x4af0e0 },
  { main: 0x8a1a2a, belly: 0xc04a56, ear: 0x2a1a1a, tail: 0x50202a, eye: 0xf0e04a },
];

const MUTANT_PREFIX = ['Wrong', 'Second', 'Elder', 'Bloated', 'Wet', 'Too-Many', 'Unasked', 'Grand'];
const MUTANT_NOUN = ['Hare', 'Warren-Thing', 'Litter', 'Cousin', 'Nephew', 'Result', 'Yield'];

// Build a brand-new type from two parents. Not an average of them: the point
// is that it exceeds both.
export function makeMutant(a, b) {
  const avg = (k) => (a[k] + b[k]) / 2;
  const parentScale = Math.max(a.scale ?? 1, b.scale ?? 1);

  // Price first, hard-capped. Two mutant parents cannot compound past this.
  const value = Math.min(
    MAX_VALUE,
    Math.round((a.value + b.value) * rand(1.6, 2.6)),
  );

  // Size follows price, so the two can never disagree. Still bigger than the
  // parents where the ceiling allows it — at the cap it simply matches.
  const t = value / MAX_VALUE;
  const scale = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE + (MAX_SCALE - MIN_SCALE) * t, parentScale * 1.02),
  );

  const coat = pick(MUTANT_COATS);

  // Re-roll the proportions hard. Each of these is independently stretched, so
  // limbs and ears end up mismatched rather than uniformly scaled up.
  const body = avg('body') * rand(1.1, 1.75);
  const len = avg('len') * rand(0.85, 1.9);
  const earLen = avg('earLen') * rand(0.5, 3.2);
  const earWidth = avg('earWidth') * rand(0.7, 2.4);
  const legLen = avg('legLen') * rand(0.45, 1.7);

  // Big things are slow. A mutant is worth a great deal and cannot outrun you,
  // which is what stops it being a punishment for letting them breed.
  const speed = Math.max(1.2, avg('speed') * rand(0.5, 0.85) / Math.sqrt(scale));

  return {
    name: `${pick(MUTANT_PREFIX)} ${pick(MUTANT_NOUN)}`,
    mutant: true,
    value,

    speed,
    panicSpeed: speed * rand(1.0, 1.35),
    idleFreq: avg('idleFreq') * rand(0.55, 0.9),
    panicFreq: avg('panicFreq') * rand(0.6, 0.95),
    hopLength: avg('hopLength') * rand(1.1, 1.8),

    body, len, earLen, earWidth, legLen,
    tail: avg('tail') * rand(0.6, 2.6),
    colors: coat,
    scale,

    fleeStamina: rand(5, 14),
    vision: avg('vision') * rand(0.7, 1.2),
    fov: 300,

    // ── the deformities ── read by RabbitMesh
    extraEars: Math.random() < 0.45 ? 1 + Math.floor(Math.random() * 2) : 0,
    extraEyes: Math.random() < 0.55 ? 2 + Math.floor(Math.random() * 4) : 0,
    lumps: Math.random() < 0.7 ? 2 + Math.floor(Math.random() * 5) : 0,
    twoHeads: Math.random() < 0.18,
    limpSide: Math.random() < 0.5 ? -1 : 1,
    eyeGlow: Math.random() < 0.5,

    // what it leaves when shot — huge, and an unappetising colour
    meat: {
      scale: 1.3 + scale * 0.4,
      color: coat.main,
      fat: coat.belly,
      label: 'Mutant cut',
    },
  };
}
