// PGLITE_MODULE=../work/ui/node_modules/@electric-sql/pglite/dist/index.js node scripts/check-confirmed-ranking.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE ?? '@electric-sql/pglite'),
  db = new PGlite();
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'),
  q = async (s, p = []) => (await db.query(s, p)).rows;
try {
  await db.exec(await read('tests/fixtures/ranking-schema.sql'));
  await db.exec(`create schema auth;create table auth.users(id uuid primary key);alter table player_league add column inactive boolean default false,add column protected boolean default false;
 create table league_groups(id bigint primary key,season text,echelon int,label text);create table group_members(season text,user_id uuid,group_id bigint);
 create table special_titles(league_id text,season text,user_id uuid,kind text);`);
  await db.exec(await read('supabase/migrations/20261110000030_legacy_v30.sql'));
  await db.exec(await read('supabase/migrations/20261110000032_legacy_v32.sql'));
  await db.exec(
    `create function apply_league_round(p_week date,p_results jsonb,p_groups jsonb) returns boolean language plpgsql as $$begin insert into league_round_results select p_week,(x->>'user_id')::uuid,x from jsonb_array_elements(p_results) x;return true;end$$;`.replace(
      'create function',
      'create or replace function'
    )
  );
  const migration = await read('supabase/migrations/20261110000038_legacy_v38.sql');
  await db.exec(migration);
  const a = '00000000-0000-0000-0000-000000000001',
    b = '00000000-0000-0000-0000-000000000002',
    c = '00000000-0000-0000-0000-000000000003';
  await q(`insert into auth.users values($1),($2),($3)`, [a, b, c]);
  await q(`insert into profiles(user_id,nickname) values($1,'A'),($2,'B'),($3,'C')`, [a, b, c]);
  await q(`insert into player_league(user_id) values($1),($2),($3)`, [a, b, c]);
  // A : un gain isolé 40 ; B : 5/11, -10 ; C : 10/20, zéro. Annulation hors décisions.
  for (const [user, n, wins] of [
    [a, 1, 1],
    [b, 11, 5],
    [c, 20, 10]
  ])
    for (let i = 0; i < n; i++) {
      const status = i < wins ? 'won' : 'lost',
        odd = user === a ? 5 : 2,
        points = status === 'won' ? 10 * (odd - 1) : -10;
      await q(
        `insert into bets(id,user_id,status,odds,stake,settled_at) values(gen_random_uuid(),$1,$2,$3,10,'2026-11-10') returning id`,
        [user, status, odd]
      ).then(async (rows) =>
        q(
          `insert into league_entries(bet_id,user_id,points,season,settled_at) values($1,$2,$3,'2027-2028','2026-11-10')`,
          [rows[0].id, user, points]
        )
      );
    }
  await q(`insert into daily_picks(user_id,status,odd) values($1,'void',2) returning id`, [a]).then(
    async (rows) =>
      q(
        `insert into league_entries(daily_pick_id,user_id,points,season,settled_at) values($1,$2,0,'2027-2028','2026-11-10')`,
        [rows[0].id, a]
      )
  );
  const weekly = await q(
    `select user_id,confirmed,ranking_version,decided from league_round_ranking('2026-11-09') order by user_id`
  );
  assert.deepEqual(
    weekly.map((r) => [r.confirmed, r.ranking_version, Number(r.decided)]),
    [
      [false, 3, 1],
      [true, 3, 11],
      [true, 3, 20]
    ]
  );
  assert.ok(
    (await q(`select * from league_round_ranking('2026-11-02')`)).every(
      (r) => r.confirmed && r.ranking_version === 2
    )
  );
  await db.exec(
    `create or replace function football_season(p_date timestamptz default now()) returns text language sql stable as $$select '2027-2028'::text$$;`
  );
  const general = await q(
    'select user_id,rank,confirmed from public_ranking_season order by rank nulls last'
  );
  assert.deepEqual(
    general.map((r) => [r.user_id, Number(r.rank) || null, r.confirmed]),
    [
      [c, 1, true],
      [b, 2, true],
      [a, null, false]
    ]
  );
  await q(`insert into private_league_members values($1,$1,now()),($2,$1,now()),($3,$1,now())`, [
    a,
    b,
    c
  ]);
  const priv = await q(
    `select user_id,rank,confirmed from private_league_ranking($1,'2027-2028')`,
    [a]
  );
  assert.deepEqual(priv, general);
  assert.equal(
    (await q(`select ranking_version('2026-11-02'),ranking_version('2026-11-09') v3`))[0].v3,
    3
  );
  await q(
    `insert into league_rounds(week_start,season) values('2026-11-09','2026-2027') on conflict do nothing`
  );
  await q(`select apply_league_round('2026-11-09',$1,'[]')`, [
    JSON.stringify([{ user_id: a, group_rank: null, ranking_version: 999 }])
  ]);
  assert.equal((await q('select result from league_round_results'))[0].result.ranking_version, 3);
  const before = JSON.stringify(await q('select * from league_round_results'));
  await db.exec(migration);
  assert.equal(JSON.stringify(await q('select * from league_round_results')), before);
  assert.equal(
    (
      await q(
        `select has_function_privilege('anon','private_league_ranking(uuid,text)','EXECUTE') allowed`
      )
    )[0].allowed,
    false
  );
  console.log(
    'V38 : migration réexécutable, bascule 2/3, décisions hors annulations, 1/1 vs 5/11 vs 10/20, SQL public/privé identique, archives intactes, droits vérifiés.'
  );
} finally {
  await db.close();
}
