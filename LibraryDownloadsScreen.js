import React, { useCallback } from "react";
import {
  View, Text, TouchableOpacity, Image, FlatList, RefreshControl, StyleSheet,
} from "react-native";
import { useDownloads } from "./DownloadsContext";
import { reportScrollY } from "./shellScroll";

function formatDuration(sec) {
  if (!sec && sec !== 0) return "";
  const m = Math.floor(sec / 60);
  const ss = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

// Downloads section of the Library. Reads live download progress straight
// from the DownloadsContext, so LibraryScreen doesn't need to pass it in.
export default function LibraryDownloadsScreen({
  downloads,
  onTrackPress,
  onItemMenu,
  onOpenImage,
  refreshing,
  onRefresh,
}) {
  const { activeDownloads, pauseDownload, resumeDownload, cancelDownload } = useDownloads();
  const activeList = Array.from(activeDownloads.values());

  const header = activeList.length > 0 ? (
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
  ) : null;

  const renderRow = useCallback(
    ({ item }) => (
      <TouchableOpacity
        style={styles.row}
        onPress={() => {
          if (item.type === "image") return onOpenImage && onOpenImage(item);
          if (onTrackPress) onTrackPress(item, downloads);
        }}
        onLongPress={(evt) => onItemMenu && onItemMenu(evt, item)}
        delayLongPress={300}
      >
        <Image source={item.artwork ? { uri: item.artwork } : undefined} style={styles.rowArt} />
        <View style={styles.rowTextWrap}>
          <Text numberOfLines={1} style={styles.rowTitle}>{item.title}</Text>
          {!!item.artist && <Text numberOfLines={1} style={styles.rowArtist}>{item.artist}</Text>}
        </View>
        {item.type === "image" ? (
          <Text style={styles.rowDuration}>Image</Text>
        ) : (
          <Text style={styles.rowDuration}>{formatDuration(item.duration)}</Text>
        )}
      </TouchableOpacity>
    ),
    [downloads, onTrackPress, onItemMenu, onOpenImage]
  );

  return (
    <FlatList onScroll={(e) => reportScrollY(e.nativeEvent.contentOffset.y)} scrollEventThrottle={32}
      data={downloads}
      keyExtractor={(item) => item.id}
      renderItem={renderRow}
      contentContainerStyle={[styles.listContent, { paddingBottom: 170 }]}
      ListHeaderComponent={header}
      ListEmptyComponent={<Text style={styles.emptyText}>Nothing downloaded yet.</Text>}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
      removeClippedSubviews={false}
    />
  );
}

const GLASS_BG = "rgba(255,255,255,0.08)";
const GLASS_BORDER = "rgba(255,255,255,0.15)";

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  rowArt: { width: 48, height: 48, borderRadius: 4, backgroundColor: GLASS_BG, marginRight: 12 },
  rowTextWrap: { flex: 1, marginRight: 10 },
  rowTitle: { color: "#fff", fontWeight: "600", fontSize: 14 },
  rowArtist: { color: "#B3B3B3", fontSize: 12, marginTop: 2 },
  rowDuration: { color: "#B3B3B3", fontSize: 12 },
  listContent: { paddingHorizontal: 20, paddingBottom: 150 },
  emptyText: { color: "#B3B3B3", textAlign: "center", marginTop: 30, lineHeight: 20 },
  activeDownloadRow: {
    backgroundColor: GLASS_BG, borderWidth: 1, borderColor: GLASS_BORDER, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8,
  },
  activeDownloadTitle: { color: "#fff", fontSize: 13, fontWeight: "600", marginBottom: 6 },
  activeDownloadTrack: { height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)" },
  activeDownloadFill: { height: 4, borderRadius: 2, backgroundColor: "#1ED760" },
  activeDownloadFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  activeDownloadPct: { color: "#B3B3B3", fontSize: 10 },
  activeDownloadActions: { flexDirection: "row", gap: 10 },
  activeDownloadBtn: { paddingVertical: 2, paddingHorizontal: 4 },
  activeDownloadBtnText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});
