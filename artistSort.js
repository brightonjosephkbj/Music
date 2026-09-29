import AsyncStorage from "@react-native-async-storage/async-storage";
import { getListeningHistory } from "./listeningHistory";

const KEY = "b24_artist_sort_v1";
const keyOf = (t) => `${t.provider || ""}-${t.id}`;

export async function loadArtistSort() {
  try {
    return (await AsyncStorage.getItem(KEY)) || "recent";
  } catch {
    return "recent";
  }
}

export function saveArtistSort(mode) {
  AsyncStorage.setItem(KEY, mode).catch(() => {});
}

export async function loadPlayCounts() {
  const counts = {};
  try {
    const history = await getListeningHistory();
    (history || []).forEach((h) => {
      const k = keyOf(h);
      counts[k] = (counts[k] || 0) + 1;
    });
  } catch {}
  return counts;
}

const addedAt = (t) => {
  const v = t.addedAt || t.createdAt || t.downloadedAt || t.date || t.modificationTime || 0;
  return typeof v === "number" ? v : Date.parse(v) || 0;
};

// modes: "recent" | "title" | "played"
export function sortTracks(tracks, mode, counts = {}) {
  const items = tracks.map((t, i) => ({ t, i }));
  if (mode === "artist") {
    items.sort(
      (x, y) =>
        (x.t.artist || "").localeCompare(y.t.artist || "", undefined, { sensitivity: "base" }) ||
        (x.t.title || "").localeCompare(y.t.title || "", undefined, { sensitivity: "base" }) ||
        x.i - y.i
    );
  } else if (mode === "duration") {
    items.sort((x, y) => (Number(y.t.duration) || 0) - (Number(x.t.duration) || 0) || x.i - y.i);
  } else if (mode === "title") {
    items.sort(
      (a, b) =>
        (a.t.title || "").localeCompare(b.t.title || "", undefined, { sensitivity: "base" }) ||
        a.i - b.i
    );
  } else if (mode === "played") {
    items.sort(
      (a, b) => (counts[keyOf(b.t)] || 0) - (counts[keyOf(a.t)] || 0) || b.i - a.i
    );
  } else {
    items.sort((a, b) => addedAt(b.t) - addedAt(a.t) || b.i - a.i);
  }
  return items.map((x) => x.t);
}

const ALL_KEY = "b24_allsongs_sort_v1";
export async function loadAllSongsSort() {
  try {
    return (await AsyncStorage.getItem(ALL_KEY)) || "recent";
  } catch {
    return "recent";
  }
}
export function saveAllSongsSort(mode) {
  AsyncStorage.setItem(ALL_KEY, mode).catch(() => {});
}
