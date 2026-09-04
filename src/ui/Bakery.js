import {
  RECIPES, SUPPLIES, lockReason, missingFor, gradeBake, payout,
} from '../economy/Recipes.js';

// THE BAKERY PANEL — GAME_DESIGN.md §6
//
// Four zones on one screen rather than four walks around the table: the satchel
// (sell or grind), the counter (buy flour, sugar, yeast), the recipe book, and
// the fryer. §6.1 describes them as physical stations, and they still are —
// this is what opens when you press E at the table.
//
// The fryer minigame lives here too, because it is the only part with its own
// frame loop and splitting it across two files would put the needle in one
// place and the recipe it is baking in another.

const TYPE_LABEL = {
  cottontail: 'Cottontail', lop: 'Lop', jack: 'Jackrabbit',
  black: 'Black Rabbit', duke: 'Grand Duke', binky: 'Binky',
};

// ── the fryer ── §6.3
export const FRYER = {
  bake: 6.0,        // seconds
  drift: 0.42,      // how fast the needle falls with no heat
  heat: 0.95,       // how fast it climbs while E is held
  greenLo: 0.42,    // the band, in needle units 0..1
  greenHi: 0.68,
};

export class Bakery {
  constructor(sfx) {
    this.sfx = sfx;
    this.open = false;
    this.tab = 'satchel';

    // fryer state
    this.frying = null;     // the recipe being baked
    this.needle = 0.5;
    this.timeLeft = 0;
    this.green = 0;         // seconds spent in the band
    this.heating = false;

    // supplied by main.js
    this.getState = () => ({});
    this.onSellMeat = null;   // (index) => void
    this.onGrind = null;      // (index) => void
    this.onBake = null;       // (recipe) => bool, spends ingredients
    this.onFinish = null;     // (recipe, grade, coins) => void
    this.onBuy = null;        // (key) => void
    this.onClose = null;

    this.el = document.createElement('div');
    this.el.id = 'bakeryOverlay';
    this.el.innerHTML = `
      <div class="bkBox">
        <div class="bkHead">
          <div class="bkTitle">THE COOKING TABLE</div>
          <div class="bkTabs"></div>
        </div>
        <div class="bkBody"></div>
        <div class="bkFoot">
          <span class="bkHint">1-3 to switch &nbsp;·&nbsp; Esc to close</span>
          <span class="bkCoins"></span>
        </div>
      </div>`;
    document.body.appendChild(this.el);

    this.tabsEl = this.el.querySelector('.bkTabs');
    this.bodyEl = this.el.querySelector('.bkBody');
    this.coinsEl = this.el.querySelector('.bkCoins');

    const TABS = [
      { k: 'satchel', label: 'SATCHEL' },
      { k: 'counter', label: 'COUNTER' },
      { k: 'book', label: 'RECIPE BOOK' },
    ];
    this.tabsEl.innerHTML = TABS.map(
      (t) => `<button class="bkTab" data-k="${t.k}">${t.label}</button>`).join('');
    for (const b of this.tabsEl.querySelectorAll('.bkTab')) {
      b.addEventListener('click', () => {
        if (this.frying) return;      // no tab-hopping mid-bake
        this.tab = b.dataset.k;
        this.sfx?.uiMove?.();
        this.render();
      });
    }

    this._onKey = (e) => {
      if (!this.open) return;
      if (e.code === 'Escape') {
        e.preventDefault();
        if (this.frying) return;      // you must see the bake through
        this.close();
        return;
      }
      const n = /^Digit([1-3])$/.exec(e.code);
      if (n && !this.frying) {
        this.tab = TABS[+n[1] - 1].k;
        this.sfx?.uiMove?.();
        this.render();
        e.preventDefault();
      }
      // Hold E to raise the heat. §6.3 asks for hold-and-release, so this is
      // keydown/keyup rather than an edge.
      if (e.code === 'KeyE' && this.frying) { this.heating = true; e.preventDefault(); }
    };
    this._onKeyUp = (e) => {
      if (e.code === 'KeyE') this.heating = false;
    };
    addEventListener('keydown', this._onKey);
    addEventListener('keyup', this._onKeyUp);
  }

  get visible() { return this.open; }

  show() {
    this.open = true;
    this.tab = 'satchel';
    this.el.classList.add('show');
    this.render();
  }

  close() {
    if (!this.open || this.frying) return;
    this.open = false;
    this.el.classList.remove('show');
    this.onClose?.();
  }

  render() {
    const s = this.getState();
    this.coinsEl.textContent = `${s.coins ?? 0}c`;
    for (const b of this.tabsEl.querySelectorAll('.bkTab')) {
      b.classList.toggle('on', b.dataset.k === this.tab);
    }
    if (this.frying) return this._renderFryer();
    if (this.tab === 'satchel') return this._renderSatchel(s);
    if (this.tab === 'counter') return this._renderCounter(s);
    return this._renderBook(s);
  }

