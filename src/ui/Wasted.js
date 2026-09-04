// WASTED.
//
// The death screen. Straight out of GTA and unapologetic about it: the world
// desaturates and blurs behind a closing vignette, and one enormous serif word
// crawls up out of nothing over about two seconds.
//
// Then it makes you sit there for fifteen seconds and reads you the charge
// sheet while it counts down. The wait is the punishment — §3.4 said death
// should be embarrassing rather than punishing, and fifteen seconds of a
// countdown calling you out is precisely that.

export const WASTED = {
  hold: 15.0,          // seconds before you are let out
  taunt: 'skill issue, dying in this game',
};

export class Wasted {
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'wastedOverlay';
    this.el.innerHTML = `
      <div class="wVignette"></div>
      <div class="wCentre">
        <div class="wWord">WASTED</div>
        <div class="wTaunt"></div>
        <div class="wCount"><span class="wNum">15</span></div>
      </div>`;
    document.body.appendChild(this.el);

    this.word = this.el.querySelector('.wWord');
    this.taunt = this.el.querySelector('.wTaunt');
    this.num = this.el.querySelector('.wNum');

    this.active = false;
    this.t = 0;
    this.onRelease = null;

    this._typed = 0;
    this._typeT = 0;
  }

  show() {
    if (this.active) return;
    this.active = true;
    this.t = WASTED.hold;
    this._typed = 0;
    this._typeT = 0;
    this.taunt.textContent = '';
    this.num.textContent = Math.ceil(WASTED.hold);
    // restart the CSS animations from frame zero
    this.el.classList.remove('show');
    void this.el.offsetWidth;
    this.el.classList.add('show');
  }

  hide() {
    this.active = false;
    this.el.classList.remove('show');
  }

  update(dt) {
    if (!this.active) return;

    this.t = Math.max(0, this.t - dt);
    this.num.textContent = Math.ceil(this.t);

    // The taunt types itself out, one character at a time, starting after the
    // word has landed. A line that simply appears is a label; a line that types
    // is someone talking to you.
    const elapsed = WASTED.hold - this.t;
    if (elapsed > 2.1 && this._typed < WASTED.taunt.length) {
      this._typeT += dt;
      while (this._typeT > 0.045 && this._typed < WASTED.taunt.length) {
        this._typeT -= 0.045;
        this._typed++;
        this.taunt.textContent = WASTED.taunt.slice(0, this._typed);
      }
    }

    if (this.t <= 0) {
      this.hide();
      this.onRelease?.();
    }
  }
}
