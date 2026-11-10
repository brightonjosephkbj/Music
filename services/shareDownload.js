// Gets a song that a friend shared: finds it, downloads it the same way the
// Search screen does, and saves it with the SENDER'S title/artist/artwork.
import * as FileSystem from "expo-file-system/legacy";
import { API_BASE, authedHeaders } from "./apiClient";
import { lightningExtract } from "./urlFetchClient";
import { buildLibraryFilename } from "../utils/libraryFileNaming";
import { saveDownloadToSharedStorage } from "../data/mediaLibrarySave";
import { getDownloads, addDownloadEntry } from "../data/libraryStorage";
import { fetchWithTimeout } from "../utils/fetchWithTimeout";

const LONG_SECS = 20 * 60;
const BAD_WORDS = /\b(cover|karaoke|reaction|slowed|sped up|8d|instrumental)\b/i;

const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
export const shareKey = (title, artist) => norm(title) + "|" + norm(artist);

// Is this shared song already in the library?
export async function findSharedInLibrary(meta) {
  const want = shareKey(meta.title, meta.artist);
  const all = await getDownloads();
  return all.find((d) => d.type === "audio" && shareKey(d.title, d.artist) === want) || null;
}

// Scores one search result against what the sender shared. Higher = better.
function score(item, meta) {
  let s = 0;
  const t = norm(item.title);
  const wantTitle = norm(meta.title);
  const words = wantTitle.split(" ").filter(Boolean);
  if (words.length) s += 4 * (words.filter((w) => t.includes(w)).length / words.length);
  const wantArtist = norm(meta.artist);
  if (wantArtist && norm(item.title + " " + item.uploader).includes(wantArtist)) s += 2;
  const dur = item.duration || 0;
  if (meta.duration && dur) {
    const diff = Math.abs(dur - meta.duration);
    if (diff <= 5) s += 4;
    else if (diff <= 15) s += 2;
    else if (diff <= 40) s += 1;
  }
  if (dur >= LONG_SECS) s -= 10; // mixes, movies, podcasts
  if (BAD_WORDS.test(item.title || "") && !BAD_WORDS.test(meta.title || "")) s -= 2;
  return s;
}

async function searchBestMatch(meta) {
  const q = (meta.title + " " + (meta.artist || "")).trim();
  const params = new URLSearchParams({ q });
  const headers = await authedHeaders();
  const res = await fetchWithTimeout(
    `${API_BASE}/api/downloads/remote/search?${params.toString()}`,
    { headers },
    20000,
    async (response) => {
      if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
      return response.json();
    }
  );
  const list = res && res.ok && Array.isArray(res.data) ? res.data : [];
  if (list.length === 0) return null;
  return list.map((it) => ({ it, s: score(it, meta) })).sort((a, b) => b.s - a.s)[0].it;
}

// meta = { title, artist, artwork_url, duration?, source_url? }
// opts.onStatus(stage, pct) -> stage is "searching" | "preparing" | "downloading"
// opts.hooks = optional useDownloads() object, so the app-wide download dot works
export async function getSharedSong(meta, opts = {}) {
  const { onStatus, hooks } = opts;
  const existing = await findSharedInLibrary(meta);
  if (existing) return { entry: existing, alreadyHad: true };

  const key = "share-" + shareKey(meta.title, meta.artist);
  let pageUrl = meta.source_url || null;
  let duration = meta.duration || 0;

  if (!pageUrl) {
    onStatus && onStatus("searching", 0);
    const best = await searchBestMatch(meta);
    if (!best) throw new Error("Could not find that song");
    pageUrl = best.url || `https://youtu.be/${best.id}`;
    duration = duration || best.duration || 0;
  }

  onStatus && onStatus("preparing", 0);
  const info = await lightningExtract(pageUrl, "audio", "medium");
  if (!info || !info.stream_url) throw new Error("No stream available for that song");

  const localUri =
    FileSystem.documentDirectory +
    buildLibraryFilename(meta.title, meta.artist, key, info.ext || "mp3");

  hooks && hooks.startDownload && hooks.startDownload(key, { title: meta.title });
  try {
    const dl = FileSystem.createDownloadResumable(info.stream_url, localUri, {}, (p) => {
      const pct = p.totalBytesExpectedToWrite > 0 ? p.totalBytesWritten / p.totalBytesExpectedToWrite : 0;
      onStatus && onStatus("downloading", pct);
      hooks && hooks.updateProgress && hooks.updateProgress(key, pct);
    });
    hooks && hooks.registerControls && hooks.registerControls(key, {
      pause: () => dl.pauseAsync().catch(() => {}),
      resume: () => dl.resumeAsync().catch(() => {}),
      cancel: () => dl.pauseAsync().catch(() => {}),
    });
    await dl.downloadAsync();
    if (hooks && hooks.isCancelled && hooks.isCancelled(key)) throw new Error("Cancelled");
    await saveDownloadToSharedStorage(localUri);

    const entry = {
      id: `share_${Date.now()}`,
      type: "audio",
      title: meta.title,          // the sender's metadata, not the search result's
      artist: meta.artist,
      artwork: meta.artwork_url,
      localUri,
      duration,
      source: "share",
      fromShare: true,
      source_url: pageUrl,
      addedAt: Date.now(),
    };
    await addDownloadEntry(entry);
    return { entry, alreadyHad: false };
  } finally {
    hooks && hooks.finishDownload && hooks.finishDownload(key);
  }
}
