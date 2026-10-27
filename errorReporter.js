import React from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { API_BASE, gatewayHeaders } from "./apiClient";

let appVersion = "unknown";
try {
  appVersion = require("./app.json").expo.version || "unknown";
} catch {}

let currentScreen = "unknown";
export function setReportScreen(name) {
  currentScreen = name || "unknown";
}

const seen = new Set();
let sent = 0;

export function reportError(error, { fatal = false, source = "js" } = {}) {
  try {
    if (sent >= 8) return;
    const message = String(error?.message || error || "unknown error").slice(0, 300);
    const key = source + message;
    if (seen.has(key)) return;
    seen.add(key);
    sent += 1;
    fetch(`${API_BASE}/api/apicache/api/client_log`, {
      method: "POST",
      headers: gatewayHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        version: appVersion,
        os: Platform.OS,
        osVersion: String(Platform.Version),
        screen: currentScreen,
        fatal,
        message: `[${source}] ${message}`,
        stack: String(error?.stack || "").slice(0, 1500),
      }),
    }).catch(() => {});
  } catch {}
}

function installGlobalErrorHandler() {
  try {
    const prev = global.ErrorUtils?.getGlobalHandler?.();
    global.ErrorUtils?.setGlobalHandler?.((error, isFatal) => {
      reportError(error, { fatal: !!isFatal, source: "global" });
      if (!prev) return;
      // give the report a moment to leave before a fatal error closes the app
      if (isFatal) setTimeout(() => prev(error, isFatal), 700);
      else prev(error, isFatal);
    });
  } catch {}
}

class Boundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    reportError(error, { fatal: true, source: "render" });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: "#0b0d12", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ color: "#fff", fontSize: 18, marginBottom: 14 }}>Something went wrong</Text>
        <TouchableOpacity
          onPress={() => this.setState({ failed: false })}
          style={{ backgroundColor: "#e5c97e", paddingVertical: 12, paddingHorizontal: 28, borderRadius: 24 }}
        >
          <Text style={{ color: "#000", fontWeight: "700" }}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

export function withErrorReporting(App) {
  installGlobalErrorHandler();
  return function Wrapped(props) {
    return (
      <Boundary>
        <App {...props} />
      </Boundary>
    );
  };
}
