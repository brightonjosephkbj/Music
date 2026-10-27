import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { API_BASE, authedHeaders, gatewayFetch } from "./apiClient";
import { saveDownloadToSharedStorage } from "./mediaLibrarySave";
import { buildLibraryFilename } from "./libraryFileNaming";

const HAVE_KEY = "b24_sync_have";
let running = false;

async function getUserId() {
  const raw = await AsyncStorage.getItem("b24_auth");
  const u = raw ? JSON.parse(raw) : null;
  return u?.user_id || u?.id || null;
}

async function loadHave() {
  try {
    return JSON.parse((await AsyncStorage.getItem(HAVE_KEY)) || "[]");
  } catch {
    return [];
  }
}

// Share: queue songs for a recipient. They arrive on that user's next syncNow().
export async function requestSongs(toUserId, songs) {
  const res = await gatewayFetch("/api/sync/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: toUserId, songs }),
  });
  if (!res.ok) throw new Error(`sync request failed: HTTP ${res.status}`);
  return res.json();
}

// Pull: ask what is ready, download it, save it, report it as had.
export async function syncNow() {
  if (running) return { skipped: true };
  running = true;
  try {
    const uid = await getUserId();
    if (!uid) return { skipped: "not signed in" };
    const have = await loadHave();
    const res = await gatewayFetch("/api/sync/online", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: uid, have }),
    });
    if (!res.ok) throw new Error(`sync online failed: HTTP ${res.status}`);
    const { ready = [] } = await res.json();
    let got = 0;
    for (const s of ready) {
      try {
        const dest = FileSystem.cacheDirectory + buildLibraryFilename(s.title, s.artist, s.song_id, "mp3");
        const headers = await authedHeaders();
        const r = await FileSystem.downloadAsync(`${API_BASE}${s.file_url}`, dest, { headers });
        if (r.status !== 200) throw new Error(`download HTTP ${r.status}`);
        const asset = await saveDownloadToSharedStorage(r.uri);
        if (!asset) throw new Error("could not save to library");
        have.push(s.song_id);
        got++;
      } catch (e) {
        console.warn("[sync] song failed:", s.song_id, e?.message || e);
      }
    }
    await AsyncStorage.setItem(HAVE_KEY, JSON.stringify(have));
    return { ready: ready.length, got };
  } finally {
    running = false;
  }
}
