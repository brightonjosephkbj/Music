import json

with open("app.json") as f:
    cfg = json.load(f)

found = False
for p in cfg["expo"]["plugins"]:
    if isinstance(p, list) and p[0] == "expo-media-control":
        assert "notificationIcon" not in p[1], "already patched"
        p[1]["notificationIcon"] = "./assets/notification_icon.xml"
        found = True
assert found, "expo-media-control plugin entry not found"

with open("app.json", "w") as f:
    json.dump(cfg, f, indent=2)
    f.write("\n")
print("patched")
