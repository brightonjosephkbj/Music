import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "b24_widget_settings_v1";

export const DEFAULT_SETTINGS = {
  accent: "#C89BFF",
  bgColor: "#0B0A0F",
  bgStyle: "artwork", // "artwork" | "solid"
  dim: 0.82,
  radius: 20,
  textScale: 1,
  showArt: true,
  showProgress: true,
  showLyric: true,
  showSkip: true,
  customLayout: false,
  layouts: {},
};

let cache = null;

export async function loadWidgetSettings(fresh = false) {
  if (cache && !fresh) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch (e) {
    cache = { ...DEFAULT_SETTINGS };
  }
  return cache;
}

export async function saveWidgetSettings(next) {
  cache = { ...DEFAULT_SETTINGS, ...next };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn("Failed to save widget settings:", e);
  }
  return cache;
}
