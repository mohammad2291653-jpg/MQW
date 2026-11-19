-- PROPOSAL ONLY — NOT APPLIED. Requires explicit owner approval before use.
--
-- Purpose: enable MQW 90 private progress photos in PostgreSQL (cloud) mode.
-- The application already contains the PostgreSQL code path (src/lib/server/media.ts,
-- export streaming). It detects this table at runtime; until it exists, cloud mode
-- refuses photo uploads (HTTP 501). All other MQW 90 data already lives in
-- mqw_private.records and needs NO schema change.
--
-- Before applying (see docs/MQW90.md → "Production gate"):
--   1. Take and verify a database-native backup, and test a restore.
--   2. Generate a real migration with the Supabase CLI and paste this reviewed SQL.
--   3. Apply as the migration administrator, never as mqw_app.
--   4. Verify with synthetic accounts (upload, owner-only read, export, delete).
--   5. Quota impact: photo bytes count against the database quota (Free tier is small).
begin;

create table mqw_private.media_blobs (
  user_id uuid not null references mqw_private.users(id) on delete cascade,
  asset_id uuid primary key,
  bytes bytea not null,
  foreign key (user_id, asset_id)
    references mqw_private.records(user_id, id) on delete cascade,
  constraint media_blob_size check (octet_length(bytes) between 1 and 8388608)
);
create index media_blobs_owner_idx on mqw_private.media_blobs(user_id, asset_id);

revoke all on mqw_private.media_blobs from public, anon, authenticated, service_role;
grant select, insert, update, delete on mqw_private.media_blobs to mqw_app;
alter table mqw_private.media_blobs enable row level security;
alter table mqw_private.media_blobs force row level security;
create policy owner_scope on mqw_private.media_blobs for all to mqw_app
  using (user_id::text = (select current_setting('mqw.user_id', true)))
  with check (user_id::text = (select current_setting('mqw.user_id', true)));

comment on table mqw_private.media_blobs is
  'MQW 90 private photos (EXIF stripped). Owner-only; no public URL; cascades with the owning record and account.';

commit;