  // ── the satchel: sell or grind ──
  _renderSatchel(s) {
    const meat = s.meat ?? [];
    const dough = s.dough ?? {};
    const doughLine = Object.entries(dough).filter(([, n]) => n > 0)
      .map(([k, n]) => `<span class="bkChip">${n}× ${TYPE_LABEL[k] ?? k}</span>`).join('')
      || '<span class="bkNone">no dough</span>';

    if (!meat.length) {
      this.bodyEl.innerHTML = `
        <div class="bkDough">DOUGH ${doughLine}</div>
        <div class="bkEmpty">Nothing in the satchel.<br>
          <span>Shoot a rabbit and collect the slab it leaves.</span></div>`;
      return;
    }

    this.bodyEl.innerHTML = `<div class="bkDough">DOUGH ${doughLine}</div>`;
    meat.forEach((m, i) => {
      const row = document.createElement('div');
      row.className = 'bkRow';
      row.innerHTML = `
        <div class="bkMeta">
          <div class="bkName">${m.label}</div>
          <div class="bkSub">${TYPE_LABEL[m.type] ?? m.type}</div>
        </div>
        <div class="bkActs">
          <button class="bkBtn sell">SELL ${m.value}c</button>
          <button class="bkBtn grind">GRIND</button>
        </div>`;
      row.querySelector('.sell').addEventListener('click', () => {
        this.sfx?.coin?.();
        this.onSellMeat?.(i);
        this.render();
      });
      row.querySelector('.grind').addEventListener('click', () => {
        this.sfx?.chestOpen?.();
        this.onGrind?.(i);
        this.render();
      });
      this.bodyEl.appendChild(row);
    });
  }

  // ── the counter: flour, sugar, yeast ── §6.2
  _renderCounter(s) {
    const sup = s.supplies ?? {};
    this.bodyEl.innerHTML = '';
    for (const [key, def] of Object.entries(SUPPLIES)) {
      const have = sup[key] ?? 0;
      const afford = (s.coins ?? 0) >= def.price;
      const row = document.createElement('div');
      row.className = 'bkRow';
      row.innerHTML = `
        <div class="bkMeta">
          <div class="bkName">${def.name}</div>
          <div class="bkSub">${have} in the pantry</div>
        </div>
        <div class="bkActs">
          <button class="bkBtn buy${afford ? '' : ' cant'}">BUY ${def.price}c</button>
        </div>`;
      row.querySelector('.buy').addEventListener('click', () => {
        if (!afford) { this.sfx?.deny?.(); return; }
        this.sfx?.purchase?.();
        this.onBuy?.(key);
        this.render();
      });
      this.bodyEl.appendChild(row);
    }
  }

  // ── the recipe book ── §6.4
  //
  // Locked recipes are SHOWN, greyed, with what they want. A recipe book that
  // hides what you have not unlocked tells you nothing; one that lists eight
  // doughnuts and greys six of them is a to-do list.
  _renderBook(s) {
    const dough = s.dough ?? {};
    const sup = s.supplies ?? {};
    this.bodyEl.innerHTML = '';
    for (const r of RECIPES) {
      const locked = lockReason(r, s);
      const missing = locked ? null : missingFor(r, dough, sup);
      const ready = !locked && !missing;

      const row = document.createElement('div');
      row.className = 'bkRow recipe' + (locked ? ' locked' : '');
      const need = Object.entries(r.dough)
        .map(([k, n]) => k === 'any' ? `${n}× any dough`
          : k === 'distinct' ? `${n} different doughs`
          : `${n}× ${TYPE_LABEL[k] ?? k}`)
        .concat(r.supplies.map((x) => SUPPLIES[x].name))
        .join(' · ');

      row.innerHTML = `
        <div class="bkMeta">
          <div class="bkName">${r.name} <em>${r.value}c</em></div>
          <div class="bkSub">${need}</div>
          <div class="bkFlav">${locked ? '' : r.flavour}</div>
        </div>
        <div class="bkActs">
          ${locked
            ? `<span class="bkLock">${locked}</span>`
            : `<button class="bkBtn bake${ready ? '' : ' cant'}">${ready ? 'BAKE' : missing}</button>`}
        </div>`;

      if (!locked) {
        row.querySelector('.bake').addEventListener('click', () => {
          if (!ready) { this.sfx?.deny?.(); return; }
          if (this.onBake?.(r)) this._startFry(r);
        });
      }
      this.bodyEl.appendChild(row);
    }
  }

  // ── the fryer ── §6.3
  _startFry(recipe) {
    this.frying = recipe;
    this.needle = 0.5;
    this.timeLeft = FRYER.bake;
    this.green = 0;
    this.heating = false;
    this.sfx?.uiPick?.();
    this._renderFryer();
  }

  _renderFryer() {
    const inBand = this.needle >= FRYER.greenLo && this.needle <= FRYER.greenHi;
    const pct = Math.round((this.green / Math.max(0.001, FRYER.bake - this.timeLeft)) * 100);
    this.bodyEl.innerHTML = `
      <div class="bkFry">
        <div class="bkFryName">${this.frying.name}</div>
        <div class="bkGauge">
          <div class="bkBand" style="bottom:${FRYER.greenLo * 100}%;height:${(FRYER.greenHi - FRYER.greenLo) * 100}%"></div>
          <div class="bkNeedle${inBand ? ' in' : ''}" style="bottom:${this.needle * 100}%"></div>
        </div>
        <div class="bkFryHint">Hold <kbd>E</kbd> to raise the heat</div>
        <div class="bkFryStat">${this.timeLeft.toFixed(1)}s &nbsp;·&nbsp; ${pct}% in the green</div>
      </div>`;
  }

  // Driven from main.js's frame loop, on real time — the bake is six seconds of
  // wall clock and must not slow down with the simulation.
  update(dt) {
    if (!this.open || !this.frying) return;

    this.needle += (this.heating ? FRYER.heat : -FRYER.drift) * dt;
    this.needle = Math.max(0, Math.min(1, this.needle));
    if (this.needle >= FRYER.greenLo && this.needle <= FRYER.greenHi) this.green += dt;

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      const recipe = this.frying;
      const grade = gradeBake(this.green / FRYER.bake);
      const coins = payout(recipe, grade);
      this.frying = null;
      this.heating = false;
      this.onFinish?.(recipe, grade, coins);
      this.tab = 'book';
      this.render();
      return;
    }
    this._renderFryer();
  }
}
