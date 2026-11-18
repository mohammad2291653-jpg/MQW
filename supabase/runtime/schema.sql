-- MQW private PostgreSQL runtime schema template.
-- This is NOT a numbered migration. Generate the actual migration through the
-- installed Supabase CLI, then copy this reviewed SQL into that generated file.
-- Apply using a migration administrator, never the application's runtime role.
-- No password, project identifier, owner email, or operator token belongs here.
begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'mqw_app') then
    create role mqw_app nologin nosuperuser nocreatedb nocreaterole
      noinherit noreplication nobypassrls;
  elsif exists (
    select 1 from pg_roles where rolname = 'mqw_app'
      and (rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls)
  ) then
    raise exception 'mqw_app already exists with elevated privileges; review it before applying MQW schema';
  end if;
end $$;

create schema mqw_private;
revoke all on schema mqw_private from public, anon, authenticated, service_role;
grant usage on schema mqw_private to mqw_app;

create table mqw_private.users (
  id uuid primary key,
  email text not null unique,
  name text not null,
  password_hash text not null,
  preferences text not null,
  created_at timestamptz not null
);

create table mqw_private.sessions (
  token_hash text primary key,
  user_id uuid not null references mqw_private.users(id) on delete cascade,
  expires_at timestamptz not null
);
create index sessions_owner_idx on mqw_private.sessions(user_id);
create index sessions_expiry_idx on mqw_private.sessions(expires_at);

create table mqw_private.records (
  id uuid primary key,
  user_id uuid not null references mqw_private.users(id) on delete cascade,
  collection text not null,
  -- Keep legacy serialized JSON codecs while preserving server API contracts.
  data text not null,
  secret text not null default '{}',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (user_id, id)
);
create index records_owner_collection_time_idx
  on mqw_private.records(user_id, collection, created_at desc, id);

create table mqw_private.setup_tokens (
  token_hash text primary key,
  consumed_at timestamptz not null
);

create table mqw_private.idempotency (
  user_id uuid not null references mqw_private.users(id) on delete cascade,
  key text not null,
  action text not null,
  result text not null,
  primary key (user_id, key)
);

-- Compatibility for the local-filesystem cleanup path. Cloud voice files use
-- voice_blobs and transactionally cascade; they do not enter this local queue.
create table mqw_private.file_cleanup (
  path text primary key,
  created_at timestamptz not null
);

create table mqw_private.voice_blobs (
  user_id uuid not null references mqw_private.users(id) on delete cascade,
  asset_id uuid primary key,
  bytes bytea not null,
  foreign key (user_id, asset_id)
    references mqw_private.records(user_id, id) on delete cascade,
  constraint voice_blob_size check (octet_length(bytes) between 1 and 20971520)
);
create index voice_blobs_owner_idx on mqw_private.voice_blobs(user_id, asset_id);

revoke all on all tables in schema mqw_private
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema mqw_private to mqw_app;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'users','sessions','records','setup_tokens','idempotency','file_cleanup','voice_blobs'
  ] loop
    execute format('alter table mqw_private.%I enable row level security', table_name);
    execute format('alter table mqw_private.%I force row level security', table_name);
  end loop;

  foreach table_name in array array['records','idempotency','voice_blobs'] loop
    execute format(
      'create policy owner_scope on mqw_private.%I for all to mqw_app '
      'using (user_id::text = (select current_setting(''mqw.user_id'', true))) '
      'with check (user_id::text = (select current_setting(''mqw.user_id'', true)))',
      table_name
    );
  end loop;

  -- These tables serve the trusted server's pre-authentication operations.
  -- No browser/API role has schema usage or table privileges. A runtime SQL
  -- credential is server authority, not an end-user database credential.
  foreach table_name in array array['users','sessions','setup_tokens','file_cleanup'] loop
    execute format(
      'create policy trusted_server_auth on mqw_private.%I for all to mqw_app '
      'using (true) with check (true)', table_name
    );
  end loop;
end $$;

-- There are intentionally no SECURITY DEFINER functions or Data API grants.
-- Future objects remain private unless a separate reviewed migration grants access.
alter default privileges in schema mqw_private
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema mqw_private
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges in schema mqw_private
  revoke execute on functions from public, anon, authenticated, service_role;

alter role mqw_app set search_path = pg_catalog, mqw_private;

comment on schema mqw_private is
  'Server-only MQW runtime. Keep out of Data API exposed schemas; no client keys have access.';
comment on policy owner_scope on mqw_private.records is
  'Custom cookie auth: server sets verified user UUID with transaction-local set_config(mqw.user_id). Not Supabase Auth/auth.uid().';
comment on table mqw_private.voice_blobs is
  'Private per-owner audio bytes; at most 20 MiB each. Counts against PostgreSQL quota, not Storage quota.';

commit;
