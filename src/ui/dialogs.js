/**
 * dialogs.js - confirmation dialogs and transient toasts.
 */

import { t } from '../systems/localization.js';
import { play } from '../systems/audio.js';

let overlay, titleEl, textEl, confirmBtn, cancelBtn, toastWrap;
let resolveDialog = null;

export function initDialogs() {
  overlay = document.getElementById('dialog-overlay');
  titleEl = document.getElementById('dialog-title');
  textEl = document.getElementById('dialog-text');
  confirmBtn = document.getElementById('dialog-confirm');
  cancelBtn = document.getElementById('dialog-cancel');
  toastWrap = document.getElementById('toast-wrap');

  cancelBtn.addEventListener('click', () => closeDialog(false));
  confirmBtn.addEventListener('click', () => closeDialog(true));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeDialog(false); });
}

/**
 * Shows a modal question.
 * @returns {Promise<boolean>}
 */
export function askConfirm(title, message, confirmText, cancelText) {
  return new Promise((resolve) => {
    if (!overlay) { resolve(window.confirm(message)); return; }
    titleEl.textContent = title || t('dialog.title');
    textEl.textContent = message || '';
    confirmBtn.textContent = confirmText || t('dialog.confirm');
    cancelBtn.textContent = cancelText || t('dialog.cancel');
    overlay.hidden = false;
    resolveDialog = resolve;
    play('click');
  });
}

export function closeDialog(result) {
  if (!overlay || overlay.hidden) return;
  overlay.hidden = true;
  const r = resolveDialog;
  resolveDialog = null;
  if (r) r(!!result);
}

/** Short non-blocking message. */
export function toast(message, duration = 1900) {
  if (!toastWrap) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  toastWrap.appendChild(el);
  setTimeout(() => {
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 320);
  }, duration);
}

export default { initDialogs, askConfirm, closeDialog, toast };
