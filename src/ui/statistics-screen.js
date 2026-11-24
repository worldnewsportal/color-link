/**
 * statistics-screen.js - progress overview.
 */

import * as Progression from '../systems/progression.js';
import { LEVELS } from '../core/level-manager.js';
import { t } from '../systems/localization.js';

export class StatisticsScreen {
  constructor(app) {
    this.app = app;
  }

  refresh() {
    const stats = Progression.getStats();
    document.getElementById('st-completed').textContent = `${Progression.completedCount()}/${LEVELS.length}`;
    document.getElementById('st-playtime').textContent = formatPlaytime(stats.playtime);
    document.getElementById('st-hints').textContent = String(stats.hintsUsed || 0);
    document.getElementById('st-runs').textContent = String(stats.runs || 0);

    const times = Object.values(stats.bestTimes || {});
    const best = times.length ? Math.min(...times) : null;
    document.getElementById('st-best').textContent = best === null ? '—' : formatSeconds(best);

    const box = document.getElementById('st-difficulty');
    box.innerHTML = '';
    const groups = {};
    LEVELS.forEach((l) => {
      groups[l.difficulty] = groups[l.difficulty] || { total: 0, done: 0 };
      groups[l.difficulty].total += 1;
      if (Progression.isCompleted(l.id)) groups[l.difficulty].done += 1;
    });
    Object.entries(groups).forEach(([diff, info]) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<span>${t(`stats.${diff}`)}</span><b>${info.done}/${info.total}</b>`;
      box.appendChild(row);
    });
  }
}

export function formatPlaytime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}${t('time.hours')} ${m}${t('time.minutes')}`;
  if (m > 0) return `${m}${t('time.minutes')}`;
  return `${s}${t('time.seconds')}`;
}

export function formatSeconds(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default StatisticsScreen;
