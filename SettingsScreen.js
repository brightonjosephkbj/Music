import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  Image,
  TextInput,
  ScrollView,
  PermissionsAndroid,
  Linking,
  AppState,
  BackHandler,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Updates from "expo-updates";
import * as ImagePicker from "expo-image-picker";
import appJson from "./app.json";
import { uploadAvatar, updateUsername, updateBio } from "./apiClient";
import WidgetCustomizeScreen from "./WidgetCustomizeScreen";
import HomeBackgroundScreen from "./HomeBackgroundScreen";
import { NEU, Raised, Inset, NeuRow, NeuButton, RoundButton, SectionTitle } from "./Neu";
import { StoragePage, TrashPage } from "./StoragePages";

const APP_VERSION = appJson.expo.version;

// To add a new settings category: add an entry here, a title in PAGE_TITLES,
// and render its rows in the ScrollView below (search for "page ===").
const CATEGORIES = [
  { key: "appearance", icon: "color-palette-outline", title: "Appearance", subtitle: "Home background, widget" },
  { key: "storage", icon: "server-outline", title: "Storage", subtitle: "Space, duplicates, trash" },
  { key: "permissions", icon: "shield-checkmark-outline", title: "Permissions", subtitle: "Camera, location, mic, files" },
  { key: "about", icon: "information-circle-outline", title: "About & updates", subtitle: `Version ${APP_VERSION}` },
];
const PAGE_TITLES = { appearance: "Appearance", storage: "Storage", trash: "Trash", permissions: "Permissions", about: "About & updates" };

const PERMS = [
  { key: "camera", icon: "camera-outline", title: "Camera", why: "For scanning", perm: () => PermissionsAndroid.PERMISSIONS.CAMERA },
  { key: "location", icon: "location-outline", title: "Location", why: "For local weather", perm: () => PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION },
  { key: "mic", icon: "mic-outline", title: "Microphone", why: "For recording and voice", perm: () => PermissionsAndroid.PERMISSIONS.RECORD_AUDIO },
  {
    key: "media",
    icon: "musical-notes-outline",
    title: "Music & video files",
    why: "To find media on your phone",
    perm: () =>
      Platform.Version >= 33
        ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
        : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
  },
];

const Chevron = () => <Ionicons name="chevron-forward" size={18} color={NEU.muted} />;

