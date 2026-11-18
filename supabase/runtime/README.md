# Private PostgreSQL runtime

`schema.sql` is the reviewed SQL template for the cloud adapter. It preserves the SQLite record/auth codecs while moving durable state to private PostgreSQL tables. It is distinct from the archived normalized proposal at `supabase/proposals/normalized_schema.sql`.

The Supabase CLI generated `supabase/migrations/20261118155145_runtime_private_store.sql`, followed by `supabase/migrations/20261118155344_voice_ownership_index.sql`. Both have been applied to the inspected Free project. The second adds the composite voice-ownership index identified during advisor review; this template reflects the combined schema. Applied migration files remain immutable. Do not apply the archived normalized proposal automatically. Future migrations must also use the installed CLI's filename generation. CLI v3 targets local by default; remote targeting/confirmation must be explicit and verified against installed help. This template does not create migration-history records and contains no credentials.

The schema creates seven tables in `mqw_private`: `users`, `sessions`, `records`, `setup_tokens`, `idempotency`, `file_cleanup`, and `voice_blobs`. Serialized JSON remains `text`, UUIDs remain stable, and real instants use `timestamptz`. Audio has a composite ownership foreign key to record metadata and a 20 MiB byte limit. Audio bytes count against the **500 MB database allowance**, not Supabase's separate Storage allowance.

`mqw_app` is created `NOLOGIN`, `NOBYPASSRLS`, and without administrative privileges. The operator sets a strong private password and enables LOGIN separately after schema application. Do not use the administrative `postgres` connection as the runtime connection. Do not grant membership in privileged roles to `mqw_app`.

All tables enable and force RLS. Owner-scoped tables (`records`, `idempotency`, `voice_blobs`) deny rows when `mqw.user_id` is missing and enforce both `USING` and `WITH CHECK`. The auth/session/setup/cleanup tables intentionally permit only the trusted server role to perform pre-authentication operations. This is **custom cookie authentication**, not Supabase Auth; `auth.uid()` is not its identity source. Never pass `mqw.user_id` from a browser-supplied body or query parameter.

The server repository must acquire one client for each transaction and use:

1. `BEGIN`;
2. transaction-local owner context with parameterized `select set_config('mqw.user_id', $1, true)` after validating the session;
3. transaction-scoped advisory serialization for read-modify-write domain actions (`pg_advisory_xact_lock` with a stable application key, or an equivalent reviewed owner-key strategy);
4. awaited SQL operations, followed by `COMMIT` or `ROLLBACK`;
5. release of that same client.

`SET LOCAL` must not be replaced by a session-wide setting on pooled connections. Transaction rollback must clear owner identity, and callback promises must finish before COMMIT. The login path resolves an opaque cookie against `sessions` before establishing the owner context.

The PostgreSQL credential must remain server-only. Its ability to set owner context is trusted server authority. RLS protects against accidental missing owner predicates; it is not a claim that a compromised runtime credential can safely be handed to untrusted clients.

## Pooling without a paid IPv4 add-on

Use the project's **shared Supavisor session pooler**, port **5432**, for a persistent IPv4-only Node server. The username is `mqw_app.<PROJECT-REF>`. Copy the actual pooler hostname from the project's Connect dialog or authenticated Management API `GET /v1/projects/<ref>/config/database/pooler`. The hostname's cluster index cannot be inferred from region. Keep TLS certificate verification enabled and use a small application pool. Do not enable the paid IPv4 add-on or use a privileged connection to make a missing role grant appear to work.

Official references:

- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/database/postgres/roles
- https://supabase.com/docs/reference/api/v1-get-pooler-config
- https://supabase.com/changelog/supabase-cli-v3

## Local RLS verification

The optional runner applies the actual template to an isolated embedded PostgreSQL engine and tests policies/constraints with synthetic data only:

```bash
MQW_PGLITE_MODULE=/absolute/path/to/node_modules/@electric-sql/pglite node scripts/test-postgres-rls.mjs
```

The runner does not connect to Supabase, inspect credentials, or mutate remote state. Successful local results do not replace the operator's remote-role, Data API isolation, pooler-connectivity, or persistence-restart checks.

The current template passed 45 checks in this local engine, covering all seven RLS tables, missing-owner denial, A/B isolation, cross-owner foreign keys, audio size/chunk behavior, deletion cascades and consumed-invitation preservation. Re-run after schema changes; do not use the archived proposal's tests as runtime proof.
