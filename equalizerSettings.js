import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'obsidian_equalizer_settings';
const listeners = new Set();

export const EQUALIZER_PRESETS = {
  Normal: { enabled: true, levels: [0, 0, 0, 0, 0], bass: 0 },
  Rock: { enabled: true, levels: [500, 250, -100, 300, 500], bass: 350 },
  Pop: { enabled: true, levels: [-100, 200, 400, 200, -100], bass: 200 },
  Jazz: { enabled: true, levels: [300, 200, -100, 200, 350], bass: 150 },
  Classical: { enabled: true, levels: [350, 200, -100, 200, 350], bass: 0 },
};

function normalize(settings = {}) {
  const levels = Array.isArray(settings.levels) ? settings.levels : [0, 0, 0, 0, 0];

  return {
    enabled: Boolean(settings.enabled),
    levels: Array.from({ length: 5 }, (_, i) =>
      Math.max(-1500, Math.min(1500, Math.round(Number(levels[i]) || 0)))
    ),
    bass: Math.max(0, Math.min(1000, Math.round(Number(settings.bass) || 0))),
  };
}

function notify(settings) {
  listeners.forEach(listener => {
    try { listener(settings); } catch (error) {
      console.warn('Equalizer listener failed:', error);
    }
  });
}

export function subscribeEqualizerSettings(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function saveEqualizerSettings(settings) {
  const safe = normalize(settings);
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(safe));
  notify(safe);
  return safe;
}

export async function loadEqualizerSettings() {
  try {
    const stored = await SecureStore.getItemAsync(STORAGE_KEY);
    return normalize(stored ? JSON.parse(stored) : EQUALIZER_PRESETS.Normal);
  } catch (error) {
    console.warn('Obsidian equalizer settings could not be loaded:', error);
    return EQUALIZER_PRESETS.Normal;
  }
}

export async function applyEqualizerPreset(name) {
  const preset = EQUALIZER_PRESETS[name];
  if (!preset) throw new Error(`Unknown equalizer preset: ${name}`);
  return saveEqualizerSettings(preset);
}
