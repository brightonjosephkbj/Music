import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { getMostPlayed } from "./listeningHistory";

const ONYX = "#020202";
const CANDY_BLUE = "#B2D5E5";
const GLASS_BG = "rgba(178,213,229,0.10)";
const GLASS_BORDER = "rgba(178,213,229,0.28)";
const DAY = 86400000;

const RANGES = [
  { key: "all", label: "All time", from: () => 0 },
  { key: "today", label: "Today", from: () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); } },
  { key: "7d", label: "7 days", from: () => Date.now() - 7 * DAY },
  { key: "30d", label: "30 days", from: () => Date.now() - 30 * DAY },
];

const toTrack = (e) => ({
  id: e.id, provider: e.provider, title: e.title, artist: e.artist,
  artwork: e.artwork, type: e.type, localUri: e.localUri,
  stream_url: e.stream_url, download_url: e.download_url,
});

// Collage of UNIQUE artwork only: 1 = full, 2 = split, 3 = big + 2 stacked, 4 = 2x2
function Collage({ items, size = 120 }) {
  const arts = [...new Set(items.map((i) => i.artwork).filter(Boolean))].slice(0, 4);
  const box = { width: size, height: size, borderRadius: 16, overflow: "hidden", backgroundColor: "rgba(178,213,229,0.15)" };
  const img = (uri, style) => <Image key={uri} source={{ uri }} style={style} />;
  if (arts.length === 0) {
    return (
      <View style={[box, { alignItems: "center", justifyContent: "center" }]}>
        <Ionicons name="musical-notes" size={36} color={CANDY_BLUE} />
      </View>
    );
  }
  if (arts.length === 1) return <View style={box}>{img(arts[0], { width: size, height: size })}</View>;
  const h = size / 2;
  if (arts.length === 2) {
    return <View style={[box, { flexDirection: "row" }]}>{arts.map((u) => img(u, { width: h, height: size }))}</View>;
  }
  if (arts.length === 3) {
    return (
      <View style={[box, { flexDirection: "row" }]}>
        {img(arts[0], { width: h, height: size })}
        <View>{img(arts[1], { width: h, height: h })}{img(arts[2], { width: h, height: h })}</View>
      </View>
    );
  }
  return (
    <View style={[box, { flexDirection: "row", flexWrap: "wrap" }]}>
      {arts.map((u) => img(u, { width: h, height: h }))}
    </View>
  );
}

export default function MostPlayedScreen({ onBack, onTrackPress }) {
  const [rangeKey, setRangeKey] = useState("all");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const range = RANGES.find((r) => r.key === rangeKey);
    getMostPlayed(range.from()).then((data) => {
      if (alive) { setItems(data); setLoading(false); }
    });
    return () => { alive = false; };
  }, [rangeKey]);

  const queue = items.map(toTrack);
  const playAll = () => queue.length && onTrackPress && onTrackPress(queue[0], queue);
  const shuffle = () => {
    if (!queue.length || !onTrackPress) return;
    const s = [...queue].sort(() => Math.random() - 0.5);
    onTrackPress(s[0], s);
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[ONYX, "#0a0e10", ONYX]} style={StyleSheet.absoluteFill} />

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.circleBtn} onPress={onBack}>
          <Ionicons name="chevron-back" size={22} color={CANDY_BLUE} />
        </TouchableOpacity>
      </View>

      <View style={styles.hero}>
        <Collage items={items} />
        <View style={styles.heroInfo}>
          <Text style={styles.title}>Most Played</Text>
          <Text style={styles.sub}>{items.length} {items.length === 1 ? "Track" : "Tracks"}</Text>
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.pill} onPress={shuffle}>
              <Ionicons name="shuffle" size={18} color={CANDY_BLUE} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.pill, { paddingHorizontal: 16 }]} onPress={playAll}>
              <Ionicons name="play" size={16} color={CANDY_BLUE} />
              <Text style={styles.pillText}>Play</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.chips}>
        {RANGES.map((r) => (
          <TouchableOpacity
            key={r.key}
            onPress={() => setRangeKey(r.key)}
            style={[styles.chip, rangeKey === r.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, rangeKey === r.key && { color: ONYX }]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!loading && items.length === 0 && (
        <Text style={styles.empty}>Nothing played in this range yet.</Text>
      )}

      <FlatList
        data={items}
        keyExtractor={(e) => `${e.provider}-${e.id}`}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.8}
            onPress={() => onTrackPress && onTrackPress(toTrack(item), queue)}
          >
            <Image source={item.artwork ? { uri: item.artwork } : undefined} style={styles.rowArt} />
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text numberOfLines={1} style={styles.rowTitle}>{item.title}</Text>
              <Text numberOfLines={1} style={styles.rowArtist}>{item.artist}</Text>
            </View>
            {item.type === "video" && (
              <Ionicons name="videocam" size={16} color={CANDY_BLUE} style={{ marginRight: 8 }} />
            )}
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.rangeCount}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ONYX },
  topBar: { paddingTop: 54, paddingHorizontal: 16 },
  circleBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: GLASS_BG,
    borderWidth: 1, borderColor: GLASS_BORDER, alignItems: "center", justifyContent: "center",
  },
  hero: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16 },
  heroInfo: { flex: 1, marginLeft: 16 },
  title: { color: "#fff", fontSize: 22, fontWeight: "800" },
  sub: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 2 },
  btnRow: { flexDirection: "row", marginTop: 12 },
  pill: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 18, backgroundColor: GLASS_BG, borderWidth: 1, borderColor: GLASS_BORDER, marginRight: 8,
  },
  pillText: { color: CANDY_BLUE, fontSize: 13, fontWeight: "700", marginLeft: 6 },
  chips: { flexDirection: "row", paddingHorizontal: 16, marginBottom: 10 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, marginRight: 8,
    backgroundColor: GLASS_BG, borderWidth: 1, borderColor: GLASS_BORDER,
  },
  chipActive: { backgroundColor: CANDY_BLUE },
  chipText: { color: CANDY_BLUE, fontSize: 12, fontWeight: "700" },
  empty: { color: "rgba(255,255,255,0.5)", textAlign: "center", marginTop: 30, fontSize: 13 },
  row: {
    flexDirection: "row", alignItems: "center", backgroundColor: GLASS_BG,
    borderWidth: 1, borderColor: GLASS_BORDER, borderRadius: 16, padding: 10, marginBottom: 8,
  },
  rowArt: { width: 46, height: 46, borderRadius: 10, backgroundColor: "rgba(178,213,229,0.15)", marginRight: 12 },
  rowTitle: { color: "#fff", fontSize: 14, fontWeight: "600" },
  rowArtist: { color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 2 },
  badge: {
    minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 6,
    backgroundColor: "rgba(178,213,229,0.18)", alignItems: "center", justifyContent: "center",
  },
  badgeText: { color: CANDY_BLUE, fontSize: 12, fontWeight: "700" },
});
