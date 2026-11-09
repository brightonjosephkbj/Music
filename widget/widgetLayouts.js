export const PRESETS = {
  small: { w: 160, h: 60, label: "Small" },
  wide: { w: 320, h: 80, label: "Wide" },
  tall: { w: 320, h: 160, label: "Tall" },
};

export const TYPES = {
  art: { label: "Artwork", icon: "image", lock: true, minW: 24, minH: 24 },
  title: { label: "Title", icon: "text", lock: false, minW: 30, minH: 10 },
  subtitle: { label: "Artist / lyric", icon: "chatbubble-ellipses", lock: false, minW: 30, minH: 8 },
  progress: { label: "Seek bar", icon: "remove", lock: false, minW: 30, minH: 3 },
  prev: { label: "Previous", icon: "play-skip-back", lock: true, minW: 16, minH: 16 },
  play: { label: "Play / pause", icon: "play", lock: true, minW: 16, minH: 16 },
  next: { label: "Next", icon: "play-skip-forward", lock: true, minW: 16, minH: 16 },
};
export const TYPE_ORDER = ["art", "title", "subtitle", "progress", "prev", "play", "next"];

// [type, x, y, w, h] in dp on each preset canvas
const DEFAULT_DP = {
  wide: [
    ["art", 8, 8, 64, 64],
    ["title", 80, 10, 120, 20],
    ["subtitle", 80, 32, 120, 16],
    ["progress", 80, 58, 120, 4],
    ["prev", 204, 26, 28, 28],
    ["play", 236, 20, 40, 40],
    ["next", 280, 26, 28, 28],
  ],
  small: [
    ["art", 6, 6, 48, 48],
    ["title", 58, 6, 96, 18],
    ["subtitle", 58, 24, 96, 12],
    ["prev", 58, 38, 20, 20],
    ["play", 84, 36, 24, 24],
    ["next", 114, 38, 20, 20],
  ],
  tall: [
    ["art", 12, 12, 96, 96],
    ["title", 120, 16, 188, 26],
    ["subtitle", 120, 46, 188, 18],
    ["progress", 12, 116, 296, 5],
    ["prev", 96, 128, 28, 28],
    ["play", 140, 124, 40, 40],
    ["next", 196, 128, 28, 28],
  ],
};
const FALLBACK_DP = { small: { progress: ["progress", 6, 55, 148, 3] } };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function toItem(key, a) {
  const P = PRESETS[key];
  return { id: a[0], type: a[0], x: a[1] / P.w, y: a[2] / P.h, w: a[3] / P.w, h: a[4] / P.h };
}

export const defaultLayout = (key) => DEFAULT_DP[key].map((a) => toItem(key, a));

export function defaultItem(key, type) {
  const a = DEFAULT_DP[key].find((d) => d[0] === type) || (FALLBACK_DP[key] || {})[type];
  return toItem(key, a || [type, 8, 8, 40, 20]);
}

// Chooses the layout whose shape is closest to the real widget size.
export function pickLayoutKey(width, height) {
  const a = Math.log(Math.max(1, width) / Math.max(1, height));
  let best = "wide";
  let bestD = Infinity;
  Object.keys(PRESETS).forEach((k) => {
    const d = Math.abs(a - Math.log(PRESETS[k].w / PRESETS[k].h));
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  });
  return best;
}

export function getLayout(settings, key) {
  const saved = settings && settings.layouts && settings.layouts[key];
  return Array.isArray(saved) ? saved : defaultLayout(key);
}

export function textSizeDp(type, hDp, textScale = 1) {
  const base = type === "title" ? clamp(hDp * 0.7, 9, 26) : clamp(hDp * 0.7, 8, 18);
  return Math.round(base * textScale);
}
