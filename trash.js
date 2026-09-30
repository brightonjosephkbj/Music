import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getDownloads, addDownloadEntry, getTrash, saveTrash,
  getPlaylists, savePlaylists, getFolders, saveFolders,
} from "./libraryStorage";
import { deleteFileSafe } from "./storageScan";

export const TRASH_DAYS = 10;
const DAY = 86400000;
const PW_KEY = "b24music:trash_pw";

export const daysLeft = (e) =>
  Math.max(0, Math.ceil(((e.deletedAt || 0) + TRASH_DAYS * DAY - Date.now()) / DAY));

// ---- small SHA-256 (pure JS, no native module) ----
const K = [
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
];
const rotr = (x, n) => (x >>> n) | (x << (32 - n));
function sha256(str) {
  const bytes = unescape(encodeURIComponent(str)).split("").map((c) => c.charCodeAt(0));
  const l = bytes.length;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const hi = Math.floor((l * 8) / 4294967296);
  const lo = (l * 8) >>> 0;
  bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255,
             (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
  let h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const w = new Array(64);
  for (let i = 0; i < bytes.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = (bytes[i + 4 * t] << 24) | (bytes[i + 4 * t + 1] << 16) | (bytes[i + 4 * t + 2] << 8) | bytes[i + 4 * t + 3];
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[t] + w[t]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h = [(h[0] + a) | 0, (h[1] + b) | 0, (h[2] + c) | 0, (h[3] + d) | 0,
         (h[4] + e) | 0, (h[5] + f) | 0, (h[6] + g) | 0, (h[7] + hh) | 0];
  }
  return h.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}
function kdf(pw, salt) {
  let h = pw + salt;
  for (let i = 0; i < 2000; i++) h = sha256(h + salt + pw);
  return h;
}

export async function hasTrashPassword() {
  return !!(await AsyncStorage.getItem(PW_KEY));
}
export async function setTrashPassword(pw) {
  const salt = Math.random().toString(16).slice(2) + Date.now().toString(16);
  await AsyncStorage.setItem(PW_KEY, JSON.stringify({ salt, hash: kdf(pw, salt) }));
}
export async function checkTrashPassword(pw) {
  try {
    const { salt, hash } = JSON.parse(await AsyncStorage.getItem(PW_KEY));
    return kdf(pw, salt) === hash;
  } catch {
    return false;
  }
}

// ---- trash operations ----
// Deletes files (unless an active download still uses the same file), cleans
// playlist/folder references, and removes the entries from the trash.
export async function purgeEntries(entries) {
  if (!entries.length) return { deleted: 0, failed: 0 };
  const active = new Set((await getDownloads()).map((d) => d.localUri).filter(Boolean));
  let deleted = 0;
  let failed = 0;
  for (const e of entries) {
    if (!e.localUri || active.has(e.localUri)) continue;
    const r = await deleteFileSafe(e.localUri);
    if (r === "deleted") deleted++;
    else if (r === "failed") failed++;
  }
  const ids = new Set(entries.map((e) => e.id));
  const pls = await getPlaylists();
  await savePlaylists(pls.map((p) => ({ ...p, trackIds: (p.trackIds || []).filter((t) => !ids.has(t)) })));
  const fls = await getFolders();
  await saveFolders(fls.map((f) => ({ ...f, itemIds: (f.itemIds || []).filter((t) => !ids.has(t)) })));
  await saveTrash((await getTrash()).filter((t) => !ids.has(t.id)));
  return { deleted, failed };
}

export async function purgeExpiredTrash() {
  const now = Date.now();
  const expired = (await getTrash()).filter((t) => now - (t.deletedAt || 0) >= TRASH_DAYS * DAY);
  if (expired.length) await purgeEntries(expired);
}

export async function restoreEntries(entries) {
  const ids = new Set(entries.map((e) => e.id));
  for (const e of entries) {
    const { deletedAt, ...rest } = e;
    await addDownloadEntry(rest);
  }
  await saveTrash((await getTrash()).filter((t) => !ids.has(t.id)));
}

export async function emptyTrash() {
  return purgeEntries(await getTrash());
}

// "Forgot password": erase everything in the trash and remove the password.
export async function resetTrash() {
  await emptyTrash();
  await AsyncStorage.removeItem(PW_KEY);
}

// When removing duplicates, playlists/folders that held a removed copy point at the kept copy.
export async function mergeReferences(idMap) {
  if (!idMap.size) return;
  const swap = (arr) => {
    const out = [];
    (arr || []).forEach((id) => {
      const n = idMap.get(id) || id;
      if (!out.includes(n)) out.push(n);
    });
    return out;
  };
  const pls = await getPlaylists();
  await savePlaylists(pls.map((p) => ({ ...p, trackIds: swap(p.trackIds) })));
  const fls = await getFolders();
  await saveFolders(fls.map((f) => ({ ...f, itemIds: swap(f.itemIds) })));
}
