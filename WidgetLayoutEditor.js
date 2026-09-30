import React, { useRef, useState } from "react";
import { View, Text, TouchableOpacity, PanResponder, Dimensions, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PRESETS, TYPES, TYPE_ORDER, defaultItem, getLayout, textSizeDp } from "./widgetLayouts";

const ORCHID = "#C89BFF";
const INK = "#0B0A0F";
const SNAP = 2; // dp
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const snapFrac = (frac, totalDp) => (Math.round((frac * totalDp) / SNAP) * SNAP) / totalDp;
const hexToRgba = (hex, a) => {
  const n = parseInt(String(hex).replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

function Placeholder({ item, w, h, scale, S }) {
  const side = Math.min(w, h);
  const center = { flex: 1, alignItems: "center", justifyContent: "center" };
  const hDp = h / scale;
  switch (item.type) {
    case "art":
      return (
        <View style={[center, { backgroundColor: "#2A2438" }]}>
          <Ionicons name="musical-notes" size={side * 0.45} color="rgba(255,255,255,0.4)" />
        </View>
      );
    case "title":
      return (
        <Text numberOfLines={1} style={{ color: "#F5F3FA", fontWeight: "700", fontSize: textSizeDp("title", hDp, S.textScale) * scale }}>
          Song title
        </Text>
      );
    case "subtitle":
      return (
        <Text numberOfLines={1} style={{ color: "#B8B3C4", fontSize: textSizeDp("subtitle", hDp, S.textScale) * scale }}>
          Artist name
        </Text>
      );
    case "progress":
      return (
        <View style={{ flex: 1, backgroundColor: hexToRgba(S.accent, 0.3) }}>
          <View style={{ width: "40%", height: "100%", backgroundColor: S.accent }} />
        </View>
      );
    case "prev":
      return <View style={center}><Ionicons name="play-skip-back" size={side * 0.9} color="#F5F3FA" /></View>;
    case "next":
      return <View style={center}><Ionicons name="play-skip-forward" size={side * 0.9} color="#F5F3FA" /></View>;
    case "play":
      return <View style={center}><Ionicons name="play" size={side * 0.9} color={S.accent} /></View>;
    default:
      return null;
  }
}

function EditableItem({ item, selected, P, CW, CH, S, onSelect, onChange }) {
  const scale = CW / P.w;
  const itemRef = useRef(item);
  itemRef.current = item;
  const geo = useRef({ P, CW, CH });
  geo.current = { P, CW, CH };
  const cb = useRef({ onSelect, onChange });
  cb.current = { onSelect, onChange };
  const start = useRef(null);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        start.current = { ...itemRef.current };
        cb.current.onSelect(itemRef.current.id);
      },
      onPanResponderMove: (_, g) => {
        const s0 = start.current;
        if (!s0) return;
        const { P, CW, CH } = geo.current;
        let x = clamp(s0.x + g.dx / CW, 0, 1 - s0.w);
        let y = clamp(s0.y + g.dy / CH, 0, 1 - s0.h);
        x = clamp(snapFrac(x, P.w), 0, 1 - s0.w);
        y = clamp(snapFrac(y, P.h), 0, 1 - s0.h);
        cb.current.onChange(s0.id, { x, y });
      },
    })
  ).current;

  const left = item.x * CW;
  const top = item.y * CH;
  const w = item.w * CW;
  const h = item.h * CH;
  const padV = Math.max(0, (30 - h) / 2);
  const padH = Math.max(0, (30 - w) / 2);

  return (
    <View
      {...responder.panHandlers}
      hitSlop={{ top: padV, bottom: padV, left: padH, right: padH }}
      style={{
        position: "absolute",
        left,
        top,
        width: w,
        height: h,
        zIndex: selected ? 20 : 1,
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? ORCHID : "rgba(255,255,255,0.18)",
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      <Placeholder item={item} w={w} h={h} scale={scale} S={S} />
    </View>
  );
}

export default function WidgetLayoutEditor({ settings, onCancel, onDone }) {
  const S = settings || {};
  const [presetKey, setPresetKey] = useState("wide");
  const [layouts, setLayouts] = useState(() => ({ ...(S.layouts || {}) }));
  const [selectedId, setSelectedId] = useState(null);

  const P = PRESETS[presetKey];
  const CW = Dimensions.get("window").width - 40;
  const CH = (CW * P.h) / P.w;
  const scale = CW / P.w;
  const items = getLayout({ layouts }, presetKey);
  const selected = items.find((i) => i.id === selectedId) || null;
  const missing = TYPE_ORDER.filter((t) => !items.some((i) => i.type === t));

  const updateItem = (id, patch) =>
    setLayouts((prev) => {
      const cur = getLayout({ layouts: prev }, presetKey);
      return { ...prev, [presetKey]: cur.map((it) => (it.id === id ? { ...it, ...patch } : it)) };
    });

  const removeSelected = () => {
    if (!selected) return;
    setLayouts((prev) => {
      const cur = getLayout({ layouts: prev }, presetKey);
      return { ...prev, [presetKey]: cur.filter((it) => it.id !== selected.id) };
    });
    setSelectedId(null);
  };

  const addType = (type) => {
    const it = defaultItem(presetKey, type);
    setLayouts((prev) => ({ ...prev, [presetKey]: [...getLayout({ layouts: prev }, presetKey), it] }));
    setSelectedId(it.id);
  };

  const resetPreset = () => {
    setLayouts((prev) => {
      const n = { ...prev };
      delete n[presetKey];
      return n;
    });
    setSelectedId(null);
  };

  // Resize handle: one shared responder that works on whichever item is selected.
  const selRef = useRef(null);
  selRef.current = selected;
  const geoRef = useRef(null);
  geoRef.current = { P, CW };
  const updateRef = useRef(null);
  updateRef.current = updateItem;
  const startRef = useRef(null);

  const resize = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        startRef.current = selRef.current ? { ...selRef.current } : null;
      },
      onPanResponderMove: (_, g) => {
        const s0 = startRef.current;
        if (!s0) return;
        const { P, CW } = geoRef.current;
        const sc = CW / P.w;
        const T = TYPES[s0.type];
        const dx = g.dx / sc;
        const dy = g.dy / sc;
        const maxW = P.w - s0.x * P.w;
        const maxH = P.h - s0.y * P.h;
        let wDp = s0.w * P.w;
        let hDp = s0.h * P.h;
        if (T.lock) {
          const size = clamp(
            Math.round((wDp + (dx + dy) / 2) / SNAP) * SNAP,
            Math.max(T.minW, T.minH),
            Math.min(maxW, maxH)
          );
          wDp = size;
          hDp = size;
        } else {
          wDp = clamp(Math.round((wDp + dx) / SNAP) * SNAP, T.minW, maxW);
          hDp = clamp(Math.round((hDp + dy) / SNAP) * SNAP, T.minH, maxH);
        }
        updateRef.current(s0.id, { w: wDp / P.w, h: hDp / P.h });
      },
    })
  ).current;

  return (
    <View style={st.root}>
      <View style={st.header}>
        <TouchableOpacity onPress={onCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={st.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={st.title}>Edit layout</Text>
        <TouchableOpacity onPress={() => onDone(layouts)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={st.save}>Save</Text>
        </TouchableOpacity>
      </View>

      <View style={st.chipRow}>
        {Object.keys(PRESETS).map((k) => (
          <TouchableOpacity
            key={k}
            onPress={() => {
              setPresetKey(k);
              setSelectedId(null);
            }}
            style={[st.chip, k === presetKey && st.chipOn]}
          >
            <Text style={[st.chipTxt, k === presetKey && st.chipTxtOn]}>{PRESETS[k].label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View
        style={{
          width: CW,
          height: CH,
          alignSelf: "center",
          marginTop: 6,
          borderRadius: Math.min((S.radius || 20) * scale, 40),
          backgroundColor: S.bgColor || INK,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.15)",
        }}
      >
        <View
          style={StyleSheet.absoluteFill}
          onStartShouldSetResponder={() => true}
          onResponderRelease={() => setSelectedId(null)}
        />
        {items.map((it) => (
          <EditableItem
            key={it.id}
            item={it}
            selected={it.id === selectedId}
            P={P}
            CW={CW}
            CH={CH}
            S={S}
            onSelect={setSelectedId}
            onChange={updateItem}
          />
        ))}
        {selected && (
          <View
            {...resize.panHandlers}
            style={[
              st.handle,
              {
                left: clamp((selected.x + selected.w) * CW, 14, CW - 14) - 14,
                top: clamp((selected.y + selected.h) * CH, 14, CH - 14) - 14,
              },
            ]}
          >
            <Ionicons name="resize" size={14} color={INK} />
          </View>
        )}
      </View>

      <Text style={st.hint}>Tap to select, drag to move, drag the corner dot to resize.</Text>

      {selected && (
        <View style={st.selBar}>
          <Text style={st.selName}>
            {TYPES[selected.type].label} · {Math.round(selected.w * P.w)}×{Math.round(selected.h * P.h)} dp
          </Text>
          <TouchableOpacity style={st.delBtn} onPress={removeSelected}>
            <Ionicons name="trash" size={16} color="#FF7A90" />
            <Text style={st.delTxt}>Remove</Text>
          </TouchableOpacity>
        </View>
      )}

      {missing.length > 0 && (
        <>
          <Text style={st.section}>Add</Text>
          <View style={st.wrapRow}>
            {missing.map((t) => (
              <TouchableOpacity key={t} style={st.addChip} onPress={() => addType(t)}>
                <Ionicons name={TYPES[t].icon} size={14} color={ORCHID} />
                <Text style={st.addTxt}>{TYPES[t].label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <TouchableOpacity style={st.reset} onPress={resetPreset}>
        <Text style={st.resetTxt}>Reset {P.label} layout</Text>
      </TouchableOpacity>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK, paddingHorizontal: 20, paddingTop: 50 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  title: { color: "#F5F3FA", fontSize: 20, fontWeight: "800" },
  cancel: { color: "#B8B3C4", fontSize: 16 },
  save: { color: ORCHID, fontSize: 16, fontWeight: "800" },
  chipRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18, backgroundColor: "#1A1822" },
  chipOn: { backgroundColor: ORCHID },
  chipTxt: { color: "#F5F3FA", fontSize: 14 },
  chipTxtOn: { color: INK, fontWeight: "700" },
  handle: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ORCHID,
    borderWidth: 2,
    borderColor: INK,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  hint: { color: "#B8B3C4", fontSize: 12, textAlign: "center", marginTop: 12 },
  selBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    backgroundColor: "#1A1822",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  selName: { color: "#F5F3FA", fontWeight: "700", fontSize: 14 },
  delBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  delTxt: { color: "#FF7A90", fontWeight: "700" },
  section: { color: "#B8B3C4", fontSize: 13, fontWeight: "700", marginTop: 20, marginBottom: 10 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  addChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: "#1A1822",
    borderWidth: 1,
    borderColor: "rgba(200,155,255,0.35)",
  },
  addTxt: { color: "#F5F3FA", fontSize: 13, fontWeight: "600" },
  reset: { marginTop: 22, alignItems: "center", padding: 13, borderRadius: 14, backgroundColor: "#1A1822" },
  resetTxt: { color: "#FF7A90", fontWeight: "700" },
});
