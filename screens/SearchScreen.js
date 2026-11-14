import { friendlyError } from "../utils/friendlyError";
import React, { useState, useEffect, useRef } from "react";
import { Animated as RNAnimated } from "react-native";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  Alert,
} from "react-native";
import { BlurView } from "expo-blur";
import HomeBackground from "../components/home/HomeBackground";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { finalizeDownload } from "../services/mediaConvert";
import { getDownloads, saveDownloads, addDownloadEntry } from "../data/libraryStorage";
import { useDownloads } from "../context/DownloadsContext";
import useSuggestions from "../hooks/useSuggestions";

import { authedHeaders } from "../services/apiClient";
import { lightningExtract } from "../services/urlFetchClient";
import { buildLibraryFilename } from "../utils/libraryFileNaming";
import { saveDownloadToSharedStorage } from "../data/mediaLibrarySave";
import { reportScrollY } from "../utils/shellScroll";
import { fetchWithTimeout } from "../utils/fetchWithTimeout";

const API_BASE = "https://gateway-b0tx.onrender.com";
const SEARCH_TIMEOUT_MS = 20000;
const JET_BLACK = "#1D1D1D";
const ORCHID = "#E5BDDF";
const GLASS_BG = "rgba(20,20,25,0.55)";
const GLASS_BORDER = "rgba(255,255,255,0.18)";
const GLASS_BG_FOCUS = "rgba(229,189,223,0.1)";
const TEXT_PRIMARY = "#FFFFFF";
const TEXT_SECONDARY = "rgba(255,255,255,0.6)";
const ACCENT = "#FF6B6B"; // coral, matches nav + player
const ACCENT_ON = "#FFFFFF"; // text/icon color when sitting on an ACCENT fill

const CATEGORY_LABELS = {
  music: "Music",
  podcast: "Podcasts",
  lecture: "Lectures",
  audiobook: "Audiobooks",
};
function categoryLabel(key) {
  return CATEGORY_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1);
}

function formatDuration(sec) {
  if (!sec && sec !== 0) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function safeFilename(title, ext) {
  const clean = (title || "download").replace(/[^A-Za-z0-9 _-]/g, "").trim() || "download";
  return `${clean}.${ext}`;
}

function trackKey(t) {
  return `${t.provider}-${t.id}`;
}

// The formats/qualities actually offered by the backend for a YouTube
// result: /api/fetch/lightning_stream and /api/fetch/download both accept
// mode ("audio"|"video") and quality - these three cover what's real,
// not invented options the backend can't actually deliver.
const QUALITY_OPTIONS = [
  { key: "audio_high", mode: "audio", quality: "high", ext: "mp3", label: "Audio - High Quality (MP3)" },
  { key: "audio_medium", mode: "audio", quality: "medium", ext: "mp3", label: "Audio - Medium Quality (MP3)" },
  { key: "video_720", mode: "video", quality: "medium", ext: "mp4", label: "Video - 720p (MP4)" },
];

// onTrackPress(track) - plays a search result, same track shape everywhere else uses.
const LONG_SECS = 20 * 60;
const MOVIE_WORDS = /\b(full movie|movie|film|episode|season|documentary|trailer)\b/i;
const MIX_WORDS = /\b(mix|mixtape|megamix|non[- ]?stop|playlist|dj set|live set|jukebox|compilation|hour|hours|hrs|full album|podcast|radio|lofi|lo-fi|best of|hits)\b/i;

// "short" (a song), "mix" (long but music), or "movie" (long video).
function classifyVideo(item) {
  const dur = (item && item.duration) || 0;
  if (dur < LONG_SECS) return "short";
  const title = (item && item.title) || "";
  if (MOVIE_WORDS.test(title)) return "movie";
  if (MIX_WORDS.test(title)) return "mix";
  return "movie";
}

const RECENTS_KEY = "b24_recent_searches_v1";
const MOODS = [
  { label: "Afrobeats", q: "afrobeats", icon: "flame", fg: "#FFB86B", bg: "rgba(255,150,60,0.18)", border: "rgba(255,170,90,0.35)" },
  { label: "Chill", q: "chill vibes", icon: "moon", fg: "#9CB8FF", bg: "rgba(90,130,255,0.18)", border: "rgba(120,160,255,0.35)" },
  { label: "Workout", q: "workout mix", icon: "barbell", fg: "#FF8A8A", bg: "rgba(255,90,90,0.18)", border: "rgba(255,120,120,0.35)" },
  { label: "Love songs", q: "love songs", icon: "heart", fg: "#FF9AD5", bg: "rgba(255,90,180,0.18)", border: "rgba(255,130,200,0.35)" },
  { label: "Throwbacks", q: "throwback hits", icon: "sparkles", fg: "#C89BFF", bg: "rgba(160,100,255,0.18)", border: "rgba(190,140,255,0.35)" },
  { label: "Party", q: "party mix", icon: "musical-notes", fg: "#8CE0A0", bg: "rgba(80,220,130,0.16)", border: "rgba(120,230,160,0.35)" },
];

// One-tap download uses this option (medium MP3 = smaller, faster on mobile data)
const QUICK_DL = { key: "audio_medium", mode: "audio", quality: "medium", ext: "mp3", label: "Audio - Medium Quality (MP3)" };

const dlStyles = StyleSheet.create({
  btn: { width: 40, height: 40, borderRadius: 20, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center", marginLeft: 10 },
  btnBusy: { backgroundColor: "transparent", borderWidth: 2, borderColor: ACCENT },
  btnDone: { backgroundColor: "#2E9E5B" },
  btnPct: { color: TEXT_PRIMARY, fontSize: 11, fontWeight: "800" },
  topLabel: { color: ORCHID, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  card: { backgroundColor: GLASS_BG, borderWidth: 1, borderColor: GLASS_BORDER, borderRadius: 16, padding: 12, marginBottom: 10, marginHorizontal: 4 },
  cardTop: { flexDirection: "row", justifyContent: "space-between" },
  cardTitle: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: "700" },
  cardPct: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: "700" },
  bar: { height: 5, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 3, marginVertical: 9, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: ACCENT, borderRadius: 3 },
  cardSub: { color: TEXT_SECONDARY, fontSize: 11.5 },
});

// The card that slides out under a row while it downloads
function DlCard({ progress, preparing }) {
  const a = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    RNAnimated.timing(a, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [a]);
  const pct = Math.round(progress * 100);
  return (
    <RNAnimated.View style={[dlStyles.card, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }]}>
      <View style={dlStyles.cardTop}>
        <Text style={dlStyles.cardTitle}>{preparing ? "Preparing…" : "Downloading"}</Text>
        <Text style={dlStyles.cardPct}>{preparing ? "" : pct + "%"}</Text>
      </View>
      <View style={dlStyles.bar}><View style={[dlStyles.barFill, { width: pct + "%" }]} /></View>
      <Text style={dlStyles.cardSub}>MP3 · saves to your library</Text>
    </RNAnimated.View>
  );
}

