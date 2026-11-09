// ---------------------------------------------------------------------------
// SelectItemSheet — bottom sheet for picking a track (mp3) or video (mp4) to
// share with a friend, then composing an optional message before sending.
// Slides up the same way InboxScreen's AddFriendSheet does, but frosted-dark
// to match ShareThreadScreen's theme instead of AddFriendSheet's white card.
//
// Usage (from ShareThreadScreen, next to the friend header):
//   <SelectItemSheet
//     visible={pickerOpen}
//     onClose={() => setPickerOpen(false)}
//     fetchTracks={fetchMyTracks}   // TODO: wire to your Library/Downloads call
//     fetchVideos={fetchMyMovies}   // TODO: wire to your Movies call
//     onSend={(item, message) => handleSendShare(item, message)}
//   />
//
// fetchTracks/fetchVideos should each resolve to an array of
// { id, title, artist?, artwork_url? } (or thumbnail_url for videos).
// onSend receives the picked item (tagged with __kind: "track"|"video") and
// the trimmed message string ("" if left blank).
// ---------------------------------------------------------------------------
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Animated,
  Dimensions,
  FlatList,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const AMBER = "#E8A662";
const CARD_BG = "rgba(20,20,22,0.94)";
const ROW_BG = "rgba(255,255,255,0.06)";
const BORDER = "rgba(255,255,255,0.12)";
const { height: SCREEN_H } = Dimensions.get("window");

// Placeholder fetchers so the sheet still renders (empty state) if real
// fetch functions aren't passed in yet.
async function defaultFetch() {
  return [];
}

function ItemThumb({ url, icon, size = 44 }) {
  if (url) {
    return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: 8 }} />;
  }
  return (
    <View style={[styles.thumbFallback, { width: size, height: size }]}>
      <Ionicons name={icon} size={18} color="#6A6A6E" />
    </View>
  );
}

function ItemRow({ item, kind, onPress }) {
  return (
    <TouchableOpacity style={styles.itemRow} onPress={() => onPress(item)}>
      <ItemThumb
        url={item.artwork_url || item.thumbnail_url}
        icon={kind === "video" ? "film-outline" : "musical-notes"}
      />
      <View style={{ marginLeft: 10, flex: 1 }}>
        <Text style={styles.itemTitle} numberOfLines={1}>{item.title || item.name}</Text>
        {!!item.artist && <Text style={styles.itemSubtitle} numberOfLines={1}>{item.artist}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
    </TouchableOpacity>
  );
}

export default function SelectItemSheet({
  visible,
  onClose,
  fetchTracks = defaultFetch,
  fetchVideos = defaultFetch,
  onSend,
}) {
  const [tab, setTab] = useState("songs"); // "songs" | "videos"
  const [tracks, setTracks] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // chosen item, or null = still browsing
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, v] = await Promise.all([fetchTracks(), fetchVideos()]);
      setTracks(t || []);
      setVideos(v || []);
    } catch (e) {
      console.warn("Failed to load share picker items:", e.message);
    } finally {
      setLoading(false);
    }
  }, [fetchTracks, fetchVideos]);

  useEffect(() => {
    if (visible) {
      setTab("songs");
      setSelected(null);
      setMessage("");
      setSending(false);
      load();
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: SCREEN_H, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible, slideAnim, load]);

  const handlePickItem = (item, kind) => {
    setSelected({ ...item, __kind: kind });
  };

  const handleBack = () => setSelected(null);

  const handleSend = async () => {
    if (!selected || !onSend) return;
    setSending(true);
    try {
      await onSend(selected, message.trim());
      onClose?.();
    } catch (e) {
      console.warn("Failed to send share:", e.message);
    } finally {
      setSending(false);
    }
  };

  const data = tab === "songs" ? tracks : videos;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[styles.card, { transform: [{ translateY: slideAnim }] }]}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.handle} />

          {!selected ? (
            <>
              <Text style={styles.title}>Share a song or video</Text>
              <View style={styles.tabRow}>
                <TouchableOpacity
                  style={[styles.tabButton, tab === "songs" && styles.tabButtonActive]}
                  onPress={() => setTab("songs")}
                >
                  <Text style={[styles.tabText, tab === "songs" && styles.tabTextActive]}>Songs</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabButton, tab === "videos" && styles.tabButtonActive]}
                  onPress={() => setTab("videos")}
                >
                  <Text style={[styles.tabText, tab === "videos" && styles.tabTextActive]}>Videos</Text>
                </TouchableOpacity>
              </View>

              {loading ? (
                <ActivityIndicator color={AMBER} style={{ marginTop: 24, marginBottom: 24 }} />
              ) : data.length === 0 ? (
                <Text style={styles.emptyText}>
                  {tab === "songs" ? "No songs found in your library" : "No videos found"}
                </Text>
              ) : (
                <FlatList
                  data={data}
                  keyExtractor={(item, i) => String(item.id ?? i)}
                  style={{ maxHeight: SCREEN_H * 0.4 }}
                  renderItem={({ item }) => (
                    <ItemRow
                      item={item}
                      kind={tab === "songs" ? "track" : "video"}
                      onPress={(it) => handlePickItem(it, tab === "songs" ? "track" : "video")}
                    />
                  )}
                />
              )}
            </>
          ) : (
            <>
              <View style={styles.selectedHeader}>
                <TouchableOpacity onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="chevron-back" size={22} color="#fff" />
                </TouchableOpacity>
                <ItemThumb
                  url={selected.artwork_url || selected.thumbnail_url}
                  icon={selected.__kind === "video" ? "film-outline" : "musical-notes"}
                  size={40}
                />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={styles.itemTitle} numberOfLines={1}>{selected.title || selected.name}</Text>
                  {!!selected.artist && <Text style={styles.itemSubtitle} numberOfLines={1}>{selected.artist}</Text>}
                </View>
              </View>

              <TextInput
                style={styles.messageInput}
                placeholder="Add a message (optional)"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={message}
                onChangeText={setMessage}
                multiline
              />

              <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={sending}>
                {sending ? <ActivityIndicator color="#0B0B0D" size="small" /> : <Text style={styles.sendButtonText}>Send</Text>}
              </TouchableOpacity>
            </>
          )}
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  card: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 32,
    minHeight: 320,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: "700", color: "#fff", marginBottom: 14 },
  tabRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: ROW_BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  tabButtonActive: { backgroundColor: "rgba(232,166,98,0.18)", borderColor: AMBER },
  tabText: { color: "rgba(255,255,255,0.6)", fontWeight: "600", fontSize: 13 },
  tabTextActive: { color: AMBER },
  emptyText: { color: "#8A8A8E", fontSize: 14, textAlign: "center", marginTop: 24, marginBottom: 24 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ROW_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
  },
  itemTitle: { color: "#fff", fontSize: 15, fontWeight: "600" },
  itemSubtitle: { color: "#9A9A9E", fontSize: 12, marginTop: 1 },
  thumbFallback: {
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  selectedHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 10,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 12,
    color: "#fff",
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: "top",
    backgroundColor: ROW_BG,
    marginBottom: 16,
  },
  sendButton: {
    backgroundColor: AMBER,
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: "center",
  },
  sendButtonText: { color: "#0B0B0D", fontWeight: "700", fontSize: 15 },
});
