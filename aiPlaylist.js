import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { authedHeaders, API_BASE, uploadBase64Image } from "./apiClient";
import { buildTasteProfile } from "./listeningHistory";
import { createPlaylist, addTrackToPlaylist, getDownloads, saveDownloads } from "./libraryStorage";

// NOTE: previously had its own getDownloadsRaw/saveDownloadsRaw pair
// against the same "b24music:downloads" AsyncStorage key libraryStorage.js
// uses - two independent unsynchronized read-modify-write cycles on the
// same key raced each other. A manual download finishing around the same
// time as this running (background auto-gen or the "Generate AI Playlist"
// button) could silently clobber the other's entry - the file would exist
// on disk but vanish from the downloads list with no error. Now routed
// through libraryStorage.js's own functions so there's one path, not two.

// Same composite key SearchScreen.js uses everywhere - keeping it
// identical means an AI-added track and a manually-searched-and-saved
// version of the same track are recognized as the same track, not dupes.
function trackKey(t) {
  return `${t.provider}-${t.id}`;
}

// Junk that shows up in search results but isn't the actual song - beat
// tapes, karaoke instrumentals, "type beat" uploads, covers. Filtered out
// of candidate scoring below so they don't win just for matching keywords.
const JUNK_TITLE_PATTERN = /\b(type beat|instrumental|karaoke|made popular by|cover|no drums|no vocals)\b/i;

// Scores a search result against the artist the backend actually asked
// for. Exact/partial artist match wins; junk titles are disqualified
// outright; tracks with real metadata (duration, artwork) are preferred
// over bare uploads that tend to be low-quality matches.
function scoreCandidate(track, artistHint) {
  if (!track?.title) return -1;
  if (JUNK_TITLE_PATTERN.test(track.title)) return -1;

  let score = 0;
  if (artistHint && track.artist) {
    const a = track.artist.toLowerCase().trim();
    const hint = artistHint.toLowerCase().trim();
    if (a === hint) score += 3;
    else if (a.includes(hint) || hint.includes(a)) score += 2;
  }
  if (track.duration && track.duration > 60) score += 1;
  if (track.artwork) score += 1;
  return score;
}

// Resolves one AI-suggested search query to the single best real,
// playable track via the same endpoint SearchScreen.js uses. Scores every
// candidate instead of blindly taking the first result - the search API's
// top hit is often a "Type Beat" or generic genre upload that happens to
// match the query keywords, not the actual artist/song asked for.
export async function resolveQuery(query, artistHint) {
  const params = new URLSearchParams({ q: query });
  const res = await fetch(
    `${API_BASE}/api/apicache/api/music/search?${params.toString()}`,
    { headers: await authedHeaders() }
  );
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const cats = data?.categories || {};
  const all = Object.values(cats).flat();
  if (all.length === 0) return null;

  let best = null;
  let bestScore = -Infinity;
  for (const track of all) {
    const s = scoreCandidate(track, artistHint);
    if (s > bestScore) {
      bestScore = s;
      best = track;
    }
  }
  // Every candidate scored as junk (-1) - fall back to the raw top result
  // rather than returning nothing. A mediocre match beats no track at all.
  return bestScore > -1 ? best : all[0];
}

// Generates a playlist from on-device listening history + Groq, resolves
// each suggestion to a real track, and saves it exactly like a normal
// playlist - just streamed (download_url) instead of fully downloaded to
// disk, so it doesn't eat storage/bandwidth automatically in the background.
// Shared by generateAIPlaylist() (taste-profile based) and
// generateChatPlaylist() in aiChat.js (free-text request based) - both
// backend endpoints return the same {playlist_name, queries, art_base64}
// shape, so resolving queries to real tracks and saving them only needs
// to live in one place.
async function resolvePlaylistFromCatalog(data) {
  const { playlist_name, queries, art_base64 } = data;

  const resolved = [];
  const seenKeys = new Set();
  for (const { query, artist } of queries) {
    const track = await resolveQuery(query, artist);
    if (!track?.id || !track?.provider) continue;
    const key = trackKey(track);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    resolved.push({ track, key });
  }

  if (resolved.length === 0) {
    throw new Error("Couldn't find matching tracks for that request.");
  }

  let artworkUrl = null;
  if (art_base64) {
    try {
      artworkUrl = await uploadBase64Image(art_base64, "playlist_art");
    } catch (err) {
      console.warn("Playlist art upload failed, continuing without art:", err.message);
    }
  }

  const playlist = await createPlaylist(playlist_name || "Made for you", artworkUrl);
  const existing = await getDownloads();
  const existingKeys = new Set(existing.map((d) => d.id));
  const newEntries = [];

  for (const { track, key } of resolved) {
    if (!existingKeys.has(key)) {
      newEntries.push({
        id: key,
        type: "audio",
        title: track.title,
        artist: track.artist,
        artwork: track.artwork,
        download_url: track.download_url, // streamed, no localUri
        duration: track.duration || 0,
        source: track.provider,
        addedAt: Date.now(),
      });
    }
    await addTrackToPlaylist(playlist.id, key);
  }

  if (newEntries.length > 0) {
    await saveDownloads([...existing, ...newEntries]);
  }

  return playlist;
}

