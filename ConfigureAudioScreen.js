import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Switch, ScrollView } from 'react-native';
import ConfigSlider from './ConfigSlider';
import { subscribe, getState, effective, setSetting, resetSetting } from './audioSettings';

const ORCHID = '#b57bff';

export default function ConfigureAudioScreen({ trackId, trackTitle, onBack }) {
  const [scope, setScope] = useState('global');
  const [, force] = useState(0);
  useEffect(() => subscribe(() => force((n) => n + 1)), []);

  const s = scope === 'item' && trackId ? effective(trackId) : getState().global;
  const set = (patch) => setSetting(scope, trackId, patch);
  const reset = (keys) => resetSetting(scope, trackId, keys);

  const Row = ({ title, label, keys, children }) => (
    <View style={{ marginBottom: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
          {title}  <Text style={{ color: ORCHID, fontWeight: '500' }}>{label}</Text>
        </Text>
        <TouchableOpacity onPress={() => reset(keys)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 20 }}>↺</Text>
        </TouchableOpacity>
      </View>
      {children}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#07060b', paddingTop: 48 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 }}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ color: '#fff', fontSize: 24 }}>←</Text>
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginLeft: 16 }}>Configure</Text>
      </View>

      <View style={{ flexDirection: 'row', marginHorizontal: 20, marginBottom: 20, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)' }}>
        {['global', 'item'].map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setScope(t)}
            style={{
              flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 14,
              backgroundColor: scope === t ? 'rgba(181,123,255,0.25)' : 'transparent',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>{t === 'global' ? 'Global' : 'This song'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {scope === 'item' && !trackId ? (
        <Text style={{ color: 'rgba(255,255,255,0.6)', paddingHorizontal: 20 }}>Play a song first to set song-only settings.</Text>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          {scope === 'item' && !!trackTitle && (
            <Text style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 16 }} numberOfLines={1}>{trackTitle}</Text>
          )}

          <Row title="Speed" label={s.speed.toFixed(2) + 'x'} keys={['speed']}>
            <ConfigSlider value={s.speed} min={0.5} max={2} step={0.05} onChange={(v) => set({ speed: v })} />
          </Row>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Keep pitch</Text>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                Off = pitch rises and falls with speed
              </Text>
            </View>
            <Switch value={s.preservesPitch} onValueChange={(v) => set({ preservesPitch: v })} trackColor={{ true: ORCHID }} />
          </View>

          <Row title="Volume" label={Math.round(s.volume * 100) + '%'} keys={['volume']}>
            <ConfigSlider value={s.volume} min={0} max={1} step={0.01} onChange={(v) => set({ volume: v })} />
          </Row>
        </ScrollView>
      )}
    </View>
  );
}
