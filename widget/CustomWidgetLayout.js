import React from "react";
import { FlexWidget, TextWidget, ImageWidget, SvgWidget } from "react-native-android-widget";
import { textSizeDp } from "./widgetLayouts";

const TEXT_PRIMARY = "#F5F3FA";
const TEXT_MUTED = "#B8B3C4";
const JET = "#1A1822";

const hexToRgba = (hex, a) => {
  const n = parseInt(String(hex).replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const icon = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${body}</svg>`;
const ICONS = {
  prev: (c) => icon(`<rect x="5" y="5" width="2.5" height="14" rx="1" fill="${c}"/><path d="M19 5v14L9 12z" fill="${c}"/>`),
  next: (c) => icon(`<rect x="16.5" y="5" width="2.5" height="14" rx="1" fill="${c}"/><path d="M5 5v14l10-7z" fill="${c}"/>`),
  play: (c) => icon(`<path d="M8 5v14l11-7z" fill="${c}"/>`),
  pause: (c) =>
    icon(`<rect x="6" y="5" width="4" height="14" rx="1" fill="${c}"/><rect x="14" y="5" width="4" height="14" rx="1" fill="${c}"/>`),
};

export function renderCustomItems({ items, width, height, S, title, artist, artwork, lyricLine, progress, isPlaying }) {
  const hasTrack = !!title;
  const pct = Math.max(0, Math.min(1, progress || 0));

  return (items || []).map((it) => {
    const x = Math.round(it.x * width);
    const y = Math.round(it.y * height);
    const w = Math.max(6, Math.round(it.w * width));
    const h = Math.max(3, Math.round(it.h * height));
    const side = Math.min(w, h);
    let node = null;

    if (it.type === "art") {
      const r = Math.round(side * 0.16);
      node = artwork ? (
        <ImageWidget
          image={artwork}
          imageWidth={w}
          imageHeight={h}
          radius={r}
          resizeMode="cover"
          style={{ width: w, height: h }}
          clickAction="OPEN_APP"
        />
      ) : (
        <FlexWidget style={{ width: w, height: h, borderRadius: r, backgroundColor: JET }} />
      );
    } else if (it.type === "title") {
      node = (
        <TextWidget
          text={hasTrack ? title : "Not playing"}
          style={{ fontSize: textSizeDp("title", h, S.textScale), fontWeight: "700", color: TEXT_PRIMARY, width: w }}
          maxLines={1}
          clickAction="OPEN_APP"
        />
      );
    } else if (it.type === "subtitle") {
      node = (
        <TextWidget
          text={hasTrack ? lyricLine || artist || "" : "Open B24music"}
          style={{ fontSize: textSizeDp("subtitle", h, S.textScale), color: TEXT_MUTED, width: w }}
          maxLines={1}
          clickAction="OPEN_APP"
        />
      );
    } else if (it.type === "progress") {
      node = (
        <FlexWidget
          style={{ width: w, height: h, borderRadius: Math.round(h / 2), backgroundColor: hexToRgba(S.accent, 0.3) }}
        >
          <FlexWidget
            style={{
              width: Math.max(1, Math.round(w * pct)),
              height: h,
              borderRadius: Math.round(h / 2),
              backgroundColor: S.accent,
            }}
          />
        </FlexWidget>
      );
    } else if (it.type === "prev") {
      node = <SvgWidget svg={ICONS.prev(TEXT_PRIMARY)} clickAction="PREV_TRACK" style={{ width: side, height: side }} />;
    } else if (it.type === "next") {
      node = <SvgWidget svg={ICONS.next(TEXT_PRIMARY)} clickAction="NEXT_TRACK" style={{ width: side, height: side }} />;
    } else if (it.type === "play") {
      node = (
        <SvgWidget
          svg={isPlaying ? ICONS.pause(S.accent) : ICONS.play(S.accent)}
          clickAction="TOGGLE_PLAY"
          style={{ width: side, height: side }}
        />
      );
    }

    if (!node) return null;
    return (
      <FlexWidget
        key={it.id}
        style={{ width: "match_parent", height: "match_parent", paddingLeft: x, paddingTop: y }}
      >
        {node}
      </FlexWidget>
    );
  });
}
