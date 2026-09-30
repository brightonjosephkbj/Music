import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Switch, StyleSheet } from "react-native";
import { WidgetPreview } from "react-native-android-widget";
import { NowPlayingWidget } from "./NowPlayingWidget";
import {
  DEFAULT_SETTINGS,
  loadWidgetSettings,
  saveWidgetSettings,
} from "./widgetSettings";
import { refreshNowPlayingWidget } from "./nowPlayingWidget";
import WidgetLayoutEditor from "./WidgetLayoutEditor";
import { Ionicons } from "@expo/vector-icons";

const ACCENTS = ["#C89BFF", "#7FB4E8", "#5EE0B0", "#FF7A90", "#FFC857", "#F5F3FA"];
const BGS = ["#0B0A0F", "#1B1230", "#0F1B2D", "#1A1A1A"];
const SIZES = {
  Small: { w: 160, h: 60 },
  Wide: { w: 320, h: 80 },
  Tall: { w: 320, h: 160 },
};

function Chips({ options, value, onChange }) {
  return (
    <View style={st.row}>
      {options.map((o) => (
        <Pressable
          key={String(o.value)}
          onPress={() => onChange(o.value)}
          style={[st.chip, value === o.value && st.chipOn]}
        >
          <Text style={[st.chipTxt, value === o.value && st.chipTxtOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Swatches({ colors, value, onChange }) {
  return (
    <View style={st.row}>
      {colors.map((c) => (
        <Pressable
          key={c}
          onPress={() => onChange(c)}
          style={[st.swatch, { backgroundColor: c }, value === c && st.swatchOn]}
        />
      ))}
    </View>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <View style={st.toggleRow}>
      <Text style={st.label}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

export default function WidgetCustomizeScreen({ onBack }) {
  const [s, setS] = useState(DEFAULT_SETTINGS);
  const [size, setSize] = useState("Wide");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    loadWidgetSettings(true).then(setS);
  }, []);

  const update = (patch) => {
    const next = { ...s, ...patch };
    setS(next);
    saveWidgetSettings(next).then(() => refreshNowPlayingWidget());
  };

  const dim = SIZES[size];

  if (editing) {
    return (
      <WidgetLayoutEditor
        settings={s}
        onCancel={() => setEditing(false)}
        onDone={(layouts) => {
          setEditing(false);
          update({ layouts, customLayout: true });
        }}
      />
    );
  }

  return (
    <ScrollView style={st.screen} contentContainerStyle={{ padding: 20, paddingBottom: 130 }}>
      <View style={st.header}>
        {onBack && (
          <Pressable onPress={onBack}>
            <Text style={st.back}>‹ Back</Text>
          </Pressable>
        )}
        <Text style={st.title}>Customize widget</Text>
      </View>

      <View style={st.previewBox}>
        <WidgetPreview
          key={JSON.stringify(s) + size}
          width={dim.w}
          height={dim.h}
          renderWidget={() => (
            <NowPlayingWidget
              title="Song title"
              artist="Artist name"
              progress={0.4}
              isPlaying
              width={dim.w}
              height={dim.h}
              settings={s}
            />
          )}
        />
      </View>
      <Chips
        options={Object.keys(SIZES).map((k) => ({ label: k, value: k }))}
        value={size}
        onChange={setSize}
      />

      <Text style={st.section}>Accent color</Text>
      <Swatches colors={ACCENTS} value={s.accent} onChange={(v) => update({ accent: v })} />

      <Text style={st.section}>Background</Text>
      <Chips
        options={[
          { label: "Artwork", value: "artwork" },
          { label: "Solid", value: "solid" },
        ]}
        value={s.bgStyle}
        onChange={(v) => update({ bgStyle: v })}
      />
      <View style={{ height: 10 }} />
      <Swatches colors={BGS} value={s.bgColor} onChange={(v) => update({ bgColor: v })} />
      {s.bgStyle === "artwork" && (
        <>
          <Text style={st.section}>Artwork dimming</Text>
          <Chips
            options={[
              { label: "Light", value: 0.55 },
              { label: "Medium", value: 0.7 },
              { label: "Dark", value: 0.82 },
              { label: "Darker", value: 0.92 },
            ]}
            value={s.dim}
            onChange={(v) => update({ dim: v })}
          />
        </>
      )}

      <Text style={st.section}>Corner radius</Text>
      <Chips
        options={[
          { label: "Sharp", value: 0 },
          { label: "Soft", value: 12 },
          { label: "Round", value: 20 },
          { label: "Pill", value: 32 },
        ]}
        value={s.radius}
        onChange={(v) => update({ radius: v })}
      />

      <Text style={st.section}>Text size</Text>
      <Chips
        options={[
          { label: "Small", value: 0.9 },
          { label: "Normal", value: 1 },
          { label: "Large", value: 1.15 },
        ]}
        value={s.textScale}
        onChange={(v) => update({ textScale: v })}
      />

      <Text style={st.section}>Layout</Text>
      <Toggle label="Custom layout" value={!!s.customLayout} onChange={(v) => update({ customLayout: v })} />
      <Pressable
        onPress={() => setEditing(true)}
        style={{ marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#C89BFF", borderRadius: 16, padding: 14 }}
      >
        <Ionicons name="move" size={18} color="#0B0A0F" />
        <Text style={{ color: "#0B0A0F", fontWeight: "800", fontSize: 15 }}>Edit layout</Text>
      </Pressable>

      <Text style={st.section}>Show</Text>
      <Toggle label="Album art" value={s.showArt} onChange={(v) => update({ showArt: v })} />
      <Toggle label="Progress bar" value={s.showProgress} onChange={(v) => update({ showProgress: v })} />
      <Toggle label="Lyric / artist line" value={s.showLyric} onChange={(v) => update({ showLyric: v })} />
      <Toggle label="Skip buttons" value={s.showSkip} onChange={(v) => update({ showSkip: v })} />

      <Pressable style={st.reset} onPress={() => update({ ...DEFAULT_SETTINGS })}>
        <Text style={st.resetTxt}>Reset to default</Text>
      </Pressable>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B0A0F" },
  header: { marginTop: 30, marginBottom: 16 },
  back: { color: "#C89BFF", fontSize: 16, marginBottom: 8 },
  title: { color: "#F5F3FA", fontSize: 28, fontWeight: "800" },
  previewBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    marginBottom: 12,
    borderRadius: 20,
    backgroundColor: "#1A1822",
  },
  section: { color: "#B8B3C4", fontSize: 13, fontWeight: "700", marginTop: 22, marginBottom: 10 },
  label: { color: "#F5F3FA", fontSize: 15 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "#1A1822",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  chipOn: { backgroundColor: "#C89BFF", borderColor: "#C89BFF" },
  chipTxt: { color: "#F5F3FA", fontSize: 14 },
  chipTxtOn: { color: "#0B0A0F", fontWeight: "700" },
  swatch: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: "transparent" },
  swatchOn: { borderColor: "#FFFFFF" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  reset: { marginTop: 30, alignItems: "center", padding: 14, borderRadius: 14, backgroundColor: "#1A1822" },
  resetTxt: { color: "#FF7A90", fontWeight: "700" },
});
