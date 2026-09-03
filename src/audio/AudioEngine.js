// WebAudio graph — GAME_DESIGN.md §15.2
// One AudioContext, five buses, a compressor on master. Rabbit voices route
// through `voice` so the Black Rabbit can duck them.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.samples = Object.create(null);
    this.sampleOffsets = Object.create(null);
    this.sfxVolume = 1;
    this._duck = Object.create(null);
  }

  // Must be called from a user gesture.
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const ctx = this.ctx = new C();

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 22;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.16;

    this.master = ctx.createGain();
    this.master.gain.value = 0.75;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    this.buses = {};
    for (const name of ['world', 'voice', 'ui', 'music']) {
      const g = ctx.createGain();
      g.gain.value = 1;
      g.connect(this.master);
      this.buses[name] = g;
    }
    this.ready = true;
    this._loadSamples();
  }

  // ── recorded samples ──
  // The project is otherwise fully synthesized (see Sfx.js). A handful of
  // sounds are simply better recorded; those live here and always degrade to
  // the synthesized version if the file is missing.
  async _loadSamples() {
    // Each sample lists candidate paths and takes the first that loads, so the
    // file can be dropped in the project root or in assets/audio/ under either
    // casing without editing code.
    const files = {
      shotgun: [
        'assets/audio/shotgun-sfx.mp3',
        'assets/audio/shotgun.mp3',
        'assets/audio/SHOTGUN-SFX.mp3',
        'shotgun-sfx.mp3',
        'SHOTGUN-SFX.mp3',
      ],
    };

    await Promise.all(Object.entries(files).map(async ([name, candidates]) => {
      for (const url of candidates) {
        try {
          const res = await fetch(encodeURI(url));
          if (!res.ok) continue;
          const buf = await res.arrayBuffer();
          const decoded = await this.ctx.decodeAudioData(buf);
          this.samples[name] = decoded;
          // Skip any silent lead-in so the sound lands the instant it is asked
          // for, rather than a beat after the trigger.
          this.sampleOffsets[name] = this._leadingSilence(decoded);
          console.log(`[audio] sample "${name}" loaded from ${url}`);
          return;
        } catch { /* try the next candidate */ }
      }
      console.warn(`[audio] sample "${name}" not found — using synthesis. ` +
                   `Drop the file at one of: ${candidates.join(', ')}`);
    }));
  }

  // Seconds of near-silence at the head of a buffer.
  _leadingSilence(buf) {
    const d = buf.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < d.length; i += 8) peak = Math.max(peak, Math.abs(d[i]));
    const thresh = peak * 0.06;
    for (let i = 0; i < d.length; i++) {
      if (Math.abs(d[i]) > thresh) return Math.max(0, i / buf.sampleRate - 0.002);
    }
    return 0;
  }

  hasSample(name) { return !!this.samples[name]; }

  // Fire-and-forget one-shot. `rate` doubles as pitch, so repeated shots can be
  // varied slightly instead of sounding machine-stamped.
  playSample(name, { gain = 1, rate = 1, bus = 'world', at = null } = {}) {
    const buf = this.samples[name];
    if (!this.ready || !buf) return null;
    const t = at ?? this.t;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g); g.connect(this.buses[bus]);
    src.start(t, this.sampleOffsets[name] ?? 0);
    return { src, g };
  }

  get t() { return this.ctx.currentTime; }

  // Settings menu hooks. Master scales everything; sfx spares the music bus.
  setMasterVolume(pct) {
    if (!this.ready) return;
    this.master.gain.setTargetAtTime(Math.max(0, pct / 100) * 0.75, this.t, 0.02);
  }
  setSfxVolume(pct) {
    this.sfxVolume = Math.max(0, pct / 100);
    if (!this.ready) return;
    for (const name of ['world', 'ui']) {
      this.buses[name].gain.setTargetAtTime(this.sfxVolume * (this._duck[name] ?? 1), this.t, 0.02);
    }
  }

  // Duck a bus (the Black Rabbit silences the world). §5.4
  //
  // Ducking is a MULTIPLIER over the user's effects volume, not a replacement.
  // Writing the raw amount here silently cancelled the volume slider, because
  // this is called every frame and the slider only on change.
  duck(bus, amount, seconds = 0.4) {
    if (!this.ready) return;
    // blackNear drifts by tiny amounts every frame; only rewrite the ramp when
    // it has actually moved, or we reschedule the envelope 60 times a second.
    if (Math.abs((this._duck[bus] ?? 1) - amount) < 0.01) return;
    this._duck[bus] = amount;
    const scale = (bus === 'world' || bus === 'ui') ? this.sfxVolume : 1;
    const g = this.buses[bus].gain;
    g.cancelScheduledValues(this.t);
    g.setTargetAtTime(amount * scale, this.t, seconds / 3);
  }

  // ── primitives ──

  osc(type, freq, bus = 'world') {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    o.connect(g);
    g.connect(this.buses[bus]);
    return { o, g };
  }

  // Short envelope helper: attack to peak, then exponential decay.
  env(gain, peak, attack, decay, t0 = this.t) {
    gain.cancelScheduledValues(t0);
    gain.setValueAtTime(0.0001, t0);
    gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + attack);
    gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  noiseBuffer(seconds = 0.5) {
    if (this._noise && this._noiseLen >= seconds) return this._noise;
    const n = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this._noise = buf; this._noiseLen = seconds;
    return buf;
  }

  noise(bus = 'world') {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuffer(1.0);
    s.loop = true;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    s.connect(g);
    g.connect(this.buses[bus]);
    return { s, g };
  }

  // Distance attenuation, cheap and good enough for a flat level.
  gainFor(dist, ref = 6, max = 44) {
    if (dist >= max) return 0;
    return Math.max(0, Math.min(1, ref / Math.max(ref, dist))) * (1 - dist / max);
  }
}
