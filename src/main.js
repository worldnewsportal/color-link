/**
 * main.js - entry point. Boots the game once the DOM is ready.
 */

import { Game } from './core/game.js';

function boot() {
  const game = new Game();
  game.boot();
  window.ColorLink = game;      // handy for debugging / automated tests
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
