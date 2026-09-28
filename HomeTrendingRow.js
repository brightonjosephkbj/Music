import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// ---------------------------------------------------------------------------
// Trending Now - plain thumbnail row, matching Recently Added's card style,
// replacing the old big swipeable HomeCategorySwiper card on Home. The
// swiper component itself is untouched in case it's useful elsewhere later.
// ---------------------------------------------------------------------------
export default function TrendingRow({ tracks, onTrackPress }) {
  if (!tracks || tracks.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Trending Now</Text>
        <Text style={styles.seeAll}>See all</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {tracks.map((track) => (
          <TouchableOpacity
            key={`${track.provider}-${track.id}`}
            style={styles.card}
            onPress={() => onTrackPress && onTrackPress(track, tracks)}
            activeOpacity={0.85}
          >
            {track.artwork ? (
              <Image source={{ uri: track.artwork }} style={styles.art} />
            ) : (
              <View style={[styles.art, styles.artFallback]}>
                <Ionicons name="musical-notes" size={22} color="rgba(255,255,255,0.5)" />
              </View>
            )}
            <Text numberOfLines={1} style={styles.cardTitle}>{track.title}</Text>
            <Text numberOfLines={1} style={styles.cardSubtitle}>{track.artist}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 22 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  seeAll: { color: "rgba(255,255,255,0.5)", fontSize: 12 },
  row: { paddingRight: 8 },
  card: { width: 128, marginRight: 12 },
  art: {
    width: "100%",
    height: 128,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: 8,
  },
  artFallback: { alignItems: "center", justifyContent: "center" },
  cardTitle: { color: "#fff", fontSize: 13, fontWeight: "600" },
  cardSubtitle: { color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 2 },
});
