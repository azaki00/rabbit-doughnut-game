// WebAudio graph — GAME_DESIGN.md §15.2
// One AudioContext, five buses, a compressor on master. Rabbit voices route
// through `voice` so the Black Rabbit can duck them.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
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
  }

  get t() { return this.ctx.currentTime; }

  // Duck a bus (the Black Rabbit silences the world). §5.4
  duck(bus, amount, seconds = 0.4) {
    if (!this.ready) return;
    const g = this.buses[bus].gain;
    g.cancelScheduledValues(this.t);
    g.setTargetAtTime(amount, this.t, seconds / 3);
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
