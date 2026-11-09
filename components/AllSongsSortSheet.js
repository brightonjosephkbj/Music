import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const ORCHID = "#C89BFF";

export const SORT_LABELS = {
  recent: "Recently Added",
  title: "Title A-Z",
  artist: "Artist A-Z",
  played: "Most Played",
  duration: "Longest First",
};

const OPTIONS = [
  ["recent", "time-outline"],
  ["title", "text-outline"],
  ["artist", "person-outline"],
  ["played", "flame-outline"],
  ["duration", "hourglass-outline"],
];

export default function AllSongsSortSheet({ visible, current, onPick, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={st.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={st.sheet}>
        <View style={st.handle} />
        <Text style={st.title}>Sort songs by</Text>
        {OPTIONS.map(([mode, icon]) => {
          const on = mode === current;
          return (
            <TouchableOpacity key={mode} style={st.row} onPress={() => onPick(mode)} activeOpacity={0.7}>
              <Ionicons name={icon} size={20} color={on ? ORCHID : "rgba(255,255,255,0.6)"} />
              <Text style={[st.label, on && { color: ORCHID }]}>{SORT_LABELS[mode]}</Text>
              {on && <Ionicons name="checkmark" size={20} color={ORCHID} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    backgroundColor: "#15121C",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 10,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginBottom: 14,
  },
  title: { color: "#F5F3FA", fontSize: 18, fontWeight: "800", marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
  label: { flex: 1, color: "#F5F3FA", fontSize: 16, fontWeight: "600" },
});
