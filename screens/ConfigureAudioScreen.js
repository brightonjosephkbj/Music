import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  ScrollView,
} from 'react-native';

import ConfigSlider from '../components/ConfigSlider';
import {
  subscribe,
  getState,
  effective,
  setSetting,
  resetSetting,
} from '../data/audioSettings';

import {
  EQUALIZER_PRESETS,
  loadEqualizerSettings,
  saveEqualizerSettings,
  applyEqualizerPreset,
} from '../equalizerSettings';

const ACCENT = '#FF6B6B';
const WHITE = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.55)';

const BANDS = [
  { label: '60 Hz', name: 'Sub bass' },
  { label: '230 Hz', name: 'Bass' },
  { label: '910 Hz', name: 'Midrange' },
  { label: '3.6 kHz', name: 'Presence' },
  { label: '14 kHz', name: 'Brilliance' },
];

export default function ConfigureAudioScreen({ trackId, trackTitle, onBack }) {
  const [scope, setScope] = useState('global');
  const [, force] = useState(0);

  const [eq, setEq] = useState({
    enabled: true,
    levels: [0, 0, 0, 0, 0],
    bass: 0,
  });

  const eqRef = useRef(eq);

  useEffect(() => subscribe(() => force(n => n + 1)), []);

  useEffect(() => {
    let mounted = true;

    loadEqualizerSettings().then(settings => {
      if (mounted) {
        eqRef.current = settings;
        setEq(settings);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const updateEq = patch => {
    const next = { ...eqRef.current, ...patch };
    eqRef.current = next;
    setEq(next);

    saveEqualizerSettings(next).catch(error => {
      console.warn('Could not save equalizer settings:', error);
    });
  };

  const choosePreset = async name => {
    try {
      const settings = await applyEqualizerPreset(name);
      eqRef.current = settings;
      setEq(settings);
    } catch (error) {
      console.warn('Could not apply equalizer preset:', error);
    }
  };

  const s =
    scope === 'item' && trackId
      ? effective(trackId)
      : getState().global;

  const set = patch => setSetting(scope, trackId, patch);
  const reset = keys => resetSetting(scope, trackId, keys);

  const Row = ({ title, label, keys, children }) => (
    <View style={{ marginBottom: 18 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ color: WHITE, fontSize: 16, fontWeight: '600' }}>
          {title}{' '}
          <Text style={{ color: ACCENT, fontWeight: '500' }}>{label}</Text>
        </Text>

        <TouchableOpacity
          onPress={() => reset(keys)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={{ color: MUTED, fontSize: 20 }}>↺</Text>
        </TouchableOpacity>
      </View>

      {children}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#07060b', paddingTop: 48 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          marginBottom: 16,
        }}
      >
        <TouchableOpacity
          onPress={onBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={{ color: WHITE, fontSize: 24 }}>←</Text>
        </TouchableOpacity>

        <Text
          style={{
            color: WHITE,
            fontSize: 18,
            fontWeight: '700',
            marginLeft: 16,
          }}
        >
          Audio settings
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 50 }}>
        <Text style={{ color: WHITE, fontSize: 20, fontWeight: '700', marginBottom: 4 }}>
          Equalizer
        </Text>
        <Text style={{ color: MUTED, fontSize: 12, marginBottom: 18 }}>
          Shape the sound to match your taste
        </Text>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
            padding: 14,
            borderRadius: 14,
            backgroundColor: 'rgba(255,255,255,0.06)',
          }}
        >
          <View>
            <Text style={{ color: WHITE, fontSize: 15, fontWeight: '600' }}>
              Equalizer
            </Text>
            <Text style={{ color: MUTED, fontSize: 12 }}>
              {eq.enabled ? 'Sound effects enabled' : 'Sound effects disabled'}
            </Text>
          </View>

          <Switch
            value={eq.enabled}
            onValueChange={enabled => updateEq({ enabled })}
            trackColor={{ false: '#444', true: ACCENT }}
            thumbColor={WHITE}
          />
        </View>

        <Text style={{ color: WHITE, fontWeight: '600', marginBottom: 12 }}>
          Presets
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 22 }}>
          {Object.keys(EQUALIZER_PRESETS).map(name => {
            const selected =
              eq.levels.every((v, i) => v === EQUALIZER_PRESETS[name].levels[i]) &&
              eq.bass === EQUALIZER_PRESETS[name].bass;

            return (
              <TouchableOpacity
                key={name}
                onPress={() => choosePreset(name)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: 20,
                  marginRight: 8,
                  marginBottom: 8,
                  backgroundColor: selected
                    ? 'rgba(255,107,107,0.2)'
                    : 'rgba(255,255,255,0.07)',
                  borderWidth: 1,
                  borderColor: selected ? ACCENT : 'transparent',
                }}
              >
                <Text style={{ color: WHITE, fontSize: 12, fontWeight: '600' }}>
                  {name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View
          style={{
            opacity: eq.enabled ? 1 : 0.4,
          }}
          pointerEvents={eq.enabled ? 'auto' : 'none'}
        >
          <Text style={{ color: WHITE, fontWeight: '600', marginBottom: 4 }}>
            Frequency bands
          </Text>
          <Text style={{ color: MUTED, fontSize: 11, marginBottom: 12 }}>
            Adjust each frequency from -12 dB to +12 dB
          </Text>

          {BANDS.map((band, index) => (
            <View key={band.label} style={{ marginBottom: 16 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View>
                  <Text style={{ color: WHITE, fontSize: 14, fontWeight: '600' }}>
                    {band.label}
                  </Text>
                  <Text style={{ color: MUTED, fontSize: 11 }}>
                    {band.name}
                  </Text>
                </View>

                <Text style={{ color: ACCENT, fontSize: 13, fontWeight: '600' }}>
                  {(eq.levels[index] / 100).toFixed(1)} dB
                </Text>
              </View>

              <ConfigSlider
                value={eq.levels[index] / 100}
                min={-12}
                max={12}
                step={0.1}
                color={ACCENT}
                onChange={value => {
                  const levels = [...eqRef.current.levels];
                  levels[index] = Math.round(value * 100);
                  updateEq({ levels });
                }}
              />
            </View>
          ))}

          <View style={{ marginTop: 8, marginBottom: 24 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ color: WHITE, fontSize: 15, fontWeight: '600' }}>
                Bass boost
              </Text>
              <Text style={{ color: ACCENT, fontWeight: '600' }}>
                {Math.round(eq.bass / 10)}%
              </Text>
            </View>

            <ConfigSlider
              value={eq.bass / 10}
              min={0}
              max={100}
              step={1}
              color={ACCENT}
              onChange={value => updateEq({ bass: Math.round(value * 10) })}
            />
          </View>
        </View>

        <View
          style={{
            height: 1,
            backgroundColor: 'rgba(255,255,255,0.1)',
            marginBottom: 22,
          }}
        />

        <Text style={{ color: WHITE, fontSize: 20, fontWeight: '700', marginBottom: 4 }}>
          Playback
        </Text>
        <Text style={{ color: MUTED, fontSize: 12, marginBottom: 18 }}>
          Configure playback behaviour
        </Text>

        <View
          style={{
            flexDirection: 'row',
            marginBottom: 20,
            borderRadius: 14,
            backgroundColor: 'rgba(255,255,255,0.06)',
          }}
        >
          {['global', 'item'].map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setScope(t)}
              style={{
                flex: 1,
                paddingVertical: 12,
                alignItems: 'center',
                borderRadius: 14,
                backgroundColor:
                  scope === t ? 'rgba(255,107,107,0.2)' : 'transparent',
              }}
            >
              <Text style={{ color: WHITE, fontWeight: '700' }}>
                {t === 'global' ? 'Global' : 'This song'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {scope === 'item' && !trackId ? (
          <Text style={{ color: MUTED }}>
            Play a song first to set song-only settings.
          </Text>
        ) : (
          <>
            {scope === 'item' && !!trackTitle && (
              <Text style={{ color: MUTED, marginBottom: 16 }} numberOfLines={1}>
                {trackTitle}
              </Text>
            )}

            <Row title="Speed" label={s.speed.toFixed(2) + 'x'} keys={['speed']}>
              <ConfigSlider
                value={s.speed}
                min={0.5}
                max={2}
                step={0.05}
                color={ACCENT}
                onChange={v => set({ speed: v })}
              />
            </Row>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 18,
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ color: WHITE, fontSize: 16, fontWeight: '600' }}>
                  Keep pitch
                </Text>
                <Text style={{ color: MUTED, fontSize: 12 }}>
                  Off = pitch rises and falls with speed
                </Text>
              </View>

              <Switch
                value={s.preservesPitch}
                onValueChange={v => set({ preservesPitch: v })}
                trackColor={{ true: ACCENT }}
              />
            </View>

            <Row title="Volume" label={Math.round(s.volume * 100) + '%'} keys={['volume']}>
              <ConfigSlider
                value={s.volume}
                min={0}
                max={1}
                step={0.01}
                color={ACCENT}
                onChange={v => set({ volume: v })}
              />
            </Row>
          </>
        )}
      </ScrollView>
    </View>
  );
}
