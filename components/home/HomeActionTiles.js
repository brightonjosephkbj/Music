import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

// ---------------------------------------------------------------------------
// Three gradient action tiles for the top of Home, replacing the old
// PasteUrlCard + RecentPlayedCard pairing. AI Music was previously a header
// icon (onAIChatPress) - it now lives here as its own tile instead, so
// there's one entry point for it, not two.
// ---------------------------------------------------------------------------
const TILES_META = {
  paste: {
    label: "Paste a Link",
    subtitle: "Download in seconds",
    icon: "link",
    colors: ["#8E54E9", "#4776E6"],
  },
  downloads: {
    label: "Downloads",
    subtitle: "Your offline music",
    icon: "download",
    colors: ["#11998e", "#38ef7d"],
  },
  ai: {
    label: "AI Music",
    subtitle: "Chat & Create",
    icon: "sparkles",
    colors: ["#4facfe", "#3730a3"],
  },
};

function ActionTile({ meta, onPress }) {
  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.85}>
      <LinearGradient
        colors={meta.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.iconGlass}>
        <Ionicons name={meta.icon} size={16} color="#fff" />
      </View>
      <View>
        <Text style={styles.tileLabel} numberOfLines={1}>{meta.label}</Text>
        <Text style={styles.tileSubtitle} numberOfLines={1}>{meta.subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

// onDownloadsPress is new - wire it up from the parent navigator to
// whichever screen shows offline/downloaded tracks.
export default function ActionTilesRow({ onPasteLinkPress, onDownloadsPress, onAIChatPress }) {
  return (
    <View style={styles.row}>
      <ActionTile meta={TILES_META.paste} onPress={onPasteLinkPress} />
      <ActionTile meta={TILES_META.ai} onPress={onAIChatPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, marginBottom: 20 },
  tile: {
    flex: 1,
    height: 100,
    borderRadius: 16,
    overflow: "hidden",
    padding: 10,
    justifyContent: "space-between",
  },
  iconGlass: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: { color: "#fff", fontSize: 14, fontWeight: "700" },
  tileSubtitle: { color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 1 },
});
