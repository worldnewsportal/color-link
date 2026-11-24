/**
 * path-engine.js - the rules of the game.
 *
 * A path is a list of cells for one colour. Cells may not be shared between
 * two colours and a path may never cross a foreign endpoint.
 */

export class PathEngine {
  constructor(board) {
    this.board = board;
    this.reset();
  }

  reset() {
    const n = this.board.pairs.length;
    this.paths = Array.from({ length: n }, () => []);
    /** cell -> pair index (-1 = free) */
    this.owner = new Int16Array(this.board.size).fill(-1);
    this.history = [];
    this.dirty = true;
  }

  /** deep snapshot used by undo */
  snapshot() {
    return { paths: this.paths.map((p) => p.slice()), owner: this.owner.slice() };
  }

  restore(state) {
    this.paths = state.paths.map((p) => p.slice());
    this.owner = state.owner.slice();
    this.dirty = true;
  }

  pushHistory() {
    this.history.push(this.snapshot());
    if (this.history.length > 60) this.history.shift();
  }

  undo() {
    if (!this.history.length) return false;
    this.restore(this.history.pop());
    return true;
  }

  get canUndo() { return this.history.length > 0; }

  path(pairIndex) { return this.paths[pairIndex]; }

  /** Is the pair fully connected (path reaches both endpoints)? */
  isPairComplete(pairIndex) {
    const p = this.paths[pairIndex];
    if (p.length < 2) return false;
    const [a, b] = this.board.pairs[pairIndex];
    return p[0] === a && p[p.length - 1] === b;
  }

  isComplete() {
    for (let i = 0; i < this.paths.length; i++) if (!this.isPairComplete(i)) return false;
    return true;
  }

  completedPairs() {
    return this.paths.map((_, i) => this.isPairComplete(i));
  }

  /**
   * Can `pairIndex` extend its path into `cell`?
   * @param {number} pairIndex
   * @param {number} cell
   */
  canExtend(pairIndex, cell) {
    const b = this.board;
    if (cell < 0 || cell >= b.size) return false;
    if (b.isObstacle(cell)) return false;
    const path = this.paths[pairIndex];
    if (!path.length) return false;
    const head = path[path.length - 1];
    if (cell === head) return true;
    if (!b.areAdjacent(head, cell)) return false;
    if (path.includes(cell)) return false;                 // no self overlap
    const owner = this.owner[cell];
    if (owner !== -1 && owner !== pairIndex) return false; // occupied by another colour
    if (b.isEndpoint(cell) && b.endpointPair(cell) !== pairIndex) return false; // foreign dot
    return true;
  }

  /** Append a cell to the path (assumes canExtend). */
  extend(pairIndex, cell) {
    if (!this.canExtend(pairIndex, cell)) return false;
    const path = this.paths[pairIndex];
    path.push(cell);
    this.owner[cell] = pairIndex;
    this.dirty = true;
    return true;
  }

  /** Remove the last cell of a path. */
  retract(pairIndex) {
    const path = this.paths[pairIndex];
    if (path.length <= 1) return false;
    const cell = path.pop();
    if (this.owner[cell] === pairIndex) this.owner[cell] = -1;
    this.dirty = true;
    return true;
  }

  /** Cut a path back to `cell` (exclusive of everything after it). */
  truncateTo(pairIndex, cell) {
    const path = this.paths[pairIndex];
    const at = path.indexOf(cell);
    if (at === -1) return false;
    for (let i = path.length - 1; i > at; i--) {
      const c = path[i];
      if (this.owner[c] === pairIndex) this.owner[c] = -1;
    }
    path.length = at + 1;
    this.dirty = true;
    return true;
  }

  /** Start a fresh path for a pair from one of its endpoints. */
  startFrom(pairIndex, cell) {
    const b = this.board;
    const [a, e] = b.pairs[pairIndex];
    if (cell !== a && cell !== e) return false;
    this.clearPair(pairIndex);
    const path = this.paths[pairIndex];
    path.push(cell);
    this.owner[cell] = pairIndex;
    this.dirty = true;
    return true;
  }

  clearPair(pairIndex) {
    const path = this.paths[pairIndex];
    for (const c of path) if (this.owner[c] === pairIndex) this.owner[c] = -1;
    this.paths[pairIndex] = [];
    this.dirty = true;
  }

  /** Which pair owns a cell (or -1). */
  ownerOf(cell) { return this.owner[cell]; }

  /** Does a path pass through `cell`? */
  pathContains(pairIndex, cell) { return this.paths[pairIndex].includes(cell); }
}

export default PathEngine;
