# Obsidian mission progress log

**Last updated:** 2026-11-01
**Status:** Discovery, first-pass audit, authorized local hardening, and local validation complete for this pass; mission remains open on critical security, provenance, native-build, provider-terms, and release blockers.

## Completed

- Mapped the current Expo/React Native app in `~/B24music_new` and the nearby gateway, API-cache, database, download/extractor, and OTA source checkouts.
- Read project rules and project memory; avoided the separate Obsidian OS project.
- Preserved pre-existing uncommitted app edits in `App.js`, `FullscreenVideoPlayer.js`, and `usePlaybackEngine.js`.
- Verified effective Expo public config: Obsidian, version/runtime 1.2.0, arm64-only Android target.
- Traced first-launch/account, search, local media, playback, download, lyrics, error reporting, and update flows.
- Confirmed current source still references the downloads service routes and `B24_DOWNLOADS_SERVICE_URL`.
- Performed unauthenticated HTTP probes: gateway `/ping` 200; API-cache `/` 200; gateway `/health` exceeded 12 seconds; guessed extractor hostname 404 (not treated as configured host).
- Added `B24music_new/README.md` and operations reports under this directory.
- Researched primary YouTube and Spotify policy pages; documented the need for a provider/rights review before public claims or promotion.
- Updated `otaClient.js` to abort a stalled native-update request after 15 seconds, using the existing shared `fetchWithTimeout` helper.
- Checked current Reddit community rules; identified `r/droidappshowcase` as the appropriate showcase candidate and documented its APKPure listing/direct-APK link distinction.
- Compared public GitHub branch `HEAD`/`main` read-only with local base; both point to `f5db4622d96706c9b7ee84838287f3b7d0656f16`.
- Found the existing public workflow publishes a signed APK on every push to `main`. Changed the local workflow to run config/JS validation on pushes and require `workflow_dispatch` with `publish_release=true` for signed publishing; scoped `contents: write` to the release job and added a tracked-signing-material release guard. This change is local only; public GitHub remains on the unsafe version until approval and push.
- Changed `SearchScreen.js` to time out remote calls after 20 seconds, ignore stale search responses, and disclose partial source outages instead of showing them as empty results.
- No production changes, credential use/rotation, source push, APK build/sign/upload, OTA publish, or public posts.
- Confirmed current `origin/main` remains `f5db4622d96706c9b7ee84838287f3b7d0656f16`; local work is not published. The root source repo still has no test or lint scripts in `package.json`.
- Fresh `npm audit --offline --json` reported zero advisories from stale cached data. Registry-backed `npm audit --json` reported 26 advisories initially (3 high, 21 moderate, 2 low). A verified Metro 0.84.5 patch-line override updated the complete Metro family without `--force`, removing `image-size`; live audit now reports 25 (2 high, 21 moderate, 2 low). Remaining high findings are Expo SDK 57 CLI/Zod advisories; Expo's official compatibility table maps SDK 57 to RN 0.86 / React 19.2.3 and SDK 58 to RN 0.88 / React 19.3.0, so that major migration needs coordinated native compatibility testing. `npm audit fix --dry-run` ended without a result; no forced upgrade was used.
- `npx expo install --check` first found 16 Expo SDK 57 patch versions behind recommendation. `npx expo install --fix` applied Expo's compatible package set without `--force`; the follow-up check passed with “Dependencies are up to date”. Post-update live audit remained 25 advisories.
- Set `expo.android.package` to `com.anonymous.b24sound` based on the owner-provided APKPure package URL; `expo config --type prebuild --json` resolves that identity, version 1.2.0, runtime 1.2.0, and 16 Android permissions. Submitted APK signer and versionCode remain unverified.
- Expo native prebuild completed. Generated Gradle identity is `com.anonymous.b24sound`, versionName `1.2.0`, default versionCode `1`; submitted versionCode remains unknown. Prebuild initially found `userInterfaceStyle: light` without `expo-system-ui`; installed SDK 57-compatible `expo-system-ui@~57.0.4`, then compatibility check, prebuild, and export all passed. The generated monochrome `notification_icon.xml` exists and parses as a vector; the media-control plugin still emits a generic manual-icon warning despite generating the XML. Final `npm ci` after this dependency addition passed, installing 615 packages.
- Generated Android manifest inspection found additional entries beyond `app.json`, including `SYSTEM_ALERT_WINDOW`, `WAKE_LOCK`, `VIBRATE`, network state, duplicate foreground-service permissions, and optional `android.software.live_wallpaper`. `SYSTEM_ALERT_WINDOW` also appears in the main manifest; whether the release merged manifest retains it is unverified because Android SDK/Gradle are unavailable. Do not remove until its source and release effect are confirmed.
- `npm ci` passed after the Expo SDK 57 patch set and again after adding `expo-system-ui`; the final run installed 615 packages. Final `npx expo install --check` reported “Dependencies are up to date”; final Android JS export passed with 1,445 modules.
- Changed the login screen's misleading guest action to “Continue with Guest Profile” and added an explicit note that a profile is created on Obsidian's service. The account provisioning behavior remains intact.
- Made the Android package ID explicit and consistent with the owner-provided distribution identifier; no versionCode was guessed.
- Expo prebuild updated the package scripts to `expo run:android` / `expo run:ios`, matching the native prebuild workflow; local execution remains unavailable without Android SDK / Xcode toolchains.
- Removed `release.keystore` and `keystore_base64.txt` from the Git index while preserving both local files. `git ls-files` no longer reports those paths. This prepares future source commits but does not purge public Git history or rotate the key; the issue remains critical.
- Added a push-triggered CI APK artifact job: it runs after config/bundle validation, builds an arm64 debug-signed APK with a run-specific versionCode, and retains the artifact for 14 days. Production signing/public release remains behind a manual workflow dispatch and the production-release environment. The CI APK cannot update an APK signed by a different key.
- Copied the operations architecture, audit, release, product positioning, marketing, analytics, discovery, and progress documents into `docs/operations/` so the requested project deliverables can be versioned with the source.

