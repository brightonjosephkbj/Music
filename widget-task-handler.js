import React from "react";
import { NowPlayingWidget } from "./NowPlayingWidget";
import { loadWidgetSettings } from "./widgetSettings";
import {
  togglePlayback,
  nextTrack,
  prevTrack,
  getPlaybackState,
} from "./playbackBridge";

// Called by the native widget host on install/update/resize/click events.
// If the process was killed this boots a headless JS context, where
// playbackBridge's registered controls won't exist yet, so the first tap
// may be swallowed. Settings are read fresh from storage every time.
async function renderFromState(renderWidget, widgetInfo) {
  const { track, isPlaying, position, duration, lyricLine } = getPlaybackState();
  const progress = duration > 0 ? position / duration : 0;
  const settings = await loadWidgetSettings(true);

  renderWidget(
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
  );
}

export async function widgetTaskHandler(props) {
  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED":
      await renderFromState(props.renderWidget, props.widgetInfo);
      break;

    case "WIDGET_CLICK": {
      const action = props.clickAction;
      if (action === "TOGGLE_PLAY") togglePlayback();
      else if (action === "NEXT_TRACK") nextTrack();
      else if (action === "PREV_TRACK") prevTrack();
      await renderFromState(props.renderWidget, props.widgetInfo);
      break;
    }

    case "WIDGET_DELETED":
      break;

    default:
      break;
  }
}
