# MQW release verification — 18 November 2026

Status: **Free cloud release, redeployment persistence and synthetic-data cleanup verified**. Physical-device and operational limits below remain explicit; they are not silently marked complete.

## Actual hosted evidence

The verified Render Free release for application commit `35aac55` reached terminal **Live** status on 18 November 2026. The service uses Supabase Free private PostgreSQL, without a persistent Render disk. Its health endpoint returned HTTP 200 through the application's strict-TLS PostgreSQL connection and restricted `mqw_app` runtime role. Real state/audio/session persistence was checked across replacement of the earlier live application instance.

| Check | Observed result |
| --- | --- |
| Private database schema | Both runtime migrations applied; seven tables enable and force RLS. Anonymous/authenticated Data API roles have no private-schema usage; the security-advisor checkpoint had no findings. |
| Public/protected HTTPS behavior | All 21 final anonymous HTTPS probes matched the expected public/protected behavior. HSTS was explicitly verified with `max-age=31536000; includeSubDomains`. |
| Anonymous browser layout | Inspected desktop/mobile viewport pages used strict HTTPS, Arabic RTL, no horizontal layout overflow and no observed page/console errors in those inspected flows. |
| Owner setup protection | Owner-eligible registration without the private invitation returned 403; the existing invitation remained unconsumed. No default password was introduced. |
| Session lifecycle | Synthetic HTTPS sign-in/state checks passed; cookies carried Secure, HttpOnly and SameSite protections. An existing cookie still authenticated after redeployment. Sign-out and account deletion invalidated their tested sessions. |
| Learning and reviews | Two operator-seeded synthetic accounts exercised the actual HTTPS API. L1 persisted answers/feedback/reviews and duplicate-submission behavior passed. |
| Memory palace | All five associations and blind trial submission, explicit reveal and self-ratings passed through HTTPS. Tested trial responses concealed their private answer snapshots before reveal. |
| Organizer and isolation | Note/task CRUD and tested A/B access denials passed. These results do not imply every possible user flow has been exercised live. |
| Private audio and export | A synthetic 1 MiB + 5 byte recording round-tripped through private playback with matching SHA-256; streamed JSON/base64 export reproduced the original bytes. Tested cross-account access was denied. |
| Redeployment persistence | Canonical full-state hashes for both synthetic accounts were identical before and after replacement. The completed lesson/palace data, original audio SHA-256 and streamed export content matched; cross-account audio requests still returned 404. |
| Cleanup and clean first use | Password-confirmed API deletion removed the synthetic accounts. Their old cookies and deleted credentials were rejected with 401. Independent database counts confirmed zero rows in users, sessions, records, voice_blobs, idempotency and setup_tokens. The owner invitation remained unconsumed. |
| Runtime log checkpoint | No error entries were observed in the inspected runtime-log window after the final Live deployment. This is not a guarantee of future error-free uptime. |

The synthetic accounts were operator-seeded for verification, not created by opening public registration, and have now been removed. The checks did not create the actual owner's account, require the owner's password, consume the owner invitation, import university documents, or activate external AI. Test identifiers, credentials, invitation material and private request bodies are intentionally omitted from this public report.

## Release acceptance scope

The replacement reached terminal Live, health remained HTTP 200, expected HTTPS security headers were observed, existing synthetic evidence/audio/sessions survived instance replacement, and cleanup was independently verified. No test fixture was recreated to simulate persistence.

The release also sets SQLite's busy timeout before WAL/schema initialization; its 18-process cold-initialization regression passes. This protects local/build-time initialization while cloud runtime durability remains PostgreSQL-backed. The tested review rescheduling proves scheduling/data flow, not a human delayed-retention experiment.

## Independent local evidence

- 38 SQLite/async-repository unit/integration tests passed, including the cold-initialization regression using 18 fresh processes. TypeScript and the corrected production build passed.
- Nine Chromium browser journeys passed, with a separate dedicated cache-reproduction browser check passing after the module-sharing correction.
- 45 isolated PGlite PostgreSQL role/RLS/ownership/cascade checks passed for the runtime schema.
- A real local PostgreSQL 17.12 wire-protocol smoke passed with CA/SAN-verified TLS and a restricted non-superuser/non-bypass `mqw_app`. It covered concurrent lesson start/submission deduplication, learning/reviews, five-locus palace trials/retests, A/B context isolation, 1 MiB + 5 byte audio/export, rollback and password-confirmed cascading deletion. Its temporary server, synthetic data and credentials were removed.

Local evidence and hosted evidence are distinct. The local PostgreSQL test does not by itself prove Supabase connectivity; the hosted checks above provide that separate runtime evidence.

## Explicit operating limits and deferred checks

- Render Free idle sleep/cold starts, shared quotas and Supabase Free inactivity pauses remain service limits; no unlimited availability is promised.
- Audio is PostgreSQL `bytea` and consumes database quota. No separate Supabase Storage service is implied.
- Physical iPhone Safari/installed-PWA recording interruptions, microphone permissions and manual assistive-technology checks remain unverified. Chromium mobile viewports do not certify those devices. No WebKit pass is claimed without a working test environment.
- Email verification and reset-email delivery remain unconfigured. Signed-in password changes work; no reset email is simulated.
- The SQLite backup/restore helper is tested, but an offsite PostgreSQL backup/restore procedure and retention policy still need operational verification. No automatic cloud backup is claimed.
- Notifications remain opt-in and foreground-only. Full offline sync, 3D, transcription, document ingestion and external AI are outside this release.

These limitations remain part of the released application's documented operating boundaries.
