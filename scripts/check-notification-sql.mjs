// PGLITE_MODULE=/tmp/bet-ui-tools/node_modules/@electric-sql/pglite/dist/index.js node scripts/check-notification-sql.mjs
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite(),
  uid = '00000000-0000-0000-0000-000000000001';
await db.exec(
  `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select '${uid}'::uuid$$;create table public.player_accounts(user_id uuid,bankroll numeric);create table public.bets(id uuid,user_id uuid,status text,bet_type text,stake numeric,odds numeric,selections jsonb);create table public.user_states(user_id uuid primary key,state jsonb);insert into auth.users values('${uid}');`
);
// V23 possède des extensions d’export sans rapport : prendre les tables et RPC notification.
let v23 = await readFile('supabase/migrations/supabase-v23-schema.sql', 'utf8');
v23 = v23.slice(0, v23.indexOf('-- Étend l’export existant')) + 'commit;';
await db.exec(v23);
for (const v of [24, 26, 27, 28, 33, 34, 43, 43])
  await db.exec(await readFile(`supabase/migrations/supabase-v${v}-schema.sql`, 'utf8'));
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
await q(`insert into notification_endpoints(user_id,channel,encrypted) values($1,'email','demo')`, [
  uid
]);
const p = {
  enabled: true,
  channels: ['email'],
  daily_briefing: true,
  briefing_minute: 0,
  timezone: 'Europe/Paris',
  quiet_start: 600,
  quiet_end: 1000,
  min_value: 0.05,
  min_confidence: 0.6,
  teams: [],
  leagues: [],
  max_per_hour: 3
};
await q('select save_notification_preferences($1)', [JSON.stringify(p)]);
assert.equal((await q('select quiet_start from notification_preferences'))[0].quiet_start, 0);
const [{ date_label: day }] = await q(
    `select (now() at time zone 'Europe/Paris')::date::text as date_label`
  ),
  event = {
    briefing: true,
    kinds: ['daily'],
    daily_revision: 0,
    date: day,
    kickoff: new Date(Date.now() + 3600000).toISOString()
  };
const queue = async (e = event) =>
  (await q('select enqueue_notification_briefing($1,$2) ok', [uid, JSON.stringify(e)]))[0].ok;
assert.equal(await queue(), true);
assert.equal(await queue(), false);
await q(`update notification_deliveries set status='cancelled'`);
await q(`update notification_preferences set daily_revision=1`);
assert.equal(await queue({ ...event, daily_revision: 1 }), true);
assert.equal((await q('select count(*)::int n from notification_deliveries'))[0].n, 1);
await q(`update notification_preferences set quiet_start=0,quiet_end=1439`);
assert.equal((await q('select * from claim_notification_deliveries()')).length, 1);
await q(`update notification_deliveries set status='sent'`);
await q(`update notification_preferences set daily_revision=2`);
assert.equal(await queue({ ...event, daily_revision: 2 }), false);
await q(`insert into user_states values($1,'{"favoriteTeams":["Lille"],"favoriteLeagues":[]}')`, [
  uid
]);
assert.deepEqual(
  (await q('select notification_briefing_snapshot($1) s', [uid]))[0].s.favorites.teams,
  ['Lille']
);
await q(`update notification_preferences set enabled=false`);
assert.equal(await queue({ ...event, daily_revision: 2 }), false);

// BET-69 : Telegram ne dépend ni du consentement ni de l'horaire email.
assert.equal((await q('select my_telegram_notifications() s'))[0].s.preferences.enabled, false);
assert.equal(
  (
    await q(
      "select has_table_privilege('authenticated','notification_telegram_preferences','select') ok"
    )
  )[0].ok,
  false
);
assert.equal(
  (
    await q(
      "select has_function_privilege('authenticated','enqueue_telegram_notification(uuid,jsonb)','execute') ok"
    )
  )[0].ok,
  false
);
await q(`insert into notification_endpoints values($1,'telegram','demo',now())`, [uid]);
const telegram = {
  enabled: true,
  min_value: 0.1,
  min_confidence: 0.65,
  max_per_day: 2,
  quiet_start: 0,
  quiet_end: 0,
  timezone: 'Europe/Paris'
};
await q('select save_telegram_notifications($1)', [JSON.stringify(telegram)]);
assert.equal((await q('select enabled from notification_preferences'))[0].enabled, false);
const signal = {
  telegram: true,
  match_id: 'one',
  market: 'home',
  value: 0.2,
  confidence: 0.8,
  kickoff: new Date(Date.now() + 3600000).toISOString(),
  expires_at: new Date(Date.now() + 1800000).toISOString()
};
const enqueue = async (e = signal) =>
  (await q('select enqueue_telegram_notification($1,$2) ok', [uid, JSON.stringify(e)]))[0].ok;
