/**
 * progression.js - save data model: progress, settings, statistics.
 * Every mutation is persisted immediately so a crash/close never loses state.
 */

import { Storage } from './storage.js';

const DEFAULTS = () => ({
  version: 1,
  completed: [],          // array of level ids
  unlocked: 1,            // highest unlocked level id
  currentLevel: 1,        // level the player was last playing
  settings: {
    sfx: true,
    music: false,
    vibration: true,
    lang: 'en',
    theme: 'dark',
  },
  stats: {
    playtime: 0,          // seconds
    hintsUsed: 0,
    runs: 0,
    bestTimes: {},        // level id -> seconds
  },
});

let data = DEFAULTS();

export function loadProgression(totalLevels = 30) {
  const saved = Storage.loadSave();
  data = DEFAULTS();
  if (saved && typeof saved === 'object') {
    if (Array.isArray(saved.completed)) data.completed = saved.completed.filter(n => Number.isFinite(n));
    if (Number.isFinite(saved.unlocked)) data.unlocked = saved.unlocked;
    if (Number.isFinite(saved.currentLevel)) data.currentLevel = saved.currentLevel;
    if (saved.settings && typeof saved.settings === 'object') Object.assign(data.settings, saved.settings);
    if (saved.stats && typeof saved.stats === 'object') Object.assign(data.stats, saved.stats);
  }
  if (!Number.isFinite(data.stats.playtime)) data.stats.playtime = 0;
  if (!data.stats.bestTimes || typeof data.stats.bestTimes !== 'object') data.stats.bestTimes = {};

  // sanitize
  data.completed = [...new Set(data.completed)].filter(n => n >= 1 && n <= totalLevels);
  data.unlocked = Math.min(Math.max(1, data.unlocked), totalLevels);
  data.currentLevel = Math.min(Math.max(1, data.currentLevel), data.unlocked);
  // highest completed level unlocks the next one
  const maxCompleted = data.completed.length ? Math.max(...data.completed) : 0;
  data.unlocked = Math.max(data.unlocked, Math.min(maxCompleted + 1, totalLevels));
  save();
  return data;
}

export function save() { Storage.writeSave(data); }
export function getData() { return data; }
export function getSettings() { return data.settings; }
export function getStats() { return data.stats; }

export function isCompleted(id) { return data.completed.includes(id); }
export function completedCount() { return data.completed.length; }
export function isUnlocked(id, totalLevels = 30) { return id <= data.unlocked; }

export function markCompleted(id) {
  if (!data.completed.includes(id)) {
    data.completed.push(id);
    data.completed.sort((a, b) => a - b);
    if (id + 1 > data.unlocked) data.unlocked = Math.min(id + 1, data.completed.length ? id + 1 : 1);
    save();
  }
}

export function setUnlocked(id) {
  if (id > data.unlocked) { data.unlocked = id; save(); }
}

export function setCurrentLevel(id) {
  if (data.currentLevel !== id) { data.currentLevel = id; save(); }
}

export function setSetting(key, value) {
  data.settings[key] = value;
  save();
}

export function addPlaytime(seconds) {
  data.stats.playtime += Math.max(0, seconds);
  save();
}

export function addHintUsed() { data.stats.hintsUsed += 1; save(); }
export function addRun() { data.stats.runs += 1; save(); }

export function recordBestTime(levelId, seconds) {
  const prev = data.stats.bestTimes[levelId];
  if (prev === undefined || seconds < prev) {
    data.stats.bestTimes[levelId] = seconds;
    save();
  }
}

export function bestTime(levelId) { return data.stats.bestTimes[levelId]; }

export function resetProgress() {
  const settings = { ...data.settings };
  data = DEFAULTS();
  data.settings = settings;      // keep user preferences
  data.stats = DEFAULTS().stats;
  save();
}

export function resetEverything() {
  data = DEFAULTS();
  save();
}
