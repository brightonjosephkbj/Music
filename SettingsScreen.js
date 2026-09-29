import React, { useState, useEffect } from "react";
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
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Updates from "expo-updates";
import * as ImagePicker from "expo-image-picker";
import appJson from "./app.json";
import { uploadAvatar, updateUsername, updateBio } from "./apiClient";
import WidgetCustomizeScreen from "./WidgetCustomizeScreen";
import HomeBackgroundScreen from "./HomeBackgroundScreen";

/* settings_redesign_patch_v2 - sectioned list layout, dark theme kept */
const ACCENT = "#E8A662"; // amber - matches Inbox/ShareThread accent
const BG_TOP = "#170F14";
const BG_BOTTOM = "#2A1A18";
const GLASS_BG = "rgba(255,255,255,0.06)";
const GLASS_BORDER = "rgba(255,255,255,0.10)";
const DESTRUCTIVE = "#E8654F"; // warm terracotta-red, not generic red
const GOOD = "#7AC547";
const MUTED = "rgba(255,255,255,0.45)";

const APP_VERSION = appJson.expo.version;

// ---------------------------------------------------------------------------
// Reusable list row - icon box on the left, title/subtitle in the middle,
// and whatever goes on the right (chevron, a static value, a Switch, or a
// spinner). This is the sectioned-list pattern from the mockup, just
// dark-themed instead of the light mint version.
// ---------------------------------------------------------------------------
function SettingsRow({ icon, title, subtitle, right, onPress, disabled }) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={[styles.row, disabled && styles.rowDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.rowLeft}>
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={18} color={ACCENT} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {right}
    </Wrapper>
  );
}

