const { PGlite } = await import(process.env.PGLITE_MODULE ?? '@electric-sql/pglite');
const { pgcrypto } = await import(
  new URL(
    './contrib/pgcrypto.js',
    process.env.PGLITE_MODULE
      ? new URL('file://' + process.env.PGLITE_MODULE)
      : import.meta.resolve('@electric-sql/pglite')
  ).href
);
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(
  `create role anon;create role authenticated;create schema auth;create schema extensions;create extension pgcrypto with schema extensions;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create table public.private_leagues(id uuid primary key default gen_random_uuid(),name text,emblem text,owner_id uuid references auth.users,code text unique constraint private_leagues_code_check check(code ~ '^BM-[A-HJ-NP-Z2-9]{4}$'));create table public.private_league_members(league_id uuid references private_leagues,user_id uuid references auth.users,primary key(league_id,user_id));create function public.ensure_player_account() returns void language sql as $$ select $$;grant usage on schema public,auth to authenticated,anon;`
);
const users = [
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003'
];
for (const uid of users) await db.query('insert into auth.users values($1)', [uid]);
await db.query(
  "insert into private_leagues(name,emblem,owner_id,code) values('Ancienne','ball',$1,'BM-AB2C')",
  [users[0]]
);
const sql = await readFile('supabase/migrations/20261110000102_legacy_v62.sql', 'utf8');
await db.exec(sql);
await db.exec(sql);
const codes = (
  await db.query('select public.private_league_code() code from generate_series(1,1000)')
).rows.map((r) => r.code);
assert.equal(new Set(codes).size, 1000);
assert.ok(codes.every((c) => /^BM-[A-HJ-NP-Z2-9]{8}$/.test(c)));
await db.query(
  "insert into private_leagues(name,emblem,owner_id,code) values('Nouvelle','ball',$1,$2)",
  [users[0], codes[0]]
);
const join = async (code) =>
  (await db.query('select join_private_league($1) data', [code])).rows[0].data;
await db.exec(`set test.uid='${users[1]}';set role authenticated;`);
assert.equal((await join('bmab2c')).code, 'BM-AB2C');
assert.equal((await join(codes[0].toLowerCase().replace('-', ''))).code, codes[0]);
assert.equal((await join(codes[0])).code, codes[0]);
for (let i = 0; i < 10; i++) assert.equal((await join('invalid-' + i)).error, 'CODE_INVALIDE');
assert.equal((await join(codes[0])).error, 'TROP_ESSAIS_LIGUE');
await assert.rejects(db.query('select * from private_join_attempts'), /permission denied/);
await db.exec('reset role');
assert.equal(
  (
    await db.query('select cardinality(failures) n from private_join_attempts where user_id=$1', [
      users[1]
    ])
  ).rows[0].n,
  10
);
await db.exec(`set test.uid='${users[2]}';set role authenticated;`);
assert.equal((await join(codes[0])).code, codes[0]);
await db.exec('reset role');
await db.query(
  "update private_join_attempts set failures=array(select now()-interval '61 minutes' from generate_series(1,10)) where user_id=$1",
  [users[1]]
);
await db.exec(`set test.uid='${users[1]}';set role authenticated;`);
assert.equal((await join(codes[0])).code, codes[0]);
await db.exec('reset role;set role anon');
await assert.rejects(join('BM-AB2C'), /permission denied/);
await db.exec("reset role;set test.uid=''");
await assert.rejects(join('BM-AB2C'), /AUTH_REQUIRED/);
await db.close();
console.log(
  'OK SQL BET-304 : vrai pgcrypto, 1000 codes, anciens/nouveaux liens, dix échecs persistants, blocage, expiration, isolation et droits, migration deux fois.'
);
