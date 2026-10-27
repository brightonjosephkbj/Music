import AsyncStorage from "@react-native-async-storage/async-storage";

const MSG = {
  offline: "No internet connection. Check your network and try again.",
  timeout: "The connection timed out. Please try again.",
  auth: "Please sign in again.",
  rate: "Too many requests. Please wait a moment and try again.",
  missing: "We couldn't find that.",
  busy: "Our server is busy right now. Please try again in a moment.",
  generic: "Something went wrong. Please try again.",
};
const KNOWN = new Set(Object.values(MSG));
const TECH = /exception|java\.|javax\.|undefined|\bnull\b|typeerror|referenceerror|syntaxerror|json parse|unexpected token|stack|\bat \w|node_modules|[{}]|<html|<!doctype|errno|econn|ssl|certificate/i;

// Hidden developer switch: show raw errors instead of friendly ones.
const KEY = "b24_raw_errors";
let RAW = false;
AsyncStorage.getItem(KEY).then((v) => { RAW = v === "1"; }).catch(() => {});
export const isRawErrors = () => RAW;
export function toggleRawErrors() {
  RAW = !RAW;
  AsyncStorage.setItem(KEY, RAW ? "1" : "0").catch(() => {});
  return RAW;
}

export function friendlyError(e, fallback) {
  if (RAW) {
    const o = e && e.original ? e.original : e;
    return String((o && o.message) || o || fallback || "Unknown error");
  }
  if (e && e.isFriendly) return e.message;
  const raw = String((e && e.message) || e || "").trim();
  if (KNOWN.has(raw)) return raw;
  const m = raw.toLowerCase();
  if (/unable to resolve host|unknownhost|network request failed|enotfound|econnrefused|failed to connect|socketexception|no address associated|network error|fetch failed|offline|connection abort/.test(m)) return MSG.offline;
  if (/timed out|timeout/.test(m)) return MSG.timeout;
  const code = (m.match(/(?:status|responded|http|code|error)[^\d]{0,4}([1-5]\d\d)\b/) || [])[1];
  if (code === "401" || code === "403" || /unauthor|forbidden/.test(m)) return MSG.auth;
  if (code === "429" || /too many requests/.test(m)) return MSG.rate;
  if (code === "404") return MSG.missing;
  if ((code && code[0] === "5") || /bad gateway|service unavailable|gateway time/.test(m)) return MSG.busy;
  if (/server responded/.test(m)) return fallback || MSG.generic;
  if (raw && raw.length <= 140 && !TECH.test(raw)) return raw;
  return fallback || MSG.generic;
}
