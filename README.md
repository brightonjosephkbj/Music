# Obsidian

Obsidian is an Android focused music and media app built with React Native and Expo. It brings device media, music discovery, playback, lyrics, playlists, and saved downloads together in one interface. Online catalog and extraction availability depends on the configured providers and services.

The app source is maintained in the [Obsidian GitHub repository](https://github.com/brightonjosephkbj/Music). B24 Music is the internal service and project identity; Obsidian is the product name.

## Current status

This repository is active development source, not a download. The project owner reports that APKPure submission is awaiting approval, but that status has not been independently confirmed. No submitted APK was available to match against a source commit; do not treat a local build or JavaScript bundle as an approved public release.

## Main components

- `App.js`, `AppShell.js`, and screen modules: app state, navigation, and user interfaces.
- `usePlaybackEngine.js`, `PlayerCard.js`, and `FullscreenVideoPlayer.js`: audio/video playback and controls.
- `apiClient.js`, `LoginScreen.js`, `authStorage.js`, and `DownloadsContext.js`: gateway requests, account flow, secure session-token storage, and download state.
- `libraryStorage.js`, `localMediaScanner.js`, and `listeningHistory.js`: device library and local listening state.
- `app.json`: Expo configuration, Android permissions, native plugins, and OTA endpoint.

See the local operations workspace for the architecture map, audit findings, release checklist, and campaign materials.

## Development

Install the locked dependencies with `npm ci`, then run `npm start` to launch Expo. The project currently defines start commands only; it does not define automated test or lint scripts.

Native behavior (background audio, widgets, media-library access, installation updates, and live wallpaper) requires an Android development or release build. Expo web/preview execution does not validate those native integrations.

## Distribution and privacy

The application depends on remote gateway, database, API-cache, download, and extraction services. Availability can vary. Review service terms, music distribution rights, runtime permissions, privacy disclosures, signing provenance, and account security before promoting a public install.

The current source tree includes optional error diagnostics, off until enabled in Settings. When enabled, reports contain the app/OS version, current screen, an allowlisted error class, and whether the error was fatal; raw messages, stack traces, account data, and listening activity are not included. This describes the current source, not an APK whose contents have not been verified.

Guest access creates a profile on Obsidian's service; it is not an anonymous local-only mode. The login screen explains this before users continue.

Do not commit signing material, API credentials, production configuration, or user data to source control. Do not use this development repository as evidence that a matching APK has been submitted or approved.
