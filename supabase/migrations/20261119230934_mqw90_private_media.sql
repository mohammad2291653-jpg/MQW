-- MQW 90 private photo bytes (owner-approved 2026-11-19).
-- Generated with the Supabase CLI from the reviewed proposal
-- supabase/proposals/mqw90_private_media.sql. Additive only: creates one table;
-- no existing table or row is modified. The application detects this table at
-- runtime and enables cloud photos. Rollback: drop table mqw_private.media_blobs.
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
