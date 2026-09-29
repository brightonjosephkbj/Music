import { useRef as __useRef } from "react";
const LIB_ORCHID = "#C89BFF";
const TAB_ICONS = {
  Videos: "film",
  "All Songs": "musical-notes",
  Search: "search",
  Folders: "folder",
  Playlists: "albums",
  Artists: "person",
  Downloads: "download",
};
import ArtistHero from "./ArtistHero";
import { splitArtists } from "./artistImages";
import { memoGet, memoSet } from "./memoCache";
import { sortTracks, loadArtistSort, saveArtistSort, loadPlayCounts } from "./artistSort";
import LibraryArtistRow from "./LibraryArtistRow";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  Modal,
  Share,
  RefreshControl,
  Alert,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import { LinearGradient } from "expo-linear-gradient";
import {
  getDownloads,
  removeDownload,
  updateDownloadInfo,
  getFolders,
  createFolder,
  deleteFolder,
  addItemToFolder,
  getPlaylists,
  createPlaylist,
  addTrackToPlaylist,
  updatePlaylist,
  deletePlaylist,
} from "./libraryStorage";
import ContextMenuCard from "./ContextMenuCard";
import useArtworkAccent from "./useArtworkAccent";
import ImageViewer from "./ImageViewer";
import { scanDeviceMedia } from "./localMediaScanner";
import { useDownloads } from "./DownloadsContext";
import { generateAIPlaylist } from "./aiPlaylist";
import * as ImagePicker from "expo-image-picker";
import {
  getCurrentUser, listFriends, createGroupPlaylist, listGroupPlaylists,
  getGroupPlaylistTracks, addGroupPlaylistTrack, deleteGroupPlaylistTrack,
  updateGroupPlaylist, uploadPlaylistArt,
} from "./shareClient";

const GRADIENT_COLORS = ["#121212", "#181818", "#121212"];
const GLASS_BG = "rgba(255,255,255,0.08)";
const GLASS_BORDER = "rgba(255,255,255,0.15)";
const ACCENT_GREEN = "#39FF6A";
const ACCENT_GREEN_SOFT = "rgba(57,255,106,0.16)";
const ACCENT_GREEN_BORDER = "rgba(57,255,106,0.35)";
const PL_GLASS_BG = "rgba(255,255,255,0.04)";
const PL_GLASS_BORDER = "rgba(255,255,255,0.09)";
const PL_DARK_GRAY = "#2A2A2E";

const TABS = ["Videos", "All Songs", "Search", "Folders", "Playlists", "Artists", "Downloads"];
const AS_AMBER = "#C89BFF";
const AS_GOLD = "#D4AF37";
const AS_NEON = "#00FF88";
const AS_GLASS_BG = "rgba(255,255,255,0.05)";
const AS_GLASS_BORDER = "rgba(255,255,255,0.09)";
const AS_ACTIVE_BG = "rgba(245,166,35,0.10)";
const AS_ACTIVE_BORDER = "rgba(245,166,35,0.35)";

