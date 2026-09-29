import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getDownloads } from "./libraryStorage";
import { getArtistPhoto, splitArtists } from "./artistImages";

const SIZE = 96;
const MAX_ARTISTS = 12;

function ArtistCard({ artist, tracks, fallbackArt, onPress }) {
  const [photo, setPhoto] = useState(null);

  useEffect(() => {
    let alive = true;
    getArtistPhoto(artist).then((u) => alive && setPhoto(u));
    return () => {
      alive = false;
    };
  }, [artist]);

  const uri = photo || fallbackArt;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {uri ? (
        <Image source={{ uri }} style={styles.photo} />
      ) : (
        <View style={[styles.photo, styles.photoFallback]}>
          <Ionicons name="person" size={34} color="#C89BFF" />
        </View>
      )}
      <Text numberOfLines={1} style={styles.name}>
        {artist}
      </Text>
      <Text style={styles.count}>
        {tracks.length} track{tracks.length === 1 ? "" : "s"}
      </Text>
    </TouchableOpacity>
  );
}

export default function ArtistsRow({ onTrackPress }) {
  const [artists, setArtists] = useState([]);

  useEffect(() => {
    getDownloads().then((downloads) => {
      const groups = new Map(); // lowercase name -> { artist, tracks }
      (downloads || []).forEach((track) => {
        splitArtists(track.artist).forEach((name) => {
          const key = name.toLowerCase();
          if (key === "unknown artist" || key === "unknown") return;
          if (!groups.has(key)) groups.set(key, { artist: name, tracks: [] });
          groups.get(key).tracks.push(track);
        });
      });
      const list = [...groups.values()]
        .sort((a, b) => b.tracks.length - a.tracks.length)
        .slice(0, MAX_ARTISTS)
        .map((g) => ({
          ...g,
          fallbackArt: (g.tracks.find((t) => t.artwork) || {}).artwork || null,
        }));
      setArtists(list);
    });
  }, []);

  if (artists.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Your Artists</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {artists.map((a) => (
          <ArtistCard
            key={a.artist.toLowerCase()}
            artist={a.artist}
            tracks={a.tracks}
            fallbackArt={a.fallbackArt}
            onPress={() => onTrackPress && onTrackPress(a.tracks[0], a.tracks)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 20 },
  title: { color: "#fff", fontSize: 17, fontWeight: "700", marginBottom: 12 },
  row: { paddingRight: 8 },
  card: { width: SIZE + 8, marginRight: 14, alignItems: "center" },
  photo: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 2,
    borderColor: "rgba(200,155,255,0.45)",
  },
  photoFallback: { alignItems: "center", justifyContent: "center" },
  name: { color: "#F5F3FA", fontSize: 13, fontWeight: "700", marginTop: 8, maxWidth: SIZE + 8 },
  count: { color: "rgba(245,243,250,0.55)", fontSize: 11, marginTop: 2 },
});
