// Recette PostgreSQL isolée : npm install --prefix /tmp/bet-ui-tools @electric-sql/pglite
const fs = require('node:fs'),
  assert = require('node:assert/strict');
(async () => {
  const { PGlite } = process.env.PGLITE_MODULE
    ? await import(require('node:url').pathToFileURL(process.env.PGLITE_MODULE).href)
    : require('@electric-sql/pglite');
  const db = new PGlite();
  await db.exec(
    `create schema auth;create role anon;create role authenticated;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create table player_accounts(user_id uuid,bankroll numeric,created_at timestamptz);create table bets(id uuid,user_id uuid,placed_at timestamptz,settled_at timestamptz,status text,stake numeric,payout numeric,odds numeric,bet_type text,selections jsonb,system_lines jsonb);`
  );
  await db.exec(fs.readFileSync('supabase/migrations/supabase-v47-schema.sql', 'utf8'));
  const uid = '00000000-0000-0000-0000-000000000001',
    other = '00000000-0000-0000-0000-000000000002';
  await db.query(`select set_config('test.uid',$1,false)`, [uid]);
  await db.query(`insert into player_accounts values($1,1000,now()-interval '100 days')`, [uid]);
  const sample = [
    ['won', 10, 25, 'Paris', 1],
    ['lost', 20, 0, 'Lyon', 2],
    ['pending', 30, 0, 'Paris', 3],
    ['void', 5, 5, 'Lyon', 40],
    ['won', 10, 1000, 'Secret', 1]
  ];
  for (let i = 0; i < sample.length; i++) {
    const [status, stake, payout, match, age] = sample[i];
    await db.query(
      `insert into bets values($1,$2,now()-$3::int*interval '1 day',case when $4='pending' then null else now() end,$4,$5,$6,2,'single',$7,null)`,
      [
        `10000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
        i === 4 ? other : uid,
        age,
        status,
        stake,
        payout,
        JSON.stringify([{ match, label: 'Victoire', league: 'Ligue 1' }])
      ]
    );
  }
  for (const days of [null, 7, 30, 90])
    for (const status of ['all', 'pending', 'settled', 'won', 'lost', 'void'])
      for (const search of ['', 'Paris', 'Lyon', 'absent']) {
        const expected = sample
          .slice(0, 4)
          .filter(
            (r) =>
              (days === null || r[4] < days) &&
              (status === 'all' ||
                r[0] === status ||
                (status === 'settled' && r[0] !== 'pending')) &&
              (!search || r[3].includes(search))
          );
        const { rows } = await db.query(`select my_bet_dashboard($1,$2,$3,1) data`, [
          days,
          status,
          search
        ]);
        const d = rows[0].data;
        assert.equal(d.total, expected.length);
        assert.equal(d.rows.length, expected.length);
        assert.equal(d.summary.total, expected.length);
        assert.equal(
          d.summary.staked,
          expected.reduce((n, r) => n + r[1], 0)
        );
        const net = expected.filter((r) => r[0] !== 'pending').reduce((n, r) => n + r[2] - r[1], 0);
        assert.equal(d.summary.net, net);
        assert.equal(
          d.summary.decided_staked,
          expected.filter((r) => ['won', 'lost'].includes(r[0])).reduce((n, r) => n + r[1], 0)
        );
        assert.equal(
          d.bars.reduce((n, b) => n + b.net, 0),
          net
        );
        assert.equal(d.curve.at(-1)?.balance ?? 0, net);
        assert.equal(d.summary.bankroll, 1000);
        assert.ok(!JSON.stringify(d).includes('Secret'));
      }
  for (let i = 0; i < 25; i++)
    await db.query(`insert into bets values($1,$2,now(),now(),'won',10,20,2,'single','[]',null)`, [
      `20000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
      uid
    ]);
  for (const [requested, page, count] of [
    [1, 1, 20],
    [2, 2, 9],
    [999, 2, 9]
  ]) {
    const { rows } = await db.query(`select my_bet_dashboard(null,'all','',$1) data`, [requested]);
    assert.equal(rows[0].data.page, page);
    assert.equal(rows[0].data.rows.length, count);
    assert.equal(rows[0].data.summary.total, 29);
    assert.equal(rows[0].data.summary.decided_staked, 280);
    assert.equal(rows[0].data.total, 29);
  }
  await db.query(`select set_config('test.uid','',false)`);
  await assert.rejects(db.query(`select my_bet_dashboard()`), /AUTH_REQUIRED/);
  await db.close();
  console.log(
    'OK : 96 combinaisons période/statut/recherche, liste/indicateurs/graphiques cohérents, agrégats sur toutes les pages, pagination bornée, isolation des comptes et connexion obligatoire.'
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
