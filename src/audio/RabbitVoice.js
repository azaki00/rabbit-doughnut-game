// Rabbit voices — GAME_DESIGN.md §5.4
// All synthesized. No files. Comedy rule: pitch variance IS the joke, so
// randomise aggressively — six rabbits fleeing should sound like a broken
// orchestra.

export class RabbitVoice {
  constructor(audio, listener) {
    this.a = audio;
    this.listener = listener;     // () => THREE.Vector3
    this.lastGrunt = 0;
  }

  _gain(rabbit) {
    if (!this.a.ready) return 0;
    if (rabbit.type.silent) return 0;
    const d = rabbit.position.distanceTo(this.listener());
    return this.a.gainFor(d);
  }

  // Squeaky toy having a thought.
  chirp(r) {
    const g = this._gain(r) * 0.10; if (g <= 0.001) return;
    const a = this.a, t = a.t, p = r.voicePitch;
    for (const det of [1, 1.012]) {
      const { o, g: gn } = a.osc('square', 380 * p * det, 'voice');
      o.frequency.setValueAtTime(380 * p * det, t);
      o.frequency.exponentialRampToValueAtTime(620 * p * det, t + 0.03);
      a.env(gn.gain, g * 0.5, 0.005, 0.045, t);
      o.start(t); o.stop(t + 0.09);
    }
  }

  // Short "boop" — the freeze.
  alert(r) {
    const g = this._gain(r) * 0.16; if (g <= 0.001) return;
    const a = this.a, t = a.t;
    const { o, g: gn } = a.osc('sine', 220 * r.voicePitch, 'voice');
    a.env(gn.gain, g, 0.004, 0.06, t);
    o.start(t); o.stop(t + 0.09);
  }

  // A rubber duck being outrun.
  squeal(r) {
    const g = this._gain(r) * 0.13; if (g <= 0.001) return;
    const a = this.a, t = a.t, p = r.voicePitch;

    const { o, g: gn } = a.osc('sawtooth', 700 * p, 'voice');
    o.frequency.setValueAtTime(700 * p, t);
    o.frequency.exponentialRampToValueAtTime(1400 * p, t + 0.30);

    const bp = a.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 4;
    bp.frequency.setValueAtTime(900 * p, t);
    bp.frequency.exponentialRampToValueAtTime(2000 * p, t + 0.30);

    // 14 Hz tremolo
    const trem = a.ctx.createOscillator();
    trem.type = 'sine'; trem.frequency.value = 14;
    const tremG = a.ctx.createGain(); tremG.gain.value = 0.45;
    trem.connect(tremG); tremG.connect(gn.gain);

    gn.disconnect();
    gn.connect(bp); bp.connect(a.buses.voice);

    a.env(gn.gain, g, 0.01, 0.30, t);
    o.start(t); trem.start(t);
    o.stop(t + 0.34); trem.stop(t + 0.34);
  }

  // One per hind plant. In a group this becomes a rhythm section.
  hopGrunt(r) {
    const g = this._gain(r) * 0.055; if (g <= 0.001) return;
    const a = this.a, t = a.t;
    if (t - this.lastGrunt < 0.02) return;   // cheap voice cap
    this.lastGrunt = t;

    const { s, g: gn } = a.noise('voice');
    const bp = a.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 420 * r.voicePitch;
    bp.Q.value = 2.5;
    gn.disconnect(); gn.connect(bp); bp.connect(a.buses.voice);
    a.env(gn.gain, g, 0.003, 0.028, t);
    s.start(t); s.stop(t + 0.05);
  }

