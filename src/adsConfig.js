import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'dev_ads_off';
let adsOff = false;
const subs = new Set();

// Pick your own code. Don't reuse any server key.
export const DEV_CODE = 'joy';

export const areAdsOff = () => adsOff; // for non-component code (interstitials, rewarded)

export async function loadAdsFlag() {
  try { adsOff = (await AsyncStorage.getItem(KEY)) === '1'; } catch (e) {}
  subs.forEach((f) => f(adsOff));
}

export async function setAdsOff(v) {
  adsOff = !!v;
  subs.forEach((f) => f(adsOff));
  try { await AsyncStorage.setItem(KEY, adsOff ? '1' : '0'); } catch (e) {}
}

export function useAdsEnabled() {
  const [off, setOff] = useState(adsOff);
  useEffect(() => {
    subs.add(setOff);
    setOff(adsOff);
    return () => { subs.delete(setOff); };
  }, []);
  return !off;
}

loadAdsFlag();
