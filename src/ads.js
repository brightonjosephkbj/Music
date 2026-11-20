import { Platform } from 'react-native';

export const START_IO_APP_ID = '210265100';
export const START_IO_TEST_MODE = true; // set to false when ready for live ads

let sdk;
// Returns the Start.io module, or null if this build has no native ad code.
export function getStartIo() {
  if (sdk !== undefined) return sdk;
  try {
    sdk = Platform.OS === 'android' ? require('react-native-start-io-sdk') : null;
  } catch (e) {
    sdk = null;
  }
  return sdk;
}

let started = false;
export function initAds() {
  if (started) return;
  const s = getStartIo();
  if (!s) return;
  try {
    s.initializeStartIoSdk({
      androidAppId: START_IO_APP_ID,
      iOSAppId: START_IO_APP_ID,
      testAd: START_IO_TEST_MODE,
      returnAd: false,
    });
    started = true;
  } catch (e) {}
}
