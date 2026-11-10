path = "screens/ShareThreadScreen.js"
src = open(path, encoding="utf-8").read()

def swap(old, new):
    global src
    assert src.count(old) == 1, "not found exactly once: " + old[:70]
    src = src.replace(old, new)

# 1. imports (aliased so they can never clash with existing ones)
swap('import { getDownloads } from "../data/libraryStorage";',
     'import { getDownloads } from "../data/libraryStorage";\n'
     'import { Animated as ShareAnim, ActivityIndicator as ShareSpinner } from "react-native";\n'
     'import { useDownloads as useShareDownloads } from "../context/DownloadsContext";\n'
     'import { getSharedSong, findSharedInLibrary } from "../services/shareDownload";')

# 2. the slide-out card + new ThreadRow signature
swap("function ThreadRow({ item, isUnseen, onPress }) {", '''function ShareDlCard({ stage, pct }) {
  const a = useRef(new ShareAnim.Value(0)).current;
  useEffect(() => {
    ShareAnim.timing(a, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [a]);
  const label = stage === "searching" ? "Finding the song…" : stage === "preparing" ? "Preparing…" : "Downloading";
  const p = Math.round((pct || 0) * 100);
  return (
    <ShareAnim.View
      style={{
        opacity: a,
        transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
        backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
        borderRadius: 14, padding: 12, marginTop: -4, marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>{label}</Text>
        <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>{stage === "downloading" ? p + "%" : ""}</Text>
      </View>
      <View style={{ height: 5, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 3, marginTop: 9, overflow: "hidden" }}>
        <View style={{ height: "100%", width: (stage === "downloading" ? p : 0) + "%", backgroundColor: "#FF6B6B", borderRadius: 3 }} />
      </View>
    </ShareAnim.View>
  );
}

function ThreadRow({ item, isUnseen, onPress, onGet, getState, saved }) {''')

# 3. wrap the row in a View, add the button, and the card under it
swap('  const sent = item.direction === "sent";\n  return (',
     '  const sent = item.direction === "sent";\n  const busy = !!getState && getState.stage !== "error";\n  return (')
swap("    <TouchableOpacity style={styles.row} onPress={() => onPress(item)}>",
     "    <View>\n    <TouchableOpacity style={styles.row} onPress={() => onPress(item)}>")
swap("      {isUnseen && <View style={styles.unseenDot} />}\n    </TouchableOpacity>\n  );\n}",
'''      {isUnseen && <View style={styles.unseenDot} />}

      {!sent && (
        <TouchableOpacity
          onPress={() => onGet(item)}
          disabled={busy || saved}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            width: 38, height: 38, borderRadius: 19, marginLeft: 8,
            backgroundColor: saved ? "#2E9E5B" : "#FF6B6B",
            alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? (
            <ShareSpinner color="#fff" size="small" />
          ) : (
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>{saved ? "✓" : "↓"}</Text>
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
    {busy && <ShareDlCard stage={getState.stage} pct={getState.pct} />}
    {!!getState && getState.stage === "error" && (
      <Text style={{ color: "#FF8A8A", fontSize: 12, marginBottom: 10, marginLeft: 4 }}>
        Could not get that song. Tap the arrow to try again.
      </Text>
    )}
    </View>
  );
}''')

# 4. state, "already in my library" check, and the Get handler
swap("  const unseenIdsRef = useRef(new Set());",
'''  const unseenIdsRef = useRef(new Set());
  const dlHooks = useShareDownloads();
  const [getStates, setGetStates] = useState({}); // share id -> { stage, pct }
  const [savedIds, setSavedIds] = useState(() => new Set());''')

swap("  const handlePress = (item) => {\n    onTrackPress?.(item);\n  };",
'''  const handlePress = (item) => {
    onTrackPress?.(item);
  };

  // Mark songs that are already in the library so they show a green tick
  useEffect(() => {
    let alive = true;
    (async () => {
      const next = new Set();
      for (const it of thread) {
        if (it.direction === "sent") continue;
        const m = it.item_meta || {};
        if (m.title && (await findSharedInLibrary({ title: m.title, artist: m.artist }))) next.add(it.id);
      }
      if (alive) setSavedIds(next);
    })();
    return () => { alive = false; };
  }, [thread]);

  const handleGet = useCallback(async (item) => {
    const m = item.item_meta || {};
    if (!m.title) return;
    const st = getStates[item.id];
    if (savedIds.has(item.id) || (st && st.stage !== "error")) return;
    setGetStates((p) => ({ ...p, [item.id]: { stage: "searching", pct: 0 } }));
    try {
      await getSharedSong(m, {
        hooks: dlHooks,
        onStatus: (stage, pct) => setGetStates((p) => ({ ...p, [item.id]: { stage, pct } })),
      });
      setSavedIds((p) => new Set(p).add(item.id));
      setGetStates((p) => { const n = { ...p }; delete n[item.id]; return n; });
    } catch (e) {
      setGetStates((p) => ({ ...p, [item.id]: { stage: "error", pct: 0 } }));
    }
  }, [getStates, savedIds, dlHooks]);''')

# 5. pass the new props to each row and make the list re-draw on change
swap("              onPress={handlePress}\n            />",
     "              onPress={handlePress}\n              onGet={handleGet}\n              getState={getStates[item.id]}\n              saved={savedIds.has(item.id)}\n            />")
swap("          data={thread}\n", "          data={thread}\n          extraData={[getStates, savedIds]}\n")

open(path, "w", encoding="utf-8").write(src)
print("patched OK")
