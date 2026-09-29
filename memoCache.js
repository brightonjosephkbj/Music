// In-memory cache that survives screen remounts (module scope), so rows can
// paint instantly with the last data and refresh quietly afterwards.
const store = new Map();
export const memoGet = (k) => store.get(k);
export const memoSet = (k, v) => {
  store.set(k, v);
  return v;
};
