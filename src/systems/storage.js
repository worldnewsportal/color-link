/**
 * storage.js - safe LocalStorage access with an in-memory fallback.
 * Private-browsing / disabled-storage environments never break the game.
 */

const KEY = 'colorlink.save.v1';

function probe() {
  try {
    const t = '__cl_probe__';
    window.localStorage.setItem(t, '1');
    window.localStorage.removeItem(t);
    return window.localStorage;
  } catch (e) {
    return null;
  }
}

const store = probe();
const memory = {};

export const Storage = {
  available: !!store,

  get(key, fallback = null) {
    try {
      const raw = store ? store.getItem(key) : memory[key];
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  },

  set(key, value) {
    try {
      const raw = JSON.stringify(value);
      if (store) store.setItem(key, raw);
      else memory[key] = raw;
      return true;
    } catch (e) {
      memory[key] = JSON.stringify(value);
      return false;
    }
  },

  remove(key) {
    try {
      if (store) store.removeItem(key);
      else delete memory[key];
    } catch (e) { /* ignore */ }
  },

  loadSave() { return this.get(KEY, null); },
  writeSave(data) { return this.set(KEY, data); },
  clearSave() { this.remove(KEY); },
};
