# Running and hosting MQW

The selected hosting path is **Render Free + Supabase Free private PostgreSQL**. Local SQLite remains supported. The Free Supabase project and its private schema exist; hosted application pooler connectivity and restart verification are still separate gates. Neither schema creation nor a successful build alone proves the application is live. The current `render.yaml` configures Free compute, PostgreSQL storage and no persistent disk.

## Local development

Requirements: Node.js 24, npm, and a modern browser. Both adapters run through Node 24; local mode uses its built-in `node:sqlite`.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. With no cloud settings, the app uses `./data/mqw.sqlite` and private files under the same data directory. `MQW_DATA_DIR` can select a different absolute private path. Development listens on `0.0.0.0`, so use a trusted environment or firewall. Microphone capture requires a secure browser context such as HTTPS or trusted localhost.

There are no preloaded personal results. Email/password authentication is real application storage, but email ownership verification and reset-email delivery are not configured. Do not claim an email was sent when that service is unavailable.

## Choose the storage backend explicitly

| Setting | Local SQLite | PostgreSQL cloud |
| --- | --- | --- |
| `MQW_STORAGE_BACKEND` | `sqlite`, or omitted without a database URL | Set explicitly to `postgres` |
| `MQW_DATA_DIR` | Private durable SQLite/audio directory | Any local working directory is scratch, not the source of durable records/audio |
| `MQW_DATABASE_URL` | Not used | Server-only restricted-role connection string |
| `MQW_DATABASE_CA_CERT` | Not used | Optional CA bundle for verified database TLS |

Set `MQW_STORAGE_BACKEND=postgres` on a free ephemeral host. If its database secret is missing, the service must fail closed rather than silently selecting local SQLite. A Supabase project API URL or publishable key is not a PostgreSQL connection string. Changing backends does **not** import, merge or erase the previous backend's data automatically.

Cloud mode retains the application's owner email/password, scrypt hashes and opaque HttpOnly session cookies. It does not use Supabase Auth/JWTs. Durable records and audio bytes live in the private `mqw_private` schema. Audio therefore consumes the **500 MB database allowance**, not Supabase's separate Storage allowance. Upload caps remain 20 MiB per recording and 200 MiB per account.

## Prepare the PostgreSQL runtime

The active CLI-generated migration chain is `supabase/migrations/20261118155145_runtime_private_store.sql`, followed by `supabase/migrations/20261118155344_voice_ownership_index.sql`. The second adds the composite voice-ownership index identified during advisor review. Both have been applied to the inspected Free project. `supabase/runtime/schema.sql` represents their combined state; do not edit an applied migration to fold in a later change. The archived `supabase/proposals/normalized_schema.sql` is a different earlier design and must not be applied as a runtime migration.

Use a migration administrator to apply the reviewed migration to the intended inspected project. Keep schema administration separate from the runtime connection. The migration creates `mqw_app` without login or bypass/admin privileges; the operator assigns its strong private password and enables LOGIN separately. Do not put passwords into tracked SQL files or use the administrative `postgres` login as application runtime.

Use the project's shared Supavisor **Session Pooler, port 5432**, for a persistent Node service on IPv4. The custom username is `mqw_app.<PROJECT-REF>`. Copy the actual pooler hostname from Connect or the authenticated Management API; a pooler cluster index cannot be inferred from region. Keep TLS certificate verification enabled. Do not enable the paid IPv4 add-on or dedicated paid pooler.

The seven private tables enable and force RLS. Records, idempotency and audio use transaction-local `mqw.user_id` established from the verified session; pre-auth account/session/setup operations are restricted to the trusted backend role. Browser Data API roles have no private-schema access. See [runtime details](../supabase/runtime/README.md) and [architecture](ARCHITECTURE.md).

Remote database checks confirmed all seven FORCE-RLS tables and denied anonymous/authenticated schema usage; the security advisor reported no findings at that checkpoint. This does not replace restricted application-login, API or hosting verification.

The Supabase CLI changes between versions. Discover actual commands and flags with `--help`; generate future migration filenames with `supabase migration new`. CLI v3 defaults to local targets, so remote application and confirmation must be explicit. Never run reset commands against a hosted personal database to repair a configuration issue.

## Guard owner setup and production startup

Configure server-side `MQW_OWNER_EMAIL`, `MQW_SETUP_TOKEN_HASH`, and exact HTTPS `MQW_APP_ORIGIN` (or the documented `RENDER_EXTERNAL_URL` fallback). Generate local invitation material with `scripts/prepare-owner-setup.mjs` according to its help; generated files remain in ignored `.mqw-operator/`. Do not print, commit or share the setup token publicly. There is no generated/default account password: the owner chooses one through the private setup page.

