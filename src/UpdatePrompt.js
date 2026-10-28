import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { checkForUpdate, downloadAndInstall } from './updater';

export default function UpdatePrompt() {
  const [update, setUpdate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    checkForUpdate()
      .then((u) => { if (alive && u) setUpdate(u); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!update) return null;

  const onInstall = async () => {
    setBusy(true);
    setError('');
    try {
      await downloadAndInstall(update.url);
    } catch (e) {
      setError('Download failed. Check your connection and try again.');
    }
    setBusy(false);
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => setUpdate(null)}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <Text style={s.title}>Update available</Text>
          <Text style={s.sub}>{update.name}</Text>
          {error ? <Text style={s.err}>{error}</Text> : null}
          {busy ? (
            <ActivityIndicator style={{ marginTop: 16 }} color="#fff" />
          ) : (
            <View style={s.row}>
              <TouchableOpacity style={s.later} onPress={() => setUpdate(null)}>
                <Text style={s.laterTxt}>Later</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.go} onPress={onInstall}>
                <Text style={s.goTxt}>Update</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#16161D', borderRadius: 16, padding: 20 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  sub: { color: '#aaa', marginTop: 6 },
  err: { color: '#ff6b6b', marginTop: 10 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 },
  later: { padding: 12, marginRight: 8 },
  laterTxt: { color: '#aaa' },
  go: { backgroundColor: '#7C5CFF', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  goTxt: { color: '#fff', fontWeight: '700' },
});
