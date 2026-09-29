import { useEffect, useState } from "react";
import { getListeningHistory } from "./listeningHistory";
import { getDownloads } from "./libraryStorage";
import { API_BASE, gatewayHeaders } from "./apiClient";
import { memoGet, memoSet } from "./memoCache";

const META = {
  lateNight: { title: "Late Night Mix", colors: ["#1B1B3A", "#3B2E6E"], note: "for the late hours" },
  morning: { title: "Morning Mix", colors: ["#FF9A6B", "#FF6B9A"], note: "to start your day" },
  replay: { title: "Replay Mix", colors: ["#1F8A70", "#4ECDC4"], note: "your most replayed" },
};

const keyOf = (t) => `${t.provider || ""}-${t.id}`;
const tsOf = (e) => e.playedAt || e.timestamp || e.playedAtMs || null;

function dedupe(list) {
  const seen = new Set();
  return list.filter((t) => {
    const k = keyOf(t);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// History entries may not carry a stream url yet, so resolve them through
// search first (same approach as the Made For You row).
async function resolveQueue(items) {
  const out = [];
  for (const item of items.slice(0, 10)) {
    if (item.stream_url || item.download_url || item.localUri) {
      out.push(item);
      continue;
    }
    try {
      const params = new URLSearchParams({ q: `${item.artist} ${item.title}`, limit: "1" });
      const res = await fetch(`${API_BASE}/api/apicache/api/music/search?${params.toString()}`, {
        headers: gatewayHeaders(),
      });
      const data = await res.json();
      if (data.tracks && data.tracks[0]) out.push(data.tracks[0]);
    } catch {
      // skip unresolvable item
    }
  }
  return out;
}

// Returns a hero slide object for the Made For You mix, or null.
export default function useHeroMix(onTrackPress) {
  const [mix, setMix] = useState(memoGet("heroMix") || null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [history, downloads] = await Promise.all([getListeningHistory(), getDownloads()]);
        const hour = new Date().getHours();
        let key = null;
        let items = [];

        if (hour >= 21 || hour < 5) {
          items = dedupe(
            history.filter((h) => {
              const ts = tsOf(h);
              if (!ts) return false;
              const hh = new Date(ts).getHours();
              return hh >= 21 || hh < 5;
            })
          );
          if (items.length >= 3) key = "lateNight";
        } else if (hour >= 5 && hour < 11) {
          items = dedupe(
            history.filter((h) => {
              const ts = tsOf(h);
              if (!ts) return false;
              const hh = new Date(ts).getHours();
              return hh >= 5 && hh < 11;
            })
          );
          if (items.length >= 3) key = "morning";
        }

        if (!key) {
          const counts = new Map();
          history.forEach((h) => counts.set(keyOf(h), (counts.get(keyOf(h)) || 0) + 1));
          const byId = new Map(downloads.map((d) => [keyOf(d), d]));
          items = [...counts.entries()]
            .filter(([, c]) => c > 1)
            .sort((a, b) => b[1] - a[1])
            .map(([k]) => byId.get(k))
            .filter(Boolean)
            .slice(0, 15);
          if (items.length > 0) key = "replay";
        }

        if (!key) {
          const bucket = (from, to) =>
            dedupe(
              history.filter((e) => {
                const ts = tsOf(e);
                if (!ts) return false;
                const hh = new Date(ts).getHours();
                return from < to ? hh >= from && hh < to : hh >= from || hh < to;
              })
            );
          const ln = bucket(21, 5);
          const mo = bucket(5, 11);
          if (ln.length >= 3) { key = "lateNight"; items = ln; }
          else if (mo.length >= 3) { key = "morning"; items = mo; }
        }

        if (!key || cancelled) return;
        setMix(memoSet("heroMix", { key, items: items.slice(0, 15) }));
      } catch {
        // no slide if anything fails
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!mix) return null;
  const meta = META[mix.key];
  const cover = mix.items.find((t) => t.artwork);

  return {
    key: "madeForYou",
    label: "MADE FOR YOU",
    title: meta.title,
    tagline: `${mix.items.length} tracks · ${meta.note}`,
    artwork: cover ? cover.artwork : null,
    colors: meta.colors,
    onPlay: async () => {
      const queue = await resolveQueue(mix.items);
      if (queue.length > 0 && onTrackPress) onTrackPress(queue[0], queue);
    },
  };
}
