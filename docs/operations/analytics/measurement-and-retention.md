# Analytics and retention plan

## Current instrumentation and limits

| Metric | Current source | Availability |
|---|---|---|
| Listing visits / downloads | APKPure owner dashboard or public listing | Not accessible during audit; exact aggregate fields/uniqueness unverified. |
| Successful install / first launch | No explicit product-install event found | Not measured by current app source. Store download is not an install or active user. |
| Registration / guest creation | Calls to gateway `/api/db/users/create` and login | Server-side event capture was not verified; guest mode creates a real account. |
| Daily/returning users | No aggregate activity analytics found | Not measured. Do not count account records as active users. |
| Playback starts / meaningful plays | `listeningHistory.js` writes local history; engine logs a play after 30 seconds | Device-local; not available as an aggregate campaign metric. No server analytics event was verified. |
| Crashes / API failures | `errorReporter.js` posts capped/deduplicated JS error payloads; API-cache logs entries | Partial; native crashes/network errors not fully covered. Error messages/stacks may include user data. Retention and access controls unverified. |
| Download progress/completion | Local `DownloadsContext.js` and notifications | Per-device state; not aggregate. |

## Privacy-preserving event plan

Prefer aggregated, first-party server counters with short retention. Do not add third-party ad SDKs or collect contacts, precise location, full IP histories, track titles, search queries, lyrics, media filenames, tokens, or playlist contents for growth attribution.

Suggested events:

- `app_open`: app version, coarse date bucket, random install identifier (rotatable/deletable), OS major version.
- `onboarding_complete`: completion step and optional non-identifying source channel.
- `auth_success`: account vs guest, no username/email/token.
- `first_play_start`, `first_play_30s`, `playback_error`: source class (local/remote), coarse error code, app version; never track/title/URL.
- `return_session`: one count per install/day, no exact location or device advertising ID.
- `download_complete`: only if legally permitted and useful; media type/size bucket, not source URL or filename.

Requirements before implementation: publish an accurate privacy notice; establish a lawful basis/consent where applicable; provide opt-out and account/data deletion; define event ownership, access control, retention/deletion, and incident response; ensure guest/session IDs are not reused for cross-app tracking. Store only aggregate counts after a short raw-event window (for example, 30 days) if technically and legally appropriate. Confirm the retention period with the owner/privacy reviewer before launch.

## Definitions and funnel

- **Listing visit:** a distinct listing-page visit only if the distributor reports distinct visits. If it reports page views only, label them page views.
- **Download:** distributor-reported download count, not unique people and not a successful installation.
- **New user:** a first successful app open on one installation. Use a pseudonymous install ID only with the approved privacy design.
- **Activated user:** a new user who completes one playback session of at least 30 seconds, including local tracks; this is an outcome, not just a tap.
- **Returning user:** an installation with another active session on a later UTC day. Report D1 and D7 cohorts separately.
- **Crash/API failure:** count unique events per session/version and total affected sessions; do not present raw event volume as affected users.

Funnel:

`channel reach → listing visit → download → first open → onboarding/auth completion → first 30-second play → D1 return → D7 return`

Useful rates (only when both numerator and denominator are actually measured):

- Listing conversion = downloads ÷ distinct listing visits.
- First-open rate = first opens ÷ downloads (cohort-aligned; downloads may not be unique).
- Activation rate = first 30-second plays ÷ first opens.
- D1 retention = activated installs active on the following day ÷ activated installs in the cohort.
- Playback reliability = successful first-play sessions ÷ first-play attempts.

## Learning why users leave

- Offer a short, optional in-app feedback prompt after a successful first session or after a repeated playback error; no blocking survey.
- Ask one question at a time: “What were you trying to do?”, “Where did it stop working?”, “What would make you use Obsidian again?”
- Provide a visible support/issue link and a simple account deletion/contact path.
- Review feedback by theme and app version; suppress usernames, filenames, track names, and pasted URLs before storage.
- Compare D1/D7 retention by onboarding completion and first-play success, not by sensitive demographics.
- Treat small cohorts as directional; do not claim causality from a few users.

## Launch dashboard (manual until approved telemetry exists)

Maintain a daily sheet with date, channel, content link, views/reach, listing visits (if available), downloads (as reported), first opens, registrations, first 30-second plays, returning sessions, crash/API errors, and notes. Put `unknown` for unavailable fields. Count verified outcomes only once per metric definition. Never infer installs from clicks or playback from a download.
