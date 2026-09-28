#!/bin/bash
set -e
npx expo install react-native-image-colors

cat > useArtworkAccent.js << 'JSEOF'
import { useEffect, useState } from "react";

// Native module may be missing on old APKs - never crash, just fall back.
let ImageColors = null;
try {
  ImageColors = require("react-native-image-colors");
} catch (e) {}

const cache = {};

function hexToHsl(hex) {
  const m = /^#?([0-9a-f]{6})/i.exec(hex || "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

function accentFromHex(hex) {
  const c = hexToHsl(hex);
  if (!c) return null;
  const s = Math.max(65, Math.min(95, c.s));
  return {
    solid: `hsl(${c.h},${s}%,70%)`,
    glow: `hsl(${c.h},${s}%,58%)`,
    soft: `hsla(${c.h},${s}%,60%,0.16)`,
    border: `hsla(${c.h},${s}%,70%,0.45)`,
    tint: `hsla(${c.h},${s}%,45%,0.38)`,
  };
}

// Returns an accent object shaped like the hash-based one; `fallback` is used
// until (or unless) real colours are extracted from the artwork.
export default function useArtworkAccent(uri, fallback) {
  const [accent, setAccent] = useState(uri && cache[uri] ? cache[uri] : null);

  useEffect(() => {
    let cancelled = false;
    if (!uri) {
      setAccent(null);
      return;
    }
    if (cache[uri]) {
      setAccent(cache[uri]);
      return;
    }
    setAccent(null);
    (async () => {
      try {
        const getColors = ImageColors && (ImageColors.getColors || (ImageColors.default && ImageColors.default.getColors));
        if (!getColors) return;
        const res = await getColors(uri, { fallback: "#3a7bd5", cache: true, key: uri, quality: "low" });
        const hex = res.vibrant || res.dominant || res.lightVibrant || res.average || res.background;
        const a = accentFromHex(hex);
        if (a) {
          cache[uri] = a;
          if (!cancelled) setAccent(a);
        }
      } catch (e) {}
    })();
    return () => {
      cancelled = true;
    };
  }, [uri]);

  return accent || fallback;
}
JSEOF

python3 - << 'PYEOF'
import json, shutil, re

# ---- app.json: plugin + version bump ----
shutil.copy("app.json", "app.json.bak-native")
cfg = json.load(open("app.json"))
ex = cfg["expo"]
plugins = ex.setdefault("plugins", [])
names = [p if isinstance(p, str) else p[0] for p in plugins]
if "react-native-image-colors" not in names:
    plugins.append("react-native-image-colors")
old = ex["version"]
a, b, c = (old.split(".") + ["0", "0"])[:3]
ex["version"] = f"{a}.{int(b)+1}.0"
if "android" in ex and "versionCode" in ex["android"]:
    ex["android"]["versionCode"] += 1
json.dump(cfg, open("app.json", "w"), indent=2)
print("version", old, "->", ex["version"], "| versionCode:", ex.get("android", {}).get("versionCode"))
if "runtimeVersion" in ex:
    print("NOTE runtimeVersion is set to:", ex["runtimeVersion"])

# ---- PlayerCard.js ----
p = "PlayerCard.js"
s = open(p).read()
if "useArtworkAccent" not in s:
    shutil.copy(p, p + ".bak-native")
    imp = 'import { fetchLyrics, activeLyricIndex } from "./lyricsClient";\n'
    assert s.count(imp) == 1
    s = s.replace(imp, imp + 'import useArtworkAccent from "./useArtworkAccent";\n')
    old = "  const A = trackAccent(track);\n"
    assert s.count(old) == 1
    s = s.replace(old, "  const A = useArtworkAccent(track?.artwork, trackAccent(track));\n")
    open(p, "w").write(s)
    print("PlayerCard.js patched")
else:
    print("PlayerCard.js already patched")

# ---- LibraryScreen.js ----
p = "LibraryScreen.js"
s = open(p).read()
if "useArtworkAccent" not in s:
    shutil.copy(p, p + ".bak-native")
    imp = 'import ContextMenuCard from "./ContextMenuCard";\n'
    assert s.count(imp) == 1
    s = s.replace(imp, imp + 'import useArtworkAccent from "./useArtworkAccent";\n')
    old = '''  const plAccent = useMemo(
    () => playlistAccent(selectedPlaylist ? selectedPlaylist.trackIds || [] : []),
    [selectedPlaylist]
  );
'''
    assert s.count(old) == 1, "plAccent anchor not found (was patch_playlist_style.py applied?)"
    s = s.replace(old, '''  const plFallbackAccent = useMemo(
    () => playlistAccent(selectedPlaylist ? selectedPlaylist.trackIds || [] : []),
    [selectedPlaylist]
  );
  const plArtForColor = selectedPlaylist ? getPlaylistArt(selectedPlaylist) : null;
  const plAccent = useArtworkAccent(plArtForColor && plArtForColor.uri, plFallbackAccent);
''')
    open(p, "w").write(s)
    print("LibraryScreen.js patched")
else:
    print("LibraryScreen.js already patched")
PYEOF

echo; echo "--- checks ---"
grep -n "image-colors" package.json app.json
grep -c useArtworkAccent PlayerCard.js LibraryScreen.js
