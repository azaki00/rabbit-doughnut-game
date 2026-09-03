// Rabbit types — GAME_DESIGN.md §5.3
// One parameterised builder produces every type; these are the knobs.
//
// Speed reference: the player walks at 4.0 m/s and sprints at 7.2 m/s.
// Tuned down twice on playtest feedback. Everything is now slower than a
// sprint, so the hunt is about closing distance and timing the lunge rather
// than about foot speed. The Jack stays the fastest by a clear margin.

export const TYPES = {
  cottontail: {
    name: 'Cottontail',
    value: 10,
    speed: 3.4, panicSpeed: 3.4,
    idleFreq: 1.35, panicFreq: 2.4, hopLength: 1.35,
    body: 0.30, len: 0.42, earLen: 0.20, earWidth: 0.052, legLen: 0.13,
    colors: { main: 0xc9a882, belly: 0xf0e4d2, ear: 0xe6b8b0, tail: 0xfff8ee, eye: 0x241a16 },
    tail: 0.075,
    fleeStamina: 6.0,          // gives up and grazes again after 6s
    vision: 18, fov: 300,
  },

  lop: {
    name: 'Lop',
    value: 15,
    speed: 2.4, panicSpeed: 2.4,
    idleFreq: 1.15, panicFreq: 1.8, hopLength: 1.00,
    body: 0.37, len: 0.46, earLen: 0.30, earWidth: 0.082, legLen: 0.105,
    colors: { main: 0xf2e2c4, belly: 0xfaf1e0, ear: 0xe8c8b8, tail: 0xfff8ee, eye: 0x241a16 },
    tail: 0.085,
    lopEars: true,             // ears hang down and drag
    tripChance: 0.15,          // trips over its own ears
    fleeStamina: 4.0,
    vision: 14, fov: 300,
  },

  jack: {
    name: 'Jack',
    value: 45,
    speed: 6.0, panicSpeed: 6.0,
    idleFreq: 1.45, panicFreq: 2.6, hopLength: 2.00,
    body: 0.27, len: 0.50, earLen: 0.36, earWidth: 0.05, legLen: 0.20,
    colors: { main: 0x9c8f7a, belly: 0xded4c2, ear: 0xb59a8a, tail: 0xf2ebdd, eye: 0x1d1512 },
    tail: 0.055,
    fleeStamina: 12.0,
    vision: 24, fov: 300,
  },

  black: {
    name: 'Black Rabbit',
    value: 120,
    speed: 4.2, panicSpeed: 4.2,
    idleFreq: 1.3, panicFreq: 2.0, hopLength: 1.45,
    body: 0.36, len: 0.52, earLen: 0.28, earWidth: 0.058, legLen: 0.16,
    colors: { main: 0x14121a, belly: 0x1c1a24, ear: 0x201c28, tail: 0x22202c, eye: 0xc4302a },
    tail: 0.07,
    matte: true,               // no specular at all
    eyeGlow: true,
    scale: 1.18,               // slightly too large
    circler: true,             // never flees; circles and stares — §13
    circleRadius: 8,
    silent: true,
    fleeStamina: Infinity,
    vision: 30, fov: 360,
  },
};

export const SPAWNABLE = ['cottontail', 'cottontail', 'cottontail', 'lop', 'lop', 'jack'];
