/**
 * game.js - application shell: screen router, shared services, wiring.
 */

import { LEVEL_COUNT, validateAllLevels } from './level-manager.js';
import { GameplayScreen } from '../ui/gameplay-screen.js';
import { MainMenu } from '../ui/main-menu.js';
import { LevelSelection } from '../ui/level-selection.js';
import { SettingsScreen } from '../ui/settings-screen.js';
import { StatisticsScreen } from '../ui/statistics-screen.js';
import { initDialogs } from '../ui/dialogs.js';
import * as Progression from '../systems/progression.js';
import { setLang } from '../systems/localization.js';
import { setSfxEnabled, setMusicEnabled, unlockAudio, play } from '../systems/audio.js';

export class Game {
  constructor() {
    this.totalLevels = LEVEL_COUNT;
    this.currentScreen = 'menu';
    this.screens = {};
  }

  boot() {
    initDialogs();

    // 1. load the save data and apply the stored preferences
    Progression.loadProgression(this.totalLevels);
    const settings = Progression.getSettings();
    document.documentElement.dataset.theme = settings.theme === 'light' ? 'light' : 'dark';
    setLang(settings.lang);
    setSfxEnabled(!!settings.sfx);
    setMusicEnabled(!!settings.music);

    // 2. validate the level catalogue once
    validateAllLevels();

    // 3. build the screens
    this.gameplay = new GameplayScreen(this);
    this.menu = new MainMenu(this);
    this.levels = new LevelSelection(this);
    this.settings = new SettingsScreen(this);
    this.stats = new StatisticsScreen(this);
    this.screens = {
      menu: this.menu,
      levels: this.levels,
      settings: this.settings,
      stats: this.stats,
      game: this.gameplay,
    };

    // 4. generic navigation buttons
    document.querySelectorAll('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        play('click');
        this.showScreen(btn.dataset.nav);
      });
    });

    // 5. unlock the audio context on the first interaction (browser policy)
    const unlock = () => {
      unlockAudio();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    this.syncSoundIcon();
    this.syncLangButtons();
    this.syncThemeButtons();
    this.refreshAll();
    this.showScreen('menu');

    // 6. keep the canvas crisp when the device rotates
    window.addEventListener('resize', () => {
      if (this.currentScreen === 'game') this.gameplay.renderer.resize();
    });
  }

  showScreen(name) {
    if (!this.screens[name]) return;
    if (this.currentScreen === 'game' && name !== 'game') this.gameplay.onExit();

    document.querySelectorAll('.screen').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.screen === name);
    });
    this.currentScreen = name;
    this.refreshAll();

    if (name === 'game') this.gameplay.onResume();
  }

  startLevel(id) {
    this.gameplay.start(id);
    this.showScreen('game');
  }

  refreshAll() {
    this.menu.refresh();
    this.levels.build();
    this.settings.refresh();
    this.stats.refresh();
  }

  refreshMenu() {
    this.menu.refresh();
    this.levels.build();
    this.stats.refresh();
  }

  syncSoundIcon() {
    const btn = document.getElementById('btn-sound-toggle');
    const on = !!Progression.getSettings().sfx;
    btn.classList.toggle('is-off', !on);
    btn.setAttribute('aria-pressed', String(on));
  }

  syncLangButtons() {
    document.querySelectorAll('#seg-lang [data-lang]').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.lang === document.documentElement.lang);
    });
    document.querySelectorAll('#seg-theme [data-theme]').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.theme === document.documentElement.dataset.theme);
    });
    const label = document.getElementById('lang-label');
    if (label) label.textContent = document.documentElement.lang === 'ar' ? 'ع' : 'EN';
  }

  syncThemeButtons() {
    document.querySelectorAll('#seg-theme [data-theme]').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.theme === document.documentElement.dataset.theme);
    });
  }
}

export default Game;
