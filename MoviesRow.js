import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Modal, Linking, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { API_BASE, gatewayHeaders } from "./apiClient";

function MoviePlayerModal({ movie, onClose }) {
  const player = useVideoPlayer(movie.url, (p) => {
    p.play();
  });

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.playerRoot}>
        <TouchableOpacity style={styles.playerClose} onPress={onClose}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        <VideoView
          style={styles.playerVideo}
          player={player}
          allowsFullscreen
          allowsPictureInPicture
          nativeControls
        />
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Check Out Direct Movies - horizontal poster row backed by B24_downloads'
// generic /files endpoint (category=movie / category=poster, joined by
// ref_id). Tapping a poster opens a Stream/Download sheet.
//
// NOTE: confirm DOWNLOADS_PATH matches whatever prefix your gateway's
// SERVICES registry maps to the downloads service, same as "/api/apicache"
// maps to Api-cache elsewhere in this file's siblings.
// ---------------------------------------------------------------------------
const DOWNLOADS_PATH = "/api/downloads";

const CANDY_BLUE = "#B2D5E5";
const GLASS_BG = "rgba(178,213,229,0.10)";
const GLASS_BORDER = "rgba(178,213,229,0.28)";

function stripExt(filename) {
  return (filename || "").replace(/\.[^/.]+$/, "");
}

export default function MoviesRow() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [loadedPosters, setLoadedPosters] = useState({});
  const [streamingMovie, setStreamingMovie] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [movieRes, posterRes] = await Promise.all([
          fetch(`${API_BASE}${DOWNLOADS_PATH}/files?app_id=b24music&category=movie&limit=50`, {
            headers: gatewayHeaders(),
          }),
          fetch(`${API_BASE}${DOWNLOADS_PATH}/files?app_id=b24music&category=poster&limit=50`, {
            headers: gatewayHeaders(),
          }),
        ]);
        const movieData = await movieRes.json();
        const posterData = await posterRes.json();
        if (cancelled) return;

        // poster.ref_id points back at the movie's file id
        const posterByMovieId = new Map(
          (posterData.data || []).map((p) => [p.ref_id, p])
        );
        const joined = (movieData.data || []).map((m) => ({
          ...m,
          poster: posterByMovieId.get(m.id)?.url || null,
        }));
        setMovies(joined);
      } catch (e) {
        // silent fail - row just won't render, same pattern as SimilarRow etc.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading || movies.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Check Out Direct Movies</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {movies.map((movie) => (
          <TouchableOpacity
            key={movie.id}
            style={styles.card}
            onPress={() => setSelected(movie)}
            activeOpacity={0.85}
          >
            {movie.poster ? (
              <View style={styles.poster}>
                <Image
                  source={{ uri: movie.poster }}
                  style={StyleSheet.absoluteFill}
                  onLoadEnd={() => setLoadedPosters((p) => ({ ...p, [movie.id]: true }))}
                />
                {!loadedPosters[movie.id] && (
                  <View style={[StyleSheet.absoluteFill, styles.posterFallback]}>
                    <ActivityIndicator color={CANDY_BLUE} />
                  </View>
                )}
              </View>
            ) : (
              <View style={[styles.poster, styles.posterFallback]}>
                <Ionicons name="film" size={24} color={CANDY_BLUE} />
              </View>
            )}
            <Text numberOfLines={1} style={styles.title}>{stripExt(movie.filename)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ---------- Stream / Download bottom sheet ---------- */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setSelected(null)}>
          <View style={styles.sheet}>
            {selected?.poster && (
              <Image source={{ uri: selected.poster }} style={styles.sheetPoster} />
            )}
            <Text numberOfLines={2} style={styles.sheetTitle}>{stripExt(selected?.filename || "")}</Text>

            <TouchableOpacity
              style={styles.sheetButton}
              onPress={() => {
                if (!selected) return;
                setStreamingMovie(selected);
                setSelected(null);
              }}
            >
              <Ionicons name="play" size={16} color="#020202" />
              <Text style={styles.sheetButtonText}>Stream</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetButton, styles.sheetButtonOutline]}
              onPress={() => selected && Linking.openURL(selected.url)}
            >
              <Ionicons name="download" size={16} color={CANDY_BLUE} />
              <Text style={[styles.sheetButtonText, styles.sheetButtonTextOutline]}>Download</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {streamingMovie && (
        <MoviePlayerModal movie={streamingMovie} onClose={() => setStreamingMovie(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 22 },
  sectionTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 10, paddingHorizontal: 20 },
  row: { paddingHorizontal: 20, paddingRight: 8 },
  card: { width: 128, marginRight: 12 },
  poster: {
    width: "100%",
    height: 176,
    borderRadius: 12,
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginBottom: 8,
  },
  posterFallback: { alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: 13, fontWeight: "600" },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "rgba(20,20,25,0.96)",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderTopWidth: 1,
    borderColor: GLASS_BORDER,
  },
  sheetPoster: { width: 90, height: 130, borderRadius: 10, alignSelf: "center", marginBottom: 12 },
  sheetTitle: { color: "#fff", fontSize: 16, fontWeight: "700", textAlign: "center", marginBottom: 16 },
  sheetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: CANDY_BLUE,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  sheetButtonOutline: { backgroundColor: "transparent", borderWidth: 1, borderColor: GLASS_BORDER },
  sheetButtonText: { color: "#020202", fontWeight: "700", fontSize: 14 },
  sheetButtonTextOutline: { color: CANDY_BLUE },

  playerRoot: { flex: 1, backgroundColor: "#000" },
  playerVideo: { flex: 1 },
  playerClose: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
});
