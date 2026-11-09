// True when the login token has an "exp" time that has already passed.
// Tokens with no exp, or anything we cannot read, count as NOT expired.
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function tokenExpired(token, skewMs = 60000) {
  try {
    const part = String(token || "").split(".")[1];
    if (!part) return false;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    let acc = 0;
    let bits = 0;
    let out = "";
    for (const c of b64) {
      if (c === "=") break;
      const v = CHARS.indexOf(c);
      if (v < 0) return false;
      acc = (acc << 6) | v;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        out += String.fromCharCode((acc >> bits) & 255);
      }
    }
    const exp = JSON.parse(out).exp;
    return typeof exp === "number" && exp * 1000 < Date.now() + skewMs;
  } catch {
    return false;
  }
}
