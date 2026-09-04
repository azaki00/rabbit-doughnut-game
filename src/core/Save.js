// PERSISTENCE — GAME_DESIGN.md §14
//
// One localStorage key, one JSON blob, written on the events §14 lists rather
// than on a timer. A timer would either fire during the frame budget or lose
// the last few seconds of a session; the events are the moments where something
// the player would be annoyed to lose actually changed.
//
// Settings are NOT in here. `ui/Settings.js` already owns its own key and has
// since before this file existed. Persisting them in both places would give the
// game two sources of truth for FOV and volume, and the loser of that race
// would depend on module import order.

import { skinById, mintInstance } from '../economy/Skins.js';

export const SAVE_KEY = 'hareandglaze.save.v1';
export const SAVE_VERSION = 1;

// Skin instances are NOT stored whole. Everything on a minted instance —
// palette, pattern, metalness, wear name, the derived colours — is a pure
// function of (skinId, float), so storing the triple and re-minting on load
// keeps the save small and, more importantly, means a rebalance of the skin
// tables reaches old saves instead of being frozen into them.
const packSkin = (inst) => ({
  i: inst.instId,
  s: inst.skinId,
  c: inst.collection,
  f: inst.float,
});

function unpackSkin(rec) {
  const skin = skinById(rec.s);
  if (!skin) return null;            // skin deleted from the tables since saving
  const inst = mintInstance({
    skin,
    tier: skin.tier,
    float: typeof rec.f === 'number' ? rec.f : 0.2,
    collection: rec.c ?? 'glove',
  });
  // mintInstance issues a fresh sequential id; keep the saved one so `equipped`
  // still points at the right instance.
  if (rec.i) inst.instId = rec.i;
  return inst;
}

export class Save {
  constructor() {
    this.enabled = true;
    // Private browsing and blocked site data both throw on the *first write*,
    // not on construction, so probe once here rather than discovering it during
    // a purchase.
    try {
      localStorage.setItem(SAVE_KEY + '.probe', '1');
      localStorage.removeItem(SAVE_KEY + '.probe');
    } catch {
      this.enabled = false;
      console.warn('[save] localStorage unavailable — progress will not persist');
    }
  }

  // `sources` is the live game state, passed in by main.js. This module imports
  // nothing from the systems it saves; it is handed what it needs, like every
  // other system in the game.
  write({ state, hammer, equipped }) {
    if (!this.enabled) return false;
    const data = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      day: state.day,
      coins: state.coins,
      carrots: state.carrots,
      healKits: state.healKits,
      proteinShake: state.proteinShake,
      blackMeat: state.blackMeat,
      // §6: the pantry. `meat` holds whole slabs because each one remembers
      // what it was worth and what it came from; dough is just a tally.
      meat: state.meat,
      dough: state.dough,
      supplies: state.supplies,
      baked: state.baked,
      caughtByType: state.caughtByType,
      binkyCatches: state.binkyCatches,
      hammer: !!hammer?.owned,
      skins: state.skins.map(packSkin),
      equipped: { ...equipped },
      stats: { caught: state.caught, shot: state.shot },
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      // Quota is the realistic failure. Disable rather than throw every save.
      this.enabled = false;
      console.warn('[save] write failed, persistence disabled:', e.message);
      return false;
    }
  }

  // Returns null when there is nothing to load or the blob is unusable. A
  // corrupt save must not stop the game from starting — losing progress is bad,
  // a black screen is worse.
  read() {
    if (!this.enabled) return null;
    let raw;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch { return null; }
    if (!raw) return null;

    let d;
    try {
      d = JSON.parse(raw);
    } catch {
      console.warn('[save] corrupt save discarded');
      return null;
    }
    if (!d || typeof d !== 'object') return null;
    if (d.version !== SAVE_VERSION) {
      // No migrations exist yet — v1 is the first schema. When v2 arrives this
      // is where the ladder goes; until then an unknown version is discarded
      // rather than half-read into a state nothing has validated.
      console.warn(`[save] version ${d.version} not understood, starting fresh`);
      return null;
    }

    const skins = Array.isArray(d.skins)
      ? d.skins.map(unpackSkin).filter(Boolean)
      : [];

    return {
      day: num(d.day, 1),
      coins: num(d.coins, 0),
      carrots: num(d.carrots, 0),
      healKits: num(d.healKits, 0),
      proteinShake: num(d.proteinShake, 0),
      blackMeat: num(d.blackMeat, 0),
      meat: Array.isArray(d.meat) ? d.meat.filter((m) => m && m.type) : [],
      dough: obj(d.dough),
      supplies: obj(d.supplies),
      baked: obj(d.baked),
      caughtByType: obj(d.caughtByType),
      binkyCatches: num(d.binkyCatches, 0),
      hammer: !!d.hammer,
      skins,
      equipped: d.equipped ?? {},
      caught: num(d.stats?.caught, 0),
      shot: num(d.stats?.shot, 0),
      savedAt: d.savedAt ?? 0,
    };
  }

  clear() {
    try { localStorage.removeItem(SAVE_KEY); return true; }
    catch { return false; }
  }

  has() {
    try { return !!localStorage.getItem(SAVE_KEY); }
    catch { return false; }
  }
}

// Coerce to a finite number, because a hand-edited save should not turn coins
// into NaN and poison every arithmetic op downstream.
function num(v, fallback) {
  return Number.isFinite(v) ? v : fallback;
}

// A plain tally map, with every non-numeric value dropped. A hand-edited save
// must not put `"three"` into the dough count and break arithmetic downstream.
function obj(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out = {};
  for (const [k, n] of Object.entries(v)) if (Number.isFinite(n) && n > 0) out[k] = n;
  return out;
}
