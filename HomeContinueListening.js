import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getListeningHistory } from "./listeningHistory";

const ORCHID = "#C89BFF";
const INK = "#0B0A0F";

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

  if (!entry) return null;

  const isActive =
    !!nowPlaying &&
    String(nowPlaying.id) === String(entry.id) &&
    (nowPlaying.provider || null) === (entry.provider || null);

  const position = isActive ? engine?.position || 0 : 0;
  const duration = isActive ? engine?.duration || 0 : entry.duration || 0;
  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;
  const playing = isActive && !!engine?.isPlaying;

  const handlePlay = () => {
    if (isActive) {
      engine?.toggle && engine.toggle();
      return;
    }
    onTrackPress && onTrackPress(entry);
  };

  return (
    <TouchableOpacity style={styles.card} onPress={handlePlay} activeOpacity={0.92}>
      {!!entry.artwork && (
        <Image
          source={{ uri: entry.artwork }}
          style={StyleSheet.absoluteFill}
          blurRadius={28}
          resizeMode="cover"
        />
      )}
      <View style={styles.scrim} />

      <Image
        source={entry.artwork ? { uri: entry.artwork } : undefined}
        style={styles.art}
      />

      <View style={styles.info}>
        <Text style={styles.label}>CONTINUE LISTENING</Text>
        <Text numberOfLines={1} style={styles.title}>{entry.title}</Text>
        <Text numberOfLines={1} style={styles.artist}>{entry.artist}</Text>

        {duration > 0 ? (
          <>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${progress * 100}%` }]} />
            </View>
            <View style={styles.timeRow}>
              <Text style={styles.time}>{formatTime(position)}</Text>
              <Text style={styles.time}>{formatTime(duration)}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.resume}>Tap to resume</Text>
        )}
      </View>

      <TouchableOpacity
        style={styles.playBtn}
        onPress={handlePlay}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name={playing ? "pause" : "play"} size={20} color={INK} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 26,
    overflow: "hidden",
    padding: 14,
    marginBottom: 20,
    backgroundColor: "#15121C",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(11,10,15,0.72)" },
  art: { width: 96, height: 96, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.08)" },
  info: { flex: 1, marginLeft: 14, marginRight: 10 },
  label: { color: ORCHID, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: "#F5F3FA", fontSize: 16, fontWeight: "800", marginTop: 3 },
  artist: { color: "rgba(245,243,250,0.65)", fontSize: 12, marginTop: 2 },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(200,155,255,0.3)",
    marginTop: 10,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: ORCHID, borderRadius: 2 },
  timeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  time: { color: "rgba(245,243,250,0.5)", fontSize: 10 },
  resume: { color: "rgba(245,243,250,0.5)", fontSize: 11, marginTop: 10 },
  playBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: ORCHID,
    alignItems: "center",
    justifyContent: "center",
  },
});
