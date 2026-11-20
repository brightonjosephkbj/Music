// Lets a screen ask the mini player to sit as a disc in the top-right corner.
let top = false;
const subs = new Set();
export function setDiscTop(v) {
  if (top === v) return;
  top = v;
  subs.forEach((f) => f(v));
}
export function subscribeDiscTop(fn) {
  subs.add(fn);
  fn(top);
  return () => subs.delete(fn);
}
