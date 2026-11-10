// ---------------------------------------------------------------------------
// ShareThreadScreen — full share history with ONE friend, both directions
// (what they sent you + what you sent them), oldest first. Reached by
// tapping a friend row in InboxScreen.js.
//
// Expects route.params = { friend } where friend is the object InboxScreen
// already has (id, username, handle, avatar_letter, avatar_url).
//
// SEEN behavior mirrors SharedInboxScreen: unseen ids (received, seen=0)
// are snapshotted at fetch time for the dot/highlight, then marked seen
// on unmount - not on mount - so nothing disappears before you've looked.
// ---------------------------------------------------------------------------

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getCurrentUser, getShareThread, markSharesSeen, sendShare } from "../services/shareClient";
import { getDownloads } from "../data/libraryStorage";
import { Animated as ShareAnim, ActivityIndicator as ShareSpinner } from "react-native";
import { useDownloads as useShareDownloads } from "../context/DownloadsContext";
import { getSharedSong, findSharedInLibrary } from "../services/shareDownload";
import SelectItemSheet from "../components/SelectItemSheet";

const AMBER = "#E8A662";
const BG = "#0B0B0D";
const CARD_BG = "rgba(255,255,255,0.06)";
const BORDER = "rgba(255,255,255,0.10)";
const UNSEEN_DOT = "#3AA76D";

function Avatar({ letter, url, size = 36 }) {
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View
      style={[
        styles.avatarFallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={styles.avatarLetter}>{(letter || "?").toUpperCase()}</Text>
    </View>
  );
}

function TrackThumb({ url, size = 48 }) {
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: 8 }}
      />
    );
  }
  return (
    <View style={[styles.thumbFallback, { width: size, height: size }]}>
      <Ionicons name="musical-notes" size={20} color="#6A6A6E" />
    </View>
  );
}

function timeAgo(unixSeconds) {
  if (!unixSeconds) return "";
  const diffMs = Date.now() - unixSeconds * 1000;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(unixSeconds * 1000).toLocaleDateString();
}

