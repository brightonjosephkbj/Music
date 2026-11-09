// Run the request and consume its response before the deadline. Keeping the
// timer active through `consumeResponse` also bounds stalled response bodies.
// AbortController cancels the request; the caller gets an error it can handle.
export async function fetchWithTimeout(
  url,
  options = {},
  ms = 10000,
  consumeResponse = (response) => response
) {
  const controller = new AbortController();
  const { signal: callerSignal, ...fetchOptions } = options;
  const abortFromCaller = () => controller.abort();
  if (callerSignal?.aborted) controller.abort();
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
    return await consumeResponse(response);
  } finally {
    clearTimeout(timer); // always clean up the timer
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}
