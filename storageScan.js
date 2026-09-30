import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LegacyFS from "expo-file-system/legacy";
import { Paths } from "expo-file-system";

const SIZE_KEY = "b24_file_sizes_v1";

export function fmtBytes(b) {
  if (!b || b < 0) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = b;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${u[i]}`;
}

export async function getDiskInfo() {
  let total = 0;
  let free = 0;
  try { total = Paths.totalDiskSpace; free = Paths.availableDiskSpace; } catch {}
  if (!total) {
    try {
      total = await LegacyFS.getTotalDiskCapacityAsync();
      free = await LegacyFS.getFreeDiskStorageAsync();
    } catch {}
  }
  return { total: total || 0, free: free || 0 };
}

let sizeCache = null;
async function loadSizeCache() {
  if (sizeCache) return sizeCache;
  try { sizeCache = JSON.parse((await AsyncStorage.getItem(SIZE_KEY)) || "{}"); } catch { sizeCache = {}; }
  return sizeCache;
}

// Returns Map(entry id -> bytes, or null when the size can't be read).
export async function scanDownloadSizes(list, onProgress) {
  const cache = await loadSizeCache();
  const result = new Map();
  const todo = [];
  list.forEach((d) => {
    if (!d.localUri) { result.set(d.id, null); return; }
    if (cache[d.localUri] > 0) result.set(d.id, cache[d.localUri]);
    else todo.push(d);
  });
  let done = 0;
  for (let i = 0; i < todo.length; i += 12) {
    const chunk = todo.slice(i, i + 12);
    await Promise.all(
      chunk.map(async (d) => {
        let size = null;
        try {
          const info = await LegacyFS.getInfoAsync(d.localUri, { size: true });
          size = info.exists ? info.size || 0 : 0;
        } catch { size = null; }
        if (size > 0) cache[d.localUri] = size;
        result.set(d.id, size);
      })
    );
    done += chunk.length;
    onProgress && onProgress(done, todo.length);
  }
  if (todo.length) AsyncStorage.setItem(SIZE_KEY, JSON.stringify(cache)).catch(() => {});
  return result;
}

async function dirSize(uri, depth) {
  let names = [];
  try { names = await LegacyFS.readDirectoryAsync(uri); } catch { return 0; }
  let total = 0;
  for (const n of names.slice(0, 500)) {
    const child = uri + (uri.endsWith("/") ? "" : "/") + n;
    try {
      const info = await LegacyFS.getInfoAsync(child, { size: true });
      if (!info.exists) continue;
      if (info.isDirectory) total += depth > 0 ? await dirSize(child, depth - 1) : 0;
      else total += info.size || 0;
    } catch {}
  }
  return total;
}
export const getCacheSize = () =>
  LegacyFS.cacheDirectory ? dirSize(LegacyFS.cacheDirectory, 3) : Promise.resolve(0);

export async function clearCache() {
  const dir = LegacyFS.cacheDirectory;
  if (!dir) return;
  let names = [];
  try { names = await LegacyFS.readDirectoryAsync(dir); } catch { return; }
  for (const n of names) {
    try { await LegacyFS.deleteAsync(dir + (dir.endsWith("/") ? "" : "/") + n, { idempotent: true }); } catch {}
  }
}

// "deleted" | "missing" | "failed"
export async function deleteFileSafe(uri) {
  if (!uri) return "missing";
  try {
    const before = await LegacyFS.getInfoAsync(uri);
    if (!before.exists) return "missing";
    await LegacyFS.deleteAsync(uri, { idempotent: true });
    const after = await LegacyFS.getInfoAsync(uri);
    return after.exists ? "failed" : "deleted";
  } catch {
    return "failed";
  }
}
