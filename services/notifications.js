import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

// Controls how a notification behaves while the app is open in foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Single entry point covering both use cases:
//  - Android: grants POST_NOTIFICATIONS, which is what actually lets the
//    lock-screen playback notification (expo-audio foreground service)
//    show on Android 13+, same permission as push.
//  - iOS: authorizes alert/sound/badge for push specifically - lock-screen
//    audio controls there are separate and already covered by
//    UIBackgroundModes: audio, so nothing extra needed on iOS for that part.
//
// Returns the Expo push token, or null if permission was denied or no
// EAS project id is configured yet (run `npx eas init` once to add it -
// permission still gets requested/granted either way, just no token yet).
export async function registerForPushNotificationsAsync() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "B24music",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  if (!Device.isDevice) {
    return null; // simulators/emulators can't receive push anyway
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") {
    return null; // user declined - degrade quietly, don't nag
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.log("[notifications] permission granted, but no EAS project id yet - run `npx eas init`");
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    return token;
  } catch (err) {
    console.warn("[notifications] failed to get push token:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Download progress notifications.
//
// Real scope check: expo-notifications has no native progress-bar API (no
// Notification.Builder#setProgress equivalent exposed anywhere in the
// installed package), so progress shows as a percentage in the body text
// instead of a visual bar. Action buttons (categoryIdentifier) are also
// unreliable on Android in expo-notifications - several open expo/expo
// GitHub issues report buttons not appearing or not firing - so this skips
// a separate "Play" button and just makes the whole notification tappable.
//
// One notification per download key, identified by `download-${key}`, so
// repeated progress updates replace it in place instead of stacking a new
// tray entry every time.
// ---------------------------------------------------------------------------

const DOWNLOAD_CHANNEL_ID = "downloads";
let downloadChannelReady = false;

async function ensureDownloadChannelAsync() {
  if (Platform.OS !== "android" || downloadChannelReady) return;
  await Notifications.setNotificationChannelAsync(DOWNLOAD_CHANNEL_ID, {
    name: "Downloads",
    // LOW = shows in the tray with no sound/heads-up popup - progress
    // updates happen often enough that DEFAULT importance would be spammy.
    importance: Notifications.AndroidImportance.LOW,
  });
  downloadChannelReady = true;
}

function downloadNotificationId(key) {
  return `download-${key}`;
}

export async function notifyDownloadProgress(key, { title, progress }) {
  await ensureDownloadChannelAsync();
  const pct = Math.round((progress || 0) * 100);
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: downloadNotificationId(key),
      content: {
        title: title || "Downloading...",
        body: `${pct}% complete`,
        sticky: true, // can't be swiped away mid-download
        autoDismiss: false,
        data: { type: "download-progress", downloadKey: key },
      },
      trigger: { channelId: DOWNLOAD_CHANNEL_ID },
    });
  } catch (err) {
    console.warn("[notifications] failed to update download progress notification:", err);
  }
}

export async function notifyDownloadComplete(key, { title }) {
  await ensureDownloadChannelAsync();
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: downloadNotificationId(key),
      content: {
        title: title || "Download complete",
        body: "Tap to open",
        sticky: false,
        autoDismiss: true,
        data: { type: "download-complete", downloadKey: key },
      },
      trigger: { channelId: DOWNLOAD_CHANNEL_ID },
    });
  } catch (err) {
    console.warn("[notifications] failed to post download-complete notification:", err);
  }
}

// Cancelled downloads shouldn't leave a stray "complete" notification behind,
// but shouldn't announce the cancellation either - just remove it quietly.
export async function clearDownloadNotification(key) {
  try {
    await Notifications.dismissNotificationAsync(downloadNotificationId(key));
  } catch (err) {
    // already dismissed or never shown - not worth surfacing
  }
}

// Register this once, near the top of App.js/AppShell.js, to handle taps on
// download notifications (both the in-progress and complete ones). Filters
// by `data.type` so it won't fight with whatever ends up handling the
// "friend sent you a song" push later.
export function addDownloadNotificationResponseListener(onPress) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (data?.type === "download-progress" || data?.type === "download-complete") {
      onPress(data.downloadKey);
    }
  });
}

// Handles the cold-start case: app was fully closed and the user tapped a
// download notification to relaunch it. addNotificationResponseReceivedListener
// alone can miss this on some Android versions since it isn't attached yet
// by the time the tap actually happens.
export async function getLastDownloadNotificationKeyAsync() {
  const response = await Notifications.getLastNotificationResponseAsync();
  const data = response?.notification?.request?.content?.data;
  if (data?.type === "download-progress" || data?.type === "download-complete") {
    return data.downloadKey;
  }
  return null;
}

// Handles the "friend sent you a song" push, the same warm/cold-start
// pattern as the download notifications above.
export function addShareNotificationResponseListener(onPress) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (data?.type === "share_received") {
      onPress(data.from_user);
    }
  });
}

export async function getLastShareFromUserIdAsync() {
  const response = await Notifications.getLastNotificationResponseAsync();
  const data = response?.notification?.request?.content?.data;
  if (data?.type === "share_received") {
    return data.from_user;
  }
  return null;
}
