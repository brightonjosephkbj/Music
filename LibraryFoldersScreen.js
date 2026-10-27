import React from "react";
import {
  View, Text, TouchableOpacity, FlatList, RefreshControl, StyleSheet,
} from "react-native";
import { reportScrollY } from "./shellScroll";

const GLASS_BG = "rgba(255,255,255,0.08)";
const GLASS_BORDER = "rgba(255,255,255,0.15)";

// Folders section of the Library. Opening a folder, creating one and deleting
// one are all handled by LibraryScreen, which passes them in as callbacks.
export default function LibraryFoldersScreen({
  folders,
  onCreate,        // () => void, opens the "new folder" prompt
  onOpenFolder,    // (folder) => void
  onDeleteFolder,  // (folder) => void
  refreshing,
  onRefresh,
}) {
  return (
    <FlatList onScroll={(e) => reportScrollY(e.nativeEvent.contentOffset.y)} scrollEventThrottle={32}
      data={folders}
      keyExtractor={(f) => f.id}
      contentContainerStyle={[styles.listContent, { paddingBottom: 170 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
      ListHeaderComponent={
        <TouchableOpacity style={styles.createTile} onPress={onCreate}>
          <Text style={styles.createTileText}>+ New Folder</Text>
        </TouchableOpacity>
      }
      ListEmptyComponent={
        <Text style={styles.emptyText}>No folders yet - create one to organize anything: songs, videos, or playlists together.</Text>
      }
      renderItem={({ item: f }) => (
        <TouchableOpacity style={styles.folderRow} onPress={() => onOpenFolder(f)}>
          <Text style={styles.folderName}>{f.name}</Text>
          <Text style={styles.folderCount}>{(f.itemIds || []).length} items</Text>
          <TouchableOpacity onPress={() => onDeleteFolder(f)}>
            <Text style={styles.folderDelete}>Delete</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 20, paddingBottom: 150 },
  emptyText: { color: "#B3B3B3", textAlign: "center", marginTop: 30, lineHeight: 20 },
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
});
