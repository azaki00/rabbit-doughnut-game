import { SKINS, TIERS, rollSkin, mintInstance, wearName } from '../economy/Skins.js';

// Case opening — GAME_DESIGN.md §8.1
//
// DOM + CSS transform, not WebGL: it is far easier to match the Counter-Strike
// reel exactly in DOM, and it costs nothing to render.
//
// The winner is decided BEFORE the animation starts and placed at a fixed index.
// Every other ticket is visual filler. The outcome is never determined by the
// animation (§8.1, §17.4).

const TICKET_W = 128;      // px, must match .ticket width + gap in case.css
const TICKET_GAP = 8;
const STRIDE = TICKET_W + TICKET_GAP;
const COUNT = 75;
const WIN_INDEX = 68;
const DURATION = 6.0;

// easeOutQuint — extremely fast for the first second, then a long visible crawl
const ease = t => 1 - Math.pow(1 - t, 5);

function fillerSkin() {
  return rollSkin();
}

export class CaseReel {
  constructor(sfx) {
    this.sfx = sfx;
    this.onFinish = null;
    this.running = false;

    this.el = document.createElement('div');
    this.el.id = 'caseOverlay';
    this.el.innerHTML = `
      <div class="caseBox">
        <div class="caseTitle">MEADOW CASE</div>
        <div class="reelWrap">
          <div class="marker"></div>
          <div class="reelStrip"></div>
          <div class="fadeL"></div><div class="fadeR"></div>
        </div>
        <div class="caseResult"></div>
        <div class="caseOdds"></div>
        <button class="caseClose">CLOSE</button>
      </div>`;
    document.body.appendChild(this.el);

    this.strip = this.el.querySelector('.reelStrip');
    this.result = this.el.querySelector('.caseResult');
    this.odds = this.el.querySelector('.caseOdds');
    this.closeBtn = this.el.querySelector('.caseClose');
    this.closeBtn.addEventListener('click', () => this.hide());

    this.odds.innerHTML = ['consumer','industrial','milspec','restricted','classified','covert','gold']
      .map(k => `<span style="color:${TIERS[k].color}">${TIERS[k].name} ${(TIERS[k].odds*100).toFixed(TIERS[k].odds < 0.001 ? 3 : 2)}%</span>`)
      .join('');
  }

  _ticket({ skin, tier, float }) {
    const t = TIERS[tier];
    const d = document.createElement('div');
    d.className = 'ticket';
    d.style.setProperty('--tier', t.color);
    d.innerHTML = `
      <div class="tGlove" style="background:linear-gradient(160deg,#${skin.color.toString(16).padStart(6,'0')},#${skin.accent.toString(16).padStart(6,'0')})"></div>
      <div class="tName">${skin.name}</div>
      <div class="tBar"></div>`;
    return d;
  }

  open() {
    if (this.running) return null;
    this.running = true;
    this.el.classList.add('show');
    this.result.textContent = '';
    this.result.className = 'caseResult';
    this.closeBtn.classList.remove('show');

    // decide the winner FIRST
    const win = rollSkin();
    const instance = mintInstance(win);

    // build the strip
    this.strip.innerHTML = '';
    const items = [];
    for (let i = 0; i < COUNT; i++) {
      items.push(i === WIN_INDEX ? win : fillerSkin());
    }
    for (const it of items) this.strip.appendChild(this._ticket(it));

    // Land somewhere INSIDE the winning ticket, not dead centre. A perfectly
    // centred stop kills the near-miss feeling (§8.1).
    const jitter = (Math.random() * 2 - 1) * (TICKET_W * 0.42);
    const wrapW = this.el.querySelector('.reelWrap').clientWidth || 900;
    const target = WIN_INDEX * STRIDE + TICKET_W / 2 - wrapW / 2 + jitter;

    this._animate(target, win, instance);
    return instance;
  }

  _animate(target, win, instance) {
    const start = performance.now();
    let lastTick = -1;

    const frame = () => {
      const t = Math.min(1, (performance.now() - start) / 1000 / DURATION);
      const x = ease(t) * target;
      this.strip.style.transform = `translateX(${-x}px)`;

      // A tick each time a ticket boundary crosses the marker. Because it is
      // driven by position, the ticks stretch out on their own as the reel slows
      // — the audio IS the deceleration curve.
      const idx = Math.floor(x / STRIDE);
      if (idx !== lastTick) { lastTick = idx; this.sfx?.reelTick(); }

      if (t < 1) requestAnimationFrame(frame);
      else this._settle(win, instance);
    };
    requestAnimationFrame(frame);
  }

  _settle(win, instance) {
    const t = TIERS[win.tier];
    this.el.style.setProperty('--winTier', t.color);
    this.el.classList.add('settled');

    this.result.innerHTML =
      `<div class="rTier" style="color:${t.color}">${t.name}</div>
       <div class="rName">${win.skin.name}</div>
       <div class="rWear">${wearName(win.float)} &nbsp;·&nbsp; <span>${win.float.toFixed(3)}</span></div>`;

    const rare = ['restricted','classified','covert','gold'].includes(win.tier);
    if (rare) this.el.classList.add('rare');
    this.sfx?.reelWin(win.tier);

    this.closeBtn.classList.add('show');
    this.running = false;
    this.onFinish?.(instance);
  }

  hide() {
    this.el.classList.remove('show', 'settled', 'rare');
    this.onHide?.();
  }

  get visible() { return this.el.classList.contains('show'); }
}
