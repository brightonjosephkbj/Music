import React, { useRef, useState } from 'react';
import { View, PanResponder } from 'react-native';

export default function ConfigSlider({ value, min, max, step = 0.05, onChange, color = '#b57bff' }) {
  const [w, setW] = useState(1);
  const wRef = useRef(1);
  const startVal = useRef(value);
  const propsRef = useRef({});
  propsRef.current = { value, min, max, step, onChange };

  const clamp = (v) => {
    const { min, max, step } = propsRef.current;
    const snapped = Math.round(v / step) * step;
    return Math.max(min, Math.min(max, +snapped.toFixed(4)));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const { min, max, onChange } = propsRef.current;
        const v = clamp(min + (e.nativeEvent.locationX / wRef.current) * (max - min));
        startVal.current = v;
        onChange(v);
      },
      onPanResponderMove: (_, g) => {
        const { min, max, onChange } = propsRef.current;
        onChange(clamp(startVal.current + (g.dx / wRef.current) * (max - min)));
      },
    })
  ).current;

  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));

  return (
    <View
      style={{ height: 40, justifyContent: 'center' }}
      onLayout={(e) => { wRef.current = e.nativeEvent.layout.width; setW(e.nativeEvent.layout.width); }}
      {...pan.panHandlers}
    >
      <View pointerEvents="none" style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)' }}>
        <View style={{ width: pct * w, height: 6, borderRadius: 3, backgroundColor: color }} />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', left: Math.max(0, pct * w - 9), width: 18, height: 18,
          borderRadius: 9, backgroundColor: '#fff', borderWidth: 3, borderColor: color,
        }}
      />
    </View>
  );
}
