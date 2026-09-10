// ---------------------------------------------------------------------------
// Share + friend-request calls for the Share feature (username lookup,
// send friend request, list accepted friends, send/receive shared tracks).
// Mirrors apiClient.js's gatewayFetch/authedHeaders pattern.
// ---------------------------------------------------------------------------

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
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
  return data.data;
}

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

export async function listFriends(userId) {
  const res = await fetch(`${API_BASE}/api/db/friends/list/${userId}`, {
    headers: await authedHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load friends");
  return data.data || [];
}

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

export async function getPendingRequests(userId) {
  const res = await fetch(`${API_BASE}/api/db/friends/pending/${userId}`, {
    headers: await authedHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load pending requests");
  return data.data || [];
}

export async function respondToFriendRequest(userId, requesterId, action) {
  const res = await fetch(`${API_BASE}/api/db/friends/respond`, {
    method: "POST",
    headers: await authedHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      user_id: userId,
      requester_id: requesterId,
      action: action,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `Failed to ${action} request`);
  return data.data;
}

/* pending_requests_patch */
// item_meta now carries an optional "message" alongside title/artist/
// artwork_url. Folded into item_meta (not a new top-level field) so this
// works with no backend change IF item_meta is already stored as a JSON
// blob column - which is the likely case given how flexible it already is.
// If shares.item_meta is separate DB columns instead, you'll need to add a
// message column and accept it in the /api/db/shares/send route.
export async function sendShare(fromUserId, toUserId, item, message) {
  const res = await fetch(`${API_BASE}/api/db/shares/send`, {
    method: "POST",
    headers: await authedHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      from_user: fromUserId,
      to_user: toUserId,
      app: "music",
      item_type: item.item_type || "track",
      item_id: item.item_id,
      item_meta: {
        ...(item.item_meta || {}),
        ...(message ? { message } : {}),
      },
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

// ---------------------------------------------------------------------------
// Group (collaborative) playlists — backend-owned metadata, real-time via
// Socket.IO direct to B24_Database (not proxied through the gateway).
// ---------------------------------------------------------------------------

export async function createGroupPlaylist(userId, name, memberIds = []) {
  const res = await fetch(`${API_BASE}/api/db/group-playlists/create`, {
    method: "POST",
    headers: await authedHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ name, created_by: userId, member_ids: memberIds }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "Failed to create group playlist");
  return data.data;
}

export async function listGroupPlaylists(userId) {
  const res = await fetch(`${API_BASE}/api/db/group-playlists/list/${userId}`, {
    headers: await authedHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load group playlists");
  return data.data || [];
}

export async function getGroupPlaylistTracks(playlistId) {
  const res = await fetch(`${API_BASE}/api/db/group-playlists/${playlistId}/tracks`, {
    headers: await authedHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load group playlist tracks");
  return data.data || [];
}

export async function addGroupPlaylistTrack(playlistId, userId, track) {
  const res = await fetch(`${API_BASE}/api/db/group-playlists/${playlistId}/tracks/add`, {
    method: "POST",
    headers: await authedHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      added_by: userId,
      title: track.title,
      artist: track.artist,
      duration: track.duration,
      artwork_url: track.artwork_url,
      source_url: track.source_url,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "Failed to add track");
  return data.data;
}

export async function deleteGroupPlaylistTrack(playlistId, trackId, userId) {
  const res = await fetch(`${API_BASE}/api/db/group-playlists/${playlistId}/tracks/${trackId}/delete`, {
    method: "POST",
    headers: await authedHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ user_id: userId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "Failed to remove track");
  return data;
}

export async function getGroupPlaylistMembers(playlistId) {
  const res = await fetch(`${API_BASE}/api/db/group-playlists/${playlistId}/members`, {
    headers: await authedHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load members");
  return data.data || [];
}

export async function updateGroupPlaylist(playlistId, userId, patch) {
  const res = await fetch(`${API_BASE}/api/db/group-playlists/${playlistId}/update`, {
    method: "POST",
    headers: await authedHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ user_id: userId, ...patch }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    const err = new Error(data.error || "Failed to update playlist");
    err.code = data.error;
    throw err;
  }
  return data;
}

// Uploads a local image file to the playlist-art dataset repo, returns a
// public URL. Used for group playlist art so every member sees the same
// image (a local device URI would only work for whoever picked it).
export async function uploadPlaylistArt(localUri) {
  // FileSystem.uploadAsync (not fetch+FormData) - same fix as uploadAvatar
  // in apiClient.js: the picker's URI is often a content:// path on Android
  // that RN's own FormData/fetch layer can't always serialize ("Unsupported
  // FormDataPart implementation"). This is a native multipart uploader
  // purpose-built to handle that correctly.
  const headers = await authedHeaders(); // no Content-Type - native layer sets multipart boundary
  const uploadRes = await FileSystem.uploadAsync(
    `${API_BASE}/api/downloads/files/upload`,
    localUri,
    {
      fieldName: "file",
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      headers,
      parameters: { app_id: "b24music", category: "playlist_art" },
    }
  );
  const data = JSON.parse(uploadRes.body || "{}");
  if (uploadRes.status < 200 || uploadRes.status >= 300 || !data.ok) {
    throw new Error(data.error || "Failed to upload image");
  }
  return data.data.url;
}
