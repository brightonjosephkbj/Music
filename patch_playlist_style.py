import shutil, sys, os

p = sys.argv[1] if len(sys.argv) > 1 else "LibraryScreen.js"
assert os.path.exists(p), f"{p} not found (run from the folder with LibraryScreen.js or pass its path)"
s = open(p).read()
assert "plxHeader" not in s, "already patched"
shutil.copy(p, p + ".bak-plx")

def rep(s, old, new, count=1):
    assert s.count(old) == count, f"anchor not unique/found ({s.count(old)}): {old[:70]!r}"
    return s.replace(old, new)

# 1) helpers (module level)
s = rep(s, "let deviceMediaCache = null;\n", '''function plHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Accent colour derived from the playlist's songs (stable per playlist).
function playlistAccent(ids) {
  const key = (ids || []).slice(0, 8).join("|") || "empty";
  const h = plHash(key) % 360;
  return {
    solid: `hsl(${h},85%,70%)`,
    glow: `hsl(${h},95%,58%)`,
    soft: `hsla(${h},85%,60%,0.16)`,
    border: `hsla(${h},85%,70%,0.45)`,
    tint: `hsla(${h},80%,45%,0.35)`,
  };
}

let deviceMediaCache = null;
''')

# 2) accent memo, right after playlistItems is declared (before renderTrackRow)
anchor = "  const renderTrackRow = useCallback("
s = rep(s, anchor, '''  const plAccent = useMemo(
    () => playlistAccent(selectedPlaylist ? selectedPlaylist.trackIds || [] : []),
    [selectedPlaylist]
  );

''' + anchor)

# 3) track rows (only inside renderTrackRow)
a = s.index("  const renderTrackRow = useCallback(")
b = s.index("  const renderGroupTrackRow = useCallback(")
r = s[a:b]

r = rep(r, '''        <TouchableOpacity
          style={styles.row}
          onPress={() => {
            if (inPlaylistEditMode) {''', '''        <TouchableOpacity
          style={[
            styles.row,
            isPl && styles.plxRow,
            isPlActive && { backgroundColor: plAccent.soft, borderColor: plAccent.border },
          ]}
          onPress={() => {
            if (inPlaylistEditMode) {''')

r = rep(r, "      const isChecked = editSelectedIds.has(item.id);\n",
"      const isChecked = editSelectedIds.has(item.id);\n"
"      const isPl = !!selectedPlaylist;\n"
"      const isPlActive = isPl && currentTrackId != null && currentTrackId === item.id;\n")

r = rep(r, '''          {inPlaylistEditMode && (
            <View style={[styles.editCheckbox''', '''          {isPlActive && <View style={[styles.plxBar, { backgroundColor: plAccent.solid }]} />}
          {inPlaylistEditMode && (
            <View style={[styles.editCheckbox''')

r = rep(r, "<Text numberOfLines={1} style={styles.rowTitle}>{item.title}</Text>",
"<Text numberOfLines={1} style={[styles.rowTitle, isPlActive && { color: plAccent.solid }]}>{item.title}</Text>")

r = rep(r, '''          {item.type === "image" ? (
            <Text style={styles.rowDuration}>Image</Text>
          ) : (
            <Text style={styles.rowDuration}>{formatDuration(item.duration)}</Text>
          )}
        </TouchableOpacity>''', '''          {isPlActive && <Ionicons name="stats-chart" size={15} color={plAccent.solid} style={{ marginRight: 10 }} />}
          {item.type === "image" ? (
            <Text style={styles.rowDuration}>Image</Text>
          ) : (
            <Text style={styles.rowDuration}>{formatDuration(item.duration)}</Text>
          )}
          {isPl && !inPlaylistEditMode && (
            <TouchableOpacity
              style={styles.plxMore}
              onPress={(evt) => openMenu(evt, item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="ellipsis-vertical" size={16} color="rgba(255,255,255,0.55)" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>''')

r = rep(r, "editModeActive, editSelectedIds]\n  );", "editModeActive, editSelectedIds, currentTrackId, plAccent]\n  );")
s = s[:a] + r + s[b:]

