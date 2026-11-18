import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from "expo-audio";
import { useVideoPlayer } from "expo-video";
import { loadAudioSettings, subscribe as subscribeAudioSettings, applyToPlayers, trackKey } from "../data/audioSettings";
import { useEvent } from "expo";
import { AppState } from "react-native";
import { logPlay } from "../data/listeningHistory";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  loadEqualizerSettings,
  subscribeEqualizerSettings,
} from "../equalizerSettings";


// ---------------------------------------------------------------------------
// Unified playback engine for both mp3 (expo-audio) and mp4 (expo-video).
//
// track shape expected: { type: "audio" | "video", localUri?, stream_url?,
// download_url? }. Source priority: a local downloaded file always wins over
// a remote stream URL, so playback keeps working offline once downloaded.
//
// IMPORTANT ARCHITECTURE NOTE: both useAudioPlayer(source) and
// useVideoPlayer(source, setup) only read their `source` argument on the
// very first render that creates the player - changing it on a later
// render does NOT reload the player. Since this hook is a single top-level
// instance shared across the whole app (App.js calls it once, tracks
// change over time), both players are created once with a null source,
// and every subsequent track change explicitly calls .replace()/
// videoPlayer.replace() - the documented, reliable way to swap what an
// already-created player is pointed at.
// ---------------------------------------------------------------------------

function resolveUri(track) {
  if (!track) return null;
  return track.localUri || track.stream_url || track.download_url || null;
}

function videoSource(uri) {
  const isRemote = /^https?:\/\//i.test(uri);
  const isHls = /\.m3u8(?:$|[?#])/i.test(uri);
  return { uri, useCaching: isRemote && !isHls };
}

const MIN_PLAY_SECONDS = 30;
const VIDEO_POSITIONS_KEY = "b24music:videoResumePositions";
const MAX_SAVED_VIDEO_POSITIONS = 100;

// Configures the audio session once, app-wide, so playback survives the
// screen locking or the app backgrounding. Without this, expo-audio stops
// the moment the app loses focus - this was previously never called at all.
let audioModeConfigured = false;
async function ensureAudioMode() {
  if (audioModeConfigured) return;
  audioModeConfigured = true;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
      interruptionModeAndroid: "doNotMix",
    });
  } catch (err) {
    console.warn("Failed to configure background audio mode:", err);
  }
}

