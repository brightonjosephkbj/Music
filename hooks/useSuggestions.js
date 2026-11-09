import { useEffect, useState } from "react";

const cache = new Map();

export default function useSuggestions(text) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const q = (text || "").trim().toLowerCase();
    if (q.length < 2) { setItems([]); return; }
    if (cache.has(q)) { setItems(cache.get(q)); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          "https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=" + encodeURIComponent(q),
          { signal: ctrl.signal }
        );
        const j = await r.json();
        const list = (j[1] || []).slice(0, 8);
        cache.set(q, list);
        setItems(list);
      } catch (e) {}
    }, 150);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [text]);
  return items;
}
