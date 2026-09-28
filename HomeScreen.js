import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ActionTilesRow from "./HomeActionTiles";
import ContinueListeningCard from "./HomeContinueListening";
import MoodMixesRow from "./HomeMoodMixes";
import { PlaylistsRow, SimilarRow, RecentlyAddedRow, ArtistsRow, PodcastsRow } from "./HomeDiscoveryRows";
import TrendingRow from "./HomeTrendingRow";
import AnalogClock from "./AnalogClock";
import MoviesRow from "./MoviesRow";

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------
import { authedHeaders } from "./apiClient";
import { getCurrentUser, getShareInbox } from "./shareClient";

const API_BASE = "https://gateway-b0tx.onrender.com";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DRAWER_WIDTH = SCREEN_WIDTH * 0.78;

// The 7 Glass Drawer tiles. Each one maps to a backend blueprint that
// already exists - "The Rest" bundles space/wiki/commons/met/flights, which
// don't need their own top-level tile.
const DRAWER_TILES = [
  { key: "weather", label: "Weather", accent: "#4ECDC4" },
  { key: "jokes", label: "Jokes", accent: "#FFA751" },
  { key: "food", label: "Food", accent: "#FF6B6B" },
  { key: "art", label: "Art", accent: "#F7B2C4" },
  { key: "trivia", label: "Trivia", accent: "#FFD166" },
  { key: "news", label: "News", accent: "#6BCB77" },
  { key: "rest", label: "The Rest", accent: "#B983FF" },
];

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// onSearchPress / onDrawerTilePress / onTrackPress / onDownloadsPress are
// plain callbacks so this screen doesn't assume any particular navigation
// library - wire them up from the parent. onDownloadsPress is new - point
// it at whichever screen shows offline/downloaded tracks.
export default function HomeScreen({
  onSearchPress,
  onDrawerTilePress,
  onTrackPress,
  onPasteLinkPress,
  onDownloadsPress,
  onSettingsPress,
  onRecentPress,
  onAIChatPress,
  onInboxPress,
  nowPlaying,
  engine,
}) {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [displayName, setDisplayName] = useState(null);
  const [unseenShareCount, setUnseenShareCount] = useState(0);

  // Drawer animation: translateX runs from DRAWER_WIDTH (fully hidden, off
  // the right edge of the screen) to 0 (fully open). Using core Animated +
  // PanResponder here instead of Reanimated/gesture-handler keeps this
  // screen dependency-free - nothing new to install or rebuild for.
  const drawerX = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.spring(drawerX, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
  };

  const closeDrawer = () => {
    Animated.timing(drawerX, { toValue: DRAWER_WIDTH, duration: 220, useNativeDriver: true }).start(() =>
      setDrawerOpen(false)
    );
  };

  // Swipe-left-anywhere-on-Home gesture. Only kicks in once a drag is
  // clearly more horizontal than vertical, so normal vertical scrolling of
  // the page is never hijacked, and a plain tap still behaves like a tap.
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderMove: (_, gesture) => {
        if (drawerOpen) return; // the drawer's own responder owns the gesture once open
        if (gesture.dx < 0) {
          const next = Math.max(DRAWER_WIDTH + gesture.dx, 0);
          drawerX.setValue(next);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (drawerOpen) return;
        const openedFarEnough = gesture.dx < -DRAWER_WIDTH * 0.35;
        const fastSwipe = gesture.vx < -0.5;
        if (openedFarEnough || fastSwipe) openDrawer();
        else closeDrawer();
      },
    })
  ).current;

  // Separate responder so the open drawer can be swiped shut on its own.
  const drawerPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 12 && gesture.dx > 0,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dx > 0) drawerX.setValue(Math.min(gesture.dx, DRAWER_WIDTH));
      },
      onPanResponderRelease: (_, gesture) => {
        const closedFarEnough = gesture.dx > DRAWER_WIDTH * 0.3;
        const fastSwipe = gesture.vx > 0.5;
        if (closedFarEnough || fastSwipe) closeDrawer();
        else openDrawer();
      },
    })
  ).current;

  const fetchTrending = async () => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/apicache/api/music/search_trending?limit=15&offset=0`, {
        headers: await authedHeaders(),
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();
      const newTracks = data.tracks || [];
      setTracks(newTracks);
      setOffset(newTracks.length);
      setHasMore(newTracks.length >= 15);
    } catch (err) {
      setError(err.message || "Couldn't load trending tracks");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTrending();
  }, []);

  // Display name + inbox badge share one getCurrentUser() call - best
  // effort, both stay silently empty if this fails.
  useEffect(() => {
    (async () => {
      try {
        const u = await getCurrentUser();
        if (u?.username || u?.name) setDisplayName(u.username || u.name);
        if (u?.id) {
          const list = await getShareInbox(u.id, { unseenOnly: true, app: "music" });
          setUnseenShareCount(list.length);
        }
      } catch (e) {
        // non-critical
      }
    })();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setOffset(0);
    setHasMore(true);
    fetchTrending();
  };

  // Infinite scroll: fetches the next page and appends, de-duping by
  // provider+id. If the backend doesn't support offset (or we're at the
  // end), the appended set will have 0 new items and we stop paginating
  // instead of looping forever or showing duplicates.
  const loadMoreTrending = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`${API_BASE}/api/apicache/api/music/search_trending?limit=15&offset=${offset}`, {
        headers: await authedHeaders(),
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();
      const incoming = data.tracks || [];

      setTracks((prev) => {
        const existingKeys = new Set(prev.map((t) => `${t.provider}-${t.id}`));
        const fresh = incoming.filter((t) => !existingKeys.has(`${t.provider}-${t.id}`));
        if (fresh.length === 0) {
          setHasMore(false);
          return prev;
        }
        setOffset(prev.length + fresh.length);
        return [...prev, ...fresh];
      });

      if (incoming.length < 15) setHasMore(false);
    } catch (err) {
      // Silent fail on load-more - don't clobber the existing error state
      // for an already-successful initial load.
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const distanceFromBottom = contentSize.height - (layoutMeasurement.height + contentOffset.y);
    if (distanceFromBottom < 300) loadMoreTrending();
  };

  return (
    <View style={styles.root} {...panResponder.panHandlers}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        onScroll={handleScroll}
        scrollEventThrottle={150}
      >
        {/* ---------- Header: avatar + personalized greeting + settings/inbox/recent ---------- */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.avatarCircle} onPress={onSettingsPress}>
              <Ionicons name="person" size={16} color="#fff" />
            </TouchableOpacity>
            <View>
              <Text style={styles.greeting}>
                {getTimeGreeting()}
                {displayName ? `, ${displayName}` : ""} 👋
              </Text>
              <Text style={styles.greetingSubtitle}>What do you want to listen to?</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconButton} onPress={onSettingsPress}>
              <Ionicons name="settings-outline" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={onInboxPress}>
              <Ionicons name="mail-outline" size={16} color="#fff" />
              {unseenShareCount > 0 && (
                <View style={styles.inboxBadge}>
                  <Text style={styles.inboxBadgeText}>{unseenShareCount > 9 ? "9+" : unseenShareCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={onRecentPress}>
              <AnalogClock size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ---------- Action tiles: Paste Link / Downloads / AI Music ---------- */}
        <ActionTilesRow
          onPasteLinkPress={onPasteLinkPress}
          onDownloadsPress={onDownloadsPress}
          onAIChatPress={onAIChatPress}
        />

        {/* ---------- Continue Listening: scrubber card for the last played track ---------- */}
        <ContinueListeningCard nowPlaying={nowPlaying} engine={engine} onTrackPress={onTrackPress} />

        {/* ---------- Made For You: dynamic mixes from listening history ---------- */}
        <MoodMixesRow onTrackPress={onTrackPress} />

        {loading && <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />}

        {!loading && error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchTrending} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && (
          <TrendingRow tracks={tracks} onTrackPress={onTrackPress} />
        )}

        {loadingMore && <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />}

        {/* ---------- Discovery rows: local data + reused endpoints, each
             renders nothing if it has nothing worth showing ---------- */}
        <RecentlyAddedRow onTrackPress={onTrackPress} />
        <PlaylistsRow onTrackPress={onTrackPress} />
        <ArtistsRow onTrackPress={onTrackPress} />
        <SimilarRow onTrackPress={onTrackPress} />
        <PodcastsRow onTrackPress={onTrackPress} />
        <MoviesRow />

        {/* ---------- Quick-access strip hinting at the Glass Drawer ---------- */}
        <Text style={styles.sectionTitle}>More</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tileRow}>
          {DRAWER_TILES.map((tile) => (
            <TouchableOpacity key={tile.key} style={[styles.quickTile, { borderColor: tile.accent }]} onPress={openDrawer}>
              <Text style={styles.quickTileText}>{tile.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.hint}>Swipe left anywhere to open the drawer</Text>
      </ScrollView>

      {/* ---------- Backdrop: tap outside the open drawer to close it ---------- */}
      {drawerOpen && <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeDrawer} />}

      {/* ---------- Glass Drawer ---------- */}
      <Animated.View
        {...drawerPanResponder.panHandlers}
        style={[styles.drawer, { transform: [{ translateX: drawerX }] }]}
      >
        <Text style={styles.drawerTitle}>More</Text>
        {DRAWER_TILES.map((tile) => (
          <TouchableOpacity
            key={tile.key}
            style={[styles.drawerTile, { borderLeftColor: tile.accent }]}
            onPress={() => {
              closeDrawer();
              onDrawerTilePress && onDrawerTilePress(tile.key);
            }}
          >
            <Text style={styles.drawerTileText}>{tile.label}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>
    </View>
  );
}

const GLASS_BG = "rgba(255,255,255,0.14)";
const GLASS_BORDER = "rgba(255,255,255,0.25)";

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#020202" },
  scrollContent: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 140 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  headerRight: { flexDirection: "row", gap: 8 },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  greeting: { color: "#fff", fontSize: 18, fontWeight: "700" },
  greetingSubtitle: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 2 },
  iconButton: {
    position: "relative",
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 20,
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    justifyContent: "center",
    alignItems: "center",
  },
  inboxBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FF6B6B",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  inboxBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },

  sectionTitle: { color: "#fff", fontSize: 17, fontWeight: "700", marginBottom: 12, marginTop: 4 },

  tileRow: { paddingRight: 20, marginBottom: 8 },
  quickTile: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: GLASS_BG,
    borderWidth: 1.5,
    marginRight: 12,
  },
  quickTileText: { color: "#fff", fontWeight: "600" },

  hint: { color: "rgba(255,255,255,0.5)", fontSize: 12, textAlign: "center", marginTop: 10 },

  errorBox: { alignItems: "center", marginTop: 20 },
  errorText: { color: "#fff", marginBottom: 10 },
  retryButton: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  retryText: { color: "#fff", fontWeight: "700" },

  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" },
  drawer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: "rgba(20,20,25,0.92)",
    borderLeftWidth: 1,
    borderLeftColor: GLASS_BORDER,
    paddingTop: 70,
    paddingHorizontal: 20,
  },
  drawerTitle: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 20 },
  drawerTile: { paddingVertical: 16, borderLeftWidth: 4, paddingLeft: 14, marginBottom: 4 },
  drawerTileText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
