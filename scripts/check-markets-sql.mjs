// PGLITE_MODULE=/tmp/bet-sql-tools/node_modules/@electric-sql/pglite/dist/index.js node scripts/check-markets-sql.mjs
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.env.PGLITE_MODULE),
  db = new PGlite();
await db.exec(`create role anon; create role authenticated;
create schema auth; create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
create table player_accounts(user_id uuid primary key,bankroll numeric,updated_at timestamptz);
create function ensure_player_account() returns void language sql as $$insert into player_accounts values(auth.uid(),1000,now()) on conflict do nothing$$;
create table fixtures(id text primary key,home text,away text,league text,kickoff timestamptz,completed boolean default false,voided boolean default false,odds jsonb,odds_source jsonb);
create table bets(id uuid primary key default gen_random_uuid(),user_id uuid,client_ref uuid,bet_type text,stake numeric,odds numeric,counts_general boolean,system_formula text,system_lines jsonb,selections jsonb);
insert into fixtures values('m','Alpha','Beta','Test',now()+interval '1 day',false,false,'{"home":2,"homeDnb":2.1,"homeOver15":1.8,"under":1.9}', '{"home":"estimated","homeDnb":"real","homeOver15":"real","under":"estimated"}');`);
const original = await readFile('supabase/migrations/20261110000005_legacy_v05.sql', 'utf8');
const start = original.indexOf('create or replace function public.system_lines('),
  end = original.indexOf('create or replace function public.place_bet(', start);
await db.exec(original.slice(start, end));
await db.exec(await readFile('supabase/migrations/20261110000036_legacy_v36.sql', 'utf8'));
await db.exec(await readFile('supabase/migrations/20261110000036_legacy_v36.sql', 'utf8'));
const place = (items, type = 'single', ref = null) =>
  db.query('select place_bet($1::jsonb,10,false,$2,null,$3::uuid) as bet', [
    JSON.stringify(items),
    type,
    ref
  ]);
const first = await place(
  [{ matchId: 'm', key: 'homeDnb', odd: 2.1, label: 'forged', line: 10 }],
  'single',
  '00000000-0000-0000-0000-000000000002'
);
assert.equal(first.rows[0].bet.selections[0].label, 'Alpha remboursé si nul');
assert.equal(first.rows[0].bet.selections[0].key, 'homeDnb');
await place(
  [{ matchId: 'm', key: 'homeDnb', odd: 2.1 }],
  'single',
  '00000000-0000-0000-0000-000000000002'
);
assert.equal(
  Number((await db.query('select bankroll from player_accounts')).rows[0].bankroll),
  990
);
await place([{ matchId: 'm', key: 'homeOver15', odd: 1.8 }]);
await assert.rejects(place([{ matchId: 'm', key: 'under', odd: 1.9 }]), /MARCHE_INDISPONIBLE/);
await assert.rejects(place([{ matchId: 'm', key: 'homeOver25', odd: 1.8 }]), /MARCHE_INDISPONIBLE/);
await assert.rejects(
  place([{ matchId: 'm', key: 'homeOver10', odd: 1.8 }]),
  /SELECTIONS_INVALIDES/
);
await assert.rejects(place([{ matchId: 'm', key: 'homeDnb', odd: 3 }]), /COTE_CHANGEE/);
await assert.rejects(
  place(
    [
      { matchId: 'm', key: 'homeDnb', odd: 2.1 },
      { matchId: 'm', key: 'homeOver15', odd: 1.8 }
    ],
    'combined'
  ),
  /MATCH_EN_DOUBLE/
);
await place([{ matchId: 'm', key: 'home', odd: 2 }]);
await db.exec("update fixtures set kickoff=now()-interval '1 minute'");
await assert.rejects(place([{ matchId: 'm', key: 'homeDnb', odd: 2.1 }]), /MATCH_COMMENCE/);
assert.equal((await db.query('select count(*)::int as n from bets')).rows[0].n, 3);
await db.close();
console.log(
  'BET-153 SQL : migration réexécutable, labels serveur, idempotence, lignes, cotes, source réelle, doublons et fermeture validés.'
);
