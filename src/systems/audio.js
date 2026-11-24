/**
 * audio.js - fully synthesized audio (WebAudio). No audio files to break,
 * no external requests, works offline inside an Android WebView.
 */

let ctx = null;
let master = null;
let musicGain = null;
let musicTimer = null;
let musicStep = 0;
let unlocked = false;

const state = { sfx: true, music: false };

function ensureCtx() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.0;
    musicGain.connect(master);
  } catch (e) {
    ctx = null;
  }
  return ctx;
}

/** Must be called from a user gesture (browsers block autoplay otherwise). */
export function unlockAudio() {
  const c = ensureCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  unlocked = true;
  if (state.music) startMusic();
}

export function setSfxEnabled(v) { state.sfx = !!v; }
export function setMusicEnabled(v) {
  state.music = !!v;
  if (state.music) { unlockAudio(); startMusic(); }
  else stopMusic();
}
export function isSfxEnabled() { return state.sfx; }
export function isMusicEnabled() { return state.music; }

function tone(freq, start, dur, type = 'sine', gain = 0.2, dest = null) {
  const c = ensureCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + start);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  osc.connect(g);
  g.connect(dest || master);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + dur + 0.05);
}

const SFX = {
  click() { tone(520, 0, 0.09, 'triangle', 0.16); tone(780, 0.01, 0.07, 'sine', 0.08); },
  error() { tone(160, 0, 0.16, 'sawtooth', 0.14); tone(120, 0.02, 0.18, 'square', 0.08); },
  connect() { [523, 659, 784].forEach((f, i) => tone(f, i * 0.07, 0.22, 'sine', 0.16)); },
  hint() { [880, 1174, 1568].forEach((f, i) => tone(f, i * 0.05, 0.18, 'triangle', 0.12)); },
  win() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, i * 0.11, 0.5, 'sine', 0.18));
    tone(261, 0, 1.2, 'triangle', 0.1);
  },
  undo() { tone(340, 0, 0.12, 'sine', 0.14); tone(240, 0.05, 0.14, 'sine', 0.1); },
};

export function play(name) {
  if (!state.sfx || !unlocked) return;
  const fn = SFX[name];
  if (fn) { try { fn(); } catch (e) { /* ignore */ } }
}

/* ------------------------------------------------------------- music */
const MUSIC_PATTERN = [
  [0, 261.63], [0.5, 329.63], [1, 392.0], [1.5, 329.63],
  [2, 293.66], [2.5, 349.23], [3, 440.0], [3.5, 349.23],
  [4, 261.63], [4.5, 329.63], [5, 392.0], [5.5, 493.88],
  [6, 440.0], [6.5, 392.0], [7, 329.63], [7.5, 293.66],
];

function startMusic() {
  const c = ensureCtx();
  if (!c || musicTimer) return;
  musicGain.gain.cancelScheduledValues(c.currentTime);
  musicGain.gain.setValueAtTime(0.0001, c.currentTime);
  musicGain.gain.linearRampToValueAtTime(0.09, c.currentTime + 1.5);
  musicStep = 0;
  const loop = () => {
    const now = performance.now();
    while (musicStep * 500 <= now - 0) break;
    // schedule one step at a time
    const [off, freq] = MUSIC_PATTERN[musicStep % MUSIC_PATTERN.length];
    const startAt = (musicStep % 2) * 0.5 + off * 0.5;
    const delay = Math.max(0, startAt - ((now - musicTimer) / 1000));
    tone(freq, delay, 0.6, 'sine', 0.5, musicGain);
    tone(freq * 2, delay, 0.35, 'triangle', 0.12, musicGain);
    musicStep++;
    musicTimer = setTimeout(loop, 500);
  };
  musicTimer = setTimeout(loop, 50);
}

function stopMusic() {
  if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
  const c = ensureCtx();
  if (c && musicGain) {
    musicGain.gain.cancelScheduledValues(c.currentTime);
    musicGain.gain.setValueAtTime(musicGain.gain.value, c.currentTime);
    musicGain.gain.linearRampToValueAtTime(0.0001, c.currentTime + 0.4);
  }
}

export function refreshMusic() {
  if (state.music) startMusic();
}
