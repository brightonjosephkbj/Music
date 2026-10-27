let AsyncStorage = null;
try { AsyncStorage = require('@react-native-async-storage/async-storage').default; } catch (e) {}

const KEY = 'obsidian_audio_settings_v1';
export const DEFAULTS = { speed: 1, volume: 1, preservesPitch: true };

let state = { global: { ...DEFAULTS }, items: {} };
const listeners = new Set();

function emit() { listeners.forEach((l) => l(state)); }
function save() {
  if (AsyncStorage) AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}

export async function loadAudioSettings() {
  if (!AsyncStorage) return;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      state = { global: { ...DEFAULTS, ...(s.global || {}) }, items: s.items || {} };
      emit();
    }
  } catch (e) {}
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState() { return state; }

export function effective(trackId) {
  return { ...state.global, ...((trackId && state.items[trackId]) || {}) };
}

export function setSetting(scope, trackId, patch) {
  if (scope === 'item' && trackId) {
    state = { ...state, items: { ...state.items, [trackId]: { ...(state.items[trackId] || {}), ...patch } } };
  } else {
    state = { ...state, global: { ...state.global, ...patch } };
  }
  save();
  emit();
}

export function resetSetting(scope, trackId, keys) {
  if (scope === 'item' && trackId) {
    const cur = { ...(state.items[trackId] || {}) };
    keys.forEach((k) => delete cur[k]);
    state = { ...state, items: { ...state.items, [trackId]: cur } };
  } else {
    const g = { ...state.global };
    keys.forEach((k) => { g[k] = DEFAULTS[k]; });
    state = { ...state, global: g };
  }
  save();
  emit();
}

export function applyAudioSettings(player, trackId) {
  if (!player) return;
  const s = effective(trackId);
  try {
    player.playbackRate = s.speed;
    player.preservesPitch = s.preservesPitch;
    player.volume = Math.max(0, Math.min(1, s.volume));
  } catch (e) {}
}

export function trackKey(t) {
  if (!t) return null;
  const k = t.id ?? t.uri ?? t.path ?? t.title;
  return k == null ? null : String(k);
}

export function applyToPlayers({ audioPlayer, videoPlayer }, trackId) {
  const s = effective(trackId);
  const vol = Math.max(0, Math.min(1, s.volume));
  try {
    if (videoPlayer) {
      videoPlayer.playbackRate = s.speed;
      videoPlayer.preservesPitch = s.preservesPitch;
      videoPlayer.volume = vol;
    }
  } catch (e) {}
  try {
    if (audioPlayer) {
      if (s.preservesPitch && typeof audioPlayer.setPlaybackRate === 'function') {
        audioPlayer.setPlaybackRate(s.speed, 'medium');
      } else {
        audioPlayer.shouldCorrectPitch = s.preservesPitch;
        audioPlayer.playbackRate = s.speed;
      }
      audioPlayer.volume = vol;
    }
  } catch (e) {}
}
