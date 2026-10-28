p = "PlayerCard.js"
s = open(p).read()
open(p + ".bak", "w").write(s)

def sub(old, new, n=1):
    global s
    assert s.count(old) == n, (s.count(old), old[:70])
    s = s.replace(old, new)

# ---- cleanup: duplicate Modal import, inline require, unused TABS ----
sub('import { Modal as RNModal } from "react-native";\n', "")
sub("<RNModal visible", "<Modal visible")
sub("</RNModal>", "</Modal>")
sub('const TABS = ["Song", "Lyrics", "Related"];\n', "")
sub('  useWindowDimensions,\n} from "react-native";',
    '  useWindowDimensions,\n  Platform,\n} from "react-native";')
sub('require("react-native").Platform.OS', "Platform.OS")

# ---- #3: sheet runs on native thread (translateY instead of top) ----
sub("useNativeDriver: false, bounciness: 3, speed: 14",
    "useNativeDriver: true, bounciness: 3, speed: 14")
sub("const cardTop = sheet.interpolate({ inputRange: [0, 1], outputRange: [closedTop, openTop] });",
    "const cardY = sheet.interpolate({ inputRange: [0, 1], outputRange: [sheetRange, 0] });")
sub("<Animated.View style={[styles.card, { top: cardTop }]}>",
    "<Animated.View style={[styles.card, { top: openTop, transform: [{ translateY: cardY }] }]}>")

# ---- #4: sleep timer uses a deadline, also checked on playback ticks ----
sub("const sleepTimerRef = useRef(null);",
    "const sleepTimerRef = useRef(null);\n  const sleepEndRef = useRef(null);")
sub("    setSleepMinutes(minutes);",
    "    setSleepMinutes(minutes);\n    sleepEndRef.current = minutes !== null ? Date.now() + minutes * 60000 : null;")
sub("        setSleepMinutes(null);",
    "        setSleepMinutes(null);\n        sleepEndRef.current = null;")
sub("  const cycleSpeed = () => {",
    """  useEffect(() => {
    const end = sleepEndRef.current;
    if (end && Date.now() >= end) {
      const eng = L.current.engine;
      if (eng?.isPlaying) eng.toggle();
      sleepEndRef.current = null;
      setSleepMinutes(null);
    }
  }, [engine?.position]);

  const cycleSpeed = () => {""")

# ---- #5: ask permission BEFORE downloading, always clean temp file ----
sub('      const perm = await MediaLibrary.requestPermissionsAsync();\n'
    '      if (!perm.granted) throw new Error("Storage permission is required to save songs permanently");\n', "")
sub("      const filename = buildLibraryFilename(track.title, track.artist, key);",
    '      const perm = await MediaLibrary.requestPermissionsAsync();\n'
    '      if (!perm.granted) throw new Error("Storage permission is required to save songs permanently");\n'
    "      const filename = buildLibraryFilename(track.title, track.artist, key);")
sub("    setLibDownloading(true);", "    setLibDownloading(true);\n    let tempUri = null;")
sub("      const tempUri = FileSystem.cacheDirectory + filename;",
    "      tempUri = FileSystem.cacheDirectory + filename;")
sub("      setLibDownloading(false);",
    "      if (tempUri) FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});\n      setLibDownloading(false);")

# ---- #7: stop failing silently ----
sub("    } catch {}",
    '    } catch (e) {\n      Alert.alert("Couldn\'t play", friendlyError(e, "Try again."));\n    }')
sub("if (!u?.id) return;", 'if (!u?.id) throw new Error("Please sign in first.");', n=2)

open(p, "w").write(s)
print("patched OK, backup at PlayerCard.js.bak")
