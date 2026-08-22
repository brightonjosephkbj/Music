import pathlib

path = pathlib.Path("FullscreenVideoPlayer.js")
src = path.read_text()

old_import = 'import { VideoView } from "expo-video";'
assert old_import in src, "import anchor not found"
new_import = old_import + '\nimport * as ScreenOrientation from "expo-screen-orientation";'
src = src.replace(old_import, new_import, 1)

old_state = '''  const [rotated, setRotated] = useState(false);
  const toggleRotate = () => setRotated((r) => !r);'''
assert old_state in src, "state anchor not found"
new_state = old_state + '''

  // App.json locks the whole app to portrait. expo-screen-orientation can
  // override that per-screen: unlock on mount so a physical rotation
  // triggers a real native landscape layout, re-lock to portrait on
  // unmount so the rest of the app stays portrait-only.
  useEffect(() => {
    ScreenOrientation.unlockAsync();
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);'''
src = src.replace(old_state, new_state, 1)

path.write_text(src)
print("patched FullscreenVideoPlayer.js")
