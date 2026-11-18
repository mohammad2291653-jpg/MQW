# Running MQW

The application currently runs on a local/private **Node.js + SQLite** backend. The optional Supabase folder is schema preparation; setting a Supabase URL alone will not switch storage. No production service or paid provider is created by these instructions.

## Requirements

- Node.js 24 (the runtime uses `node:sqlite`).
- npm and writable private storage.
- A modern browser. Microphone access normally requires HTTPS or a trusted localhost context.

From the repository directory:

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`, create a personal account with an email and a password, and use the app. This is real local account storage; it does not verify ownership of an email address. There is no configured email delivery service. A password-reset screen must not claim an email was sent when delivery is unavailable.

The development script listens on `0.0.0.0`; use a trusted environment or restrict access with a firewall. Access from another device over a plain LAN address may not allow microphone recording. Do not solve this by disabling browser security.

The default private data directory is `./data`. To select a different persistent location before starting:

```bash
MQW_DATA_DIR=/absolute/private/path/mqw-data npm run dev
```

`MQW_DATA_DIR` contains the SQLite database and private asset files. Never use a public/static directory for it, and do not put it in git. Changing this path points the app at a different database; it is not a data migration.

For an owner-only instance, set `MQW_OWNER_EMAIL` to your own normalized email address before registration. For example, use your host's private environment settings or pass it when starting the local process. New registrations with another email are rejected. This does not send email verification or remove accounts created before the guard was set. Do not treat it as a substitute for a strong password, TLS, or account-isolation checks.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

Browser tests, when present, run with:

```bash
npx playwright install chromium
npm run test:e2e
```

Installing a desktop browser does not replace manual or device-backed iPhone Safari and installed-PWA testing. Review the root README for the actual checks completed in this build and any remaining limitations.

## A safe single-instance hosting shape

The production Dockerfile and guarded launcher require owner email, a SHA-256 setup-token hash and an HTTPS application origin (or documented Render URL fallback). Generate private invitation material with `node scripts/prepare-owner-setup.mjs owner@example.com`; output stays in the ignored `.mqw-operator/` directory. There is no generated/default password. The owner chooses one through the private setup link. A consumed invitation cannot be reused after account deletion.

`render.yaml` proposes a NEW `0.5c-512mb` service in Frankfurt with a 1 GB disk at `/var/data`, `MQW_DATA_DIR=/var/data/mqw`, one instance, health checks and automatic deploys off. Current listed base cost is $7/month compute plus $0.25/GB/month disk, before taxes/other usage; verify during provisioning. Original personal source documents and private runtime/operator files are excluded from Git and Docker.

For this storage implementation, use one Node.js instance with a persistent private local filesystem, behind an HTTPS reverse proxy. Build with `npm run build`, then start with `npm start`. Production session cookies require HTTPS. Set `MQW_DATA_DIR` to the persistent volume path in the host's environment settings.

Verify `/api/health`, actual owner-scoped writes and persistence across a real service/container restart before accepting deployment. A successful build is not a live deployment.

The tested maintenance tool supports `node scripts/backup.mjs backup --source /var/data/mqw --destination /private/new-snapshot`, `verify --source SNAPSHOT` and `restore --source SNAPSHOT --destination NEW_OR_EMPTY_DIRECTORY`. Run as uid 1000 in the container and stop the app for restore. It checks SQLite integrity, foreign keys, audio references and hashes, preserves invitation replay prevention and invalidates old sessions after restore. It refuses to overwrite existing data. Backup scheduling, off-site location and retention remain explicit operational decisions.

Do not deploy the current SQLite backend into ephemeral serverless storage, a static-site host, a multi-instance autoscaling pool, or a shared network filesystem without a specific SQLite-compatible architecture. Otherwise data can disappear or different requests can see different databases. A Next.js static export cannot host the authenticated API.

Before exposing it outside a trusted environment:

1. Set `MQW_OWNER_EMAIL` to restrict account creation to the intended owner, and verify the guard in the deployed environment. Review any accounts created before it was enabled.
2. Configure HTTPS, a fixed intended origin and a trustworthy reverse proxy. Confirm cookies, Origin checks and password flows through that proxy.
3. Put the data volume outside application releases and public assets; restrict filesystem and backup access.
4. Decide retention and backups. Test restore together with deletion handling. A backup is another copy of private data.
5. Add real email/reset delivery if required. Never issue browser-visible reset tokens to unauthenticated callers or claim delivery without SMTP/service configuration.
6. Review resource limits, request rate limiting, storage capacity, audio quotas and operational logging.
7. Run the complete account-isolation, privacy, persistence and device acceptance suite against that deployment.

No domain, region, provider price or backup policy has been chosen by this repository. Deployment authorization does not make an unconfigured provider integration exist.

## Optional local Supabase schema review

This is for a disposable schema-test environment. It does **not** connect the Next.js app to Supabase, and it does not migrate SQLite records.

With the Supabase CLI, Docker, and `psql` installed, run from the repository root:

```bash
supabase start
supabase db reset
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/isolation.sql
```

`supabase db reset` destroys the local Supabase database state. Do not adapt this command to a production database. The fixture test must run only against disposable local data; it inserts artificial users and rolls back its transaction.

The proposed migration separates published lesson presentation from private answer keys, constrains child-owner relationships, enables RLS, and creates private audio policies. It intentionally does not grant ordinary clients write access to derived learning evidence.

A real Supabase transition still needs a runtime adapter, email/auth configuration, transactional lesson/review/palace APIs, storage upload/download behavior, data conversion and reconciliation, and integration tests. None of those are activated by this schema file. Preserve content versions and original event timestamps during any future migration; never synthesize historical attempts from summary scores.

For a lightweight PostgreSQL policy smoke test without Docker, the repository also includes a PGlite runner. Install its optional dependency outside the application, then run:

```bash
npm install --prefix /tmp/mqw-sql-test @electric-sql/pglite
MQW_PGLITE_MODULE=/tmp/mqw-sql-test/node_modules/@electric-sql/pglite node supabase/tests/embedded-isolation.cjs
```

This runner uses embedded PostgreSQL and minimal Supabase auth/storage stubs. It has passed in this workspace, including the complete migration and A/B/anonymous SQL fixtures. It is not a full Supabase integration test and does not test network/storage APIs or the Next.js runtime adapter.
