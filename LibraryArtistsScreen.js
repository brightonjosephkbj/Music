import React from "react";
import { Text, FlatList, RefreshControl, StyleSheet } from "react-native";
import LibraryArtistRow from "./LibraryArtistRow";
import { reportScrollY } from "./shellScroll";


// Artists section of the Library: a 3-column grid. Opening an artist shows the
// artist hero page, which LibraryScreen still handles through onOpenArtist.
export default function LibraryArtistsScreen({
  artistEntries,   // [[artistName, tracks[]], ...] already sorted by LibraryScreen
  onOpenArtist,    // (artistName) => void
  refreshing,
  onRefresh,
}) {
  return (
    <FlatList onScroll={(e) => reportScrollY(e.nativeEvent.contentOffset.y)} scrollEventThrottle={32}
      key="artist-grid-3col"
      data={artistEntries}
      keyExtractor={([artist]) => artist}
      numColumns={3}
      contentContainerStyle={[styles.listContent, { paddingBottom: 180 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
      ListEmptyComponent={<Text style={styles.emptyText}>No artists yet - download some tracks first.</Text>}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
      removeClippedSubviews={false}
      renderItem={({ item: [artist, tracks] }) => (
        <LibraryArtistRow
          artist={artist}
          tracks={tracks}
          onPress={() => onOpenArtist(artist)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 20, paddingBottom: 150 },
  emptyText: { color: "#B3B3B3", textAlign: "center", marginTop: 30, lineHeight: 20 },
});
