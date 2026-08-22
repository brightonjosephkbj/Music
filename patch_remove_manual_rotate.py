import pathlib

path = pathlib.Path("FullscreenVideoPlayer.js")
src = path.read_text()

# 1. Remove rotated state + toggle function
old_state = '''  const [rotated, setRotated] = useState(false);
  const toggleRotate = () => setRotated((r) => !r);

  // App.json locks the whole app to portrait. expo-screen-orientation can'''
assert old_state in src, "state anchor not found"
new_state = '''  // App.json locks the whole app to portrait. expo-screen-orientation can'''
src = src.replace(old_state, new_state, 1)

# 2. Simplify videoStyle — native rotation now handles landscape layout
old_style = '''  const videoStyle = rotated
    ? {
        position: "absolute",
        top: (SCREEN_HEIGHT - SCREEN_WIDTH) / 2,
        left: (SCREEN_WIDTH - SCREEN_HEIGHT) / 2,
        width: SCREEN_HEIGHT,
        height: SCREEN_WIDTH,
        transform: [{ rotate: "90deg" }],
      }
    : StyleSheet.absoluteFill;'''
assert old_style in src, "videoStyle anchor not found"
new_style = '''  const videoStyle = StyleSheet.absoluteFill;'''
src = src.replace(old_style, new_style, 1)

# 3. Remove the rotate button
old_button = '''
            <TouchableOpacity onPress={toggleRotate} style={styles.iconButton}>
              <Text style={styles.iconText}>{rotated ? "Portrait" : "Rotate"}</Text>
            </TouchableOpacity>'''
assert old_button in src, "button anchor not found"
src = src.replace(old_button, '', 1)

path.write_text(src)
print("patched FullscreenVideoPlayer.js")
