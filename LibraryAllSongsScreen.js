import React, { useCallback } from "react";
import {
  View, Text, TouchableOpacity, Image, FlatList, RefreshControl, TextInput, StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SORT_LABELS } from "./AllSongsSortSheet";
import { smartShuffle } from "./smartShuffle";
import { reportScrollY } from "./shellScroll";

const AS_ACTIVE_BG = "rgba(245,166,35,0.10)";
const AS_ACTIVE_BORDER = "rgba(245,166,35,0.35)";
const AS_AMBER = "#C89BFF";
const AS_GLASS_BG = "rgba(255,255,255,0.05)";
const AS_GLASS_BORDER = "rgba(255,255,255,0.09)";
const LIB_ORCHID = "#C89BFF";

function formatDuration(sec) {
  if (!sec && sec !== 0) return "";
  const m = Math.floor(sec / 60);
  const ss = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

// All Songs section of the Library. LibraryScreen keeps the sort sheet and the
// filtering logic and passes the results in, so this file only draws the screen.
export default function LibraryAllSongsScreen({
  songs,            // every song (unfiltered), used for the counts
  filteredSongs,    // after search + sort, this is what gets listed and queued
  searchQuery,
  onSearchChange,
  sortMode,
  onOpenSort,
  scanning,
  scanDenied,
  scanErrorMsg,
  lastScanCounts,
  onRescan,
  currentTrackId,
  onTrackPress,
  onItemMenu,
  onOpenImage,
  refreshing,
  onRefresh,
}) {
  const renderRow = useCallback(
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
            if (item.type === "image") return onOpenImage && onOpenImage(item);
            if (onTrackPress) onTrackPress(item, filteredSongs);
          }}
          onLongPress={(evt) => onItemMenu && onItemMenu(evt, item)}
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
              onPress={(evt) => onItemMenu && onItemMenu(evt, item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="ellipsis-vertical" size={16} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    },
    [filteredSongs, onTrackPress, onItemMenu, onOpenImage, currentTrackId]
  );

  const header = (
    <>
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <TextInput
          value={searchQuery}
          onChangeText={onSearchChange}
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
          flexDirection: "row", alignItems: "center", gap: 10,
          backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14,
          paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12,
        }}
      >
        <Ionicons name="sync" size={18} color={LIB_ORCHID} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#F5F3FA", fontWeight: "700", fontSize: 13 }}>
            {songs.length} local files
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
        <TouchableOpacity style={styles.asHeroRescanBtn} onPress={onRescan} disabled={scanning}>
          <Text style={styles.asHeroRescanText}>{scanning ? "Scanning..." : "Rescan"}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            if (filteredSongs.length > 0 && onTrackPress) onTrackPress(filteredSongs[0], filteredSongs);
          }}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: LIB_ORCHID, borderRadius: 22, paddingVertical: 11 }}
        >
          <Ionicons name="play" size={16} color="#0B0A0F" />
          <Text style={{ color: "#0B0A0F", fontWeight: "800", fontSize: 14 }}>Play</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            if (filteredSongs.length === 0 || !onTrackPress) return;
            const q = smartShuffle(filteredSongs);
            if (q.length === 0) return;
            onTrackPress(q[0], q);
          }}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 22, paddingVertical: 11, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" }}
        >
          <Ionicons name="shuffle" size={16} color="#F5F3FA" />
          <Text style={{ color: "#F5F3FA", fontWeight: "700", fontSize: 14 }}>Shuffle</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.asSectionRow}>
        <Text style={styles.asSectionLabel}>TRACKS ({songs.length})</Text>
        <TouchableOpacity
          style={styles.asSortRow}
          onPress={onOpenSort}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.asSortText}>{SORT_LABELS[sortMode]}</Text>
          <Ionicons name="options-outline" size={14} color={AS_AMBER} />
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <FlatList onScroll={(e) => reportScrollY(e.nativeEvent.contentOffset.y)} scrollEventThrottle={32}
      data={filteredSongs}
      keyExtractor={(item) => item.id}
      renderItem={renderRow}
      contentContainerStyle={[styles.listContent, { paddingBottom: 170 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <Text style={styles.emptyText}>No songs yet - download some, or scan your phone storage above.</Text>
      }
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
      removeClippedSubviews={false}
    />
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 20, paddingBottom: 150 },
  emptyText: { color: "#B3B3B3", textAlign: "center", marginTop: 30, lineHeight: 20 },
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
  asHeroRescanBtn: { backgroundColor: AS_AMBER, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  asHeroRescanText: { color: "#0A0A0A", fontWeight: "800", fontSize: 11, letterSpacing: 0.3 },
  asSectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  asSectionLabel: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  asSortRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  asSortText: { color: AS_AMBER, fontSize: 12, fontWeight: "600" },
});