export default function usePlaybackEngine(track) {
  useEffect(() => {
    ensureAudioMode();
  }, []);

  const isVideo = track?.type === "video";
  const uri = resolveUri(track);

  // ---- Audio branch (expo-audio) - created once, idle, no initial source ----
  const audioPlayer = useAudioPlayer(null, { updateInterval: 250 });
  const audioStatus = useAudioPlayerStatus(audioPlayer);

  // ---- Obsidian equalizer: apply settings to the actual Expo Audio player ----
  const [equalizerSettings, setEqualizerSettings] = useState(null);

  useEffect(() => {
    let mounted = true;

    const receiveSettings = (settings) => {
      if (mounted) setEqualizerSettings(settings);
    };

    loadEqualizerSettings().then(receiveSettings);
    const unsubscribe = subscribeEqualizerSettings(receiveSettings);

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!equalizerSettings || !audioPlayer) return;
    if (typeof audioPlayer.setEqualizer !== "function") return;

    // Stored presets use millibels and 0-1000 bass.
    // The native Expo Audio bridge accepts dB and 0-100 bass.
    audioPlayer.setEqualizer(
      equalizerSettings.enabled,
      equalizerSettings.levels.map(value => value / 100),
      equalizerSettings.bass / 10
    );
  }, [equalizerSettings, audioPlayer, audioStatus?.isLoaded, uri]);


  // ---- Video branch (expo-video) - same idea, created once ----
  const videoPlayer = useVideoPlayer(null, (player) => {
    player.loop = false;
  });
  const playingEvent = useEvent(videoPlayer, "playingChange", {
    isPlaying: videoPlayer?.playing ?? false,
  });
  const videoStatusEvent = useEvent(videoPlayer, "statusChange", {
    status: videoPlayer?.status,
  });
  const trackIdentity = track
    ? `${track.provider || ""}:${track.id ?? uri ?? "unknown"}`
    : null;
  const trackIdentityRef = useRef(trackIdentity);
  trackIdentityRef.current = trackIdentity;
  const uriRef = useRef(uri);
  uriRef.current = uri;
  const videoPositionsRef = useRef(new Map());
  const loadedVideoIdentityRef = useRef(null);
  const loadedSourceUriRef = useRef(null);
  const loadedSourceDurationRef = useRef(0);
  const videoPositionsReadyRef = useRef(false);
  const lastVideoPositionsSaveRef = useRef(0);
  const [videoPosition, setVideoPosition] = useState(0);
  const [videoFinishedTrack, setVideoFinishedTrack] = useState(null);

  const persistVideoPositions = useCallback(async () => {
    if (!videoPositionsReadyRef.current) return;
    try {
      const entries = Array.from(videoPositionsRef.current.entries()).slice(-MAX_SAVED_VIDEO_POSITIONS);
      await AsyncStorage.setItem(VIDEO_POSITIONS_KEY, JSON.stringify(entries));
    } catch {}
  }, []);

  const saveVideoPosition = useCallback((identity, position, force = false) => {
    if (!identity || !Number.isFinite(position) || position <= 0) return;
    const positions = videoPositionsRef.current;
    positions.delete(identity);
    positions.set(identity, position);
    while (positions.size > MAX_SAVED_VIDEO_POSITIONS) {
      positions.delete(positions.keys().next().value);
    }
    const now = Date.now();
    if (force || now - lastVideoPositionsSaveRef.current >= 5000) {
      lastVideoPositionsSaveRef.current = now;
      persistVideoPositions();
    }
  }, [persistVideoPositions]);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(VIDEO_POSITIONS_KEY)
      .then((raw) => {
        if (cancelled) return;
        if (raw) {
          try {
            const saved = new Map(JSON.parse(raw));
            for (const [identity, position] of videoPositionsRef.current) saved.set(identity, position);
            videoPositionsRef.current = saved;
          } catch {}
        }
        videoPositionsReadyRef.current = true;
        tryRestoreVideoPositionRef.current(loadedSourceDurationRef.current);
      })
      .catch(() => {
        if (cancelled) return;
        videoPositionsReadyRef.current = true;
        tryRestoreVideoPositionRef.current(loadedSourceDurationRef.current);
      });
    return () => { cancelled = true; };
  }, []);

  const tryRestoreVideoPositionRef = useRef(() => {});
  tryRestoreVideoPositionRef.current = (duration = videoPlayer?.duration || 0) => {
    if (!videoPositionsReadyRef.current || loadedSourceUriRef.current !== uriRef.current) return;
    const savedPosition = videoPositionsRef.current.get(trackIdentityRef.current);
    if (!Number.isFinite(savedPosition) || savedPosition <= 0 || !duration || savedPosition >= duration) return;
    try {
      videoPlayer.currentTime = savedPosition;
      setVideoPosition(savedPosition);
    } catch {}
  };

  useEffect(() => {
    const subscription = videoPlayer?.addListener("playToEnd", () => {
      if (videoPlayer?.loop) return;
      setVideoFinishedTrack(trackIdentityRef.current);
    });
    return () => subscription?.remove();
  }, [videoPlayer]);

  useEffect(() => {
    const subscription = videoPlayer?.addListener("sourceLoad", (event) => {
      loadedSourceUriRef.current = event?.videoSource?.uri || null;
      loadedSourceDurationRef.current = event?.duration || 0;
      if (loadedSourceUriRef.current !== uriRef.current) return;
      tryRestoreVideoPositionRef.current(loadedSourceDurationRef.current);
    });
    return () => subscription?.remove();
  }, [videoPlayer]);

  useEffect(() => {
    setVideoFinishedTrack(null);
    setVideoPosition(0);
  }, [trackIdentity]);

  // ---- Obsidian audio settings (speed / volume / keep-pitch), mp3 + mp4 ----
  const settingsKey = trackKey(track);
  useEffect(() => { loadAudioSettings(); }, []);
  useEffect(() => {
    const apply = () => applyToPlayers({ audioPlayer, videoPlayer }, settingsKey);
    apply();
    const t = setTimeout(apply, 400);
    const unsub = subscribeAudioSettings(apply);
    return () => { clearTimeout(t); unsub(); };
  }, [settingsKey, uri, isVideo, audioStatus?.isLoaded, audioPlayer, videoPlayer]);

  // Swap the active player's source whenever the resolved uri actually
  // changes, or its media type changes. Passing a different `source` prop
  // does not reload either player after creation.
  const lastLoadedUri = useRef(null);
  const lastLoadedIsVideo = useRef(null);
  const prevIsVideo = useRef(isVideo);

  useEffect(() => {
    // Save the outgoing video's final position before replacing its source.
    if (prevIsVideo.current && loadedVideoIdentityRef.current) {
      try {
        saveVideoPosition(loadedVideoIdentityRef.current, videoPlayer?.currentTime || 0, true);
      } catch {}
    }

    // If the track TYPE switched (audio -> video or vice versa), stop
    // whichever player was previously active so it doesn't keep playing
    // silently in the background.
    if (prevIsVideo.current !== isVideo) {
      if (prevIsVideo.current) videoPlayer?.pause();
      else audioPlayer?.pause();
      prevIsVideo.current = isVideo;
    }

    if (!uri) {
      lastLoadedUri.current = null;
      lastLoadedIsVideo.current = isVideo;
      loadedVideoIdentityRef.current = null;
      loadedSourceUriRef.current = null;
      loadedSourceDurationRef.current = 0;
      return;
    }

    if (uri === lastLoadedUri.current && isVideo === lastLoadedIsVideo.current) {
      // Queue entries can share a URL; keep resume state attached to the
      // entry currently playing even when the media source is unchanged.
      if (isVideo) loadedVideoIdentityRef.current = trackIdentity;
      return;
    }

    lastLoadedUri.current = uri;
    lastLoadedIsVideo.current = isVideo;

    if (isVideo) {
      videoPlayer?.replace(videoSource(uri));
      loadedVideoIdentityRef.current = trackIdentity;
      loadedSourceUriRef.current = null;
      loadedSourceDurationRef.current = 0;
    } else {
      audioPlayer?.replace({ uri });
      loadedVideoIdentityRef.current = null;
    }
  }, [uri, isVideo, trackIdentity, videoPlayer, audioPlayer, saveVideoPosition]);

  // Log a "play" to on-device history once someone's actually stuck with
  // a track for a bit - not on every tap-and-skip, so the AI recommendation
  // feature (built next) works from real listening, not noise.
  useEffect(() => {
    if (!track?.id) return;
    const timer = setTimeout(() => {
      logPlay(track);
    }, MIN_PLAY_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [track?.id]);

  // expo-video doesn't push continuous position updates by default, so we
  // poll currentTime on an interval while a video track is active.
  useEffect(() => {
    if (!isVideo || !videoPlayer) return;
    let interval = null;
    const stop = () => {
      if (interval) { clearInterval(interval); interval = null; }
    };
    const start = () => {
      if (interval) return;
      interval = setInterval(() => {
        try {
          const position = videoPlayer.currentTime || 0;
          setVideoPosition(position);
          saveVideoPosition(trackIdentity, position);
        } catch (e) {
          // the OS released the player while we were away: stop polling it
          stop();
        }
      }, 500);
    };
    if (AppState.currentState === "active") start();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") start();
      else {
        stop();
        try { saveVideoPosition(trackIdentity, videoPlayer.currentTime || 0, true); } catch {}
      }
    });
    return () => { stop(); sub.remove(); };
  }, [isVideo, trackIdentity, videoPlayer, saveVideoPosition]);

  // Lock screen / Now Playing is owned entirely by expo-media-control
  // (see playbackBridge.js) - it has the fuller command set (play/pause/
  // next/prev), unlike expo-audio's own setActiveForLockScreen (seek only,
  // no next/prev). Running both at once causes them to fight over the same
  // OS media session - whichever last wrote would "win", which is why
  // controls used to flicker and the seekbar would drift/jump. Do NOT
  // re-enable audioPlayer.setActiveForLockScreen() while expo-media-control
  // is active.

  const play = useCallback(() => {
    if (isVideo) {
      setVideoFinishedTrack(null);
      videoPlayer?.play();
    } else {
      audioPlayer?.play();
    }
  }, [isVideo, videoPlayer, audioPlayer]);

  const pause = useCallback(() => {
    if (isVideo) videoPlayer?.pause();
    else audioPlayer?.pause();
  }, [isVideo, videoPlayer, audioPlayer]);

  const isPlaying = isVideo ? !!playingEvent?.isPlaying : !!audioStatus?.playing;
  const didJustFinish = isVideo
    ? !videoPlayer?.loop && videoFinishedTrack === trackIdentity && !!trackIdentity
    : !!audioStatus?.didJustFinish;

  const retryVideo = useCallback(() => {
    if (!isVideo || !uri || !videoPlayer) return;
    setVideoFinishedTrack(null);
    videoPlayer.replace(videoSource(uri));
    videoPlayer.play();
  }, [isVideo, uri, videoPlayer]);

  const toggle = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, play, pause]);

  const seekTo = useCallback(
    (seconds) => {
      if (isVideo) {
        if (videoPlayer) videoPlayer.currentTime = seconds;
      } else {
        audioPlayer?.seekTo(seconds);
      }
    },
    [isVideo, videoPlayer, audioPlayer]
  );

  // Playback rate: expo-video exposes a settable .playbackRate property;

  // expo-audio's AudioPlayer exposes setPlaybackRate(rate, pitchCorrection).

  // Wrapped defensively since exact method shape has shifted across SDKs.

  const setRate = useCallback(

    (rate) => {

      try {

        if (isVideo) {

          if (videoPlayer) videoPlayer.playbackRate = rate;

        } else if (audioPlayer) {

          if (typeof audioPlayer.setPlaybackRate === "function") {

            audioPlayer.setPlaybackRate(rate, "medium");

          } else {

            audioPlayer.playbackRate = rate;

          }

        }

      } catch (err) {

        console.warn("Failed to set playback rate:", err);

      }

  },

  [isVideo, videoPlayer, audioPlayer]

  );


  return {
    isVideo,
    isPlaying,
    // Track completion for both players, keyed to the track that finished.
    didJustFinish,
    finishedTrackKey: didJustFinish ? trackIdentity : null,
    position: isVideo ? videoPosition : audioStatus?.currentTime || 0,
    duration: isVideo ? videoPlayer?.duration || 0 : audioStatus?.duration || 0,
    isBuffering: isVideo
      ? videoPlayer?.status === "loading"
      : !!audioStatus?.isBuffering,
    videoError: isVideo && videoStatusEvent?.status === "error"
      ? videoStatusEvent.error?.message || "This video could not be played."
      : null,
    play,
    pause,
    toggle,
    seekTo,
    retryVideo,

    setRate,
    videoPlayer: isVideo ? videoPlayer : null,
    audioPlayer: !isVideo ? audioPlayer : null,
  };
}
