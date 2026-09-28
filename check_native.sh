#!/bin/bash
echo "=== native deps already installed ==="
grep -nE "linear-gradient|image-colors|expo-blur|expo-video|expo-audio|\"expo\":" package.json
echo; echo "=== app.json version info ==="
grep -nE "\"version\"|versionCode|runtimeVersion|plugins" app.json
echo; echo "=== CI workflows ==="
ls .github/workflows 2>/dev/null || echo "none in this repo"
grep -nE "^on:|workflow_dispatch|push:|branches|tags" .github/workflows/*.yml 2>/dev/null
git remote -v | head -2
