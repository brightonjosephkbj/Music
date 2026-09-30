import { authedHeaders, API_BASE } from "./apiClient";
import { resolveQuery } from "./aiPlaylist";
import {
  getPlaybackState,
  togglePlayback,
  nextTrack,
  prevTrack,
  playTrackFromVoice,
} from "./playbackBridge";

// Typed messages only go through intent detection if they start like a command.
export const CMD_RE = /^\s*(play|pause|resume|stop|skip|next|previous|prev|go back)\b/i;

async function getIntent(text) {
  const res = await fetch(`${API_BASE}/api/apicache/api/ai/joy_intent`, {
    method: "POST",
    headers: await authedHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ text }),
  });
  if (!res.ok) return { action: "chat" };
  return res.json();
}

const isPlaying = () => {
  try {
    return !!getPlaybackState().isPlaying;
  } catch {
    return false;
  }
};

// Returns a reply string if it handled the request, or null to fall back to normal chat.
export async function runJoyIntent(text, { cancelResume } = {}) {
  let intent;
  try {
    intent = await getIntent(text);
  } catch {
    return null;
  }
  const done = () => cancelResume && cancelResume();

  switch (intent.action) {
    case "pause":
      done();
      if (isPlaying()) togglePlayback();
      return "Paused.";
    case "resume":
      done();
      if (!isPlaying()) togglePlayback();
      return "Playing.";
    case "next":
      done();
      nextTrack();
      return "Skipping to the next track.";
    case "previous":
      done();
      prevTrack();
      return "Going back.";
    case "play_song": {
      const q = (intent.query || "").trim();
      if (!q) return null;
      const track = await resolveQuery(q, intent.artist || "");
      done();
      if (!track) return `I couldn't find "${q}".`;
      playTrackFromVoice(track);
      return `Playing ${track.title}${track.artist ? " - " + track.artist : ""}`;
    }
    case "play_playlist":
      done();
      return "Playing saved playlists by voice isn't set up yet.";
    default:
      return null;
  }
}
