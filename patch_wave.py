import re
p = "PlayerCard.js"
s = open(p).read()
open(p + ".bak2", "w").write(s)

def sub(old, new):
    global s
    assert s.count(old) == 1, (s.count(old), old[:70])
    s = s.replace(old, new)

# useMemo import
sub('import React, { useState, useEffect, useRef } from "react";',
    'import React, { useState, useEffect, useRef, useMemo } from "react";')

# waveform generator (stable per track)
sub("const RATES = [1, 1.25, 1.5, 2, 0.75];",
"""const RATES = [1, 1.25, 1.5, 2, 0.75];
const BARS = 56;

function waveBars(seed) {
  let h = hashStr(seed || "x") || 1;
  const out = [];
  for (let i = 0; i < BARS; i++) {
    h = (Math.imul(h, 1664525) + 1013904223) | 0;
    const r = ((h >>> 8) & 255) / 255;
    const env = 0.5 + 0.5 * Math.sin(i * 0.22 + (hashStr(seed || "x") % 7));
    out.push(Math.round(8 + 30 * (0.4 * r + 0.6 * env)));
  }
  return out;
}""")

# compute bars
sub("  // ---------------- Derived ----------------",
"""  const bars = useMemo(
    () => waveBars(`${track?.provider}-${track?.id}`),
    [track?.id, track?.provider]
  );

  // ---------------- Derived ----------------""")

# track container style
sub("style={[styles.progressTrack, scrubbing && { height: 6 }]}",
    "style={styles.waveTrack}")

# replace fill + dot with bars
pat = re.compile(
    r"<View style=\{\[styles\.progressFill.*?scale: scrubbing \? 1\.35 : 1 \}\],\s*\},\s*\]\}\s*/>",
    re.S)
assert len(pat.findall(s)) == 1, "seek children block not found"
s = pat.sub(
"""{bars.map((hgt, i) => (
                  <View
                    key={i}
                    style={{
                      width: 3,
                      height: scrubbing ? hgt + 4 : hgt,
                      borderRadius: 2,
                      backgroundColor: i / BARS < progressPct ? A.solid : "rgba(255,255,255,0.25)",
                    }}
                  />
                ))}""", s)

# style
sub('  progressFill: { height: "100%", borderRadius: 3 },',
    '  waveTrack: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },\n'
    '  progressFill: { height: "100%", borderRadius: 3 },')

open(p, "w").write(s)
print("wave seek bar patched, backup at PlayerCard.js.bak2")
