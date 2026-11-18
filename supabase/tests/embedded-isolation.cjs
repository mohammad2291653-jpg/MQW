// ARCHIVED NORMALIZED PROPOSAL ONLY, not the active MQW runtime migration.
// Optional executable policy smoke test. Uses real embedded PostgreSQL through
// PGlite, but stubs Supabase's auth/storage infrastructure. This does not verify
// Supabase HTTP APIs, JWT validation, Storage delivery or any runtime adapter.
const { PGlite } = require(process.env.MQW_PGLITE_MODULE || '@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const database = new PGlite();
  try {
    await database.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create schema storage;
      grant usage on schema public, auth, storage to anon, authenticated;
      create table auth.users (
        id uuid primary key, aud text, role text, email text, encrypted_password text
      );
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
      $$;
      create table storage.buckets (
        id text primary key, name text, public boolean,
        file_size_limit bigint, allowed_mime_types text[]
      );
      create table storage.objects (
        id uuid primary key default gen_random_uuid(),
        bucket_id text references storage.buckets(id), name text
      );
      alter table storage.objects enable row level security;
      grant select,insert,delete on storage.objects to authenticated;
      -- Only the first path component is used by these owner policies.
      create function storage.foldername(name text) returns text[]
        language sql immutable as $$select string_to_array(name,'/')$$;
    `);
    const migration = fs.readFileSync(path.join(__dirname,
      '../proposals/normalized_schema.sql'), 'utf8');
    await database.exec(migration);
    const checks = fs.readFileSync(path.join(__dirname, 'isolation.sql'), 'utf8')
      .split('\n').filter(line => !line.startsWith('\\')).join('\n');
    await database.exec(checks);
    console.log('PASS: archived normalized proposal applied; A/B/anonymous SQL isolation checks passed and rolled back.');
    console.log('Scope: embedded PostgreSQL with auth/storage stubs; full Supabase integration remains untested.');
  } finally {
    await database.close();
  }
})().catch(error => {
  console.error('FAIL:', error.message);
  if (error.detail) console.error(error.detail);
  process.exitCode = 1;
});