function formatDuration(sec) {
  if (!sec && sec !== 0) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function plHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Accent colour derived from the playlist's songs (stable per playlist).
function playlistAccent(ids) {
  const key = (ids || []).slice(0, 8).join("|") || "empty";
  const h = plHash(key) % 360;
  return {
    solid: `hsl(${h},85%,70%)`,
    glow: `hsl(${h},95%,58%)`,
    soft: `hsla(${h},85%,60%,0.16)`,
    border: `hsla(${h},85%,70%,0.45)`,
    tint: `hsla(${h},80%,45%,0.35)`,
  };
}

let deviceMediaCache = null;

export default function LibraryScreen({ onTrackPress, onSearchPress, currentTrackId }) {
  const { activeDownloads, pauseDownload, resumeDownload, cancelDownload } = useDownloads();
  const [activeTab, setActiveTab] = useState("Playlists");
  const [downloads, setDownloads] = useState([]);
  const [deviceAudio, setDeviceAudio] = useState(deviceMediaCache?.audio || []);
  const [deviceVideo, setDeviceVideo] = useState(deviceMediaCache?.video || []);
  const [scanDenied, setScanDenied] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanErrorMsg, setScanErrorMsg] = useState(null);
  const [lastScanCounts, setLastScanCounts] = useState(null);
  const [folders, setFolders] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  // Playlist tab extras
  const [playlistSearch, setPlaylistSearch] = useState("");
  const [songSearchQuery, setSongSearchQuery] = useState("");
  const [editPlaylistVisible, setEditPlaylistVisible] = useState(false);
  const [editPlaylistTarget, setEditPlaylistTarget] = useState(null);
  const [editPlaylistName, setEditPlaylistName] = useState("");
  const [editPlaylistArt, setEditPlaylistArt] = useState("");

  // Playlist pill bar: Add / Edit / Sort / Find
  const [findInPlaylistVisible, setFindInPlaylistVisible] = useState(false);
  const [findInPlaylistQuery, setFindInPlaylistQuery] = useState("");
  const [playlistSortMode, setPlaylistSortMode] = useState("recent");
  const [editModeActive, setEditModeActive] = useState(false);
  const [editSelectedIds, setEditSelectedIds] = useState(new Set());
  const [addSongsVisible, setAddSongsVisible] = useState(false);
  const [addSongsSelectedIds, setAddSongsSelectedIds] = useState(new Set());

  // New Playlist: Personal vs Group choice, then group name + friend picker
  const [createChoiceVisible, setCreateChoiceVisible] = useState(false);
  const [groupCreateVisible, setGroupCreateVisible] = useState(false);
  const [groupCreateStep, setGroupCreateStep] = useState("name"); // "name" | "friends"
  const [groupName, setGroupName] = useState("");
  const [groupFriends, setGroupFriends] = useState([]);
  const [groupFriendsLoading, setGroupFriendsLoading] = useState(false);
  const [groupSelectedFriendIds, setGroupSelectedFriendIds] = useState(new Set());
  const [groupCreating, setGroupCreating] = useState(false);

  const [groupPlaylists, setGroupPlaylists] = useState([]);
  const [selectedGroupPlaylist, setSelectedGroupPlaylist] = useState(null);
  const [groupPlaylistTracks, setGroupPlaylistTracks] = useState([]);
  // Caches each group playlist's tracks by id so reopening a playlist you've
  // already loaded doesn't refetch over the network every time - only a
  // fresh add/delete (via refreshGroupTracks) or a cache-miss triggers a
  // real fetch.
  const groupTracksCacheRef = useRef({});
  const [groupTracksLoading, setGroupTracksLoading] = useState(false);

  // Group playlist detail: add/edit song wiring
  const [groupCurrentUserId, setGroupCurrentUserId] = useState(null);
  const [groupEditModeActive, setGroupEditModeActive] = useState(false);
  const [groupEditSelectedIds, setGroupEditSelectedIds] = useState(new Set());
  const [groupAddVisible, setGroupAddVisible] = useState(false);
  const [groupAddSelectedIds, setGroupAddSelectedIds] = useState(new Set());
  const [groupAddBusy, setGroupAddBusy] = useState(false);
  const [groupRemoveBusy, setGroupRemoveBusy] = useState(false);

  // Group playlist info edit (name + art via image picker, no more URL field)
  const [groupInfoVisible, setGroupInfoVisible] = useState(false);
  const [groupInfoName, setGroupInfoName] = useState("");
  const [groupInfoArtUri, setGroupInfoArtUri] = useState(null); // local preview uri, may be existing remote url
  const [groupInfoSaving, setGroupInfoSaving] = useState(false);

  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [artistSortMode, setArtistSortMode] = useState("recent");
  const [artistPlayCounts, setArtistPlayCounts] = useState({});

  const [menuVisible, setMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuItem, setMenuItem] = useState(null);

  const [playlistMenuVisible, setPlaylistMenuVisible] = useState(false);
  const [playlistMenuAnchor, setPlaylistMenuAnchor] = useState(null);
  const [playlistMenuTarget, setPlaylistMenuTarget] = useState(null);

  const [promptVisible, setPromptVisible] = useState(false);
  const [promptMode, setPromptMode] = useState(null);
  const [promptValue, setPromptValue] = useState("");

  // Playlist & Folder Picker states
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null);
  const [folderPickerVisible, setFolderPickerVisible] = useState(false);
  const [folderPickerTarget, setFolderPickerTarget] = useState(null);

  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerItems, setImageViewerItems] = useState([]);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);

  const loadAll = useCallback(async () => {
    const [d, f, p] = await Promise.all([getDownloads(), getFolders(), getPlaylists()]);
    setDownloads(d);
    setFolders(f);
    setPlaylists(p);
    try {
      const user = await getCurrentUser();
      if (user?.id) {
        const groups = await listGroupPlaylists(user.id);
        setGroupPlaylists(groups);
      }
    } catch (e) {
      console.warn("Failed to load group playlists:", e.message);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (user?.id) setGroupCurrentUserId(user.id);
    })();
  }, []);

  const generateAI = useCallback(async () => {
    if (aiGenerating) return;
    setAiGenerating(true);
    try {
      await generateAIPlaylist();
      await loadAll();
    } catch (err) {
      Alert.alert(
        "Couldn't generate playlist",
        err.message || "Something went wrong - try again in a bit."
      );
    } finally {
      setAiGenerating(false);
    }
  }, [aiGenerating, loadAll]);

  const runScan = useCallback(async () => {
    setScanning(true);
    setScanErrorMsg(null);
    try {
      const result = await scanDeviceMedia();
      if (!result.granted) {
        setScanDenied(true);
        setScanErrorMsg(result.error || "Permission not granted");
        return;
      }
      setScanDenied(false);
      setDeviceAudio(result.audio);
      setDeviceVideo(result.video);
      setLastScanCounts({ audio: result.audio.length, video: result.video.length });
      deviceMediaCache = { audio: result.audio, video: result.video };
      if (result.error) setScanErrorMsg(result.error);
    } catch (err) {
      console.error("[runScan] unexpected error:", err);
      setScanErrorMsg(err.message || "Unknown error during scan");
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    if (deviceMediaCache) return;
    runScan();
  }, [runScan]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const openMenu = useCallback((evt, item) => {
    const { pageX, pageY } = evt.nativeEvent;
    setMenuAnchor({ x: pageX - 110, y: pageY + 8 });
    setMenuItem(item);
    setMenuVisible(true);
  }, []);

  const openPlaylistMenu = useCallback((evt, playlist) => {
    const { pageX, pageY } = evt.nativeEvent;
    setPlaylistMenuAnchor({ x: pageX - 110, y: pageY + 8 });
    setPlaylistMenuTarget(playlist);
    setPlaylistMenuVisible(true);
  }, []);

  // Shared by both delete entry points (long-press menu + header ⋮ menu) so
  // the choice between "keep songs" and "remove songs too" is consistent
  // everywhere a playlist can be deleted from.
  const confirmDeletePlaylist = useCallback((playlist) => {
    if (!playlist) return;
    Alert.alert(
      "Delete Playlist",
      `Delete "${playlist.name}"? You can keep the songs in your library, or remove them too if they aren't in any other playlist.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Playlist Only",
          onPress: async () => {
            await deletePlaylist(playlist.id);
            if (selectedPlaylist && selectedPlaylist.id === playlist.id) closeDetail();
            loadAll();
          },
        },
        {
          text: "Delete Playlist & Songs",
          style: "destructive",
          onPress: async () => {
            await deletePlaylist(playlist.id, { alsoDeleteSongs: true });
            if (selectedPlaylist && selectedPlaylist.id === playlist.id) closeDetail();
            loadAll();
          },
        },
      ]
    );
  }, [selectedPlaylist, loadAll]);

  const menuActions = useMemo(() => {
    if (!menuItem) return [];
    return [
      {
        key: "share",
        label: "Share",
        onPress: async () => {
          if (menuItem.localUri && (await Sharing.isAvailableAsync())) {
            // Actually shares the audio/video file itself via a content:// URI -
            // Share.share()'s url field is iOS-only, so it silently dropped the
            // file on Android and only ever sent the title text.
            await Sharing.shareAsync(menuItem.localUri);
          } else {
            Share.share({ message: menuItem.title });
          }
        },
      },
      {
        key: "playNext",
        label: "Play Next",
        onPress: () => onTrackPress && onTrackPress(menuItem, { playNext: true }),
      },
      {
        key: "addToPlaylist",
        label: "Add to Playlist",
        onPress: () => {
          setPickerTarget(menuItem);
          setPickerVisible(true);
        },
      },
      {
        key: "addToFolder",
        label: "Add to Folder",
        onPress: () => {
          setFolderPickerTarget(menuItem);
          setFolderPickerVisible(true);
        },
      },
      {
        key: "editInfo",
        label: "Edit Info",
        onPress: () => {
          setPromptMode("editInfo");
          setPromptValue(menuItem.title);
          setPromptVisible(true);
        },
      },
      {
        key: "delete",
        label: "Delete",
        destructive: true,
        onPress: async () => {
          const isDownload = downloads.some((d) => d.id === menuItem.id);
          if (isDownload) {
            await removeDownload(menuItem.id);
            loadAll();
          } else {
            const filterOut = (prev) => prev.filter((d) => d.id !== menuItem.id);
            setDeviceAudio(filterOut);
            setDeviceVideo(filterOut);
            if (deviceMediaCache) {
              deviceMediaCache = {
                audio: deviceMediaCache.audio.filter((d) => d.id !== menuItem.id),
                video: deviceMediaCache.video.filter((d) => d.id !== menuItem.id),
              };
            }
          }
        },
      },
    ];
  }, [menuItem, downloads, loadAll, onTrackPress]);

  const playlistMenuActions = useMemo(() => {
    if (!playlistMenuTarget) return [];
    return [
      {
        key: "editInfo",
        label: "Edit Info",
        onPress: () => {
          setEditPlaylistTarget(playlistMenuTarget);
          setEditPlaylistName(playlistMenuTarget.name);
          setEditPlaylistArt(playlistMenuTarget.art || "");
          setEditPlaylistVisible(true);
        },
      },
      {
        key: "delete",
        label: "Delete",
        destructive: true,
        onPress: () => confirmDeletePlaylist(playlistMenuTarget),
      },
    ];
  }, [playlistMenuTarget, confirmDeletePlaylist]);

  const submitPrompt = async () => {
    const value = promptValue.trim();
    if (!value) return setPromptVisible(false);

    if (promptMode === "folder") {
      await createFolder(value);
    } else if (promptMode === "playlist") {
      await createPlaylist(value);
    } else if (promptMode === "editInfo" && menuItem) {
      const isDownload = downloads.some((d) => d.id === menuItem.id);
      if (isDownload) {
        await updateDownloadInfo(menuItem.id, { title: value });
      } else {
        const updateTitle = (list) =>
          list.map((item) => (item.id === menuItem.id ? { ...item, title: value } : item));
        setDeviceAudio(updateTitle);
        setDeviceVideo(updateTitle);
        if (deviceMediaCache) {
          deviceMediaCache = {
            audio: updateTitle(deviceMediaCache.audio),
            video: updateTitle(deviceMediaCache.video),
          };
        }
      }
    }
    setPromptVisible(false);
    setPromptValue("");
    loadAll();
  };

  const appVideos = useMemo(() => downloads.filter((d) => d.type === "video"), [downloads]);
  const appAudio = useMemo(() => downloads.filter((d) => d.type === "audio"), [downloads]);
  const videos = useMemo(() => [...appVideos, ...deviceVideo], [appVideos, deviceVideo]);
  const allSongs = useMemo(() => [...appAudio, ...deviceAudio], [appAudio, deviceAudio]);
  const searchSongs = useMemo(() => downloads.filter((d) => d.fromSearch === true), [downloads]);
  const filteredAllSongs = useMemo(() => {
    if (!songSearchQuery.trim()) return allSongs;
    const q = songSearchQuery.toLowerCase();
    return allSongs.filter(
      (s) => (s.title || "").toLowerCase().includes(q) || (s.artist || "").toLowerCase().includes(q)
    );
  }, [allSongs, songSearchQuery]);

  const allMedia = useMemo(() => {
    const map = new Map();
    [...downloads, ...deviceAudio, ...deviceVideo].forEach((item) => {
      if (item && item.id) map.set(item.id, item);
    });
    return Array.from(map.values());
  }, [downloads, deviceAudio, deviceVideo]);

  const artistGroups = useMemo(() => {
    const names = new Map();
    const groups = {};
    [...allSongs, ...videos].forEach((d) => {
      const list = splitArtists(d.artist);
      (list.length ? list : ["Unknown Artist"]).forEach((n) => {
        const k = n.toLowerCase();
        if (!names.has(k)) names.set(k, n);
        const name = names.get(k);
        (groups[name] = groups[name] || []).push(d);
      });
    });
    if (Object.keys(groups).length > 0) {
      memoSet("libArtistGroups", groups);
      return groups;
    }
    return memoGet("libArtistGroups") || groups;
  }, [allSongs, videos]);
  const artistEntries = useMemo(
    () => Object.entries(artistGroups).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])),
    [artistGroups]
  );

  const getPlaylistArt = useCallback((playlist) => {
    if (playlist.art) return { uri: playlist.art };
    if (playlist.is_group) return null;
    const idSet = new Set(playlist.trackIds || []);
    const firstTrack = allMedia.find((d) => idSet.has(d.id) && d.artwork);
    return firstTrack ? { uri: firstTrack.artwork } : null;
  }, [allMedia]);

  const combinedPlaylists = useMemo(() => {
    const taggedPersonal = playlists.map((p) => ({ ...p, is_group: false }));
    const taggedGroup = groupPlaylists.map((p) => ({ ...p, is_group: true }));
    return [...taggedGroup, ...taggedPersonal];
  }, [playlists, groupPlaylists]);

  const filteredPlaylists = useMemo(() => {
    if (!playlistSearch.trim()) return combinedPlaylists;
    const q = playlistSearch.toLowerCase();
    return combinedPlaylists.filter((p) => p.name.toLowerCase().includes(q));
  }, [combinedPlaylists, playlistSearch]);

  const playAllPlaylist = useCallback((playlist) => {
    const idSet = new Set(playlist.trackIds || []);
    const tracks = allMedia.filter((d) => idSet.has(d.id));
    if (tracks.length > 0 && onTrackPress) onTrackPress(tracks[0], tracks);
  }, [allMedia, onTrackPress]);

  const shufflePlaylist = useCallback((playlist) => {
    const idSet = new Set(playlist.trackIds || []);
    const tracks = allMedia.filter((d) => idSet.has(d.id));
    if (tracks.length > 0 && onTrackPress) {
      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
      onTrackPress(shuffled[0], shuffled);
    }
  }, [allMedia, onTrackPress]);

  const openCreatePlaylistChoice = useCallback(() => {
    setCreateChoiceVisible(true);
  }, []);

  const choosePersonalPlaylist = useCallback(() => {
    setCreateChoiceVisible(false);
    setPromptMode("playlist");
    setPromptValue("");
    setPromptVisible(true);
  }, []);

  const chooseGroupPlaylist = useCallback(async () => {
    setCreateChoiceVisible(false);
    setGroupName("");
    setGroupSelectedFriendIds(new Set());
    setGroupCreateStep("name");
    setGroupCreateVisible(true);
    setGroupFriendsLoading(true);
    try {
      const user = await getCurrentUser();
      if (user?.id) {
        const list = await listFriends(user.id);
        setGroupFriends(list);
      }
    } catch (e) {
      console.warn("Failed to load friends for group playlist:", e.message);
    } finally {
      setGroupFriendsLoading(false);
    }
  }, []);

  const submitGroupPlaylist = useCallback(async () => {
    const name = groupName.trim();
    if (!name || groupCreating) return;
    setGroupCreating(true);
    try {
      const user = await getCurrentUser();
      if (!user?.id) throw new Error("Not signed in");
      await createGroupPlaylist(user.id, name, Array.from(groupSelectedFriendIds));
      setGroupCreateVisible(false);
      loadAll();
    } catch (e) {
      Alert.alert("Couldn't create group playlist", e.message || "Something went wrong - try again.");
    } finally {
      setGroupCreating(false);
    }
  }, [groupName, groupSelectedFriendIds, groupCreating, loadAll]);

  const refreshGroupTracks = useCallback(async (playlistId) => {
    const tracks = await getGroupPlaylistTracks(playlistId);
    groupTracksCacheRef.current[playlistId] = tracks;
    setGroupPlaylistTracks(tracks);
    return tracks;
  }, []);

  const groupAddCandidates = useMemo(() => {
    if (!selectedGroupPlaylist) return [];
    const existingUrls = new Set(groupPlaylistTracks.map((t) => t.source_url));
    return allMedia
      .filter((m) => !!m.source_url)
      .map((m) => ({ ...m, __alreadyAdded: existingUrls.has(m.source_url) }));
  }, [selectedGroupPlaylist, groupPlaylistTracks, allMedia]);

  const submitGroupAddSongs = useCallback(async () => {
    if (!selectedGroupPlaylist || !groupCurrentUserId || groupAddSelectedIds.size === 0) {
      setGroupAddVisible(false);
      return;
    }
    setGroupAddBusy(true);
    try {
      for (const id of groupAddSelectedIds) {
        const track = allMedia.find((m) => m.id === id);
        if (!track || !track.source_url) continue;
        await addGroupPlaylistTrack(selectedGroupPlaylist.id, groupCurrentUserId, {
          title: track.title,
          artist: track.artist,
          duration: track.duration,
          artwork_url: track.artwork,
          source_url: track.source_url,
        });
      }
      await refreshGroupTracks(selectedGroupPlaylist.id);
      setGroupAddVisible(false);
      setGroupAddSelectedIds(new Set());
    } catch (e) {
      Alert.alert("Couldn't add songs", e.message || "Something went wrong - try again.");
    } finally {
      setGroupAddBusy(false);
    }
  }, [selectedGroupPlaylist, groupCurrentUserId, groupAddSelectedIds, allMedia, refreshGroupTracks]);

  const confirmRemoveGroupSelected = useCallback(() => {
    if (!selectedGroupPlaylist || groupEditSelectedIds.size === 0) return;
    if (selectedGroupPlaylist.role !== "owner") {
      Alert.alert("Can't remove songs", "Only the playlist creator can remove songs.");
      return;
    }
    Alert.alert(
      "Remove songs",
      `Remove ${groupEditSelectedIds.size} song${groupEditSelectedIds.size > 1 ? "s" : ""} from "${selectedGroupPlaylist.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setGroupRemoveBusy(true);
            try {
              for (const trackId of groupEditSelectedIds) {
                await deleteGroupPlaylistTrack(selectedGroupPlaylist.id, trackId, groupCurrentUserId);
              }
              await refreshGroupTracks(selectedGroupPlaylist.id);
              setGroupEditModeActive(false);
              setGroupEditSelectedIds(new Set());
            } catch (e) {
              Alert.alert("Couldn't remove songs", e.message || "Something went wrong - try again.");
            } finally {
              setGroupRemoveBusy(false);
            }
          },
        },
      ]
    );
  }, [selectedGroupPlaylist, groupEditSelectedIds, groupCurrentUserId, refreshGroupTracks]);

  const pickGroupArtImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo access to choose a playlist image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setGroupInfoArtUri(result.assets[0].uri);
    }
  }, []);

  const submitGroupInfo = useCallback(async () => {
    if (!selectedGroupPlaylist || !groupCurrentUserId) return;
    const name = groupInfoName.trim();
    if (!name) return;
    setGroupInfoSaving(true);
    try {
      let art = selectedGroupPlaylist.art || null;
      if (groupInfoArtUri && !groupInfoArtUri.startsWith("http")) {
        art = await uploadPlaylistArt(groupInfoArtUri);
      } else if (groupInfoArtUri) {
        art = groupInfoArtUri;
      }
      await updateGroupPlaylist(selectedGroupPlaylist.id, groupCurrentUserId, { name, art });
      setSelectedGroupPlaylist((prev) => (prev ? { ...prev, name, art } : prev));
      setGroupInfoVisible(false);
      loadAll();
    } catch (e) {
      Alert.alert("Couldn't update playlist", e.message || "Something went wrong - try again.");
    } finally {
      setGroupInfoSaving(false);
    }
  }, [selectedGroupPlaylist, groupCurrentUserId, groupInfoName, groupInfoArtUri, loadAll]);

  const openSortMenu = useCallback(() => {
    if (selectedArtist) {
      const pick = (mode) => { setArtistSortMode(mode); saveArtistSort(mode); };
      Alert.alert("Sort songs", "", [
        { text: "Recently Added", onPress: () => pick("recent") },
        { text: "Title A-Z", onPress: () => pick("title") },
        { text: "Most Played", onPress: () => pick("played") },
      ]);
      return;
    }
    Alert.alert("Sort by", "", [
      { text: "Recently Added", onPress: () => setPlaylistSortMode("recent") },
      { text: "Album", onPress: () => setPlaylistSortMode("album") },
      { text: "Artist", onPress: () => setPlaylistSortMode("artist") },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [selectedArtist]);

  const confirmRemoveSelected = useCallback(() => {
    if (!selectedPlaylist || editSelectedIds.size === 0) return;
    Alert.alert(
      "Remove songs",
      `Remove ${editSelectedIds.size} song${editSelectedIds.size > 1 ? "s" : ""} from "${selectedPlaylist.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const remaining = (selectedPlaylist.trackIds || []).filter((id) => !editSelectedIds.has(id));
            await updatePlaylist(selectedPlaylist.id, { trackIds: remaining });
            setEditModeActive(false);
            setEditSelectedIds(new Set());
            loadAll();
          },
        },
      ]
    );
  }, [selectedPlaylist, editSelectedIds, loadAll]);

  const folderItems = useMemo(() => {
    if (!selectedFolder) return [];
    const idSet = new Set(selectedFolder.itemIds || []);
    return allMedia.filter((d) => idSet.has(d.id));
  }, [selectedFolder, allMedia]);

  const playlistItems = useMemo(() => {
    if (!selectedPlaylist) return [];
    const idSet = new Set(selectedPlaylist.trackIds || []);
    return allMedia.filter((d) => idSet.has(d.id));
  }, [selectedPlaylist, allMedia]);

  const sortedPlaylistItems = useMemo(() => {
    if (!selectedPlaylist) return [];
    let items = [...playlistItems];
    if (playlistSortMode === "recent") {
      const order = selectedPlaylist.trackIds || [];
      items.sort((a, b) => order.indexOf(b.id) - order.indexOf(a.id));
    } else if (playlistSortMode === "artist") {
      items.sort((a, b) => (a.artist || "").localeCompare(b.artist || ""));
    } else if (playlistSortMode === "album") {
      items.sort((a, b) => (a.album || "").localeCompare(b.album || ""));
    }
    return items;
  }, [selectedPlaylist, playlistItems, playlistSortMode]);

  const filteredPlaylistItems = useMemo(() => {
    if (!findInPlaylistQuery.trim()) return sortedPlaylistItems;
    const q = findInPlaylistQuery.toLowerCase();
    return sortedPlaylistItems.filter(
      (s) => (s.title || "").toLowerCase().includes(q) || (s.artist || "").toLowerCase().includes(q)
    );
  }, [sortedPlaylistItems, findInPlaylistQuery]);

  const addSongsCandidates = useMemo(() => {
    if (!selectedPlaylist) return [];
    const idSet = new Set(selectedPlaylist.trackIds || []);
    return allMedia.map((m) => ({ ...m, __alreadyAdded: idSet.has(m.id) }));
  }, [selectedPlaylist, allMedia]);

  const artistTracks = useMemo(() => {
    if (!selectedArtist) return [];
    return sortTracks(artistGroups[selectedArtist] || [], artistSortMode, artistPlayCounts);
  }, [selectedArtist, artistGroups, artistSortMode, artistPlayCounts]);

  useEffect(() => {
    loadArtistSort().then(setArtistSortMode);
  }, []);
  useEffect(() => {
    if (selectedArtist) loadPlayCounts().then(setArtistPlayCounts);
  }, [selectedArtist]);

  useEffect(() => {
    if (selectedFolder) {
      const fresh = folders.find((f) => f.id === selectedFolder.id);
      if (fresh && fresh !== selectedFolder) setSelectedFolder(fresh);
      if (!fresh) setSelectedFolder(null);
    }
  }, [folders, selectedFolder]);

  useEffect(() => {
    if (selectedPlaylist) {
      const fresh = playlists.find((p) => p.id === selectedPlaylist.id);
      if (fresh && fresh !== selectedPlaylist) setSelectedPlaylist(fresh);
      if (!fresh) setSelectedPlaylist(null);
    }
  }, [playlists, selectedPlaylist]);

  const closeDetail = () => {
    setSelectedFolder(null);
    setSelectedPlaylist(null);
    setSelectedArtist(null);
    setEditModeActive(false);
    setEditSelectedIds(new Set());
    setFindInPlaylistVisible(false);
    setFindInPlaylistQuery("");
    setSelectedGroupPlaylist(null);
    setGroupPlaylistTracks([]);
    setGroupEditModeActive(false);
    setGroupEditSelectedIds(new Set());
  };

  const openImage = useCallback((item) => {
    const savedImages = allMedia.filter((d) => d.type === "image");
    const idx = savedImages.findIndex((d) => d.id === item.id);
    const targetImages = savedImages.length > 0 ? savedImages : [item];
    const targetIndex = idx >= 0 ? idx : 0;

    setImageViewerItems(
      targetImages.map((d) => ({
        id: d.id,
        title: d.title || "Image",
        artist: d.artist || "",
        image: d.localUri || d.uri,
        thumbnail: d.artwork || d.localUri || d.uri,
        download_url: d.localUri || d.uri,
        source: d.source,
      }))
    );
    setImageViewerIndex(targetIndex);
    setImageViewerVisible(true);
  }, [allMedia]);

  const plFallbackAccent = useMemo(
    () => playlistAccent(selectedPlaylist ? selectedPlaylist.trackIds || [] : []),
    [selectedPlaylist]
  );
  const plArtForColor = selectedPlaylist ? getPlaylistArt(selectedPlaylist) : null;
  const plAccent = useArtworkAccent(plArtForColor && plArtForColor.uri, plFallbackAccent);

  const renderTrackRow = useCallback(
    ({ item }) => {
      const inPlaylistEditMode = !!selectedPlaylist && editModeActive;
      const isChecked = editSelectedIds.has(item.id);
      const isPl = !!selectedPlaylist;
      const isPlActive = isPl && currentTrackId != null && currentTrackId === item.id;
      return (
        <TouchableOpacity
          style={[
            styles.row,
            isPl && styles.plxRow,
            isPlActive && { backgroundColor: plAccent.soft, borderColor: plAccent.border },
          ]}
          onPress={() => {
            if (inPlaylistEditMode) {
              setEditSelectedIds((prev) => {
                const next = new Set(prev);
                if (next.has(item.id)) next.delete(item.id);
                else next.add(item.id);
                return next;
              });
              return;
            }
            if (item.type === "image") return openImage(item);
            if (!onTrackPress) return;
            const sourceQueue =
              selectedFolder ? folderItems :
              selectedPlaylist ? filteredPlaylistItems :
              selectedArtist ? artistTracks :
              activeTab === "Videos" ? videos :
              activeTab === "All Songs" ? allSongs :
              downloads;
            onTrackPress(item, sourceQueue);
          }}
          onLongPress={(evt) => !inPlaylistEditMode && openMenu(evt, item)}
          delayLongPress={300}
        >
          {isPlActive && <View style={[styles.plxBar, { backgroundColor: plAccent.solid }]} />}
          {inPlaylistEditMode && (
            <View style={[styles.editCheckbox, isChecked && styles.editCheckboxChecked]}>
              {isChecked && <Ionicons name="checkmark" size={14} color="#000" />}
            </View>
          )}
          <Image source={item.artwork ? { uri: item.artwork } : undefined} style={styles.rowArt} />
          <View style={styles.rowTextWrap}>
            <Text numberOfLines={1} style={[styles.rowTitle, isPlActive && { color: plAccent.solid }]}>{item.title}</Text>
            {!!item.artist && <Text numberOfLines={1} style={styles.rowArtist}>{item.artist}</Text>}
          </View>
          {isPlActive && <Ionicons name="stats-chart" size={15} color={plAccent.solid} style={{ marginRight: 10 }} />}
          {item.type === "image" ? (
            <Text style={styles.rowDuration}>Image</Text>
          ) : (
            <Text style={styles.rowDuration}>{formatDuration(item.duration)}</Text>
          )}
          {isPl && !inPlaylistEditMode && (
            <TouchableOpacity
              style={styles.plxMore}
              onPress={(evt) => openMenu(evt, item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="ellipsis-vertical" size={16} color="rgba(255,255,255,0.55)" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      );
    },
    [downloads, onTrackPress, activeTab, videos, allSongs, selectedFolder, selectedPlaylist, selectedArtist, folderItems, filteredPlaylistItems, artistTracks, openImage, openMenu, editModeActive, editSelectedIds, currentTrackId, plAccent]
  );

  const renderGroupTrackRow = useCallback(
    ({ item }) => {
      const isChecked = groupEditSelectedIds.has(item.id);
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() => {
            if (groupEditModeActive) {
              setGroupEditSelectedIds((prev) => {
                const next = new Set(prev);
                if (next.has(item.id)) next.delete(item.id);
                else next.add(item.id);
                return next;
              });
              return;
            }
            if (onTrackPress) onTrackPress(item, groupPlaylistTracks);
          }}
          delayLongPress={300}
        >
          {groupEditModeActive && (
            <View style={[styles.editCheckbox, isChecked && styles.editCheckboxChecked]}>
              {isChecked && <Ionicons name="checkmark" size={14} color="#000" />}
            </View>
          )}
          <Image source={item.artwork_url ? { uri: item.artwork_url } : undefined} style={styles.rowArt} />
          <View style={styles.rowTextWrap}>
            <Text numberOfLines={1} style={styles.rowTitle}>{item.title}</Text>
            {!!item.artist && <Text numberOfLines={1} style={styles.rowArtist}>{item.artist}</Text>}
          </View>
          <Text style={styles.rowDuration}>{formatDuration(item.duration)}</Text>
        </TouchableOpacity>
      );
    },
    [groupEditModeActive, groupEditSelectedIds, groupPlaylistTracks, onTrackPress]
  );

  const keyExtractor = useCallback((item) => item.id, []);

  const renderAllSongsRow = useCallback(
    ({ item }) => {
      const isActive = !!currentTrackId && item.id === currentTrackId;
      return (
        <TouchableOpacity
          style={[
            styles.asRow,
            isActive && styles.asRowActive,
            { borderWidth: 0, borderRadius: 14, backgroundColor: isActive ? "rgba(200,155,255,0.12)" : "transparent" },
          ]}
          onPress={() => {
            if (item.type === "image") return openImage(item);
            if (onTrackPress) onTrackPress(item, allSongs);
          }}
          onLongPress={(evt) => openMenu(evt, item)}
          delayLongPress={300}
          activeOpacity={0.85}
        >
          <View style={[styles.asRowArtWrap, isActive && styles.asRowArtWrapActive]}>
            {item.artwork ? (
              <Image source={{ uri: item.artwork }} style={styles.asRowArt} />
            ) : (
              <View style={[styles.asRowArt, styles.asRowArtPlaceholder]}>
                <Ionicons name="musical-notes" size={18} color="rgba(255,255,255,0.35)" />
              </View>
            )}
            {isActive && (
              <View style={styles.asRowEqOverlay}>
                <View style={[styles.asEqBar, { height: 6 }]} />
                <View style={[styles.asEqBar, { height: 14 }]} />
                <View style={[styles.asEqBar, { height: 9 }]} />
              </View>
            )}
          </View>

          <View style={styles.asRowTextWrap}>
            <View style={styles.asRowTitleRow}>
              <Text numberOfLines={1} style={[styles.asRowTitle, isActive && { color: LIB_ORCHID }]}>{item.title}</Text>
              {isActive && (
                <View style={styles.asNowBadge}>
                  <Text style={styles.asNowBadgeText}>NOW</Text>
                </View>
              )}
            </View>
            {!!item.artist && <Text numberOfLines={1} style={styles.asRowArtist}>{item.artist}</Text>}
          </View>

          <View style={styles.asRowRight}>
            <Text style={[styles.asRowDuration, isActive && styles.asRowDurationActive]}>
              {item.type === "image" ? "Image" : formatDuration(item.duration)}
            </Text>
            <TouchableOpacity
              style={styles.asRowMoreBtn}
              onPress={(evt) => openMenu(evt, item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="ellipsis-vertical" size={16} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    },
    [allSongs, onTrackPress, openMenu, openImage, currentTrackId]
  );

  const renderPlaylistDetailHeader = () => {
    if (!selectedPlaylist) return null;
    const art = getPlaylistArt(selectedPlaylist);
    const A = plAccent;

    return (
      <View style={styles.plxHeader}>
        {/* Cover with accent glow */}
        <View style={[styles.plxCoverWrap, { shadowColor: A.glow, borderColor: A.border }]}>
          {art ? (
            <Image source={art} style={styles.plxCover} />
          ) : (
            <View style={[styles.plxCover, styles.plxPlaceholder]}>
              <Ionicons name="musical-notes" size={60} color="rgba(255,255,255,0.4)" />
            </View>
          )}
        </View>

        {/* Title + meta */}
        <Text style={styles.plxTitle} numberOfLines={2}>{selectedPlaylist.name}</Text>
        <View style={styles.plxSourceRow}>
          <View style={[styles.plxDot, { backgroundColor: A.solid }]} />
          <Text style={styles.plxSourceText}>Made for you</Text>
        </View>
        <Text style={styles.plxMeta}>{playlistItems.length} songs</Text>

        {/* Actions */}
        <View style={styles.plxActionRow}>
          <TouchableOpacity
            style={styles.plxRoundBtn}
            onPress={() => {
              setAddSongsSelectedIds(new Set());
              setAddSongsVisible(true);
            }}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.plxRoundBtn} onPress={openSortMenu}>
            <Ionicons name="swap-vertical" size={18} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.plxRoundBtn, editModeActive && { backgroundColor: A.solid, borderColor: A.solid }]}
            onPress={() => {
              setEditModeActive((prev) => !prev);
              setEditSelectedIds(new Set());
            }}
          >
            <Ionicons name="create-outline" size={18} color={editModeActive ? "#000" : "#fff"} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.plxRoundBtn, findInPlaylistVisible && { backgroundColor: A.solid, borderColor: A.solid }]}
            onPress={() => {
              setFindInPlaylistVisible((prev) => !prev);
              setFindInPlaylistQuery("");
            }}
          >
            <Ionicons name="search" size={18} color={findInPlaylistVisible ? "#000" : "#fff"} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.plxPlayBtn, { backgroundColor: A.solid, shadowColor: A.glow }]}
            onPress={() => playAllPlaylist(selectedPlaylist)}
            activeOpacity={0.85}
          >
            <Ionicons name="play" size={18} color="#000" />
            <Text style={styles.plxPlayText}>PLAY</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.plxRoundBtn} onPress={() => shufflePlaylist(selectedPlaylist)}>
            <Ionicons name="shuffle" size={19} color={A.solid} />
          </TouchableOpacity>
        </View>

        {findInPlaylistVisible && (
          <TextInput
            value={findInPlaylistQuery}
            onChangeText={setFindInPlaylistQuery}
            placeholder="Find in playlist..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            style={styles.findInPlaylistInput}
            autoFocus
          />
        )}

        {editModeActive && editSelectedIds.size > 0 && (
          <View style={styles.selectionBar}>
            <Text style={styles.selectionBarText}>{editSelectedIds.size} selected</Text>
            <TouchableOpacity style={styles.selectionTrashBtn} onPress={confirmRemoveSelected}>
              <Ionicons name="trash" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderGroupPlaylistDetailHeader = () => {
    if (!selectedGroupPlaylist) return null;
    const art = selectedGroupPlaylist.art ? { uri: selectedGroupPlaylist.art } : null;
    const isOwner = selectedGroupPlaylist.role === "owner";

    return (
      <View style={styles.spotifyHeaderContainer}>
        <View style={styles.spotifyCoverArtWrap}>
          {art ? (
            <Image source={art} style={styles.spotifyCoverArt} />
          ) : (
            <View style={[styles.spotifyCoverArt, styles.spotifyArtPlaceholder]}>
              <Ionicons name="people" size={60} color="rgba(255,255,255,0.4)" />
            </View>
          )}
        </View>

        <Text style={styles.spotifyTitle}>{selectedGroupPlaylist.name}</Text>
        <View style={styles.spotifySourceRow}>
          <View style={styles.spotifyDot} />
          <Text style={styles.spotifySourceText}>
            Group playlist{isOwner ? " - you're the owner" : ""}
          </Text>
        </View>

        <View style={styles.spotifyActionBar}>
          <View style={styles.spotifyLeftActions}>
            <TouchableOpacity
              style={styles.spotifyIconBtn}
              onPress={() => {
                setGroupInfoName(selectedGroupPlaylist.name);
                setGroupInfoArtUri(selectedGroupPlaylist.art || null);
                setGroupInfoVisible(true);
              }}
            >
              <Ionicons name="pencil" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.spotifyMetaInline}>{groupPlaylistTracks.length} tracks</Text>
          </View>

          <View style={styles.spotifyRightActions}>
            <TouchableOpacity
              style={styles.spotifyIconBtn}
              onPress={() => {
                if (groupPlaylistTracks.length > 0 && onTrackPress) {
                  const shuffled = [...groupPlaylistTracks].sort(() => Math.random() - 0.5);
                  onTrackPress(shuffled[0], shuffled);
                }
              }}
            >
              <Ionicons name="shuffle" size={20} color="#1ED760" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.spotifyPlayBtn}
              onPress={() => {
                if (groupPlaylistTracks.length > 0 && onTrackPress) {
                  onTrackPress(groupPlaylistTracks[0], groupPlaylistTracks);
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.spotifyPlayIcon}>▶</Text>
              <Text style={styles.spotifyPlayText}>PLAY</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillBarScroll}
          contentContainerStyle={styles.pillBarRow}
        >
          <TouchableOpacity
            style={styles.pillChip}
            onPress={() => { setGroupAddSelectedIds(new Set()); setGroupAddVisible(true); }}
          >
            <Ionicons name="add" size={14} color="#fff" />
            <Text style={styles.pillChipText}>Add</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pillChip, groupEditModeActive && styles.pillChipActive]}
            onPress={() => { setGroupEditModeActive((p) => !p); setGroupEditSelectedIds(new Set()); }}
          >
            <Ionicons name="create-outline" size={14} color={groupEditModeActive ? "#000" : "#fff"} />
            <Text style={[styles.pillChipText, groupEditModeActive && styles.pillChipTextActive]}>Edit</Text>
          </TouchableOpacity>
        </ScrollView>

        {groupEditModeActive && groupEditSelectedIds.size > 0 && (
          <View style={styles.selectionBar}>
            <Text style={styles.selectionBarText}>{groupEditSelectedIds.size} selected</Text>
            <TouchableOpacity style={styles.selectionTrashBtn} onPress={confirmRemoveGroupSelected} disabled={groupRemoveBusy}>
              <Ionicons name="trash" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const scanHeader = (deniedMsg) => (
    <>
      <TouchableOpacity style={styles.createTile} onPress={runScan} disabled={scanning}>
        <Text style={styles.createTileText}>
          {scanning ? "Scanning..." : "Rescan phone storage (find new files)"}
        </Text>
      </TouchableOpacity>
      {scanDenied && <Text style={styles.emptyText}>{deniedMsg}</Text>}
      {!!scanErrorMsg && <Text style={[styles.emptyText, { color: "#FF6B6B" }]}>{scanErrorMsg}</Text>}
      {!!lastScanCounts && !scanErrorMsg && (
        <Text style={styles.emptyText}>
          Last scan found {lastScanCounts.audio} audio and {lastScanCounts.video} video files on device.
        </Text>
      )}
    </>
  );

  const tabListRef = __useRef(null);
  useEffect(() => {
    const i = TABS.indexOf(activeTab);
    if (i >= 0 && tabListRef.current) {
      try {
        tabListRef.current.scrollToIndex({ index: i, viewPosition: 0.5, animated: true });
      } catch {}
    }
  }, [activeTab]);

  const artistHeroEl = selectedArtist ? (
    <ArtistHero
      artist={selectedArtist}
      tracks={artistTracks}
      onBack={() => closeDetail()}
      onPlay={() => {
        if (artistTracks.length > 0 && onTrackPress) onTrackPress(artistTracks[0], artistTracks);
      }}
      onShuffle={() => {
        if (artistTracks.length === 0 || !onTrackPress) return;
        const q = [...artistTracks];
        for (let i = q.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [q[i], q[j]] = [q[j], q[i]];
        }
        onTrackPress(q[0], q);
      }}
      onSort={() => openSortMenu()}
      onSearch={onSearchPress}
    />
  ) : null;

  const detailMode = !!(selectedFolder || selectedPlaylist || selectedArtist || selectedGroupPlaylist);
  let detailData = [];
  let detailTitle = "";
  let detailEmptyText = "";
  if (selectedFolder) {
    detailData = folderItems;
    detailTitle = selectedFolder.name;
    detailEmptyText = "This folder is empty.";
  } else if (selectedPlaylist) {
    detailData = filteredPlaylistItems;
    detailTitle = selectedPlaylist.name;
    detailEmptyText = "This playlist is empty.";
  } else if (selectedGroupPlaylist) {
    detailData = groupPlaylistTracks;
    detailTitle = selectedGroupPlaylist.name;
    detailEmptyText = "No songs added yet.";
  } else if (selectedArtist) {
    detailData = artistTracks;
    detailTitle = selectedArtist;
    detailEmptyText = "No tracks for this artist.";
  }

  let listData = [];
  let listEmptyText = "";
  let listHeader = null;

  if (activeTab === "Videos") {
    listData = videos;
    listEmptyText = "No videos yet - download some, or scan your phone storage above.";
    listHeader = scanHeader("Storage permission was denied - enable it in your phone's app settings to see local videos here.");
  } else if (activeTab === "All Songs") {
    listData = allSongs;
    listEmptyText = "No songs yet - download some, or scan your phone storage above.";
    listHeader = scanHeader("Storage permission was denied - enable it in your phone's app settings to see local songs here.");
  } else if (activeTab === "Search") {
    listData = searchSongs;
    listEmptyText = "No songs downloaded from Search yet.";
  } else if (activeTab === "Downloads") {
    listData = downloads;
    listEmptyText = "Nothing downloaded yet.";
    const activeList = Array.from(activeDownloads.values());
    if (activeList.length > 0) {
      listHeader = (
        <View style={{ marginBottom: 16 }}>
          {activeList.map((d) => (
            <View key={d.key} style={styles.activeDownloadRow}>
              <Text numberOfLines={1} style={styles.activeDownloadTitle}>{d.title}</Text>
              <View style={styles.activeDownloadTrack}>
                <View style={[styles.activeDownloadFill, { width: `${Math.round(d.progress * 100)}%` }]} />
              </View>
              <View style={styles.activeDownloadFooter}>
                <Text style={styles.activeDownloadPct}>
                  {d.status === "paused" ? "Paused - " : ""}{Math.round(d.progress * 100)}%
                </Text>
                <View style={styles.activeDownloadActions}>
                  {d.status === "paused" ? (
                    <TouchableOpacity onPress={() => resumeDownload(d.key)} style={styles.activeDownloadBtn}>
                      <Text style={styles.activeDownloadBtnText}>Resume</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={() => pauseDownload(d.key)} style={styles.activeDownloadBtn}>
                      <Text style={styles.activeDownloadBtnText}>Pause</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => cancelDownload(d.key)} style={styles.activeDownloadBtn}>
                    <Text style={[styles.activeDownloadBtnText, { color: "#FF6B6B" }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      );
    }
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={GRADIENT_COLORS} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      {selectedPlaylist && (
        <>
          {(() => {
            const bgArt = getPlaylistArt(selectedPlaylist);
            return bgArt ? (
              <Image source={bgArt} blurRadius={40} style={[StyleSheet.absoluteFill, { opacity: 0.55 }]} />
            ) : null;
          })()}
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(8,10,16,0.35)", "rgba(8,10,16,0.88)", "#080A10"]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            pointerEvents="none"
            colors={[plAccent.tint, "transparent"]}
            style={{ position: "absolute", top: 0, left: 0, right: 0, height: 420 }}
          />
        </>
      )}

      <View style={[styles.header, selectedArtist && { display: "none" }]}>
        {detailMode ? (
          <TouchableOpacity onPress={closeDetail} style={styles.backButtonRow} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.backGlyph}>‹</Text>
            {!selectedPlaylist && !selectedGroupPlaylist && <Text style={styles.title} numberOfLines={1}>{detailTitle}</Text>}
          </TouchableOpacity>
        ) : (
          <View>
            <Text style={styles.title}>Your library</Text>
            <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 2 }}>
              {allSongs.length} songs · {videos.length} videos
            </Text>
          </View>
        )}
        <View style={styles.headerActions}>
          {!selectedPlaylist && !selectedGroupPlaylist && (
            <TouchableOpacity style={styles.iconButton} onPress={onSearchPress}>
              <Ionicons name="search" size={17} color="#fff" />
            </TouchableOpacity>
          )}
          {selectedPlaylist && (
            <>
              <TouchableOpacity
                style={styles.iconButtonRound}
                onPress={() => Share.share({ message: `Check out my playlist: ${selectedPlaylist.name}` })}
              >
                <Ionicons name="share-outline" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButtonRound}
                onPress={() => {
                  Alert.alert(selectedPlaylist.name, "Choose an option", [
                    {
                      text: "Edit Playlist",
                      onPress: () => {
                        setEditPlaylistTarget(selectedPlaylist);
                        setEditPlaylistName(selectedPlaylist.name);
                        setEditPlaylistArt(selectedPlaylist.art || "");
                        setEditPlaylistVisible(true);
                      },
                    },
                    {
                      text: "Delete Playlist",
                      style: "destructive",
                      onPress: () => confirmDeletePlaylist(selectedPlaylist),
                    },
                    { text: "Cancel", style: "cancel" },
                  ]);
                }}
              >
                <Ionicons name="ellipsis-vertical" size={16} color="#fff" />
              </TouchableOpacity>
            </>
          )}
          {selectedGroupPlaylist && (
            <>
              <TouchableOpacity
                style={styles.iconButtonRound}
                onPress={() => Share.share({ message: `Check out my group playlist: ${selectedGroupPlaylist.name}` })}
              >
                <Ionicons name="share-outline" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButtonRound}
                onPress={() => {
                  Alert.alert(selectedGroupPlaylist.name, "Choose an option", [
                    {
                      text: "Edit Info",
                      onPress: () => {
                        setGroupInfoName(selectedGroupPlaylist.name);
                        setGroupInfoArtUri(selectedGroupPlaylist.art || null);
                        setGroupInfoVisible(true);
                      },
                    },
                    { text: "Cancel", style: "cancel" },
                  ]);
                }}
              >
                <Ionicons name="ellipsis-vertical" size={16} color="#fff" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {!detailMode && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          ref={tabListRef}
          onScrollToIndexFailed={() => {}}
          contentContainerStyle={{ paddingRight: 20, alignItems: "center" }}
          style={[styles.tabRow, { height: 52 }]}
          data={TABS}
          keyExtractor={(t) => t}
          renderItem={({ item: tab }) => {
            const active = tab === activeTab;
            return (
              <TouchableOpacity
                onPress={() => setActiveTab(tab)}
                style={[
                  styles.tab,
                  active && styles.tabActive,
                  { flexDirection: "row", alignItems: "center", justifyContent: "center", height: 40, paddingVertical: 0 },
                  active && { backgroundColor: LIB_ORCHID, borderColor: LIB_ORCHID },
                ]}
              >
                <Ionicons
                  name={TAB_ICONS[tab] || "ellipse"}
                  size={15}
                  color={active ? "#0B0A0F" : "#fff"}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.tabText, active && styles.tabTextActive, { includeFontPadding: false }]}>{tab}</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {detailMode ? (
        <FlatList
          data={detailData}
          keyExtractor={selectedGroupPlaylist ? (item) => String(item.id) : keyExtractor}
          renderItem={selectedGroupPlaylist ? renderGroupTrackRow : renderTrackRow}
          ListHeaderComponent={
            selectedPlaylist ? renderPlaylistDetailHeader :
            selectedGroupPlaylist ? renderGroupPlaylistDetailHeader : selectedArtist ? artistHeroEl : null
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>{detailEmptyText}</Text>}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews
        />
      ) : (
        <>
          {(activeTab === "Videos" || activeTab === "Downloads") && (
            <FlatList
              data={listData}
              keyExtractor={keyExtractor}
              renderItem={renderTrackRow}
              contentContainerStyle={styles.listContent}
              ListHeaderComponent={listHeader}
              ListEmptyComponent={<Text style={styles.emptyText}>{listEmptyText}</Text>}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              windowSize={7}
              removeClippedSubviews
            />
          )}

          {activeTab === "All Songs" && (
            <FlatList
              data={filteredAllSongs}
              keyExtractor={keyExtractor}
              renderItem={renderAllSongsRow}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
              ListHeaderComponent={
                <>
                  <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                    <TextInput
                      value={songSearchQuery}
                      onChangeText={setSongSearchQuery}
                      placeholder="Find a song..."
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.08)",
                        borderRadius: 10,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        color: "#fff",
                        fontSize: 15,
                      }}
                    />
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      backgroundColor: "rgba(255,255,255,0.06)",
                      borderRadius: 14,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      marginBottom: 12,
                    }}
                  >
                    <Ionicons name="sync" size={18} color={LIB_ORCHID} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#F5F3FA", fontWeight: "700", fontSize: 13 }}>
                        {allSongs.length} local files
                      </Text>
                      <Text
                        style={{ color: scanErrorMsg ? "#FF6B6B" : "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 1 }}
                        numberOfLines={1}
                      >
                        {scanDenied
                          ? "Storage permission denied - enable it in app settings"
                          : scanErrorMsg
                          ? scanErrorMsg
                          : lastScanCounts
                          ? `Last scan: ${lastScanCounts.audio} audio, ${lastScanCounts.video} video`
                          : "Scan your device for new files"}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.asHeroRescanBtn} onPress={runScan} disabled={scanning}>
                      <Text style={styles.asHeroRescanText}>{scanning ? "Scanning..." : "Rescan"}</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => {
                        if (filteredAllSongs.length > 0 && onTrackPress) onTrackPress(filteredAllSongs[0], filteredAllSongs);
                      }}
                      style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: LIB_ORCHID, borderRadius: 22, paddingVertical: 11 }}
                    >
                      <Ionicons name="play" size={16} color="#0B0A0F" />
                      <Text style={{ color: "#0B0A0F", fontWeight: "800", fontSize: 14 }}>Play</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => {
                        if (filteredAllSongs.length === 0 || !onTrackPress) return;
                        const q = [...filteredAllSongs];
                        for (let i = q.length - 1; i > 0; i--) {
                          const j = Math.floor(Math.random() * (i + 1));
                          [q[i], q[j]] = [q[j], q[i]];
                        }
                        onTrackPress(q[0], q);
                      }}
                      style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 22, paddingVertical: 11, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" }}
                    >
                      <Ionicons name="shuffle" size={16} color="#F5F3FA" />
                      <Text style={{ color: "#F5F3FA", fontWeight: "700", fontSize: 14 }}>Shuffle</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.asSectionRow}>
                    <Text style={styles.asSectionLabel}>TRACKS ({allSongs.length})</Text>
                    <View style={styles.asSortRow}>
                      <Text style={styles.asSortText}>Recently Added</Text>
                      <Ionicons name="options-outline" size={14} color={AS_AMBER} />
                    </View>
                  </View>
                </>
              }
              ListEmptyComponent={<Text style={styles.emptyText}>No songs yet - download some, or scan your phone storage above.</Text>}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              windowSize={7}
              removeClippedSubviews
            />
          )}

          {activeTab === "Folders" && (
            <FlatList
              data={folders}
              keyExtractor={(f) => f.id}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
              ListHeaderComponent={
                <TouchableOpacity
                  style={styles.createTile}
                  onPress={() => {
                    setPromptMode("folder");
                    setPromptValue("");
                    setPromptVisible(true);
                  }}
                >
                  <Text style={styles.createTileText}>+ New Folder</Text>
                </TouchableOpacity>
              }
              ListEmptyComponent={
                <Text style={styles.emptyText}>No folders yet — create one to organize anything: songs, videos, or playlists together.</Text>
              }
              renderItem={({ item: f }) => (
                <TouchableOpacity style={styles.folderRow} onPress={() => setSelectedFolder(f)}>
                  <Text style={styles.folderName}>{f.name}</Text>
                  <Text style={styles.folderCount}>{f.itemIds.length} items</Text>
                  <TouchableOpacity onPress={async () => { await deleteFolder(f.id); loadAll(); }}>
                    <Text style={styles.folderDelete}>Delete</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
            />
          )}

          {activeTab === "Playlists" && (
            <FlatList
              key="playlist-grid-2col"
              data={filteredPlaylists}
              keyExtractor={(p) => p.id}
              numColumns={2}
              columnWrapperStyle={styles.tileColumnWrapper}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
              ListHeaderComponent={
                <>
                  <TouchableOpacity
                    style={styles.pl2NewPlaylistCard}
                    onPress={openCreatePlaylistChoice}
                    activeOpacity={0.75}
                  >
                    <View style={styles.pl2NewPlaylistIconWrap}>
                      <Ionicons name="add" size={20} color="#0A0A0A" />
                    </View>
                    <Text style={styles.pl2NewPlaylistText}>New Playlist</Text>
                    <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.pl2AiCard, aiGenerating && { opacity: 0.6 }]}
                    onPress={generateAI}
                    disabled={aiGenerating}
                    activeOpacity={0.8}
                  >
                    <View style={styles.pl2AiGlow} pointerEvents="none" />
                    <View style={styles.pl2AiRow}>
                      <View style={styles.pl2AiIconWrap}>
                        <Ionicons name="sparkles" size={20} color={ACCENT_GREEN} />
                      </View>
                      <View style={styles.pl2AiTextWrap}>
                        <Text style={styles.pl2AiEyebrow}>AI STUDIO</Text>
                        <Text style={styles.pl2AiTitle}>
                          {aiGenerating ? "Generating..." : "Generate Custom Mix"}
                        </Text>
                      </View>
                      <View style={styles.pl2AiChevronBtn}>
                        <Ionicons name="chevron-forward" size={14} color="#fff" />
                      </View>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.pl2SearchBar}>
                    <Ionicons name="search" size={14} color="rgba(255,255,255,0.5)" />
                    <TextInput
                      style={styles.pl2SearchInput}
                      placeholder="Search playlists..."
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      value={playlistSearch}
                      onChangeText={setPlaylistSearch}
                    />
                  </View>

                  <View style={styles.pl2SectionRow}>
                    <Text style={styles.pl2SectionLabel}>YOUR COLLECTIONS</Text>
                    <View style={styles.pl2SectionDot} />
                  </View>
                </>
              }
              ListEmptyComponent={<Text style={styles.emptyText}>No playlists found.</Text>}
              renderItem={({ item: p }) => {
                const art = getPlaylistArt(p);
                return (
                  <TouchableOpacity
                    style={styles.pl2Tile}
                    onPress={async () => {
                      if (p.is_group) {
                        setSelectedGroupPlaylist(p);
                        const cached = groupTracksCacheRef.current[p.id];
                        if (cached) {
                          // Already loaded this playlist before - show it
                          // instantly, no network round-trip.
                          setGroupPlaylistTracks(cached);
                        } else {
                          setGroupTracksLoading(true);
                          try {
                            const tracks = await getGroupPlaylistTracks(p.id);
                            groupTracksCacheRef.current[p.id] = tracks;
                            setGroupPlaylistTracks(tracks);
                          } catch (e) {
                            Alert.alert("Couldn't load playlist", e.message || "Try again shortly.");
                            setSelectedGroupPlaylist(null);
                          } finally {
                            setGroupTracksLoading(false);
                          }
                        }
                      } else {
                        setSelectedPlaylist(p);
                      }
                    }}
                    onLongPress={(evt) => !p.is_group && openPlaylistMenu(evt, p)}
                    delayLongPress={300}
                    activeOpacity={0.85}
                  >
                    <View style={styles.pl2TileCoverWrap}>
                      {art ? (
                        <Image source={art} style={styles.pl2TileArt} />
                      ) : (
                        <View style={[styles.pl2TileArt, styles.pl2TilePlaceholder]}>
                          <Ionicons name="musical-notes" size={30} color="rgba(255,255,255,0.35)" />
                        </View>
                      )}
                      <View style={styles.pl2TilePlayFab}>
                        <Ionicons name="play" size={13} color="#0A0A0A" style={{ marginLeft: 1 }} />
                      </View>
                      {p.is_group && (
                        <View style={styles.groupBadge}>
                          <Ionicons name="people" size={10} color="#000" />
                          <Text style={styles.groupBadgeText}>Group</Text>
                        </View>
                      )}
                    </View>
                    <Text numberOfLines={1} style={styles.pl2TileTitle}>{p.name}</Text>
                    <Text numberOfLines={1} style={styles.pl2TileSub}>
                      {p.is_group ? "Group playlist" : `${p.trackIds ? p.trackIds.length : 0} tracks`}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {activeTab === "Artists" && (
            <FlatList
              data={artistEntries}
              keyExtractor={([artist]) => artist}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
              ListEmptyComponent={<Text style={styles.emptyText}>No artists yet — download some tracks first.</Text>}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              windowSize={7}
              removeClippedSubviews
              renderItem={({ item: [artist, tracks] }) => (
                <LibraryArtistRow
                  artist={artist}
                  tracks={tracks}
                  onPress={() => setSelectedArtist(artist)}
                />
              )}
            />
          )}
        </>
      )}

      <ContextMenuCard
        visible={menuVisible}
        anchor={menuAnchor}
        actions={menuActions}
        onClose={() => setMenuVisible(false)}
      />

      <ContextMenuCard
        visible={playlistMenuVisible}
        anchor={playlistMenuAnchor}
        actions={playlistMenuActions}
        onClose={() => setPlaylistMenuVisible(false)}
      />

      {/* Prompt Modal */}
      <Modal visible={promptVisible} transparent animationType="fade" onRequestClose={() => setPromptVisible(false)}>
        <View style={styles.promptBackdrop}>
          <View style={styles.promptCard}>
            <Text style={styles.promptTitle}>
              {promptMode === "folder" ? "New Folder" : promptMode === "playlist" ? "New Playlist" : "Edit Title"}
            </Text>
            <TextInput
              value={promptValue}
              onChangeText={setPromptValue}
              placeholder="Name"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.promptInput}
              autoFocus
            />
            <View style={styles.promptButtons}>
              <TouchableOpacity onPress={() => setPromptVisible(false)} style={styles.promptButton}>
                <Text style={styles.promptButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={submitPrompt} style={[styles.promptButton, styles.promptButtonPrimary]}>
                <Text style={styles.promptButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add to Playlist Picker */}
      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <TouchableOpacity style={styles.promptBackdrop} activeOpacity={1} onPress={() => setPickerVisible(false)}>
          <View style={styles.promptCard}>
            <Text style={styles.promptTitle}>Add to Playlist</Text>
            {playlists.length === 0 ? (
              <Text style={styles.emptyText}>No playlists yet — create one first.</Text>
            ) : (
              playlists.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.pickerRow}
                  onPress={async () => {
                    if (pickerTarget) await addTrackToPlaylist(p.id, pickerTarget.id);
                    setPickerVisible(false);
                    loadAll();
                  }}
                >
                  <Text style={styles.pickerRowText}>{p.name}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add to Folder Picker */}
      <Modal visible={folderPickerVisible} transparent animationType="fade" onRequestClose={() => setFolderPickerVisible(false)}>
        <TouchableOpacity style={styles.promptBackdrop} activeOpacity={1} onPress={() => setFolderPickerVisible(false)}>
          <View style={styles.promptCard}>
            <Text style={styles.promptTitle}>Add to Folder</Text>
            {folders.length === 0 ? (
              <Text style={styles.emptyText}>No folders yet — create one first.</Text>
            ) : (
              folders.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={styles.pickerRow}
                  onPress={async () => {
                    if (folderPickerTarget) await addItemToFolder(f.id, folderPickerTarget.id);
                    setFolderPickerVisible(false);
                    loadAll();
                  }}
                >
                  <Text style={styles.pickerRowText}>{f.name}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Playlist Modal */}
      <Modal visible={editPlaylistVisible} transparent animationType="fade" onRequestClose={() => setEditPlaylistVisible(false)}>
        <View style={styles.promptBackdrop}>
          <View style={styles.promptCard}>
            <Text style={styles.promptTitle}>Edit Playlist</Text>
            <Text style={styles.editPlaylistLabel}>Playlist Name</Text>
            <TextInput
              value={editPlaylistName}
              onChangeText={setEditPlaylistName}
              placeholder="Name"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.promptInput}
            />
            <Text style={styles.editPlaylistLabel}>Cover Image</Text>
            <TouchableOpacity
              style={styles.imagePickButton}
              onPress={async () => {
                const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (!perm.granted) {
                  Alert.alert("Permission needed", "Allow photo access to choose a playlist image.");
                  return;
                }
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  quality: 0.7,
                  allowsEditing: true,
                  aspect: [1, 1],
                });
                if (!result.canceled && result.assets?.[0]?.uri) {
                  setEditPlaylistArt(result.assets[0].uri);
                }
              }}
            >
              {editPlaylistArt ? (
                <Image source={{ uri: editPlaylistArt }} style={styles.imagePickPreview} />
              ) : (
                <Ionicons name="image-outline" size={22} color="rgba(255,255,255,0.5)" />
              )}
              <Text style={styles.imagePickText}>{editPlaylistArt ? "Change Image" : "Choose Image"}</Text>
            </TouchableOpacity>
            <View style={styles.promptButtons}>
              <TouchableOpacity onPress={() => setEditPlaylistVisible(false)} style={styles.promptButton}>
                <Text style={styles.promptButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (editPlaylistTarget) {
                    await updatePlaylist(editPlaylistTarget.id, {
                      name: editPlaylistName.trim() || editPlaylistTarget.name,
                      art: editPlaylistArt.trim() || null,
                    });
                    loadAll();
                  }
                  setEditPlaylistVisible(false);
                }}
                style={[styles.promptButton, styles.promptButtonPrimary]}
              >
                <Text style={styles.promptButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add songs to a Group Playlist - only tracks with a source_url can
          be shared, since that's what other members' devices re-fetch from */}
      <Modal visible={groupAddVisible} transparent animationType="fade" onRequestClose={() => setGroupAddVisible(false)}>
        <View style={styles.promptBackdrop}>
          <View style={[styles.promptCard, { maxHeight: "70%" }]}>
            <Text style={styles.promptTitle}>Add Songs</Text>
            <FlatList
              data={groupAddCandidates}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const checked = groupAddSelectedIds.has(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.addSongRow, item.__alreadyAdded && styles.addSongRowDisabled]}
                    disabled={item.__alreadyAdded}
                    onPress={() => {
                      setGroupAddSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      });
                    }}
                  >
                    <View style={[styles.editCheckbox, checked && styles.editCheckboxChecked]}>
                      {checked && <Ionicons name="checkmark" size={14} color="#000" />}
                    </View>
                    <Text numberOfLines={1} style={[styles.addSongTitle, item.__alreadyAdded && styles.addSongTitleDisabled]}>
                      {item.title}{item.__alreadyAdded ? " (already added)" : ""}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  No shareable songs yet - only songs downloaded from Search can be added to group playlists.
                </Text>
              }
            />
            <View style={styles.promptButtons}>
              <TouchableOpacity onPress={() => setGroupAddVisible(false)} style={styles.promptButton}>
                <Text style={styles.promptButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitGroupAddSongs}
                disabled={groupAddBusy}
                style={[styles.promptButton, styles.promptButtonPrimary, groupAddBusy && { opacity: 0.6 }]}
              >
                <Text style={styles.promptButtonText}>{groupAddBusy ? "Adding..." : "Add"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Group Playlist info - name + image picker (no URL entry) */}
      <Modal visible={groupInfoVisible} transparent animationType="fade" onRequestClose={() => setGroupInfoVisible(false)}>
        <View style={styles.promptBackdrop}>
          <View style={styles.promptCard}>
            <Text style={styles.promptTitle}>Edit Playlist</Text>
            <Text style={styles.editPlaylistLabel}>Playlist Name</Text>
            <TextInput
              value={groupInfoName}
              onChangeText={setGroupInfoName}
              placeholder="Name"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.promptInput}
            />
            <Text style={styles.editPlaylistLabel}>Cover Image</Text>
            <TouchableOpacity style={styles.imagePickButton} onPress={pickGroupArtImage}>
              {groupInfoArtUri ? (
                <Image source={{ uri: groupInfoArtUri }} style={styles.imagePickPreview} />
              ) : (
                <Ionicons name="image-outline" size={22} color="rgba(255,255,255,0.5)" />
              )}
              <Text style={styles.imagePickText}>{groupInfoArtUri ? "Change Image" : "Choose Image"}</Text>
            </TouchableOpacity>
            <View style={styles.promptButtons}>
              <TouchableOpacity onPress={() => setGroupInfoVisible(false)} style={styles.promptButton}>
                <Text style={styles.promptButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitGroupInfo}
                disabled={groupInfoSaving}
                style={[styles.promptButton, styles.promptButtonPrimary, groupInfoSaving && { opacity: 0.6 }]}
              >
                <Text style={styles.promptButtonText}>{groupInfoSaving ? "Saving..." : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* New Playlist: Personal vs Group choice */}
      <Modal visible={createChoiceVisible} transparent animationType="fade" onRequestClose={() => setCreateChoiceVisible(false)}>
        <TouchableOpacity style={styles.promptBackdrop} activeOpacity={1} onPress={() => setCreateChoiceVisible(false)}>
          <View style={styles.promptCard}>
            <Text style={styles.promptTitle}>New Playlist</Text>
            <TouchableOpacity style={styles.choiceRow} onPress={choosePersonalPlaylist}>
              <View style={styles.choiceIconWrap}>
                <Ionicons name="person" size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.choiceTitle}>Personal</Text>
                <Text style={styles.choiceSub}>Just for you, stored on this device</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.choiceRow} onPress={chooseGroupPlaylist}>
              <View style={[styles.choiceIconWrap, { backgroundColor: "rgba(30,215,96,0.15)" }]}>
                <Ionicons name="people" size={18} color="#1ED760" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.choiceTitle}>Group</Text>
                <Text style={styles.choiceSub}>Share with friends - everyone can add songs</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.promptButtons}>
              <TouchableOpacity onPress={() => setCreateChoiceVisible(false)} style={styles.promptButton}>
                <Text style={styles.promptButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Group Playlist creation: name, then friend picker */}
      <Modal visible={groupCreateVisible} transparent animationType="fade" onRequestClose={() => setGroupCreateVisible(false)}>
        <View style={styles.promptBackdrop}>
          <View style={[styles.promptCard, { maxHeight: "75%" }]}>
            {groupCreateStep === "name" ? (
              <>
                <Text style={styles.promptTitle}>Name your group playlist</Text>
                <TextInput
                  value={groupName}
                  onChangeText={setGroupName}
                  placeholder="Playlist name"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  style={styles.promptInput}
                  autoFocus
                />
                <View style={styles.promptButtons}>
                  <TouchableOpacity onPress={() => setGroupCreateVisible(false)} style={styles.promptButton}>
                    <Text style={styles.promptButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => groupName.trim() && setGroupCreateStep("friends")}
                    style={[styles.promptButton, styles.promptButtonPrimary]}
                  >
                    <Text style={styles.promptButtonText}>Next</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.promptTitle}>Add friends (optional)</Text>
                {groupFriendsLoading ? (
                  <Text style={styles.emptyText}>Loading friends...</Text>
                ) : (
                  <FlatList
                    data={groupFriends}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={({ item }) => {
                      const checked = groupSelectedFriendIds.has(item.id);
                      return (
                        <TouchableOpacity
                          style={styles.addSongRow}
                          onPress={() => {
                            setGroupSelectedFriendIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              return next;
                            });
                          }}
                        >
                          <View style={[styles.editCheckbox, checked && styles.editCheckboxChecked]}>
                            {checked && <Ionicons name="checkmark" size={14} color="#000" />}
                          </View>
                          <Text style={styles.addSongTitle}>{item.username}</Text>
                        </TouchableOpacity>
                      );
                    }}
                    ListEmptyComponent={<Text style={styles.emptyText}>No friends yet - you can still create the playlist and add friends later.</Text>}
                  />
                )}
                <View style={styles.promptButtons}>
                  <TouchableOpacity onPress={() => setGroupCreateStep("name")} style={styles.promptButton}>
                    <Text style={styles.promptButtonText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={submitGroupPlaylist}
                    disabled={groupCreating}
                    style={[styles.promptButton, styles.promptButtonPrimary, groupCreating && { opacity: 0.6 }]}
                  >
                    <Text style={styles.promptButtonText}>{groupCreating ? "Creating..." : "Create"}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Add Songs to Playlist Picker */}
      <Modal visible={addSongsVisible} transparent animationType="fade" onRequestClose={() => setAddSongsVisible(false)}>
        <View style={styles.promptBackdrop}>
          <View style={[styles.promptCard, { maxHeight: "70%" }]}>
            <Text style={styles.promptTitle}>Add Songs</Text>
            <FlatList
              data={addSongsCandidates}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const checked = addSongsSelectedIds.has(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.addSongRow, item.__alreadyAdded && styles.addSongRowDisabled]}
                    disabled={item.__alreadyAdded}
                    onPress={() => {
                      setAddSongsSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      });
                    }}
                  >
                    <View style={[styles.editCheckbox, checked && styles.editCheckboxChecked]}>
                      {checked && <Ionicons name="checkmark" size={14} color="#000" />}
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[styles.addSongTitle, item.__alreadyAdded && styles.addSongTitleDisabled]}
                    >
                      {item.title}{item.__alreadyAdded ? " (already added)" : ""}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text style={styles.emptyText}>No songs in your library yet.</Text>}
            />
            <View style={styles.promptButtons}>
              <TouchableOpacity onPress={() => setAddSongsVisible(false)} style={styles.promptButton}>
                <Text style={styles.promptButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (selectedPlaylist) {
                    for (const id of addSongsSelectedIds) {
                      await addTrackToPlaylist(selectedPlaylist.id, id);
                    }
                  }
                  setAddSongsVisible(false);
                  loadAll();
                }}
                style={[styles.promptButton, styles.promptButtonPrimary]}
              >
                <Text style={styles.promptButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ImageViewer
        visible={imageViewerVisible}
        images={imageViewerItems}
        initialIndex={imageViewerIndex}
        onClose={() => setImageViewerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#121212" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 14,
  },
  title: { color: "#fff", fontSize: 22, fontWeight: "700" },
  backButtonRow: { flexDirection: "row", alignItems: "center", flex: 1, marginRight: 12, gap: 6 },
  backGlyph: { color: "#fff", fontSize: 28, fontWeight: "700" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: {
    paddingHorizontal: 14, height: 40, borderRadius: 20, backgroundColor: GLASS_BG,
    borderWidth: 1, borderColor: GLASS_BORDER, justifyContent: "center", alignItems: "center",
  },
  iconGlyph: { color: "#fff", fontSize: 13, fontWeight: "600" },

  tabRow: { paddingLeft: 20, marginBottom: 14, flexGrow: 0 },
  tab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: GLASS_BG,
    borderWidth: 1, borderColor: GLASS_BORDER, marginRight: 10,
  },
  tabActive: { backgroundColor: "#FFFFFF" },
  tabText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  tabTextActive: { color: "#000000" },

  listContent: { paddingHorizontal: 20, paddingBottom: 150 },

  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  rowArt: { width: 48, height: 48, borderRadius: 4, backgroundColor: GLASS_BG, marginRight: 12 },
  rowTextWrap: { flex: 1, marginRight: 10 },
  rowTitle: { color: "#fff", fontWeight: "600", fontSize: 14 },
  rowArtist: { color: "#B3B3B3", fontSize: 12, marginTop: 2 },
  rowDuration: { color: "#B3B3B3", fontSize: 12 },

  createTile: {
    backgroundColor: GLASS_BG, borderWidth: 1, borderColor: GLASS_BORDER, borderRadius: 14,
    paddingVertical: 14, alignItems: "center", marginBottom: 16, width: "100%",
  },
  createTileText: { color: "#fff", fontWeight: "700" },

  folderRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: GLASS_BG, borderWidth: 1, borderColor: GLASS_BORDER, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: 10,
  },
  folderName: { color: "#fff", fontWeight: "600", fontSize: 14, flex: 1 },
  folderCount: { color: "#B3B3B3", fontSize: 12, marginRight: 12 },
  folderDelete: { color: "#FF6B6B", fontSize: 12, fontWeight: "600" },

  /* Playlist Grid Tiles Layout */
  tileColumnWrapper: {
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  playlistTile: {
    flex: 1,
    maxWidth: "48%",
  },
  playlistTileCoverWrap: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginBottom: 8,
  },
  playlistTileArt: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },
  playlistTileTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 2,
  },
  playlistTileSub: {
    color: "#B3B3B3",
    fontSize: 12,
  },

  emptyText: { color: "#B3B3B3", textAlign: "center", marginTop: 30, lineHeight: 20 },

  /* Playlist detail restyle (plx) */
  plxHeader: { paddingTop: 6, paddingBottom: 14 },
  plxCoverWrap: {
    alignSelf: "center", width: 200, height: 200, borderRadius: 20, borderWidth: 1.5,
    marginBottom: 20, backgroundColor: "#000",
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 22, elevation: 18,
  },
  plxCover: { width: "100%", height: "100%", borderRadius: 18 },
  plxPlaceholder: { justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)" },
  plxTitle: { color: "#fff", fontSize: 30, fontWeight: "900", letterSpacing: 0.3 },
  plxSourceRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  plxDot: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  plxSourceText: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "600" },
  plxMeta: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "600", marginTop: 3 },
  plxActionRow: { flexDirection: "row", alignItems: "center", marginTop: 18, gap: 7 },
  plxRoundBtn: {
    width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)",
  },
  plxPlayBtn: {
    flex: 1, height: 44, borderRadius: 22, flexDirection: "row", justifyContent: "center",
    alignItems: "center", gap: 6, marginLeft: 3,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 14, elevation: 10,
  },
  plxPlayText: { color: "#000", fontSize: 14, fontWeight: "800", letterSpacing: 1 },
  plxRow: { paddingHorizontal: 10, borderRadius: 16, marginBottom: 4, borderWidth: 1, borderColor: "transparent" },
  plxBar: { position: "absolute", left: 0, top: 12, bottom: 12, width: 3, borderRadius: 2 },
  plxMore: { padding: 6, marginLeft: 4 },

  /* Spotify Playlist Hero View */
  spotifyHeaderContainer: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 20,
  },
  spotifyCoverArtWrap: {
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  spotifyCoverArt: {
    width: 200,
    height: 200,
    borderRadius: 12,
    backgroundColor: GLASS_BG,
  },
  spotifyArtPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  spotifyTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  spotifySourceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  spotifyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#1ED760",
    marginRight: 6,
  },
  spotifySourceText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#B3B3B3",
  },
  spotifyMeta: {
    fontSize: 12,
    color: "#B3B3B3",
    marginTop: 4,
  },

  /* Action Controls Bar */
  spotifyActionBar: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 22,
    paddingHorizontal: 4,
  },
  spotifyLeftActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  spotifyRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  spotifyIconBtn: {
    padding: 6,
  },
  spotifyIconTxt: {
    color: "#FFFFFF",
    fontSize: 20,
  },

  /* Primary Action Play Button (Follow-style slot) */
  spotifyPlayBtn: {
    flexDirection: "row",
    height: 44,
    paddingHorizontal: 22,
    borderRadius: 22,
    backgroundColor: "#1ED760",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  spotifyPlayIcon: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "bold",
  },
  spotifyPlayText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  /* Playlist Search Bar */
  playlistSearchBar: {
    flexDirection: "row", alignItems: "center", backgroundColor: GLASS_BG,
    borderWidth: 1, borderColor: GLASS_BORDER, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14, width: "100%",
  },
  playlistSearchIcon: { fontSize: 14, marginRight: 8 },
  playlistSearchInput: { flex: 1, color: "#fff", fontSize: 14 },

  /* Active Downloads */
  activeDownloadRow: {
    backgroundColor: GLASS_BG, borderWidth: 1, borderColor: GLASS_BORDER, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8,
  },
  activeDownloadTitle: { color: "#fff", fontSize: 13, fontWeight: "600", marginBottom: 6 },
  activeDownloadTrack: { height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)" },
  activeDownloadFill: { height: 4, borderRadius: 2, backgroundColor: "#1ED760" },
  activeDownloadPct: { color: "#B3B3B3", fontSize: 10 },
  activeDownloadFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  activeDownloadActions: { flexDirection: "row", gap: 10 },
  activeDownloadBtn: { paddingVertical: 2, paddingHorizontal: 4 },
  activeDownloadBtnText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  /* Modals */
  promptBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
  promptCard: {
    width: 280, backgroundColor: "#181818", borderRadius: 18, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)", padding: 20,
  },
  promptTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 14 },
  editPlaylistLabel: { color: "#B3B3B3", fontSize: 12, fontWeight: "600", marginBottom: 4 },
  promptInput: {
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, color: "#fff", marginBottom: 14,
  },
  promptButtons: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  promptButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  promptButtonPrimary: { backgroundColor: "#1ED760" },
  promptButtonText: { color: "#fff", fontWeight: "600" },

  pickerRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
  pickerRowText: { color: "#fff", fontSize: 15 },

  /* Playlist Tab Redesign v2 - Neon Green Glass */
  pl2NewPlaylistCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: PL_GLASS_BG,
    borderWidth: 1, borderColor: PL_GLASS_BORDER, borderRadius: 20,
    paddingVertical: 14, paddingHorizontal: 16, marginBottom: 12, gap: 12,
  },
  pl2NewPlaylistIconWrap: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: ACCENT_GREEN,
    justifyContent: "center", alignItems: "center",
  },
  pl2NewPlaylistText: { flex: 1, color: "#fff", fontWeight: "700", fontSize: 14 },

  pl2AiCard: {
    backgroundColor: PL_GLASS_BG, borderWidth: 1, borderColor: PL_GLASS_BORDER,
    borderRadius: 22, padding: 14, marginBottom: 14, overflow: "hidden",
  },
  pl2AiGlow: {
    position: "absolute", right: -30, bottom: -30, width: 110, height: 110,
    borderRadius: 55, backgroundColor: ACCENT_GREEN, opacity: 0.18,
  },
  pl2AiRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  pl2AiIconWrap: {
    width: 42, height: 42, borderRadius: 16, backgroundColor: ACCENT_GREEN_SOFT,
    borderWidth: 1, borderColor: ACCENT_GREEN_BORDER, justifyContent: "center", alignItems: "center",
  },
  pl2AiTextWrap: { flex: 1 },
  pl2AiEyebrow: { color: ACCENT_GREEN, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 2 },
  pl2AiTitle: { color: "#fff", fontSize: 13, fontWeight: "700" },
  pl2AiChevronBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center", alignItems: "center",
  },

  pl2SearchBar: {
    flexDirection: "row", alignItems: "center", backgroundColor: PL_GLASS_BG,
    borderWidth: 1, borderColor: PL_GLASS_BORDER, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 9, marginBottom: 16, gap: 8,
  },
  pl2SearchInput: { flex: 1, color: "#fff", fontSize: 13 },

  pl2SectionRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12,
  },
  pl2SectionLabel: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  pl2SectionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT_GREEN },

  pl2Tile: { flex: 1, maxWidth: "48%" },
  pl2TileCoverWrap: {
    width: "100%", aspectRatio: 1, borderRadius: 20, overflow: "hidden",
    backgroundColor: PL_DARK_GRAY, borderWidth: 1, borderColor: PL_GLASS_BORDER, marginBottom: 8,
  },
  pl2TileArt: { width: "100%", height: "100%" },
  pl2TilePlaceholder: { justifyContent: "center", alignItems: "center" },
  pl2TilePlayFab: {
    position: "absolute", right: 8, bottom: 8, width: 30, height: 30, borderRadius: 15,
    backgroundColor: ACCENT_GREEN, justifyContent: "center", alignItems: "center",
    shadowColor: ACCENT_GREEN, shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  pl2TileTitle: { color: "#fff", fontWeight: "700", fontSize: 13, marginBottom: 2 },
  pl2TileSub: { color: "rgba(255,255,255,0.5)", fontSize: 11 },

  /* All Songs Tab Redesign - Revolve Amber/Gold Glass */
  asHeroCard: {
    backgroundColor: AS_GLASS_BG, borderWidth: 1, borderColor: AS_GLASS_BORDER, borderRadius: 20,
    padding: 16, marginBottom: 18, overflow: "hidden",
  },
  asHeroGlow: {
    position: "absolute", right: -30, bottom: -30, width: 120, height: 120, borderRadius: 60,
    backgroundColor: AS_AMBER, opacity: 0.14,
  },
  asHeroTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  asHeroLeftRow: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, marginRight: 10 },
  asHeroIconWrap: {
    width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(245,166,35,0.14)",
    borderWidth: 1, borderColor: "rgba(245,166,35,0.3)", justifyContent: "center", alignItems: "center",
  },
  asHeroTitle: { color: "#fff", fontWeight: "700", fontSize: 14 },
  asHeroSubtitle: { color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 1 },
  asHeroBadge: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,255,136,0.1)",
    borderWidth: 1, borderColor: "rgba(0,255,136,0.25)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  asHeroBadgeDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: AS_NEON },
  asHeroBadgeText: { color: AS_NEON, fontSize: 10, fontWeight: "700" },
  asHeroBottomRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)",
  },
  asHeroStatsText: { color: "rgba(255,255,255,0.55)", fontSize: 11, lineHeight: 15 },
  asHeroRescanBtn: { backgroundColor: AS_AMBER, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  asHeroRescanText: { color: "#0A0A0A", fontWeight: "800", fontSize: 11, letterSpacing: 0.3 },

  asSectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  asSectionLabel: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  asSortRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  asSortText: { color: AS_AMBER, fontSize: 12, fontWeight: "600" },

  asRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: AS_GLASS_BG,
    borderWidth: 1, borderColor: AS_GLASS_BORDER, borderRadius: 16, padding: 10, marginBottom: 10,
  },
  asRowActive: { backgroundColor: AS_ACTIVE_BG, borderColor: AS_ACTIVE_BORDER },
  asRowArtWrap: { width: 48, height: 48, borderRadius: 12, overflow: "hidden", marginRight: 12 },
  asRowArtWrapActive: { borderWidth: 1, borderColor: "rgba(245,166,35,0.5)" },
  asRowArt: { width: "100%", height: "100%" },
  asRowArtPlaceholder: { backgroundColor: "#1C1C20", justifyContent: "center", alignItems: "center" },
  asRowEqOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 2,
  },
  asEqBar: { width: 3, borderRadius: 2, backgroundColor: AS_AMBER },
  asRowTextWrap: { flex: 1, marginRight: 8 },
  asRowTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  asRowTitle: { color: "#fff", fontWeight: "700", fontSize: 13.5, flexShrink: 1 },
  asNowBadge: {
    backgroundColor: "rgba(245,166,35,0.18)", borderWidth: 1, borderColor: "rgba(245,166,35,0.35)",
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
  },
  asNowBadgeText: { color: AS_AMBER, fontSize: 8.5, fontWeight: "800", letterSpacing: 0.5 },
  asRowArtist: { color: "rgba(255,255,255,0.5)", fontSize: 11.5, marginTop: 2 },
  asRowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  asRowDuration: { color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "600" },
  asRowDurationActive: { color: AS_AMBER },
  asRowMoreBtn: { padding: 4 },

  /* Playlist detail: pill bar, checkboxes, find/edit UI */
  pillBarScroll: { width: "100%", marginTop: 18 },
  pillBarRow: { flexDirection: "row", gap: 8, paddingRight: 16 },
  iconButtonRound: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: GLASS_BG,
    borderWidth: 1, borderColor: GLASS_BORDER, justifyContent: "center", alignItems: "center",
  },
  spotifyMetaInline: { color: "#B3B3B3", fontSize: 12, fontWeight: "600" },
  pillChip: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
  },
  pillChipActive: { backgroundColor: "#1ED760", borderColor: "#1ED760" },
  pillChipText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  pillChipTextActive: { color: "#000" },
  findInPlaylistInput: {
    backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9,
    color: "#fff", fontSize: 14, marginTop: 12, width: "100%",
  },
  selectionBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "rgba(255,107,107,0.12)", borderWidth: 1, borderColor: "rgba(255,107,107,0.3)",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 12, width: "100%",
  },
  selectionBarText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  selectionTrashBtn: {
    backgroundColor: "#FF6B6B", width: 30, height: 30, borderRadius: 15, justifyContent: "center", alignItems: "center",
  },
  editCheckbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: "rgba(255,255,255,0.4)",
    justifyContent: "center", alignItems: "center", marginRight: 12,
  },
  editCheckboxChecked: { backgroundColor: "#1ED760", borderColor: "#1ED760" },
  addSongRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  addSongRowDisabled: { opacity: 0.4 },
  addSongTitle: { color: "#fff", fontSize: 14, flex: 1 },
  addSongTitleDisabled: { color: "#B3B3B3" },

  choiceRow: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)",
  },
  choiceIconWrap: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center", alignItems: "center",
  },
  choiceTitle: { color: "#fff", fontWeight: "700", fontSize: 15 },
  choiceSub: { color: "#B3B3B3", fontSize: 12, marginTop: 2 },
  groupBadge: {
    position: "absolute", left: 8, top: 8, flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#1ED760", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3,
  },
  groupBadgeText: { color: "#000", fontSize: 9, fontWeight: "800" },
  imagePickButton: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14,
  },
  imagePickPreview: { width: 40, height: 40, borderRadius: 8 },
  imagePickText: { color: "#fff", fontSize: 13, fontWeight: "600" },
});
