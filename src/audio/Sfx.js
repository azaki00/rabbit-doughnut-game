// Player, world and UI sounds. All synthesized — no files.
//
// DESIGN RULE, learned the hard way: an earlier pass made almost everything a
// band-passed noise burst with a ~150ms decay, and the result was that every
// action sounded like the same "pff". Distinctness comes from three things, and
// each sound below deliberately varies all three:
//
//   1. SOURCE   — noise (physical, unpitched) vs oscillator (tonal, pitched).
//                 UI and rewards are tonal. Impacts and footsteps are noise.
//   2. REGISTER — each sound owns a frequency band. Footsteps live under 400Hz,
//                 coins around 2kHz, the reel tick at 5kHz. They never collide.
//   3. ENVELOPE — a click (2ms), a thump (200ms), a ring (700ms) and a swell
//                 (1.5s attack) read as different events even at the same pitch.

export class Sfx {
  constructor(audio) { this.a = audio; }

  // ── helpers ─────────────────────────────────────────────────────────────

  _tone(type, freq, bus, peak, attack, decay, at = null) {
    const a = this.a, t = at ?? a.t;
    const { o, g } = a.osc(type, freq, bus);
    a.env(g.gain, peak, attack, decay, t);
    o.start(t); o.stop(t + attack + decay + 0.05);
    return { o, g, t };
  }

  _noise(bus, filterType, freq, Q, peak, attack, decay, at = null) {
    const a = this.a, t = at ?? a.t;
    const { s, g } = a.noise(bus);
    const f = a.ctx.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq; f.Q.value = Q;
    g.disconnect(); g.connect(f); f.connect(a.buses[bus]);
    a.env(g.gain, peak, attack, decay, t);
    s.start(t); s.stop(t + attack + decay + 0.05);
    return { s, g, f, t };
  }

  // ── movement ────────────────────────────────────────────────────────────

  // LOW + VERY SHORT. Lives under 400Hz so it never competes with anything.
  footstep(intensity) {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { f } = this._noise('world', 'lowpass', 240 + Math.random() * 120, 1,
                              0.05 * (0.5 + intensity), 0.002, 0.055);
    f.frequency.exponentialRampToValueAtTime(90, t + 0.06);
    // a small pitched body, so it reads as ground contact rather than static
    this._tone('sine', 70 + Math.random() * 20, 'world', 0.045, 0.002, 0.05);
  }