assert.equal(await enqueue({ ...signal, value: 0.01 }), false);
assert.equal(
  await enqueue({ ...signal, expires_at: new Date(Date.now() - 1000).toISOString() }),
  false
);
assert.equal(await enqueue(), true);
assert.equal(await enqueue({ ...signal, market: 'away', odd: 10 }), false);
assert.equal(await enqueue({ ...signal, match_id: 'two' }), true);
assert.equal(await enqueue({ ...signal, match_id: 'three' }), true);
assert.equal((await q('select * from claim_notification_deliveries()')).length, 0);
assert.equal((await q('select * from claim_telegram_notifications()')).length, 2);
assert.equal(
  (
    await q(
      "select count(*)::int n from notification_deliveries where channel='telegram' and status='cancelled'"
    )
  )[0].n,
  1
);
// Un résultat incertain consomme le plafond, aucun nouvel envoi du même jour.
await q(
  "update notification_deliveries set status='unknown' where channel='telegram' and status='sending'"
);
assert.equal(await enqueue({ ...signal, match_id: 'four' }), true);
assert.equal((await q('select * from claim_telegram_notifications()')).length, 0);
// Les tests restent explicites et dédupliqués par heure.
assert.equal(await enqueue({ ...signal, test_channel: 'telegram' }), true);
assert.equal(await enqueue({ ...signal, test_channel: 'telegram' }), false);
assert.equal((await q('select * from claim_telegram_notifications()')).length, 1);
await q(
  "update notification_deliveries set status='sent' where channel='telegram' and status='sending'"
);
// Silence sur la minute courante : ne doit rien réserver.
await q('select save_telegram_notifications($1)', [
  JSON.stringify({ ...telegram, quiet_start: 0, quiet_end: 1439 })
]);
assert.equal(await enqueue({ ...signal, match_id: 'quiet' }), true);
assert.equal((await q('select * from claim_telegram_notifications()')).length, 0);
assert.equal(
  (await q('select notification_telegram_snapshot($1) s', [uid]))[0].s.favorites.teams[0],
  'Lille'
);
await q('select disconnect_telegram_notifications()');
assert.equal((await q('select my_telegram_notifications() s'))[0].s.associated, false);
assert.equal(await enqueue({ ...signal, match_id: 'disabled' }), false);
// Isolation propriétaire : RPC sans identifiant arbitraire, autres comptes invisibles.
const other = '00000000-0000-0000-0000-000000000002';
await q('insert into auth.users values($1)', [other]);
await q('insert into notification_telegram_preferences(user_id,enabled) values($1,true)', [other]);
assert.equal((await q('select my_telegram_notifications() s'))[0].s.preferences.user_id, uid);
await q('select unsubscribe_notifications()');
assert.equal(
  (await q('select enabled from notification_telegram_preferences where user_id=$1', [uid]))[0]
    .enabled,
  false
);
await q('delete from auth.users where id=$1', [other]);
assert.equal(
  (
    await q('select count(*)::int n from notification_telegram_preferences where user_id=$1', [
      other
    ])
  )[0].n,
  0
);
// BET-242 : push existant conservé, rappels distincts et consentement explicite.
for (const v of [50, 54, 54])
  await db.exec(await readFile(`supabase/migrations/supabase-v${v}-schema.sql`, 'utf8'));
assert.equal(
  (await q('select my_web_notifications() s'))[0].s.preferences.favorite_reminders,
  false
);
assert.equal(
  (
    await q(
      "select has_function_privilege('authenticated','enqueue_web_notification(uuid,jsonb)','execute') ok"
    )
  )[0].ok,
  false
);
await q(`insert into notification_endpoints(user_id,channel,encrypted) values($1,'web','demo')`, [
  uid
]);
const web = { ...telegram, enabled: true, favorite_reminders: false };
await q('select save_web_notifications($1)', [JSON.stringify(web)]);
const [{ clock }] = await q('select now() as clock'),
  start = new Date(clock).getTime();
const reminder = {
  web: true,
  favorite_reminder: true,
  match_id: 'favorite-one',
  home: 'Lille',
  away: 'Paris',
  kickoff: new Date(start + 7200000).toISOString(),
  expires_at: new Date(start + 900000).toISOString()
};
const enqueueWeb = async (e = reminder) =>
  (await q('select enqueue_web_notification($1,$2) ok', [uid, JSON.stringify(e)]))[0].ok;
