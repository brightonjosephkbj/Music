import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

// Calls `onResume` when the app returns to the foreground after
// being away longer than `minAwayMs` (default 60s).
export default function useAppResume(onResume, minAwayMs = 60000) {
  const lastActive = useRef(Date.now());
  const cb = useRef(onResume);
  cb.current = onResume; // always call the latest version of the callback

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        lastActive.current = Date.now();
      } else if (state === 'active') {
        const away = Date.now() - lastActive.current;
        if (away > minAwayMs) cb.current();
      }
    });
    return () => sub.remove(); // prevents stacking listeners
  }, [minAwayMs]);
}
