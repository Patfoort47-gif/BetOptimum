// BET-131 : recette PostgreSQL isolée avec PGlite installé hors du projet.
// PGLITE_MODULE=/tmp/bet-ranking-tools/node_modules/@electric-sql/pglite/dist/index.js node scripts/check-ranking-sql.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {leaguePoints} from '../model.js';
import {computeStandings} from '../league.js';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href),db=new PGlite();
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const q=async(sql,params=[])=> (await db.query(sql,params)).rows;
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
try{
 await db.exec(await read('tests/fixtures/ranking-schema.sql'));
 const v9=await read('supabase/migrations/supabase-v9-schema.sql'),start=v9.indexOf('create or replace function public.special_try_pick('),end=v9.indexOf('end $$;',start)+7;
 await db.exec(v9.slice(start,end));
 await q(`insert into profiles(user_id,nickname) values ($1,'A'),($2,'B')`,[a,b]);
 await q(`insert into player_league(user_id,joined_at) values ($1,now()-interval '2 days'),($2,now()-interval '30 days')`,[a,b]);
 await q(`insert into player_accounts values ($1,1000,now()),($2,1000,now())`,[a,b]);
 await q(`insert into bets(id,user_id,stake,odds) values ($1,$1,10,8)`,[a]);
 await q(`insert into daily_picks(user_id,day,match_id,odd) values ($1,current_date,'legacy',8)`,[a]);
 const migration=await read('supabase/migrations/supabase-v30-schema.sql');
 await db.exec(migration);
 assert.equal((await q('select scoring_version from bets'))[0].scoring_version,1);
 await q(`insert into bets(id,user_id,stake,odds,scoring_version) values ($1,$1,10,8,1)`,[b]);
 assert.equal((await q('select scoring_version from bets where id=$1',[b]))[0].scoring_version,2);
 await assert.rejects(q('update bets set scoring_version=1 where id=$1',[b]),/BAREME_IMMUABLE/);
 // Même les paramètres p_points erronés ne peuvent contourner le barème du serveur.
 await q(`insert into special_picks(bet_id,user_id,source,odd) values ($1,$1,'bet',8),($2,$2,'bet',8)`,[a,b]);
 for(const id of [a,b])await q('select settle_bet($1,\'won\',80,999999)',[id]);
 assert.deepEqual((await q('select points::float from league_entries order by user_id')).map(r=>r.points),[70,40]);
 assert.deepEqual((await q('select points::float from special_picks order by user_id')).map(r=>r.points),[70,40]);
 assert.equal((await q('select settle_bet($1,\'won\',80,999999) as accepted',[b]))[0].accepted,false);
 assert.equal(Number((await q('select bankroll from player_accounts where user_id=$1',[b]))[0].bankroll),1080);
 await q(`insert into daily_picks(user_id,day,match_id,odd) values ($1,current_date,'new',8)`,[a]);
 for(const row of await q('select id from daily_picks'))await q('select settle_daily_pick($1,\'won\',999999)',[row.id]);
 assert.deepEqual((await q('select points::float from daily_picks order by id')).map(r=>r.points),[70,40]);
 await q(`insert into special_picks(user_id,source,odd) values ($1,'grid',8)`,[a]);
 const grid=(await q("select id from special_picks where source='grid'"))[0];
 await q('select settle_special_pick($1,\'won\',999999)',[grid.id]);
 assert.equal(Number((await q('select points from special_picks where id=$1',[grid.id]))[0].points),40);
 for(const version of [1,2])for(const odds of [1,1.005,1.01,1.234,1.2345,1.9,4.9995,5,8,10,50])for(const status of ['won','lost','void']){
   const sql=Number((await q('select league_score($1,$2,$3::smallint) as points',[status,odds,version]))[0].points);
   assert.equal(sql,leaguePoints({status,odds,version}),`${status}, ${odds}, V${version}`);
 }
 // Les annulations sont retirées de la cote V2 sans dépendre de la mise.
 await q(`insert into fixtures(id,voided) values ('void-leg',true)`);
 assert.equal(Number((await q(`select league_ticket_odd('[{"matchId":"played","odd":2.35},{"matchId":"void-leg","odd":8}]',18.8) as odd`))[0].odd),2.35);
 // Réexécuter la migration ne change ni versions ni points.
 await db.exec(migration);
 assert.deepEqual((await q('select scoring_version from bets order by user_id')).map(r=>r.scoring_version),[1,2]);
 assert.equal(Number((await q('select sum(points) as points from league_entries'))[0].points),220);
 // Rattrapage d'un ticket V2 et adhésion spéciale tardive : même version que le ticket.
 await q('delete from league_entries where bet_id=$1',[b]);
 await q(`insert into special_leagues values ('test','competition',true,current_date-30,current_date+30)`);
 await q(`insert into league_members values ($1,'test')`,[b]);
 await q(`update bets set selections='[{"matchId":"match-repair","key":"home","odd":8}]' where id=$1`,[b]);
 await q(`insert into special_rounds values ('test-round','test','["match-repair"]',now()-interval '1 day',now()+interval '1 day','match-repair',3)`);
 await q('select repair_league_history()');
 assert.equal(Number((await q('select points from league_entries where bet_id=$1',[b]))[0].points),40);
 assert.equal(Number((await q("select points from special_picks where league_id='test'"))[0].points),40);
 // Participation : pas de défis avant l'arrivée, futurs ou annulés. Les absents ont un dénominateur.
 await q(`insert into daily_challenges values (current_date,jsonb_build_array(
 jsonb_build_object('matchId','before','kickoff',now()-interval '3 days'),
 jsonb_build_object('matchId','eligible','kickoff',now()-interval '1 hour'),
 jsonb_build_object('matchId','future','kickoff',now()+interval '1 hour'),
 jsonb_build_object('matchId','cancelled','kickoff',now()-interval '1 hour')))`);
 await q(`insert into fixtures(id,voided) values ('cancelled',true)`);
 const offers=await q('select user_id,played,offered from daily_participation where season=football_season() order by user_id');
 assert.deepEqual(offers.map(r=>[Number(r.played),Number(r.offered)]),[[0,1],[0,2]]);
 // Comparer les classements PostgreSQL (public, privé) au calcul du groupe en JS, avec annulations.
 await db.exec('delete from league_entries');
 await q(`insert into league_entries(user_id,points,season) values ($1,20,football_season()),($1,-10,football_season()),($2,10,football_season()),($2,0,football_season())`,[a,b]);
 const members=[{user_id:a,group_id:1},{user_id:b,group_id:1}],entries=await q('select user_id,points::float from league_entries');
 const js=computeStandings({members,entries,season:'test',today:'2026-10-31'}).sort((a,b)=>a.rank-b.rank);
 const ranked=await q('select user_id from public_ranking_season order by rank');
 assert.deepEqual(ranked.map(r=>r.user_id),js.map(r=>r.user_id));
 await q('insert into private_league_members(user_id,league_id) values ($1,$1),($2,$1)',[a,b]);
 const priv=await q('select user_id,roi::float from private_league_ranking($1)',[a]);
 assert.deepEqual(priv.map(r=>[r.user_id,r.roi]),js.map(r=>[r.user_id,r.roi]));
 assert.equal((await q("select has_function_privilege('authenticated','settle_bet(uuid,text,numeric,numeric)','EXECUTE') as allowed"))[0].allowed,false);
 console.log('OK : migration V30, idempotence, 66 cas JS/SQL, règlements et versions, réparation, participation et classements cohérents.');
}finally{await db.close()}