export async function generateAIPlaylist() {
  const tasteProfile = await buildTasteProfile();
  if (!tasteProfile) {
    throw new Error("Not enough listening history yet - play a few tracks first.");
  }

  const res = await fetch(`${API_BASE}/api/apicache/api/ai/playlist`, {
    method: "POST",
    headers: await authedHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ taste_profile: tasteProfile }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "AI playlist generation failed");
  }

  return resolvePlaylistFromAIData(data);
}


// ---------------------------------------------------------------------------
// AI playlists are downloaded by the server (Api-cache worker pool) so they get
// real, playable files instead of whatever the free catalogs happen to have.
// Falls back to the old catalog search if the server can't be reached.
// ---------------------------------------------------------------------------
const AI_POLL_MS = 8000;
const AI_POLL_MAX_MS = 15 * 60 * 1000;
const AI_FIRST_WAIT_MS = 0;
const aiSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function resolvePlaylistFromAIData(data) {
  try {
    return await resolvePlaylistViaServer(data);
  } catch (err) {
    console.warn("Server download of AI playlist failed, using catalog search:", err.message);
    Alert.alert("AI playlist", "Server download failed, using the old search instead.\n\n" + err.message);
    return resolvePlaylistFromCatalog(data);
  }
}

async function resolvePlaylistViaServer(data) {
  const { playlist_name, queries, art_base64 } = data;
  if (!queries || queries.length === 0) throw new Error("no queries");

  const res = await fetch(`${API_BASE}/api/downloads/playlist/ai-download`, {
    method: "POST",
    headers: await authedHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ queries, playlist_name }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(body.error || `server ${res.status}`);
  const serverPlaylistId = body.data.playlist_id;

  let artworkUrl = null;
  if (art_base64) {
    try {
      artworkUrl = await uploadBase64Image(art_base64, "playlist_art");
    } catch (err) {
      console.warn("Playlist art upload failed, continuing without art:", err.message);
    }
  }

  const playlist = await createPlaylist(playlist_name || "Made for you", artworkUrl);
  await rememberAILink(playlist.id, serverPlaylistId, artworkUrl);

  let firstBatchDone;
  const firstReady = new Promise((resolve) => { firstBatchDone = resolve; });
  fillPlaylistFromServer(serverPlaylistId, playlist.id, artworkUrl, firstBatchDone)
    .catch((err) => console.warn("AI playlist fill stopped:", err.message));

  await Promise.race([firstReady, aiSleep(AI_FIRST_WAIT_MS)]);
  return playlist;
}

// Songs live on the server behind a login, which the player cannot send, so
// each finished song is downloaded to the phone and played from the local file.
async function downloadServerFile(fileId) {
  const dest = FileSystem.documentDirectory + `ai-${fileId}.mp3`;
  const info = await FileSystem.getInfoAsync(dest);
  if (info.exists && info.size > 1000) return dest;
  const res = await FileSystem.downloadAsync(
    `${API_BASE}/api/downloads/files/${fileId}/view`,
    dest,
    { headers: await authedHeaders() }
  );
  if (res.status !== 200) {
    await FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => {});
    throw new Error(`download ${res.status}`);
  }
  return res.uri;
}

// Songs added by the earlier version have no local file; fetch them now.
async function repairServerSongs() {
  const list = await getDownloads();
  let changed = false;
  const next = [];
  for (const d of list) {
    if (d.source === "server" && !d.localUri) {
      const m = /^server-(\d+)$/.exec(d.id || "");
      if (m) {
        try {
          const uri = await downloadServerFile(m[1]);
          next.push({ ...d, localUri: uri, download_url: `${API_BASE}/api/downloads/files/${m[1]}/view` });
          changed = true;
          continue;
        } catch {}
      }
    }
    next.push(d);
  }
  if (changed) await saveDownloads(next);
}

