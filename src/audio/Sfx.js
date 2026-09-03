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
}
