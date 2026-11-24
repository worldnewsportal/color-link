/**
 * gameplay-screen.js - the playable puzzle screen.
 */

import { Board } from '../core/board.js';
import { PathEngine } from '../core/path-engine.js';
import { Renderer } from '../core/renderer.js';
import { InputManager } from '../core/input-manager.js';
import { getLevel } from '../core/level-manager.js';
import { pickHint, HINTS_PER_LEVEL } from '../systems/hints.js';
import { play } from '../systems/audio.js';
import { t } from '../systems/localization.js';
import { toast } from './dialogs.js';
import * as Progression from '../systems/progression.js';

const VIB = { light: 12, connect: [0, 18, 40, 18], win: [0, 30, 60, 30, 60, 60], error: [0, 60, 40, 60] };

export class GameplayScreen {
  constructor(app) {
    this.app = app;
    this.levelId = null;
    this.level = null;
    this.board = null;
    this.engine = null;
    this.canvas = document.getElementById('board');
    this.renderer = new Renderer(this.canvas);
    this.input = new InputManager({
      getGeometry: () => this.renderer.geometry(),
      onStart: (cell) => this.onPointerDown(cell),
      onMove: (cell) => this.onPointerMove(cell),
      onEnd: () => this.onPointerUp(),
      onCancel: () => this.onPointerUp(),
    });
    this.activePair = -1;
    this.wasComplete = [];
    this.hintsLeft = HINTS_PER_LEVEL;
    this.startedAt = 0;
    this.finished = false;
    this.accPlaytime = 0;
    this.bindUI();
  }

