# MQW

Current hosting: **Render Free + Supabase Free private PostgreSQL** (the v3 redesign and MQW 90 on this branch are **not deployed**), with no persistent Render disk. Application commit `35aac55` reached Live and passed hosted HTTPS, ownership, redeployment-persistence and synthetic-data cleanup checks. The actual owner's account has not been created and its private invitation remains unconsumed. See [release verification](docs/RELEASE_VERIFICATION.md) and [free hosting limits](docs/FREE_HOSTING_PLAN.md).

Arabic-first private learning application. Next.js 16, React 19, TypeScript and Node.js 24, with asynchronous repositories for local SQLite or private PostgreSQL. Email/password authentication remains the application's owner-only cookie/session system; PostgreSQL mode does not switch to Supabase Auth.

## Run

```sh
npm ci
npm run dev
```

Open http://localhost:3000 and create your own account. No sample performance or user records are preloaded. The four lessons and the five-room palace are original educational content, not fabricated personal history.

With no database configuration, development uses SQLite under `data/`. Cloud mode requires explicit `MQW_STORAGE_BACKEND=postgres` and a private `MQW_DATABASE_URL` for the restricted runtime role. A project API URL alone is not a database connection. Do not paste credentials into chat, commit them, or prefix them with `NEXT_PUBLIC_`.

## Implemented

- Email/password accounts, hashed session tokens in HttpOnly cookies, authenticated routes and owner-scoped data.
- Four versioned Arabic lessons: retrieval practice, useful self-tests, spacing and metacognitive calibration.
- Persisted answers before feedback, interrupted-draft recovery, explicit self-grading, preserved retry history and factual progress.
- Real review cards with editable dates, saved ratings and transparent `fixed-v1` scheduling.
- Illustrated 2D five-locus palace, guided tour, editable associations, separate route and concept tests, concealed answers, skips and later retests.
- Subjects/topics, study sessions and persistent timers.
- Notes, optional journal, manual note-to-task conversion, importance-ranked tasks/projects, optional local time blocks, flexible habits, goals and optional weekly review.
- User-initiated microphone recording, local preview, private upload/playback/delete without transcription.
- Deterministic evidence-linked factual insights, dismissal/inaccuracy feedback and personalization controls. No psychological profiling.
- Password-confirmed streaming JSON export including original audio encoded as base64 and historical palace snapshots. SQLite account deletion uses durable file-cleanup retry; PostgreSQL deletes owned audio/records through database cascades.
- Mobile/desktop RTL shell, keyboard/tap alternatives, reduced motion, safe-area navigation and installable PWA assets.
- **v3 Icy-Sapphire identity** (diamond white, chrome silver, ink black, icy sapphire; no purple): Alexandria headings, IBM Plex Sans Arabic body, glossy primary actions. See [design system](docs/DESIGN_SYSTEM.md).
- **MQW 90 — My Evolution** (`/evolution`, entered from Today and My Space, no sixth tab): editable 90-day cycle with phases, Daily Compass, skin and scalp/beard logs with private photo comparison, supplement schedules with taken/skipped/postponed history, PPL templates and set logging, opt-in wellbeing, life balance and weekly review, factual cycle report. Tracking only; no doses, protocols or diagnoses. See [MQW 90](docs/MQW90.md). Structured data needs no schema migration. Private photos work in local/SQLite mode. Cloud mode has the code path but keeps photos disabled until the proposed `media_blobs` migration is approved and applied.

## Verification

