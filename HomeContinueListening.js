import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getListeningHistory } from "./listeningHistory";

// ---------------------------------------------------------------------------
// Continue Listening: a compact scrubber card for the last-played track,
// matching the mockup's inline-progress layout. This is a different shape
// than the old RecentPlayedCard (full-bleed art + lyric overlay) - that
// component still exists in HomeFeatureCards.js untouched, in case it's
// used elsewhere (e.g. RecentScreen); Home just no longer references it.
// ---------------------------------------------------------------------------
const GLASS_BG = "rgba(255,255,255,0.06)";
const GLASS_BORDER = "rgba(255,255,255,0.12)";
const AMBER = "#FFC24B";

function formatTime(seconds) {
  if (!seconds || Number.isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ContinueListeningCard({ nowPlaying, engine, onTrackPress }) {
  const [entry, setEntry] = useState(null);

  useEffect(() => {
    getListeningHistory().then((h) => setEntry(h[0] || null));
  }, []);

  const isActive =
    !!entry &&
    !!nowPlaying &&
    String(nowPlaying.id) === String(entry.id) &&
    (nowPlaying.provider || null) === (entry.provider || null);

  // Nothing played yet - Home already has plenty to show without an empty
  // placeholder card here.
  if (!entry) return null;

  const position = isActive ? engine?.position || 0 : 0;
  // Falls back to a duration stored on the history entry itself, if your
  // listeningHistory records one - otherwise the bar just sits at 0 until
  // playback is active and the engine reports a real duration.
  const duration = isActive ? engine?.duration || 0 : entry.duration || 0;
  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;

  const handlePlay = () => {
    if (isActive) {
      engine?.toggle && engine.toggle();
      return;
    }
    onTrackPress && onTrackPress(entry);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Continue Listening</Text>
      <TouchableOpacity style={styles.card} onPress={handlePlay} activeOpacity={0.9}>
        <Image source={entry.artwork ? { uri: entry.artwork } : undefined} style={styles.art} />
        <View style={styles.info}>
          <Text numberOfLines={1} style={styles.trackTitle}>{entry.title}</Text>
          <Text numberOfLines={1} style={styles.trackArtist}>{entry.artist}</Text>
          <View style={styles.scrubTrack}>
            <View style={[styles.scrubFill, { width: `${progress * 100}%` }]} />
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(position)}</Text>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.playButton}
          onPress={handlePlay}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name={isActive && engine?.isPlaying ? "pause" : "play"} size={18} color="#020202" />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 20 },
  title: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 18,
    padding: 12,
  },
  art: { width: 56, height: 56, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.08)" },
  info: { flex: 1, marginLeft: 12, marginRight: 10 },
  trackTitle: { color: "#fff", fontSize: 14, fontWeight: "700" },
  trackArtist: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 1 },
  scrubTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginTop: 8,
    overflow: "hidden",
  },
  scrubFill: { height: "100%", backgroundColor: AMBER, borderRadius: 2 },
  timeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  timeText: { color: "rgba(255,255,255,0.45)", fontSize: 10 },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AMBER,
    alignItems: "center",
    justifyContent: "center",
  },
});
