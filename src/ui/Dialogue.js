// CONVERSATION.
//
// An Elder-Scrolls-shaped dialogue box: the speaker's line at the top, typing
// itself out, and a list of numbered replies underneath. Pick with 1-9, the
// arrow keys and Enter, or the mouse.
//
// It is deliberately a small DOM overlay rather than anything in the scene. The
// zoom that makes it feel like a conversation is done by the CAMERA, in
// main.js — this only owns the words.

export class Dialogue {
  constructor(sfx) {
    this.sfx = sfx;
    this.open = false;
    this.node = null;        // the current node id
    this.tree = null;
    this.speaker = '';
    this.onClose = null;
    this.onPick = null;      // (optionId) => void, before the node changes

    this._typed = 0;
    this._typeT = 0;
    this._full = '';
    this._hover = 0;

    this.el = document.createElement('div');
    this.el.id = 'dialogueOverlay';
    this.el.innerHTML = `
      <div class="dBox">
        <div class="dWho"></div>
        <div class="dLine"></div>
        <div class="dOpts"></div>
        <div class="dHint">1-9 or ↑↓ + Enter &nbsp;·&nbsp; Esc to leave</div>
      </div>`;
    document.body.appendChild(this.el);

    this.who = this.el.querySelector('.dWho');
    this.line = this.el.querySelector('.dLine');
    this.opts = this.el.querySelector('.dOpts');

    // Its own key handler. The game's Input is action-mapped and pointer-lock
    // gated; a conversation needs raw number keys with the cursor free.
    this._onKey = (e) => {
      if (!this.open) return;
      if (e.code === 'Escape') { e.preventDefault(); this.close(); return; }

      if (e.code === 'ArrowDown') { this._move(1); e.preventDefault(); return; }
      if (e.code === 'ArrowUp') { this._move(-1); e.preventDefault(); return; }
      if (e.code === 'Enter' || e.code === 'Space') { this._choose(this._hover); e.preventDefault(); return; }

      const n = /^Digit([1-9])$/.exec(e.code);
      if (n) {
        // Count the RENDERED options, not `node.options` — that is a function
        // on every node, and a function's `.length` is its arity, which is 0.
        // Every number key silently did nothing.
        const count = this._options?.length ?? 0;
        const i = parseInt(n[1], 10) - 1;
        if (i < count) { this._choose(i); e.preventDefault(); }
      }
    };
    addEventListener('keydown', this._onKey);
  }

  get visible() { return this.open; }
  get _current() { return this.tree?.nodes?.[this.node]; }

  // `tree` is { speaker, start, nodes: { id: { text, options:[{label, to, do}] } } }
  start(tree) {
    this.tree = tree;
    this.speaker = tree.speaker ?? '';
    this.who.textContent = this.speaker;
    this.open = true;
    this.el.classList.add('show');
    this._goto(tree.start ?? 'greet');
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.el.classList.remove('show');
    this.onClose?.();
  }

  _goto(id) {
    this.node = id;
    const node = this._current;
    if (!node) { this.close(); return; }

    this._full = typeof node.text === 'function' ? node.text() : node.text;
    this._typed = 0;
    this._typeT = 0;
    this.line.textContent = '';
    this._hover = 0;
    this._render();
  }

  // Rebuilds the option list. This THROWS AWAY the DOM, so it must only run
  // when the options themselves change — never on hover.
  //
  // Hovering used to call it, which meant moving the mouse onto an option
  // destroyed and recreated the element under the cursor. A `click` only fires
  // when mousedown and mouseup land on the SAME node, so every click was
  // silently swallowed while Enter worked perfectly. That is the bug this
  // split exists to prevent; keep hover on _highlight().
  _render() {
    const node = this._current;
    if (!node) return;
    const list = (typeof node.options === 'function' ? node.options() : node.options) ?? [];
    this._options = list;

    this.opts.innerHTML = '';
    this._optEls = list.map((o, i) => {
      const d = document.createElement('div');
      d.className = 'dOpt' + (o.disabled ? ' cant' : '');
      d.innerHTML = `<b>${i + 1}</b><span>${o.label}</span>` +
        (o.cost ? `<em>${o.cost}</em>` : '');
      // hover only repaints the highlight — it must not touch the DOM tree
      d.addEventListener('mouseenter', () => this._highlight(i));
      // A mouse click always ACTS. Only the keyboard fast-forwards the typing
      // first — someone who clicked a specific line meant that line.
      d.addEventListener('click', () => this._choose(i, true));
      this.opts.appendChild(d);
      return d;
    });
    this._highlight(this._hover);
  }

  // Cheap, and crucially non-destructive.
  _highlight(i) {
    if (!this._optEls?.length) return;
    this._hover = Math.max(0, Math.min(i, this._optEls.length - 1));
    this._optEls.forEach((el, k) => el.classList.toggle('on', k === this._hover));
  }

  _move(dir) {
    const n = this._options?.length ?? 0;
    if (!n) return;
    this.sfx?.uiMove?.();
    this._highlight((this._hover + dir + n) % n);
  }

  _choose(i, fromMouse = false) {
    const o = this._options?.[i];
    if (!o) return;

    // Still typing? A key press finishes the line rather than picking, which is
    // what every game with a typewriter effect does. A CLICK is not swallowed.
    if (!fromMouse && this._typed < this._full.length) {
      this._typed = this._full.length;
      this.line.textContent = this._full;
      return;
    }
    // clicking mid-type still snaps the text, it just also acts
    if (this._typed < this._full.length) {
      this._typed = this._full.length;
      this.line.textContent = this._full;
    }

    if (o.disabled) { this.sfx?.deny?.(); return; }
    this.sfx?.uiPick?.();
    this.onPick?.(o);
    o.do?.();
    if (o.to === null) this.close();
    else if (o.to) this._goto(o.to);
    else this._render();
  }

  // Re-read the current node without resetting the typing — used after a
  // purchase changes what the options should say.
  refresh(text) {
    if (text !== undefined) {
      this._full = text;
      this._typed = 0;
      this._typeT = 0;
      this.line.textContent = '';
    }
    this._hover = 0;
    this._render();
  }

  update(dt) {
    if (!this.open) return;
    if (this._typed >= this._full.length) return;
    this._typeT += dt;
    while (this._typeT > 0.018 && this._typed < this._full.length) {
      this._typeT -= 0.018;
      this._typed++;
    }
    this.line.textContent = this._full.slice(0, this._typed);
  }
}