# 4) new header
a = s.index("  const renderPlaylistDetailHeader = () => {")
b = s.index("  const renderGroupPlaylistDetailHeader = () => {")
new_header = '''  const renderPlaylistDetailHeader = () => {
    if (!selectedPlaylist) return null;
    const art = getPlaylistArt(selectedPlaylist);
    const A = plAccent;

    return (
      <View style={styles.plxHeader}>
        {/* Cover with accent glow */}
        <View style={[styles.plxCoverWrap, { shadowColor: A.glow, borderColor: A.border }]}>
          {art ? (
            <Image source={art} style={styles.plxCover} />
          ) : (
            <View style={[styles.plxCover, styles.plxPlaceholder]}>
              <Ionicons name="musical-notes" size={60} color="rgba(255,255,255,0.4)" />
            </View>
          )}
        </View>

        {/* Title + meta */}
        <Text style={styles.plxTitle} numberOfLines={2}>{selectedPlaylist.name}</Text>
        <View style={styles.plxSourceRow}>
          <View style={[styles.plxDot, { backgroundColor: A.solid }]} />
          <Text style={styles.plxSourceText}>Made for you</Text>
        </View>
        <Text style={styles.plxMeta}>{playlistItems.length} songs</Text>

        {/* Actions */}
        <View style={styles.plxActionRow}>
          <TouchableOpacity
            style={styles.plxRoundBtn}
            onPress={() => {
              setAddSongsSelectedIds(new Set());
              setAddSongsVisible(true);
            }}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.plxRoundBtn} onPress={openSortMenu}>
            <Ionicons name="swap-vertical" size={18} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.plxRoundBtn, editModeActive && { backgroundColor: A.solid, borderColor: A.solid }]}
            onPress={() => {
              setEditModeActive((prev) => !prev);
              setEditSelectedIds(new Set());
            }}
          >
            <Ionicons name="create-outline" size={18} color={editModeActive ? "#000" : "#fff"} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.plxRoundBtn, findInPlaylistVisible && { backgroundColor: A.solid, borderColor: A.solid }]}
            onPress={() => {
              setFindInPlaylistVisible((prev) => !prev);
              setFindInPlaylistQuery("");
            }}
          >
            <Ionicons name="search" size={18} color={findInPlaylistVisible ? "#000" : "#fff"} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.plxPlayBtn, { backgroundColor: A.solid, shadowColor: A.glow }]}
            onPress={() => playAllPlaylist(selectedPlaylist)}
            activeOpacity={0.85}
          >
            <Ionicons name="play" size={18} color="#000" />
            <Text style={styles.plxPlayText}>PLAY</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.plxRoundBtn} onPress={() => shufflePlaylist(selectedPlaylist)}>
            <Ionicons name="shuffle" size={19} color={A.solid} />
          </TouchableOpacity>
        </View>

        {findInPlaylistVisible && (
          <TextInput
            value={findInPlaylistQuery}
            onChangeText={setFindInPlaylistQuery}
            placeholder="Find in playlist..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            style={styles.findInPlaylistInput}
            autoFocus
          />
        )}

        {editModeActive && editSelectedIds.size > 0 && (
          <View style={styles.selectionBar}>
            <Text style={styles.selectionBarText}>{editSelectedIds.size} selected</Text>
            <TouchableOpacity style={styles.selectionTrashBtn} onPress={confirmRemoveSelected}>
              <Ionicons name="trash" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

'''
s = s[:a] + new_header + s[b:]

# 5) blurred artwork background behind the whole screen while a playlist is open
old = '''      <LinearGradient colors={GRADIENT_COLORS} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
'''
s = rep(s, old, old + '''      {selectedPlaylist && (
        <>
          {(() => {
            const bgArt = getPlaylistArt(selectedPlaylist);
            return bgArt ? (
              <Image source={bgArt} blurRadius={40} style={[StyleSheet.absoluteFill, { opacity: 0.55 }]} />
            ) : null;
          })()}
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(8,10,16,0.35)", "rgba(8,10,16,0.88)", "#080A10"]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            pointerEvents="none"
            colors={[plAccent.tint, "transparent"]}
            style={{ position: "absolute", top: 0, left: 0, right: 0, height: 420 }}
          />
        </>
      )}
''')

# 6) styles
marker = "  /* Spotify Playlist Hero View */"
s = rep(s, marker, '''  /* Playlist detail restyle (plx) */
  plxHeader: { paddingTop: 6, paddingBottom: 14 },
  plxCoverWrap: {
    alignSelf: "center", width: 200, height: 200, borderRadius: 20, borderWidth: 1.5,
    marginBottom: 20, backgroundColor: "#000",
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 22, elevation: 18,
  },
  plxCover: { width: "100%", height: "100%", borderRadius: 18 },
  plxPlaceholder: { justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)" },
  plxTitle: { color: "#fff", fontSize: 30, fontWeight: "900", letterSpacing: 0.3 },
  plxSourceRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  plxDot: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  plxSourceText: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "600" },
  plxMeta: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "600", marginTop: 3 },
  plxActionRow: { flexDirection: "row", alignItems: "center", marginTop: 18, gap: 7 },
  plxRoundBtn: {
    width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)",
  },
  plxPlayBtn: {
    flex: 1, height: 44, borderRadius: 22, flexDirection: "row", justifyContent: "center",
    alignItems: "center", gap: 6, marginLeft: 3,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 14, elevation: 10,
  },
  plxPlayText: { color: "#000", fontSize: 14, fontWeight: "800", letterSpacing: 1 },
  plxRow: { paddingHorizontal: 10, borderRadius: 16, marginBottom: 4, borderWidth: 1, borderColor: "transparent" },
  plxBar: { position: "absolute", left: 0, top: 12, bottom: 12, width: 3, borderRadius: 2 },
  plxMore: { padding: 6, marginLeft: 4 },

''' + marker)

open(p, "w").write(s)
print("patched OK ->", p, "(backup:", p + ".bak-plx)")

