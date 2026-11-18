# MQW security and privacy

This document describes the implemented SQLite and PostgreSQL adapters and their security contracts. A connected Supabase project or a passing local test is not, by itself, proof of a verified public deployment. Deployment evidence is recorded separately in `IMPLEMENTATION_STATUS.md`.

## Storage and database authority

- Local development and isolated tests use `MQW_STORAGE_BACKEND=sqlite`. The server opens `${MQW_DATA_DIR}/mqw.sqlite`, defaulting to `data/mqw.sqlite`, with foreign keys, WAL journaling and a five-second SQLite busy timeout. Local audio uses private files below that directory.
- The cloud adapter uses `MQW_STORAGE_BACKEND=postgres` and a server-only `MQW_DATABASE_URL`. All durable application records, sessions, consumed invitations and audio bytes live in PostgreSQL; the cloud adapter does not rely on Render's ephemeral filesystem or a Supabase Storage bucket.
- PostgreSQL uses a shared pool of at most three connections, verified TLS and an optional privately configured CA certificate. TLS verification must not be disabled to make a connection succeed. Neither the database URL nor credentials belong in `NEXT_PUBLIC_` variables, browser bundles, source control or logs.
- The runtime schema under `supabase/runtime/schema.sql` uses the unexposed `mqw_private` schema and a restricted `mqw_app` role without administrative or RLS-bypass privileges. Browser roles have no schema/table access. Do not connect the application using the administrative `postgres` role or expose `mqw_private` through the Data API.
- All seven runtime tables enable and force RLS. `records`, `idempotency` and `voice_blobs` require a transaction-local `mqw.user_id` and enforce both read/write ownership predicates. Auth/session/setup/cleanup tables deliberately allow the trusted server role to perform pre-authentication operations. This is custom cookie authentication; it does not use Supabase Auth or `auth.uid()`.
- The server resolves a valid opaque session before establishing owner context. Context comes from that verified user, never a browser-supplied account ID. A database credential is trusted server authority: because it can establish owner context, RLS is not a claim that the credential can safely be handed to an untrusted client.
- Transactions await all callback work before COMMIT/ROLLBACK. PostgreSQL domain transactions use an advisory lock to preserve serialized evidence/idempotency transitions, and owner context uses transaction-local `set_config`, not a session-wide setting on pooled connections.
- Connections, async transaction context and the SQLite queue are shared across Next.js module instances for each database identity. PostgreSQL cache keys hash the connection configuration rather than retaining raw credentials as registry keys. Local SQLite queries outside an active transaction wait for that transaction's asynchronous callback to settle.
- SQLite has no PostgreSQL RLS. Its adapter enforces explicit owner filters and ownership checks in the server layer. Tests force temporary SQLite storage and remove the remote database URL before importing the backend.
- This is not end-to-end encryption. Authorized server/database operators can read application records and audio. Protect credentials, filesystem access, database access and backups accordingly.

## Accounts and sessions

- `MQW_OWNER_EMAIL` restricts new registrations to the intended normalized address. This is an allowlist, not email ownership verification. Existing accounts are not removed by changing it.
- Public production requires `MQW_SETUP_TOKEN_HASH`. The first owner presents the matching private token, which is checked using timing-safe SHA-256 comparison. Its consumed hash is committed atomically with account creation. Deleting an account does not reactivate the invitation; reinitialization requires explicit hash rotation. No default password exists.
- The browser reads setup material from a URL fragment, removes it from the address bar and submits it only in the signup body. Never publish setup links or `.mqw-operator/` material. Capability responses disclose only `open`, `invite` or `closed`, never invitation secrets.
- Passwords use Node `scrypt`, a random 16-byte salt and a 64-byte derived key. Plaintext passwords are not stored; verification uses timing-safe comparison.
- Sessions use random 32-byte tokens; only their SHA-256 hashes are stored in the selected database. They expire after 30 days. Sign-out invalidates the current session; password changes invalidate previous sessions and issue a new one.
- Cookies are `HttpOnly`, `SameSite=Lax`, scoped to `/`, and `Secure` in production. The public application must use HTTPS. Authenticated routes and APIs independently validate sessions.
- No email verification or password-reset delivery provider is configured. Reset requests report that limitation instead of claiming an email was sent.

## Requests, browser storage and logs

- Mutations require the configured `MQW_APP_ORIGIN`. For local development without that setting, validation uses the incoming Host and request protocol. Arbitrary forwarded-host/protocol headers are not trusted. The production launcher normalizes the intended HTTPS origin, including Render's configured external URL when available.
- JSON and audio bodies have bounded readers and field validation. Generic CRUD has a collection allowlist; it cannot directly forge learning evidence or private grading snapshots.
- APIs use `Cache-Control: no-store`. The service worker must not cache account responses, private content or test answers. Clearing browser cookies signs out that browser; it does not delete the account's database records.
- Auth rate limits are process-local and reset when the process restarts or a free service sleeps. They are not a distributed abuse-prevention service.
- Logs must omit passwords, tokens, connection URLs, SQL parameter values, answer bodies, notes, recordings and exported content. External monitoring must not attach private request bodies or screenshots.
- `/api/health` reports only readiness (`ok` or `unavailable`). It does not disclose paths, users or configuration. A successful health response does not prove persistence across deployment restarts.

