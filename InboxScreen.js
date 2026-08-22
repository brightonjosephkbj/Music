// ---------------------------------------------------------------------------
// InboxScreen — friends you can share tracks with, plus a slide-up sheet
// to look up a username and send a friend request. People only appear in
// the friends list once they ACCEPT the request (are_friends/list_friends
// both require status='accepted') - this screen doesn't add them instantly.
// ---------------------------------------------------------------------------

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Animated,
  Dimensions,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getCurrentUser,
  listFriends,
  lookupUsername,
  sendFriendRequest,
  getPendingRequests,
  respondToFriendRequest,
} from "./shareClient"; /* inbox_pending_patch */

const AMBER = "#E8A662";
const BG = "#0B0B0D";
const CARD_BG = "rgba(255,255,255,0.06)";
const BORDER = "rgba(255,255,255,0.10)";
const { height: SCREEN_H } = Dimensions.get("window");

function Avatar({ letter, url, size = 44 }) {
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View
      style={[
        styles.avatarFallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={styles.avatarLetter}>{(letter || "?").toUpperCase()}</Text>
    </View>
  );
}

export default function InboxScreen({ onFriendPress, onBack }) { /* inbox_props_patch */
  const [user, setUser] = useState(null);
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [respondingToId, setRespondingToId] = useState(null);

  const loadFriends = useCallback(async (userId) => {
    try {
      const list = await listFriends(userId);
      setFriends(list);
      const pending = await getPendingRequests(userId);
      setPendingRequests(pending);
    } catch (e) {
      console.warn("Failed to load friends:", e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      setUser(u);
      if (u?.id) await loadFriends(u.id);
      else setLoading(false);
    })();
  }, [loadFriends]);

  const handleFriendAdded = () => {
    if (user?.id) loadFriends(user.id);
  };

  const handleRespondRequest = async (requesterId, action) => {
    if (!user?.id) return;
    setRespondingToId(requesterId);
    try {
      await respondToFriendRequest(user.id, requesterId, action);
      await loadFriends(user.id);
    } catch (e) {
      console.warn(`Failed to ${action} request:`, e.message);
    } finally {
      setRespondingToId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginRight: 12 }}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
        )}
        <Text style={[styles.headerTitle, { flex: 1 }]}>Inbox</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setSheetOpen(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="add" size={26} color={BG} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={AMBER} />
        </View>
      ) : pendingRequests.length === 0 && friends.length === 0 ? (
        <View style={styles.centerFill}>
          <Text style={styles.emptyText}>You don't have friends or pending requests</Text>
        </View>
      ) : (
        <FlatList
          data={pendingRequests.length > 0 ? [...pendingRequests, { _separator: true }, ...friends] : friends}
          keyExtractor={(item, idx) => item._separator ? "separator" : String(item.id)}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => {
            if (item._separator) {
              return friends.length > 0 ? (
                <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: 8 }} />
              ) : null;
            }
            if (pendingRequests.some((r) => r.id === item.id)) {
              return (
                <View style={[styles.friendRow, styles.pendingRow]}>
                  <Avatar letter={item.avatar_letter} url={item.avatar_url} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={styles.friendName}>{item.username}</Text>
                    <Text style={styles.friendHandle}>{item.handle}</Text>
                    <Text style={styles.pendingLabel}>Wants to be your friend</Text>
                  </View>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.acceptButton]}
                      onPress={() => handleRespondRequest(item.id, "accept")}
                      disabled={respondingToId === item.id}
                    >
                      {respondingToId === item.id ? (
                        <ActivityIndicator color={AMBER} size="small" />
                      ) : (
                        <Ionicons name="checkmark" size={16} color={AMBER} />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.declineButton]}
                      onPress={() => handleRespondRequest(item.id, "decline")}
                      disabled={respondingToId === item.id}
                    >
                      <Ionicons name="close" size={16} color="#FF6B6B" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }
            return (
            <TouchableOpacity
              style={styles.friendRow}
              onPress={() => onFriendPress?.(item)}
            >
              <Avatar letter={item.avatar_letter} url={item.avatar_url} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.friendName}>{item.username}</Text>
                <Text style={styles.friendHandle}>{item.handle}</Text>
              </View>
            </TouchableOpacity>
              );
          }}
        />
      )}

      <AddFriendSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        currentUserId={user?.id}
        onFriendRequestSent={handleFriendAdded}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Bottom sheet: username input -> live lookup -> found (Add Friend) /
