// ---------------------------------------------------------------------------
// Share + friend-request calls for the Share feature (username lookup,
// send friend request, list accepted friends, send/receive shared tracks).
// Mirrors apiClient.js's gatewayFetch/authedHeaders pattern.
// ---------------------------------------------------------------------------

import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE, authedHeaders } from "./apiClient";

const AUTH_STORAGE_KEY = "b24_auth";

export async function getCurrentUser() {
  const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

// Finds a user by username or full handle. Returns the profile object,
// or null if no such user exists. Does NOT tell you if you're friends -
// that's checked separately (are_friends) at share-send time.
export async function lookupUsername(username) {
  const params = new URLSearchParams({ username });
  const res = await fetch(`${API_BASE}/api/db/users/lookup?${params.toString()}`, {
    headers: await authedHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "Lookup failed");
  return data.data; // profile object or null
}

// Sends a friend request to a username. Backend handles "already sent",
// "already friends" etc as errors - surface data.error to the UI as-is.
export async function sendFriendRequest(userId, friendUsername) {
  const res = await fetch(`${API_BASE}/api/db/friends/request`, {
    method: "POST",
    headers: await authedHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ user_id: userId, friend_username: friendUsername }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "Failed to send friend request");
  return data.data;
}

// Accepted friends only - this is the Inbox screen's friend list.
export async function listFriends(userId) {
  const res = await fetch(`${API_BASE}/api/db/friends/list/${userId}`, {
    headers: await authedHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load friends");
  return data.data || [];
}

// Tracks shared TO this user. unseenOnly=true is what drives the green dot.
export async function getShareInbox(userId, { unseenOnly = false, app = "music" } = {}) {
  const params = new URLSearchParams({ app, unseen_only: String(unseenOnly) });
  const res = await fetch(`${API_BASE}/api/db/shares/inbox/${userId}?${params.toString()}`, {
    headers: await authedHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load inbox");
  return data.data || [];
}

export async function markSharesSeen(userId, shareIds) {
  if (!shareIds.length) return;
  const res = await fetch(`${API_BASE}/api/db/shares/seen`, {
    method: "POST",
    headers: await authedHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ user_id: userId, share_ids: shareIds }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "Failed to mark shares seen");
  return data.data;
}

// --- share_thread patch marker ---
// Full share history with one friend, both directions (sent + received),
// oldest first. Each item carries a "direction" field ("sent"/"received")
// relative to userId, set server-side.
export async function getShareThread(userId, friendId, { app = "music" } = {}) {
  const params = new URLSearchParams({ app });
  const res = await fetch(
    `${API_BASE}/api/db/shares/thread/${userId}/${friendId}?${params.toString()}`,
    { headers: await authedHeaders() }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load share thread");
  return data.data || [];
}

// Sends a track to a friend. Backend rejects with "not_friends" (403)
// if the two users aren't accepted friends - surface that specifically
// so the UI can show "You need to be friends to share".
// Pending friend requests sent TO this user (where they are the recipient).
export async function getPendingRequests(userId) {
  const res = await fetch(`${API_BASE}/api/db/friends/pending/${userId}`, {
    headers: await authedHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load pending requests");
  return data.data || [];
}

// Accept or decline a friend request. action = "accept" or "decline".
export async function respondToFriendRequest(userId, requesterId, action) {
  const res = await fetch(`${API_BASE}/api/db/friends/respond`, {
    method: "POST",
    headers: await authedHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      user_id: userId,
      requester_id: requesterId,
      action: action, // "accept" or "decline"
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `Failed to ${action} request`);
  return data.data;
}

/* pending_requests_patch */
export async function sendShare(fromUserId, toUserId, item) {
  const res = await fetch(`${API_BASE}/api/db/shares/send`, {
    method: "POST",
    headers: await authedHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      from_user: fromUserId,
      to_user: toUserId,
      app: "music",
      item_type: item.item_type || "track",
      item_id: item.item_id,
      item_meta: item.item_meta || null,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 403 && data.error === "not_friends") {
    const err = new Error("not_friends");
    err.code = "not_friends";
    throw err;
  }
  if (!res.ok || !data.ok) throw new Error(data.error || "Failed to send share");
  return data.data;
}