## Findings requiring owner/security action

- Hard-coded gateway key in mobile source.
- Signing material remains in the public repository's Git history and local working files; assume exposed until signer verification and a key-compromise response.
- Release APK and APKPure approval/build metadata unavailable, so binary provenance cannot be compared.
- Downloads route/deployment status not verified; source still references it.
- API-cache auth hook disabled in source; audit route-specific controls and the deployed revision.
- Provider rights and terms review incomplete for Spotify/YouTube and all other catalog sources.

## Current changes made by this agent

- Added root `README.md` in the app source repo.
- Created `obsidian-operations/reports/initial-discovery.md`.
- Created `obsidian-operations/architecture/system-map.md`.
- Created `obsidian-operations/technical-audit/findings.md`.
- Created `obsidian-operations/release/readiness.md`.
- Created `obsidian-operations/reports/product-positioning.md`.
- Created `obsidian-operations/marketing/zero-budget-campaign.md`.
- Created `obsidian-operations/analytics/measurement-and-retention.md`.
- Modified `B24music_new/otaClient.js` to bound the native update check.
- Modified `B24music_new/fetchWithTimeout.js` so request deadlines cover response-body consumption, including JSON parsing, and caller cancellation is propagated.
- Modified `B24music_new/SearchScreen.js` for bounded, race-safe, cancellable, partial-result search handling; superseded, cleared, or unmounted searches are aborted.
- Updated the existing local `B24music_new/usePlaybackEngine.js` work so source replacement considers both URI and media type and same-URI video entries update the active resume identity.
- Changed `B24music_new/errorReporter.js` to require diagnostics opt-in and send only an allowlisted error class plus app/OS/screen/fatal metadata; added the user control in `SettingsScreen.js`.
- Added SDK-matched `expo-secure-store` and `B24music_new/authStorage.js`; JWTs are stored in SecureStore while profile data remains in AsyncStorage. Login, startup, API headers, share, sync, profile updates, and logout now use the auth-storage abstraction. Legacy plaintext tokens migrate on read and fail closed if secure storage cannot be used.
- Modified `.github/workflows/build.yml` to separate push validation from manually approved signed releases.
- Modified `.gitignore` to ignore keystore files and the base64 signing-key export going forward; removed these paths from the local Git index while keeping them on disk. History cleanup and signing-key migration remain outstanding.
- Added compatible Expo SDK 57 patch versions through Expo's installer, `expo-system-ui@~57.0.4`, and Metro 0.84.5 overrides for the package family in `package.json`; Metro 0.84.5 release notes state that this patch replaces the `image-size` dependency with vendored parsers. Final `npm ci`, Expo compatibility check, Android JS export, and native prebuild passed.

