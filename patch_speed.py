p = "PlayerCard.js"
s = open(p).read()
open(p + ".bak4", "w").write(s)

def sub(old, new):
    global s
    assert s.count(old) == 1, (s.count(old), old[:70])
    s = s.replace(old, new)

# speed survives the card being re-created
sub("const RATES = [1, 1.25, 1.5, 2, 0.75];",
    "const RATES = [1, 1.25, 1.5, 2, 0.75];\nlet SAVED_RATE = 1;")
sub("const [playbackRate, setPlaybackRate] = useState(1);",
    "const [playbackRate, setPlaybackRate] = useState(SAVED_RATE);")

# remember the new speed when the button is pressed
sub("    setPlaybackRate(next);\n",
    "    SAVED_RATE = next;\n    setPlaybackRate(next);\n")

# re-apply the saved speed to the engine on every track change
sub("  const cycleSpeed = () => {",
"""  useEffect(() => {
    try {
      if (typeof L.current.engine?.setRate === "function") L.current.engine.setRate(SAVED_RATE);
    } catch (e) {}
  }, [track?.id, track?.provider]);

  const cycleSpeed = () => {""")

open(p, "w").write(s)
print("speed patched, backup at PlayerCard.js.bak4")
