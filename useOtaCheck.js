import { useEffect, useRef } from "react";
import { AppState, Alert } from "react-native";
import * as Updates from "expo-updates";

const MIN_GAP_MS = 5 * 60 * 1000; // don't hit the server more than once per 5 min

// Gives up after `ms` so a dead connection can't hang the check
const withTimeout = (p, ms) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

// The ID of the update this phone is running right now (null on the embedded build)
export function currentUpdateId() {
  return Updates.updateId || "embedded";
}

// Checks on launch and every time the app returns to the foreground.
// If the server's update ID differs from the one running, it downloads it
// and offers a restart.
export default function useOtaCheck() {
  const busy = useRef(false);
  const lastCheck = useRef(0);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;

    const check = async () => {
      if (busy.current || Date.now() - lastCheck.current < MIN_GAP_MS) return;
      busy.current = true;
      lastCheck.current = Date.now();
      try {
        const res = await withTimeout(Updates.checkForUpdateAsync(), 15000);
        if (res.isAvailable) {
          await withTimeout(Updates.fetchUpdateAsync(), 60000);
          Alert.alert("Update ready", "A new version has been downloaded.", [
            { text: "Later", style: "cancel" },
            { text: "Restart now", onPress: () => Updates.reloadAsync() },
          ]);
        }
      } catch (e) {
        // offline or server asleep: stay quiet, try again next time
      } finally {
        busy.current = false;
      }
    };

    check();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") check();
    });
    return () => sub.remove();
  }, []);
}
