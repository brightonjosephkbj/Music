import React, { useEffect, useState } from "react";
import { View, Image, StyleSheet } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { loadHomeBackground, subscribeHomeBackground } from "./homeBackground";

function VideoBg({ uri }) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true;
    p.muted = true;
    try {
      p.audioMixingMode = "mixWithOthers";
    } catch {}
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

export default function HomeBackground() {
  const [bg, setBg] = useState(null);

  useEffect(() => {
    loadHomeBackground(true).then(setBg);
    return subscribeHomeBackground(setBg);
  }, []);

  if (!bg || !bg.uri || !bg.type) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bg.type === "video" ? (
        <VideoBg key={bg.uri} uri={bg.uri} />
      ) : (
        <Image source={{ uri: bg.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      )}
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(2,2,2,${bg.dim})` }]}
      />
    </View>
  );
}
