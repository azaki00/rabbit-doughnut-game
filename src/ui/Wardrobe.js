import { TIERS, valueOf, skinById } from '../economy/Skins.js';
import { textureFor } from '../economy/SkinTextures.js';

// THE WARDROBE — GAME_DESIGN.md §7 / §9
//
// The panel behind the clothing rack. Two jobs, which §7 puts in the same
// place: wear a skin you own, or sell it back for
// `baseValue * (1 - float) * 0.55` — the formula `valueOf()` has implemented
// since the skins landed and nothing has ever called.
//
// DOM rather than WebGL, for the same reason CaseReel is: it is a list with
// scrolling and hover states, and fighting that in a 3D scene buys nothing.
//
// SELLING IS THE ONLY DESTRUCTIVE ACTION IN THE GAME. It therefore asks twice —
// but the second press is on the same button, in place, rather than a modal.
// A modal you dismiss by clicking anywhere is exactly how you sell a Covert by
// accident.

const RAILS = [
  { kind: 'glove', label: 'GLOVE' },
  { kind: 'gun', label: 'GUN' },
  { kind: 'brush', label: 'TOOTHBRUSH' },
];

export class Wardrobe {
  constructor(sfx) {
    this.sfx = sfx;
    this.open = false;
    this.tab = 'glove';
    this.armed = null;        // instId awaiting a confirming second click

    this.onEquip = null;      // (inst) => void
    this.onSell = null;       // (inst, value) => void
    this.onClose = null;
    this.getSkins = () => []; // () => inst[]
    this.getEquipped = () => ({});

    this.el = document.createElement('div');
    this.el.id = 'wardrobeOverlay';
    this.el.innerHTML = `
      <div class="wdBox">
        <div class="wdHead">
          <div class="wdTitle">WARDROBE</div>
          <div class="wdTabs"></div>
        </div>
        <div class="wdList"></div>
        <div class="wdFoot">
          <span class="wdHint">Click to wear &nbsp;·&nbsp; SELL twice to confirm &nbsp;·&nbsp; Esc to close</span>
          <span class="wdCount"></span>
        </div>
      </div>`;
    document.body.appendChild(this.el);

    this.tabsEl = this.el.querySelector('.wdTabs');
    this.listEl = this.el.querySelector('.wdList');
    this.countEl = this.el.querySelector('.wdCount');

    this.tabsEl.innerHTML = RAILS.map(
      (r) => `<button class="wdTab" data-kind="${r.kind}">${r.label}</button>`,
    ).join('');
    for (const b of this.tabsEl.querySelectorAll('.wdTab')) {
      b.addEventListener('click', () => {
        this.tab = b.dataset.kind;
        this.armed = null;
        this.sfx?.uiMove?.();
        this.render();
      });
    }

    this._onKey = (e) => {
      if (!this.open) return;
      if (e.code === 'Escape') { e.preventDefault(); this.close(); return; }
      const n = /^Digit([1-3])$/.exec(e.code);
      if (n) {
        this.tab = RAILS[+n[1] - 1].kind;
        this.armed = null;
        this.sfx?.uiMove?.();
        this.render();
        e.preventDefault();
      }
    };
    addEventListener('keydown', this._onKey);
  }

  get visible() { return this.open; }

  show(kind = 'glove') {
    this.tab = kind;
    this.armed = null;
    this.open = true;
    this.el.classList.add('show');
    this.render();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.armed = null;
    this.el.classList.remove('show');
    this.onClose?.();
  }

  render() {
    const all = this.getSkins() ?? [];
    const equipped = this.getEquipped() ?? {};
    const mine = all.filter((i) => i.collection === this.tab);

    for (const b of this.tabsEl.querySelectorAll('.wdTab')) {
      const k = b.dataset.kind;
      b.classList.toggle('on', k === this.tab);
      b.dataset.n = all.filter((i) => i.collection === k).length;
    }

    this.countEl.textContent = `${mine.length} owned  ·  ${all.length} total`;

    if (!mine.length) {
      this.listEl.innerHTML =
        `<div class="wdEmpty">Nothing on this rail yet.<br><span>Open the case beside the table.</span></div>`;
      return;
    }

    // Rarest first, then least worn. What you want to look at is at the top.
    const order = Object.keys(TIERS);
    const sorted = [...mine].sort(
      (a, b) => order.indexOf(b.tier) - order.indexOf(a.tier) || a.float - b.float,
    );

    this.listEl.innerHTML = '';
    for (const inst of sorted) {
      const skin = skinById(inst.skinId);
      const worth = skin ? valueOf(skin, inst.float) : 0;
      const on = equipped[inst.collection] === inst.instId;
      // You may sell the skin you are wearing, but not if it is the only one
      // on that rail: there would be nothing to swap onto, and the weapons
      // have no way to return to bare.
      const last = on && mine.length === 1;
      const arm = this.armed === inst.instId;
      const tier = TIERS[inst.tier];

      const row = document.createElement('div');
      row.className = 'wdRow' + (on ? ' on' : '');
      row.style.setProperty('--tier', tier?.color ?? '#b0c3d9');

      let swatch = '';
      try {
        if (skin) swatch = textureFor(skin).dataUrl;
      } catch { /* a pattern that fails to draw must not empty the wardrobe */ }

      row.innerHTML = `
        <div class="wdSwatch" style="background-image:url(${swatch})"></div>
        <div class="wdMeta">
          <div class="wdName">${inst.name}</div>
          <div class="wdSub">
            <span class="wdTier">${tier?.name ?? inst.tier}</span>
            <span class="wdWear">${inst.wear}</span>
            <span class="wdFloat">${inst.float.toFixed(3)}</span>
          </div>
        </div>
        <div class="wdActs">
          <span class="wdWorn">${on ? 'WORN' : ''}</span>
          <button class="wdSell${arm ? ' arm' : ''}${last ? ' cant' : ''}"
            ${last ? 'title="You are wearing it, and it is the only one."' : ''}
          >${last ? 'WORN' : arm ? 'SURE?' : `SELL ${worth}c`}</button>
        </div>`;

      // Clicking the row wears it. Clicking SELL does not, so the sell button
      // stops the event before it reaches the row.
      row.addEventListener('click', () => {
        if (on) { this.sfx?.deny?.(); return; }
        this.armed = null;
        this.sfx?.uiPick?.();
        this.onEquip?.(inst);
        this.render();
      });

      row.querySelector('.wdSell').addEventListener('click', (e) => {
        e.stopPropagation();
        if (last) { this.sfx?.deny?.(); return; }
        if (this.armed !== inst.instId) {
          // first press arms, and disarms whatever else was armed
          this.armed = inst.instId;
          this.sfx?.uiMove?.();
          this.render();
          return;
        }
        this.armed = null;
        this.sfx?.coin?.();
        this.onSell?.(inst, worth);
        this.render();
      });

      this.listEl.appendChild(row);
    }
  }
}
