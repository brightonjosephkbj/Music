# Obsidian release readiness

## Current release state

- **Source:** public GitHub repo `brightonjosephkbj/Music`; local changes are prepared for a source push and CI run. Push status and resulting workflow run must be recorded after execution.
- **Local builds:** no APK found within the accessible app tree. Expo config validation passed; this is not a native build result.
- **Submitted APK:** owner reports APKPure submission awaiting approval. The listing page could not be inspected, so status, version, and approval evidence are unverified here.
- **Publicly approved release:** not confirmed. No public release is claimed.

## Identity and build facts

| Item | Source evidence | Status |
|---|---|---|
| Display name | `app.json`: `Obsidian` | Verified |
| Expo slug | `b24sound` | Verified |
| Version | `1.2.0` | Verified |
| Runtime version | `1.2.0` | Verified |
| Android package | `app.json` now explicitly sets `com.anonymous.b24sound`, matching the package identifier in the owner-provided APKPure URL; Expo prebuild config resolved the same value. | Local source identity is explicit. Inspect the submitted APK and compare signer/package before treating it as the same release. |
| Android versionCode | Not explicitly set in `app.json`; generated prebuild currently defaults to `1` while versionName is `1.2.0`. | Submitted APK code is unknown; do not ship an update until a chosen versionCode is proven greater than the submitted value. |
| Architecture | `arm64-v8a` only in build-properties plugin | Verified; excludes 32-bit ARM and x86 devices |
| Signing | Signing-related files tracked in local public-repo checkout; CI/EAS path and submitted certificate unavailable | Critical verification required |
| Update channels | Expo Updates URL to API-cache plus native check through gateway; separate unused-looking GitHub updater source | Needs one documented policy and compatibility validation |

## Readiness gates

### Release automation — BLOCKED

- The current public commit's workflow publishes a signed APK automatically on every push to `main`.
- The local workflow change makes pushes validate Expo configuration and the JS bundle, then build a debug-signed APK as a 14-day GitHub Actions artifact. This is for CI testing and is not the production-signed APK or a public release; it cannot update a differently signed submitted APK.
- A production-signed build and public GitHub Release still require a manual dispatch with `publish_release=true`.
- The release job uses a `production-release` environment. Configure required reviewers and branch restrictions for that environment in GitHub before relying on it as an approval control.
- The CI artifact workflow has not yet been pushed or run by GitHub. Confirm its result after the source push. Do not execute the release input without explicit release authorization.
- A local guard blocks signing when `release.keystore` or `keystore_base64.txt` remains tracked. Both paths are now removed from the local Git index, with files preserved on disk. The remote history still contains the committed files; this does not remediate public exposure. Verify the submitted APK signer and handle key compromise before any release.

### Security and integrity — BLOCKED

- [ ] Rotate gateway credential; backend accepts short-lived/user-scoped auth and rate limits anonymous endpoints.
- [ ] Confirm/reissue signing key if tracked private material matches submitted signer; preserve upgrade path or plan a new package identity transparently.
- [ ] Remove credentials and signing material from public source and future history through approved change.
- [ ] Confirm API auth, internal service auth, token expiry/revocation, and error-log redaction. Local source now uses Expo SecureStore for JWTs with a legacy AsyncStorage migration; verify this in Android/iOS release builds and the submitted APK before treating installed sessions as protected.
- [ ] Review the local opt-in diagnostics control in a release build; disclose the fields sent (app/OS version, screen, allowlisted error class, fatal flag) and verify backend log retention/access controls.
- [ ] Establish whether older submitted/installed builds still transmit raw exception messages and stacks; do not assume a source change changes an existing APK.
- [ ] Scan release artifact and source history for secrets without printing them.

### Backend and playback — BLOCKED

- [ ] Confirm gateway service bindings and whether standalone downloads service is active.
- [ ] Verify music search, lyrics, resolve, stream, download, cancellation, retry, and upload paths against staging/production.
- [ ] Test each provider's terms and allowed playback/download mode; disable routes without rights/terms approval.
- [ ] Verify cold-start handling, timeouts, status codes, retry messaging, and service-level monitoring.

### Android application — INCOMPLETE

- [x] Set an explicit Android package ID matching the owner-provided listing identifier; Expo prebuild config resolves `com.anonymous.b24sound`.
- [ ] Obtain the submitted APK's actual package/versionCode and set the next build's versionCode above it. The current generated default is `1`; this cannot be guessed safely.
- [ ] Build reproducibly from a clean checkout using controlled signing secrets.
- [ ] Review merged manifest permissions; request access only at use and document purpose.
- [ ] Test upgrade over submitted version, clean install, low storage, Android 10–16 behaviors, and at least arm64 and 32-bit target devices if supporting them.
- [ ] Test audio/video backgrounding, interruptions, Bluetooth/headset, notifications, seek/queue, rotate/resize, low memory, offline, and malformed streams.
- [ ] Check accessibility labels, text scaling, contrast, focus, and error/empty/loading states.

### Listing and privacy — INCOMPLETE

- [ ] Verify APKPure listing fields and approval status directly from the owner account.
- [ ] Publish privacy policy/contact, account deletion/data deletion path, terms, and accurate permission/data disclosures.
- [ ] Provide screenshots that match the submitted binary and product branding `Obsidian`.
- [ ] Make provider/availability, device compatibility, account requirements, and download restrictions explicit.
- [ ] Do not claim music licensing, catalog breadth, ad-free behavior, speed, or download rights without evidence.

### Provenance and release record — BLOCKED

For both the submitted APK and a future release, record in a restricted release manifest:

- Git commit SHA and working-tree cleanliness.
- Build service/workflow, toolchain, Expo SDK/runtime, package ID, version/versionCode, ABI.
- APK SHA-256 and signer certificate SHA-256 fingerprint (fingerprint only; never store private key in report).
- Merged permissions and dependency audit result.
- Device smoke-test matrix and outcomes.
- Submission date, APKPure listing/review state, and approval evidence.
- Rollback/update compatibility decision.

## Source vs submission comparison procedure

The comparison cannot currently be performed because no APK or APKPure metadata was accessible. When the submitted artifact is available, compare the package ID, version name/code, signer certificate fingerprint, runtime version, native permissions/features, embedded JS bundle/source map if available, and APK hash. A matching version string alone does not prove source identity. Record “not comparable” rather than guessing if build provenance or source mapping is absent.

## Explicit non-actions

No APK was replaced, submitted, or publicly released. The configured CI APK uses GitHub's generated debug signing for testing only. No OTA update was sent. No credentials were changed.