  // Breathy, mid, SLOW attack — nothing else short has a slow attack.
  gasp() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { f } = this._noise('world', 'bandpass', 620, 1.6, 0.06, 0.10, 0.34);
    f.frequency.exponentialRampToValueAtTime(300, t + 0.4);
  }

  // ── the glove ───────────────────────────────────────────────────────────

  // TONAL CREAK, rising. Stretching leather, not a hiss.
  windUp() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { o, g } = a.osc('sawtooth', 110, 'ui');
    o.frequency.setValueAtTime(96, t);
    o.frequency.exponentialRampToValueAtTime(190, t + 0.42);
    const lp = a.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 6;
    // slow wobble makes it read as tension rather than a clean tone
    const wob = a.ctx.createOscillator(); wob.type = 'sine'; wob.frequency.value = 6.5;
    const wd = a.ctx.createGain(); wd.gain.value = 7;
    wob.connect(wd); wd.connect(o.frequency);
    g.disconnect(); g.connect(lp); lp.connect(a.buses.ui);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.56);
    o.start(t); wob.start(t); o.stop(t + 0.6); wob.stop(t + 0.6);
  }

  // WIDEBAND SWEEP, up then down. The only true whoosh at this pitch.
  lunge(charge) {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { f } = this._noise('world', 'bandpass', 300, 0.7,
                              0.10 + charge * 0.07, 0.012, 0.26);
    f.frequency.setValueAtTime(320, t);
    f.frequency.exponentialRampToValueAtTime(1500 + charge * 900, t + 0.10);
    f.frequency.exponentialRampToValueAtTime(240, t + 0.28);
  }

  // DEEP THUD + SCRAPE, bottom of the register. Unmistakably a failure.
  whiff() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { o } = this._tone('sine', 110, 'world', 0.14, 0.005, 0.24);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.24);
    const { f } = this._noise('world', 'lowpass', 800, 1, 0.06, 0.03, 0.30, t + 0.03);
    f.frequency.exponentialRampToValueAtTime(200, t + 0.34);
  }

  // ── rewards: all TONAL and BRIGHT, so money always sounds like money ────

  // Bell — fundamental plus stretched partials, long ring.
  coin() {
    const a = this.a; if (!a.ready) return;
    this._tone('sine', 1976, 'ui', 0.075, 0.002, 0.34);
    this._tone('sine', 2960, 'ui', 0.030, 0.002, 0.26);
    this._tone('sine', 4200, 'ui', 0.012, 0.002, 0.16);
  }

  // Rising major arpeggio on triangle — warm, obviously a win.
  clutch() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this._tone('triangle', f, 'ui', 0.12, 0.008, 0.30, t + i * 0.055));
  }

  // Cash register — mechanical clack, then a bright two-note ding.
  purchase() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    this._noise('ui', 'bandpass', 1200, 6, 0.10, 0.001, 0.03, t);
    this._tone('triangle', 1318.5, 'ui', 0.11, 0.004, 0.30, t + 0.05);
    this._tone('triangle', 1760,   'ui', 0.11, 0.004, 0.45, t + 0.13);
    this._tone('sine',      880,   'ui', 0.05, 0.004, 0.50, t + 0.13);
  }

  // Buzz — square waves a semitone apart. Nothing else in the game buzzes.
  deny() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    for (const t0 of [t, t + 0.12]) {
      this._tone('square', 146.8, 'ui', 0.06, 0.003, 0.10, t0);
      this._tone('square', 138.6, 'ui', 0.06, 0.003, 0.10, t0);
    }
  }

  // ── the gun ─────────────────────────────────────────────────────────────

  // Uses the recorded SHOTGUN-SFX sample when it is available, with a small
  // random pitch variation so repeated shots don't sound machine-stamped.
  // Falls back to the synthesized three-layer version below if the file is
  // missing, so the game never goes silent over a failed download.
  gunshot() {
    const a = this.a; if (!a.ready) return;

    if (a.hasSample('shotgun')) {
      a.playSample('shotgun', {
        gain: 0.9,
        rate: 0.96 + Math.random() * 0.08,
        bus: 'world',
      });
      return;
    }

    // ── synthesized fallback ──
    // Three layers in three bands: crack (>1.6k), body (<160), tail (sweep down).
    const t = a.t;
    this._noise('world', 'highpass', 1600, 0.7, 0.50, 0.001, 0.05, t);
    const { o } = this._tone('sine', 160, 'world', 0.42, 0.002, 0.22, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.20);
    const { f } = this._noise('world', 'lowpass', 2200, 0.6, 0.14, 0.02, 0.90, t + 0.02);
    f.frequency.exponentialRampToValueAtTime(280, t + 0.90);
  }

  dryFire() {
    const a = this.a; if (!a.ready) return;
    this._noise('ui', 'bandpass', 2600, 8, 0.10, 0.001, 0.028);
  }

  // Four clacks at different pitches over 1.6s. The RHYTHM identifies it.
  reload() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const clack = (t0, freq, peak) => this._noise('ui', 'bandpass', freq, 9, peak, 0.001, 0.04, t0);
    clack(t,        1500, 0.13);
    clack(t + 0.55,  760, 0.07);
    clack(t + 0.85,  760, 0.07);
    clack(t + 1.55, 2100, 0.16);
  }

  // Heavy and LOW — deliberately an octave under the glove's lunge so the two
  // whooshes can never be confused.
  hammerSwing() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { f } = this._noise('world', 'bandpass', 180, 1.1, 0.11, 0.14, 0.20, t);
    f.frequency.setValueAtTime(150, t + 0.16);
    f.frequency.exponentialRampToValueAtTime(560, t + 0.34);
  }

  // Soft thump of a carrot landing in grass — low and brief, no tail.
  carrotDrop() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    this._noise('world', 'lowpass', 320, 1.2, 0.09, 0.002, 0.07, t);
    this._tone('sine', 96, 'world', 0.06, 0.003, 0.09, t);
  }

  // Wet crunching. Short bursts at a rhythm, so it reads as nibbling.
  carrotEaten() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    for (let i = 0; i < 3; i++) {
      this._noise('world', 'bandpass', 900 + Math.random() * 500, 4,
                  0.10, 0.002, 0.05, t + i * 0.09);
    }
    this._tone('triangle', 660, 'ui', 0.05, 0.006, 0.16, t + 0.24);
  }

  // ── horses ──────────────────────────────────────────────────────────────

  // A snort: LOW filtered noise with a slow flutter, plus a hoof scuff. Sits
  // between the footstep band and the gasp band, and nothing else flutters.
  horseMount() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { s, g, f } = this._noise('world', 'bandpass', 260, 2.2, 0.13, 0.02, 0.34, t);
    f.frequency.exponentialRampToValueAtTime(150, t + 0.3);
    // the flutter is what makes it a horse rather than a sigh
    const lfo = a.ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 26;
    const ld = a.ctx.createGain(); ld.gain.value = 0.07;
    lfo.connect(ld); ld.connect(g.gain);
    lfo.start(t); lfo.stop(t + 0.4);
    this._tone('sine', 88, 'world', 0.07, 0.004, 0.12, t + 0.02);
    void s;
  }

  // The buck: a whinny that RISES then breaks, over a body thump. The only
  // rising-then-falling pitched sound in the game.
  horseBuck() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { o, g } = a.osc('sawtooth', 420, 'world');
    o.frequency.setValueAtTime(380, t);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.16);
    o.frequency.exponentialRampToValueAtTime(240, t + 0.52);
    const bp = a.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 3;
    g.disconnect(); g.connect(bp); bp.connect(a.buses.world);
    a.env(g.gain, 0.11, 0.012, 0.55, t);
    o.start(t); o.stop(t + 0.62);

    // hooves leaving the ground
    for (let i = 0; i < 2; i++) {
      this._noise('world', 'lowpass', 200, 1, 0.12, 0.002, 0.10, t + i * 0.11);
    }
  }

  // The dismount. Recorded, because there is no synthesizing this one.
  // Slightly randomised rate so being thrown four times in a row does not
  // sound machine-stamped.
  fart(delay = 0) {
    const a = this.a; if (!a.ready) return;
    const t = a.t + delay;
    if (a.hasSample('fart')) {
      a.playSample('fart', { gain: 0.9, rate: 0.9 + Math.random() * 0.25, bus: 'world', at: t });
      return;
    }
    // fallback: a buzzing sawtooth wobbling down through a lowpass
    const { o, g } = a.osc('sawtooth', 90, 'world');
    o.frequency.setValueAtTime(105, t);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.42);
    const lp = a.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 8;
    const wob = a.ctx.createOscillator(); wob.type = 'square'; wob.frequency.value = 34;
    const wd = a.ctx.createGain(); wd.gain.value = 22;
    wob.connect(wd); wd.connect(o.frequency);
    g.disconnect(); g.connect(lp); lp.connect(a.buses.world);
    a.env(g.gain, 0.13, 0.01, 0.45, t);
    o.start(t); wob.start(t);
    o.stop(t + 0.5); wob.stop(t + 0.5);
  }

  // ── chickens ────────────────────────────────────────────────────────────

  // Squawk: a fast rising-falling warble in the 700-1600Hz band, well above
  // the horse and well below the reel tick. Short, so a burst of four reads
  // as four birds rather than one smear.
  _cluck(at, base = 900, gain = 0.075) {
    const a = this.a;
    const { o, g } = a.osc('square', base, 'voice');
    o.frequency.setValueAtTime(base * 0.7, at);
    o.frequency.exponentialRampToValueAtTime(base * 1.6, at + 0.05);
    o.frequency.exponentialRampToValueAtTime(base * 0.55, at + 0.17);
    const bp = a.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = base * 1.2; bp.Q.value = 2.4;
    g.disconnect(); g.connect(bp); bp.connect(a.buses.voice);
    a.env(g.gain, gain, 0.008, 0.19, at);
    o.start(at); o.stop(at + 0.24);
  }

  // Thrown: the recorded clip in FULL, quietly, at its own speed.
  //
  // It runs several seconds, so overlapping copies turn a burst of two into a
  // wall. Only one full playback runs at a time; anything thrown while it is
  // still going gets a short synthesized squawk instead, which is what makes a
  // flock sound like a flock rather than like clipping.
  chickenThrow() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const busy = this._chickenClipUntil && t < this._chickenClipUntil;

    if (a.hasSample('chicken') && !busy) {
      const buf = a.samples.chicken;
      a.playSample('chicken', { gain: 0.30, rate: 1, bus: 'voice', at: t });
      this._chickenClipUntil = t + (buf?.duration ?? 3);
    } else {
      this._cluck(t, 1050 + Math.random() * 260, 0.045);
      this._cluck(t + 0.13, 1250 + Math.random() * 300, 0.03);
    }

    const { f } = this._noise('world', 'bandpass', 500, 1.1, 0.03, 0.03, 0.3, t);
    f.frequency.exponentialRampToValueAtTime(1400, t + 0.28);
  }

  // Landing: a scuff and a low cluck. Quiet — the clip from the throw is
  // usually still running underneath.
  chickenLand() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    this._noise('world', 'lowpass', 300, 1, 0.035, 0.002, 0.08, t);
    this._cluck(t + 0.04, 640 + Math.random() * 140, 0.03);
  }

  // Idle muttering while it chases you, on roughly a one-second timer per bird.
  // Very quiet and low: seven of these at once should read as a nervous flock
  // somewhere behind you, not as seven alarms.
  chickenIdle() {
    const a = this.a; if (!a.ready) return;
    this._cluck(a.t, 430 + Math.random() * 260, 0.022);
  }

  // Contact: the bird goes off like a small bag of flour.
  chickenHit() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    this._cluck(t, 1500, 0.09);
    this._noise('world', 'lowpass', 420, 0.9, 0.16, 0.002, 0.16, t);
    this._tone('sine', 120, 'world', 0.09, 0.003, 0.14, t);
  }

  // Killed. Recorded — a death squawk is not something worth synthesizing, and
  // this one is short enough that four in a row do not smear into each other.
  chickenDie() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    if (a.hasSample('chickenDie')) {
      a.playSample('chickenDie', { gain: 0.95, rate: 0.94 + Math.random() * 0.16, bus: 'voice', at: t });
      // a puff of feathers under it, so it lands in the world and not in the UI
      this._noise('world', 'highpass', 2600, 1.2, 0.035, 0.002, 0.09, t);
      return;
    }
    this._cluck(t, 1350, 0.085);
    this._noise('world', 'highpass', 2600, 1.2, 0.05, 0.002, 0.09, t);
  }

  // The Sovereign winding up to throw: a chorus, pitched low and wrong.
  bossCluck() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    for (let i = 0; i < 3; i++) this._cluck(t + i * 0.07, 380 + i * 90, 0.06);
  }

  // ── meat ────────────────────────────────────────────────────────────────

  // Wet slap. Lowest, dullest thing in the game after the footstep.
  meatDrop() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { f } = this._noise('world', 'lowpass', 480, 0.8, 0.13, 0.002, 0.12, t);
    f.frequency.exponentialRampToValueAtTime(160, t + 0.11);
    this._tone('sine', 82, 'world', 0.07, 0.003, 0.13, t);
  }

  // Picking it up: the coin chime, one fifth lower, so it reads as related but
  // not identical.
  meatPickup() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    this._tone('triangle', 1180, 'ui', 0.07, 0.004, 0.13, t);
    this._tone('triangle', 1770, 'ui', 0.05, 0.004, 0.20, t + 0.055);
  }

  // ── the toothbrush and the shake ────────────────────────────────────────

  // A dry plastic swish. Very high, very short, and quieter than anything
  // else — the toothbrush's whole point is that nothing hears it.
  brushSwing() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { f } = this._noise('world', 'highpass', 3400, 0.9, 0.035, 0.004, 0.07, t);
    f.frequency.exponentialRampToValueAtTime(6200, t + 0.06);
  }

  // Drinking one: a rising two-note swell with a gulp under it. The only
  // rising pitched pair in the game, so it never reads as a coin.
  heal() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    this._tone('sine', 420, 'ui', 0.07, 0.03, 0.26, t);
    this._tone('sine', 630, 'ui', 0.06, 0.03, 0.34, t + 0.12);
    this._tone('sine', 840, 'ui', 0.05, 0.04, 0.42, t + 0.24);
    const { f } = this._noise('world', 'lowpass', 700, 1.1, 0.05, 0.02, 0.3, t + 0.02);
    f.frequency.exponentialRampToValueAtTime(260, t + 0.3);
  }

  // Hitting the ground with your whole body: a deep thump with a scuff of
  // grass over it, and a grunt. Lowest thing in the game.
  bodyFall() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { f } = this._noise('world', 'lowpass', 220, 0.9, 0.20, 0.002, 0.22, t);
    f.frequency.exponentialRampToValueAtTime(70, t + 0.2);
    this._tone('sine', 58, 'world', 0.13, 0.003, 0.26, t);
    // the grass scuff
    this._noise('world', 'bandpass', 2200, 1.3, 0.05, 0.01, 0.2, t + 0.03);
    // and a winded grunt
    const { o, g } = a.osc('sawtooth', 150, 'voice');
    o.frequency.setValueAtTime(165, t + 0.04);
    o.frequency.exponentialRampToValueAtTime(96, t + 0.34);
    const lp = a.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 3;
    g.disconnect(); g.connect(lp); lp.connect(a.buses.voice);
    a.env(g.gain, 0.07, 0.02, 0.3, t + 0.04);
    o.start(t + 0.04); o.stop(t + 0.42);
  }

  // ── courtship ───────────────────────────────────────────────────────────

  // Two soft rising thirds. Sweet, quiet, and slightly too sincere.
  courtship() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    this._tone('triangle', 523, 'ui', 0.045, 0.02, 0.3, t);
    this._tone('triangle', 659, 'ui', 0.040, 0.02, 0.36, t + 0.16);
  }

  // The birth: the sweetness curdles. A bright chord that bends downward into
  // something wrong, over a wet thump.
  mutantBorn() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    for (let i = 0; i < 3; i++) {
      const { o, g } = a.osc('triangle', 0, 'voice');
      const base = [660, 830, 990][i];
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * 0.42, t + 0.9);
      g.connect(a.buses.voice);
      a.env(g.gain, 0.055, 0.02, 0.95, t + i * 0.05);
      o.start(t); o.stop(t + 1.1);
    }
    const { f } = this._noise('world', 'lowpass', 520, 0.9, 0.16, 0.004, 0.34, t + 0.5);
    f.frequency.exponentialRampToValueAtTime(120, t + 0.8);
    this._tone('sine', 64, 'world', 0.11, 0.004, 0.5, t + 0.5);
  }

  // ── conversation ────────────────────────────────────────────────────────

  // Moving the selection: a single very short, very quiet high tick. Sits above
  // the coin band and below the reel tick, so it belongs to neither.
  uiMove() {
    const a = this.a; if (!a.ready) return;
    this._tone('sine', 2400, 'ui', 0.022, 0.001, 0.03, a.t);
  }

  // Choosing one: the same tick with a lower partner under it, so it reads as
  // a commitment rather than another move.
  uiPick() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    this._tone('sine', 2400, 'ui', 0.03, 0.001, 0.04, t);
    this._tone('triangle', 900, 'ui', 0.035, 0.003, 0.11, t + 0.012);
  }

  // ── weather ─────────────────────────────────────────────────────────────

  // Thunder: a long, low, filtered roar with a crack on the front. Occupies a
  // band nothing else touches (sub-200Hz sustained for two seconds) so it
  // never fights the boss or the gun, and the crack sells the distance.
  thunder(intensity = 1) {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const gain = 0.16 * (0.5 + intensity * 0.5);

    // the crack — bright, immediate, short
    const { f: crack } = this._noise('world', 'highpass', 1800, 0.7, gain * 0.5, 0.002, 0.16, t);
    crack.frequency.exponentialRampToValueAtTime(420, t + 0.15);

    // the roll — a long lowpassed rumble that opens and closes twice, which is
    // what makes it read as thunder rather than as a whoosh
    const { s: src, g, f } = this._noise('world', 'lowpass', 420, 0.9, gain, 0.06, 2.2, t + 0.02);
    f.frequency.setValueAtTime(420, t);
    f.frequency.exponentialRampToValueAtTime(90, t + 1.1);
    f.frequency.exponentialRampToValueAtTime(180, t + 1.5);
    f.frequency.exponentialRampToValueAtTime(60, t + 2.2);
    // a slow tremolo on the tail, so the roll wanders
    const lfo = a.ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 1.7;
    const ld = a.ctx.createGain(); ld.gain.value = gain * 0.35;
    lfo.connect(ld); ld.connect(g.gain);
    lfo.start(t); lfo.stop(t + 2.4);
    void src;

    // and the sub, felt more than heard
    this._tone('sine', 42, 'world', gain * 0.7, 0.05, 1.9, t + 0.03);
  }

  // ── the shell ───────────────────────────────────────────────────────────

  // Bright metallic ring, very high, long decay. Says "that did nothing".
  shellPing() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    this._tone('triangle', 3140, 'ui', 0.070, 0.001, 0.42, t);
    this._tone('triangle', 4710, 'ui', 0.035, 0.001, 0.30, t);
    this._tone('sine',     6280, 'ui', 0.015, 0.001, 0.20, t);
  }

  // Dry crunch: hard 1ms attack, no tail, and a body that drops in pitch with
  // each hit as the shell gives way.
  shellCrack(progress) {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    this._noise('world', 'highpass', 2400 - progress * 900, 0.8, 0.32, 0.001, 0.10, t);
    this._noise('world', 'bandpass', 700, 3, 0.24, 0.002, 0.16, t);
    const { o } = this._tone('triangle', 200 - progress * 70, 'world', 0.26, 0.003, 0.24, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.24);
  }

  // Wooden creak — pitched, rising, hollow.
  chestOpen() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { o } = this._tone('sawtooth', 150, 'world', 0.07, 0.03, 0.34, t);
    o.frequency.exponentialRampToValueAtTime(420, t + 0.34);
    this._noise('world', 'bandpass', 500, 2, 0.05, 0.02, 0.30, t);
  }

  // ── case reel ───────────────────────────────────────────────────────────

  // 5kHz, 6ms, no body at all. The shortest sound in the game by design — it
  // fires dozens of times a second at the start of the reel.
  reelTick() {
    const a = this.a; if (!a.ready) return;
    this._noise('ui', 'bandpass', 5000, 12, 0.05, 0.0008, 0.006);
  }

  reelWin(tier) {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const sets = {
      consumer:   [[392], 0.10, 'sine'],
      industrial: [[392, 523], 0.12, 'sine'],
      milspec:    [[392, 523, 659], 0.15, 'triangle'],
      restricted: [[392, 523, 659, 784], 0.18, 'triangle'],
      classified: [[440, 554, 659, 880], 0.20, 'triangle'],
      covert:     [[440, 554, 659, 880, 1109], 0.24, 'triangle'],
      gold:       [[523, 659, 784, 1047, 1319, 1568], 0.30, 'sawtooth'],
    };
    const [notes, peak, type] = sets[tier] ?? sets.consumer;
    notes.forEach((f, i) => this._tone(type, f, 'ui', peak, 0.01, 0.5, t + i * 0.075));
  }

  // ── the Sovereign ───────────────────────────────────────────────────────

  // SLOW SWELL — half-second attack over 1.5s. Nothing else builds like this.
  bossWake() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { o, g } = a.osc('sawtooth', 28, 'world');
    o.frequency.setValueAtTime(24, t);
    o.frequency.exponentialRampToValueAtTime(96, t + 1.6);
    const lp = a.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 340; lp.Q.value = 8;
    g.disconnect(); g.connect(lp); lp.connect(a.buses.world);
    a.env(g.gain, 0.5, 0.5, 1.5, t);
    o.start(t); o.stop(t + 2.2);
    this._noise('world', 'highpass', 3200, 0.7, 0.10, 0.6, 1.6, t);   // sizzle
  }

  // WET SLAP — mid band with a fast pitch-down. Not confusable with a gunshot.
  bossHit(crit) {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { f } = this._noise('ui', 'bandpass', crit ? 1500 : 800, 3,
                              crit ? 0.26 : 0.15, 0.002, 0.13, t);
    f.frequency.exponentialRampToValueAtTime(180, t + 0.14);
    if (crit) this._tone('square', 1480, 'ui', 0.10, 0.003, 0.09, t);
  }

  // SUB-BASS, below everything else, with a long lowpassed rumble.
  bossSlam() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { o } = this._tone('sine', 120, 'world', 0.60, 0.003, 0.50, t);
    o.frequency.exponentialRampToValueAtTime(26, t + 0.45);
    this._noise('world', 'lowpass', 620, 0.7, 0.32, 0.004, 0.42, t);
  }

  // The only sound that sweeps UPWARD, so it always reads as incoming.
  bossSpit() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { o } = this._tone('sawtooth', 200, 'world', 0.13, 0.006, 0.17, t);
    o.frequency.exponentialRampToValueAtTime(780, t + 0.16);
  }

  // A long, deflating, deeply undignified descent, then a splat.
  bossDeath() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { o, g } = a.osc('sawtooth', 300, 'world');
    o.frequency.setValueAtTime(300, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 2.2);
    const bp = a.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 10;
    bp.frequency.setValueAtTime(700, t);
    bp.frequency.exponentialRampToValueAtTime(90, t + 2.2);
    const vib = a.ctx.createOscillator(); vib.type = 'sine'; vib.frequency.value = 7;
    const vd = a.ctx.createGain();
    vd.gain.setValueAtTime(4, t); vd.gain.linearRampToValueAtTime(46, t + 2.2);
    vib.connect(vd); vd.connect(o.frequency);
    g.disconnect(); g.connect(bp); bp.connect(a.buses.world);
    a.env(g.gain, 0.4, 0.02, 2.2, t);
    o.start(t); vib.start(t); o.stop(t + 2.4); vib.stop(t + 2.4);
    this._noise('world', 'lowpass', 500, 0.7, 0.40, 0.005, 0.50, t + 2.15);
  }

  // Two low dissonant tones — a hurt sound that can't be heard as a reward.
  playerHurt() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { o } = this._tone('sine', 200, 'ui', 0.20, 0.004, 0.26, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.25);
    this._tone('sawtooth', 92, 'ui', 0.07, 0.004, 0.30, t);
  }

  // Death. Everything drops away at once: a long descending glide down to
  // almost nothing, over a filtered thud. The only sound in the game that
  // takes two full seconds to finish, which is why it lands as final.
  playerDeath() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;

    // Recorded, if it is there. It plays over the fifteen seconds of the death
    // screen, so it is given the whole stage: nothing else is firing.
    if (a.hasSample('playerDying')) {
      a.playSample('playerDying', { gain: 0.95, rate: 1, bus: 'voice', at: t });
      // keep the body-hitting-the-ground thump underneath it
      const { f: g } = this._noise('world', 'lowpass', 260, 0.9, 0.14, 0.002, 0.4, t);
      g.frequency.exponentialRampToValueAtTime(60, t + 0.35);
      return;
    }

    // the glide
    for (const [start, end, gain, delay] of [[280, 44, 0.13, 0], [186, 29, 0.10, 0.05]]) {
      const { o, g } = a.osc('sawtooth', start, 'ui');
      o.frequency.setValueAtTime(start, t + delay);
      o.frequency.exponentialRampToValueAtTime(end, t + delay + 1.7);
      const lp = a.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1200; lp.Q.value = 2;
      lp.frequency.exponentialRampToValueAtTime(160, t + delay + 1.7);
      g.disconnect(); g.connect(lp); lp.connect(a.buses.ui);
      a.env(g.gain, gain, 0.01, 1.9, t + delay);
      o.start(t + delay); o.stop(t + delay + 2.1);
    }

    // and the body hitting the ground under it
    const { f } = this._noise('world', 'lowpass', 260, 0.9, 0.18, 0.002, 0.4, t);
    f.frequency.exponentialRampToValueAtTime(60, t + 0.35);
    this._tone('sine', 50, 'world', 0.14, 0.004, 0.55, t);
  }
}
