import React from "react";
import {
  View, Text, TouchableOpacity, Image, FlatList, RefreshControl, TextInput, StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { reportScrollY } from "./shellScroll";

const ACCENT_GREEN = "#39FF6A";
const ACCENT_GREEN_BORDER = "rgba(57,255,106,0.35)";
const ACCENT_GREEN_SOFT = "rgba(57,255,106,0.16)";
const PL_DARK_GRAY = "#2A2A2E";
const PL_GLASS_BG = "rgba(255,255,255,0.04)";
const PL_GLASS_BORDER = "rgba(255,255,255,0.09)";

// Playlists section of the Library: the grid of personal + group playlists.
// Opening a playlist, the menus and AI generation all live in LibraryScreen
// and come in as callbacks, so this file only draws the grid.
export default function LibraryPlaylistsScreen({
  playlists,            // already filtered by the search text
  getPlaylistArt,       // (playlist) => image source or null
  search,
  onSearchChange,
  aiGenerating,
  onGenerateAI,
  onMostPlayed,
  onCreate,             // opens the personal/group choice
  onOpenPlaylist,       // async (playlist) => void
  onPlaylistMenu,       // (event, playlist) => void
  refreshing,
  onRefresh,
}) {
  const header = (
    <>
      <TouchableOpacity
        style={[styles.pl2NewPlaylistCard, { marginBottom: 10 }]}
        onPress={onMostPlayed}
        activeOpacity={0.75}
      >
        <View style={styles.pl2NewPlaylistIconWrap}>
          <Ionicons name="flame" size={18} color="#0A0A0A" />
        </View>
        <Text style={styles.pl2NewPlaylistText}>Most Played</Text>
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.pl2NewPlaylistCard} onPress={onCreate} activeOpacity={0.75}>
        <View style={styles.pl2NewPlaylistIconWrap}>
          <Ionicons name="add" size={20} color="#0A0A0A" />
        </View>
        <Text style={styles.pl2NewPlaylistText}>New Playlist</Text>
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.pl2AiCard, aiGenerating && { opacity: 0.6 }]}
        onPress={onGenerateAI}
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
          value={search}
          onChangeText={onSearchChange}
        />
      </View>

      <View style={styles.pl2SectionRow}>
        <Text style={styles.pl2SectionLabel}>YOUR COLLECTIONS</Text>
        <View style={styles.pl2SectionDot} />
      </View>
    </>
  );

  return (
    <FlatList onScroll={(e) => reportScrollY(e.nativeEvent.contentOffset.y)} scrollEventThrottle={32}
      key="playlist-grid-2col"
      data={playlists}
      keyExtractor={(p) => p.id}
      numColumns={2}
      columnWrapperStyle={styles.tileColumnWrapper}
      contentContainerStyle={[styles.listContent, { paddingBottom: 170 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
      ListHeaderComponent={header}
      ListEmptyComponent={<Text style={styles.emptyText}>No playlists found.</Text>}
      renderItem={({ item: p }) => {
        const art = getPlaylistArt(p);
        return (
          <TouchableOpacity
            style={styles.pl2Tile}
            onPress={() => onOpenPlaylist(p)}
            onLongPress={(evt) => !p.is_group && onPlaylistMenu(evt, p)}
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
  );
}

const styles = StyleSheet.create({
  tileColumnWrapper: {
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 150 },
  emptyText: { color: "#B3B3B3", textAlign: "center", marginTop: 30, lineHeight: 20 },
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
  groupBadge: {
    position: "absolute", left: 8, top: 8, flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#1ED760", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3,
  },
  groupBadgeText: { color: "#000", fontSize: 9, fontWeight: "800" },
});