function StatusPill({ on }) {
  const label = on === true ? "Granted" : on === false ? "Off" : "-";
  return (
    <Inset radius={12} style={{ paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: on === true ? NEU.good : NEU.muted, fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </Inset>
  );
}

function PermissionsPage() {
  const [perm, setPerm] = useState({});

  const refresh = useCallback(async () => {
    if (Platform.OS !== "android") return;
    const next = {};
    for (const p of PERMS) {
      try {
        next[p.key] = await PermissionsAndroid.check(p.perm());
      } catch {
        next[p.key] = null;
      }
    }
    setPerm(next);
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (s) => s === "active" && refresh());
    return () => sub.remove();
  }, [refresh]);

  const onPress = async (p) => {
    if (perm[p.key] === true) {
      Linking.openSettings();
      return;
    }
    try {
      const r = await PermissionsAndroid.request(p.perm());
      if (r === "never_ask_again") Linking.openSettings();
    } catch {}
    refresh();
  };

  return (
    <>
      <Text style={st.note}>
        Tap a permission to allow it. To turn one off, tap it again to open your phone's app settings.
      </Text>
      <Raised style={st.block}>
        {PERMS.map((p, i) => (
          <NeuRow
            key={p.key}
            icon={p.icon}
            title={p.title}
            subtitle={p.why}
            last={i === PERMS.length - 1}
            onPress={() => onPress(p)}
            right={<StatusPill on={perm[p.key]} />}
          />
        ))}
      </Raised>
      <NeuButton label="Open app settings" icon="settings-outline" onPress={() => Linking.openSettings()} />
    </>
  );
}

function StatusCard({ children }) {
  return (
    <Raised style={st.block} faceStyle={{ padding: 16 }}>
      {children}
    </Raised>
  );
}

export default function SettingsScreen({ authUser, onSignOutPress, onProfileUpdate, onBackPress } = {}) {
  const [page, setPage] = useState("main");
  const [overlay, setOverlay] = useState(null); // "homeBg" | "widget"

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState(null);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState(authUser?.username || "");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState(null);
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState(authUser?.bio || "");
  const [bioSaving, setBioSaving] = useState(false);
  const [bioError, setBioError] = useState(null);

  // status: "idle" | "checking" | "upToDate" | "available" | "downloading" | "ready" | "error"
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  const runningInfo = {
    isEmbedded: Updates.isEmbeddedLaunch,
    createdAt: Updates.createdAt,
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (overlay) {
        setOverlay(null);
        return true;
      }
      if (page !== "main") {
        setPage(page === "trash" ? "storage" : "main");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [overlay, page]);

  const pickAndUploadAvatar = async () => {
    setAvatarError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setAvatarError("Photo library permission is required");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    setAvatarUploading(true);
    try {
      const avatarUrl = await uploadAvatar(authUser.id, uri);
      onProfileUpdate?.({ avatar_url: avatarUrl });
    } catch (err) {
      setAvatarError(err.message || "Upload failed");
    } finally {
      setAvatarUploading(false);
    }
  };

  const saveUsername = async () => {
    const trimmed = usernameDraft.trim();
    if (!trimmed || trimmed === authUser.username) {
      setEditingUsername(false);
      setUsernameDraft(authUser.username);
      return;
    }
    setUsernameSaving(true);
    setUsernameError(null);
    try {
      await updateUsername(authUser.id, trimmed);
      onProfileUpdate?.({ username: trimmed, handle: `${trimmed}@b24.me` });
      setEditingUsername(false);
    } catch (err) {
      setUsernameError(err.message || "Failed to update username");
    } finally {
      setUsernameSaving(false);
    }
  };

  const saveBio = async () => {
    const trimmed = bioDraft.slice(0, 150);
    if (trimmed === (authUser.bio || "")) {
      setEditingBio(false);
      return;
    }
    setBioSaving(true);
    setBioError(null);
    try {
      await updateBio(authUser.id, trimmed);
      onProfileUpdate?.({ bio: trimmed });
      setEditingBio(false);
    } catch (err) {
      setBioError(err.message || "Failed to update bio");
    } finally {
      setBioSaving(false);
    }
  };

  const runCheck = async () => {
    if (__DEV__ || !Updates.isEnabled) {
      setError("OTA updates are disabled in development builds - test this in a release/production build.");
      setStatus("error");
      return;
    }
    setStatus("checking");
    setError(null);
    try {
      const result = await Updates.checkForUpdateAsync();
      setStatus(result.isAvailable ? "available" : "upToDate");
    } catch (err) {
      setError(err.message || "Couldn't reach the update server");
      setStatus("error");
    }
  };

  const downloadUpdate = async () => {
    setStatus("downloading");
    setError(null);
    try {
      await Updates.fetchUpdateAsync();
      setStatus("ready");
    } catch (err) {
      setError(err.message || "Failed to download the update");
      setStatus("error");
    }
  };

  const applyUpdate = async () => {
    try {
      await Updates.reloadAsync();
    } catch (err) {
      setError(err.message || "Failed to apply the update");
      setStatus("error");
    }
  };

  const goBack = () => {
    if (page === "trash") setPage("storage");
    else if (page !== "main") setPage("main");
    else onBackPress && onBackPress();
  };
  const showBack = page !== "main" || !!onBackPress;

  return (
    <View style={st.root}>
      <LinearGradient colors={["#1D1828", "#15111D"]} style={StyleSheet.absoluteFill} />

      <View style={st.header}>
        {showBack && <RoundButton icon="chevron-back" onPress={goBack} />}
        <Text style={st.title}>{page === "main" ? "Settings" : PAGE_TITLES[page]}</Text>
      </View>

      <ScrollView contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>
        {page === "main" && (
          <>
            {authUser && (
              <Raised style={st.block} faceStyle={{ padding: 18 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <TouchableOpacity onPress={pickAndUploadAvatar} disabled={avatarUploading} style={st.avatarRing}>
                    {authUser.avatar_url ? (
                      <Image source={{ uri: authUser.avatar_url }} style={st.avatar} />
                    ) : (
                      <View style={[st.avatar, st.avatarPh]}>
                        <Text style={st.avatarPhTxt}>{(authUser.username || "?")[0].toUpperCase()}</Text>
                      </View>
                    )}
                    {avatarUploading && (
                      <View style={st.avatarOverlay}>
                        <ActivityIndicator color="#fff" size="small" />
                      </View>
                    )}
                    <View style={st.avatarBadge}>
                      <Ionicons name="camera" size={12} color="#0B0A0F" />
                    </View>
                  </TouchableOpacity>

                  <View style={{ flex: 1 }}>
                    {editingUsername ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Inset radius={12} style={{ flex: 1, paddingHorizontal: 12 }}>
                          <TextInput
                            style={st.input}
                            value={usernameDraft}
                            onChangeText={setUsernameDraft}
                            autoFocus
                            editable={!usernameSaving}
                            maxLength={24}
                            placeholderTextColor={NEU.muted}
                          />
                        </Inset>
                        {usernameSaving ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <>
                            <TouchableOpacity onPress={saveUsername}>
                              <Ionicons name="checkmark" size={22} color={NEU.good} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                setEditingUsername(false);
                                setUsernameDraft(authUser.username);
                                setUsernameError(null);
                              }}
                            >
                              <Ionicons name="close" size={22} color={NEU.danger} />
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    ) : (
                      <TouchableOpacity onPress={() => setEditingUsername(true)}>
                        <Text style={st.name}>{authUser.username}</Text>
                      </TouchableOpacity>
                    )}
                    {!!usernameError && <Text style={st.err}>{usernameError}</Text>}
                    {!!authUser.handle && <Text style={st.handle}>{authUser.handle}</Text>}
                  </View>
                </View>

                {!!avatarError && <Text style={st.err}>{avatarError}</Text>}

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
                  <Inset radius={12} style={{ paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={st.badgeTxt}>{(authUser.account_type || "personal").replace("_", " ")}</Text>
                  </Inset>
                  {!!authUser.verified && (
                    <Inset radius={12} style={{ paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={[st.badgeTxt, { color: authUser.verified === "cyan" ? "#4FD8E8" : NEU.orchid }]}>
                        ✓ verified
                      </Text>
                    </Inset>
                  )}
                </View>

                <View style={{ marginTop: 14 }}>
                  {editingBio ? (
                    <View>
                      <Inset radius={12} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
                        <TextInput
                          style={[st.input, { fontSize: 14, fontWeight: "400", minHeight: 60, textAlignVertical: "top" }]}
                          value={bioDraft}
                          onChangeText={(t) => setBioDraft(t.slice(0, 150))}
                          multiline
                          autoFocus
                          editable={!bioSaving}
                          maxLength={150}
                          placeholderTextColor={NEU.muted}
                        />
                      </Inset>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                        <Text style={st.handle}>{bioDraft.length}/150</Text>
                        {bioSaving ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <View style={{ flexDirection: "row", gap: 16 }}>
                            <TouchableOpacity onPress={saveBio}>
                              <Ionicons name="checkmark" size={22} color={NEU.good} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                setEditingBio(false);
                                setBioDraft(authUser.bio || "");
                                setBioError(null);
                              }}
                            >
                              <Ionicons name="close" size={22} color={NEU.danger} />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={() => setEditingBio(true)}>
                      <Text style={authUser.bio ? st.bio : st.bioPh}>{authUser.bio || "Add a bio"}</Text>
                    </TouchableOpacity>
                  )}
                  {!!bioError && <Text style={st.err}>{bioError}</Text>}
                </View>
              </Raised>
            )}

            <SectionTitle>General</SectionTitle>
            <Raised style={st.block}>
              {CATEGORIES.map((c, i) => (
                <NeuRow
                  key={c.key}
                  icon={c.icon}
                  title={c.title}
                  subtitle={c.subtitle}
                  last={i === CATEGORIES.length - 1}
                  onPress={() => setPage(c.key)}
                  right={<Chevron />}
                />
              ))}
            </Raised>

            {authUser && (
              <NeuButton
                label="Sign Out"
                icon="log-out-outline"
                danger
                onPress={() =>
                  Alert.alert("Sign Out", "Are you sure you want to sign out?", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Sign Out", style: "destructive", onPress: onSignOutPress },
                  ])
                }
              />
            )}
            <Text style={st.footer}>B24 Music · v{APP_VERSION}</Text>
          </>
        )}

        {page === "appearance" && (
          <Raised style={st.block}>
            <NeuRow
              icon="image-outline"
              title="Home background"
              subtitle="Set a picture or video behind Home"
              onPress={() => setOverlay("homeBg")}
              right={<Chevron />}
            />
            <NeuRow
              icon="apps-outline"
              title="Customize widget"
              subtitle="Colors, background, layout"
              last
              onPress={() => setOverlay("widget")}
              right={<Chevron />}
            />
          </Raised>
        )}

        {page === "permissions" && <PermissionsPage />}

        {page === "storage" && <StoragePage onOpenTrash={() => setPage("trash")} />}
        {page === "trash" && <TrashPage />}

        {page === "about" && (
          <>
            <Raised style={st.block}>
              <NeuRow
                icon="phone-portrait-outline"
                title="App version"
                subtitle={Platform.OS === "ios" ? "iOS" : "Android"}
                right={<Text style={st.value}>{APP_VERSION}</Text>}
              />
              <NeuRow
                icon="cloud-download-outline"
                title="Update channel"
                subtitle={
                  !runningInfo.isEmbedded && runningInfo.createdAt
                    ? `Applied ${new Date(runningInfo.createdAt).toISOString().slice(0, 10)}`
                    : undefined
                }
                right={<Text style={st.value}>{runningInfo.isEmbedded ? "Built-in" : "OTA active"}</Text>}
              />
              <NeuRow
                icon="refresh-outline"
                title="Check for updates"
                subtitle={status === "checking" ? "Checking..." : "Make sure you're on the latest build"}
                last
                onPress={status === "checking" || status === "downloading" ? undefined : runCheck}
                right={status === "checking" ? <ActivityIndicator color={NEU.orchid} size="small" /> : <Chevron />}
              />
            </Raised>

            {status === "upToDate" && (
              <StatusCard>
                <Text style={st.good}>You're up to date.</Text>
              </StatusCard>
            )}
            {status === "error" && (
              <StatusCard>
                <Text style={st.bad}>{error}</Text>
              </StatusCard>
            )}
            {status === "available" && (
              <StatusCard>
                <Text style={st.good}>An update is available.</Text>
                <NeuButton label="Download Update" primary onPress={downloadUpdate} style={{ marginTop: 12 }} />
              </StatusCard>
            )}
            {status === "downloading" && (
              <StatusCard>
                <ActivityIndicator color="#fff" />
                <Text style={[st.note, { textAlign: "center", marginTop: 8, marginBottom: 0 }]}>Downloading...</Text>
              </StatusCard>
            )}
            {status === "ready" && (
              <StatusCard>
                <Text style={st.good}>Update downloaded.</Text>
                <Text style={[st.note, { marginBottom: 0 }]}>Restart the app now to apply it.</Text>
                <NeuButton label="Restart & Apply" primary onPress={applyUpdate} style={{ marginTop: 12 }} />
              </StatusCard>
            )}
          </>
        )}
      </ScrollView>

      {overlay === "homeBg" && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 10, elevation: 10, backgroundColor: "#0B0A0F" }]}>
          <HomeBackgroundScreen onBack={() => setOverlay(null)} />
        </View>
      )}
      {overlay === "widget" && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 10, elevation: 10, backgroundColor: "#0B0A0F" }]}>
          <WidgetCustomizeScreen onBack={() => setOverlay(null)} />
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: NEU.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16 },
  title: { color: NEU.text, fontSize: 26, fontWeight: "800" },
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 180 },
  block: { marginBottom: 22 },
  note: { color: NEU.muted, fontSize: 12.5, lineHeight: 18, marginBottom: 16, marginLeft: 4 },
  value: { color: NEU.muted, fontSize: 13, fontWeight: "700" },
  good: { color: NEU.good, fontSize: 15, fontWeight: "700" },
  bad: { color: NEU.danger, fontSize: 14, fontWeight: "600" },
  footer: { textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 20 },

  avatarRing: { borderWidth: 2, borderColor: "rgba(200,155,255,0.6)", borderRadius: 40, padding: 3 },
  avatar: { width: 66, height: 66, borderRadius: 33 },
  avatarPh: { backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  avatarPhTxt: { color: "#fff", fontSize: 24, fontWeight: "700" },
  avatarOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: 40, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  avatarBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: NEU.orchid,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: NEU.bg,
  },
  name: { color: NEU.text, fontSize: 22, fontWeight: "800" },
  handle: { color: NEU.muted, fontSize: 12, marginTop: 4 },
  err: { color: NEU.danger, fontSize: 12, marginTop: 4 },
  input: { color: NEU.text, fontSize: 18, fontWeight: "800", paddingVertical: 8 },
  badgeTxt: { color: NEU.text, fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  bio: { color: "rgba(245,243,250,0.9)", fontSize: 14, lineHeight: 20 },
  bioPh: { color: NEU.muted, fontSize: 14, fontStyle: "italic" },
});
