import { requestWidgetUpdate } from "react-native-android-widget";
import React from "react";
import { NowPlayingWidget } from "./NowPlayingWidget";

// Call this whenever nowPlaying or playback state changes (App.js) so the
// home screen widget reflects the current track, play/pause/progress, and
// current lyric line. Safe to call even if the widget isn't currently
// placed on any home screen - requestWidgetUpdate() is a no-op then.
//
// Throttled internally: App.js calls this on every playback position tick
// (needed so the lyric line can advance), but each call that actually goes
// through triggers a real native re-render/bitmap push, which is too
// expensive to do every ~250ms-1s. A push only actually goes out at most
// once per MIN_PUSH_INTERVAL_MS, except for "significant" changes (track
// change or play/pause toggle), which always push immediately so those
// feel instant.
let lastPushAt = 0;
let lastPushTrackKey = null;
let lastPushIsPlaying = null;
const MIN_PUSH_INTERVAL_MS = 4000;

export async function updateNowPlayingWidget(track, playback = {}) {
  const { isPlaying = false, position = 0, duration = 0, lyricLine = null } = playback;
  const now = Date.now();
  const trackKey = track ? `${track.provider || ""}-${track.id}` : null;
  const significant = trackKey !== lastPushTrackKey || isPlaying !== lastPushIsPlaying;

  if (!significant && now - lastPushAt < MIN_PUSH_INTERVAL_MS) {
    return;
  }
  lastPushAt = now;
  lastPushTrackKey = trackKey;
  lastPushIsPlaying = isPlaying;

  const progress = duration > 0 ? position / duration : 0;

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
        />
      ),
    });
  } catch (err) {
    console.warn("Failed to update Now Playing widget:", err);
  }
}
