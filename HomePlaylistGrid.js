import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPlaylists, getDownloads } from "./libraryStorage";
import { memoGet, memoSet } from "./memoCache";

const GAP = 10;
const TILE_W = (Dimensions.get("window").width - 40 - GAP) / 2;
const PLAYS_KEY = "b24_playlist_plays_v1";
const MAX_TILES = 6;
const PINNED = /^(favou?rites?|liked songs)$/i;

async function loadPlays() {
  try {
    const raw = await AsyncStorage.getItem(PLAYS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function bumpPlay(id) {
  const plays = await loadPlays();
  const cur = plays[id] || { count: 0, last: 0 };
  plays[id] = { count: cur.count + 1, last: Date.now() };
  try {
    await AsyncStorage.setItem(PLAYS_KEY, JSON.stringify(plays));
  } catch {}
}

// playlist ids look like "playlist_<timestamp>", newest = biggest number
const createdAt = (p) => Number(String(p.id).split("_")[1]) || 0;

function rank(playlists, plays) {
  const pinned = playlists.find((p) => PINNED.test(p.name || ""));
  const rest = playlists
    .filter((p) => p !== pinned)
    .sort((a, b) => {
      const pa = plays[a.id] || { count: 0, last: 0 };
      const pb = plays[b.id] || { count: 0, last: 0 };
      if (pb.count !== pa.count) return pb.count - pa.count;
      if (pb.last !== pa.last) return pb.last - pa.last;
      return createdAt(b) - createdAt(a);
    });
  return (pinned ? [pinned, ...rest] : rest).slice(0, MAX_TILES);
}

export default function PlaylistGrid({ onTrackPress }) {
  const [playlists, setPlaylists] = useState((memoGet("pg") || {}).playlists || []);
  const [downloads, setDownloads] = useState((memoGet("pg") || {}).downloads || []);
  const [plays, setPlays] = useState((memoGet("pg") || {}).plays || {});

  const load = useCallback(async () => {
    const [p, d, pl] = await Promise.all([getPlaylists(), getDownloads(), loadPlays()]);
    const pls = (p || []).filter((x) => x.trackIds && x.trackIds.length > 0);
    memoSet("pg", { playlists: pls, downloads: d || [], plays: pl });
    setPlaylists(pls);
    setDownloads(d || []);
    setPlays(pl);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (playlists.length === 0) return null;

  const play = async (playlist) => {
    const byId = new Map(downloads.map((d) => [d.id, d]));
    const queue = playlist.trackIds.map((id) => byId.get(id)).filter(Boolean);
    if (queue.length === 0) return;
    onTrackPress && onTrackPress(queue[0], queue);
    await bumpPlay(playlist.id);
    load();
  };

  const tiles = rank(playlists, plays);

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Your Playlists</Text>
      <View style={styles.grid}>
        {tiles.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={styles.tile}
            onPress={() => play(p)}
            activeOpacity={0.85}
          >
            {p.art ? (
              <Image source={{ uri: p.art }} style={styles.art} />
            ) : (
              <View style={[styles.art, styles.artFallback]}>
                <Ionicons
                  name={PINNED.test(p.name || "") ? "heart" : "albums"}
                  size={22}
                  color="#C89BFF"
                />
              </View>
            )}
            <Text numberOfLines={2} style={styles.name}>
              {p.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 20 },
  title: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  tile: {
    width: TILE_W,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  art: { width: 56, height: 56, backgroundColor: "rgba(255,255,255,0.08)" },
  artFallback: { alignItems: "center", justifyContent: "center" },
  name: { flex: 1, color: "#F5F3FA", fontSize: 13, fontWeight: "700", paddingHorizontal: 10 },
});
