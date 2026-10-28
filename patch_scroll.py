import re, os, shutil

FILES = [
 "HomeScreen.js", "LibraryScreen.js", "SearchScreen.js",
 "LibraryVideosScreen.js", "LibraryDownloadsScreen.js",
 "LibraryAllSongsScreen.js", "LibraryPlaylistsScreen.js",
 "LibraryArtistsScreen.js", "LibraryFoldersScreen.js",
 "RecentScreen.js", "MostPlayedScreen.js",
]
TAG = re.compile(r'<(ScrollView|FlatList)\b')
FROM = re.compile(r'''from\s+['"][^'"]+['"];?\s*$''')
INSERT = ' onScroll={(e) => reportScrollY(e.nativeEvent.contentOffset.y)} scrollEventThrottle={32}'

def tag_end(src, i):
    depth, q = 0, None
    while i < len(src):
        c = src[i]
        if q:
            if c == '\\': i += 1
            elif c == q: q = None
        elif c in '"\'`': q = c
        elif c == '{': depth += 1
        elif c == '}': depth -= 1
        elif c == '>' and depth == 0: return i
        i += 1
    return -1

for f in FILES:
    if not os.path.exists(f):
        print("skip (missing):", f); continue
    src = open(f, encoding="utf-8").read()
    if "reportScrollY" in src:
        print("already patched:", f); continue
    out, last, n, notes = [], 0, 0, []
    for m in TAG.finditer(src):
        end = tag_end(src, m.end())
        if end < 0: continue
        text = src[m.start():end]
        line = src.count("\n", 0, m.start()) + 1
        if re.search(r'\bonScroll\b', text):
            notes.append("line %d has its own onScroll" % line); continue
        if re.search(r'\bhorizontal\b(?!\s*=\s*\{\s*false)', text):
            notes.append("line %d horizontal" % line); continue
        out.append(src[last:m.end()]); out.append(INSERT)
        last = m.end(); n += 1
    out.append(src[last:])
    if n == 0:
        print("nothing to patch:", f, notes); continue
    lines = "".join(out).split("\n")
    idx = -1
    for i, l in enumerate(lines[:200]):
        if FROM.search(l): idx = i
    if idx < 0:
        print("no import line found, skipped:", f); continue
    lines.insert(idx + 1, 'import { reportScrollY } from "./shellScroll";')
    bak = f + ".pre_dock_nav"
    if not os.path.exists(bak): shutil.copy(f, bak)
    open(f, "w", encoding="utf-8").write("\n".join(lines))
    print("patched %d list(s): %s %s" % (n, f, notes))
