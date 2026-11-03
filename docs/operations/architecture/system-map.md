# Obsidian system map

**Status key:** Verified in source = present in inspected local code; Live = observed by an unauthenticated HTTP probe; Unverified = requires deployment access, authenticated checks, a device, or an APK.

## Mobile application

| Component | Files | Responsibility and dependencies | Status / risks |
|---|---|---|---|
| Entry and error boundary | `B24music_new/index.js`, `errorReporter.js`, `Root.js` | Registers Expo root, widget task handler, global JS error reporting, render boundary; Root mounts App and update prompt. | Current local source reports only after opt-in, with app/OS/screen, fatal flag, and an allowlisted error class; raw stack is empty. Backend retention/access controls and behavior of older binaries are unverified. |
| App state and navigation | `App.js`, `AppShell.js`, `HomeScreen.js`, `LibraryScreen.js`, `SearchScreen.js`, screen modules | Owns top-level auth/session, tab/screen state, queue, notification response, update check, and primary user journey. | Verified in source. Navigation is custom state, not a centralized navigation library; regression coverage absent. |
| Account and session | `LoginScreen.js`, `apiClient.js`, `authStorage.js`, AsyncStorage profile key `b24_auth`, SecureStore token key `b24_access_token_v1` | Login/register/forgot-password through gateway `/api/db/users/*`; profile data remains in AsyncStorage and JWT storage uses Expo SecureStore. Legacy plaintext tokens migrate on read; guest mode creates a real backend account, now disclosed in the login UI. | Local source verified; gateway credential remains hard-coded in the client. SecureStore upgrade/device behavior and production auth configuration need device and backend validation. |
| Search and discovery | `SearchScreen.js`, `apiClient.js`, `../Api-cache/music.py`, `../Api-cache/downloads.py` | App sends parallel requests to `/api/apicache/api/music/search` and `/api/downloads/remote/search`; provider search includes Audius, Deezer previews, Jamendo, ccMixter, Spotify metadata/playlist paths, Archive.org, and YouTube/Lightning routes. | Verified in source. Provider availability, terms, geographic behavior, and remote service configuration are unverified. |
| Playback | `usePlaybackEngine.js`, `PlayerCard.js`, `FullscreenVideoPlayer.js`, `audioSettings.js`, `playbackBridge.js`, `TrackPlayerService.js` | `expo-audio` and `expo-video`; track switching, queue, settings, optional video cache/resume, media controls, notification/headset/remote events. | Verified in source; device behavior unverified. Local checkout has unfinished/uncommitted playback changes. |
| Local library and downloads | `localMediaScanner.js`, `libraryStorage.js`, `DownloadsContext.js`, `SearchScreen.js`, `mediaLibrarySave.js` | Scans local audio/video, stores library metadata and playback state locally, downloads resolved media with Expo FileSystem, saves to shared media storage, updates notifications. | Verified in source. Local media permission behavior and Android version compatibility require device tests. App download path depends on gateway service configuration. |
| Lyrics and listening history | `PlayerCard.js`, `lyricsClient.js`, `listeningHistory.js` | Requests lyrics through API-cache and caches them locally; local listening history tracks meaningful plays. | Verified in source. No documented retention controls found during this initial pass. |
| Updates | `app.json`, `useOtaCheck.js`, `otaClient.js`, `App.js`, `src/updater.js` | Expo Updates URL points at API-cache; runtime OTA checks run in `useOtaCheck`; native version check calls gateway via `otaClient`; a separate GitHub release downloader exists at `src/updater.js`. | Multiple independent update paths exist; `src/updater.js` has no caller in bounded source search. Release signing/provenance and backend manifest behavior are unverified. Never publish OTA without approval. |
| Native integrations | `app.json`, `plugins/withLiveWallpaper.js`, `NowPlayingWidget.js`, `widget-task-handler.js`, `notifications.js` | Android media session, widget, notification, camera/location/media-library plugins, wallpaper, install-intent permissions. | Config is verified; install/permission UX and platform policy compliance are unverified. |

## Backend and infrastructure

