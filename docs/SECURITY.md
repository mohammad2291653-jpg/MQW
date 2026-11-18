# MQW security and privacy

This document describes the current local implementation and the separate proposed Supabase schema. It is not a claim that a cloud account, production service, email provider, or external AI integration exists.

## Current storage and identity

- The active backend is a **single-instance Node.js server with SQLite**, not Supabase. The server opens `${MQW_DATA_DIR}/mqw.sqlite`, defaulting to `data/mqw.sqlite` under the application working directory. The database uses foreign keys and WAL journaling.
- `MQW_OWNER_EMAIL`, when set, restricts new registrations to that normalized email address. Configure it before exposing a personal instance. This is a registration allowlist, not proof of email ownership; the local implementation does not send verification email, and the setting does not delete preexisting accounts.
- Public production additionally requires `MQW_SETUP_TOKEN_HASH`. The first owner must present the matching private token; knowledge of the email address is insufficient. A timing-safe SHA-256 comparison checks the token, and the consumed hash is recorded atomically with account creation. Deleting an account does not reactivate its invitation. Reinitialization requires explicit hash rotation. The browser accepts the token in the URL fragment (not a query parameter), removes it from the address bar and submits it only in the signup body. Never publish setup links or `.mqw-operator/` files.
- Account passwords are hashed with Node `scrypt`, a random 16-byte salt, and a 64-byte derived key. The plaintext password is not stored. Password verification uses a timing-safe comparison.
- Sessions use random 32-byte bearer tokens. Only SHA-256 token hashes are stored in SQLite. Sessions expire after 30 days. Signing out invalidates the current session; changing a password invalidates prior sessions.
- The session cookie is `HttpOnly`, `SameSite=Lax`, and scoped to `/`. It is `Secure` when `NODE_ENV=production`. Production therefore requires HTTPS.
- Browser routes alone do not authorize access. Each API request resolves its session, and record reads/writes include the authenticated owner in their SQL conditions. A guessed record ID is not an authorization mechanism.
- SQLite does not implement PostgreSQL RLS. The local implementation enforces ownership in the server data layer. Do not describe the running application as having Supabase/RLS protection.
- This is not end-to-end encryption. A server operator or someone with access to the data volume can read the application database and audio files. Protect the server, filesystem, backups and any disk-encryption keys accordingly.

## Requests and browser storage

- Mutating API requests must have an `Origin` matching the request URL origin. The cookie's SameSite policy is an additional protection. A production reverse proxy must preserve the real host/protocol and must not accept arbitrary forwarded-host values from untrusted clients.
- JSON request bodies are limited and validated. Generic record operations use a collection allowlist; learning results and server-owned grading state do not become arbitrary client-editable records.
- API responses use `Cache-Control: no-store`. The application must not cache account responses, notes, recordings or test answers in a shared service-worker cache.
- Clearing browser cookies signs the browser out; it does not delete the account's server records. Conversely, deleting the account must remove its server records, not just browser state.
- Rate limiting in the current local server is process-local. A restart clears its counters. Before public hosting, review rate limiting against the actual reverse proxy, connection model and expected use. Do not expose a personal application with unrestricted registration without deliberately deciding who may create accounts.

## Learning evidence and private content

- Question definitions and their answer keys are separate. A durable submission precedes result feedback. Open answers are explicitly self-graded, not claimed to be semantically verified by AI.
- The current scheduler is the transparent `fixed-v1` fallback, not AI or personally fitted FSRS. A new card is due after one day. `again` resets its stage and schedules one day; `hard` preserves its stage but schedules one day; `good` advances the interval stage through 1/3/7/14/30 days. Changing a due date does not create a learning score. This exact fallback is a product rule, not a guarantee of an optimal interval.
- Test/review events record actual actions. A missed date is not a wrong answer; skipping, self-report and deterministic correction must remain distinct.
- Notes stay notes until an explicit conversion action. Notes, journal entries, audio and private reflection text are excluded from default insight inputs.
- Personal insights are deterministic summaries of permitted learning records. They must show their sample, time window and caveats. They do not establish diagnoses, personality, intelligence, psychological state or a fixed learning style.
- Event history is preserved during normal use. Intentional deletion is an exception to that retention rule. Any derived summary dependent on deleted evidence must be invalidated or recomputed.

## Voice recordings

