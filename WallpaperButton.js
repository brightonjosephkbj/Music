import React, { useState } from "react";
import { TouchableOpacity, Text, Alert, Platform, ActivityIndicator } from "react-native";
import { loadHomeBackground } from "./homeBackground";
import { prepareWallpaperVideo, openLiveWallpaperPicker } from "./liveWallpaper";

export default function WallpaperButton({ style }) {
  const [busy, setBusy] = useState(false);
  if (Platform.OS !== "android") return null;

  const onPress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const bg = await loadHomeBackground(true);
      if (!bg || bg.type !== "video" || !bg.uri) {
        Alert.alert("Pick a video background first", "The live wallpaper uses the video you set as your Home background.");
        return;
      }
      await prepareWallpaperVideo(bg.uri);
      const ok = await openLiveWallpaperPicker();
      if (!ok) Alert.alert("Open your wallpaper settings", "Choose Live wallpapers, then Obsidian, then Apply.");
    } catch (e) {
      Alert.alert("Couldn't set wallpaper", String((e && e.message) || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[{ height: 48, borderRadius: 24, paddingHorizontal: 20, backgroundColor: "#FF7A3D", alignItems: "center", justifyContent: "center" }, style]}
    >
      {busy ? <ActivityIndicator color="#121110" /> : <Text style={{ color: "#121110", fontSize: 15, fontWeight: "700" }}>Set live wallpaper to home screen</Text>}
    </TouchableOpacity>
  );
}