  /* ------------------------------------------------------------- wiring */
  bindUI() {
    document.getElementById('btn-undo').addEventListener('click', () => this.undo());
    document.getElementById('btn-restart').addEventListener('click', () => this.restart());
    document.getElementById('btn-hint').addEventListener('click', () => this.hint());
    document.getElementById('btn-win-replay').addEventListener('click', () => {
      document.getElementById('win-overlay').hidden = true;
      this.restart();
    });
    document.getElementById('btn-win-levels').addEventListener('click', () => {
      document.getElementById('win-overlay').hidden = true;
      this.app.showScreen('levels');
    });
    document.getElementById('btn-win-next').addEventListener('click', () => {
      document.getElementById('win-overlay').hidden = true;
      const next = this.levelId + 1;
      if (next > this.app.totalLevels) {
        toast(t('toast.lastLevel'));
        this.app.showScreen('levels');
      } else {
        this.start(next);
      }
    });

    window.addEventListener('resize', () => {
      if (this.app.currentScreen === 'game') {
        this.renderer.resize();
        this.renderer.draw(0);
      }
    });
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        if (this.app.currentScreen === 'game') {
          this.renderer.resize();
          this.renderer.draw(0);
        }
      }, 220);
    });
  }

  vibrate(pattern) {
    if (!Progression.getSettings().vibration) return;
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) { /* ignore */ }
    }
  }

  /* -------------------------------------------------------- level entry */
  start(levelId) {
    const level = getLevel(levelId);
    if (!level) return;
    this.levelId = levelId;
    this.level = level;
    this.board = new Board(level);
    this.engine = new PathEngine(this.board);
    this.finished = false;
    this.hintsLeft = HINTS_PER_LEVEL;
    this.startedAt = Date.now();
    this.accPlaytime = 0;
    this.activePair = -1;

    Progression.setCurrentLevel(levelId);
    Progression.addRun();

    document.getElementById('game-level').textContent = String(levelId);
    document.getElementById('hint-count').textContent = String(this.hintsLeft);
    document.getElementById('game-tip').textContent = t('game.tip');
    document.getElementById('win-overlay').hidden = true;

    this.renderer.setScene(this.board, this.engine);
    this.input.attach(this.canvas);
    this.renderer.start();
    this.buildLegend();
    this.showBanner();
  }

  showBanner() {
    const wrap = this.canvas.parentElement;
    const old = wrap.querySelector('.level-banner');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'level-banner';
    el.textContent = `${t('game.level')} ${this.levelId}`;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 1700);
  }

  buildLegend() {
    const legend = document.getElementById('pairs-legend');
    legend.innerHTML = '';
    this.board.pairs.forEach((_, i) => {
      const el = document.createElement('span');
      el.className = 'lg';
      el.dataset.pair = String(i);
      el.innerHTML = `<i style="background:${this.board.colorHex[i]}"></i>`;
      legend.appendChild(el);
    });
  }

  updateLegend() {
    const legend = document.getElementById('pairs-legend');
    const done = this.engine.completedPairs();
    legend.querySelectorAll('.lg').forEach((el, i) => {
      el.classList.toggle('is-done', !!done[i]);
    });
  }

  /* ------------------------------------------------------------ drawing */
  onPointerDown(cell) {
    if (!this.engine || this.finished) return;
    const b = this.board;
    const e = this.engine;

    // 1. start from an endpoint
    if (b.isEndpoint(cell)) {
      const pair = b.endpointPair(cell);
      if (e.isPairComplete(pair) && !this.confirmOverwrite(pair)) return;
      e.pushHistory();
      e.startFrom(pair, cell);
      this.activePair = pair;
      play('click');
      this.vibrate(VIB.light);
      return;
    }

    // 2. continue an existing path from one of its cells
    const owner = e.ownerOf(cell);
    if (owner !== -1 && e.pathContains(owner, cell)) {
      if (e.isPairComplete(owner)) {
        if (!this.confirmOverwrite(owner)) return;
      }
      e.pushHistory();
      e.truncateTo(owner, cell);
      this.activePair = owner;
      play('click');
      return;
    }

    // 3. nothing to grab
    this.activePair = -1;
  }

  /** Keeps the "just connected" state in sync (a pair can be un-done again). */
  syncPairState(pair) {
    const done = this.engine.isPairComplete(pair);
    const was = !!this.wasComplete[pair];
    this.wasComplete[pair] = done;
    if (done && !was) this.onPairComplete(pair);
  }

  /** Completed pairs may be redrawn - ask for confirmation. */
  confirmOverwrite(pair) {
    // simple, non blocking: redrawing a finished pair is allowed
    return true;
  }

  onPointerMove(cell) {
    if (this.activePair < 0 || !this.engine || this.finished) return;
    const e = this.engine;
    const b = this.board;
    const pair = this.activePair;
    const path = e.path(pair);
    if (!path.length) return;

    // moving back over our own path erases it (rubber band)
    const idx = path.indexOf(cell);
    if (idx !== -1 && idx < path.length - 1) {
      e.truncateTo(pair, cell);
      this.syncPairState(pair);
      this.renderer.draw(0);
      return;
    }
    if (cell === path[path.length - 1]) return;

    if (!b.areAdjacent(path[path.length - 1], cell)) return;

    if (e.canExtend(pair, cell)) {
      e.extend(pair, cell);
      this.renderer.popCell(cell, pair);
      this.updateLegend();
      this.syncPairState(pair);
    } else {
      // blocked: wrong colour or a foreign dot
      const other = e.ownerOf(cell);
      if (other !== -1 && other !== pair) {
        play('error');
        this.vibrate(VIB.error);
        this.flashBlocked(cell);
      }
    }
    this.renderer.draw(0);
  }

  onPointerUp() {
    if (this.activePair >= 0 && this.engine) this.syncPairState(this.activePair);
    this.activePair = -1;
    this.updateLegend();
    this.renderer.draw(0);
  }

  flashBlocked(cell) {
    const c = this.renderer.cellCenter(cell);
    this.renderer.particles.burst(c.x, c.y, 6, ['#ff5a5f']);
  }

  onPairComplete(pair) {
    play('connect');
    this.vibrate(VIB.connect);
    this.updateLegend();
    if (this.engine.isComplete()) {
      setTimeout(() => this.onWin(), 380);
    }
  }

  /* ----------------------------------------------------------- commands */
  undo() {
    if (!this.engine) return;
    if (this.engine.undo()) {
      this.wasComplete = this.wasComplete.map(() => false);
      play('undo');
      this.updateLegend();
      this.renderer.draw(0);
    }
  }

  restart() {
    if (!this.engine) return;
    this.engine.reset();
    this.wasComplete = this.wasComplete.map(() => false);
    this.finished = false;
    this.startedAt = Date.now();
    this.accPlaytime = 0;
    this.activePair = -1;
    this.renderer.clearHint();
    document.getElementById('win-overlay').hidden = true;
    this.updateLegend();
    this.renderer.draw(0);
    play('click');
    this.showBanner();
  }

  hint() {
    if (!this.engine || this.finished) return;
    if (this.hintsLeft <= 0) {
      toast(t('hint.none'));
      return;
    }
    const h = pickHint(this.level, this.board, this.engine);
    if (!h || h.pair === -1) {
      toast(h ? h.reason : t('hint.all'));
      return;
    }
    this.hintsLeft -= 1;
    Progression.addHintUsed();
    document.getElementById('hint-count').textContent = String(this.hintsLeft);
    this.renderer.showHint(h.pair, h.cells);
    toast(h.reason);
    play('hint');
    this.vibrate(VIB.light);
  }

  onWin() {
    if (this.finished) return;
    this.finished = true;
    const seconds = Math.max(1, Math.round((Date.now() - this.startedAt) / 1000));
    Progression.markCompleted(this.levelId);
    Progression.recordBestTime(this.levelId, seconds);
    Progression.addPlaytime(seconds);
    Progression.setUnlocked(Math.min(this.levelId + 1, this.app.totalLevels));

    document.getElementById('win-time').textContent = formatTime(seconds);
    document.getElementById('win-overlay').hidden = false;
    this.renderer.celebrate();
    play('win');
    this.vibrate(VIB.win);
    this.app.refreshMenu();
  }

  /* --------------------------------------------------------------- misc */
  onExit() {
    if (this.startedAt && !this.finished) {
      const seconds = Math.round((Date.now() - this.startedAt) / 1000);
      if (seconds > 0) Progression.addPlaytime(seconds);
    }
    this.renderer.stop();
    this.input.detach();
  }

  onResume() {
    if (!this.board) return;
    this.renderer.resize();
    this.renderer.start();
    this.input.attach(this.canvas);
  }
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default GameplayScreen;
