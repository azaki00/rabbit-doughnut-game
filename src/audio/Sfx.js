// Player + UI sounds. All synthesized.

export class Sfx {
  constructor(audio) { this.a = audio; }

  footstep(intensity) {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { s, g } = a.noise('world');
    const lp = a.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500 + Math.random() * 400;
    g.disconnect(); g.connect(lp); lp.connect(a.buses.world);
    a.env(g.gain, 0.055 * (0.4 + intensity), 0.004, 0.075, t);
    s.start(t); s.stop(t + 0.1);
  }

  // Fabric tension as the glove pulls back.
  windUp() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { s, g } = a.noise('ui');
    const bp = a.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(600, t);
    bp.frequency.exponentialRampToValueAtTime(1800, t + 0.42);
    g.disconnect(); g.connect(bp); bp.connect(a.buses.ui);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.035, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    s.start(t); s.stop(t + 0.6);
  }

  // Whoosh, scaled by charge.
  lunge(charge) {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { s, g } = a.noise('world');
    const bp = a.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(1400 + charge * 900, t + 0.11);
    bp.frequency.exponentialRampToValueAtTime(220, t + 0.30);
    g.disconnect(); g.connect(bp); bp.connect(a.buses.world);
    a.env(g.gain, 0.09 + charge * 0.07, 0.012, 0.26, t);
    s.start(t); s.stop(t + 0.34);
  }

  // Stumble: a dull thud and a scuff.
  whiff() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { o, g } = a.osc('sine', 90, 'world');
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.22);
    a.env(g.gain, 0.13, 0.006, 0.24, t);
    o.start(t); o.stop(t + 0.3);

    const { s, g: g2 } = a.noise('world');
    const lp = a.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900;
    g2.disconnect(); g2.connect(lp); lp.connect(a.buses.world);
    a.env(g2.gain, 0.07, 0.01, 0.3, t + 0.02);
    s.start(t); s.stop(t + 0.36);
  }

  // Triumphant honk on a max-charge catch. §4.1 CLUTCH GRAB
  clutch() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    [392, 523.25, 659.25].forEach((f, i) => {
      const t0 = t + i * 0.06;
      const { o, g } = a.osc('triangle', f, 'ui');
      a.env(g.gain, 0.13, 0.008, 0.2, t0);
      o.start(t0); o.stop(t0 + 0.26);
    });
  }

  coin() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    [1318, 1760].forEach((f, i) => {
      const t0 = t + i * 0.05;
      const { o, g } = a.osc('square', f, 'ui');
      a.env(g.gain, 0.045, 0.004, 0.11, t0);
      o.start(t0); o.stop(t0 + 0.16);
    });
  }

  // Gunshot: a hard transient, a body of filtered noise, and a long tail that
  // reads as the report rolling out across the meadow. Everything hears it.
  gunshot() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;

    // crack — very short, very bright
    const { s, g } = a.noise('world');
    const hp = a.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 1400;
    g.disconnect(); g.connect(hp); hp.connect(a.buses.world);
    a.env(g.gain, 0.5, 0.001, 0.055, t);
    s.start(t); s.stop(t + 0.08);

    // body — the thump you feel
    const { o, g: g2 } = a.osc('sine', 130, 'world');
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.20);
    a.env(g2.gain, 0.42, 0.002, 0.22, t);
    o.start(t); o.stop(t + 0.28);

    // tail — the report rolling away
    const { s: s3, g: g3 } = a.noise('world');
    const lp = a.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2200, t);
    lp.frequency.exponentialRampToValueAtTime(280, t + 0.9);
    g3.disconnect(); g3.connect(lp); lp.connect(a.buses.world);
    a.env(g3.gain, 0.14, 0.02, 0.9, t + 0.02);
    s3.start(t); s3.stop(t + 1.0);
  }

  dryFire() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { s, g } = a.noise('ui');
    const bp = a.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 6;
    g.disconnect(); g.connect(bp); bp.connect(a.buses.ui);
    a.env(g.gain, 0.10, 0.001, 0.03, t);
    s.start(t); s.stop(t + 0.05);
  }

  // Break the action, shells out, shells in, snap shut.
  reload() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const clack = (t0, freq, peak) => {
      const { s, g } = a.noise('ui');
      const bp = a.ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 4;
      g.disconnect(); g.connect(bp); bp.connect(a.buses.ui);
      a.env(g.gain, peak, 0.002, 0.045, t0);
      s.start(t0); s.stop(t0 + 0.07);
    };
    clack(t,        1500, 0.12);   // break open
    clack(t + 0.55,  900, 0.07);   // shell
    clack(t + 0.85,  900, 0.07);   // shell
    clack(t + 1.55, 1900, 0.15);   // snap shut
  }

  // One click per ticket crossing the marker. Because the reel drives these by
  // position, they stretch out on their own as it decelerates — §8.1
  reelTick() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { s, g } = a.noise('ui');
    const bp = a.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 8;
    g.disconnect(); g.connect(bp); bp.connect(a.buses.ui);
    a.env(g.gain, 0.055, 0.001, 0.008, t);
    s.start(t); s.stop(t + 0.02);
  }

  // Rarity-scaled sting: higher tier is longer and richer.
  reelWin(tier) {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const sets = {
      consumer:   [[392], 0.10],
      industrial: [[392, 523], 0.12],
      milspec:    [[392, 523, 659], 0.15],
      restricted: [[392, 523, 659, 784], 0.18],
      classified: [[440, 554, 659, 880], 0.20],
      covert:     [[440, 554, 659, 880, 1109], 0.24],
      gold:       [[523, 659, 784, 1047, 1319, 1568], 0.30],
    };
    const [notes, peak] = sets[tier] ?? sets.consumer;
    notes.forEach((f, i) => {
      const t0 = t + i * 0.075;
      const { o, g } = a.osc(tier === 'gold' ? 'triangle' : 'sine', f, 'ui');
      a.env(g.gain, peak, 0.01, 0.45, t0);
      o.start(t0); o.stop(t0 + 0.55);
    });
  }

  chestOpen() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { s, g } = a.noise('world');
    const bp = a.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 2;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(1100, t + 0.35);
    g.disconnect(); g.connect(bp); bp.connect(a.buses.world);
    a.env(g.gain, 0.10, 0.02, 0.36, t);
    s.start(t); s.stop(t + 0.42);
  }

  deny() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { o, g } = a.osc('square', 180, 'ui');
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.14);
    a.env(g.gain, 0.06, 0.004, 0.15, t);
    o.start(t); o.stop(t + 0.2);
  }

  // Bullets off a sealed shell — a bright, useless ping.
  shellPing() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { o, g } = a.osc('triangle', 2200, 'ui');
    o.frequency.setValueAtTime(2600, t);
    o.frequency.exponentialRampToValueAtTime(1500, t + 0.18);
    a.env(g.gain, 0.09, 0.002, 0.20, t);
    o.start(t); o.stop(t + 0.24);
  }

  // Hammer into shell. Gets deeper and wetter as the shell gives way.
  shellCrack(progress) {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { s, g } = a.noise('world');
    const bp = a.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 2.2;
    bp.frequency.setValueAtTime(1800 - progress * 900, t);
    bp.frequency.exponentialRampToValueAtTime(260, t + 0.22);
    g.disconnect(); g.connect(bp); bp.connect(a.buses.world);
    a.env(g.gain, 0.34, 0.002, 0.24, t);
    s.start(t); s.stop(t + 0.3);

    const { o, g: g2 } = a.osc('sine', 220 - progress * 90, 'world');
    o.frequency.exponentialRampToValueAtTime(60, t + 0.25);
    a.env(g2.gain, 0.24, 0.003, 0.26, t);
    o.start(t); o.stop(t + 0.32);
  }

  hammerSwing() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { s, g } = a.noise('world');
    const bp = a.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(260, t + 0.22);
    bp.frequency.exponentialRampToValueAtTime(900, t + 0.36);
    g.disconnect(); g.connect(bp); bp.connect(a.buses.world);
    a.env(g.gain, 0.09, 0.16, 0.18, t);
    s.start(t); s.stop(t + 0.42);
  }

  purchase() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    [523, 659, 880].forEach((f, i) => {
      const t0 = t + i * 0.08;
      const { o, g } = a.osc('triangle', f, 'ui');
      a.env(g.gain, 0.11, 0.006, 0.24, t0);
      o.start(t0); o.stop(t0 + 0.3);
    });
  }

  // ── THE SUNNY-SIDE SOVEREIGN ──

  bossWake() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    // a vast, wet, rising groan
    const { o, g } = a.osc('sawtooth', 34, 'world');
    o.frequency.setValueAtTime(28, t);
    o.frequency.exponentialRampToValueAtTime(96, t + 1.5);
    const lp = a.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 7;
    g.disconnect(); g.connect(lp); lp.connect(a.buses.world);
    a.env(g.gain, 0.45, 0.4, 1.4, t);
    o.start(t); o.stop(t + 2.0);

    // sizzle
    const { s, g: g2 } = a.noise('world');
    const hp = a.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 3000;
    g2.disconnect(); g2.connect(hp); hp.connect(a.buses.world);
    a.env(g2.gain, 0.10, 0.5, 1.6, t);
    s.start(t); s.stop(t + 2.2);
  }

  bossHit(crit) {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    // wet slap
    const { s, g } = a.noise('ui');
    const bp = a.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 3;
    bp.frequency.setValueAtTime(crit ? 1500 : 800, t);
    bp.frequency.exponentialRampToValueAtTime(180, t + 0.14);
    g.disconnect(); g.connect(bp); bp.connect(a.buses.ui);
    a.env(g.gain, crit ? 0.26 : 0.15, 0.002, 0.14, t);
    s.start(t); s.stop(t + 0.18);

    if (crit) {
      const { o, g: g2 } = a.osc('square', 1400, 'ui');
      a.env(g2.gain, 0.10, 0.003, 0.09, t);
      o.start(t); o.stop(t + 0.13);
    }
  }

  bossSlam() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { o, g } = a.osc('sine', 90, 'world');
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.45);
    a.env(g.gain, 0.6, 0.003, 0.5, t);
    o.start(t); o.stop(t + 0.6);

    const { s, g: g2 } = a.noise('world');
    const lp = a.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 700;
    g2.disconnect(); g2.connect(lp); lp.connect(a.buses.world);
    a.env(g2.gain, 0.32, 0.004, 0.42, t);
    s.start(t); s.stop(t + 0.5);
  }

  bossSpit() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { o, g } = a.osc('sawtooth', 420, 'world');
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(760, t + 0.16);
    const bp = a.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 5; bp.frequency.value = 900;
    g.disconnect(); g.connect(bp); bp.connect(a.buses.world);
    a.env(g.gain, 0.14, 0.006, 0.17, t);
    o.start(t); o.stop(t + 0.22);
  }

  bossDeath() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    // a long, deflating, deeply undignified descent
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

    // final splat
    const t2 = t + 2.15;
    const { s, g: g2 } = a.noise('world');
    const lp = a.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 500;
    g2.disconnect(); g2.connect(lp); lp.connect(a.buses.world);
    a.env(g2.gain, 0.4, 0.005, 0.5, t2);
    s.start(t2); s.stop(t2 + 0.6);
  }

  playerHurt() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { o, g } = a.osc('sine', 160, 'ui');
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.25);
    a.env(g.gain, 0.20, 0.004, 0.26, t);
    o.start(t); o.stop(t + 0.32);
  }

  // Breathing when stamina bottoms out.
  gasp() {
    const a = this.a; if (!a.ready) return;
    const t = a.t;
    const { s, g } = a.noise('world');
    const bp = a.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(700, t);
    bp.frequency.exponentialRampToValueAtTime(340, t + 0.4);
    g.disconnect(); g.connect(bp); bp.connect(a.buses.world);
    a.env(g.gain, 0.05, 0.09, 0.34, t);
    s.start(t); s.stop(t + 0.5);
  }
}
