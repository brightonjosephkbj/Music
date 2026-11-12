import { useState, useCallback, useMemo } from "react";
import { getSharedSong } from "../services/shareDownload";

// Builds a hero slide for the newest unseen shared song: sender picture,
// name, song title/artist and a Play button. Play searches + downloads the
// song the same way the thread screen does, then plays it.
export default function useSharedSongSlide({ items, dlHooks, onTrackPress, onPlayed }) {
  const [busy, setBusy] = useState(null); // { stage, pct }
  const [failed, setFailed] = useState(false);

  const item = useMemo(
    () =>
      (items || []).find(
        (it) => it && it.item_type !== "video" && it.item_meta && it.item_meta.title
      ) || null,
    [items]
  );

  const play = useCallback(async () => {
    if (!item || busy) return;
    setFailed(false);
    setBusy({ stage: "searching", pct: 0 });
    try {
      const res = await getSharedSong(item.item_meta, {
        hooks: dlHooks,
        onStatus: (stage, pct) => setBusy({ stage, pct }),
      });
      setBusy(null);
      const entry = res && res.entry;
      if (entry && onTrackPress) onTrackPress(entry, [entry]);
      if (onPlayed) onPlayed(item);
    } catch (e) {
      setBusy(null);
      setFailed(true);
    }
  }, [item, busy, dlHooks, onTrackPress, onPlayed]);

  if (!item) return null;

  const meta = item.item_meta;
  let cta = failed ? "Try again" : "Play";
  if (busy) {
    if (busy.stage === "downloading") {
      const p = busy.pct || 0;
      cta = "Downloading " + Math.round(p <= 1 ? p * 100 : p) + "%";
    } else if (busy.stage === "preparing") cta = "Preparing...";
    else cta = "Searching...";
  }

  return {
    key: "shared-" + item.id,
    label: "SHARED WITH YOU",
    title: meta.title,
    tagline: meta.artist || "",
    artwork: meta.artwork_url || null,
    colors: ["#1E1033", "#6B2FD6"],
    cta,
    icon: busy ? "hourglass" : "play",
    sender: {
      name: item.from_username || "Someone",
      avatarUrl: item.from_avatar_url || null,
      letter: item.from_avatar_letter || (item.from_username || "?").charAt(0),
    },
    onPlay: play,
  };
}
