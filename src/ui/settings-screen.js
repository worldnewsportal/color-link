/**
 * settings-screen.js - all settings are applied and persisted immediately.
 */

import * as Progression from '../systems/progression.js';
import { setLang, getLang, applyTranslations, t } from '../systems/localization.js';
import { setSfxEnabled, setMusicEnabled, play, unlockAudio } from '../systems/audio.js';
import { askConfirm, toast } from './dialogs.js';

export class SettingsScreen {
  constructor(app) {
    this.app = app;
    this.bind();
  }

  bind() {
    const swSfx = document.getElementById('sw-sfx');
    const swMusic = document.getElementById('sw-music');
    const swVib = document.getElementById('sw-vibration');

    swSfx.addEventListener('click', () => {
      const next = swSfx.getAttribute('aria-checked') !== 'true';
      swSfx.setAttribute('aria-checked', String(next));
      Progression.setSetting('sfx', next);
      setSfxEnabled(next);
      if (next) { unlockAudio(); play('click'); }
    });

    swMusic.addEventListener('click', () => {
      const next = swMusic.getAttribute('aria-checked') !== 'true';
      swMusic.setAttribute('aria-checked', String(next));
      Progression.setSetting('music', next);
      unlockAudio();
      setMusicEnabled(next);
      if (next) play('click');
    });

    swVib.addEventListener('click', () => {
      const next = swVib.getAttribute('aria-checked') !== 'true';
      swVib.setAttribute('aria-checked', String(next));
      Progression.setSetting('vibration', next);
      if (next && navigator.vibrate) { try { navigator.vibrate(15); } catch (e) { /* ignore */ } }
    });

    document.getElementById('seg-lang').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-lang]');
      if (!btn) return;
      const lang = btn.dataset.lang;
      setLang(lang);
      Progression.setSetting('lang', lang);
      this.app.syncLangButtons();
      this.app.refreshAll();
      play('click');
    });

    document.getElementById('seg-theme').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-theme]');
      if (!btn) return;
      const theme = btn.dataset.theme;
      document.documentElement.dataset.theme = theme;
      Progression.setSetting('theme', theme);
      this.app.syncThemeButtons();
      play('click');
    });

    document.getElementById('btn-reset').addEventListener('click', async () => {
      const ok = await askConfirm(t('dialog.title'), t('toast.resetConfirm'));
      if (!ok) return;
      Progression.resetProgress();
      this.app.refreshAll();
      toast(t('toast.reset'));
      play('error');
    });
  }

  refresh() {
    const s = Progression.getSettings();
    document.getElementById('sw-sfx').setAttribute('aria-checked', String(!!s.sfx));
    document.getElementById('sw-music').setAttribute('aria-checked', String(!!s.music));
    document.getElementById('sw-vibration').setAttribute('aria-checked', String(!!s.vibration));
    this.app.syncLangButtons();
    this.app.syncThemeButtons();
  }
}

export default SettingsScreen;
