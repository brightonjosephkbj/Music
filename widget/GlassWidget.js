import React from "react";
import {
  FlexWidget,
  TextWidget,
  ImageWidget,
  OverlapWidget,
  SvgWidget,
} from "react-native-android-widget";

const WHITE = "#FFFFFF";
const EDGE = "rgba(255,255,255,0.35)";
const FILL = "rgba(255,255,255,0.07)";
const MUTED = "#B8B3C4";

const svgWrap = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${body}</svg>`;

const G = {
  next: (c) =>
    svgWrap(`<rect x="16.5" y="5" width="2.5" height="14" rx="1" fill="${c}"/><path d="M5 5v14l10-7z" fill="${c}"/>`),
  play: (c) => svgWrap(`<path d="M8 5v14l11-7z" fill="${c}"/>`),
  pause: (c) =>
    svgWrap(`<rect x="6" y="5" width="4" height="14" rx="1" fill="${c}"/><rect x="14" y="5" width="4" height="14" rx="1" fill="${c}"/>`),
};

const hash = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

// Fake but stable waveform: same song always gets the same bars.
function waveSvg(w, h, progress, seedStr, accent) {
  const barW = 3;
  const step = 6;
  const n = Math.max(6, Math.floor(w / step));
  let s = hash(seedStr || "obsidian");
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const at = Math.min(n - 1, Math.max(0, Math.round(progress * (n - 1))));
  const offset = (w - n * step) / 2;
  let bars = "";
  for (let i = 0; i < n; i++) {
    const r = rnd();
    const head = i === at;
    const bh = head ? h : 5 + r * (h - 12);
    const x = offset + i * step;
    const y = (h - bh) / 2;
    const color = head ? accent : WHITE;
    const op = head || i < at ? 1 : 0.4;
    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="1.5" fill="${color}" fill-opacity="${op}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bars}</svg>`;
}

export function GlassWidget({
  title,
  artist,
  artwork,
  progress = 0,
  isPlaying = false,
  lyricLine = null,
  width = 250,
  height = 120,
  settings,
}) {
  const accent = settings?.accent || "#C89BFF";
  const bg = require("../assets/widget-background.png");
  const backdrop = artwork || bg;
  const hasTrack = !!title;

  const pad = 14;
  const innerW = Math.max(120, width - pad * 2);
  const art = Math.max(44, Math.min(64, Math.round(height * 0.36)));
  const btn = 42;
  const gap = 8;
  const waveH = 26;
  const waveW = Math.max(50, innerW - btn * 2 - gap * 2 - 24);
  const showPill = width >= 280;

  const circle = (child, action, filled) => (
    <FlexWidget
      clickAction={action}
      style={{
        width: btn,
        height: btn,
        borderRadius: btn / 2,
        borderWidth: 1,
        borderColor: EDGE,
        backgroundColor: filled ? "rgba(255,255,255,0.16)" : FILL,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {child}
    </FlexWidget>
  );

  return (
    <OverlapWidget
      clickAction="OPEN_APP"
      style={{
        height: "match_parent",
        width: "match_parent",
        borderRadius: 28,
        borderWidth: 1,
        borderColor: EDGE,
      }}
    >
      <ImageWidget
        image={backdrop}
        imageWidth={512}
        imageHeight={256}
        resizeMode="cover"
        style={{ width: "match_parent", height: "match_parent" }}
      />
      <FlexWidget
        style={{
          width: "match_parent",
          height: "match_parent",
          backgroundColor: "rgba(8,8,12,0.72)",
        }}
      />

      <FlexWidget
        style={{
          width: "match_parent",
          height: "match_parent",
          padding: pad,
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <FlexWidget
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <FlexWidget
            style={{
              width: art + 6,
              height: art + 6,
              borderRadius: (art + 6) / 2,
              borderWidth: 2,
              borderColor: WHITE,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {artwork ? (
              <ImageWidget
                image={artwork}
                imageWidth={art}
                imageHeight={art}
                radius={art / 2}
              />
            ) : (
              <FlexWidget
                style={{
                  width: art,
                  height: art,
                  borderRadius: art / 2,
                  backgroundColor: accent,
                }}
              />
            )}
          </FlexWidget>

          <FlexWidget
            style={{
              flexDirection: "column",
              marginLeft: 12,
              flexGrow: 1,
              flexShrink: 1,
            }}
          >
            <TextWidget
              text={hasTrack ? title : "Not playing"}
              style={{ fontSize: 16, fontWeight: "700", color: WHITE }}
              maxLines={1}
              clickAction="OPEN_APP"
            />
            <TextWidget
              text={hasTrack ? lyricLine || artist || "" : "Open Obsidian"}
              style={{ fontSize: 12, color: MUTED, marginTop: 2 }}
              maxLines={1}
              clickAction="OPEN_APP"
            />
          </FlexWidget>

          {showPill && (
            <FlexWidget
              style={{
                borderRadius: 14,
                borderWidth: 1,
                borderColor: EDGE,
                backgroundColor: FILL,
                paddingHorizontal: 10,
                paddingVertical: 5,
                marginLeft: 8,
              }}
            >
              <TextWidget
                text={isPlaying ? "Playing" : "Paused"}
                style={{ fontSize: 10, fontWeight: "700", color: WHITE }}
              />
            </FlexWidget>
          )}
        </FlexWidget>

        <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
          <FlexWidget
            clickAction="OPEN_APP"
            style={{
              width: waveW + 24,
              height: btn,
              borderRadius: btn / 2,
              borderWidth: 1,
              borderColor: EDGE,
              backgroundColor: FILL,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SvgWidget
              svg={waveSvg(waveW, waveH, progress, title || "", accent)}
              style={{ width: waveW, height: waveH }}
            />
          </FlexWidget>

          <FlexWidget style={{ width: gap }} />
          {circle(
            <SvgWidget
              svg={G.next(WHITE)}
              clickAction="NEXT_TRACK"
              style={{ width: 22, height: 22 }}
            />,
            "NEXT_TRACK",
            false
          )}

          <FlexWidget style={{ width: gap }} />
          {circle(
            <SvgWidget
              svg={isPlaying ? G.pause(accent) : G.play(accent)}
              clickAction="TOGGLE_PLAY"
              style={{ width: 24, height: 24 }}
            />,
            "TOGGLE_PLAY",
            true
          )}
        </FlexWidget>
      </FlexWidget>
    </OverlapWidget>
  );
}
