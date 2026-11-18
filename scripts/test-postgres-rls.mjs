/** Isolated real-PostgreSQL checks. No network, credentials or remote mutations. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.MQW_PGLITE_MODULE || '@electric-sql/pglite');
const database = new PGlite();
const ownerA = '10000000-0000-4000-8000-000000000001';
const ownerB = '10000000-0000-4000-8000-000000000002';
const recordA = '20000000-0000-4000-8000-000000000001';
const recordB = '20000000-0000-4000-8000-000000000002';
const recordA2 = '20000000-0000-4000-8000-000000000003';
const recordB2 = '20000000-0000-4000-8000-000000000004';
let checks = 0;
let savepoint = 0;

function verify(condition, description) {
  assert.ok(condition, description);
  checks++;
}
async function count(table, suffix = '', values = []) {
  const result = await database.query(`select count(*)::integer as n from mqw_private.${table} ${suffix}`, values);
  return result.rows[0].n;
}
async function denied(sql, values = [], codes = ['42501']) {
  const marker = `expected_denial_${++savepoint}`;
  await database.exec(`savepoint ${marker}`);
  let error;
  try { await database.query(sql, values); }
  catch (failure) { error = failure; }
  await database.exec(`rollback to savepoint ${marker}; release savepoint ${marker}`);
  verify(!!error && codes.includes(error.code), `expected SQL rejection ${codes.join('/')} without exposing another owner; got ${error?.code || 'no error'}`);
}
async function asRuntime(owner, callback, commit = false) {
  await database.exec('begin; set local role mqw_app');
  try {
    if (owner !== undefined) await database.query("select set_config('mqw.user_id', $1, true)", [owner]);
    await callback();
    await database.exec(commit ? 'commit' : 'rollback');
  } catch (error) {
    await database.exec('rollback');
    throw error;
  }
}

try {
  // These names model the Data API roles, not Supabase Auth or its HTTP layer.
  await database.exec('create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls');
  const schema = await readFile(new URL('../supabase/runtime/schema.sql', import.meta.url), 'utf8');
  await database.exec(schema);

  const role = (await database.query("select rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolreplication,rolbypassrls from pg_roles where rolname='mqw_app'")).rows[0];
  verify(Object.values(role).every(value => value === false), 'runtime role starts NOLOGIN and without elevated attributes');
  const tables = (await database.query(`
    select c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) as owner
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='mqw_private' and c.relkind='r'
  `)).rows;
  verify(tables.length === 7 && tables.every(table => table.relrowsecurity && table.relforcerowsecurity && table.owner !== 'mqw_app'), 'all seven tables force RLS and are not owned by runtime');
  const functions = (await database.query("select count(*)::integer n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='mqw_private' and p.prosecdef")).rows[0].n;
  verify(functions === 0, 'no SECURITY DEFINER bypass is introduced');

  await database.query(`insert into mqw_private.users(id,email,name,password_hash,preferences,created_at)
    values ($1,'a@example.invalid','Fixture A','synthetic-not-login','{}',now()),
           ($2,'b@example.invalid','Fixture B','synthetic-not-login','{}',now())`, [ownerA, ownerB]);
  await database.query(`insert into mqw_private.records(id,user_id,collection,data,secret,created_at,updated_at)
    values ($1,$2,'voiceAssets','{}','{"snapshot":"synthetic A"}',now(),now()),
           ($3,$4,'voiceAssets','{}','{"snapshot":"synthetic B"}',now(),now()),
           ($5,$4,'voiceAssets','{}','{}',now(),now())`, [recordA, ownerA, recordB, ownerB, recordB2]);
  await database.query(`insert into mqw_private.voice_blobs(user_id,asset_id,bytes)
    values ($1,$2,decode('0001','hex')),($3,$4,decode('0002','hex'))`, [ownerA, recordA, ownerB, recordB]);
  await database.query(`insert into mqw_private.sessions(token_hash,user_id,expires_at)
    values ('fixture-a',$1,now()+interval '1 day'),('fixture-b',$2,now()+interval '1 day')`, [ownerA, ownerB]);
  await database.query(`insert into mqw_private.idempotency(user_id,key,action,result)
    values ($1,'same-key','fixture','{}'),($2,'same-key','fixture','{}')`, [ownerA, ownerB]);
  await database.exec("insert into mqw_private.setup_tokens(token_hash,consumed_at) values ('synthetic-consumed-setup',now())");

  for (const apiRole of ['anon', 'authenticated', 'service_role']) {
    await database.exec(`begin; set local role ${apiRole}`);
    await denied('select * from mqw_private.users');
    await denied('select * from mqw_private.records');
    await denied('select * from mqw_private.voice_blobs');
    await database.exec('rollback');
  }

  await asRuntime(undefined, async () => {
    verify(await count('records') === 0, 'records fail closed without owner context');
    verify(await count('idempotency') === 0, 'idempotency fails closed without owner context');
    verify(await count('voice_blobs') === 0, 'voice fails closed without owner context');
    verify(await count('users') === 2 && await count('sessions') === 2, 'trusted server can perform pre-auth identity/session lookup');
    verify(await count('setup_tokens') === 1, 'trusted server can verify setup consumption before owner context');
    await denied(`insert into mqw_private.records(id,user_id,collection,data,created_at,updated_at)
      values ($1,$2,'notes','{}',now(),now())`, [recordA2, ownerA]);
  });

  await asRuntime(ownerA, async () => {
    verify(await count('records') === 1, 'unfiltered record query sees only owner A');
    verify(await count('voice_blobs') === 1, 'unfiltered audio query sees only owner A');
    verify(await count('idempotency') === 1, 'same idempotency key is isolated by owner');
    verify(await count('records', 'where id=$1', [recordB]) === 0, 'guessed B record ID remains hidden');
    verify((await database.query('update mqw_private.records set secret=$1 where id=$2 returning id', ['{}', recordB])).rows.length === 0, 'A cannot update B evidence');
    verify((await database.query('delete from mqw_private.records where id=$1 returning id', [recordB])).rows.length === 0, 'A cannot delete B evidence');
    await denied('update mqw_private.records set user_id=$1 where id=$2', [ownerB, recordA]);
    await denied(`insert into mqw_private.records(id,user_id,collection,data,created_at,updated_at)
      values ($1,$2,'notes','{}',now(),now())`, [recordA2, ownerB]);
    await denied('update mqw_private.voice_blobs set user_id=$1 where asset_id=$2', [ownerB, recordA]);
    // Matching user ownership must hold for BOTH sides, not merely the new row.
    await denied('insert into mqw_private.voice_blobs(user_id,asset_id,bytes) values ($1,$2,decode(\'00\',\'hex\'))', [ownerA, recordB2], ['23503']);
    await database.query(`insert into mqw_private.records(id,user_id,collection,data,created_at,updated_at)
      values ($1,$2,'voiceAssets','{}',now(),now())`, [recordA2, ownerA]);
    await denied('insert into mqw_private.voice_blobs(user_id,asset_id,bytes) values ($1,$2,decode(repeat(\'00\',20971521),\'hex\'))', [ownerA, recordA2], ['23514']);
    await denied('insert into mqw_private.voice_blobs(user_id,asset_id,bytes) values ($1,$2,decode(\'\',\'hex\'))', [ownerA, recordA2], ['23514']);
    await database.query('insert into mqw_private.voice_blobs(user_id,asset_id,bytes) values ($1,$2,decode(repeat(\'abcd\',393216),\'hex\'))', [ownerA, recordA2]);
    const bytes = (await database.query(`select octet_length(bytes) as size,
      encode(substring(bytes from 3 for 4),'hex') as chunk
      from mqw_private.voice_blobs where asset_id=$1`, [recordA2])).rows[0];
    verify(bytes.size === 786432 && bytes.chunk === 'abcdabcd', 'bytea length and bounded substring preserve native audio bytes');
    await database.query('delete from mqw_private.records where id=$1', [recordA2]);
    verify(await count('voice_blobs', 'where asset_id=$1', [recordA2]) === 0, 'deleting audio metadata cascades its private bytes');
    await denied('create table mqw_private.unreviewed_table(id integer)');
    await denied('truncate mqw_private.records');
  });

  await asRuntime(ownerB, async () => {
    verify(await count('records') === 2 && await count('records', 'where id=$1', [recordA]) === 0, 'B gets its own state after pooled identity switch');
    verify(await count('voice_blobs') === 1, 'B cannot see A audio after identity switch');
  });
  await asRuntime(undefined, async () => {
    verify(await count('records') === 0, 'transaction-local owner context does not leak to the next request');
    await database.exec('set local row_security=off');
    await denied('select * from mqw_private.records');
  });

  await asRuntime(ownerA, async () => {
    await database.query('select pg_advisory_xact_lock($1)', [7219010]);
    await database.query('delete from mqw_private.users where id=$1', [ownerA]);
  }, true);
  verify(await count('users', 'where id=$1', [ownerA]) === 0, 'owner deletion removes the account');
  verify(await count('records', 'where user_id=$1', [ownerA]) === 0, 'owner deletion cascades evidence');
  verify(await count('voice_blobs', 'where user_id=$1', [ownerA]) === 0, 'owner deletion cascades audio bytes');
  verify(await count('idempotency', 'where user_id=$1', [ownerA]) === 0, 'owner deletion cascades idempotency receipts');
  verify(await count('sessions', 'where user_id=$1', [ownerA]) === 0, 'owner deletion revokes opaque sessions');
  verify(await count('records', 'where user_id=$1', [ownerB]) === 2, 'other owner evidence survives deletion');
  verify(await count('setup_tokens') === 1, 'consumed setup token remains consumed after account deletion');

  console.log(`PASS: ${checks} private-runtime PostgreSQL role/RLS/ownership/cascade checks.`);
  console.log('Scope: actual DDL in isolated PGlite PostgreSQL; no hosted project, pooler, API or secrets accessed.');
} finally {
  await database.close();
}