const AI_LINKS_KEY = "ai_playlist_server_links";
const AI_LINK_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const activeFills = new Set();
const syncing = new Set();

async function getAILinks() {
  try {
    return JSON.parse((await AsyncStorage.getItem(AI_LINKS_KEY)) || "{}");
  } catch {
    return {};
  }
}

async function setAILinks(links) {
  try {
    await AsyncStorage.setItem(AI_LINKS_KEY, JSON.stringify(links));
  } catch {}
}

async function rememberAILink(playlistId, serverId, artwork) {
  const links = await getAILinks();
  links[playlistId] = { serverId, artwork: artwork || null, added: [], createdAt: Date.now() };
  await setAILinks(links);
}

// One pass: add every finished server song that is not in the playlist yet.
async function syncServerPlaylistOnce(playlistId) {
  let links = await getAILinks();
  const link = links[playlistId];
  if (!link) return { added: 0, finished: true };
  if (syncing.has(playlistId)) return { added: 0, finished: false };
  syncing.add(playlistId);
  try {
    const res = await fetch(
      `${API_BASE}/api/downloads/playlist/status?playlist_id=${encodeURIComponent(link.serverId)}`,
      { headers: await authedHeaders() }
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) throw new Error(body.error || `server ${res.status}`);
    const rows = body.data || [];

    let failed = 0;
    let lastDlError = "";
    const doneRows = rows.filter((r) => r.status === "done" && r.file_id && !link.added.includes(r.file_id));
    if (doneRows.length > 0) {
      const existing = await getDownloads();
      const existingKeys = new Set(existing.map((d) => d.id));
      const entries = [];
      for (const r of doneRows) {
        const key = `server-${r.file_id}`;
        let localUri = null;
        try {
          localUri = await downloadServerFile(r.file_id);
        } catch (err) {
          failed++;
          lastDlError = err.message;
          console.warn("AI playlist song download failed, will retry:", err.message);
          continue;
        }
        if (!existingKeys.has(key)) {
          entries.push({
            id: key,
            type: "audio",
            title: r.title,
            artist: r.artist,
            artwork: r.art_url || link.artwork || null,
            localUri,
            download_url: `${API_BASE}/api/downloads/files/${r.file_id}/view`,
            duration: 0,
            source: "server",
            addedAt: Date.now(),
          });
        }
        await addTrackToPlaylist(playlistId, key);
        link.added.push(r.file_id);
      }
      if (entries.length > 0) await saveDownloads([...existing, ...entries]);
    }

    const working = rows.some((r) => r.status === "pending" || r.status === "downloading");
    const stale = Date.now() - link.createdAt > AI_LINK_MAX_AGE_MS;
    const finished = rows.length === 0 || (!working && failed === 0) || stale;

    if (finished && link.added.length === 0 && rows.length > 0) {
      const errs = rows.filter((r) => r.status === "failed" && r.error).map((r) => r.error);
      Alert.alert("AI playlist", "No songs could be added.\n\n" +
        (lastDlError ? "Saving to the phone failed: " + lastDlError : (errs[0] || "Server downloads did not finish.")));
    }
    links = await getAILinks();
    if (finished) delete links[playlistId];
    else links[playlistId] = link;
    await setAILinks(links);
    return { added: doneRows.length - failed, finished };
  } finally {
    syncing.delete(playlistId);
  }
}

async function fillPlaylistFromServer(serverPlaylistId, playlistId, artwork, onFirstBatch) {
  activeFills.add(playlistId);
  const start = Date.now();
  try {
    while (Date.now() - start < AI_POLL_MAX_MS) {
      await aiSleep(AI_POLL_MS);
      let state;
      try {
        state = await syncServerPlaylistOnce(playlistId);
      } catch {
        continue;
      }
      if (state.added > 0) onFirstBatch();
      if (state.finished) break;
    }
  } finally {
    activeFills.delete(playlistId);
    onFirstBatch();
  }
}

// Call when the app opens or comes back to the foreground: adds every song
// that finished while the app was closed.
export async function resumeAIPlaylists() {
  try { await repairServerSongs(); } catch (err) { console.warn("Repair of AI songs failed:", err.message); }
  const links = await getAILinks();
  for (const playlistId of Object.keys(links)) {
    if (activeFills.has(playlistId)) continue;
    try {
      await syncServerPlaylistOnce(playlistId);
    } catch (err) {
      console.warn("Resume of AI playlist failed:", err.message);
    }
  }
}
