/**
 * hints.js - hint system (Phase 1: limited free hints, no ads / IAP).
 */

import { t } from './localization.js';

export const HINTS_PER_LEVEL = 3;

/**
 * Picks a hint for the current board state.
 * Prefers a pair that is not connected yet and whose reference solution does
 * not run through cells that are already occupied by another colour.
 *
 * @returns {{pair:number, cells:Array<number>, reason:string}|null}
 */
export function pickHint(level, board, engine) {
  if (!level || !level.solution) return null;
  const pairCount = board.pairs.length;

  const free = (cell) => {
    const owner = engine.ownerOf(cell);
    return owner === -1 || engine.pathContains(owner, cell);
  };

  const unsolved = [];
  for (let i = 0; i < pairCount; i++) if (!engine.isPairComplete(i)) unsolved.push(i);
  if (!unsolved.length) return { pair: -1, cells: [], reason: t('hint.all') };

  const toCell = ([c, r]) => r * board.cols + c;
  const candidates = [];
  for (const i of unsolved) {
    const path = (level.solution[i] || []).map(toCell);
    if (path.length < 2) continue;
    const blocked = path.some((cell) => !free(cell) && !board.isEndpoint(cell));
    candidates.push({ pair: i, cells: path, blocked });
  }
  if (!candidates.length) return { pair: -1, cells: [], reason: t('hint.all') };

  const clean = candidates.filter((c) => !c.blocked);
  const pool = clean.length ? clean : candidates;
  const chosen = pool[0];
  return { pair: chosen.pair, cells: chosen.cells, reason: t('hint.applied') };
}

export default { pickHint, HINTS_PER_LEVEL };
