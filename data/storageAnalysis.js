const norm = (s) =>
  String(s || "").toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, " ").replace(/[^a-z0-9]/g, "");
const firstArtist = (a) => String(a || "").split(/,|&|\bfeat\.?\b|\bft\.?\b|\bx\b/i)[0];
const dur = (d) => Number(d.duration) || 0;
const MB = 1024 * 1024;

export function findDuplicates(downloads, sizes) {
  const items = downloads;
  const sz = (d) => sizes.get(d.id) || 0;
  const parent = items.map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const union = (a, b) => { parent[find(a)] = find(b); };
  const close = (a, b) => {
    const x = dur(items[a]);
    const y = dur(items[b]);
    return !x || !y || Math.abs(x - y) <= 3;
  };
  const byName = new Map();
  const bySize = new Map();
  items.forEach((d, i) => {
    const t = norm(d.title);
    if (t) {
      const k = `${d.type}|${t}|${norm(firstArtist(d.artist))}`;
      byName.set(k, [...(byName.get(k) || []), i]);
    }
    const s = sz(d);
    if (s > 100000) {
      const k = `${d.type}|${s}`;
      bySize.set(k, [...(bySize.get(k) || []), i]);
    }
  });
  [byName, bySize].forEach((m) =>
    m.forEach((idx) => {
      for (let a = 0; a < idx.length; a++)
        for (let b = a + 1; b < idx.length; b++) if (close(idx[a], idx[b])) union(idx[a], idx[b]);
    })
  );
  const groups = new Map();
  items.forEach((d, i) => {
    const r = find(i);
    groups.set(r, [...(groups.get(r) || []), d]);
  });
  const out = [];
  groups.forEach((g) => {
    if (g.length < 2) return;
    g.sort(
      (a, b) =>
        sz(b) - sz(a) ||
        (b.artwork ? 1 : 0) - (a.artwork ? 1 : 0) ||
        (Number(a.addedAt) || 0) - (Number(b.addedAt) || 0)
    );
    const [keep, ...remove] = g;
    out.push({ keep, remove, saves: remove.reduce((n, d) => n + sz(d), 0) });
  });
  return out.sort((a, b) => b.saves - a.saves);
}

export function findLargeVideos(downloads, sizes) {
  return downloads
    .filter((d) => d.type === "video" && (sizes.get(d.id) || 0) >= 20 * MB)
    .sort((a, b) => (sizes.get(b.id) || 0) - (sizes.get(a.id) || 0))
    .slice(0, 15);
}

export function findNeverPlayed(downloads, history, sizes) {
  const played = new Set();
  (history || []).forEach((h) => {
    if (h.id != null) played.add(String(h.id));
    played.add(`${h.provider || ""}-${h.id}`);
    played.add(norm(h.title) + "|" + norm(h.artist));
  });
  const weekAgo = Date.now() - 7 * 86400000;
  return downloads
    .filter(
      (d) =>
        d.type !== "video" &&
        !played.has(String(d.id)) &&
        !played.has(`${d.provider || ""}-${d.id}`) &&
        !played.has(norm(d.title) + "|" + norm(d.artist)) &&
        (Number(d.addedAt) || 0) < weekAgo
    )
    .sort((a, b) => (sizes.get(b.id) || 0) - (sizes.get(a.id) || 0));
}
