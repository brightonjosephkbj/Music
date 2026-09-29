import React, { useEffect, useState } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getArtistPhoto, peekArtistPhoto } from "./artistImages";

const SKIP = /^unknown( artist)?$/i;

export default function LibraryArtistRow({ artist, tracks, onPress }) {
  const fallback = (tracks.find((t) => t.artwork) || {}).artwork || null;
  const [photo, setPhoto] = useState(SKIP.test(artist) ? null : peekArtistPhoto(artist));

  useEffect(() => {
    if (SKIP.test(artist)) return;
    let alive = true;
    getArtistPhoto(artist).then((u) => alive && setPhoto(u));
    return () => {
      alive = false;
    };
  }, [artist]);

  const uri = photo || fallback;

  return (
    <TouchableOpacity style={st.row} onPress={onPress} activeOpacity={0.8}>
      {uri ? (
        <Image source={{ uri }} style={st.photo} />
      ) : (
        <View style={[st.photo, st.center]}>
          <Ionicons name="person" size={24} color="#C89BFF" />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={st.name}>{artist}</Text>
        <Text style={st.count}>{tracks.length} track{tracks.length === 1 ? "" : "s"}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  photo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 2,
    borderColor: "rgba(200,155,255,0.45)",
  },
  center: { alignItems: "center", justifyContent: "center" },
  name: { color: "#F5F3FA", fontSize: 15, fontWeight: "700" },
  count: { color: "rgba(245,243,250,0.55)", fontSize: 12, marginTop: 2 },
});
