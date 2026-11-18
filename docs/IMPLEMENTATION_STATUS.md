# Implementation status — 18 November 2026

MQW is live on Render Free with Supabase Free private PostgreSQL. Application commit `35aac55` passed the recorded hosted HTTPS, ownership, redeployment-persistence and cleanup checks. The actual owner's account has not been created; its verified private invitation remains unconsumed. Local SQLite remains supported. The source product documents remain unchanged. See [release verification](RELEASE_VERIFICATION.md) for actual proof and deferred operating limits.

| Area               | Implemented behavior                                                                                                                                                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts and shell | Email/password with scrypt, opaque hashed sessions, protected server routes, account isolation, password changes and one-use owner invitations. Email verification/reset delivery is not configured.                                                        |
| Persistence        | Async SQLite adapter for local/tests; async PostgreSQL adapter for cloud records, sessions and audio. Awaited transactions, shared module-safe connections/context, serialized evidence transitions and transaction-local owner scope.                      |
| Cloud security     | Private `mqw_private` schema, restricted `mqw_app` role and owner RLS for records/idempotency/audio. Actual runtime strict-TLS connectivity and tested HTTPS A/B isolation passed. Custom cookie identity is retained; this is not a Supabase Auth migration. |
| Learning           | Four versioned lessons with concealed sources, persisted drafts/answers, reasoned feedback, honest self-check, whole-lesson retries and real review creation.                                                                                               |
| Reviews            | Durable cards, ratings and rescheduling history. Documented `fixed-v1`, not FSRS or personalized AI.                                                                                                                                                        |
| Palace             | Illustrated five-locus house, orientation, editable associations, private snapshots, separate route/concept trials, explicit skips, self-ratings and scheduled retests.                                                                                     |
| Personal insights  | Numerical summaries with event IDs, denominators, dates and evidence limits; dismissal/correction/opt-out. No private text/audio analysis or invented psychological claims.                                                                                 |
| Light organizer    | Notes, optional journal, explicit task conversion, projects, optional wall-time plans, habits/rest/correction, manual goals, study/calm timers and optional weekly review.                                                                                  |
| Voice              | User-initiated recording and preview, private upload/playback/delete. PostgreSQL stores owner-bound audio bytes with metadata transactionally; local development uses private files. Physical iPhone behavior remains unverified.                           |
| Data controls      | Password-confirmed streaming JSON export including originals/snapshots; password-confirmed account deletion. Cloud audio cascades atomically; local filesystem cleanup has a durable retry queue.                                                           |
| Backup tools       | Tested SQLite online backup/verification/restore with private permissions and consumed-invitation preservation. This tool does not yet back up or restore PostgreSQL. No automatic cloud backup is claimed.                                                 |
| PWA                | Local fonts, manifest/icons, safe areas and an offline explanation; no private-response caching or full offline synchronization.                                                                                                                            |
| External AI        | No provider, configuration or calls. Core functionality works without it.                                                                                                                                                                                   |
| Notifications      | Explicit permission, important deadlines and at most one habit reminder while the app is open. No background push service.                                                                                                                                  |

## Verification checkpoint

TypeScript, the corrected production build and all **38 local unit/integration tests** passed. These tests deliberately force temporary SQLite storage and remove remote database settings. Coverage includes awaited transactions/rollback/serialization, module-reload sharing, isolation, learning/reviews, drafts, private audio/export/deletion, palace retries, timezone semantics and local backup integrity. The suite includes an 18-process cold-initialization regression, with the busy timeout set before WAL/schema initialization. These are distinct from remote PostgreSQL results.

After the async repository migration, all **9 Chromium browser journey tests** passed against temporary SQLite storage. This run preceded the final module-shared connection/cache correction. After that correction, the desktop palace journey passed separately (**1/1**), with neither startup-cleanup warning observed. Its temporary development server was stopped after the run. Automated WCAG checks previously covered the six primary page groups. Reports live in `playwright-report/`, with the page audits in `artifacts/accessibility-audit.json`.

The runtime schema passed **45 isolated PGlite PostgreSQL policy/constraint checks**. Both runtime migrations are applied to Supabase Free, all **7 runtime tables enable and force RLS**, and the security-advisor checkpoint reported **0 security findings**. A separate real local PostgreSQL 17.12 CA/SAN-verified TLS smoke passed with restricted `mqw_app`, covering learning/reviews, palace, owner isolation, bytea/export, rollback and deletion. Its temporary synthetic resources were removed. The archived normalized proposal is not runtime proof.

## Hosted release verification

The final deployment reached Live; health returned 200 through strict-TLS PostgreSQL and restricted `mqw_app`. All **21 final anonymous HTTPS probes** passed, including explicit one-year HSTS/includeSubDomains. Anonymous desktop/mobile inspections observed Arabic RTL, no horizontal overflow and no page/console errors in the inspected flows.

Operator-seeded synthetic accounts passed HTTPS L1/review/deduplication, five-locus blind palace/reveal/rating, note/task CRUD, A/B denial, and 1 MiB + 5 byte audio playback/SHA-256/streamed-export checks. Canonical full-state hashes for both accounts and original audio/export content matched after real redeployment. An existing session cookie still authenticated; session protections and sign-out revocation were verified separately.

Password-confirmed cleanup then removed the synthetic accounts. Old cookies and deleted credentials returned 401; independent database counts confirmed zero users, sessions, records, voice_blobs, idempotency and setup_tokens. Owner registration without its invitation returned 403, and the valid invitation remains unconsumed. No actual owner account or fabricated personal history remains.

## Remaining operating limits

- PostgreSQL offsite backup/restore and retention still need operational verification; no automatic cloud backup is claimed.
- Physical iPhone Safari/installed-PWA microphone, interruption and manual accessibility checks remain unverified. No unavailable WebKit pass is claimed.
- Email verification/reset delivery is unconfigured; notifications remain foreground-only.
- Free-plan sleep, cold starts, inactivity pauses and quotas remain service limits. The tested rescheduled review proves data flow, not human delayed retention.

The release uses no paid compute/disk/IPv4 add-on or external AI. Durable PostgreSQL records/audio do not depend on Render's ephemeral filesystem.