assert.equal(await enqueueWeb(), false);
await q('select save_web_notifications($1)', [
  JSON.stringify({ ...web, favorite_reminders: true })
]);
assert.equal(
  await enqueueWeb({
    ...reminder,
    match_id: 'early',
    kickoff: new Date(start + 7500000).toISOString()
  }),
  false
);
assert.equal(
  await enqueueWeb({
    ...reminder,
    match_id: 'late',
    kickoff: new Date(start + 6000000).toISOString()
  }),
  false
);
assert.equal(await enqueueWeb(), true);
assert.equal(
  await enqueueWeb({ ...reminder, kickoff: new Date(start + 7100000).toISOString() }),
  false
);
assert.equal(await enqueueWeb({ ...reminder, match_id: 'favorite-two' }), true);
assert.equal(await enqueueWeb({ ...reminder, match_id: 'favorite-three' }), true);
assert.equal((await q('select * from claim_web_notifications()')).length, 3);
await q("update notification_deliveries set status='sent' where channel='web'");
// Le plafond des opportunités ne compte pas les rappels.
for (const id of ['opportunity-one', 'opportunity-two', 'opportunity-three'])
  assert.equal(
    await enqueueWeb({
      ...signal,
      web: true,
      telegram: false,
      match_id: id,
      favorite_reminder: false
    }),
    true
  );
assert.equal((await q('select * from claim_web_notifications()')).length, 2);
await q(
  "update notification_deliveries set status='sent' where channel='web' and status='sending'"
);
assert.equal(await enqueueWeb({ ...reminder, match_id: 'favorite-four' }), true);
assert.equal((await q('select * from claim_web_notifications()')).length, 1);
await q(
  "update notification_deliveries set status='sent' where channel='web' and status='sending'"
);
assert.equal(await enqueueWeb({ ...reminder, match_id: 'revoked' }), true);
await q('select save_web_notifications($1)', [JSON.stringify(web)]);
assert.equal((await q('select * from claim_web_notifications()')).length, 0);
await q('select save_web_notifications($1)', [
  JSON.stringify({ ...web, favorite_reminders: true, quiet_start: 0, quiet_end: 1439 })
]);
assert.equal(await enqueueWeb({ ...reminder, match_id: 'quiet-web' }), true);
assert.equal((await q('select * from claim_web_notifications()')).length, 0);
await q('select unsubscribe_notifications()');
assert.equal((await q('select my_web_notifications() s'))[0].s.associated, false);
assert.equal(await enqueueWeb({ ...reminder, match_id: 'unsubscribed' }), false);
// BET-243 : le worker GitHub ne réserve plus les rappels du minuteur serveur.
for (const v of [55, 55])
  await db.exec(await readFile(`supabase/migrations/supabase-v${v}-schema.sql`, 'utf8'));
