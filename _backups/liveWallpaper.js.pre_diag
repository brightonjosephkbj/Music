import { Linking, Platform } from "react-native";

// expo-file-system moved its classic API to /legacy in newer SDKs; try both.
let FS = null;
try { FS = require("expo-file-system/legacy"); } catch (e) {}
if (!FS || !FS.copyAsync) {
  try { FS = require("expo-file-system"); } catch (e) {}
}

// The native service plays this exact file from the app's files dir.
export const WALLPAPER_FILE = "wallpaper.mp4";

export async function prepareWallpaperVideo(sourceUri) {
  if (!FS || !FS.copyAsync || !FS.documentDirectory) {
    throw new Error("File access is not available in this build");
  }
  const dest = FS.documentDirectory + WALLPAPER_FILE;
  try { await FS.deleteAsync(dest, { idempotent: true }); } catch (e) {}
  await FS.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

// Opens Android's live wallpaper list; the user picks "Obsidian" and taps Apply.
export async function openLiveWallpaperPicker() {
  if (Platform.OS !== "android") return false;
  try {
    await Linking.sendIntent("android.service.wallpaper.LIVE_WALLPAPER_CHOOSER");
    return true;
  } catch (e) {
    try { await Linking.openSettings(); } catch (e2) {}
    return false;
  }
}
