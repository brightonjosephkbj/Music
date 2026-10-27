// A fetch that gives up after `ms` milliseconds instead of hanging forever.
// AbortController cancels the request; the caller gets an error it can handle.
export async function fetchWithTimeout(url, options = {}, ms = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer); // always clean up the timer
  }
}
