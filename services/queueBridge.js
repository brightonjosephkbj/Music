let actions = {
  playNext: () => {},
  addToQueue: () => {},
  removeAt: () => {},
  clear: () => {},
};

export function registerQueueActions(next) {
  actions = { ...actions, ...next };
}

export function playNext(track) {
  actions.playNext(track);
}
export function addToQueue(track) {
  actions.addToQueue(track);
}
export function removeFromQueue(index) {
  actions.removeAt(index);
}
export function clearQueue() {
  actions.clear();
}
