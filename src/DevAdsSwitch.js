import React, { useEffect, useState } from 'react';
import { Pressable, Modal, View, Text, TextInput, Switch } from 'react-native';
import { DEV_CODE, setAdsOff, useAdsEnabled } from './adsConfig';

let opener = null;
// Call this from a long-press (delayLongPress={3000}) on any element.
export const openDevAds = () => { if (opener) opener(); };

// Mount once at the app root.
export default function DevAdsHost() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const enabled = useAdsEnabled();

  useEffect(() => {
    opener = () => { setCode(''); setUnlocked(false); setOpen(true); };
    return () => { opener = null; };
  }, []);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, backgroundColor: '#000a', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: '#1c1c1e', borderRadius: 16, padding: 20 }}>
          {!unlocked ? (
            <>
              <Text style={{ color: '#fff', fontSize: 16, marginBottom: 12 }}>Developer code</Text>
              <TextInput
                value={code}
                onChangeText={setCode}
                secureTextEntry
                autoCapitalize="none"
                style={{ backgroundColor: '#2c2c2e', color: '#fff', borderRadius: 10, padding: 10 }}
              />
              <Pressable onPress={() => (code === DEV_CODE ? setUnlocked(true) : setOpen(false))} style={{ marginTop: 14 }}>
                <Text style={{ color: '#0a84ff', textAlign: 'right' }}>OK</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 16 }}>Show ads</Text>
                <Switch value={enabled} onValueChange={(v) => setAdsOff(!v)} />
              </View>
              <Pressable onPress={() => setOpen(false)} style={{ marginTop: 14 }}>
                <Text style={{ color: '#0a84ff', textAlign: 'right' }}>Close</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