- Recording starts only after the user requests it and the browser grants microphone access. Permission denial has a text-capture alternative.
- Recording, listening and saving are separate actions. There is no default transcription, external processing, or AI analysis.
- Saved audio is stored on the private server data volume. Playback/download requires a valid account session and ownership of the asset. The server must not serve the data directory as public static files.
- Avoid reusable signed bearer URLs for strict account isolation. An authenticated stream can be turned into a temporary local blob URL for playback; revoke that URL when the player unmounts or the account changes.
- Recording formats, interruptions and browser permission behavior need actual Safari/iPhone testing. Passing a desktop browser test is not evidence that every iPhone recording flow works.

## External AI and telemetry

The current application has no configured external AI provider and makes no external AI requests. Core lessons, reviews, palace and progress do not require one. There are no third-party advertising or analytics trackers by default.

A future integration requires a separate implementation and privacy review. Its request must have a specific purpose, an editable preview of the exact outgoing data and recipient, known cost/retention disclosures, and one explicit send confirmation. Changing the payload invalidates that confirmation. Notes, recordings, journals and unrelated records remain excluded. Canceling before send transfers nothing; canceling after send cannot promise that the provider has erased an already received payload.

Operational logs must omit passwords, session tokens, raw answer text, private notes, voice content, audio URLs and AI payloads. Error reporting must not attach full request bodies or automatically capture private screens. Any external error-monitoring vendor would be a new data recipient requiring review.

## Export and deletion

- Export requires a valid session and password confirmation. The versioned JSON includes the requesting account's state, owned historical snapshots, and available original voice bytes encoded as base64. A missing local voice file is reported explicitly in the export rather than silently fabricated. The current export is JSON, not a separate CSV archive.
- Account deletion verifies the account password and removes its owned records and sessions. It stages private audio for removal using a persistent file-cleanup queue. If physical cleanup fails, it returns a pending-files status rather than an unqualified successful erasure; server startup retries queued cleanup. Do not present a pending status as a finished physical purge.
- A live database deletion does not erase independent filesystem snapshots or provider backups. No cloud backup policy has been selected or verified. Before production, establish backup location, encryption, access controls, retention, restore behavior and the point at which a deletion ages out of backups.
- Restoring an old backup can restore previously deleted accounts unless deletion records are reapplied. A production restore procedure must address that case.
- The local implementation's database and files are ordinary private application data. Do not accidentally include them in git, build artifacts, diagnostics or a public download.

## Time and permissions

Actual event timestamps and review instants use UTC and are rendered using the configured IANA time zone, initially `Asia/Hebron`. Date-only habit logs and deadlines need local-date semantics. Changing timezone must not silently reinterpret historical rest/done choices.

Notification categories are preferences, not OS permission. Ask for permission following an explicit user action; do not make denial block learning. Web Push delivery is not guaranteed just because an in-app review exists.

## Proposed Supabase protection

`supabase/migrations/202611180001_mqw_proposed_schema.sql` is **unconnected preparation**, not an active backend adapter. It proposes:

- RLS on every client-visible private table, `auth.uid()` owner checks, and composite `(user_id, parent_id)` foreign keys to prevent cross-account relationships.
- Published versioned educational definitions, with answer keys and palace snapshots in an unexposed `private` schema.
- Client read-only access to learning evidence; privileged domain writes still require reviewed transactional server RPCs or an equivalent server adapter. This migration does not supply those RPCs.
- A private audio bucket with owner-prefixed paths and authenticated read/create/delete policies.

The optional isolation SQL includes A/B/anonymous fixture checks and rolls them back. Both SQL files were syntax-parsed, then the migration and isolation suite passed in **PGlite embedded PostgreSQL with minimal auth/storage stubs**. This exercises PostgreSQL constraints and policy checks; it does not verify Supabase authentication, HTTP APIs, Storage delivery, or a production deployment. The suite has **not been run against a full Supabase instance**. A complete adapter and real integration tests are required before switching runtime storage.

## Release evidence required

Before describing a deployment as production-ready, verify account isolation across all API routes, nested records, files and exports; double-submit and interrupted-save behavior; logout/account switching; password/session changes; private test-answer responses; export coverage and deletion failure handling; and actual iPhone Safari/PWA accessibility/recording behavior. Record passed checks separately from tests not run and features deliberately unavailable.