  // THE SHOWPIECE — descending kazoo into a wet blorp. §5.4
  caught(r) {
    if (!this.a.ready) return;
    const a = this.a, t = a.t, p = r.voicePitch;
    const g = 0.34;   // always close; you're holding it

    if (r.type.silent) return;

    // kazoo: sawtooth through a very resonant bandpass, sliding down
    const { o, g: gn } = a.osc('sawtooth', 900 * p, 'voice');
    o.frequency.setValueAtTime(900 * p, t);
    o.frequency.exponentialRampToValueAtTime(180 * p, t + 0.70);

    const bp = a.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 14;
    bp.frequency.setValueAtTime(1100 * p, t);
    bp.frequency.exponentialRampToValueAtTime(240 * p, t + 0.70);

    // vibrato that WIDENS as it falls — the undignified part
    const vib = a.ctx.createOscillator();
    vib.type = 'sine'; vib.frequency.value = 11;
    const vibDepth = a.ctx.createGain();
    vibDepth.gain.setValueAtTime(8, t);
    vibDepth.gain.linearRampToValueAtTime(60, t + 0.70);
    vib.connect(vibDepth); vibDepth.connect(o.frequency);

    gn.disconnect(); gn.connect(bp); bp.connect(a.buses.voice);
    a.env(gn.gain, g, 0.012, 0.70, t);
    o.start(t); vib.start(t);
    o.stop(t + 0.76); vib.stop(t + 0.76);

    // ...ending in a wet blorp
    const t2 = t + 0.62;
    const { o: bo, g: bg } = a.osc('sine', 260 * p, 'voice');
    bo.frequency.setValueAtTime(260 * p, t2);
    bo.frequency.exponentialRampToValueAtTime(70 * p, t2 + 0.16);
    const lp = a.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 6;
    bg.disconnect(); bg.connect(lp); lp.connect(a.buses.voice);
    a.env(bg.gain, g * 0.9, 0.01, 0.18, t2);
    bo.start(t2); bo.stop(t2 + 0.24);
  }

  // Shot. The joke does not land here: the kazoo is cut off almost before it
  // starts. Cheap laughs are earned by catching; this is just a stop.
  shot(r) {
    if (!this.a.ready || r.type.silent) return;
    const a = this.a, t = a.t, p = r.voicePitch;
    const { o, g } = a.osc('sawtooth', 620 * p, 'voice');
    o.frequency.setValueAtTime(620 * p, t);
    o.frequency.exponentialRampToValueAtTime(210 * p, t + 0.12);
    const bp = a.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 9; bp.frequency.value = 700 * p;
    g.disconnect(); g.connect(bp); bp.connect(a.buses.voice);
    a.env(g.gain, 0.16, 0.006, 0.10, t);
    o.start(t); o.stop(t + 0.14);
  }

  // Comedy slide-whistle down + a bonk.
  trip(r) {
    const g = this._gain(r) * 0.20; if (g <= 0.001) return;
    const a = this.a, t = a.t;

    const { o, g: gn } = a.osc('sine', 900, 'voice');
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(240, t + 0.26);
    a.env(gn.gain, g, 0.008, 0.26, t);
    o.start(t); o.stop(t + 0.30);

    const t2 = t + 0.24;
    const { o: bo, g: bg } = a.osc('sine', 120, 'voice');
    a.env(bg.gain, g * 1.2, 0.003, 0.11, t2);
    bo.start(t2); bo.stop(t2 + 0.15);
  }

  // Unreasonably cheerful. Make this genuinely lovely — §5.4, §17.9
  binky(r) {
    const g = this._gain(r) * 0.17; if (g <= 0.001) return;
    const a = this.a, t = a.t, p = r.voicePitch;
    const notes = [523.25, 659.25, 783.99];   // C E G
    notes.forEach((f, i) => {
      const t0 = t + i * 0.085;
      const { o, g: gn } = a.osc('sine', f * p, 'voice');
      a.env(gn.gain, g, 0.012, 0.24, t0);
      o.start(t0); o.stop(t0 + 0.3);
      // a soft octave above for sweetness
      const { o: o2, g: g2 } = a.osc('sine', f * p * 2, 'voice');
      a.env(g2.gain, g * 0.22, 0.012, 0.20, t0);
      o2.start(t0); o2.stop(t0 + 0.26);
    });
  }
}