// not found ("doesn't exist") / error (network/server failure, distinct
// from not-found so a dropped connection doesn't look like a bad username).
// Slides up from the bottom as a white card.
// ---------------------------------------------------------------------------
function AddFriendSheet({ visible, onClose, currentUserId, onFriendRequestSent }) {
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState("idle"); // idle | searching | found | notfound | error
  const [result, setResult] = useState(null);
  const [sendState, setSendState] = useState("idle"); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState("");
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const debounceRef = useRef(null);

  // Clear any pending debounced lookup if the sheet unmounts mid-search,
  // so we never call setState on an unmounted component.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (visible) {
      setUsername("");
      setStatus("idle");
      setResult(null);
      setSendState("idle");
      setErrorMsg("");
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
    } else {
      // Sheet is closing - also cancel any in-flight debounce so a stale
      // lookup can't resolve after the sheet is gone.
      if (debounceRef.current) clearTimeout(debounceRef.current);
      Animated.timing(slideAnim, {
        toValue: SCREEN_H,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const runLookup = useCallback((text) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setStatus("idle");
      setResult(null);
      return;
    }
    setStatus("searching");
    debounceRef.current = setTimeout(async () => {
      try {
        const found = await lookupUsername(text.trim());
        if (found) {
          setResult(found);
          setStatus("found");
        } else {
          // Lookup succeeded, backend confirmed no such user.
          setResult(null);
          setStatus("notfound");
        }
      } catch (e) {
        // Lookup itself failed (network/server) - do NOT say "doesn't
        // exist", that's a lie. Show a distinct, retryable error state.
        setResult(null);
        setStatus("error");
      }
    }, 400);
  }, []);

  const handleChangeText = (text) => {
    setUsername(text);
    setSendState("idle");
    setErrorMsg("");
    runLookup(text);
  };

  const handleAddFriend = async () => {
    if (!result || !currentUserId) return;
    setSendState("sending");
    setErrorMsg("");
    try {
      await sendFriendRequest(currentUserId, result.username);
      setSendState("sent");
      onFriendRequestSent?.();
    } catch (e) {
      setSendState("error");
      setErrorMsg(e.message || "Failed to send request");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.sheetBackdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <Animated.View
        style={[styles.sheetCard, { transform: [{ translateY: slideAnim }] }]}
      >
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>Add a friend</Text>

        <TextInput
          style={styles.usernameInput}
          placeholder="Enter username"
          placeholderTextColor="#9A9A9A"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={handleChangeText}
        />

        <View style={styles.resultArea}>
          {status === "searching" && (
            <ActivityIndicator color={AMBER} style={{ marginTop: 12 }} />
          )}

          {status === "notfound" && (
            <Text style={styles.notFoundText}>Doesn't exist</Text>
          )}

          {status === "error" && (
            <TouchableOpacity onPress={() => runLookup(username)}>
              <Text style={styles.errorText}>
                Couldn't check that username. Tap to retry.
              </Text>
            </TouchableOpacity>
          )}

          {status === "found" && result && (
            <View style={styles.foundRow}>
              <Avatar letter={result.avatar_letter} url={result.avatar_url} size={40} />
              <Text style={styles.foundName}>{result.username}</Text>

              {sendState === "sent" ? (
                <Text style={styles.sentText}>Request sent</Text>
              ) : (
                <TouchableOpacity
                  style={styles.addFriendButton}
                  onPress={handleAddFriend}
                  disabled={sendState === "sending"}
                >
                  {sendState === "sending" ? (
                    <ActivityIndicator color={BG} size="small" />
                  ) : (
                    <Text style={styles.addFriendButtonText}>Add Friend</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          {sendState === "error" && (
            <Text style={styles.notFoundText}>{errorMsg}</Text>
          )}

          {sendState === "sent" && (
            <Text style={styles.pendingHint}>
              They'll appear in your Inbox once they accept.
            </Text>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  headerTitle: { color: "#fff", fontSize: 24, fontWeight: "700" },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AMBER,
    alignItems: "center",
    justifyContent: "center",
  },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#8A8A8E", fontSize: 15 },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  friendName: { color: "#fff", fontSize: 16, fontWeight: "600" },
  friendHandle: { color: "#9A9A9E", fontSize: 13, marginTop: 2 },
  avatarFallback: {
    backgroundColor: "rgba(232,166,98,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { color: AMBER, fontWeight: "700" },

  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheetCard: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 32,
    minHeight: 260,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    marginBottom: 14,
  },
  usernameInput: {
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111",
    backgroundColor: "#FAFAFA",
  },
  resultArea: { marginTop: 14, minHeight: 60 },
  notFoundText: { color: "#D14343", fontSize: 14, marginTop: 8 },
  errorText: { color: "#B25E00", fontSize: 14, marginTop: 8, textDecorationLine: "underline" },
  foundRow: { flexDirection: "row", alignItems: "center" },
  foundName: {
    marginLeft: 10,
    fontSize: 15,
    fontWeight: "600",
    color: "#111",
    flex: 1,
  },
  addFriendButton: {
    backgroundColor: AMBER,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
  },
  addFriendButtonText: { color: "#0B0B0D", fontWeight: "700", fontSize: 13 },
  sentText: { color: "#3AA76D", fontWeight: "600", fontSize: 13 },
  pendingHint: { color: "#8A8A8E", fontSize: 12, marginTop: 10 },
  pendingRow: {
    backgroundColor: "rgba(232,166,98,0.08)",
    borderColor: "rgba(232,166,98,0.2)",
  },
  pendingLabel: {
    color: "#E8A662",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptButton: {
    backgroundColor: "rgba(232,166,98,0.2)",
  },
  declineButton: {
    backgroundColor: "rgba(255,107,107,0.2)",
  },
}); /* pending_styles_patch */
