/**
 * board.js - static description of a puzzle board (layout + endpoints).
 * Pure data, no rendering, no mutation of the player paths.
 */

export class Board {
  constructor(level) {
    this.level = level;
    this.cols = level.cols;
    this.rows = level.rows;
    this.size = this.cols * this.rows;

    this.obstacles = new Set();
    (level.obstacles || []).forEach(([c, r]) => this.obstacles.add(this.idx(c, r)));

    /** @type {Array<[number,number]>} pair index -> [startCell, endCell] */
    this.pairs = (level.pairs || []).map(([a, b]) => [this.idx(a[0], a[1]), this.idx(b[0], b[1])]);

    /** cell -> pair index for endpoint cells (a path may not cross a foreign dot) */
    this.endpointOwner = new Int16Array(this.size).fill(-1);
    this.pairs.forEach((p, i) => {
      this.endpointOwner[p[0]] = i;
      this.endpointOwner[p[1]] = i;
    });

    this.colors = level.colors || [];
    this.colorHex = level.colorHex || [];
  }

  idx(c, r) { return r * this.cols + c; }
  col(cell) { return cell % this.cols; }
  row(cell) { return Math.floor(cell / this.cols); }

  inBounds(c, r) { return c >= 0 && c < this.cols && r >= 0 && r < this.rows; }

  isObstacle(cell) { return this.obstacles.has(cell); }

  isEndpoint(cell) { return this.endpointOwner[cell] !== -1; }

  endpointPair(cell) { return this.endpointOwner[cell]; }

  /** 4-neighbourhood of a cell (no wrapping). */
  neighbors(cell) {
    const c = this.col(cell), r = this.row(cell);
    const out = [];
    if (c > 0) out.push(cell - 1);
    if (c < this.cols - 1) out.push(cell + 1);
    if (r > 0) out.push(cell - this.cols);
    if (r < this.rows - 1) out.push(cell + this.cols);
    return out;
  }

  areAdjacent(a, b) {
    return Math.abs(this.col(a) - this.col(b)) + Math.abs(this.row(a) - this.row(b)) === 1;
  }
}

export default Board;
