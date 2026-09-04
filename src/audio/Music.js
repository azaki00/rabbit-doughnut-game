// Background music — two looping tracks, crossfaded.
//
// The meadow has a track. The Sovereign has a different one. Nothing else is
// scored, and the switch between the two IS the announcement that the fight has
// started, so the crossfade is short and the boss track comes in hot.
//
// These are streamed through MediaElementSource rather than decoded into
// memory: a 3-minute loop as a raw AudioBuffer is ~30MB, and we gain nothing
// from having it resident.

const CANDIDATES = {
  game: [
    'assets/audio/game-music.mp3',
    'assets/audio/GAME-MUSIC.mp3',
    'game-music.mp3',
  ],
  boss: [
    'assets/audio/BOSSMUSIC.mp3',
    'assets/audio/bossmusic.mp3',
    'assets/audio/BOSS-MUSIC.mp3',
    'BOSSMUSIC.mp3',
  ],
};

const FADE = 1.1;          // seconds, either direction

export class Music {
  constructor(audio) {
    this.a = audio;
    this.tracks = Object.create(null);
    this.current = null;    // the name that SHOULD be playing
    this.volume = 1;
    this._built = false;
  }

  // Called once the AudioContext exists — i.e. after the first user gesture.
  build() {
    if (this._built || !this.a.ready) return;
    this._built = true;

    for (const [name, urls] of Object.entries(CANDIDATES)) {
      const el = new Audio();
      el.loop = true;
      el.preload = 'auto';
      el.volume = 1;

      // A MediaElementSource can only be created once per element, so it is
      // made here and kept for the life of the page.
      const src = this.a.ctx.createMediaElementSource(el);
      const gain = this.a.ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain);
      gain.connect(this.a.buses.music);

      const track = { el, gain, ok: false, urls, idx: -1 };
      this.tracks[name] = track;
      this._tryNext(name);
    }

    // If a track was requested before the context existed, honour it now.
    if (this.current) this.play(this.current);
  }

  // Walk the candidate list until one loads. A missing file must not throw —
  // the game is perfectly playable silent.
  _tryNext(name) {
    const t = this.tracks[name];
    t.idx++;
    if (t.idx >= t.urls.length) {
      console.warn(`[music] "${name}" not found — tried ${t.urls.join(', ')}`);
      return;
    }
    const url = t.urls[t.idx];
    t.el.onerror = () => this._tryNext(name);
    t.el.oncanplaythrough = () => {
      if (t.ok) return;
      t.ok = true;
      console.log(`[music] "${name}" loaded from ${url}`);
      if (this.current === name) this.play(name);
    };
    t.el.src = encodeURI(url);
    t.el.load();
  }

  // Fade `name` in and everything else out. Passing null stops all music.
  play(name) {
    this.current = name;
    if (!this.a.ready || !this._built) return;

    for (const [key, t] of Object.entries(this.tracks)) {
      const want = key === name ? this.volume : 0;
      t.gain.gain.cancelScheduledValues(this.a.t);
      t.gain.gain.setTargetAtTime(want, this.a.t, FADE / 3);

      if (key === name && t.ok) {
        // play() rejects if the tab has never been interacted with; by the time
        // music is asked for it always has been, but never let it throw.
        t.el.play?.().catch(() => {});
      } else if (key !== name) {
        // let the fade finish before actually pausing
        clearTimeout(t._stopT);
        t._stopT = setTimeout(() => { if (this.current !== key) t.el.pause(); }, FADE * 1000 + 120);
      }
    }
  }

  stop() { this.play(null); }

  // 0..100 from the settings menu.
  setVolume(pct) {
    this.volume = Math.max(0, pct / 100);
    if (this.current) this.play(this.current);
  }
}
