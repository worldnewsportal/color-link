/**
 * input-manager.js - unified pointer handling (touch / stylus / mouse).
 *
 * * only the primary pointer is tracked (no accidental multi-touch)
 * * pointer capture keeps the drag alive outside of the canvas
 * * cancel events abort the stroke cleanly
 */

export class InputManager {
  constructor(options = {}) {
    this.canvas = null;
    this.geom = options.getGeometry || (() => null);
    this.onStart = options.onStart || (() => {});
    this.onMove = options.onMove || (() => {});
    this.onEnd = options.onEnd || (() => {});
    this.onCancel = options.onCancel || (() => {});
    this.active = false;
    this.pointerId = null;
    this._bound = {};
  }

  attach(canvas) {
    this.detach();
    this.canvas = canvas;
    const b = this._bound;

    b.down = (e) => {
      if (!e.isPrimary) return;                 // ignore extra fingers
      if (this.active) return;
      const cell = this._cellAt(e);
      if (cell === null) return;
      this.active = true;
      this.pointerId = e.pointerId;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not fatal */ }
      e.preventDefault();
      this.onStart(cell, e);
    };

    b.move = (e) => {
      if (!this.active || e.pointerId !== this.pointerId) return;
      e.preventDefault();
      const cell = this._cellAt(e);
      if (cell !== null) this.onMove(cell, e);
    };

    b.up = (e) => {
      if (!this.active || e.pointerId !== this.pointerId) return;
      e.preventDefault();
      this.active = false;
      this.pointerId = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      this.onEnd(e);
    };

    b.cancel = (e) => {
      if (!this.active) return;
      if (e && e.pointerId !== this.pointerId) return;
      this.active = false;
      this.pointerId = null;
      this.onCancel(e);
    };

    canvas.addEventListener('pointerdown', b.down, { passive: false });
    canvas.addEventListener('pointermove', b.move, { passive: false });
    canvas.addEventListener('pointerup', b.up, { passive: false });
    canvas.addEventListener('pointercancel', b.cancel, { passive: false });
    window.addEventListener('pointerup', b.up, { passive: false });
    window.addEventListener('blur', b.cancel);
    // belt & braces: block native gestures on the board
    canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  detach() {
    if (!this.canvas) return;
    const b = this._bound;
    const c = this.canvas;
    if (b.down) c.removeEventListener('pointerdown', b.down);
    if (b.move) c.removeEventListener('pointermove', b.move);
    if (b.up) c.removeEventListener('pointerup', b.up);
    if (b.cancel) c.removeEventListener('pointercancel', b.cancel);
    if (b.up) window.removeEventListener('pointerup', b.up);
    if (b.cancel) window.removeEventListener('blur', b.cancel);
    this.canvas = null;
  }

  /** Screen coordinates -> cell index (or null when outside the board). */
  _cellAt(e) {
    const g = this.geom();
    if (!g) return null;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x < g.ox || y < g.oy || x > g.ox + g.cols * g.size || y > g.oy + g.rows * g.size) return null;
    const c = Math.floor((x - g.ox) / g.size);
    const r = Math.floor((y - g.oy) / g.size);
    if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return null;
    return r * g.cols + c;
  }
}

export default InputManager;
