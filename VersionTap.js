import React, { useRef, useState } from "react";
import { Text, TouchableOpacity, Alert, ToastAndroid, Platform } from "react-native";
import { toggleRawErrors, isRawErrors } from "./friendlyError";

// Tap 10 times (each tap within 2s of the last) to toggle raw/friendly errors.
export default function VersionTap({ text, style }) {
  const count = useRef(0);
  const timer = useRef(null);
  const [raw, setRaw] = useState(isRawErrors());
  const onPress = () => {
    count.current += 1;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { count.current = 0; }, 2000);
    if (count.current >= 10) {
      count.current = 0;
      const on = toggleRawErrors();
      setRaw(on);
      const msg = on ? "Developer mode: raw errors ON" : "Raw errors OFF: friendly messages";
      if (Platform.OS === "android") ToastAndroid.show(msg, ToastAndroid.SHORT);
      else Alert.alert(msg);
    }
  };
  return (
    <TouchableOpacity activeOpacity={1} onPress={onPress}>
      <Text style={style}>{text + (raw ? " · raw errors" : "")}</Text>
    </TouchableOpacity>
  );
}