Registration consumes the one-use invitation. Deleting the account does not make that invitation reusable; reinitialization needs a rotated setup token. `MQW_OWNER_EMAIL` alone does not prove email ownership or replace the invitation/password checks.

```bash
npm run build
npm start
```

`npm start` loads an ignored `.env.production.local` when present and runs the guarded launcher. Configure production values through private host environment bindings. `MQW_LOCAL_PREVIEW=1` is only for trusted local testing, not a public-hosting workaround.

The Docker image uses Node 24, drops application privileges to uid 1000, binds `0.0.0.0:$PORT`, and forwards shutdown signals. `/api/health` checks readiness without exposing account or configuration details. Private specs, environment files, data, invitations and test artifacts are excluded from the image.

## Free Render configuration

Use a new web service on the **Free** compute plan, without a persistent disk, paid IPv4 add-on, paid database, or adopted business service. The repository's `render.yaml` is this free configuration: Docker, `/api/health`, explicit PostgreSQL, private owner/database bindings and automatic deploys off. Verify the intended reviewed source branch when creating the service.

Render Free can sleep after 15 minutes without incoming traffic and may take about a minute to resume. Its local filesystem is ephemeral and may disappear on sleep, restart or redeployment; PostgreSQL mode must keep no durable application data there. Free quotas can suspend service or builds when exhausted. Supabase Free can also pause after inactivity and has no included automatic-backup promise. These are bounded free services, not unlimited availability.

A static-site export cannot run the authenticated Node API. Do not deploy SQLite mode to a free ephemeral host and describe it as durable. A local SQLite deployment is possible only with separately selected persistent storage, which is outside the owner's current free-only hosting choice.

## Verification and release evidence

```bash
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Run checks appropriate to the changed backend. The recorded pre-conversion SQLite/browser baseline is not an automatic pass for PostgreSQL. The runtime SQL template has independently passed 45 isolated PGlite PostgreSQL role/RLS/ownership/cascade checks:

```bash
MQW_PGLITE_MODULE=/absolute/path/to/node_modules/@electric-sql/pglite node scripts/test-postgres-rls.mjs
```

That runner accesses no hosted project or credentials. Remote acceptance separately requires restricted-role connectivity, absence of browser Data API access, A/B account/audio isolation, idempotent lesson/review/palace persistence, export/delete and a real service restart with preserved data. A build trigger or healthy database does not establish a live application; confirm the deploy reaches its terminal live state and exercise it.

The current local regression checkpoint passed 37 SQLite/async-repository tests, nine Chromium journeys and one dedicated cache-reproduction browser check. A separate synthetic loopback-only application smoke passed against real local PostgreSQL 17.12 with CA/SAN-verified TLS and restricted `mqw_app`: concurrent lesson start/submission deduplication, lessons/reviews, private five-locus palace reveal/rating, A/B isolation/context reset, 1 MiB + 5 byte audio playback/export, rollback and password-confirmed deletion cascades. The temporary server, data and credentials were removed. This proves local wire/adapter behavior, not a connection from the hosted application to Supabase or a live Render deployment.

Chromium mobile layouts and axe checks do not certify physical iPhone Safari, installed PWA, microphone interruption or all assistive-technology behavior. Record checks not run instead of reporting universal device support.

## Backups and restoration

`scripts/backup.mjs` is **SQLite-only**. It creates a native online SQLite backup plus audio, verifies integrity/hashes, and restores into a new/empty directory. Run it as the application's uid and keep the snapshot private. It is not a PostgreSQL backup tool.

PostgreSQL needs a database-native offsite backup and tested restore procedure. The current cloud audio is part of the database, so include `voice_blobs` with auth records, snapshots, consumed invitations and event history. Restore must revoke old sessions and preserve invitation replay protection. No scheduled backup, retention policy or hosted restore test is silently claimed. A live deletion also does not erase independent backups immediately.

## Archived proposal checks

`supabase/tests/embedded-isolation.cjs` and `supabase/tests/isolation.sql` test only `supabase/proposals/normalized_schema.sql`. The embedded runner creates an isolated engine and applies that archived proposal with minimal auth/storage stubs. It is not evidence for the current runtime adapter. Do not run its fixture SQL against the live application or the new runtime schema.