const chipStyles = StyleSheet.create({
  row: { marginTop: 4, marginBottom: 8 },
  rowContent: { paddingRight: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, marginRight: 8,
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  chipOn: { backgroundColor: ORCHID, borderColor: ORCHID },
  chipText: { color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: "700" },
  chipTextOn: { color: "#fff" },
  empty: { color: "rgba(255,255,255,0.5)", fontSize: 13, paddingVertical: 14, textAlign: "center" },
});

export default function SearchScreen({ onTrackPress }) {
  const { startDownload, updateProgress, finishDownload, registerControls, isCancelled } = useDownloads();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [categories, setCategories] = useState({}); // { music: [...], podcast: [...], ... }
  const [searched, setSearched] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const suggestions = useSuggestions(showSuggest ? query : "");

  const [downloadingKey, setDownloadingKey] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedIds, setDownloadedIds] = useState(() => new Set());

  const [ytResults, setYtResults] = useState([]);
  const [ytFilter, setYtFilter] = useState("songs");
  const searchRequestId = useRef(0);
  const searchAbortController = useRef(null);
  const [resolvingIds, setResolvingIds] = useState(() => new Set());

  // Quality-picker sheet - opened for a YouTube result, closed by tapping
  // anywhere on the blurred backdrop (including the sheet's own blank space).
  const [sheetItem, setSheetItem] = useState(null);
  const sheetVisible = !!sheetItem;
  const [showAllFormats, setShowAllFormats] = useState(false);
  const sheetKind = sheetItem ? classifyVideo(sheetItem) : "short";
  const sheetOptions = (() => {
    const video = QUALITY_OPTIONS.filter((o) => o.mode === "video");
    const audio = QUALITY_OPTIONS.filter((o) => o.mode === "audio");
    if (sheetKind === "movie") return showAllFormats ? [...video, ...audio] : video;
    return [...audio, ...video];
  })();

  // Multi-select for batch download: a set of selected YouTube result ids,
  // a separate small sheet to pick one format/quality applied to the whole
  // batch, and simple running-count progress while it works through them
  // one at a time (same one-at-a-time pattern as everywhere else here).
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [batchSheetOpen, setBatchSheetOpen] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [recents, setRecents] = useState([]);
  useEffect(() => () => {
    searchRequestId.current += 1;
    searchAbortController.current?.abort();
    searchAbortController.current = null;
  }, []);
  useEffect(() => {
    AsyncStorage.getItem(RECENTS_KEY)
      .then((raw) => { if (raw) setRecents(JSON.parse(raw)); })
      .catch(() => {});
  }, []);
  const saveRecent = (q) => {
    const next = [q, ...recents.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8);
    setRecents(next);
    AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next)).catch(() => {});
  };
  const clearRecents = () => {
    setRecents([]);
    AsyncStorage.removeItem(RECENTS_KEY).catch(() => {});
  };

  const runSearch = async (override) => {
    const q = (typeof override === "string" ? override : query).trim();
    setShowSuggest(false);
    if (typeof override === "string") setQuery(override);
    if (!q) {
      searchRequestId.current += 1;
      searchAbortController.current?.abort();
      searchAbortController.current = null;
      setLoading(false);
      return;
    }
    const requestId = ++searchRequestId.current;
    searchAbortController.current?.abort();
    const requestController = new AbortController();
    searchAbortController.current = requestController;
    saveRecent(q);
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const params = new URLSearchParams({ q });
      const headers = await authedHeaders();
      if (requestId !== searchRequestId.current) return;

      const [libraryRes, ytRes] = await Promise.allSettled([
        fetchWithTimeout(
          `${API_BASE}/api/apicache/api/music/search?${params.toString()}`,
          { headers, signal: requestController.signal },
          SEARCH_TIMEOUT_MS,
          async (response) => {
            if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
            return response.json();
          }
        ),
        fetchWithTimeout(
          `${API_BASE}/api/downloads/remote/search?${params.toString()}`,
          { headers, signal: requestController.signal },
          SEARCH_TIMEOUT_MS,
          async (response) => {
            if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
            return response.json();
          }
        ),
      ]);
      if (requestId !== searchRequestId.current) return;

      let catList = [];
      const failures = [];
      if (
        libraryRes.status === "fulfilled" &&
        libraryRes.value?.categories &&
        typeof libraryRes.value.categories === "object" &&
        !Array.isArray(libraryRes.value.categories)
      ) {
        const data = libraryRes.value;
        const cats = data.categories || {};
        setCategories(cats);
        catList = Object.values(cats).flat();
      } else {
        setCategories({});
        failures.push(libraryRes.status === "rejected" ? libraryRes.reason : new Error("Music search returned an invalid response"));
      }

      let ytList = [];
      if (ytRes.status === "fulfilled" && ytRes.value?.ok && Array.isArray(ytRes.value.data)) {
        ytList = ytRes.value.data;
        setYtResults(ytList);
      } else {
        setYtResults([]);
        failures.push(ytRes.status === "rejected" ? ytRes.reason : new Error(ytRes.value?.error || "Remote search returned an invalid response"));
      }

      if (failures.length === 2) {
        setError(friendlyError(failures[0], "Search failed"));
      } else if (failures.length === 1) {
        setError("Some search sources are unavailable. Showing results from the sources that responded.");
      }
      syncDownloadedIds(catList, ytList);
    } catch (err) {
      if (requestId === searchRequestId.current) {
        setError(friendlyError(err, "Search failed"));
        setCategories({});
        setYtResults([]);
      }
    } finally {
      if (requestId === searchRequestId.current) {
        searchAbortController.current = null;
        setLoading(false);
      }
    }
  };

  // Checks which of the current results already exist in the persisted
  // downloads list (not just this session's downloadedIds), so "Saved"
  // shows correctly even for tracks downloaded in a previous session.
  const syncDownloadedIds = async (catItems, ytItems) => {
    try {
      const existing = await getDownloads();
      const existingIds = new Set(existing.map((d) => d.id));
      const next = new Set();
      catItems.forEach((t) => {
        const k = trackKey(t);
        if (existingIds.has(k)) next.add(k);
      });
      ytItems.forEach((yt) => {
        QUALITY_OPTIONS.forEach((opt) => {
          const k = `youtube-${yt.id}-${opt.key}`;
          if (existingIds.has(k)) next.add(k);
        });
      });
      if (next.size > 0) {
        setDownloadedIds((prev) => new Set([...prev, ...next]));
      }
    } catch {
      // Non-critical - worst case the button just re-shows "Download"
    }
  };

  const downloadTrack = async (track) => {
    const key = trackKey(track);
    if (downloadingKey) return;
    setDownloadingKey(key);
    setDownloadProgress(0);
    startDownload(key, { title: track.title });
    try {
      const localUri = FileSystem.documentDirectory + buildLibraryFilename(track.title, track.artist, key, "mp3");

      const downloadResumable = FileSystem.createDownloadResumable(
        track.download_url,
        localUri,
        {},
        (progressEvent) => {
          const pct =
            progressEvent.totalBytesExpectedToWrite > 0
              ? progressEvent.totalBytesWritten / progressEvent.totalBytesExpectedToWrite
              : 0;
          setDownloadProgress(pct);
          updateProgress(key, pct);
        }
      );
      registerControls(key, {
        pause: () => downloadResumable.pauseAsync().catch(() => {}),
        resume: () => downloadResumable.resumeAsync().catch(() => {}),
        cancel: async () => {
          try { await downloadResumable.pauseAsync(); } catch {}
          try { await FileSystem.deleteAsync(localUri, { idempotent: true }); } catch {}
        },
      });
      await downloadResumable.downloadAsync();
      if (isCancelled(key)) {
        try { await FileSystem.deleteAsync(localUri, { idempotent: true }); } catch {}
        return;
      }
      await saveDownloadToSharedStorage(localUri);

      const entry = {
        id: key,
        type: "audio",
        title: track.title,
        artist: track.artist,
        artwork: track.artwork,
        localUri,
        duration: track.duration || 0,
        source: track.provider,
        source_url: track.download_url || null,
        fromSearch: true,
        addedAt: Date.now(),
      };
      const existing = await getDownloads();
      await saveDownloads([...existing, entry]);
      setDownloadedIds((prev) => new Set(prev).add(key));
    } catch (err) {
      if (!isCancelled(key)) setError(friendlyError(err, "Download failed"));
    } finally {
      setDownloadingKey(null);
      if (!isCancelled(key)) finishDownload(key);
    }
  };

  const openQualitySheet = (ytItem) => { setShowAllFormats(false); setSheetItem(ytItem); };
  const closeQualitySheet = () => setSheetItem(null);

  // Resolves the tapped YouTube result at a specific format/quality (chosen
  // in the sheet) and either plays it or downloads it.
  const resolveAtQuality = async (ytItem, option) => {
    const id = `${ytItem.id}-${option.key}`;
    setResolvingIds((prev) => new Set(prev).add(id));
    try {
      // Same call PasteUrlScreen uses for its ytdlp path - lightningExtract
      // already unwraps the backend's { ok, data } envelope correctly,
      // unlike the raw fetch this used to do here.
      return await lightningExtract(ytItem.url, option.mode, option.quality);
    } catch (err) {
      setError(friendlyError(err, "Could not load that track"));
      return null;
    } finally {
      setResolvingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleSheetPlay = async (option, itemOverride) => {
    const ytItem = itemOverride || sheetItem;
    closeQualitySheet();
    if (!ytItem) return;
    const streamInfo = await resolveAtQuality(ytItem, option);
    if (!streamInfo) return;

    const track = {
      provider: "youtube",
      id: ytItem.id,
      type: option.mode === "video" ? "video" : "audio",
      title: streamInfo.title || ytItem.title,
      artist: ytItem.uploader,
      artwork: ytItem.thumbnail,
      duration: ytItem.duration,
      downloadable: true,
      download_url: streamInfo.stream_url,
      stream_url: streamInfo.stream_url,
    };
    onTrackPress && onTrackPress(track);
  };

  const handleSheetDownload = async (option, itemOverride) => {
    const ytItem = itemOverride || sheetItem;
    closeQualitySheet();
    if (!ytItem) return;
    const key = `youtube-${ytItem.id}-${option.key}`;
    if (downloadingKey) return;

    const streamInfo = await resolveAtQuality(ytItem, option);
    if (!streamInfo) return;
    if (!streamInfo.stream_url) {
      setError(`No stream URL returned for "${ytItem.title}" (${option.label})`);
      return;
    }

    setDownloadingKey(key);
    setDownloadProgress(0);
    startDownload(key, { title: streamInfo.title || ytItem.title });
    try {
      const localUri = FileSystem.documentDirectory + buildLibraryFilename(streamInfo.title || ytItem.title, ytItem.uploader, key, streamInfo.ext || option.ext);

      const downloadResumable = FileSystem.createDownloadResumable(
        streamInfo.stream_url,
        localUri,
        {},
        (progressEvent) => {
          const pct =
            progressEvent.totalBytesExpectedToWrite > 0
              ? progressEvent.totalBytesWritten / progressEvent.totalBytesExpectedToWrite
              : 0;
          setDownloadProgress(pct);
          updateProgress(key, pct);
        }
      );
      registerControls(key, {
        pause: () => downloadResumable.pauseAsync().catch(() => {}),
        resume: () => downloadResumable.resumeAsync().catch(() => {}),
        cancel: async () => {
          try { await downloadResumable.pauseAsync(); } catch {}
          try { await FileSystem.deleteAsync(localUri, { idempotent: true }); } catch {}
        },
      });
      await downloadResumable.downloadAsync();
      if (isCancelled(key)) {
        try { await FileSystem.deleteAsync(localUri, { idempotent: true }); } catch {}
        return;
      }
      await finalizeDownload(localUri, option.mode);
      await saveDownloadToSharedStorage(localUri);

      const entry = {
        id: `youtube_${Date.now()}`,
        type: option.mode === "video" ? "video" : "audio",
        title: streamInfo.title || ytItem.title,
        artist: ytItem.uploader,
        artwork: ytItem.thumbnail,
        localUri,
        duration: ytItem.duration || 0,
        source: "youtube",
        fromSearch: true,
        addedAt: Date.now(),
        // Durable link for re-extraction (e.g. group playlists on other
        // devices) - NOT streamInfo.stream_url, which is a short-lived
        // relay link tied to this one /extract job and will die later.
        source_url: ytItem.url || `https://youtu.be/${ytItem.id}`,
      };
      await addDownloadEntry(entry);
      setDownloadedIds((prev) => new Set(prev).add(key));
    } catch (err) {
      if (!isCancelled(key)) setError(friendlyError(err, "Download failed"));
    } finally {
      setDownloadingKey(null);
      if (!isCancelled(key)) finishDownload(key);
    }
  };

  const openBatchQualitySheet = () => setBatchSheetOpen(true);
  const closeBatchQualitySheet = () => setBatchSheetOpen(false);

  // Runs through every selected YouTube result at one chosen quality,
  // one at a time - resolves, downloads, saves, then moves to the next.
  // A single failed track doesn't stop the rest of the batch.
  const handleBatchDownload = async (option) => {
    closeBatchQualitySheet();
    const items = ytResults.filter((yt) => selectedIds.has(yt.id));
    if (items.length === 0) return;

    setBatchRunning(true);
    setBatchProgress({ current: 0, total: items.length });

    for (let i = 0; i < items.length; i++) {
      const ytItem = items[i];
      setBatchProgress({ current: i + 1, total: items.length });

      const key = `youtube-${ytItem.id}-${option.key}`;
      if (downloadedIds.has(key)) continue;

      const streamInfo = await resolveAtQuality(ytItem, option);
      if (!streamInfo) continue;

      setDownloadingKey(key);
      setDownloadProgress(0);

      try {
        const localUri = FileSystem.documentDirectory + buildLibraryFilename(streamInfo.title || ytItem.title, ytItem.uploader, key, streamInfo.ext || option.ext);
        const downloadResumable = FileSystem.createDownloadResumable(
          streamInfo.stream_url,
          localUri,
          {},
          (progressEvent) => {
            const pct =
              progressEvent.totalBytesExpectedToWrite > 0
                ? progressEvent.totalBytesWritten / progressEvent.totalBytesExpectedToWrite
                : 0;
            setDownloadProgress(pct);
          }
        );
        await downloadResumable.downloadAsync();
        await finalizeDownload(localUri, option.mode);
        await saveDownloadToSharedStorage(localUri);

        const entry = {
          id: key,
          type: option.mode === "video" ? "video" : "audio",
          title: streamInfo.title || ytItem.title,
          artist: ytItem.uploader,
          artwork: ytItem.thumbnail,
          localUri,
          duration: ytItem.duration || 0,
          source: "youtube",
          source_url: ytItem.url || `https://youtu.be/${ytItem.id}`,
          fromSearch: true,
          addedAt: Date.now(),
        };
        const existing = await getDownloads();
        await saveDownloads([...existing, entry]);
        setDownloadedIds((prev) => new Set(prev).add(key));
      } catch (err) {
        console.warn(`Batch download failed for "${ytItem.title}":`, err);
      } finally {
        setDownloadingKey(null);
      }
    }

    setBatchRunning(false);
    setSelectedIds(new Set());
  };

  const renderYoutubeRow = (ytItem, isTop) => {
    const isSelected = selectedIds.has(ytItem.id);
    const selecting = selectedIds.size > 0;
    const prefix = `youtube-${ytItem.id}-`;
    const isDownloading = !!downloadingKey && downloadingKey.startsWith(prefix);
    const isDownloaded = [...downloadedIds].some((k) => k.startsWith(prefix));
    const isResolving = resolvingIds.has(`${ytItem.id}-${QUICK_DL.key}`);
    const kind = classifyVideo(ytItem);
    const playDownloaded = () =>
      onTrackPress &&
      onTrackPress({
        provider: "youtube",
        id: ytItem.id,
        type: "audio",
        title: ytItem.title,
        artist: ytItem.uploader,
        artwork: ytItem.thumbnail,
        duration: ytItem.duration,
      });

    return (
      <View key={`youtube-${ytItem.id}`}>
        {isTop && <Text style={dlStyles.topLabel}>Top result</Text>}
        <View style={styles.glassCard}>
          {selecting && (
            <TouchableOpacity
              onPress={() => toggleSelected(ytItem.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={[styles.checkbox, isSelected && styles.checkboxChecked]}
            >
              {isSelected && <Text style={styles.checkboxMark}>✓</Text>}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.rowBody}
            onPress={() => (selecting ? toggleSelected(ytItem.id) : openQualitySheet(ytItem))}
            onLongPress={() => toggleSelected(ytItem.id)}
            delayLongPress={300}
          >
            <Image
              source={ytItem.thumbnail ? { uri: ytItem.thumbnail } : undefined}
              style={[styles.rowArt, isTop && { width: 72, height: 72, borderRadius: 14 }]}
            />
            <View style={styles.rowTextWrap}>
              <Text numberOfLines={2} style={[styles.rowTitle, isTop && { fontSize: 16 }]}>{ytItem.title}</Text>
              <View style={styles.rowMetaRow}>
                <Text numberOfLines={1} style={[styles.rowArtist, { flexShrink: 1 }]}>
                  {ytItem.uploader} · {formatDuration(ytItem.duration)}
                </Text>
                {kind === "movie" && <Text style={styles.providerBadge}>MOVIE</Text>}
                {kind === "mix" && <Text style={styles.providerBadge}>MIX</Text>}
              </View>
            </View>
          </TouchableOpacity>

          {isDownloading || isResolving ? (
            <View style={[dlStyles.btn, dlStyles.btnBusy]}>
              {isDownloading ? (
                <Text style={dlStyles.btnPct}>{Math.round(downloadProgress * 100)}</Text>
              ) : (
                <ActivityIndicator color={ACCENT} size="small" />
              )}
            </View>
          ) : isDownloaded ? (
            <TouchableOpacity onPress={playDownloaded} style={[dlStyles.btn, dlStyles.btnDone]}>
              <Ionicons name="checkmark" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => handleSheetDownload(QUICK_DL, ytItem)}
              disabled={!!downloadingKey}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[dlStyles.btn, !!downloadingKey && { opacity: 0.4 }]}
            >
              <Ionicons name="arrow-down" size={20} color={ACCENT_ON} />
            </TouchableOpacity>
          )}
        </View>
        {(isResolving || isDownloading) && (
          <DlCard progress={isDownloading ? downloadProgress : 0} preparing={!isDownloading} />
        )}
      </View>
    );
  };

  const renderRow = (track) => {
    const key = trackKey(track);
    const isDownloading = downloadingKey === key;
    const isDownloaded = downloadedIds.has(key);

    return (
      <TouchableOpacity
        key={key}
        style={styles.glassCard}
        onPress={() => onTrackPress && onTrackPress(track)}
      >
        <Image source={track.artwork ? { uri: track.artwork } : undefined} style={styles.rowArt} />
        <View style={styles.rowTextWrap}>
          <Text numberOfLines={1} style={styles.rowTitle}>{track.title}</Text>
          <View style={styles.rowMetaRow}>
            <Text numberOfLines={1} style={styles.rowArtist}>{track.artist}</Text>
            <Text style={styles.providerBadge}>{(track.provider || "").toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.rowDuration}>{formatDuration(track.duration)}</Text>

        {track.downloadable && (
          isDownloading ? (
            <View style={styles.downloadWrap}>
              <ActivityIndicator color={ORCHID} size="small" />
              <Text style={styles.downloadPct}>{Math.round(downloadProgress * 100)}%</Text>
            </View>
          ) : isDownloaded ? (
            <Text style={styles.downloadedGlyph}>Saved</Text>
          ) : (
            <TouchableOpacity
              onPress={() => downloadTrack(track)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.downloadTouch}
            >
              <Text style={styles.downloadGlyph}>Download</Text>
            </TouchableOpacity>
          )
        )}
      </TouchableOpacity>
    );
  };

  const categoryEntries = Object.entries(categories).filter(([, items]) => items.length > 0);

  return (
    <View style={styles.root}>
      <HomeBackground />
      
      
      <ScrollView onScroll={(e) => reportScrollY(e.nativeEvent.contentOffset.y)} scrollEventThrottle={32} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Search</Text>

        <View style={styles.inputRow}>
          <TextInput
            value={query}
            onChangeText={(t) => { setQuery(t); setShowSuggest(true); }}
            onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
            onSubmitEditing={runSearch}
            placeholder="Search..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            returnKeyType="search"
            style={styles.input}
          />
          <TouchableOpacity onPress={runSearch} style={styles.searchButton}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>

        {showSuggest && suggestions.length > 0 && (
            <View style={styles.suggestWrap}>
              <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
              {suggestions.slice(0, 6).map((sg, i) => {
                const q = query.trim();
                const match = q && sg.toLowerCase().startsWith(q.toLowerCase());
                return (
                  <View key={sg} style={[styles.suggestRow2, i === 0 && { borderTopWidth: 0 }]}>
                    <TouchableOpacity style={styles.suggestMain} onPress={() => runSearch(sg)}>
                      <Ionicons name="search" size={16} color={TEXT_SECONDARY} />
                      <Text numberOfLines={1} style={styles.suggestText2}>
                        {match ? (
                          <>
                            <Text style={styles.suggestTyped}>{sg.slice(0, q.length)}</Text>
                            {sg.slice(q.length)}
                          </>
                        ) : sg}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={() => { setQuery(sg); setShowSuggest(true); }}
                      style={styles.suggestFill}
                    >
                      <Ionicons name="arrow-up" size={18} color={TEXT_SECONDARY} style={{ transform: [{ rotate: "-45deg" }] }} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

        {loading && <ActivityIndicator color={ORCHID} style={{ marginTop: 24 }} />}

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        {!loading && searched && !error && categoryEntries.length === 0 && ytResults.length === 0 && (
          <Text style={styles.emptyText}>No results for "{query}".</Text>
        )}

        {!searched && !loading && (
          <View>
            {recents.length > 0 && (
              <View style={{ marginTop: 28 }}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Recent</Text>
                  <TouchableOpacity onPress={clearRecents} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={styles.clearText}>Clear</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.recentWrap}>
                  {recents.map((r) => (
                    <TouchableOpacity key={r} style={styles.recentChip} onPress={() => runSearch(r)}>
                      <Ionicons name="time-outline" size={14} color={TEXT_SECONDARY} />
                      <Text numberOfLines={1} style={styles.recentText}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            <View style={{ marginTop: 28 }}>
              <Text style={styles.sectionTitle}>Browse</Text>
              <View style={styles.tileGrid}>
                {MOODS.map((mo) => (
                  <TouchableOpacity
                    key={mo.label}
                    style={[styles.tile, { backgroundColor: mo.bg, borderColor: mo.border }]}
                    onPress={() => runSearch(mo.q)}
                  >
                    <Ionicons name={mo.icon} size={22} color={mo.fg} />
                    <Text style={styles.tileText}>{mo.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {ytResults.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <Text style={styles.sectionTitle}>From YouTube</Text>

            {selectedIds.size > 0 && (
              <View style={styles.batchBar}>
                {batchRunning ? (
                  <>
                    <ActivityIndicator color={ORCHID} size="small" />
                    <Text style={styles.batchBarText}>
                      Downloading {batchProgress.current}/{batchProgress.total}...
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.batchBarText}>{selectedIds.size} selected</Text>
                    <TouchableOpacity onPress={openBatchQualitySheet} style={styles.batchButton}>
                      <Text style={styles.batchButtonText}>Download Selected</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {(() => {
              // Sort results into groups using your existing classifyVideo()
              const groups = { songs: [], mixes: [], movies: [] };
              ytResults.forEach((yt) => {
                const k = classifyVideo(yt);
                (k === "movie" ? groups.movies : k === "mix" ? groups.mixes : groups.songs).push(yt);
              });
              const shown = ytFilter === "all" ? ytResults : groups[ytFilter];
              const chips = [["songs", "Songs"], ["mixes", "Mixes"], ["movies", "Movies"], ["all", "All"]];
              return (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={chipStyles.row} contentContainerStyle={chipStyles.rowContent}>
                    {chips.map(([key, label]) => (
                      <TouchableOpacity key={key} onPress={() => setYtFilter(key)} style={[chipStyles.chip, ytFilter === key && chipStyles.chipOn]}>
                        <Text style={[chipStyles.chipText, ytFilter === key && chipStyles.chipTextOn]}>
                          {label}{key !== "all" ? " " + groups[key].length : ""}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {shown.length === 0 && <Text style={chipStyles.empty}>Nothing here. Try another filter above.</Text>}
                  {ytFilter === "songs" && selectedIds.size === 0 && shown.length > 0 ? (
                    <>
                      {renderYoutubeRow(shown[0], true)}
                      {shown.slice(1).map((yt) => renderYoutubeRow(yt))}
                    </>
                  ) : (
                    shown.map((yt) => renderYoutubeRow(yt))
                  )}
                </>
              );
            })()}
          </View>
        )}

        {categoryEntries.map(([cat, items]) => (
          <View key={cat} style={{ marginTop: 20 }}>
            <Text style={styles.sectionTitle}>{categoryLabel(cat)}</Text>
            {items.map(renderRow)}
          </View>
        ))}
      </ScrollView>

      {/* ---------- Quality/format picker sheet ---------- */}
      <Modal visible={sheetVisible} transparent animationType="fade" onRequestClose={closeQualitySheet}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeQualitySheet}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        </Pressable>
        <View style={styles.sheetCenterWrap} pointerEvents="box-none">
          <View style={styles.sheetCard}>
            {sheetItem && (
              <>
                <Text numberOfLines={2} style={styles.sheetTitle}>{sheetItem.title}</Text>
                <Text style={styles.sheetSubtitle}>
                  {sheetKind === "movie"
                    ? "Looks like a movie - saving as video"
                    : sheetKind === "mix"
                    ? "Long mix - audio suggested"
                    : "Choose a format and quality"}
                </Text>
                {sheetKind === "movie" && (
                  <TouchableOpacity onPress={() => setShowAllFormats((v) => !v)} style={{ marginBottom: 8 }}>
                    <Text style={styles.sheetLink}>
                      {showAllFormats ? "Hide audio options" : "Save as audio (MP3) instead"}
                    </Text>
                  </TouchableOpacity>
                )}

                {sheetOptions.map((option) => {
                  const resolving = resolvingIds.has(`${sheetItem.id}-${option.key}`);
                  const optionKey = `youtube-${sheetItem.id}-${option.key}`;
                  const optionDownloaded = downloadedIds.has(optionKey);
                  return (
                    <View key={option.key} style={styles.sheetOptionRow}>
                      <Text style={styles.sheetOptionLabel}>{option.label}</Text>
                      {resolving ? (
                        <ActivityIndicator color={ORCHID} size="small" />
                      ) : (
                        <View style={styles.sheetOptionActions}>
                          <TouchableOpacity onPress={() => handleSheetPlay(option)} style={styles.sheetActionButton}>
                            <Text style={styles.sheetActionText}>Play</Text>
                          </TouchableOpacity>
                          {!optionDownloaded && (
                            <TouchableOpacity onPress={() => handleSheetDownload(option)} style={styles.sheetActionButton}>
                              <Text style={styles.sheetActionText}>Save</Text>
                            </TouchableOpacity>
                          )}
                          {optionDownloaded && <Text style={styles.downloadedGlyph}>Saved</Text>}
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ---------- Batch download quality/format picker ---------- */}
      <Modal visible={batchSheetOpen} transparent animationType="fade" onRequestClose={closeBatchQualitySheet}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeBatchQualitySheet}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        </Pressable>
        <View style={styles.sheetCenterWrap} pointerEvents="box-none">
          <View style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>{selectedIds.size} songs selected</Text>
            <Text style={styles.sheetSubtitle}>Choose a format and quality for all of them</Text>

            {QUALITY_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={styles.sheetOptionRow}
                onPress={() => handleBatchDownload(option)}
              >
                <Text style={styles.sheetOptionLabel}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const TOP_PAD = ((require("react-native").StatusBar.currentHeight) || 24) + 32; // real status-bar height
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: JET_BLACK },
  content: { paddingTop: TOP_PAD, paddingHorizontal: 20, paddingBottom: 150 },

  orb: { position: "absolute", borderRadius: 999, backgroundColor: ORCHID },
  orb1: { top: -60, left: -60, width: 250, height: 250, opacity: 0.1 },
  orb2: { bottom: 120, right: -70, width: 300, height: 300, opacity: 0.07 },
  orb3: { top: 380, left: 40, width: 200, height: 200, opacity: 0.05 },

  title: { color: TEXT_PRIMARY, fontSize: 28, fontWeight: "700", letterSpacing: -0.5, marginBottom: 20 },

  inputRow: { flexDirection: "row", gap: 10 },
  input: {
    flex: 1,
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: TEXT_PRIMARY,
    fontSize: 15,
  },
  searchButton: { backgroundColor: ACCENT, borderRadius: 20, paddingHorizontal: 20, justifyContent: "center" },
  searchButtonText: { color: ACCENT_ON, fontWeight: "700", fontSize: 14 },

  suggestBox: {
    backgroundColor: "rgba(29,29,29,0.95)",
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 16,
    marginTop: 8,
    overflow: "hidden",
  },
  suggestRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: GLASS_BORDER,
  },
  suggestText: { color: TEXT_PRIMARY, fontSize: 14 },

  hint: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 24, textAlign: "center" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 24 },
  sourceChip: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sourceChipText: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: "600" },
  suggestWrap: {
    marginTop: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: "rgba(20,20,25,0.6)",
    overflow: "hidden",
  },
  suggestRow2: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  suggestMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  suggestText2: { flex: 1, color: TEXT_PRIMARY, fontSize: 15, fontWeight: "700" },
  suggestTyped: { color: TEXT_SECONDARY, fontWeight: "400" },
  suggestFill: { paddingLeft: 12, paddingVertical: 14 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  clearText: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: "600" },
  recentWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  recentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  recentText: { color: TEXT_PRIMARY, fontSize: 13, flexShrink: 1 },
  tileGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  tile: {
    width: "48%",
    height: 72,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    justifyContent: "space-between",
  },
  tileText: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: "700" },
  emptyText: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 24, textAlign: "center" },
  errorText: {
    color: TEXT_PRIMARY,
    backgroundColor: "rgba(200,50,50,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,100,100,0.3)",
    padding: 12,
    borderRadius: 14,
    marginTop: 16,
  },

  sectionTitle: {
    color: ORCHID,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },

  glassCard: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 20,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  rowBody: { flex: 1, flexDirection: "row", alignItems: "center" },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: GLASS_BORDER,
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: { backgroundColor: ACCENT, borderColor: ACCENT },
  checkboxMark: { color: ACCENT_ON, fontSize: 13, fontWeight: "700" },

  batchBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
    gap: 8,
  },
  batchBarText: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: "600" },
  batchButton: { backgroundColor: ACCENT, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 },
  batchButtonText: { color: ACCENT_ON, fontWeight: "700", fontSize: 12 },

  rowArt: { width: 56, height: 56, borderRadius: 12, backgroundColor: GLASS_BG, marginRight: 14 },
  rowTextWrap: { flex: 1, marginRight: 8 },
  rowTitle: { color: TEXT_PRIMARY, fontWeight: "600", fontSize: 15, marginBottom: 4 },
  rowMetaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowArtist: { color: TEXT_SECONDARY, fontSize: 13, flexShrink: 1 },
  providerBadge: {
    color: ORCHID,
    fontSize: 10,
    fontWeight: "700",
    backgroundColor: "rgba(229,189,223,0.15)",
    borderWidth: 1,
    borderColor: "rgba(229,189,223,0.2)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rowDuration: { color: TEXT_SECONDARY, fontSize: 12, marginRight: 8 },

  downloadWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  downloadPct: { color: TEXT_PRIMARY, fontSize: 10 },
  downloadTouch: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  downloadGlyph: { color: ACCENT_ON, fontSize: 10, fontWeight: "700" },
  downloadedGlyph: { color: "#8CE0A0", fontSize: 11, fontWeight: "700" },

  sheetCenterWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  sheetCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "rgba(29,29,29,0.9)",
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 22,
    padding: 20,
  },
  sheetTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: "700" },
  sheetSubtitle: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 4, marginBottom: 16 },
  sheetOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: GLASS_BORDER,
  },
  sheetOptionLabel: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: "600", flex: 1, marginRight: 10 },
  sheetOptionActions: { flexDirection: "row", gap: 8 },
  sheetActionButton: {
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: GLASS_BG_FOCUS,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sheetLink: { color: ACCENT, fontSize: 12, fontWeight: "700" },
  sheetActionText: { color: ORCHID, fontSize: 12, fontWeight: "700" },
});
