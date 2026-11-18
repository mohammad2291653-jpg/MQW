-- Cover the composite ownership foreign key, including owner-only lookups.
begin;
drop index mqw_private.voice_blobs_owner_idx;
create index voice_blobs_owner_idx on mqw_private.voice_blobs(user_id, asset_id);
commit;