```sh
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Recorded local regression evidence (v3 branch, 2026-11-19): **48/48 SQLite/async-repository tests (38 existing + 10 MQW 90), 11/11 Chromium browser journeys (9 existing + 2 MQW 90, including axe on 8 MQW 90 screens and 390px overflow checks), TypeScript and the production build passed**. The earlier 38/9 evidence below refers to the deployed commit. The 38-test suite includes 18 fresh-process cold SQLite initialization. These checks cover their recorded phases; physical-device behavior is not certified. Automated axe reports remain bounded to the screens tested.

The private PostgreSQL template passed **45 role/RLS/ownership/cascade checks** in isolated PGlite PostgreSQL. An additional **real local PostgreSQL 17.12 wire/TLS smoke test passed** using a restricted `mqw_app` role, verified CA/SAN, and synthetic loopback-only data. It covered concurrent lesson start/submission deduplication, lessons/reviews, a private five-locus palace trial with reveal/rating, A/B isolation and owner-context reset, 1 MiB + 5 byte audio playback/export, rollback, and password-confirmed cascading deletion. Its temporary server, data and credentials were removed. This is application-adapter evidence against local PostgreSQL, not proof of a Supabase or Render application connection.

Hosted verification additionally passed **21/21 final anonymous HTTPS probes**, strict-TLS private PostgreSQL access, seeded-account learning/review/palace/organizer/audio/export flows, A/B access denial, cookie protection and session revocation. Full-state hashes for both synthetic accounts and original audio/export bytes matched after a real application redeployment; an existing session cookie remained valid. HSTS was verified with a one-year max-age and includeSubDomains. See [release verification](docs/RELEASE_VERIFICATION.md) for scope and deferred checks.

The remote database migration check confirmed seven FORCE-RLS tables, no anonymous/authenticated schema access, and no security-advisor findings at that checkpoint. After password-confirmed deletion of the synthetic accounts, their old cookies/credentials failed and independent database counts confirmed zero application accounts, sessions, evidence, audio, idempotency and consumed setup tokens. No real owner account or sample performance was left behind.

Unit/integration tests exercise real SQLite isolation, passwords/sessions, request origins, duplicate submissions, drafts, grading boundaries, palace snapshots, private audio, export and deletion. Browser tests exercise the actual lesson/review/palace/organizer journeys and narrow layouts. The rescheduled-to-now review test proves persistence and flow; it is **not** a human delayed-retention experiment.

Run `node scripts/audit.mjs` while the dev server is open to audit primary screens with axe-core. Screenshots and reports are generated under `artifacts/` and `test-results/`; their accounts contain synthetic data.

## Current boundaries

- Local mode uses private SQLite/files; cloud mode uses `mqw_private` PostgreSQL tables with a restricted server-only role and owner-context RLS. Cloud voice bytes count against the database quota. The older normalized proposal at `supabase/proposals/normalized_schema.sql` is archived design material, not the runtime migration.
- Email delivery/verification/password-reset email is not configured. Reset reports this honestly. Signed-in users can change their password. Do not lose your password or expose registration publicly without configuring the intended account policy.
- No external AI provider or AI API key is configured, and there is no background AI analysis. Lessons, reviews, palace and factual insights use internal rules. PostgreSQL connection credentials are separate server-only infrastructure secrets.
- Notifications are opt-in and **foreground-only**. No background push delivery service is configured.
- There is no full offline synchronization, 3D palace, transcription, document ingestion or external-calendar integration.
- Chromium browser tests include 390px mobile layouts; they do not certify physical iPhone Safari or installed iOS PWA behavior. Real-device microphone/interruption and PWA testing remain required before production acceptance.
- WebKit was downloaded in this workspace, but required system libraries were unavailable; no WebKit pass is claimed.
- The verified deployment uses Free Render compute and Supabase Free, with no paid disk, IPv4 add-on or external AI. Free-service sleep, cold starts, pauses and quotas remain operating limits.

Set `MQW_OWNER_EMAIL` before public hosting and `MQW_APP_ORIGIN` to the exact HTTPS origin behind a proxy. Production cookies require HTTPS. Read [deployment](docs/DEPLOYMENT.md) and [security](docs/SECURITY.md) before putting real personal data on a hosted instance.

The five personal source documents govern future changes and remain in the owner's private workspace. They are deliberately excluded from the public source repository.

## Production operation

`Dockerfile` runs Node 24 with the application as uid 1000, `/api/health` readiness checks and graceful shutdown. PostgreSQL mode needs no persistent local disk. SQLite mode requires private durable storage and must not be used on an ephemeral free service. The current `render.yaml` configures a new Free service without a disk and keeps database/owner secrets in private environment bindings.

Public production requires `MQW_OWNER_EMAIL`, `MQW_SETUP_TOKEN_HASH`, and an exact HTTPS `MQW_APP_ORIGIN` (or Render's `RENDER_EXTERNAL_URL`). Registration requires a valid private one-use owner invitation. A successful registration consumes it, including after account deletion. Choose your password in the setup page; there is no default password.

`npm start` uses the guarded launcher and an ignored `.env.production.local` when present. `MQW_LOCAL_PREVIEW=1` is only for trusted local container checks.

`scripts/backup.mjs` is a **SQLite-only** maintenance tool: online backup, checksum verification and restore into a new/empty destination, including private audio and consumed invitation hashes. Restore revokes old sessions. PostgreSQL needs its own database-native backup/restore procedure, including session revocation and invitation replay protection. No scheduled/off-site backup is claimed.

The runtime migration chain is [20261118155145_runtime_private_store.sql](supabase/migrations/20261118155145_runtime_private_store.sql), followed by [20261118155344_voice_ownership_index.sql](supabase/migrations/20261118155344_voice_ownership_index.sql). Both were CLI-generated and applied to the inspected Free project. The [reviewed runtime template](supabase/runtime/schema.sql) represents their combined state; applied migration files remain immutable. See [architecture](docs/ARCHITECTURE.md) and [deployment](docs/DEPLOYMENT.md) for backend boundaries and verification requirements.
