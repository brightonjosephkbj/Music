import { useEffect, useState, useCallback } from "react";
import { gatewayFetch } from "./apiClient";

let AsyncStorage = null;
try { AsyncStorage = require("@react-native-async-storage/async-storage").default; } catch (e) {}

const KEY = "b24_dismissed_announcement";
const DEBUG = true; // set false when done

export default function useAnnouncementSlide() {
  const [ann, setAnn] = useState(null);
  const [dbg, setDbg] = useState(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const res = await gatewayFetch("/api/db/announcements/active");
        if (!res.ok) { if (DEBUG && !dead) setDbg("HTTP " + res.status); return; }
        const j = await res.json();
        const a = j && j.id ? j : (j && (j.data || j.result)) || null;
        if (!a || !a.id || dead) { if (DEBUG && !dead) setDbg("None active: " + JSON.stringify(j).slice(0, 80)); return; }
        let seen = null;
        try { seen = AsyncStorage && (await AsyncStorage.getItem(KEY)); } catch (e) {}
        if (String(seen) === String(a.id)) { if (DEBUG) setDbg("Dismissed id " + a.id); return; }
        setAnn(a);
      } catch (e) { if (DEBUG) setDbg("Error: " + String(e && e.message)); }
    })();
    return () => { dead = true; };
  }, []);

  const dismiss = useCallback(async () => {
    try { if (AsyncStorage && ann) await AsyncStorage.setItem(KEY, String(ann.id)); } catch (e) {}
    setAnn(null);
  }, [ann]);

  if (!ann) {
    if (!DEBUG || !dbg) return null;
    return { key: "ann-debug", label: "ANNOUNCEMENT DEBUG", title: dbg, tagline: "", artwork: null, colors: ["#3A0F0F", "#B3261E"], cta: "OK", icon: "bug", onPlay: () => setDbg(null) };
  }
  return {
    key: `announcement-${ann.id}`,
    label: "ANNOUNCEMENT",
    title: ann.title,
    tagline: ann.body || "",
    artwork: null,
    colors: ["#1B1040", "#5B2EE0"],
    cta: "Got it",
    icon: "checkmark",
    onPlay: dismiss,
  };
}