await q(`insert into notification_endpoints(user_id,channel,encrypted) values($1,'web','demo')`, [
  uid
]);
await q('select save_web_notifications($1)', [
  JSON.stringify({ ...web, favorite_reminders: true })
]);
assert.equal(await enqueueWeb({ ...reminder, match_id: 'scheduled-only' }), true);
assert.equal((await q('select * from claim_web_notifications()')).length, 0);
assert.equal((await q('select * from claim_favorite_reminders()')).length, 1);
assert.equal((await q('select * from claim_favorite_reminders()')).length, 0);
// Bail atomique : deux déclenchements simultanés ne lancent pas deux traitements.
assert.equal((await q('select claim_notification_scheduler() ok'))[0].ok, false);
await q(
  "update notification_scheduler set enabled=true,dry_run=false,endpoint='https://test.supabase.co/functions/v1/notifications'"
);
assert.equal((await q('select claim_notification_scheduler() ok'))[0].ok, true);
assert.equal((await q('select claim_notification_scheduler() ok'))[0].ok, false);
await q('select finish_notification_scheduler(true,1,1)');
assert.equal((await q('select last_ok from notification_scheduler'))[0].last_ok, true);
assert.equal((await q('select claim_notification_scheduler() ok'))[0].ok, true);
await q('select finish_notification_scheduler(false,0,0)');
assert.equal(
  (await q("select has_table_privilege('authenticated','notification_scheduler','select') ok"))[0]
    .ok,
  false
);
assert.equal(
  (
    await q(
      "select has_function_privilege('authenticated','claim_notification_scheduler()','execute') ok"
    )
  )[0].ok,
  false
);
// Stubs des seules extensions réseau/cron : la logique du minuteur est exécutée sans appel externe.
await db.exec(
  `create schema vault;create table vault.decrypted_secrets(name text,decrypted_secret text);insert into vault.decrypted_secrets values('betoptimum_notification_scheduler','fictive-test-secret-at-least-32-characters');create schema net;create table net.requests(url text,body jsonb,headers jsonb);create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds int) returns bigint language plpgsql as $$begin insert into net.requests values(url,body,headers);return 1;end$$;create schema cron;create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;`
);
let schedulerSQL = await readFile('supabase/notification-scheduler.sql', 'utf8');
schedulerSQL = schedulerSQL.replace(/^create extension[^;]+;$/gm, '');
await db.exec(schedulerSQL);
await db.exec(schedulerSQL);
assert.equal((await q('select tick_notification_scheduler() id'))[0].id, 1);
const [request] = await q('select * from net.requests');
assert.equal(request.body.action, 'scheduled-reminders');
assert.equal(request.body.dry_run, false);
assert.ok(request.headers['x-scheduler-secret']);
assert.equal(
  (
    await q(
      "select has_function_privilege('authenticated','tick_notification_scheduler()','execute') ok"
    )
  )[0].ok,
  false
);
assert.equal(
  (
    await q(
      "select has_function_privilege('service_role','tick_notification_scheduler()','execute') ok"
    )
  )[0].ok,
  false
);
await q('update notification_scheduler set enabled=false');
assert.equal((await q('select tick_notification_scheduler() id'))[0].id, null);
// BET-255 : plus de plafond quotidien, mais aucune deuxième réservation du même événement.
await db.exec('create table public.fixtures(id text primary key)');
for (const v of [56, 58, 58])
  await db.exec(await readFile(`supabase/migrations/supabase-v${v}-schema.sql`, 'utf8'));
await q(
  "update notification_deliveries set status='cancelled' where channel='web' and status in ('pending','sending')"
);
await q(
  `insert into notification_endpoints(user_id,channel,encrypted) values($1,'web','demo') on conflict do nothing`,
  [uid]
);
await q('select save_web_notifications($1)', [
  JSON.stringify({ ...web, max_per_day: 1, favorite_reminders: true, essential: false })
]);
for (const id of ['uncapped-1', 'uncapped-2', 'uncapped-3'])
  assert.equal(
    await enqueueWeb({
      ...signal,
      web: true,
      telegram: false,
      match_id: id,
      favorite_reminder: false
    }),
    true
  );
assert.equal((await q('select * from claim_web_notifications()')).length, 3);
assert.equal((await q('select * from claim_web_notifications()')).length, 0);
// BET-257 : résumé désactivé par défaut, même unicité compte/date à travers les relances.
for (const v of [59, 59])
  await db.exec(await readFile(`supabase/migrations/supabase-v${v}-schema.sql`, 'utf8'));
assert.equal(
  (await q('select daily_summary from notification_web_preferences'))[0].daily_summary,
  false
);
assert.equal(
  (
    await q(
      "select has_function_privilege('authenticated','enqueue_daily_web_summary(uuid,jsonb)','execute') ok"
    )
  )[0].ok,
  false
);
await q('select save_web_notifications($1)', [
  JSON.stringify({ ...web, quiet_start: 0, quiet_end: 0, daily_summary: true })
]);
// Un fuseau POSIX de recette place l’horloge à 9 h sans changer l’horloge du moteur.
await q(
  `with clock as (select floor(extract(epoch from (now() at time zone 'UTC')::time))::int-32400 delta) update notification_web_preferences set timezone=(select 'UTC'||case when delta>=0 then '+' else '-' end||(abs(delta)/3600)::text||':'||lpad(((abs(delta)%3600)/60)::text,2,'0')||':'||lpad((abs(delta)%60)::text,2,'0') from clock)`
);
const [dailyClock] = await q(
  `select timezone,(now() at time zone timezone)::date::text date from notification_web_preferences`
);
const daily = {
  web: true,
  daily_summary: true,
  date: dailyClock.date,
  timezone: dailyClock.timezone,
  picks: [{ match_id: 'one', odd: 2 }],
  kickoff: new Date(Date.now() + 600000).toISOString(),
  expires_at: new Date(Date.now() + 600000).toISOString()
};
const dailyQueue = async (e) =>
  (await q('select enqueue_daily_web_summary($1,$2) ok', [uid, JSON.stringify(e)]))[0].ok;
