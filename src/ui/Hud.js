// HUD binding — GAME_DESIGN.md §11
// Understated: stamina fades out at full, health only appears when damaged.

const CIRC = 2 * Math.PI * 34;

export class Hud {
  constructor() {
    this.body = document.body;
    this.chargeFill = document.getElementById('chargeFill');
    this.stamArc = document.getElementById('stamArc');
    this.stamFill = document.getElementById('stamFill');
    this.healthWrap = document.getElementById('healthWrap');
    this.healthBar = document.getElementById('healthBar');
    this.coinCount = document.getElementById('coinCount');
    this.carrotRow = document.getElementById('carrotRow');
    this.carrotCount = document.getElementById('carrotCount');
    this.toast = document.getElementById('toast');
    this.ammo = document.getElementById('ammo');
    this.brushSlot = document.getElementById('brushSlot');
    this.kitSlot = document.getElementById('kitSlot');
    this.shakeSlot = document.getElementById('shakeSlot');
    this.kitNum = this.kitSlot?.querySelector('.kitNum');
    this.ammoMag = document.getElementById('ammoMag');
    this.ammoRes = document.getElementById('ammoRes');
    this.gloveSlot = document.getElementById('gloveSlot');
    this.gunSlot = document.getElementById('gunSlot');
    this.dayLabel = document.getElementById('dayLabel');
    this.debug = document.getElementById('debug');
    this._dayText = '';

    this._stamLen = this.stamFill.getTotalLength();
    this.stamFill.style.strokeDasharray = this._stamLen;
    this._toastT = 0;
    this._healthT = 0;
  }

  update(dt, s) {
    // day + clock. Written only when the string changes: this runs 60 times a
    // second and the text changes once a second at most.
    if (s.day !== undefined && this.dayLabel) {
      const text = `DAY ${s.day}` + (s.clock ? `  ·  ${s.clock}` : '');
      if (text !== this._dayText) {
        this._dayText = text;
        this.dayLabel.textContent = text;
      }
      this.dayLabel.classList.toggle('night', s.clock === 'NIGHT');
    }

    // charge ring
    this.body.classList.toggle('charging', s.charging);
    this.body.classList.toggle('chargeMax', s.charging && s.charge >= 1);
    this.body.classList.toggle('lunging', s.lunging);
    this.chargeFill.style.strokeDashoffset = CIRC * (1 - s.charge);

    // stamina arc
    const full = s.stamina > 0.995;
    this.stamArc.classList.toggle('show', !full);
    this.stamArc.classList.toggle('empty', s.exhausted);
    this.stamFill.style.strokeDashoffset = this._stamLen * (1 - s.stamina);

    // health
    if (s.health < 0.999) this._healthT = 5;
    if (this._healthT > 0) this._healthT -= dt;
    this.healthWrap.classList.toggle('show', this._healthT > 0);
    this.healthBar.style.width = (s.health * 100) + '%';

    this.coinCount.textContent = s.coins;
    this.carrotRow.classList.toggle('show', s.carrots > 0);
    this.carrotCount.textContent = s.carrots;

    // weapon slots + ammo
    const gunOut = s.weapon === 'gun';
    this.gloveSlot.classList.toggle('active', s.weapon === 'glove');
    this.gunSlot.classList.toggle('active', gunOut);
    this.brushSlot?.classList.toggle('active', s.weapon === 'brush');
    // Slots 5 and 6 highlight the same way the weapons do — the bar has to
    // read as one row of six, not four weapons and two badges.
    this.kitSlot?.classList.toggle('active', s.weapon === 'kit');
    this.shakeSlot?.classList.toggle('active', s.weapon === 'shake');
    this.shakeSlot?.classList.toggle('locked', (s.proteinShake ?? 0) <= 0);

    // carried healing shakes
    if (this.kitSlot) {
      this.kitSlot.classList.toggle('locked', !s.healKits);
      if (this.kitNum) this.kitNum.textContent = s.healKits ?? 0;
    }
    this.ammo.classList.toggle('show', gunOut);
    this.ammo.classList.toggle('empty', gunOut && s.ammo === 0 && !s.reloading);
    this.ammo.classList.toggle('reloading', !!s.reloading);
    // Two in the barrels, and an infinite box of them on your belt. The
    // magazine number matters now (it gates the reload); the reserve never does.
    this.ammoMag.textContent = s.reloading ? '··' : String(s.ammo);
    this.ammoRes.textContent = '∞';

    if (this._toastT > 0) {
      this._toastT -= dt;
      if (this._toastT <= 0) this.toast.classList.remove('show');
    }
  }

  say(text, kind = 'good', seconds = 1.4) {
    this.toast.textContent = text;
    this.toast.className = 'show ' + kind;
    this._toastT = seconds;
  }

  setDebug(text) { this.debug.textContent = text; }
  toggleDebug()  { this.debug.classList.toggle('show'); }
}
