import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, Image, StyleSheet, TouchableOpacity, Animated, PanResponder,
  StatusBar, Modal, ActivityIndicator, useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { VideoView } from "expo-video";
import * as ScreenOrientation from "expo-screen-orientation";

const ACCENT = "#FF6B6B";
const PLAY_BG = "#FFFFFF"; // play/pause button fill
const PLAY_FG = "#101010"; // play/pause icon
const SEEK_AMOUNT = 10;
const HIDE_AFTER = 4000;
const DOUBLE_TAP = 280;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function fmt(sec) {
  sec = Math.max(0, sec || 0);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${s}` : `${m}:${s}`;
}

function PlayerInner({ track, engine, onClose, onNext, onPrev }) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [visible, setVisible] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubPct, setScrubPct] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [seekFb, setSeekFb] = useState(null);

  const opacity = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef(null);
  const fbTimer = useRef(null);
  const tapTimer = useRef(null);
  const lastTap = useRef(0);
  const trackW = useRef(0);
  const startX = useRef(0);
  const pctRef = useRef(0);

  const L = useRef({});
  L.current = { engine, visible, scrubbing, speedOpen, onClose, onNext, onPrev, width };

  // ---------- orientation ----------
  useEffect(() => {
    StatusBar.setHidden(true);
    ScreenOrientation.unlockAsync().catch(() => {});
    return () => {
      StatusBar.setHidden(false);
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  const toggleOrientation = async () => {
    try {
      await ScreenOrientation.lockAsync(
        isLandscape
          ? ScreenOrientation.OrientationLock.PORTRAIT_UP
          : ScreenOrientation.OrientationLock.LANDSCAPE
      );
    } catch {}
    showControls();
  };

  // ---------- show / hide controls ----------
  const hideControls = useCallback(() => {
    Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true })
      .start(({ finished }) => { if (finished) setVisible(false); });
  }, [opacity]);

  const showControls = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setVisible(true);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    hideTimer.current = setTimeout(() => {
      if (!L.current.scrubbing && !L.current.speedOpen) hideControls();
    }, HIDE_AFTER);
  }, [opacity, hideControls]);

  useEffect(() => {
    showControls();
    return () => {
      [hideTimer, fbTimer, tapTimer].forEach((t) => t.current && clearTimeout(t.current));
    };
  }, [track?.id]);

  // ---------- seek ----------
  const seekRelative = useCallback((amount) => {
    const eng = L.current.engine;
    if (!eng) return;
    const dur = eng.duration || 0;
    eng.seekTo(Math.max(0, Math.min(dur, (eng.position || 0) + amount)));
    setSeekFb(amount > 0 ? `+${amount}s` : `${amount}s`);
    if (fbTimer.current) clearTimeout(fbTimer.current);
    fbTimer.current = setTimeout(() => setSeekFb(null), 700);
    showControls();
  }, [showControls]);

  const seekPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        showControls();
        setScrubbing(true);
        startX.current = e.nativeEvent.locationX;
        const w = trackW.current || 1;
        pctRef.current = Math.max(0, Math.min(1, startX.current / w));
        setScrubPct(pctRef.current);
      },
      onPanResponderMove: (_, g) => {
        const w = trackW.current || 1;
        pctRef.current = Math.max(0, Math.min(1, (startX.current + g.dx) / w));
        setScrubPct(pctRef.current);
      },
      onPanResponderRelease: () => {
        const eng = L.current.engine;
        eng?.seekTo(pctRef.current * (eng?.duration || 0));
        setScrubbing(false);
        showControls();
      },
      onPanResponderTerminate: () => setScrubbing(false),
    })
  ).current;

  // ---------- video gestures ----------
  const videoPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderRelease: (e, g) => {
        const adx = Math.abs(g.dx);
        const ady = Math.abs(g.dy);
        if (adx < 10 && ady < 10) {
          const now = Date.now();
          if (now - lastTap.current < DOUBLE_TAP) {
            lastTap.current = 0;
            if (tapTimer.current) clearTimeout(tapTimer.current);
            seekRelative(g.x0 < L.current.width / 2 ? -SEEK_AMOUNT : SEEK_AMOUNT);
            return;
          }
          lastTap.current = now;
          tapTimer.current = setTimeout(() => {
            if (L.current.visible) hideControls();
            else showControls();
          }, DOUBLE_TAP);
          return;
        }
        if (ady > adx && g.dy > 60) { L.current.onClose && L.current.onClose(); return; }
        if (adx > ady) {
          if (g.dx < -60) { L.current.onNext && L.current.onNext(); showControls(); }
          else if (g.dx > 60) { L.current.onPrev && L.current.onPrev(); showControls(); }
        }
      },
    })
  ).current;

  // ---------- mute / speed ----------
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    try { if (engine?.videoPlayer) engine.videoPlayer.muted = next; } catch {}
    showControls();
  };

  const changeSpeed = (v) => {
    setSpeed(v);
    if (typeof engine?.setRate === "function") engine.setRate(v);
    else { try { if (engine?.videoPlayer) engine.videoPlayer.playbackRate = v; } catch {} }
    setSpeedOpen(false);
    showControls();
  };

  // ---------- auto next ----------
  const advanced = useRef(false);
  useEffect(() => { advanced.current = false; }, [track?.id]);
  useEffect(() => {
    if (!engine?.duration || advanced.current) return;
    if (engine.position > 1 && engine.position >= engine.duration - 0.5) {
      advanced.current = true;
      onNext && onNext();
    }
  }, [engine?.position, engine?.duration]);

  // ---------- loading state ----------
  if (!engine?.videoPlayer || track?.pending) {
    return (
      <View style={st.loadingRoot}>
        <StatusBar hidden />
        {!!track?.artwork && (
          <Image source={{ uri: track.artwork }} style={[StyleSheet.absoluteFill, { opacity: 0.25 }]} blurRadius={20} />
        )}
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={st.loadTitle} numberOfLines={2}>{track?.title || "Loading video"}</Text>
        <Text style={st.loadSub}>Getting your video ready...</Text>
        <TouchableOpacity onPress={onClose} style={st.loadBack}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  const duration = engine.duration || 0;
  const pct = scrubbing ? scrubPct : duration ? Math.min(1, (engine.position || 0) / duration) : 0;
  const shownPos = scrubbing ? scrubPct * duration : engine.position || 0;
  const pad = isLandscape ? { paddingTop: 14, paddingBottom: 14, paddingHorizontal: 36 }
                          : { paddingTop: 40, paddingBottom: 30, paddingHorizontal: 18 };

  return (
    <View style={st.root}>
      <StatusBar hidden />

      <View style={StyleSheet.absoluteFill} {...videoPan.panHandlers}>
        <VideoView
          player={engine.videoPlayer}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          nativeControls={false}
          surfaceType="textureView"
        />
      </View>

      {engine.isBuffering && (
        <View style={st.centerAbs} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      {!!seekFb && (
        <View style={st.centerAbs} pointerEvents="none">
          <Text style={st.seekFb}>{seekFb}</Text>
        </View>
      )}

      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity }]}
        pointerEvents={visible ? "box-none" : "none"}
      >
        <View style={[st.overlay, pad]} pointerEvents="box-none">
          {/* TOP */}
          <View style={st.topRow}>
            <TouchableOpacity onPress={onClose} style={st.circleBtn}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={st.titlePill}>
              <Text style={st.title} numberOfLines={1}>{track?.title || "Unknown title"}</Text>
              <Text style={st.artist} numberOfLines={1}>{track?.artist || ""}</Text>
            </View>
            <TouchableOpacity
              onPress={() => { setSpeedOpen((v) => !v); showControls(); }}
              style={[st.circleBtn, { width: 56, borderRadius: 22 }]}
            >
              <Text style={st.speedTxt}>{speed}x</Text>
            </TouchableOpacity>
          </View>

          {/* CENTER */}
          <View style={st.centerRow} pointerEvents="box-none">
            <TouchableOpacity onPress={() => { onPrev && onPrev(); showControls(); }} style={st.sideBtn}>
              <Ionicons name="play-skip-back" size={28} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => seekRelative(-SEEK_AMOUNT)} style={st.sideBtn}>
              <Ionicons name="play-back" size={24} color="#fff" />
              <Text style={st.skipNum}>10</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { engine.toggle(); showControls(); }}
              style={st.playBtn}
              activeOpacity={0.85}
            >
              <Ionicons name={engine.isPlaying ? "pause" : "play"} size={36} color={PLAY_FG} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => seekRelative(SEEK_AMOUNT)} style={st.sideBtn}>
              <Ionicons name="play-forward" size={24} color="#fff" />
              <Text style={st.skipNum}>10</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { onNext && onNext(); showControls(); }} style={st.sideBtn}>
              <Ionicons name="play-skip-forward" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* BOTTOM */}
          <View style={st.bottomPanel}>
            <TouchableOpacity onPress={toggleMute} style={st.extraBtn}>
              <Ionicons name={muted ? "volume-mute" : "volume-high"} size={18} color="#fff" />
            </TouchableOpacity>
            <Text style={[st.time, { marginLeft: 8 }]}>{fmt(shownPos)}</Text>
            <View
              style={st.seekHit}
              onLayout={(e) => { trackW.current = e.nativeEvent.layout.width; }}
              {...seekPan.panHandlers}
            >
              <View style={st.seekTrack} pointerEvents="none">
                <View style={[st.seekFill, { width: `${pct * 100}%` }]} />
              </View>
              <View
                pointerEvents="none"
                style={[st.seekDot, { left: `${pct * 100}%`, transform: [{ scale: scrubbing ? 1.4 : 1 }] }]}
              />
            </View>
            <Text style={st.time}>{fmt(duration)}</Text>
            <TouchableOpacity onPress={toggleOrientation} style={[st.extraBtn, { marginLeft: 8 }]}>
              <Ionicons name={isLandscape ? "contract" : "expand"} size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {speedOpen && (
        <View style={[st.speedMenu, { top: isLandscape ? 70 : 96 }]}>
          {SPEEDS.map((v) => (
            <TouchableOpacity key={v} onPress={() => changeSpeed(v)} style={st.speedItem}>
              <Text style={[st.speedItemTxt, speed === v && { color: ACCENT, fontWeight: "800" }]}>{v}x</Text>
              {speed === v && <Ionicons name="checkmark" size={18} color={ACCENT} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const GLASS = "rgba(20,20,25,0.6)";
const BORDER = "rgba(255,255,255,0.18)";

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  loadingRoot: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  loadTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginTop: 20, textAlign: "center" },
  loadSub: { color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 6 },
  loadBack: {
    position: "absolute", top: 40, left: 18, width: 44, height: 44, borderRadius: 22,
    backgroundColor: GLASS, borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center",
  },
  overlay: { flex: 1, justifyContent: "space-between" },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  circleBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: GLASS,
    borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center",
  },
  titlePill: {
    flex: 1, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18,
    backgroundColor: GLASS, borderWidth: 1, borderColor: BORDER, alignItems: "center",
  },
  title: { color: "#fff", fontSize: 14, fontWeight: "700" },
  artist: { color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 2 },
  speedTxt: { color: "#fff", fontSize: 12, fontWeight: "700" },
  centerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14 },
  sideBtn: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: GLASS,
    alignItems: "center", justifyContent: "center",
  },
  skipNum: { position: "absolute", color: "#fff", fontSize: 8, fontWeight: "800", marginTop: 1 },
  playBtn: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: PLAY_BG,
    alignItems: "center", justifyContent: "center", elevation: 8,
  },
  bottomPanel: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: GLASS, borderWidth: 1, borderColor: BORDER,
    borderRadius: 22, paddingHorizontal: 10, paddingVertical: 6,
  },
  seekHit: { flex: 1, height: 28, justifyContent: "center", marginHorizontal: 8 },
  seekTrack: { height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.28)", overflow: "hidden" },
  seekFill: { height: "100%", backgroundColor: ACCENT },
  seekDot: {
    position: "absolute", top: 8, width: 12, height: 12, borderRadius: 6,
    marginLeft: -6, backgroundColor: ACCENT,
  },
  timeRow: { flexDirection: "row", justifyContent: "space-between" },
  time: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "600" },
  extraRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  extraBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  centerAbs: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  seekFb: {
    color: "#fff", fontSize: 18, fontWeight: "800", backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, overflow: "hidden",
  },
  speedMenu: {
    position: "absolute", right: 18, width: 160, paddingVertical: 6, borderRadius: 18,
    backgroundColor: "rgba(20,20,25,0.95)", borderWidth: 1, borderColor: BORDER, elevation: 20, zIndex: 20,
  },
  speedItem: {
    height: 42, paddingHorizontal: 16, flexDirection: "row",
    alignItems: "center", justifyContent: "space-between",
  },
  speedItemTxt: { color: "#fff", fontSize: 14 },
});

export default function FullscreenVideoPlayer(props) {
  return (
    <Modal
      visible
      animationType="fade"
      statusBarTranslucent
      supportedOrientations={["portrait", "landscape"]}
      onRequestClose={props.onClose}
    >
      <PlayerInner {...props} />
    </Modal>
  );
}
