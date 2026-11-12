from pathlib import Path
import shutil

path = Path("hooks/usePlaybackEngine.js")
src = path.read_text()

old = 'const audioPlayer = useAudioPlayer(null, { updateInterval: 100 });'
new = 'const audioPlayer = useAudioPlayer(null, { updateInterval: 250 });'

if old not in src:
    if new in src:
        print("Already optimized to 250 ms.")
        raise SystemExit(0)
    raise SystemExit("Expected audio player declaration not found. No changes made.")

backup = path.with_name("usePlaybackEngine.js.audio-backup")
shutil.copy2(path, backup)

path.write_text(src.replace(old, new, 1))

print("SUCCESS: Audio status updates changed from 100 ms to 250 ms.")
print(f"Backup: {backup}")
