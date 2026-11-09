import AsyncStorage from "@react-native-async-storage/async-storage";
import { File, Directory, Paths } from "expo-file-system";

const KEY = "b24_home_bg_v1";
export const DEFAULT_BG = { type: null, uri: null, dim: 0.6 };

let cache = null;
const listeners = new Set();
export const subscribeHomeBackground = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export async function loadHomeBackground(fresh = false) {
  if (cache && !fresh) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = { ...DEFAULT_BG, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    cache = { ...DEFAULT_BG };
  }
  return cache;
}

export async function saveHomeBackground(next) {
  cache = { ...DEFAULT_BG, ...next };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn("Failed to save home background:", e);
  }
  listeners.forEach((fn) => fn(cache));
  return cache;
}

// Copies a picked file into app storage so it outlives the gallery copy.
// Falls back to the original uri if the copy fails.
export async function importIntoApp(uri, ext) {
  try {
    const dir = new Directory(Paths.document, "home_bg");
    if (!dir.exists) dir.create();
    const dest = new File(dir, `bg_${Date.now()}.${ext}`);
    new File(uri).copy(dest);
    return dest.uri;
  } catch (e) {
    console.warn("Background copy failed, using original uri:", e);
    return uri;
  }
}

// Deletes an old imported background (only files inside home_bg).
export function discardImported(uri) {
  try {
    if (uri && uri.includes("home_bg")) new File(uri).delete();
  } catch {}
}
