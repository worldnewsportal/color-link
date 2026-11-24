/**
 * level-manager.js - level catalogue access + structural validation.
 */

import { LEVELS, LEVEL_COUNT } from '../data/levels.js';

export { LEVELS, LEVEL_COUNT };

const byId = new Map(LEVELS.map((l) => [l.id, l]));

/**
 * Validates a level definition. Returns { ok, errors[] }.
 * Checks that endpoints are in bounds, on free cells, unique per pair and
 * that the bundled reference solution really connects every pair.
 */
export function validateLevel(level) {
  const errors = [];
  const { cols, rows, pairs = [], obstacles = [], solution = [] } = level || {};

  if (!Number.isFinite(cols) || !Number.isFinite(rows) || cols < 2 || rows < 2) {
    errors.push('invalid grid size');
  }
  if (!pairs.length) errors.push('no color pairs');

  const seen = new Set();
  pairs.forEach((p, i) => {
    const [a, b] = p;
    if (!a || !b || a.length !== 2 || b.length !== 2) { errors.push(`pair ${i} malformed`); return; }
    [[a, 0], [b, 1]].forEach(([cell, side]) => {
      const [c, r] = cell;
      if (c < 0 || c >= cols || r < 0 || r >= rows) errors.push(`pair ${i} endpoint ${side} out of bounds`);
      const key = `${c},${r}`;
      if (seen.has(key)) errors.push(`duplicate endpoint at ${key}`);
      seen.add(key);
      if (obstacles.some(([oc, orr]) => oc === c && orr === r)) errors.push(`endpoint ${key} sits on an obstacle`);
    });
    if (a[0] === b[0] && a[1] === b[1]) errors.push(`pair ${i} has identical endpoints`);
  });

  if (solution.length !== pairs.length) {
    errors.push('solution does not cover every pair');
  } else {
    const used = new Set();
    solution.forEach((path, i) => {
      if (!path || path.length < 2) { errors.push(`solution path ${i} too short`); return; }
      path.forEach((cell) => {
        const [c, r] = cell;
        if (c < 0 || c >= cols || r < 0 || r >= rows) errors.push(`solution path ${i} out of bounds`);
        const key = `${c},${r}`;
        if (used.has(key)) errors.push(`solution crosses itself at ${key}`);
        used.add(key);
        if (obstacles.some(([oc, orr]) => oc === c && orr === r)) errors.push(`solution crosses an obstacle at ${key}`);
      });
      for (let k = 0; k < path.length - 1; k++) {
        const [c1, r1] = path[k]; const [c2, r2] = path[k + 1];
        if (Math.abs(c1 - c2) + Math.abs(r1 - r2) !== 1) errors.push(`solution path ${i} has a gap`);
      }
      const s = path[0]; const e = path[path.length - 1];
      const pa = pairs[i][0]; const pb = pairs[i][1];
      const match = (s[0] === pa[0] && s[1] === pa[1] && e[0] === pb[0] && e[1] === pb[1])
        || (s[0] === pb[0] && s[1] === pb[1] && e[0] === pa[0] && e[1] === pa[1]);
      if (!match) errors.push(`solution path ${i} does not match its endpoints`);
    });
  }

  return { ok: errors.length === 0, errors };
}

/** Runs validation over the whole catalogue once, at boot. */
export function validateAllLevels() {
  const report = LEVELS.map((l) => ({ id: l.id, ...validateLevel(l) }));
  const broken = report.filter((r) => !r.ok);
  if (broken.length) {
    console.error('[ColorLink] invalid levels:', broken);
  } else {
    console.info(`[ColorLink] ${report.length} levels validated.`);
  }
  return report;
}

export function getLevel(id) {
  return byId.get(id) || null;
}

export function getLevelIds() {
  return LEVELS.map((l) => l.id);
}

export default { LEVELS, LEVEL_COUNT, getLevel, validateLevel, validateAllLevels };
