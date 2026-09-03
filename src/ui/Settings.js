// Settings menu — opens on Esc, persists to localStorage.

const KEY = 'hareandglaze.settings.v1';

export const DEFAULTS = {
  sensitivity: 2.2,     // shown x1000 so the slider reads in sane numbers
  fov: 75,
  invertY: false,
  masterVolume: 75,
  sfxVolume: 100,
  headBob: 100,
};

export class Settings {
  constructor() {
    this.values = { ...DEFAULTS, ...this._load() };
    this.onChange = null;

    this.el = document.createElement('div');
    this.el.id = 'settingsOverlay';
    this.el.innerHTML = `
      <div class="setBox">
        <div class="setTitle">SETTINGS</div>
        <div class="setRows"></div>
        <div class="setBtns">
          <button class="setReset">RESET</button>
          <button class="setClose">RESUME</button>
        </div>
        <div class="setHint">Esc closes · settings are saved automatically</div>
      </div>`;
    document.body.appendChild(this.el);

    this.rows = this.el.querySelector('.setRows');
    this._addSlider('sensitivity', 'Mouse sensitivity', 0.2, 10, 0.05, v => v.toFixed(2));
    this._addSlider('fov', 'Field of view', 60, 110, 1, v => v + '°');
    this._addSlider('masterVolume', 'Master volume', 0, 100, 1, v => v + '%');
    this._addSlider('sfxVolume', 'Effects volume', 0, 100, 1, v => v + '%');
    this._addSlider('headBob', 'Head bob', 0, 150, 5, v => v + '%');
    this._addToggle('invertY', 'Invert vertical look');

    // RESUME is a real user gesture, which is the only reliable moment to
    // re-acquire pointer lock. close() alone must NOT try to lock, or closing
    // and entering the game both fire a request and trip the rate limiter.
    this.el.querySelector('.setClose').addEventListener('click', () => {
      this.close();
      this.onResume?.();
    });
    this.el.querySelector('.setReset').addEventListener('click', () => this.reset());
  }

  _load() {
    try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; }
    catch { return {}; }
  }
  _save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.values)); } catch {}
  }

  _addSlider(key, label, min, max, step, fmt) {
    const row = document.createElement('div');
    row.className = 'setRow';
    row.innerHTML = `
      <label>${label}</label>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${this.values[key]}">
      <span class="setVal">${fmt(this.values[key])}</span>`;
    const input = row.querySelector('input');
    const val = row.querySelector('.setVal');
    input.addEventListener('input', () => {
      this.values[key] = parseFloat(input.value);
      val.textContent = fmt(this.values[key]);
      this._save();
      this.onChange?.(this.values);
    });
    row._sync = () => { input.value = this.values[key]; val.textContent = fmt(this.values[key]); };
    this.rows.appendChild(row);
  }

  _addToggle(key, label) {
    const row = document.createElement('div');
    row.className = 'setRow';
    row.innerHTML = `
      <label>${label}</label>
      <button class="setToggle ${this.values[key] ? 'on' : ''}">${this.values[key] ? 'ON' : 'OFF'}</button>
      <span class="setVal"></span>`;
    const btn = row.querySelector('button');
    btn.addEventListener('click', () => {
      this.values[key] = !this.values[key];
      btn.classList.toggle('on', this.values[key]);
      btn.textContent = this.values[key] ? 'ON' : 'OFF';
      this._save();
      this.onChange?.(this.values);
    });
    row._sync = () => {
      btn.classList.toggle('on', this.values[key]);
      btn.textContent = this.values[key] ? 'ON' : 'OFF';
    };
    this.rows.appendChild(row);
  }

  reset() {
    this.values = { ...DEFAULTS };
    for (const row of this.rows.children) row._sync?.();
    this._save();
    this.onChange?.(this.values);
  }

  open()  { this.el.classList.add('show'); }
  close() { this.el.classList.remove('show'); }
  toggle() { this.visible ? this.close() : this.open(); }
  get visible() { return this.el.classList.contains('show'); }
}
