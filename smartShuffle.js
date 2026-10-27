// A shuffle that feels good to listen to.
// Pure random clumps (same artist 3x in a row). This spreads each artist's
// songs evenly through the queue while keeping the order random.

let lastStartId = null; // remember how the previous shuffle began

// Things shuffle should never pick: voice notes, WhatsApp audio, recordings,
// call recordings and tiny unknown-artist clips. They can still be played by
// tapping them, shuffle just never plays them out loud by surprise.
const PRIVATE_TITLE = [
  /^(AUD|PTT|REC|VN)[-_ ]?\d/i,
  /^(voice|audio|sound|call)[ _-]?(note|memo|record|rec)/i,
  /^(new )?recording\b/i,
  /^\d{8,}$/,
];
const PRIVATE_PATH = [
  /whatsapp[^/]*\/[^/]*(voice|audio)/i,
  /(voice ?recorder|sound ?recorder|recordings?|call ?rec)/i,
];

function isJunk(t) {
  if (!t || t.type === "image") return true;
  const title = String(t.title || "").trim();
  if (PRIVATE_TITLE.some((re) => re.test(title))) return true;
  const path = String(t.uri || t.path || t.filePath || t.file || t.filename || "");
  if (path && PRIVATE_PATH.some((re) => re.test(path))) return true;
  const noArtist = !t.artist || /^unknown artist$/i.test(String(t.artist).trim());
  if (noArtist && (!t.duration || t.duration < 90)) return true;
  return false;
}

function artistKey(t, i) {
  const a = String(t.artist || "").trim().toLowerCase();
  // Unknown artists are NOT one group, otherwise they'd be forced apart
  if (!a || a === "unknown artist") return "__unknown_" + i;
  return a;
}

export function smartShuffle(tracks) {
  let list = (tracks || []).filter((t) => !isJunk(t));
  if (list.length === 0) return [];

  // 1. group by artist
  const groups = new Map();
  list.forEach((t, i) => {
    const k = artistKey(t, i);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  });

  // 2. shuffle inside each group, then give every song a position key.
  //    An artist with n songs gets keys spread across 0..1, so they land
  //    evenly through the queue, with a random jitter so it never repeats.
  const keyed = [];
  for (const members of groups.values()) {
    for (let i = members.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [members[i], members[j]] = [members[j], members[i]];
    }
    const n = members.length;
    members.forEach((t, k) => keyed.push({ t, key: (k + Math.random()) / n }));
  }
  keyed.sort((a, b) => a.key - b.key);
  const q = keyed.map((x) => x.t);

  // 3. repair pass: if the same artist still ended up next to itself,
  //    swap in a later song from a different artist
  const same = (a, b) =>
    a && b && String(a.artist || "").trim().toLowerCase() === String(b.artist || "").trim().toLowerCase() &&
    String(a.artist || "").trim() && !/^unknown artist$/i.test(String(a.artist).trim());
  for (let i = 1; i < q.length; i++) {
    if (same(q[i], q[i - 1])) {
      for (let j = i + 1; j < q.length; j++) {
        if (!same(q[j], q[i - 1]) && !same(q[j], q[i + 1])) {
          [q[i], q[j]] = [q[j], q[i]];
          break;
        }
      }
    }
  }

  // 4. never open with the same song as the last shuffle
  if (q.length > 1 && q[0].id === lastStartId) q.push(q.shift());
  lastStartId = q[0].id;
  return q;
}
