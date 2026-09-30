import React, { useEffect, useState } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getArtistPhoto, peekArtistPhoto } from "./artistImages";

const SKIP = /^unknown( artist)?$/i;

// 3-per-row circular artist card (width comes from the 33.33% cell)
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
    <TouchableOpacity style={st.cell} onPress={onPress} activeOpacity={0.8}>
      {uri ? (
        <Image source={{ uri }} style={st.photo} />
      ) : (
        <View style={[st.photo, st.center]}>
          <Ionicons name="person" size={34} color="#C89BFF" />
        </View>
      )}
      <Text numberOfLines={1} style={st.name}>{artist}</Text>
      <Text numberOfLines={1} style={st.count}>
        {tracks.length} track{tracks.length === 1 ? "" : "s"}
      </Text>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  cell: {
    width: "33.3333%",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  photo: {
    width: "88%",
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 2,
    borderColor: "rgba(200,155,255,0.45)",
  },
  center: { alignItems: "center", justifyContent: "center" },
  name: { color: "#F5F3FA", fontSize: 13, fontWeight: "700", marginTop: 8, maxWidth: "100%" },
  count: { color: "rgba(245,243,250,0.55)", fontSize: 11, marginTop: 2 },
});