## Next steps

1. Resolve owner-approved gateway key and signing-material incident; do not push history cleanup without authorization.
2. Review and approve the local release-workflow correction before any main-branch push; configure GitHub release-environment required reviewers.
3. Verify deployed gateway service map and download/extractor status using authenticated owner tooling.
4. Obtain APKPure submitted APK/metadata and compare package/version/signing/build provenance to source.
5. Complete provider terms/legal review and privacy disclosures.
6. Run a physical Android smoke-test matrix; current shell validation cannot prove playback or install behavior.
7. Add privacy-reviewed minimal aggregate analytics and deterministic tests/lint.
8. Publish README/campaign only after security, provenance, listing, and approval gates are met.

## Validation run

- Expo public config: **passed** (`expo config --type public --json`).
- Expo prebuild config: **passed** after package ID update (`com.anonymous.b24sound`, version/runtime 1.2.0, 16 permissions).
- Expo SDK compatibility check: **passed** after `npx expo install --fix`.
- Live npm audit after Metro, Expo SDK patch updates, and `expo-system-ui`: **25 advisories** (2 high, 21 moderate, 2 low; no critical). `npm ci` also completed and reported the same count. Offline audit is not reliable here because its cached advisory DB reported zero.
- Android bundle after Expo SDK patch updates and again after `expo-system-ui` plus final `npm ci`: **passed**, 1,445 modules. Expo Android native prebuild after `expo-system-ui`: **passed** and generated the expected package/version identity; notification icon vector exists and is well-formed.
- Babel syntax parse of `App.js`, `FullscreenVideoPlayer.js`, `usePlaybackEngine.js`, and `otaClient.js`: **passed**.
- Babel syntax parse of `SearchScreen.js`: **passed**; a one-off behavioral check confirmed `fetchWithTimeout` resolves a normal response and aborts a stalled request.
- After extending timeout coverage and adding caller cancellation, Babel syntax checks and focused success/stalled-body/caller-abort behavioral checks: **passed**. Workflow YAML parse and `git diff --check`: **passed**.
- Diagnostics runtime check: **passed** for default-off behavior, enabling/disabling consent, and excluding raw exception message/stack values from sent payloads. Current UI still needs Android device/accessibility review.
- Auth-storage mock check: **passed** for legacy migration/removal of plaintext, profile update while preserving secure token, logout, and SecureStore-unavailable fail-closed behavior. Expo config resolves the SecureStore plugin and Android JS bundle includes the native module integration; actual keychain/Keystore behavior still needs physical-device validation.
- Re-exported the current Android JavaScript bundle after timeout, cancellation, playback source-transition, and diagnostics-consent changes to `/data/data/com.termux/files/home/obsidian-validation-diagnostics-consent`; Metro bundled 1,442 modules successfully. This remains a JS bundle, not an APK or device test.
- Final Babel parse of `App.js`, `FullscreenVideoPlayer.js`, `SearchScreen.js`, `usePlaybackEngine.js`, `otaClient.js`, `fetchWithTimeout.js`, `SettingsScreen.js`, and `errorReporter.js`: **passed**. Final workflow release-gate assertions and `git diff --check`: **passed**.
- Android JS bundle: **passed** with `expo export --platform android --no-bytecode --no-minify --max-workers 4`; Metro bundled 1,442 modules into a fresh directory under the workspace. This is not an APK/native build.
- GitHub Actions YAML parsed; assertions verified pushes validate only, manual `publish_release=true` is required for release, and write permission is limited to that job. No GitHub workflow execution occurred.
- Default Hermes bytecode export: **blocked by host tooling** (`Unsupported host platform for Hermes compiler: android` in Termux); the no-bytecode export succeeded.
- `git diff --check`: **passed**.
- Final package diff reviewed for SDK-compatible version changes, Metro 0.84.5 overrides, explicit Android package ID, and the guest disclosure. Expo prebuild's native run script changes are noted above. No package secret values were inspected or copied.
- JavaScript test/lint scripts: **not configured** in `package.json`.
- Android SDK directory is empty in this Termux environment, with no `sdkmanager` or standalone `gradle`; adb reports no attached device. Android APK build/install/device tests are therefore **not run**. No signed release was built, and no submitted artifact is available.
- Source vs submitted APK match: **not established**.
- Public release approval: **not independently verified**.
