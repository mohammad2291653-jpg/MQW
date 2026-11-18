# Implementation status — 18 November 2026

MQW is a working application with an implemented dual-backend repository. This checkpoint does not claim a verified public deployment. A connected Supabase project, schema preparation, local tests and a public HTTPS application are separate release steps. The owner authorized implementation after planning; the source product documents remain unchanged.

| Area               | Implemented behavior                                                                                                                                                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts and shell | Email/password with scrypt, opaque hashed sessions, protected server routes, account isolation, password changes and one-use owner invitations. Email verification/reset delivery is not configured.                                                        |
| Persistence        | Async SQLite adapter for local/tests; async PostgreSQL adapter for cloud records, sessions and audio. Awaited transactions, shared module-safe connections/context, serialized evidence transitions and transaction-local owner scope.                      |
| Cloud security     | Private `mqw_private` runtime schema and restricted `mqw_app` role; owner RLS for records/idempotency/audio. Custom cookie identity is retained; this is not a Supabase Auth migration. Actual hosted permissions/connectivity must be verified separately. |
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

After the async repository and shared-connection update, TypeScript and all **37 current local unit/integration tests** passed. These tests deliberately force temporary SQLite storage and remove remote database settings. Coverage includes async transaction waiting/rollback/serialization, module-reload connection/context/mutex sharing, isolation, learning/reviews, drafts, private audio/export/deletion, palace retries, timezone semantics and local backup integrity. These are not remote PostgreSQL integration results.

After the async repository migration, all **9 Chromium browser journey tests** passed against temporary SQLite storage. This run preceded the final module-shared connection/cache correction. After that correction, the desktop palace journey passed separately (**1/1**), with neither startup-cleanup warning observed. Its temporary development server was stopped after the run. Automated WCAG checks previously covered the six primary page groups. Reports live in `playwright-report/`, with the page audits in `artifacts/accessibility-audit.json`.

The runtime schema passed **45 isolated PGlite PostgreSQL policy/constraint checks**. The release operator also confirmed that both runtime migrations are applied to the selected Supabase Free project, all **7 runtime tables enable and force RLS**, and hosted security advisors report **0 security findings**. These checks do not establish application TLS/pooler connectivity, authenticated remote flows or restart persistence. The old normalized proposal and its tests are archived and do not establish cloud-runtime readiness.

## Remaining release evidence

- Successful public HTTPS deployment, fixed-origin validation, invitation-protected registration and stateless private-route probes.
- Actual runtime-role TLS/pooler access and remote RLS/Data API isolation.
- Persistence of real synthetic test events and audio after restarting the deployed app.
- A verified private PostgreSQL backup/restore procedure and retention decision; free-plan pauses/quotas remain operational limits.
- Physical iPhone Safari/installed-PWA microphone, interruption and accessibility checks. No WebKit result is claimed from an environment without its required libraries.

No paid service or external AI activation is implied by these implementation results. The free-cloud design uses durable PostgreSQL storage and does not treat Render's ephemeral filesystem as permanent data storage.
