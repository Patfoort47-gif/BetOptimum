const { PGlite } = await import(process.env.PGLITE_MODULE ?? '@electric-sql/pglite');
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create table player_accounts(user_id uuid,bankroll numeric,initial numeric,created_at timestamptz);
create table bets(id uuid,user_id uuid,placed_at timestamptz,settled_at timestamptz,stake numeric,odds numeric,status text,payout numeric,bet_type text,selections jsonb,system_lines jsonb);
create table capital_events(user_id uuid,amount numeric,created_at timestamptz);`);
await db.exec(await readFile('supabase/migrations/supabase-v37-schema.sql', 'utf8'));
const uid = '00000000-0000-0000-0000-000000000001',
  other = '00000000-0000-0000-0000-000000000002';
await db.exec(`set test.uid='${uid}';insert into player_accounts values('${uid}',1015,1000,now()-interval '3 days');insert into player_accounts values('${other}',99999,99999,now());
insert into bets select ('10000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'${uid}',now()-interval '2 days',now()-interval '1 day',10,2,'void',10,'single','[{"match":"Paris - Lyon","label":"Paris gagne","key":"home","odd":2,"matchId":"test-paris-lyon"}]',null from generate_series(1,21) i;
insert into bets values('20000000-0000-0000-0000-000000000001','${uid}',now()-interval '2 days',now()-interval '1 day',10,2,'won',20,'single','[]',null),('20000000-0000-0000-0000-000000000002','${uid}',now()-interval '2 days',now()-interval '1 day',10,2,'lost',0,'combined','[]',null),('20000000-0000-0000-0000-000000000003','${uid}',now()-interval '1 day',null,10,2,'pending',0,'combined','[]',null),('20000000-0000-0000-0000-000000000004','${uid}',now()-interval '2 days',now()-interval '1 day',30,2,'won',15,'multiple','[]','[{"indexes":[],"stake":10,"odds":2},{"indexes":[],"stake":20,"odds":3}]'),('20000000-0000-0000-0000-000000000005','${other}',now(),null,100,20,'pending',0,'single','[]',null);
insert into capital_events values('${uid}',40,now()-interval '2 days');`);
const get = async (days = null, status = 'all', search = '', page = 1) =>
  (await db.query('select my_bet_dashboard($1,$2,$3,$4) data', [days, status, search, page]))
    .rows[0].data;
const data = await get();
assert.equal(data.rows.length, 20);
assert.equal(data.total, 25);
assert.equal(data.summary.net, -15);
assert.equal(data.summary.engaged, 10);
assert.equal(data.summary.potential, 20);
assert.equal(data.summary.bankroll, 1015);
assert.equal(data.curve.at(-1).balance, 1015);
assert.equal(data.baseline, 1000);
assert.equal(data.history.settled, 3);
const second = await get(null, 'all', '', 2);
assert.equal(second.rows.length, 5);
assert.equal(new Set([...data.rows, ...second.rows].map((b) => b.id)).size, 25);
assert.equal((await get(7, 'void', 'Paris')).total, 21);
assert.equal((await get(null, 'void', '%')).total, 0);
assert.equal((await get(null, 'all', '', 999)).page, 2);
await db.exec(`set test.uid='${other}'`);
assert.equal((await get()).total, 1);
await db.exec("set test.uid=''");
await assert.rejects(get(), /AUTH_REQUIRED/);
console.log(
  'SQL dashboard : pages, filtres, isolation, 4 statuts, gain partiel, solde et courbe vérifiés.'
);
await db.close();