assert.equal(await dailyQueue(daily), true);
assert.equal(await dailyQueue(daily), false);
assert.equal((await q('select * from claim_favorite_reminders()')).length, 1);
assert.equal((await q('select * from claim_favorite_reminders()')).length, 0);
await q('update notification_web_preferences set daily_summary=false');
assert.equal(await dailyQueue({ ...daily, date: '2099-01-01' }), false);
// BET-258 : disparition du canal, sans casser les préférences et le désabonnement actifs.
for (const v of [60, 60])
  await db.exec(await readFile(`supabase/migrations/supabase-v${v}-schema.sql`, 'utf8'));
assert.equal(
  (await q("select to_regclass('public.notification_telegram_preferences') name"))[0].name,
  null
);
assert.equal((await q("select to_regclass('public.notification_pairings') name"))[0].name, null);
assert.equal(
  (
    await q(
      "select count(*)::int n from pg_proc where pronamespace='public'::regnamespace and proname like '%telegram%'"
    )
  )[0].n,
  0
);
assert.equal(
  (await q("select count(*)::int n from notification_endpoints where channel='telegram'"))[0].n,
  0
);
assert.equal(
  (await q("select count(*)::int n from notification_deliveries where channel='telegram'"))[0].n,
  0
);
assert.equal((await q('select unsubscribe_notifications() ok'))[0].ok, true);
assert.equal((await q('select my_web_notifications() s'))[0].s.preferences.enabled, false);
assert.equal((await q('select my_notifications() s'))[0].s.preferences.enabled, false);
// BET-260 : seules les images du propriétaire peuvent être déposées ; purge des orphelines/expirées.
await db.exec(
  `create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(name text primary key,bucket_id text,owner_id text,created_at timestamptz default now());alter table storage.objects enable row level security;grant usage on schema storage,auth to authenticated;grant all on storage.objects to authenticated;`
);
for (const v of [61, 61])
  await db.exec(await readFile(`supabase/migrations/supabase-v${v}-schema.sql`, 'utf8'));
assert.equal(
  (await q("select public from storage.buckets where id='ticket-previews'"))[0].public,
  true
);
assert.equal(
  (
    await q(
      "select has_function_privilege('authenticated','ticket_preview_cleanup_candidates()','execute') ok"
    )
  )[0].ok,
  false
);
await q(
  `insert into storage.objects values('11111111-1111-4111-8111-111111111111.png','ticket-previews',$1,now()),('22222222-2222-4222-8222-222222222222.png','ticket-previews',$1,now()-interval '31 days'),('33333333-3333-4333-8333-333333333333.png','ticket-previews','orphan',now())`,
  [uid]
);
assert.equal((await q('select * from ticket_preview_cleanup_candidates()')).length, 2);
await db.exec('set role authenticated');
await assert.rejects(
  q(
    `insert into storage.objects values('44444444-4444-4444-8444-444444444444.png','ticket-previews','other',now())`
  )
);
await q(
  `insert into storage.objects values('55555555-5555-4555-8555-555555555555.png','ticket-previews',$1,now())`,
  [uid]
);
assert.equal((await q('select count(*)::int n from storage.objects'))[0].n, 3);
await db.exec('reset role');
await db.exec(await readFile('supabase/ticket-preview-cleanup.sql', 'utf8'));
await q('select tick_ticket_preview_cleanup()');
const [cleanupRequest] = await q("select * from net.requests where url like '%/ticket-preview'");
assert.ok(cleanupRequest);
assert.equal(
  (
    await q(
      "select has_function_privilege('authenticated','tick_ticket_preview_cleanup()','execute') ok"
    )
  )[0].ok,
  false
);
// BET-310 : même SQL avec horloge figée, sans destinataire ni transport réel.
await db.exec(
  `alter table fixtures add column kickoff timestamptz,add column completed boolean default false,add column voided boolean default false,add column odds jsonb,add column odds_source jsonb,add column odds_bookmaker_counts jsonb;create table daily_challenges(day date primary key,picks jsonb);create table daily_picks(user_id uuid,day date,match_id text);`
);
const challengeSQL = (
  await readFile('supabase/migrations/supabase-v65-schema.sql', 'utf8')
).replaceAll('now()', "'2026-11-10T09:05:00Z'::timestamptz");
await db.exec(challengeSQL);
await db.exec(challengeSQL);
assert.equal(
  (await q('select my_web_notifications() s'))[0].s.preferences.daily_challenge_reminder,
  false
);
await q(
  `insert into notification_endpoints(user_id,channel,encrypted) values($1,'web','demo') on conflict do nothing`,
  [uid]
);
await q(
  `insert into fixtures(id,kickoff,odds,odds_source,odds_bookmaker_counts) values('challenge-one','2026-11-10T12:00:00Z','{"home":2}','{"home":"real"}','{"home":10}')`
);
await q(
  `insert into daily_challenges values('2026-11-10','[{"matchId":"challenge-one","odds":{"home":2},"bookmakerCounts":{"home":10}}]')`
);
const challengeEvent = {
    web: true,
    daily_challenge_reminder: true,
    challenge_day: '2026-11-10',
    date: '2026-11-10',
    timezone: 'Europe/Paris',
    expires_at: '2026-11-10T09:15:00Z',
    kickoff: '2026-11-10T09:15:00Z'
  },
  challengeQueue = async (e = challengeEvent) =>
    (await q('select enqueue_daily_challenge_reminder($1,$2) ok', [uid, JSON.stringify(e)]))[0].ok,
  challengeValid = async (e = challengeEvent) =>
    (await q('select daily_challenge_reminder_current($1,$2) ok', [uid, JSON.stringify(e)]))[0].ok;
