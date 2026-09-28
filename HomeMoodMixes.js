import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { getListeningHistory } from "./listeningHistory";
import { getDownloads } from "./libraryStorage";
import { API_BASE, gatewayHeaders } from "./apiClient";

// ---------------------------------------------------------------------------
// Made For You - mixes generated from real listening history rather than
// genre/tempo metadata, which the track model doesn't carry. Four possible
// mixes:
//   - Discover Weekly: similar-artist expansion off your top played artist
//     (reuses the same lastfm/similar endpoint SimilarRow already calls)
//   - Late Night Mix / Morning Mix: time-of-day buckets built from a
//     playedAt/timestamp field on history entries - if that field isn't
//     present yet on your listeningHistory entries, these two just won't
//     render, same "hide if empty" pattern as every other Home row
//   - Replay Mix: your most-repeated tracks by appearance count in history
// Each mix hides independently if it has nothing worth showing, so the row
// itself only renders once at least one mix has data.
// ---------------------------------------------------------------------------
const MIX_META = {
  discoverWeekly: { label: "Discover Weekly", colors: ["#6D5DF6", "#9C6BFF"] },
  lateNight: { label: "Late Night Mix", colors: ["#1B1B3A", "#3B2E6E"] },
  morning: { label: "Morning Mix", colors: ["#FF9A6B", "#FF6B9A"] },
  replay: { label: "Replay Mix", colors: ["#1F8A70", "#4ECDC4"] },
};

function getTimestamp(entry) {
  return entry.playedAt || entry.timestamp || entry.playedAtMs || null;
}

function MixCard({ meta, trackCount, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <LinearGradient colors={meta.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.playGlass}>
        <Ionicons name="play" size={14} color="#fff" />
      </View>
      <View>
        <Text style={styles.cardLabel} numberOfLines={2}>{meta.label}</Text>
        {!!trackCount && <Text style={styles.cardCount}>{trackCount} tracks</Text>}
      </View>
    </TouchableOpacity>
  );
}

export default function MoodMixesRow({ onTrackPress }) {
  const [mixes, setMixes] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [history, downloads] = await Promise.all([getListeningHistory(), getDownloads()]);
      const result = {};

      // --- Replay Mix: tracks that appear more than once in history ---
      const playCounts = new Map();
      history.forEach((h) => {
        const key = `${h.provider || ""}-${h.id}`;
        playCounts.set(key, (playCounts.get(key) || 0) + 1);
      });
      const byId = new Map(downloads.map((d) => [`${d.provider || ""}-${d.id}`, d]));
      const replay = [...playCounts.entries()]
        .filter(([, count]) => count > 1)
        .sort((a, b) => b[1] - a[1])
        .map(([key]) => byId.get(key))
        .filter(Boolean)
        .slice(0, 15);
      if (replay.length > 0) result.replay = replay;

      // --- Time-of-day mixes, only if entries carry a timestamp ---
      const lateNight = [];
      const morning = [];
      history.forEach((h) => {
        const ts = getTimestamp(h);
        if (!ts) return;
        const hour = new Date(ts).getHours();
        if (hour >= 21 || hour < 5) lateNight.push(h);
        else if (hour >= 5 && hour < 11) morning.push(h);
      });
      if (lateNight.length >= 3) result.lateNight = lateNight.slice(0, 15);
      if (morning.length >= 3) result.morning = morning.slice(0, 15);

      // --- Discover Weekly: similar tracks off your top played artist ---
      const artistCounts = new Map();
      history.forEach((h) => {
        if (!h.artist) return;
        artistCounts.set(h.artist, (artistCounts.get(h.artist) || 0) + 1);
      });
      const topArtist = [...artistCounts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (topArtist) {
        const seedTrack = history.find((h) => h.artist === topArtist[0]);
        if (seedTrack?.title) {
          try {
            const params = new URLSearchParams({ track: seedTrack.title, artist: topArtist[0] });
            const res = await fetch(`${API_BASE}/api/apicache/api/music/lastfm/similar?${params.toString()}`, {
              headers: gatewayHeaders(),
            });
            const data = await res.json();
            const similar = (data.similar || []).slice(0, 15);
            if (similar.length > 0) result.discoverWeekly = similar;
          } catch {
            // Discover Weekly just won't render if this fails
          }
        }
      }

      if (!cancelled) {
        setMixes(result);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Resolves a mix's items into a playable queue. Replay items are already
  // real downloads; discoverWeekly/lateNight/morning items may be raw
  // lastfm/history entries needing a search resolve first, same lazy
  // approach SimilarRow uses on tap.
  const handleMixPress = async (key, items) => {
    if (key === "replay") {
      onTrackPress && onTrackPress(items[0], items);
      return;
    }
    const resolved = [];
    for (const item of items.slice(0, 10)) {
      if (item.stream_url || item.download_url || item.localUri) {
        resolved.push(item);
        continue;
      }
      try {
        const params = new URLSearchParams({ q: `${item.artist} ${item.title}`, limit: "1" });
        const res = await fetch(`${API_BASE}/api/apicache/api/music/search?${params.toString()}`, {
          headers: gatewayHeaders(),
        });
        const data = await res.json();
        const found = data.tracks && data.tracks[0];
        if (found) resolved.push(found);
      } catch {
        // skip unresolvable item
      }
    }
    if (resolved.length > 0) onTrackPress && onTrackPress(resolved[0], resolved);
  };

  const activeMixKeys = Object.keys(mixes);
  if (loading || activeMixKeys.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Made For You</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {activeMixKeys.map((key) => (
          <MixCard
            key={key}
            meta={MIX_META[key]}
            trackCount={mixes[key].length}
            onPress={() => handleMixPress(key, mixes[key])}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 4, marginBottom: 4 },
  sectionTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 10 },
  row: { paddingRight: 8 },
  card: {
    width: 140,
    height: 100,
    marginRight: 12,
    borderRadius: 16,
    overflow: "hidden",
    padding: 12,
    justifyContent: "space-between",
  },
  playGlass: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
  },
  cardLabel: { color: "#fff", fontSize: 13, fontWeight: "700" },
  cardCount: { color: "rgba(255,255,255,0.75)", fontSize: 10, marginTop: 2 },
});
