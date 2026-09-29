import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "b24_artist_photos_v1";
const MISS = "none";
let cache = null;
const inflight = new Map();

async function loadCache() {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? JSON.parse(raw) : {};
  } catch {
    cache = {};
  }
  return cache;
}

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

// "Victony, Tempoe" / "A & B" / "A feat. B" -> use the first artist
export const primaryArtist = (name) =>
  String(name || "")
    .split(/,|&|\bfeat\.?\b|\bft\.?\b|\bx\b|\bwith\b/i)[0]
    .trim();

async function fetchPhoto(name) {
  try {
    const res = await fetch(
      `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=5`
    );
    const data = await res.json();
    const want = norm(name);
    const hit = (data.data || []).find((a) => norm(a.name) === want);
    if (!hit) return MISS;
    const url = hit.picture_big || hit.picture_medium;
    // Deezer's "no photo" placeholder has an empty hash in the path
    if (!url || url.includes("/artist//")) return MISS;
    return url;
  } catch {
    return null; // network error: don't cache, try again next time
  }
}

export async function getArtistPhoto(rawName) {
  const name = primaryArtist(rawName);
  if (!name) return null;
  const c = await loadCache();
  if (c[name]) return c[name] === MISS ? null : c[name];
  if (inflight.has(name)) return inflight.get(name);

  const p = (async () => {
    const url = await fetchPhoto(name);
    if (url !== null) {
      c[name] = url;
      try {
        await AsyncStorage.setItem(KEY, JSON.stringify(c));
      } catch {}
    }
    inflight.delete(name);
    return url === MISS ? null : url;
  })();
  inflight.set(name, p);
  return p;
}

// Splits "A, B & C feat. D" into ["A", "B", "C", "D"].
// Real band names that contain a comma or "&" are kept whole.
const KEEP_WHOLE = [
  "tyler, the creator",
  "earth, wind & fire",
  "crosby, stills & nash",
  "simon & garfunkel",
  "hall & oates",
  "florence + the machine",
  "mumford & sons",
  "years & years",
];

export function splitArtists(raw) {
  const str = String(raw || "").trim();
  if (!str) return [];
  if (KEEP_WHOLE.includes(str.toLowerCase())) return [str];
  const parts = str
    .split(/\s*(?:,|&|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b|\bwith\b|\bx\b)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  return [...new Set(parts)];
}
