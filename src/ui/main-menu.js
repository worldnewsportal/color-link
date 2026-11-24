/**
 * main-menu.js - the home screen.
 */

import { play, isSfxEnabled, setSfxEnabled, unlockAudio } from '../systems/audio.js';
import { t, getLang, setLang } from '../systems/localization.js';
import * as Progression from '../systems/progression.js';
import { toast } from './dialogs.js';

export class MainMenu {
  constructor(app) {
    this.app = app;
    this.bind();
  }

  bind() {
    document.getElementById('btn-play').addEventListener('click', () => {
      const id = Progression.getData().currentLevel || 1;
      this.app.startLevel(id);
    });

    document.getElementById('btn-continue').addEventListener('click', () => {
      const data = Progression.getData();
      const done = new Set(data.completed);
      let next = 1;
      while (done.has(next) && next < this.app.totalLevels) next++;
      this.app.startLevel(Math.min(next, data.unlocked, this.app.totalLevels));
    });

    document.getElementById('btn-levels').addEventListener('click', () => this.app.showScreen('levels'));
    document.getElementById('btn-stats').addEventListener('click', () => this.app.showScreen('stats'));
    document.getElementById('btn-settings').addEventListener('click', () => this.app.showScreen('settings'));

    document.getElementById('btn-sound-toggle').addEventListener('click', () => {
      const next = !isSfxEnabled();
      setSfxEnabled(next);
      Progression.setSetting('sfx', next);
      this.app.syncSoundIcon();
      toast(next ? t('toast.sound.on') : t('toast.sound.off'));
      if (next) play('click');
    });

    document.getElementById('btn-theme-toggle').addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      Progression.setSetting('theme', next);
      this.app.syncThemeButtons();
    });

    document.getElementById('btn-lang-toggle').addEventListener('click', () => {
      const next = getLang() === 'en' ? 'ar' : 'en';
      setLang(next);
      Progression.setSetting('lang', next);
      this.app.syncLangButtons();
      this.app.refreshAll();
    });
  }

  refresh() {
    const data = Progression.getData();
    const completed = Progression.completedCount();
    const total = this.app.totalLevels;
    document.getElementById('menu-level').textContent = String(data.currentLevel || 1);
    document.getElementById('menu-completed').textContent = String(completed);
    document.getElementById('menu-progress').textContent =
      `${Math.round((completed / total) * 100)}%`;
  }
}

export default MainMenu;
