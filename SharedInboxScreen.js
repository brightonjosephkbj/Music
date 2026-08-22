// ---------------------------------------------------------------------------
// SharedInboxScreen — tracks friends have shared TO you. Separate from the
// Friends screen (InboxScreen.js) which handles friend requests/list.
//
// ASSUMED shape of each item returned by getShareInbox() - adjust the
// destructuring in ShareRow below if your backend uses different field
// names. Based on sendShare()'s payload (from_user, to_user, item_type,
// item_id, item_meta) plus what a "who sent this" row needs:
//   {
//     id: <share row id>,
//     from_user_id: <id>,
//     from_username: <string>,
//     from_avatar_letter: <string>,
//     from_avatar_url: <string|null>,
//     item_type: "track",
//     item_id: <string>,
//     item_meta: { title, artist, artwork_url },
//     seen: <bool>,
//     created_at: <ISO string>,
//   }
//
// SEEN behavior: unseen state is captured once at fetch time (so the green
// dot is visible while you're looking at the screen), then those ids are
// marked seen when you leave the screen - not immediately on mount. That
// way the dot doesn't vanish before you've actually seen it.
// If this screen lives inside a tab navigator (stays mounted when you
// switch tabs), swap the unmount cleanup below for a navigation focus/blur
// listener instead, or the "mark seen" call may never fire.
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
import { getCurrentUser, getShareInbox, markSharesSeen } from "./shareClient";

const AMBER = "#E8A662";
const BG = "#0B0B0D";
const CARD_BG = "rgba(255,255,255,0.06)";
const BORDER = "rgba(255,255,255,0.10)";
const UNSEEN_DOT = "#3AA76D";

function SenderAvatar({ letter, url, size = 40 }) {
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

// Cheap relative-time formatter - no dependency needed for "2h ago" etc.
function timeAgo(isoString) {
  if (!isoString) return "";
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(isoString).toLocaleDateString();
}

function ShareRow({ item, isUnseen, onPress }) {
  const meta = item.item_meta || {};
  return (
    <TouchableOpacity style={styles.row} onPress={() => onPress(item)}>
      <View style={styles.avatarWrap}>
        <SenderAvatar letter={item.from_avatar_letter} url={item.from_avatar_url} />
        {isUnseen && <View style={styles.unseenDot} />}
      </View>

      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.senderLine}>
          <Text style={styles.senderName}>{item.from_username || "Someone"}</Text>
          <Text style={styles.sharedText}> shared a track</Text>
        </Text>
        <Text style={styles.trackTitle} numberOfLines={1}>
          {meta.title || item.item_id}
        </Text>
        {!!meta.artist && (
          <Text style={styles.trackArtist} numberOfLines={1}>
            {meta.artist}
          </Text>
        )}
      </View>

      <TrackThumb url={meta.artwork_url} />

      <Text style={styles.timeText}>{timeAgo(item.created_at)}</Text>
    </TouchableOpacity>
  );
}

export default function SharedInboxScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Snapshot of which ids were unseen at the moment we fetched - used only
  // for rendering the dot. We deliberately don't mutate this on tap so the
  // dot doesn't flicker away mid-scroll; it clears on next screen visit.
  const unseenIdsRef = useRef(new Set());

  const loadInbox = useCallback(async (userId) => {
    try {
      const list = await getShareInbox(userId, { unseenOnly: false, app: "music" });
      unseenIdsRef.current = new Set(
        list.filter((s) => !s.seen).map((s) => s.id)
      );
      setShares(list);
    } catch (e) {
      console.warn("Failed to load share inbox:", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      setUser(u);
      if (u?.id) await loadInbox(u.id);
      else setLoading(false);
    })();
  }, [loadInbox]);

  // Mark whatever was unseen at fetch time as seen once you leave the
  // screen. Fires on unmount (stack navigation). See file header comment
  // if this screen sits inside a tab navigator instead.
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
    if (!user?.id) return;
    setRefreshing(true);
    loadInbox(user.id);
  };

  const handlePress = (item) => {
    // TODO: wire to your actual player navigation/route name.
    navigation?.navigate?.("Player", {
      trackId: item.item_id,
      trackMeta: item.item_meta,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shared with you</Text>
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={AMBER} />
        </View>
      ) : shares.length === 0 ? (
        <View style={styles.centerFill}>
          <Text style={styles.emptyText}>No one has shared a track yet</Text>
        </View>
      ) : (
        <FlatList
          data={shares}
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
            <ShareRow
              item={item}
              isUnseen={unseenIdsRef.current.has(item.id)}
              onPress={handlePress}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  headerTitle: { color: "#fff", fontSize: 24, fontWeight: "700" },
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
  avatarWrap: { position: "relative" },
  unseenDot: {
    position: "absolute",
    top: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: UNSEEN_DOT,
    borderWidth: 2,
    borderColor: BG,
  },
  avatarFallback: {
    backgroundColor: "rgba(232,166,98,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { color: AMBER, fontWeight: "700" },

  senderLine: { marginBottom: 2 },
  senderName: { color: "#fff", fontSize: 13, fontWeight: "700" },
  sharedText: { color: "#9A9A9E", fontSize: 13 },
  trackTitle: { color: "#fff", fontSize: 15, fontWeight: "600" },
  trackArtist: { color: "#9A9A9E", fontSize: 13, marginTop: 1 },

  thumbFallback: {
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },

  timeText: {
    color: "#6A6A6E",
    fontSize: 11,
    marginLeft: 10,
    alignSelf: "flex-start",
  },
});