assert.equal(await challengeQueue(), false);
await q('select save_web_notifications($1)', [
  JSON.stringify({
    ...web,
    enabled: true,
    essential: false,
    daily_challenge_reminder: true,
    quiet_start: 1320,
    quiet_end: 480,
    timezone: 'Europe/Paris'
  })
]);
assert.ok((await q('select my_web_notifications() s'))[0].s.preferences.daily_challenge_consent_at);
assert.equal(await challengeValid(), true);
for (const patch of [
  { challenge_day: '2026-11-09' },
  { date: '2026-11-09' },
  { timezone: 'UTC' },
  { expires_at: '2026-11-10T09:30:00Z' },
  { daily_challenge_reminder: false },
  { kickoff: null }
])
  assert.equal(await challengeValid({ ...challengeEvent, ...patch }), false);
await q(
  `update notification_deliveries set status='cancelled' where status in ('pending','sending')`
);
assert.equal(await challengeQueue(), true);
assert.equal(await challengeQueue(), false);
assert.equal((await q('select * from claim_favorite_reminders()')).length, 1);
await q(
  `update notification_deliveries set status='pending' where event_id in(select id from notification_events where event_key='daily-challenge:2026-11-10')`
);
await q(`insert into daily_picks values($1,'2026-11-10','challenge-one')`, [uid]);
assert.equal(await challengeValid(), false);
assert.equal((await q('select * from claim_favorite_reminders()')).length, 0);
await q('delete from daily_picks');
await q(`update fixtures set completed=true where id='challenge-one'`);
assert.equal(await challengeValid(), false);
await q(
  `update fixtures set completed=false,odds_bookmaker_counts='{"home":9}' where id='challenge-one'`
);
assert.equal(await challengeValid(), false);
await q(`update fixtures set odds_bookmaker_counts='{"home":10}' where id='challenge-one'`);
await q('update notification_web_preferences set quiet_start=600,quiet_end=660 where user_id=$1', [
  uid
]);
assert.equal(await challengeValid(), false);
await q(
  'update notification_web_preferences set quiet_start=0,quiet_end=0,essential=true where user_id=$1',
  [uid]
);
assert.equal(await challengeValid(), false);
for (const fn of [
  'notification_challenge_snapshot(uuid)',
  'daily_challenge_reminder_current(uuid,jsonb)',
  'enqueue_daily_challenge_reminder(uuid,jsonb)'
])
  assert.equal(
    (await q(`select has_function_privilege('authenticated',$1,'execute') ok`, [fn]))[0].ok,
    false
  );
await q('select disconnect_web_notifications()');
assert.equal(
  (await q('select my_web_notifications() s'))[0].s.preferences.daily_challenge_reminder,
  false
);
assert.equal(
  (await q('select my_web_notifications() s'))[0].s.preferences.daily_challenge_consent_at,
  null
);
assert.equal(await challengeQueue(), false);
console.log(
  'SQL BET-310 : opt-in distinct, droits, fenêtre, silence, participation, unicité, désabonnement vérifiés.'
);

await db.close();
console.log('SQL : migrations, consentement, replanification, unicité et silence vérifiés.');
