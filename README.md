# MQW

Arabic-first private learning application. Next.js 16, React 19, TypeScript, Node.js 24 and a persistent SQLite backend.

## Run

```sh
npm ci
npm run dev
```

Open http://localhost:3000 and create your own account. No sample performance or user records are preloaded. The four lessons and the five-room palace are original educational content, not fabricated personal history.

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
- Password-confirmed JSON export including original audio encoded as base64 and historical palace snapshots; account deletion with durable file-cleanup retry.
- Mobile/desktop RTL shell, keyboard/tap alternatives, reduced motion, safe-area navigation and installable PWA assets.

## Verification

```sh
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Latest local verification: **32/32 unit/integration tests, 9/9 Chromium browser journey tests, TypeScript and production build passed**. Automated axe WCAG checks reported no violations on the six tested primary screen groups; that does not replace manual accessibility or physical-device testing. Production dependency audit reported zero known vulnerabilities.

Unit/integration tests exercise real SQLite isolation, passwords/sessions, request origins, duplicate submissions, drafts, grading boundaries, palace snapshots, private audio, export and deletion. Browser tests exercise the actual lesson/review/palace/organizer journeys and narrow layouts. The rescheduled-to-now review test proves persistence and flow; it is **not** a human delayed-retention experiment.

Run `node scripts/audit.mjs` while the dev server is open to audit primary screens with axe-core. Screenshots and reports are generated under `artifacts/` and `test-results/`; their accounts contain synthetic data.

## Current boundaries

- This running build uses **local server SQLite**, not an active Supabase connection or cloud sync. Keep `data/` on private persistent storage. The optional `supabase/` schema and tested SQL policies are preparation; there is no runtime Supabase adapter.
- Email delivery/verification/password-reset email is not configured. Reset reports this honestly. Signed-in users can change their password. Do not lose your password or expose registration publicly without configuring the intended account policy.
- There are no external AI calls, API keys, paid providers or background AI analysis. Core functionality works without them.
- Notifications are opt-in and **foreground-only**. No background push delivery service is configured.
- There is no full offline synchronization, 3D palace, transcription, document ingestion or external-calendar integration.
- Chromium browser tests include 390px mobile layouts; they do not certify physical iPhone Safari or installed iOS PWA behavior. Real-device microphone/interruption and PWA testing remain required before production acceptance.
- WebKit was downloaded in this workspace, but required system libraries were unavailable; no WebKit pass is claimed.
- The production build is compiled locally; no public deployment or billable infrastructure has been created.

Set `MQW_OWNER_EMAIL` before public hosting and `MQW_APP_ORIGIN` to the exact HTTPS origin behind a proxy. Production cookies require HTTPS. Read [deployment](docs/DEPLOYMENT.md) and [security](docs/SECURITY.md) before putting real personal data on a hosted instance.

The five personal source documents govern future changes and remain in the owner's private workspace. They are deliberately excluded from the public source repository.

## Production operation

`Dockerfile` runs Node 24 with the application as uid 1000, a persistent data directory, `/api/health` readiness checks and graceful shutdown. `render.yaml` proposes a separate single-instance Render service with a 1 GB persistent disk; it does not adopt unrelated services.

Public production requires `MQW_OWNER_EMAIL`, `MQW_SETUP_TOKEN_HASH`, and an exact HTTPS `MQW_APP_ORIGIN` (or Render's `RENDER_EXTERNAL_URL`). Registration requires a valid private one-use owner invitation. A successful registration consumes it, including after account deletion. Choose your password in the setup page; there is no default password.

`npm start` uses the guarded launcher and an ignored `.env.production.local` when present. `MQW_LOCAL_PREVIEW=1` is only for trusted local container checks.

`scripts/backup.mjs` provides tested native SQLite online backup, checksum verification and restore into a new/empty destination, including private audio and consumed invitation hashes. Restore revokes old sessions and never overwrites an existing data directory. Run maintenance as the application's uid; keep backups private. No scheduled/off-site backup is silently claimed.