| Component | Local checkout / paths | Communication path and responsibility | Status / risks |
|---|---|---|---|
| Public API gateway | `../b24-gateway-real/app.py` (remote `brightonjosephkbj/Gateway`) | App sends gateway key to `https://gateway-b0tx.onrender.com`; gateway maps `/api/<service>/...` to environment-configured backing services and forwards user JWT / Expo headers. | `/ping` returned 200. `/health` exceeded the 12 s probe; service registry requires private runtime environment values not inspected. |
| API-cache | `../Api-cache/app.py`, `music.py`, `downloads.py`, `database.py`, `ota.py`, `client_log.py`, `lightning_integration.py` (remote HF Space) | Flask service aggregates music/lyrics/provider routes, file metadata/storage, OTA endpoints, client error logs, and extraction orchestration. The source's global `before_request` auth returns early, while some downloads handlers apply their own internal-secret check. | `/` returned 200. Actual deployed revision and environment configuration unverified. Source has auth-disabled middleware, credential-default patterns, and a legacy downstream downloads URL. |
| User database | `../B24_Database/app.py` plus database modules (remote HF Space) | Gateway `/api/db/*` maps registration, login/JWT, profile, friends, and related APIs to a SQLite-backed user service. | Source verified; production database, backups, availability, auth configuration, and data retention unverified. |
| Downloads/extraction | `../Api-cache/downloads.py`, `../Api-cache/lightning_integration.py`; gateway service name `downloads`; `../Extractor/app.py` | App still requests `/api/downloads/remote/search` and other `/api/downloads/*` paths. API-cache's own download blueprint calls Lightning integration, which selects configured extractor URLs; `music.py` also checks `B24_DOWNLOADS_SERVICE_URL` for YouTube search. | Code references are verified. Whether the separately routed downloads service was shut down, which paths are deployed, and which extractor workers are live are unverified. |
| OTA service | `app.json`, `otaClient.js`, `useOtaCheck.js`, `../Api-cache/ota.py`, `../B24-ota-v2` | Native version check through gateway `/api/apicache/api/ota/app/version`; Expo Updates uses manifest URL on API-cache. | Code path verified; production manifest/version state and signing are unverified. |
| CI and release automation | `.github/workflows/build.yml` | Public `main` at `f5db4622d96706c9b7ee84838287f3b7d0656f16` builds/signs an APK and creates a GitHub Release on each push. Local workflow separates config/JS validation (push) from signed release (manual boolean input); write permission is scoped to the release job. | Remote still has the old workflow. Local signing files were removed from the Git index and preserved on disk; the key remains in Git history. GitHub environment protection is not configured/verified from this workspace. |
| Storage | `../Api-cache/database.py` | SQLite metadata plus file blobs/dataset-backed storage, as documented in source. | Production volume persistence, backup, lifecycle, access policy, and billing unverified. |

## User data flow

1. First launch renders `index.js` → `Root.js` → `App.js`; `errorReporter.js` wraps the app.
2. If no stored session exists, the account screen may register/login or provision a guest account. The guest action now explains that it creates a profile on Obsidian's service. Profile data stays in AsyncStorage; the JWT is stored in Expo SecureStore, with a legacy-token migration.
3. Home/search screens request provider data through the gateway. Search combines the API-cache music query with `/api/downloads/remote/search`.
4. A selected result is passed into the shared playback engine. The engine chooses local URI before remote stream/download URI, then uses Expo audio/video.
5. Local device scanning uses Expo MediaLibrary. Downloads save files to app/shared storage and store metadata locally.
6. Lyrics go through the API-cache lyrics route. Playback history is on-device. App update checks use both Expo Updates and the gateway's native version endpoint.
7. Global JS errors are capped/deduplicated in memory and POSTed to `/api/apicache/api/client_log` with app/device/screen/error/stack fields.

## Operational verification still required

- Authenticated gateway health output for each backing service (never publish its internal values).
- Deployed commit/revision and runtime settings for gateway, API-cache, database, downloads, OTA, and extractor.
- Confirmation whether the old downloads deployment is still active or replaced by the embedded API-cache routes.
- Database/storage backups, quotas, retention, and rollback procedures.
- APK build provenance, package/signature compatibility, and exact relation to the submitted APKPure artifact.
