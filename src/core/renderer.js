/**
 * renderer.js - canvas renderer for the puzzle board.
 * DPR aware, resolution independent, 60 fps animation loop.
 */

import { Particles } from '../systems/particles.js';

const EASE = (t) => 1 - Math.pow(1 - t, 3);

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.board = null;
    this.engine = null;
    this.particles = new Particles();
    this.hintPath = null;         // { pair, cells:[] } ghost of a valid solution
    this.hintAlpha = 0;
    this.pops = [];              // { cell, pair, t0 }
    this.geo = null;
    this.running = false;
    this._last = 0;
    this._raf = null;
    this._onFrame = null;
    this._forceDraw = true;
    this._theme = {};
    this._themeAge = 999;
  }

  setScene(board, engine) {
    this.board = board;
    this.engine = engine;
    this.particles.clear();
    this.pops.length = 0;
    this.hintPath = null;
    this.resize();
  }

  /** Returns the current board geometry (used by the input manager). */
  geometry() { return this.geo; }

  resize() {
    if (!this.board) return;
    const wrap = this.canvas.parentElement;
    const rect = wrap.getBoundingClientRect();
    const availW = Math.max(120, rect.width - 16);
    const availH = Math.max(120, rect.height - 16);
    const cell = Math.max(18, Math.floor(Math.min(availW / this.board.cols, availH / this.board.rows)));
    const w = cell * this.board.cols;
    const h = cell * this.board.rows;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.geo = { ox: 0, oy: 0, size: cell, cols: this.board.cols, rows: this.board.rows, w, h };
    this._forceDraw = true;
  }

  /** Theme colours are read from the CSS variables, but only every ~30 frames. */
  themeColors(dt) {
    this._themeAge += dt;
    if (this._themeAge > 0.5 || !this._theme.cellFill) {
      this._themeAge = 0;
      const styles = getComputedStyle(document.documentElement);
      const next = {
        cellFill: styles.getPropertyValue('--cell').trim() || 'rgba(255,255,255,.07)',
        cellLine: styles.getPropertyValue('--cell-line').trim() || 'rgba(255,255,255,.09)',
        obstacleFill: styles.getPropertyValue('--surface-2').trim() || 'rgba(255,255,255,.12)',
      };
      // a theme switch has to repaint the board even if nothing else changed
      if (next.cellFill !== this._theme.cellFill || next.obstacleFill !== this._theme.obstacleFill) {
        this._forceDraw = true;
      }
      this._theme = next;
    }
    return this._theme;
  }

  cellCenter(cell) {
    const g = this.geo;
    const c = cell % this.board.cols;
    const r = Math.floor(cell / this.board.cols);
    return {
      x: g.ox + (c + 0.5) * g.size,
      y: g.oy + (r + 0.5) * g.size,
    };
  }

  popCell(cell, pair) {
    this.pops.push({ cell, pair, t0: performance.now() });
  }

  showHint(pair, cells) {
    this.hintPath = { pair, cells };
    this.hintAlpha = 0;
  }

  clearHint() { this.hintPath = null; }

  celebrate() {
    if (!this.geo) return;
    const g = this.geo;
    this.particles.burst(g.w / 2, g.h / 2, 34, this.board.colorHex);
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        if (this.board) this.particles.burst(g.w * (0.2 + 0.3 * i), g.h * (0.3 + 0.2 * (i % 2)), 20, this.board.colorHex);
      }, 160 * i);
    }
  }

  start(onFrame) {
    this._onFrame = onFrame;
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = (now - this._last) / 1000;
      this._last = now;
      this.draw(dt);
      if (this._onFrame) this._onFrame(dt);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this._onFrame = null;
  }

  draw(dt = 0) {
    const ctx = this.ctx;
    if (!this.board || !this.geo) return;
    const g = this.geo;

    // theme colours are refreshed before the idle check, otherwise a theme
    // switch would never repaint the board
    const theme = this.themeColors(dt);

    // only repaint when something actually changed - keeps the CPU idle
    const busy = this.pops.length > 0
      || this.particles.items.length > 0
      || (this.hintPath && this.hintAlpha < 1)
      || (this.engine && this.engine.dirty);
    if (!busy && !this._forceDraw) return;
    this._forceDraw = false;
    if (this.engine) this.engine.dirty = false;

    ctx.clearRect(0, 0, g.w, g.h);

    const cellFill = theme.cellFill;
    const cellLine = theme.cellLine;
    const obstacleFill = theme.obstacleFill;

    // ---- grid cells
    ctx.save();
    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        const cell = r * this.board.cols + c;
        if (this.board.isObstacle(cell)) {
          roundRect(ctx, c * g.size + g.size * 0.14, r * g.size + g.size * 0.14,
            g.size * 0.72, g.size * 0.72, g.size * 0.18);
          ctx.fillStyle = obstacleFill;
          ctx.fill();
          continue;
        }
        roundRect(ctx, c * g.size + 2, r * g.size + 2, g.size - 4, g.size - 4, g.size * 0.22);
        ctx.fillStyle = cellFill;
        ctx.fill();
        ctx.strokeStyle = cellLine;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    ctx.restore();

    // ---- hint ghost
    if (this.hintPath) {
      this.hintAlpha = Math.min(1, this.hintAlpha + dt * 2.2);
      ctx.save();
      ctx.globalAlpha = 0.75 * this.hintAlpha;
      ctx.setLineDash([g.size * 0.22, g.size * 0.18]);
      ctx.lineDashOffset = -performance.now() / 45;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = g.size * 0.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      this.hintPath.cells.forEach((cell, i) => {
        const p = this.cellCenter(cell);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.restore();
    }

    // ---- paths
    const engine = this.engine;
    if (engine) {
      engine.paths.forEach((path, i) => {
        if (path.length < 2) return;
        const color = this.board.colorHex[i] || '#7c5cff';
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        path.forEach((cell, k) => {
          const p = this.cellCenter(cell);
          if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        });
        // soft glow: a wide translucent stroke instead of an expensive shadow
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.22;
        ctx.lineWidth = g.size * 0.62;
        ctx.stroke();
        ctx.globalAlpha = 0.96;
        ctx.lineWidth = g.size * 0.4;
        ctx.stroke();
        ctx.restore();
      });
    }

    // ---- endpoints
    this.board.pairs.forEach((pair, i) => {
      const color = this.board.colorHex[i] || '#7c5cff';
      const done = engine && engine.isPairComplete(i);
      pair.forEach((cell) => {
        const p = this.cellCenter(cell);
        const rad = g.size * 0.28;
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad * 1.32, 0, Math.PI * 2);
        ctx.fillStyle = done ? color : 'rgba(255,255,255,.18)';
        ctx.globalAlpha = done ? 0.35 : 1;
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad * 1.18, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.24;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad * 0.42, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        ctx.fill();
        ctx.restore();
      });
    });

    // ---- pop animations
    const now = performance.now();
    this.pops = this.pops.filter((p) => now - p.t0 < 320);
    for (const p of this.pops) {
      const k = EASE(Math.min(1, (now - p.t0) / 320));
      const c = this.cellCenter(p.cell);
      const color = this.board.colorHex[p.pair] || '#fff';
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.beginPath();
      ctx.arc(c.x, c.y, g.size * 0.42 * (1 - k * 0.7), 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    }

    // ---- particles
    this.particles.update(dt);
    this.particles.draw(ctx);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export default Renderer;