function ShareDlCard({ stage, pct }) {
  const a = useRef(new ShareAnim.Value(0)).current;
  useEffect(() => {
    ShareAnim.timing(a, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [a]);
  const label = stage === "searching" ? "Finding the song…" : stage === "preparing" ? "Preparing…" : "Downloading";
  const p = Math.round((pct || 0) * 100);
  return (
    <ShareAnim.View
      style={{
        opacity: a,
        transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
        backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
        borderRadius: 14, padding: 12, marginTop: -4, marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>{label}</Text>
        <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>{stage === "downloading" ? p + "%" : ""}</Text>
      </View>
      <View style={{ height: 5, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 3, marginTop: 9, overflow: "hidden" }}>
        <View style={{ height: "100%", width: (stage === "downloading" ? p : 0) + "%", backgroundColor: "#FF6B6B", borderRadius: 3 }} />
      </View>
    </ShareAnim.View>
  );
}

function ThreadRow({ item, isUnseen, onPress, onGet, getState, saved }) {
  const meta = item.item_meta || {};
  const sent = item.direction === "sent";
  const busy = !!getState && getState.stage !== "error";
  return (
    <View>
    <TouchableOpacity style={styles.row} onPress={() => onPress(item)}>
      <TrackThumb url={meta.artwork_url} />

      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.trackTitle} numberOfLines={1}>
          {meta.title || item.item_id}
        </Text>
        {!!meta.artist && (
          <Text style={styles.trackArtist} numberOfLines={1}>
            {meta.artist}
          </Text>
        )}
        {!!meta.message && (
          <Text style={styles.messageText} numberOfLines={2}>
            {meta.message}
          </Text>
        )}
        <Text style={[styles.directionText, sent ? styles.sentText : styles.receivedText]}>
          {sent ? "You sent" : "They sent"} · {timeAgo(item.created_at)}
        </Text>
      </View>

      {isUnseen && <View style={styles.unseenDot} />}

      {!sent && (
        <TouchableOpacity
          onPress={() => onGet(item)}
          disabled={busy || saved}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            width: 38, height: 38, borderRadius: 19, marginLeft: 8,
            backgroundColor: saved ? "#2E9E5B" : "#FF6B6B",
            alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? (
            <ShareSpinner color="#fff" size="small" />
          ) : (
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>{saved ? "✓" : "↓"}</Text>
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
    {busy && <ShareDlCard stage={getState.stage} pct={getState.pct} />}
    {!!getState && getState.stage === "error" && (
      <Text style={{ color: "#FF8A8A", fontSize: 12, marginBottom: 10, marginLeft: 4 }}>
        Could not get that song. Tap the arrow to try again.
      </Text>
    )}
    </View>
  );
}

export default function ShareThreadScreen({ friend = {}, onBack, onTrackPress }) {
  const [user, setUser] = useState(null);
  const [thread, setThread] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const unseenIdsRef = useRef(new Set());
  const dlHooks = useShareDownloads();
  const [getStates, setGetStates] = useState({}); // share id -> { stage, pct }
  const [savedIds, setSavedIds] = useState(() => new Set());

  const loadThread = useCallback(async (userId, friendId) => {
    try {
      const list = await getShareThread(userId, friendId, { app: "music" });
      unseenIdsRef.current = new Set(
        list.filter((s) => s.direction === "received" && !s.seen).map((s) => s.id)
      );
      setThread(list);
    } catch (e) {
      console.warn("Failed to load share thread:", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      setUser(u);
      if (u?.id && friend?.id) await loadThread(u.id, friend.id);
      else setLoading(false);
    })();
  }, [loadThread, friend?.id]);

  useEffect(() => {
    return () => {
      const ids = Array.from(unseenIdsRef.current);
      if (ids.length && user?.id) {
        markSharesSeen(user.id, ids).catch((e) =>
          console.warn("Failed to mark shares seen:", e.message)
        );
      }
    };
  }, [user?.id]);

  const handleRefresh = () => {
    if (!user?.id || !friend?.id) return;
    setRefreshing(true);
    loadThread(user.id, friend.id);
  };

  const handlePress = (item) => {
    onTrackPress?.(item);
  };

  // Mark songs that are already in the library so they show a green tick
  useEffect(() => {
    let alive = true;
    (async () => {
      const next = new Set();
      for (const it of thread) {
        if (it.direction === "sent") continue;
        const m = it.item_meta || {};
        if (m.title && (await findSharedInLibrary({ title: m.title, artist: m.artist }))) next.add(it.id);
      }
      if (alive) setSavedIds(next);
    })();
    return () => { alive = false; };
  }, [thread]);

  const handleGet = useCallback(async (item) => {
    const m = item.item_meta || {};
    if (!m.title) return;
    const st = getStates[item.id];
    if (savedIds.has(item.id) || (st && st.stage !== "error")) return;
    setGetStates((p) => ({ ...p, [item.id]: { stage: "searching", pct: 0 } }));
    try {
      await getSharedSong(m, {
        hooks: dlHooks,
        onStatus: (stage, pct) => setGetStates((p) => ({ ...p, [item.id]: { stage, pct } })),
      });
      setSavedIds((p) => new Set(p).add(item.id));
      setGetStates((p) => { const n = { ...p }; delete n[item.id]; return n; });
    } catch (e) {
      setGetStates((p) => ({ ...p, [item.id]: { stage: "error", pct: 0 } }));
    }
  }, [getStates, savedIds, dlHooks]);

  // Pulls the user's own downloaded audio/video for the share picker.
  // Device-scanned local files aren't included - a friend can't resolve
  // an item_id that only exists on this phone.
  const fetchTracks = useCallback(async () => {
    const downloads = await getDownloads();
    return downloads
      .filter((d) => d.type === "audio")
      .map((d) => ({ id: d.id, title: d.title, artist: d.artist, artwork_url: d.artwork, source_url: d.source_url || null, duration: d.duration || 0 }));
  }, []);

  const fetchVideos = useCallback(async () => {
    const downloads = await getDownloads();
    return downloads
      .filter((d) => d.type === "video")
      .map((d) => ({ id: d.id, title: d.title, artist: d.artist, artwork_url: d.artwork, source_url: d.source_url || null, duration: d.duration || 0 }));
  }, []);

  const handleSendShare = useCallback(
    async (item, message) => {
      if (!user?.id || !friend?.id) return;
      await sendShare(
        user.id,
        friend.id,
        {
          item_type: item.__kind === "video" ? "video" : "track",
          item_id: item.id,
          item_meta: { title: item.title, artist: item.artist, artwork_url: item.artwork_url, source_url: item.source_url || null, duration: item.duration || 0 },
        },
        message
      );
      await loadThread(user.id, friend.id);
    },
    [user?.id, friend?.id, loadThread]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginRight: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
        )}
        <Avatar letter={friend.avatar_letter} url={friend.avatar_url} />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={styles.headerTitle}>{friend.username || "Friend"}</Text>
          <Text style={styles.headerSubtitle}>{friend.handle}</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setPickerOpen(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="add" size={22} color={BG} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={AMBER} />
        </View>
      ) : thread.length === 0 ? (
        <View style={styles.centerFill}>
          <Text style={styles.emptyText}>No tracks shared yet</Text>
        </View>
      ) : (
        <FlatList
          data={thread}
          extraData={[getStates, savedIds]}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={AMBER}
            />
          }
          renderItem={({ item }) => (
            <ThreadRow
              item={item}
              isUnseen={unseenIdsRef.current.has(item.id)}
              onPress={handlePress}
              onGet={handleGet}
              getState={getStates[item.id]}
              saved={savedIds.has(item.id)}
            />
          )}
        />
      )}

      <SelectItemSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        fetchTracks={fetchTracks}
        fetchVideos={fetchVideos}
        onSend={handleSendShare}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  headerSubtitle: { color: "#9A9A9E", fontSize: 13, marginTop: 2 },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: AMBER,
    alignItems: "center",
    justifyContent: "center",
  },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#8A8A8E", fontSize: 15 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  avatarFallback: {
    backgroundColor: "rgba(232,166,98,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { color: AMBER, fontWeight: "700" },

  trackTitle: { color: "#fff", fontSize: 15, fontWeight: "600" },
  trackArtist: { color: "#9A9A9E", fontSize: 13, marginTop: 1 },
  messageText: { color: "#C9C9CD", fontSize: 12.5, marginTop: 4, fontStyle: "italic" },
  directionText: { fontSize: 11, marginTop: 4, fontWeight: "600" },
  sentText: { color: AMBER },
  receivedText: { color: "#6FB98F" },

  thumbFallback: {
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },

  unseenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: UNSEEN_DOT,
    marginLeft: 8,
  },
});
