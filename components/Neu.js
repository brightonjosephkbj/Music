import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Animated, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

export const NEU = {
  bg: "#1A1624",
  faceTop: "#241F30",
  faceBottom: "#191521",
  insetTop: "#110E18",
  insetBottom: "#1E1929",
  text: "#F5F3FA",
  muted: "#A29BB3",
  orchid: "#C89BFF",
  danger: "#FF7A90",
  good: "#7AE0B0",
};

// [offset px, opacity] - stacked layers fake a soft shadow without any native module.
// Tune these numbers if the effect feels too strong or too flat.
const DARK = [[2, 0.3], [4, 0.2], [7, 0.12]];
const LIGHT = [[1, 0.06], [2, 0.04], [3, 0.025]];

// Raised: looks pushed out of the screen.
export function Raised({ children, radius = 20, style, faceStyle, colors }) {
  return (
    <View style={[{ borderRadius: radius }, style]}>
      {DARK.map(([o, a]) => (
        <View
          key={"d" + o}
          pointerEvents="none"
          style={{ position: "absolute", left: o, top: o, right: -o, bottom: -o, borderRadius: radius, backgroundColor: `rgba(0,0,0,${a})` }}
        />
      ))}
      {LIGHT.map(([o, a]) => (
        <View
          key={"l" + o}
          pointerEvents="none"
          style={{ position: "absolute", left: -o, top: -o, right: o, bottom: o, borderRadius: radius, backgroundColor: `rgba(255,255,255,${a})` }}
        />
      ))}
      <LinearGradient
        colors={colors || [NEU.faceTop, NEU.faceBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[{ borderRadius: radius, overflow: "hidden" }, faceStyle]}
      >
        {children}
      </LinearGradient>
    </View>
  );
}

// Inset: looks pressed into the screen (toggles, fields, icon wells).
export function Inset({ children, radius = 14, style }) {
  return (
    <LinearGradient
      colors={[NEU.insetTop, NEU.insetBottom]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        {
          borderRadius: radius,
          borderWidth: 1.5,
          borderTopColor: "rgba(0,0,0,0.55)",
          borderLeftColor: "rgba(0,0,0,0.55)",
          borderBottomColor: "rgba(255,255,255,0.07)",
          borderRightColor: "rgba(255,255,255,0.07)",
          overflow: "hidden",
        },
        style,
      ]}
    >
      {children}
    </LinearGradient>
  );
}

export const Divider = () => (
  <View style={{ marginLeft: 66, marginRight: 14 }}>
    <View style={{ height: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
    <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.05)" }} />
  </View>
);

export function SectionTitle({ children }) {
  return <Text style={st.sectionTitle}>{children}</Text>;
}

export function NeuRow({ icon, title, subtitle, right, onPress, danger, last }) {
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <>
      <Wrap onPress={onPress} activeOpacity={0.75} style={st.row}>
        <Inset radius={14} style={st.iconWell}>
          <Ionicons name={icon} size={18} color={danger ? NEU.danger : NEU.orchid} />
        </Inset>
        <View style={{ flex: 1 }}>
          <Text style={[st.rowTitle, danger && { color: NEU.danger }]}>{title}</Text>
          {!!subtitle && <Text style={st.rowSub}>{subtitle}</Text>}
        </View>
        {right}
      </Wrap>
      {!last && <Divider />}
    </>
  );
}

export function NeuToggle({ value, onChange, disabled }) {
  const x = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(x, { toValue: value ? 1 : 0, useNativeDriver: true, bounciness: 6 }).start();
  }, [value]);
  const tx = x.interpolate({ inputRange: [0, 1], outputRange: [3, 26] });
  return (
    <TouchableOpacity activeOpacity={0.8} disabled={disabled} onPress={() => onChange && onChange(!value)}>
      <Inset radius={16} style={{ width: 54, height: 30, justifyContent: "center", opacity: disabled ? 0.5 : 1 }}>
        <Animated.View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            transform: [{ translateX: tx }],
            backgroundColor: value ? NEU.orchid : "#3A3348",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)",
          }}
        />
      </Inset>
    </TouchableOpacity>
  );
}

export function RoundButton({ icon, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Raised radius={20} faceStyle={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={20} color={NEU.text} />
      </Raised>
    </TouchableOpacity>
  );
}

export function NeuButton({ label, icon, onPress, primary, danger, disabled, style }) {
  const color = primary ? "#0B0A0F" : danger ? NEU.danger : NEU.text;
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8} style={[{ opacity: disabled ? 0.5 : 1 }, style]}>
      <Raised
        radius={18}
        colors={primary ? ["#D6B2FF", "#B583F5"] : undefined}
        faceStyle={{ paddingVertical: 14, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        {!!icon && <Ionicons name={icon} size={18} color={color} />}
        <Text style={{ color, fontWeight: "800", fontSize: 15 }}>{label}</Text>
      </Raised>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  sectionTitle: {
    color: NEU.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 12,
    marginLeft: 6,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 14 },
  iconWell: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  rowTitle: { color: NEU.text, fontSize: 15, fontWeight: "700" },
  rowSub: { color: NEU.muted, fontSize: 12, marginTop: 2 },
});