function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export default function SettingsScreen({ authUser, onSignOutPress, onProfileUpdate, onBackPress } = {}) {
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [showWidgetCustomize, setShowWidgetCustomize] = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [avatarError, setAvatarError] = useState(null);

  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState(authUser?.username || "");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState(null);

  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState(authUser?.bio || "");
  const [bioSaving, setBioSaving] = useState(false);
  const [bioError, setBioError] = useState(null);

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

  // status: "idle" | "checking" | "upToDate" | "available" | "downloading" | "ready" | "error"
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  // Info about the update currently running on this device, if any -
  // useful to confirm OTA actually took effect after a reload.
  const runningInfo = {
    isEmbedded: Updates.isEmbeddedLaunch,
    updateId: Updates.updateId,
    createdAt: Updates.createdAt,
    runtimeVersion: Updates.runtimeVersion,
    channel: Updates.channel,
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

  return (
    <View style={styles.root}>
      {showBgPicker && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 10, elevation: 10, backgroundColor: "#0B0A0F" }]}>
          <HomeBackgroundScreen onBack={() => setShowBgPicker(false)} />
        </View>
      )}
      {showWidgetCustomize && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 10, elevation: 10, backgroundColor: "#0B0A0F" }]}>
          <WidgetCustomizeScreen onBack={() => setShowWidgetCustomize(false)} />
        </View>
      )}
      <LinearGradient colors={[BG_TOP, BG_BOTTOM]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        {!!onBackPress && (
          <TouchableOpacity style={styles.backButton} onPress={onBackPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={22} color={ACCENT} />
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ---------- Profile card: avatar upload, username, bio ---------- */}
        {authUser && (
          <View style={styles.profileCard}>
            <Text style={styles.profileLabel}>Profile</Text>

            <View style={styles.profileRow}>
              <TouchableOpacity
                onPress={pickAndUploadAvatar}
                disabled={avatarUploading}
                style={styles.avatarRing}
              >
                {authUser.avatar_url ? (
                  <Image
                    source={{ uri: authUser.avatar_url }}
                    style={styles.avatar}
                    onLoad={() => console.log("[avatar_debug] loaded ok:", authUser.avatar_url)}
                    onError={(e) =>
                      console.log(
                        "[avatar_debug] load FAILED:",
                        authUser.avatar_url,
                        e.nativeEvent.error
                      )
                    } /* avatar_debug_patch */
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarPlaceholderText}>
                      {(authUser.username || "?")[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                {avatarUploading && (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator color="#fff" size="small" />
                  </View>
                )}
                <View style={styles.avatarBadge}>
                  <Ionicons name="camera" size={12} color="#0B0B0D" />
                </View>
              </TouchableOpacity>

              <View style={styles.profileInfo}>
                {editingUsername ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.editInput}
                      value={usernameDraft}
                      onChangeText={setUsernameDraft}
                      autoFocus
                      editable={!usernameSaving}
                      maxLength={24}
                    />
                    {usernameSaving ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <TouchableOpacity onPress={saveUsername}>
                          <Ionicons name="checkmark" size={20} color={GOOD} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            setEditingUsername(false);
                            setUsernameDraft(authUser.username);
                            setUsernameError(null);
                          }}
                        >
                          <Ionicons name="close" size={20} color="#FF6B6B" />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => setEditingUsername(true)}>
                    <Text style={styles.profileName}>{authUser.username}</Text>
                  </TouchableOpacity>
                )}
                {!!usernameError && <Text style={styles.fieldError}>{usernameError}</Text>}

                {!!authUser.handle && (
                  <Text style={styles.profileSubtle}>{authUser.handle}</Text>
                )}
              </View>
            </View>

            {!!avatarError && <Text style={styles.fieldError}>{avatarError}</Text>}

            <View style={styles.accountRow}>
              <Text style={styles.accountTypeBadge}>
                {(authUser.account_type || "personal").replace("_", " ")}
              </Text>
              {!!authUser.verified && (
                <Text
                  style={[
                    styles.verifiedBadge,
                    authUser.verified === "cyan" && styles.verifiedBadgeCyan,
                  ]}
                >
                  ✓ verified
                </Text>
              )}
            </View>

            <View style={styles.bioBlock}>
              {editingBio ? (
                <View>
                  <TextInput
                    style={[styles.editInput, styles.bioInput]}
                    value={bioDraft}
                    onChangeText={(t) => setBioDraft(t.slice(0, 150))}
                    multiline
                    autoFocus
                    editable={!bioSaving}
                    maxLength={150}
                  />
                  <View style={styles.bioEditActions}>
                    <Text style={styles.profileSubtle}>{bioDraft.length}/150</Text>
                    {bioSaving ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <View style={{ flexDirection: "row", gap: 16 }}>
                        <TouchableOpacity onPress={saveBio}>
                          <Ionicons name="checkmark" size={20} color={GOOD} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            setEditingBio(false);
                            setBioDraft(authUser.bio || "");
                            setBioError(null);
                          }}
                        >
                          <Ionicons name="close" size={20} color="#FF6B6B" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setEditingBio(true)}>
                  <Text style={authUser.bio ? styles.bioText : styles.bioPlaceholder}>
                    {authUser.bio || "Add a bio"}
                  </Text>
                </TouchableOpacity>
              )}
              {!!bioError && <Text style={styles.fieldError}>{bioError}</Text>}
            </View>
          </View>
        )}

        {/* ---------- App section ---------- */}
        <SectionTitle>App</SectionTitle>
        <View style={styles.card}>
          <SettingsRow
            icon="information-circle-outline"
            title="App version"
            subtitle={Platform.OS === "ios" ? "iOS" : "Android"}
            right={<Text style={styles.rowValue}>{APP_VERSION}</Text>}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="cloud-download-outline"
            title="Update channel"
            subtitle={
              !runningInfo.isEmbedded && runningInfo.createdAt
                ? `Applied ${new Date(runningInfo.createdAt).toISOString().slice(0, 10)}`
                : undefined
            }
            right={
              <Text style={styles.rowValue}>
                {runningInfo.isEmbedded ? "Built-in" : "OTA active"}
              </Text>
            }
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="refresh-outline"
            title="Check for updates"
            subtitle={status === "checking" ? "Checking..." : "Make sure you're on the latest build"}
            onPress={status === "checking" || status === "downloading" ? undefined : runCheck}
            right={
              status === "checking" ? (
                <ActivityIndicator color={ACCENT} size="small" />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={MUTED} />
              )
            }
          />
        </View>

        {status === "upToDate" && (
          <View style={styles.statusCard}>
            <Text style={styles.statusGood}>You're up to date.</Text>
          </View>
        )}

        {status === "error" && (
          <View style={styles.statusCard}>
            <Text style={styles.statusBad}>{error}</Text>
          </View>
        )}

        {status === "available" && (
          <View style={styles.statusCard}>
            <Text style={styles.statusGood}>An update is available.</Text>
            <TouchableOpacity style={styles.actionButton} onPress={downloadUpdate}>
              <Text style={styles.actionButtonText}>Download Update</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === "downloading" && (
          <View style={styles.statusCard}>
            <ActivityIndicator color="#fff" />
            <Text style={[styles.rowSubtitle, { marginTop: 8, textAlign: "center" }]}>Downloading...</Text>
          </View>
        )}

        {status === "ready" && (
          <View style={styles.statusCard}>
            <Text style={styles.statusGood}>Update downloaded.</Text>
            <Text style={styles.rowSubtitle}>Restart the app now to apply it.</Text>
            <TouchableOpacity style={styles.actionButton} onPress={applyUpdate}>
              <Text style={styles.actionButtonText}>Restart & Apply</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ---------- Preferences section - visible per the mockup, but not
             wired to anything real yet. Disabled + "Coming soon" instead of
             a toggle that silently does nothing. No Dark Mode row - this
             app doesn't have a light theme to switch to. ---------- */}
        <SectionTitle>Home</SectionTitle>
        <View style={styles.card}>
          <SettingsRow
            icon="image-outline"
            title="Home background"
            subtitle="Set a picture or video behind Home"
            onPress={() => setShowBgPicker(true)}
            right={<Ionicons name="chevron-forward" size={18} color={MUTED} />}
          />
        </View>

        <SectionTitle>Widget</SectionTitle>
        <View style={styles.card}>
          <SettingsRow
            icon="color-palette-outline"
            title="Customize widget"
            subtitle="Colors, background, layout"
            onPress={() => setShowWidgetCustomize(true)}
            right={<Ionicons name="chevron-forward" size={18} color={MUTED} />}
          />
        </View>

        <SectionTitle>Preferences</SectionTitle>
        <View style={styles.card}>
          <SettingsRow
            icon="notifications-outline"
            title="Notifications"
            subtitle="Coming soon"
            disabled
            right={
              <Switch value={false} disabled trackColor={{ false: GLASS_BORDER, true: ACCENT }} />
            }
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="globe-outline"
            title="Language"
            subtitle="Coming soon"
            disabled
            right={<Text style={styles.rowValueMuted}>English</Text>}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="shield-checkmark-outline"
            title="Privacy"
            subtitle="Coming soon"
            disabled
            right={<Ionicons name="chevron-forward" size={18} color={MUTED} />}
          />
        </View>

        {authUser && (
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={() => {
              Alert.alert("Sign Out", "Are you sure you want to sign out?", [
                { text: "Cancel", style: "cancel" },
                { text: "Sign Out", style: "destructive", onPress: onSignOutPress },
              ]);
            }}
          >
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.versionFooter}>Version {APP_VERSION}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0B0B0D" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "700" },

  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

  // ---------- Profile card ----------
  profileCard: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 18,
    padding: 18,
    marginBottom: 24,
  },
  profileLabel: {
    color: "rgba(232,166,98,0.75)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  profileName: { color: "#fff", fontSize: 22, fontWeight: "800", marginTop: 4 },
  profileSubtle: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 4 },

  profileRow: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 10 },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholder: {
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPlaceholderText: { color: "#fff", fontSize: 24, fontWeight: "700" },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarRing: {
    borderWidth: 2,
    borderColor: "rgba(232,166,98,0.55)",
    borderRadius: 36,
    padding: 3,
  },
  avatarBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#0B0B0D",
  },
  profileInfo: { flex: 1 },

  editRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  editInput: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    borderBottomWidth: 1,
    borderBottomColor: ACCENT,
    paddingVertical: 2,
    flex: 1,
  },
  fieldError: { color: DESTRUCTIVE, fontSize: 12, marginTop: 4 },

  bioBlock: { marginTop: 14 },
  bioText: { color: "rgba(255,255,255,0.9)", fontSize: 14, lineHeight: 20 },
  bioPlaceholder: { color: "rgba(255,255,255,0.4)", fontSize: 14, fontStyle: "italic" },
  bioInput: {
    fontSize: 14,
    fontWeight: "400",
    minHeight: 60,
    textAlignVertical: "top",
  },
  bioEditActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },

  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 8,
  },
  accountTypeBadge: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: "hidden",
  },
  verifiedBadge: {
    color: "#B983FF",
    fontSize: 11,
    fontWeight: "700",
    backgroundColor: "rgba(185,131,255,0.15)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: "hidden",
  },
  verifiedBadgeCyan: {
    color: "#4FD8E8",
    backgroundColor: "rgba(79,216,232,0.15)",
  },

  // ---------- Sectioned list (mockup pattern) ----------
  sectionTitle: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
    marginLeft: 4,
  },
  card: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 18,
    marginBottom: 16,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowDisabled: { opacity: 0.5 },
  rowDivider: { height: 1, backgroundColor: GLASS_BORDER, marginLeft: 68 },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "rgba(232,166,98,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowTitle: { color: "#fff", fontSize: 15, fontWeight: "600" },
  rowSubtitle: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 },
  rowValue: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600" },
  rowValueMuted: { color: MUTED, fontSize: 13, fontWeight: "600" },

  // ---------- Status cards (OTA flow feedback) ----------
  statusCard: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  statusGood: { color: GOOD, fontSize: 15, fontWeight: "700" },
  statusBad: { color: "#FF6B6B", fontSize: 14, fontWeight: "600" },
  actionButton: {
    backgroundColor: ACCENT,
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  actionButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  signOutButton: {
    backgroundColor: "rgba(232,101,79,0.15)",
    borderWidth: 1,
    borderColor: "rgba(232,101,79,0.4)",
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  signOutButtonText: { color: DESTRUCTIVE, fontWeight: "700", fontSize: 15 },

  versionFooter: {
    textAlign: "center",
    color: "rgba(255,255,255,0.3)",
    fontSize: 11,
    marginTop: 18,
  },
});
