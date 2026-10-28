import os, re, sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/B24music_new")

CHECKS = {
 "RESCAN on resume (AppState/focus + media load)": r"AppState\.addEventListener|useFocusEffect|getAssetsAsync|getAlbumAsync",
 "Heavy list props": r"removeClippedSubviews|initialNumToRender|windowSize|getItemLayout|maxToRenderPerBatch",
 "Progress/position state (re-render risk)": r"\bposition\b|\bprogress\b|currentTime|positionMillis",
 "Row not memoized?": r"renderItem\s*=",
 "FlatList/ScrollView used": r"<FlatList|<ScrollView|<FlashList|<SectionList",
 "Sync loops on big lists": r"\.forEach\(|\.map\(.*\.map\(|\.sort\(|\.filter\(.*\.filter\(",
}

files = []
for d, dirs, fs in os.walk(ROOT):
    dirs[:] = [x for x in dirs if x not in ("node_modules", ".git", "android", "ios", ".expo")]
    for f in fs:
        if f.endswith((".js", ".jsx", ".ts", ".tsx")) and "librar" in f.lower():
            files.append(os.path.join(d, f))

if not files:
    print("No library file found. Pass path: python check_lib.py ~/B24music_new")
    sys.exit()

for path in files:
    print("\n=== " + path.replace(ROOT, "") + " ===")
    lines = open(path, encoding="utf-8", errors="ignore").read().splitlines()
    print("Total lines:", len(lines))
    for name, pat in CHECKS.items():
        hits = [(i + 1, l.strip()[:80]) for i, l in enumerate(lines) if re.search(pat, l)]
        if hits:
            print("\n[" + name + "]")
            for n, l in hits[:8]:
                print("  line", n, ":", l)
    if "React.memo" not in "".join(lines) and "memo(" not in "".join(lines):
        print("\n[!] No React.memo found: list rows probably re-render all at once")
    if "useCallback" not in "".join(lines):
        print("[!] No useCallback found: renderItem is recreated on every render")
