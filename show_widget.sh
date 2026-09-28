#!/bin/bash
echo "=== widget plugin in app.json ==="
python3 - << 'PY'
import json
ex = json.load(open("app.json"))["expo"]
for p in ex.get("plugins", []):
    if isinstance(p, list) and "widget" in json.dumps(p).lower():
        print(json.dumps(p, indent=2))
PY
echo
echo "=== package ==="
grep -n "widget" package.json
echo
echo "=== widget files ==="
wc -l NowPlayingWidget.js nowPlayingWidget.js widget-task-handler.js 2>/dev/null
echo
echo "=== NowPlayingWidget.js ==="
cat NowPlayingWidget.js
