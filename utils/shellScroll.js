const subs = new Set();
export function reportScrollY(y) {
  subs.forEach((fn) => {
    try { fn(y); } catch (e) {}
  });
}
export function subscribeScrollY(fn) {
  subs.add(fn);
  return () => { subs.delete(fn); };
}
