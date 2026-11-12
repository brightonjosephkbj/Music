import * as FileSystem from "expo-file-system/legacy";

// Biggest file we convert on the phone. Anything larger is kept as it is
// (expo-video plays webm fine), so long videos never get stuck converting.
const MAX_CONVERT_BYTES = 50 * 1024 * 1024;

// Old APKs have no native module: loading it must never crash the app.
let native = null;
try {
  native = require("../modules/b24-media");
} catch (e) {
  native = null;
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Looks at the first bytes of the file to see what it really is.
async function sniff(uri) {
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
    position: 0,
    length: 12,
  });
  const b = b64ToBytes(b64);
  const tag = String.fromCharCode(b[4], b[5], b[6], b[7]);
  if (tag === "ftyp") return "mp4";
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "webm";
  return "other";
}

// Call right after a download finishes. Converts non-mp4 videos to mp4 in
// place (same file name). Never throws: on any problem the original file stays.
export async function finalizeDownload(localUri, mode) {
  try {
    if (mode !== "video" || !native || !native.videoToMp4) return localUri;

    const info = await FileSystem.getInfoAsync(localUri);
    if (!info.exists || !info.size || info.size > MAX_CONVERT_BYTES) return localUri;

    const kind = await sniff(localUri);
    if (kind !== "webm") return localUri; // already mp4 (or unknown): leave it

    const tmp = localUri + ".conv.mp4";
    await FileSystem.deleteAsync(tmp, { idempotent: true });
    await native.videoToMp4(localUri, tmp);

    const out = await FileSystem.getInfoAsync(tmp);
    if (out.exists && out.size > 0) {
      await FileSystem.deleteAsync(localUri, { idempotent: true });
      await FileSystem.moveAsync({ from: tmp, to: localUri });
    } else {
      await FileSystem.deleteAsync(tmp, { idempotent: true });
    }
  } catch (e) {
    console.log("finalizeDownload failed, keeping original:", e && e.message);
  }
  return localUri;
}
