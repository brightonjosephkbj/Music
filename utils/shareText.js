// One place for the link and the message wording.
// If your website changes, edit APP_LINK only.
export const APP_LINK = "https://b24j.top";

// Message for sharing a song outside the app.
// artist is optional, since not every track has one.
export function songShareMessage(title, artist) {
  const who = artist ? ` by ${artist}` : "";
  return `Listening to "${title}"${who} on Obsidian 🎵\nGet the app: ${APP_LINK}`;
}

// Message for sharing a playlist (kind: "playlist" or "group playlist").
export function playlistShareMessage(name, kind = "playlist") {
  return `Check out my ${kind}: ${name} on Obsidian 🎵\nGet the app: ${APP_LINK}`;
}
