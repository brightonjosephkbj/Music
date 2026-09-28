#!/bin/bash
echo "=== build.yml ==="
cat .github/workflows/build.yml
echo
echo "=== android section of app.json ==="
python3 -c "import json;print(json.dumps(json.load(open('app.json'))['expo'].get('android'),indent=2))"
