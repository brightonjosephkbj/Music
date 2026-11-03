# Obsidian initial discovery and executive report

**Audit date:** 2026-10-31
**Public brand:** Obsidian
**Internal project identity:** B24 Music
**Working source:** `~/B24music_new` (`brightonjosephkbj/Music`)
**Scope:** local app source, adjacent local service checkouts, public GitHub listing, basic unauthenticated service probes. No production credentials were used for probes.

## Executive summary

The accessible working app is a substantial React Native / Expo project with local library scanning, search, audio and video playback, lyrics, downloads, notifications, widgets, account flows, and OTA checks. The Android app name is configured as Obsidian. The source has no automated test or lint scripts, has substantial historical backup files, and the current checkout already contains uncommitted changes to `App.js`, `FullscreenVideoPlayer.js`, and `usePlaybackEngine.js`; those changes were preserved.

Two release blockers emerged. First, the client source contains a hard-coded gateway credential. Second, the public Git history contains signing-related material. The paths have now been removed from the local Git index, with files preserved on disk; the public history remains unchanged. Treat both the API credential and signing material as exposed until the owner verifies otherwise; rotate/reissue using an approved operational process and remove the signing material from future source distribution. Neither credential rotation nor history rewrite was performed. A separate release blocker is the unresolved music-rights / provider-terms review for extraction and downloading flows.

The app still calls the gateway's `/api/downloads/*` service, and `Api-cache/music.py` retains a `B24_DOWNLOADS_SERVICE_URL` dependency for search. The code therefore still references the separate downloads service. Its current deployment binding and health are unverified. The gateway `/ping` and API-cache `/` returned HTTP 200 during this audit; the gateway `/health` did not respond within the 12 second probe window. That timeout is not proof that the gateway or all backends are down. A guessed extractor hostname returned 404 and was not treated as the configured extractor.

No APK was found in the accessible app tree. APKPure's page could not be independently inspected, and the submitted file/hash/build metadata were unavailable. The source-to-submitted-APK comparison is therefore **not established**. The owner reports APKPure approval is pending; no claim of approval or public availability is made.

## Verified facts

- Local app branch: `main`, tracking `origin/main`; base commit `f5db4622d96706c9b7ee84838287f3b7d0656f16` dated 2026-10-28. A read-only check on 2026-11-01 confirmed public GitHub `HEAD` and `main` still point to that exact commit. Local changes were present before this audit, so the working tree differs from the published commit.
- `app.json` configures display name `Obsidian`, slug `b24sound`, version/runtime `1.2.0`, and arm64-only Android builds.
- The app uses React Native 0.86 and Expo SDK 57. Main playback is `expo-audio` plus `expo-video`; media controls, notification, widget, and OTA native integrations are configured.
- The app uses a gateway at `gateway-b0tx.onrender.com`; source code routes account, media, and download requests through it.
- Adjacent local checkouts include `Api-cache`, `b24-gateway-real`, `B24_Database`, `Extractor`, and OTA service projects. Their configured production environment values are not available for this audit.
- GitHub currently presents the repository without an About description, website, or topics and shows no repository release in its visible release section. This is a public presentation gap, not proof that no APK has been submitted elsewhere.
- The public workflow at the audited commit builds and signs an APK and creates a GitHub Release on every push to `main`. A local, unpushed workflow change now makes pushes validate configuration and the JavaScript bundle only; signed publishing requires a manual dispatch with `publish_release=true`, and the release job alone receives `contents: write`. The local workflow also refuses to publish while signing files remain tracked. Public GitHub is unchanged and retains the automatic-publish behavior until an approved change is pushed. YAML/gate/signing-guard assertions pass locally; no GitHub workflow run occurred.
- Expo's public config command completed successfully. It did not establish that an Android APK builds or installs.

## Critical blockers

1. **Client-bundled gateway credential — Critical.** `apiClient.js` embeds a credential used to authorize requests. Anything shipped in a mobile application can be extracted. Removing it client-side without a backend-compatible auth path would break the API. Owner approval is required for credential rotation and server-side remediation.
2. **Signing material in public Git history — Critical.** The public base commit tracks signing-material paths; the local index now stages their removal, preserving local files. Because the repository is public, assume exposure pending direct owner verification. Reissue the signing key if it signed APKPure, preserve package update continuity only through a verified key transition, and remove private material from history through an approved process.
3. **Music rights and provider terms — Critical.** Search and extraction flows combine provider metadata with third-party resolution/download. The applicable rights, provider terms, takedown process, and app-store/listing disclosures have not been verified. Do not advertise unlimited, licensed, ad-free, or offline catalog access.
4. **Submission provenance — High.** No submitted APK, hash, package certificate, version/build manifest, or APKPure approval evidence was accessible. A source commit cannot be matched to the submitted binary.
5. **Backend auth and download dependency — High.** App requests still use the gateway downloads route; `Api-cache` also has a configured-at-runtime downstream downloads URL for YouTube search. Production endpoint mapping and current downloads/extractor status remain unverified.

## Completed in this pass

- Mapped the app and adjacent service repositories without changing their tracked files.
- Preserved all pre-existing uncommitted application edits.
- Ran Expo public-config validation successfully.
- Probed public health endpoints without credentials: gateway `/ping` 200; API-cache `/` 200; gateway `/health` exceeded the 12 second probe; an unverified extractor guess returned 404.
- Added a public-facing repository README and created this operations workspace with architecture, audit, release, campaign, analytics, and execution-plan documents.
- Exported the Android JavaScript bundle to a fresh workspace directory with Hermes bytecode disabled; no APK/native build was produced.
- Did not sign, upload, publish, push, change credentials, deploy, or modify production data.

## Approval-requiring actions

- Rotate the gateway credential and any signing material confirmed exposed; coordinate server changes so existing installations do not lose service.
- Remove signing material from public source history and decide whether the APK signing identity must be replaced.
- Change backend auth, analytics, provider integrations, or release/update configuration in production.
- Submit or replace an APK, publish public posts, or push local changes to GitHub.

## Recommended order

1. Confirm the signing key used for the submitted APK and treat tracked key material as compromised until checked.
2. Rotate the client gateway key using a temporary overlap window and a server-side design that does not rely on a permanent shared secret in an APK.
3. Verify the live route table for gateway, downloads, database, API-cache, OTA, and extractor services.
4. Complete provider rights/terms review and align download controls/listing claims with it.
5. Obtain the submitted APK and release metadata; compare package, version/build, certificate fingerprint, source revision, permissions, and hash.
6. Add reproducible CI checks and a controlled signed build before starting a public launch campaign.

See the linked companion documents in `architecture/`, `technical-audit/`, `release/`, `marketing/`, `analytics/`, and `execution-plan/`.
