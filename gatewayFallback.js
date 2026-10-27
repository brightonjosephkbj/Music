import { friendlyError } from "./friendlyError";

const PRIMARY = "https://gateway-b0tx.onrender.com";
const FALLBACK = "https://nrighton233j-api-cache.hf.space/gw";
const _fetch = global.fetch;
let useFallbackUntil = 0;

function fail(e) {
  if (e && e.name === "AbortError") throw e;
  console.warn("[net]", e && e.message);
  const err = new Error(friendlyError(e));
  err.isFriendly = true;
  err.original = e;
  throw err;
}

global.fetch = async (input, init) => {
  try {
    if (typeof input === "string" && input.startsWith(PRIMARY)) {
      const alt = FALLBACK + input.slice(PRIMARY.length);
      if (Date.now() < useFallbackUntil) return await _fetch(alt, init);
      try {
        return await _fetch(input, init);
      } catch (e) {
        if (e && e.name === "AbortError") throw e;
        useFallbackUntil = Date.now() + 5 * 60 * 1000;
        return await _fetch(alt, init);
      }
    }
    return await _fetch(input, init);
  } catch (e) {
    fail(e);
  }
};
