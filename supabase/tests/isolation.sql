-- ARCHIVED NORMALIZED PROPOSAL ONLY: supabase/proposals/normalized_schema.sql.
-- These are not tests of the current private PostgreSQL runtime.
-- Run ONLY against a disposable database after manually applying that proposal.
-- Every fixture is rolled back. Requires a database owner connection.
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.assert_true(ok boolean, label text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
end $$;

insert into auth.users (id, aud, role, email, encrypted_password)
values
 ('00000000-0000-4000-8000-000000000001','authenticated','authenticated','mqw-fixture-a@example.invalid','not-a-login'),
 ('00000000-0000-4000-8000-000000000002','authenticated','authenticated','mqw-fixture-b@example.invalid','not-a-login');
insert into public.goals (id,user_id,title) values
 ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','fixture-A-goal'),
 ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','fixture-B-goal');
insert into public.notes (id,user_id,title,body) values
 ('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','fixture-A-note','A private'),
 ('20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','fixture-B-note','B private');
insert into public.tasks (id,user_id,title) values
 ('40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','fixture-A-task');
insert into storage.objects (bucket_id,name) values
 ('mqw-voice','00000000-0000-4000-8000-000000000001/fixture-A.webm'),
 ('mqw-voice','00000000-0000-4000-8000-000000000002/fixture-B.webm');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

select pg_temp.assert_true(
 (select count(*) = 1 from public.notes where title like 'fixture-%'),
 'A sees only its own note');
select pg_temp.assert_true(
 not exists (select 1 from public.notes where id = '20000000-0000-4000-8000-000000000002'),
 'guessed B note ID is not readable');
select pg_temp.assert_true(
 (select count(*) = 1 from storage.objects where bucket_id = 'mqw-voice' and name like '%fixture-%'),
 'A sees only own authenticated audio object');
do $$
declare changed integer;
begin
  update public.notes set body = 'forged' where id = '20000000-0000-4000-8000-000000000002';
  get diagnostics changed = row_count;
  perform pg_temp.assert_true(changed = 0, 'A cannot update B note');
  delete from public.notes where id = '20000000-0000-4000-8000-000000000002';
  get diagnostics changed = row_count;
  perform pg_temp.assert_true(changed = 0, 'A cannot delete B note');
  begin
    insert into public.notes (user_id,body) values ('00000000-0000-4000-8000-000000000002','forged owner');
    raise exception 'FAIL: forged owner insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.notes set user_id = '00000000-0000-4000-8000-000000000002'
      where id = '20000000-0000-4000-8000-000000000001';
    raise exception 'FAIL: ownership reassignment unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.goal_links (user_id,goal_id,task_id)
    values ('00000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001');
    raise exception 'FAIL: cross-owner relation unexpectedly succeeded';
  exception when foreign_key_violation then null;
  end;
  begin
    perform * from private.lesson_answer_keys;
    raise exception 'FAIL: answer key unexpectedly readable';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.lesson_attempts (user_id,lesson_version_id)
      values ('00000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001');
    raise exception 'FAIL: raw evidence insertion unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Switch identity within the same database session to expose owner-cache leaks.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select pg_temp.assert_true(
 (select count(*) = 1 from public.notes where title = 'fixture-B-note'),
 'B can see B note after identity switch');
select pg_temp.assert_true(
 not exists (select 1 from public.notes where title = 'fixture-A-note'),
 'B cannot see cached A note after identity switch');

set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$
begin
  begin
    perform * from public.notes;
    raise exception 'FAIL: anonymous private-table read unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
\echo 'MQW proposed-schema isolation checks passed; fixtures rolled back.'
