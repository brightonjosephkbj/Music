#!/usr/bin/env python3
"""Shared-playlist server check. READ-ONLY (only the login is a POST).
Never prints your gateway key, password or token."""
import json, re, sys, time, getpass, urllib.request, urllib.error

PRIMARY  = "https://gateway-b0tx.onrender.com"
FALLBACK = "https://nrighton233j-api-cache.hf.space/gw"
TIMEOUT  = 90  # Render free tier can take ~60s to wake up

try:
    src = open("services/apiClient.js").read()
    KEY = re.search(r'GATEWAY_KEY\s*=\s*"([^"]+)"', src).group(1)
except Exception as e:
    sys.exit("Run this from your project folder (needs services/apiClient.js): %s" % e)

def call(base, path, method="GET", body=None, token=None):
    h = {"X-Gateway-Key": KEY}
    if token: h["Authorization"] = "Bearer " + token
    data = None
    if body is not None:
        data = json.dumps(body).encode(); h["Content-Type"] = "application/json"
    req = urllib.request.Request(base + path, data=data, headers=h, method=method)
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            raw = r.read(); code = r.status
    except urllib.error.HTTPError as e:
        raw = e.read(); code = e.code
    except Exception as e:
        return None, int((time.time()-t0)*1000), {"error": type(e).__name__ + ": " + str(e)[:80]}
    ms = int((time.time()-t0)*1000)
    try: js = json.loads(raw)
    except Exception: js = {"error": "non-JSON reply: " + raw[:60].decode("utf8", "replace")}
    return code, ms, js

def line(name, code, ms, note=""):
    ok = "OK  " if code and 200 <= code < 300 else "FAIL"
    print("  [%s] %-34s %-5s %6d ms  %s" % (ok, name, code if code else "-", ms, note))

user = input("Username: ").strip()
pw = getpass.getpass("Password (hidden): ")

summary = {}
for label, base in (("PRIMARY (Render)", PRIMARY), ("FALLBACK (HF Space)", FALLBACK)):
    print("\n=== %s  %s" % (label, base))
    code, ms, js = call(base, "/")
    line("GET / (is it awake?)", code, ms, "" if code else js.get("error", ""))
    code, ms, js = call(base, "/api/db/users/login", "POST", {"username": user, "password": pw})
    if not (code and js.get("ok")):
        line("login", code, ms, js.get("error", ""))
        summary[label] = None
        continue
    me = js["data"]; uid = me["id"]; tok = me.get("token")
    line("login", code, ms, "user id " + str(uid))
    s = {"uid": uid}
    code, ms, js = call(base, "/api/db/friends/list/%s" % uid, token=tok)
    n = len(js.get("data") or []) if isinstance(js, dict) else "?"
    line("friends list", code, ms, "%s friends" % n if code and js.get("ok") else js.get("error", ""))
    s["friends"] = n
    code, ms, js = call(base, "/api/db/group-playlists/list/%s" % uid, token=tok)
    pls = (js.get("data") or []) if js.get("ok") else []
    line("group playlists list", code, ms, "%d playlists" % len(pls) if js.get("ok") else js.get("error", ""))
    s["playlists"] = {str(p.get("id")): p.get("name") for p in pls}
    s["tracks"] = {}; s["members"] = {}
    for p in pls[:5]:
        pid = p.get("id"); nm = p.get("name")
        code, ms, js = call(base, "/api/db/group-playlists/%s/tracks" % pid, token=tok)
        tr = js.get("data") or [] if js.get("ok") else []
        line("tracks of '%s'" % str(nm)[:18], code, ms, "%d tracks" % len(tr) if js.get("ok") else js.get("error", ""))
        s["tracks"][str(pid)] = len(tr)
        missing = sum(1 for t in tr if not t.get("source_url"))
        if missing: print("        ! %d track(s) have no source_url (can't play on other devices)" % missing)
        code, ms, js = call(base, "/api/db/group-playlists/%s/members" % pid, token=tok)
        mem = js.get("data") or [] if js.get("ok") else []
        line("members of '%s'" % str(nm)[:16], code, ms, "%d members" % len(mem) if js.get("ok") else js.get("error", ""))
        s["members"][str(pid)] = len(mem)
    code, ms, js = call(base, "/api/db/shares/inbox/%s?app=music&unseen_only=false" % uid, token=tok)
    line("shared inbox", code, ms, "%d items" % len(js.get("data") or []) if js.get("ok") else js.get("error", ""))
    summary[label] = s

print("\n=== COMPARISON (are both servers using the same data?)")
a, b = summary.get("PRIMARY (Render)"), summary.get("FALLBACK (HF Space)")
if not a or not b:
    print("  Could not compare - one server failed to log you in (see FAIL lines above).")
else:
    print("  same user id on both :", a["uid"] == b["uid"])
    print("  same playlists       :", a["playlists"] == b["playlists"])
    print("  same track counts    :", a["tracks"] == b["tracks"])
    print("  same member counts   :", a["members"] == b["members"])
    if not (a["playlists"] == b["playlists"] and a["tracks"] == b["tracks"]):
        print("  -> DATA IS SPLIT: songs added while the app was on the fallback won't show on the main server.")
print("\nDone. Nothing was changed on the servers.")
