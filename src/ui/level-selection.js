/**
 * level-selection.js - the level browser.
 */

import { LEVELS } from '../core/level-manager.js';
import * as Progression from '../systems/progression.js';
import { t } from '../systems/localization.js';
import { toast } from './dialogs.js';
import { play } from '../systems/audio.js';

const LOCK_SVG = '<svg class="lv-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const CHECK_SVG = '<svg class="lv-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>';

export class LevelSelection {
  constructor(app) {
    this.app = app;
    this.grid = document.getElementById('level-grid');
  }

  build() {
    const data = Progression.getData();
    this.grid.innerHTML = '';
    LEVELS.forEach((level) => {
      const unlocked = level.id <= data.unlocked;
      const done = Progression.isCompleted(level.id);
      const current = level.id === data.currentLevel;

      const card = document.createElement('button');
      card.className = 'level-card';
      if (!unlocked) card.classList.add('is-locked');
      if (done) card.classList.add('is-done');
      if (current) card.classList.add('is-current');

      const dots = level.pairs.map((_, i) => `<i style="background:${level.colorHex[i]}"></i>`).join('');
      card.innerHTML = `
        <span class="lv-num">${level.id}</span>
        <span class="lv-dots">${dots}</span>
        <span class="lv-sub">${t(`stats.${level.difficulty}`)}</span>
        ${done ? CHECK_SVG : ''}
        ${!unlocked ? LOCK_SVG : ''}`;

      card.addEventListener('click', () => {
        if (!unlocked) {
          toast(t('toast.levelLocked'));
          play('error');
          return;
        }
        play('click');
        this.app.startLevel(level.id);
      });

      this.grid.appendChild(card);
    });

    const chip = document.getElementById('levels-chip');
    if (chip) chip.textContent = `${Progression.completedCount()}/${LEVELS.length}`;
  }
}

export default LevelSelection;
