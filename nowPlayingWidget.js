import { requestWidgetUpdate } from "react-native-android-widget";
import React from "react";
import { NowPlayingWidget } from "./NowPlayingWidget";
import { loadWidgetSettings } from "./widgetSettings";
import { getPlaybackState } from "./playbackBridge";

// Call updateNowPlayingWidget whenever playback state changes (App.js).
// Throttled: a push goes out at most once per MIN_PUSH_INTERVAL_MS, except
// for track changes and play/pause toggles, which push immediately.
let lastPushAt = 0;
let lastPushTrackKey = null;
let lastPushIsPlaying = null;
const MIN_PUSH_INTERVAL_MS = 4000;

async function pushWidget(track, playback) {
  const { isPlaying = false, position = 0, duration = 0, lyricLine = null } = playback;
  const progress = duration > 0 ? position / duration : 0;
  const settings = await loadWidgetSettings();

  try {
    await requestWidgetUpdate({
      widgetName: "NowPlaying",
      renderWidget: (widgetInfo) => (
        <NowPlayingWidget
          title={track?.title}
          artist={track?.artist}
          artwork={track?.artwork}
          isPlaying={isPlaying}
          position={position}
          duration={duration}
          progress={progress}
          lyricLine={lyricLine}
          width={widgetInfo?.width ?? 250}
          height={widgetInfo?.height ?? 80}
          settings={settings}
        />
      ),
    });
  } catch (err) {
    console.warn("Failed to update Now Playing widget:", err);
  }
}

export async function updateNowPlayingWidget(track, playback = {}) {
  const { isPlaying = false } = playback;
  const now = Date.now();
  const trackKey = track ? `${track.provider || ""}-${track.id}` : null;
  const significant = trackKey !== lastPushTrackKey || isPlaying !== lastPushIsPlaying;

  if (!significant && now - lastPushAt < MIN_PUSH_INTERVAL_MS) return;
  lastPushAt = now;
  lastPushTrackKey = trackKey;
  lastPushIsPlaying = isPlaying;

  await pushWidget(track, playback);
}

// Used by the customize screen: push immediately with the current state.
export async function refreshNowPlayingWidget() {
  const { track, isPlaying, position, duration, lyricLine } = getPlaybackState();
  lastPushAt = Date.now();
  await pushWidget(track, { isPlaying, position, duration, lyricLine });
}
