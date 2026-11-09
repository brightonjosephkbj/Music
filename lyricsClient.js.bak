import AsyncStorage from "@react-native-async-storage/async-storage";
import { authedHeaders } from "./apiClient";

// Standalone copy of PlayerCard.js's lyrics fetch/cache logic, used by the
// home-screen widget. Kept separate (PlayerCard.js is untouched) so this
// never risks the already-working lyrics panel - but it uses the exact
// same AsyncStorage cache key format, so whichever of the two fetches a
// track's lyrics first, the other gets a free cache hit.

const API_BASE = "https://gateway-b0tx.onrender.com";

function lyricsCacheKey(artist, title) {
  const norm = (s) => String(s || "").trim().toLowerCase();
  return `b24music:lyrics:${norm(artist)}::${norm(title)}`;
}

async function getCachedLyrics(artist, title) {
  try {
    const raw = await AsyncStorage.getItem(lyricsCacheKey(artist, title));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function setCachedLyrics(artist, title, data) {
  try {
    await AsyncStorage.setItem(lyricsCacheKey(artist, title), JSON.stringify(data));
  } catch {}
}

// Always resolves - never throws. { found: false, hasSynced: false,
// lyrics: [] } on any failure or a genuine "not found" response.
export async function fetchLyrics(track) {
  if (!track?.artist || !track?.title) {
    return { found: false, hasSynced: false, lyrics: [] };
  }

  const cached = await getCachedLyrics(track.artist, track.title);
  if (cached) return cached;

  const params = new URLSearchParams({ artist: track.artist, title: track.title });
  if (track.duration) params.set("duration", String(Math.round(track.duration)));

  try {
    const headers = await authedHeaders();
    const res = await fetch(`${API_BASE}/api/apicache/api/music/lyrics?${params.toString()}`, { headers });
    const data = await res.json();
    if (data.found && Array.isArray(data.lyrics) && data.lyrics.length > 0) {
      setCachedLyrics(track.artist, track.title, data);
    }
    return data;
  } catch (e) {
    console.warn("[lyricsClient] fetch failed:", e?.message || e);
    return { found: false, hasSynced: false, lyrics: [] };
  }
}

// Index of the last lyric line whose timestamp has passed. -1 if none yet.
export function activeLyricIndex(lyrics, position) {
  if (!lyrics || lyrics.length === 0) return -1;
  let idx = -1;
  for (let i = 0; i < lyrics.length; i++) {
    if (lyrics[i].time <= position) idx = i;
    else break;
  }
  return idx;
}
