import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, Pressable, Image, Alert, StyleSheet, ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import {
  DEFAULT_BG, loadHomeBackground, saveHomeBackground, importIntoApp, discardImported,
} from "./homeBackground";
import { getDownloads } from "./libraryStorage";

const MAX_BYTES = 20 * 1024 * 1024;
const isVideo = (d) =>
  !!d.localUri && (d.type === "video" || /\.(mp4|mkv|webm|mov)$/i.test(d.localUri));

export default function HomeBackgroundScreen({ onBack }) {
  const [bg, setBg] = useState(DEFAULT_BG);
  const [videos, setVideos] = useState([]);
  const [showLib, setShowLib] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadHomeBackground(true).then(setBg);
    getDownloads().then((d) => setVideos((d || []).filter(isVideo))).catch(() => {});
  }, []);

  const apply = async (patch) => setBg(await saveHomeBackground({ ...bg, ...patch }));

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Permission needed", "Allow photo access to pick a background.");
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.8,
    });
    if (res.canceled) return;
    const a = res.assets[0];
    const type = a.type === "video" ? "video" : "image";
    if (type === "video" && a.fileSize && a.fileSize > MAX_BYTES) {
      return Alert.alert("Video too large", "Pick a clip under 20 MB. Short loops work best.");
    }
    setBusy(true);
    const ext = (a.uri.split(".").pop() || (type === "video" ? "mp4" : "jpg")).split("?")[0];
    const uri = await importIntoApp(a.uri, ext);
    discardImported(bg.uri);
    await apply({ type, uri });
    setBusy(false);
  };

  const pickFromLibrary = async (d) => {
    discardImported(bg.uri);
    await apply({ type: "video", uri: d.localUri });
    setShowLib(false);
  };

  const remove = async () => {
    discardImported(bg.uri);
    setBg(await saveHomeBackground({ ...DEFAULT_BG, dim: bg.dim }));
  };

  return (
    <ScrollView style={st.screen} contentContainerStyle={{ padding: 20, paddingBottom: 130 }}>
      <View style={st.header}>
        {onBack && (
          <Pressable onPress={onBack}>
            <Text style={st.back}>‹ Back</Text>
          </Pressable>
        )}
        <Text style={st.title}>Home background</Text>
      </View>

      <View style={st.preview}>
        {bg.uri && bg.type === "image" && (
          <Image source={{ uri: bg.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        )}
        {bg.uri && bg.type === "video" && (
          <View style={[StyleSheet.absoluteFill, st.center]}>
            <Ionicons name="videocam" size={34} color="#C89BFF" />
            <Text style={st.hint}>Video background set</Text>
          </View>
        )}
        {!bg.uri && <Text style={st.hint}>No background set</Text>}
        {!!bg.uri && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(2,2,2,${bg.dim})` }]} />
        )}
      </View>

      <Pressable style={st.btn} onPress={pickFromGallery} disabled={busy}>
        {busy ? <ActivityIndicator color="#0B0A0F" /> : <Text style={st.btnTxt}>Choose from gallery</Text>}
      </Pressable>
      <Pressable style={st.btnAlt} onPress={() => setShowLib(!showLib)}>
        <Text style={st.btnAltTxt}>Choose from Library videos</Text>
      </Pressable>

      {showLib && (
        <View style={{ marginTop: 10 }}>
          {videos.length === 0 ? (
            <Text style={st.hint}>No downloaded videos found.</Text>
          ) : (
            videos.map((d) => (
              <Pressable key={`${d.provider || ""}-${d.id}`} style={st.vrow} onPress={() => pickFromLibrary(d)}>
                <Image source={d.artwork ? { uri: d.artwork } : undefined} style={st.vthumb} />
                <Text numberOfLines={2} style={st.vtitle}>{d.title}</Text>
              </Pressable>
            ))
          )}
        </View>
      )}

      {!!bg.uri && (
        <>
          <Text style={st.section}>Dimming</Text>
          <View style={st.row}>
            {[["Light", 0.35], ["Medium", 0.6], ["Dark", 0.78], ["Darker", 0.9]].map(([l, v]) => (
              <Pressable key={l} onPress={() => apply({ dim: v })} style={[st.chip, bg.dim === v && st.chipOn]}>
                <Text style={[st.chipTxt, bg.dim === v && st.chipTxtOn]}>{l}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={st.remove} onPress={remove}>
            <Text style={st.removeTxt}>Remove background</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B0A0F" },
  header: { marginTop: 30, marginBottom: 16 },
  back: { color: "#C89BFF", fontSize: 16, marginBottom: 8 },
  title: { color: "#F5F3FA", fontSize: 28, fontWeight: "800" },
  preview: {
    height: 180, borderRadius: 22, overflow: "hidden", backgroundColor: "#1A1822",
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  center: { alignItems: "center", justifyContent: "center" },
  hint: { color: "#B8B3C4", fontSize: 13, marginTop: 6 },
  btn: { backgroundColor: "#C89BFF", borderRadius: 16, padding: 14, alignItems: "center" },
  btnTxt: { color: "#0B0A0F", fontWeight: "800", fontSize: 15 },
  btnAlt: { marginTop: 10, backgroundColor: "#1A1822", borderRadius: 16, padding: 14, alignItems: "center" },
  btnAltTxt: { color: "#F5F3FA", fontWeight: "700", fontSize: 15 },
  vrow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 12 },
  vthumb: { width: 64, height: 44, borderRadius: 8, backgroundColor: "#1A1822" },
  vtitle: { flex: 1, color: "#F5F3FA", fontSize: 14 },
  section: { color: "#B8B3C4", fontSize: 13, fontWeight: "700", marginTop: 22, marginBottom: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: "#1A1822" },
  chipOn: { backgroundColor: "#C89BFF" },
  chipTxt: { color: "#F5F3FA", fontSize: 14 },
  chipTxtOn: { color: "#0B0A0F", fontWeight: "700" },
  remove: { marginTop: 26, alignItems: "center", padding: 14, borderRadius: 14, backgroundColor: "#1A1822" },
  removeTxt: { color: "#FF7A90", fontWeight: "700" },
});
