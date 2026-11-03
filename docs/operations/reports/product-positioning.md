# Obsidian product positioning

**Research date:** 2026-10-31. Product pages and policies can change; recheck before publishing.

## Competitive frame

| Product | Publicly documented strengths | What this means for Obsidian |
|---|---|---|
| Spotify | A large licensed catalog, personalized discovery, playlists, synced/device experience, and Premium offline listening; offline downloads are tied to its service and subscription rules. | Obsidian should not compete on catalog size, lossless quality, recommendations, or offline breadth. Its plausible niche is a local device media library combined with a configurable independent player and multiple clearly labeled sources. |
| YouTube / YouTube Music | Native video/music discovery and paid offline/background features vary by device, plan, and region. YouTube's terms limit downloading or using content except where the service permits it, with permission, or as law allows. | Obsidian must not present third-party extraction as equivalent to YouTube's own permitted offline feature. Review the current YouTube terms against the app's yt-dlp/stream-resolution/download paths before public distribution. |
| SoundCloud | Community and creator discovery are a central part of its product; recommendation surfaces connect listeners and artists. | Obsidian can serve people who primarily want to manage their own device media and explore providers that explicitly permit the chosen access. It cannot claim a creator network or catalog parity. |

Sources: [Spotify Premium benefits](https://support.spotify.com/us/article/your-premium-benefits/), [Spotify offline listening](https://support.spotify.com/au/article/listen-offline/), [YouTube Terms of Service](https://uk.youtube.com/t/terms), [YouTube downloads help](https://support.google.com/youtube/answer/56100?hl=en), [SoundCloud discovery](https://soundcloud.com/company/discovery/).

## Evidence-based strengths in this source tree

- Scans and presents local Android audio and video media (`localMediaScanner.js`).
- Provides an audio player and a separate fullscreen video player (`usePlaybackEngine.js`, `PlayerCard.js`, `FullscreenVideoPlayer.js`).
- Includes a local library, downloads UI, queue/history, and lyrics lookup where the provider returns a match.
- App source combines several distinct metadata/search providers. This is code evidence only; it does not establish that each provider is currently available, licensed for each use, or stable.

## Adoption barriers

- No public GitHub description or confirmed installation link in the audit.
- No verified APK/source provenance, an arm64-only native build configuration, and no submitted APK versionCode to plan an update safely. `app.json` now explicitly sets `com.anonymous.b24sound` from the supplied listing identifier; binary/signer match remains unverified.
- Broad permission list and optional camera/location features may make a music-focused install feel over-scoped.
- Remote search, extraction, and account flows depend on several services whose deployment bindings and health are not verified.
- The local source includes a shared gateway credential, and public Git history contains signing material even though its paths are removed from the local Git index; resolve before asking new users to install.
- Guest access provisions a backend account rather than an anonymous local session. The local login UI now says this and explains that users need not choose credentials; account deletion/recovery and privacy details still need clear public documentation.
- The name “Obsidian” is also strongly associated with an established note-taking app, and another Android music player uses “Obsidian Music.” This is a search-discovery and user-confusion risk, not a verified trademark conclusion. Keep the official product name, but use the clear descriptor “Android music and media player” consistently in the listing, README, screenshots, and social profiles. Sources: [Obsidian for Android](https://obsidian.md/help/android), [another Obsidian Music Android project](https://github.com/Varun7009/Obsidian-Music).

## Positioning recommendation

Describe Obsidian as an **Android music and media library/player for people who keep media on their device and want playback and discovery tools together**. Keep local media management as the reliable anchor. Describe each remote source accurately, label its origin, state that results depend on provider/service availability, and promote downloads only for sources whose terms explicitly permit that use.

Do not position as a free Spotify replacement, universal music catalog, YouTube downloader, streaming service, licensed catalogue, or offline-everything app. These phrases overstate capabilities and could create rights, platform, and trust problems.

## Research implications and uncertainty

Spotify Developer Policy prohibits several types of integrated services, restricts streaming to eligible Premium contexts, requires attribution/links for certain metadata/cover-art/preview data, and disallows facilitating stream ripping. The local backend contains Spotify search/playlist integration alongside other providers and an extractor/download flow. **Inference:** this architecture needs a specific policy review before Spotify-related results or playlist conversion are promoted; the source alone is insufficient to determine compliance. See [Spotify Developer Policy](https://developer.spotify.com/policy) and [Developer Terms](https://developer.spotify.com/terms).

YouTube's terms restrict downloading or using content unless specifically permitted by the service, authorized by rights holders, or permitted by law. The local extractor integration uses yt-dlp and has stream/download routes. **Inference:** the feature path needs legal and provider-terms review; this audit is not a legal determination. See [YouTube Terms](https://uk.youtube.com/t/terms) and [YouTube download guidance](https://support.google.com/youtube/answer/56100?hl=en).

## Validation interviews

Before scaling outreach, speak with 8–12 Android listeners who use local audio or video. Ask them to complete: find a local track, start it, pause from the lock screen, return to the app, and locate it again. Record task completion and where they hesitate. Then ask whether remote discovery is useful after they have seen a truthful source/availability explanation. Do not ask whether they “like” the app as the primary success test.
