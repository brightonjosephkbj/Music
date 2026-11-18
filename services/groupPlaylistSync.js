// Keeps a local copy of each shared playlist (tracks + server version) so the list
// opens offline and only changes are fetched from the server.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCurrentUser, getGroupPlaylistSync } from "./shareClient";

const keyFor = (uid, pid) => `gpl_sync_v1:${uid}:${pid}`;

async function readSaved(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s && Array.isArray(s.tracks) && typeof s.version === "number") return s;
  } catch (e) {}
  return null;
}

export async function syncGroupPlaylistTracks(playlistId) {
  const user = await getCurrentUser();
  const uid = user?.id;
  if (!uid) throw new Error("not signed in");
  const key = keyFor(uid, playlistId);
  const saved = await readSaved(key);
  try {
    let data = await getGroupPlaylistSync(playlistId, uid, saved ? saved.version : 0);
    let base = saved ? saved.tracks : [];
    if (saved && data.version < saved.version) {
      // server was restored/reset: start over
      data = await getGroupPlaylistSync(playlistId, uid, 0);
      base = [];
    }
    let tracks;
    if (data.full) {
      tracks = data.tracks;
    } else {
      const gone = new Set(data.removed);
      const have = new Set(base.map((t) => t.id));
      tracks = base
        .filter((t) => !gone.has(t.id))
        .concat(data.tracks.filter((t) => !have.has(t.id)));
    }
    await AsyncStorage.setItem(key, JSON.stringify({ version: data.version, tracks }));
    return tracks;
  } catch (e) {
    if (e && e.message === "not_a_member") {
      await AsyncStorage.removeItem(key).catch(() => {});
      throw e;
    }
    if (saved) return saved.tracks; // offline or server down: show what we have
    throw e;
  }
}
