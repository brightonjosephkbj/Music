import React from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE, gatewayHeaders } from "./apiClient";

let appVersion = "unknown";
try {
  appVersion = require("./app.json").expo.version || "unknown";
} catch {}

let currentScreen = "unknown";
const DIAGNOSTICS_CONSENT_KEY = "b24_diagnostics_opt_in_v1";
const SAFE_ERROR_TYPES = new Set([
  "Error", "TypeError", "ReferenceError", "SyntaxError", "RangeError",
  "URIError", "EvalError", "NetworkError", "AbortError", "Invariant Violation",
]);
const SAFE_SOURCES = new Set(["global", "render", "js"]);
let diagnosticsEnabled = false;
let diagnosticsChoiceChanged = false;
const diagnosticsConsentReady = Promise.resolve()
  .then(() => AsyncStorage.getItem(DIAGNOSTICS_CONSENT_KEY))
  .then((value) => {
    if (!diagnosticsChoiceChanged) diagnosticsEnabled = value === "1";
  })
  .catch(() => {});

export function setReportScreen(name) {
  currentScreen = String(name || "unknown").replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 60) || "unknown";
}

export async function getDiagnosticsConsent() {
  await diagnosticsConsentReady;
  return diagnosticsEnabled;
}

export async function setDiagnosticsConsent(enabled) {
  diagnosticsChoiceChanged = true;
  diagnosticsEnabled = Boolean(enabled);
  await diagnosticsConsentReady;
  await AsyncStorage.setItem(DIAGNOSTICS_CONSENT_KEY, diagnosticsEnabled ? "1" : "0");
  return diagnosticsEnabled;
}

function diagnosticErrorType(error) {
  const type = SAFE_ERROR_TYPES.has(error?.name) ? error.name : "Error";
  const status = String(error?.message || "").match(/\b(?:status|http)\s*:?\s*([45]\d\d)\b/i);
  return status ? `${type} HTTP ${status[1]}` : type;
}

const seen = new Set();
let sent = 0;

export function reportError(error, { fatal = false, source = "js" } = {}) {
  try {
    if (!diagnosticsEnabled || sent >= 8) return;
    const safeSource = SAFE_SOURCES.has(source) ? source : "js";
    const category = diagnosticErrorType(error);
    const key = `${safeSource}:${category}`;
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
        fatal: Boolean(fatal),
        message: `[${safeSource}] ${category}`,
        stack: "",
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
