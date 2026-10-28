import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as IntentLauncher from 'expo-intent-launcher';
import { File, Paths } from 'expo-file-system';

const REPO = 'brightonjosephkbj/Music';

export async function checkForUpdate() {
  if (Platform.OS !== 'android') return null;
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
  if (!res.ok) return null;
  const rel = await res.json();
  const latest = parseInt(String(rel.tag_name).replace(/\D/g, ''), 10);
  const current = parseInt(Application.nativeBuildVersion, 10);
  const asset = (rel.assets || []).find((a) => a.name.endsWith('.apk'));
  if (!asset || !latest || latest <= current) return null;
  return { versionCode: latest, name: rel.name, notes: rel.body, url: asset.browser_download_url };
}

export async function downloadAndInstall(url) {
  const old = new File(Paths.cache, 'update.apk');
  if (old.exists) old.delete();
  const file = await File.downloadFileAsync(url, new File(Paths.cache, 'update.apk'));
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: file.contentUri,
    flags: 1,
    type: 'application/vnd.android.package-archive',
  });
}
