import React, { useEffect, useState } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getArtistPhoto, peekArtistPhoto } from "./artistImages";

const ORCHID = "#C89BFF";
const INK = "#0B0A0F";
const SKIP = /^unknown( artist)?$/i;

export default function ArtistHero({ artist, tracks, onBack, onPlay, onShuffle, onSort, onSearch }) {
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
    <View style={st.wrap}>
      {!!uri && <Image source={{ uri }} style={StyleSheet.absoluteFill} blurRadius={30} />}
      <View style={st.scrim} />

      <View style={st.topRow}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ flexDirection: "row", gap: 18 }}>
          {!!onSearch && (
            <TouchableOpacity onPress={onSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="search" size={22} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onSort} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="swap-vertical" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {uri ? (
        <Image source={{ uri }} style={st.photo} />
      ) : (
        <View style={[st.photo, st.center]}>
          <Ionicons name="person" size={54} color={ORCHID} />
        </View>
      )}

      <Text numberOfLines={2} style={st.name}>{artist}</Text>
      <Text style={st.meta}>
        {tracks.length} track{tracks.length === 1 ? "" : "s"}
      </Text>

      <View style={st.btnRow}>
        <TouchableOpacity style={st.play} onPress={onPlay} activeOpacity={0.85}>
          <Ionicons name="play" size={16} color={INK} />
          <Text style={st.playTxt}>Play</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.shuffle} onPress={onShuffle} activeOpacity={0.85}>
          <Ionicons name="shuffle" size={16} color="#F5F3FA" />
          <Text style={st.shuffleTxt}>Shuffle</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingTop: 54,
    paddingBottom: 20,
    paddingHorizontal: 20,
    marginBottom: 6,
    overflow: "hidden",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    backgroundColor: "#15121C",
  },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(11,10,15,0.7)" },
  topRow: {
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  photo: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 3,
    borderColor: "rgba(200,155,255,0.55)",
  },
  center: { alignItems: "center", justifyContent: "center" },
  name: { color: "#F5F3FA", fontSize: 26, fontWeight: "800", marginTop: 14, textAlign: "center" },
  meta: { color: "rgba(245,243,250,0.6)", fontSize: 13, marginTop: 4 },
  btnRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  play: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: ORCHID, paddingHorizontal: 26, paddingVertical: 11, borderRadius: 24,
  },
  playTxt: { color: INK, fontWeight: "800", fontSize: 15 },
  shuffle: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.12)", paddingHorizontal: 22, paddingVertical: 11, borderRadius: 24,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  shuffleTxt: { color: "#F5F3FA", fontWeight: "700", fontSize: 15 },
});