## Learning evidence and insights

- Versioned question presentation is separate from answer keys. Durable submissions precede feedback. Free text is explicitly self-graded; no semantic AI grading is claimed.
- One question has one saved response within a lesson attempt. Identical network replays return the existing response; a changed answer requires a new lesson attempt, preserving the earlier evidence. Metacognitive predictions cannot be entered after scored questions.
- The scheduler is the documented `fixed-v1` fallback. Initial review is after one day. `again` resets the stage and schedules one day; `hard` preserves the stage but schedules one day; `good` advances through the 1/3/7/14/30-day stages. It is not FSRS, AI or a guarantee of optimal retention. Rescheduling does not change a score.
- Skips, self-reports and deterministic scores remain distinct. Missed dates do not become wrong answers or psychological evidence.
- Notes stay notes unless explicitly converted. Notes, journals, audio and reflection text are excluded from default insight inputs. Insights cite permitted numerical events, sample sizes and dates and can be disputed, dismissed or disabled.
- No diagnoses, personality labels, intelligence scores or immutable learning styles are inferred. Normal event history is preserved; intentional deletion is an explicit exception, and dependent summaries must be recomputed.

## Audio and export

- Recording requires an explicit user action and browser microphone permission. Preview/save/delete are separate actions. There is no automatic transcription or AI processing.
- PostgreSQL stores immutable audio in owner-bound `bytea` rows with a composite ownership foreign key to metadata. Metadata and bytes commit together; deletion cascades in the same database transaction. Each file is limited to 20 MiB and the application enforces a 200 MiB account allowance. These bytes count against the database quota, not Supabase's separate Storage allowance.
- Local audio files are private and require authenticated application playback. Both adapters enforce ownership; no public bucket or reusable signed bearer URL is used. Temporary browser blob URLs must be revoked on unmount/account change.
- Playback has a bounded per-file allocation. Export streams JSON and audio incrementally under backpressure instead of accumulating the full audio archive in server memory. A missing or interrupted recording is explicitly labeled; a partial file is never represented as complete.
- Export requires a valid session and password confirmation before streaming starts. The versioned JSON contains that account's metadata, saved evidence, historical private snapshots and available original audio encoded as base64. Metadata is captured in one transaction. This is JSON export, not a CSV archive or an implemented cloud restore workflow.
- Real-device Safari/iPhone permission, format and interruption behavior remains a separate acceptance check.

## Deletion, backups and free-plan limits

- Account deletion requires the current password. PostgreSQL removes owned rows, sessions and audio through transactionally cascading foreign keys. The consumed invitation ledger remains an operational replay-prevention record without an account/email identifier.
- Local deletion stages audio in a durable cleanup queue. A pending-files response is not a claim of finished physical purge; startup retries queued cleanup.
- SQL deletion does not instantly erase physical database pages, WAL or independent backups. Backup retention and restore procedures must account for previously deleted data and expired credentials.
- `scripts/backup.mjs` verifies local SQLite online backups with voice snapshots, checksums and integrity checks. Restore refuses an occupied destination and revokes restored sessions. It is a local SQLite operator tool, not a PostgreSQL backup implementation. Run it with filesystem ownership appropriate for the app. Checksums detect corruption; they do not authenticate an archive whose manifest was maliciously replaced.
- Supabase Free automatic database backups are not included in the verified plan description. An explicit private cloud backup/restore procedure and retention policy are still required; no external backup recipient is enabled by the application.
- Render Free can sleep and cannot persist local files. Supabase Free can pause after inactivity and has finite database/egress quotas. The cloud adapter must report unavailability rather than silently opening an empty SQLite database. Never describe the free deployment as guaranteed always-on hosting.

## External AI and notifications

There is no external AI provider or AI request. Core learning, reviews, palace and progress work without one. There are no advertising or third-party analytics trackers by default. Any future AI integration requires purpose-specific payload/recipient preview and explicit send consent, with notes/audio/unrelated records excluded. Canceling before send transfers nothing; canceling afterward cannot guarantee remote erasure.

Notification preferences are separate from browser permission. Important deadlines and the single optional habit reminder currently operate while the app is open; no background push service is configured. Date instants use UTC and IANA timezone rendering, initially `Asia/Hebron`; date-only habits/deadlines and optional wall-time plans preserve their local-day meaning.

## Verification boundaries

The archived normalized proposal at `supabase/proposals/normalized_schema.sql` is not the runtime schema. Its older embedded tests do not prove the new adapter. The runtime template has a separate local PostgreSQL RLS/constraint runner; local results are distinct from actual Supabase privileges, TLS/pooler connectivity, advisor output and cloud-restart persistence.

Release verification must cover real remote role permissions, anonymous Data API denial, A/B account isolation, audio, exports/deletion, concurrent submissions, session changes, interruption recovery and actual device behavior. Report which checks ran and where; do not turn a local SQLite or container result into a claim of verified cloud operation.
