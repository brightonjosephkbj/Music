import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useAdsEnabled } from './adsConfig';
import { initAds, getStartIo } from './ads';

export default function AdSlot({ placement, children }) {
  const enabled = useAdsEnabled();
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { initAds(); }, []);
  if (!enabled) return null;
  const sdk = children ? null : getStartIo();
  const Banner = sdk && sdk.StartIoBannerAd;
  return (
    <View style={{ marginVertical: 12, marginHorizontal: 16, minHeight: 60, justifyContent: 'center', alignItems: 'center', borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      {children || (
        <>
          {!loaded && <Text style={{ position: 'absolute', color: '#aaa', fontSize: 12 }}>Sponsored</Text>}
          {Banner && (
            <Banner
              adTag={placement}
              onReceiveAd={() => setLoaded(true)}
              style={{ width: 320, height: 50 }}
            />
          )}
        </>
      )}
    </View>
  );
}
