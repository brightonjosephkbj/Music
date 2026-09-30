import React from "react";
import {
  FlexWidget,
  TextWidget,
  ImageWidget,
  OverlapWidget,
  SvgWidget,
} from "react-native-android-widget";
import { DEFAULT_SETTINGS } from "./widgetSettings";
import { getLayout, pickLayoutKey } from "./widgetLayouts";
import { renderCustomItems } from "./CustomWidgetLayout";

const JET_BLACK = "#0B0A0F";
const TEXT_PRIMARY = "#F5F3FA";
const TEXT_MUTED = "#B8B3C4";
const BORDER = "rgba(255,255,255,0.08)";

const hexToRgba = (hex, a) => {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const icon = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${body}</svg>`;

const ICONS = {
  prev: (c) =>
    icon(`<rect x="5" y="5" width="2.5" height="14" rx="1" fill="${c}"/><path d="M19 5v14L9 12z" fill="${c}"/>`),
  next: (c) =>
    icon(`<rect x="16.5" y="5" width="2.5" height="14" rx="1" fill="${c}"/><path d="M5 5v14l10-7z" fill="${c}"/>`),
  play: (c) => icon(`<path d="M8 5v14l11-7z" fill="${c}"/>`),
  pause: (c) =>
    icon(`<rect x="6" y="5" width="4" height="14" rx="1" fill="${c}"/><rect x="14" y="5" width="4" height="14" rx="1" fill="${c}"/>`),
};

export function NowPlayingWidget({
  title,
  artist,
  artwork,
  progress = 0,
  isPlaying = false,
  lyricLine = null,
  width = 250,
  height = 80,
  settings,
}) {
  const S = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  const hasTrack = !!title;
  const solid = S.bgStyle === "solid";
  const backdrop = artwork || require("./assets/widget-background.png");
  const scrim = hexToRgba(S.bgColor, solid ? 1 : S.dim);

  const tiny = height < 70 || width < 140;
  const compact = height < 110;
  const showArt = S.showArt && width >= 180;
  const showSkip = S.showSkip && width >= 200;
  const showProgress = S.showProgress && !compact;
  const showSub = S.showLyric && !tiny;

  const artSize = Math.max(32, Math.min(height - 28, 140));
  const pad = tiny ? 8 : 14;
  const sc = S.textScale;
  const titleSize = Math.round((tiny ? 13 : height > 160 ? 18 : 15) * sc);
  const subSize = Math.round((height > 160 ? 14 : 12) * sc);
  const skipSize = tiny ? 22 : 26;
  const playSize = tiny ? 28 : height > 160 ? 40 : 34;
  const gap = tiny ? 12 : 20;
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);

  if (S.customLayout) {
    const items = getLayout(S, pickLayoutKey(width, height));
    return (
      <OverlapWidget
        clickAction="OPEN_APP"
        style={{
          height: "match_parent",
          width: "match_parent",
          borderRadius: S.radius,
          borderWidth: 1,
          borderColor: BORDER,
        }}
      >
        {!solid && (
          <ImageWidget
            image={backdrop}
            imageWidth={512}
            imageHeight={256}
            resizeMode="cover"
            style={{ width: "match_parent", height: "match_parent" }}
          />
        )}
        <FlexWidget style={{ width: "match_parent", height: "match_parent", backgroundColor: scrim }} />
        {renderCustomItems({ items, width, height, S, title, artist, artwork, lyricLine, progress, isPlaying })}
      </OverlapWidget>
    );
  }

  return (
    <OverlapWidget
      clickAction="OPEN_APP"
      style={{
        height: "match_parent",
        width: "match_parent",
        borderRadius: S.radius,
        borderWidth: 1,
        borderColor: BORDER,
      }}
    >
      {!solid && (
        <ImageWidget
          image={backdrop}
          imageWidth={512}
          imageHeight={256}
          resizeMode="cover"
          style={{ width: "match_parent", height: "match_parent" }}
        />
      )}

      <FlexWidget
        style={{
          width: "match_parent",
          height: "match_parent",
          backgroundColor: scrim,
        }}
      />

      <FlexWidget
        style={{
          width: "match_parent",
          height: "match_parent",
          padding: pad,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        {showArt &&
          (artwork ? (
            <ImageWidget
              image={artwork}
              imageWidth={artSize}
              imageHeight={artSize}
              radius={14}
              style={{ backgroundColor: JET_BLACK }}
            />
          ) : (
            <FlexWidget
              style={{
                width: artSize,
                height: artSize,
                borderRadius: 14,
                backgroundColor: JET_BLACK,
              }}
            />
          ))}

        <FlexWidget
          style={{
            flexDirection: "column",
            marginLeft: showArt ? 12 : 0,
            flexGrow: 1,
            flexShrink: 1,
          }}
        >
          <TextWidget
            text={hasTrack ? title : "Not playing"}
            style={{ fontSize: titleSize, fontWeight: "700", color: TEXT_PRIMARY }}
            maxLines={1}
            clickAction="OPEN_APP"
          />

          {showSub && (
            <TextWidget
              text={hasTrack ? lyricLine || artist || "" : "Open B24music"}
              style={{ fontSize: subSize, color: TEXT_MUTED, marginTop: 2 }}
              maxLines={1}
              clickAction="OPEN_APP"
            />
          )}

          {showProgress && (
            <FlexWidget
              style={{
                height: 3,
                width: "match_parent",
                backgroundColor: hexToRgba(S.accent, 0.3),
                borderRadius: 2,
                marginTop: 8,
              }}
            >
              <FlexWidget
                style={{
                  height: 3,
                  width: `${pct}%`,
                  backgroundColor: S.accent,
                  borderRadius: 2,
                }}
              />
            </FlexWidget>
          )}

          <FlexWidget
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: tiny ? 4 : 8,
            }}
          >
            {showSkip && (
              <SvgWidget
                svg={ICONS.prev(TEXT_PRIMARY)}
                clickAction="PREV_TRACK"
                style={{ width: skipSize, height: skipSize, marginRight: gap }}
              />
            )}

            <SvgWidget
              svg={isPlaying ? ICONS.pause(S.accent) : ICONS.play(S.accent)}
              clickAction="TOGGLE_PLAY"
              style={{
                width: playSize,
                height: playSize,
                marginRight: showSkip ? gap : 0,
              }}
            />

            {showSkip && (
              <SvgWidget
                svg={ICONS.next(TEXT_PRIMARY)}
                clickAction="NEXT_TRACK"
                style={{ width: skipSize, height: skipSize }}
              />
            )}
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
    </OverlapWidget>
  );
}
