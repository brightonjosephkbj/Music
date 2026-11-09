import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Linking, ScrollView } from 'react-native';

// Turns .lrc or plain text into { lyrics: [{time, text}], hasSynced }
export function parseLyricsText(raw) {
  const rows = [];
  let synced = false;
  String(raw || '').replace(/\r/g, '').split('\n').forEach((ln) => {
    const stamps = [...ln.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    const text = ln.replace(/\[[^\]]*\]/g, '').replace(/<[^>]*>/g, '').trim();
    if (stamps.length) {
      synced = true;
      stamps.forEach((m) => rows.push({ time: Number(m[1]) * 60 + Number(m[2]), text }));
    } else if (!/^\[\w+:.*\]$/.test(ln.trim())) {
      rows.push({ time: rows.length, text: ln.trim() });
    }
  });
  if (synced) rows.sort((a, b) => a.time - b.time);
  return { lyrics: rows, hasSynced: synced };
}

export default function LyricsFallback({ colors: C, artist, title, onSearch, onImport, loading }) {
  const [a, setA] = useState(artist || '');
  const [t, setT] = useState(title || '');
  const [err, setErr] = useState('');

  const openGoogle = () => {
    const q = encodeURIComponent(`${t} ${a} lyrics`.trim());
    Linking.openURL(`https://www.google.com/search?q=${q}`).catch(() => setErr('Could not open browser.'));
  };

  const pickFile = async () => {
    setErr('');
    let Picker;
    try { Picker = require('expo-document-picker'); }
    catch (e) { setErr('Update the app to use file import.'); return; }
    try {
      const res = await Picker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (res.canceled) return;
      const file = res.assets && res.assets[0];
      if (!file) return;
      const text = (await (await fetch(file.uri)).text()).trim();
      const parsed = parseLyricsText(text);
      if (!parsed.lyrics.length) { setErr('That file is empty.'); return; }
      onImport && onImport(parsed);
    } catch (e) { setErr('Could not read that file.'); }
  };

  const label = { color: C.ink, fontSize: 16, fontWeight: '700', marginTop: 10, marginBottom: 6 };
  const input = { borderWidth: 1, borderColor: C.line, borderRadius: 10, color: C.ink,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, backgroundColor: C.chip };
  const btn = { backgroundColor: C.chip, borderWidth: 1, borderColor: C.line, borderRadius: 30,
    paddingVertical: 14, alignItems: 'center', marginTop: 12 };
  const btnTxt = { color: C.ink, fontSize: 15, fontWeight: '700' };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
      <Text style={{ color: C.muted, textAlign: 'center', marginVertical: 14 }}>
        No lyrics found. Fix the title/artist or import a file.
      </Text>
      <Text style={label}>Title</Text>
      <TextInput style={input} value={t} onChangeText={setT} placeholderTextColor={C.muted} />
      <Text style={label}>Artist</Text>
      <TextInput style={input} value={a} onChangeText={setA} placeholderTextColor={C.muted} />

      <TouchableOpacity style={[btn, { backgroundColor: C.ink, borderColor: C.ink }]} disabled={loading}
        onPress={() => onSearch && onSearch(a.trim(), t.trim())}>
        {loading ? <ActivityIndicator color={C.bg} /> : <Text style={[btnTxt, { color: C.bg }]}>Search again</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={btn} onPress={openGoogle}>
        <Text style={btnTxt}>Search lyrics with Google</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[btn, { backgroundColor: C.accent, borderColor: C.accent }]} onPress={pickFile}>
        <Text style={[btnTxt, { color: '#fff' }]}>Import local lyrics file</Text>
      </TouchableOpacity>
      {!!err && <Text style={{ color: C.accentText, textAlign: 'center', marginTop: 10 }}>{err}</Text>}
    </ScrollView>
  );
}
