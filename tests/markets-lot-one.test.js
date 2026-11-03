import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {marketSpec,scoreOutcome,marketEnabled,isExtendedMarket} from '../markets.js';
import {analyseMatch,recommendedMarket,selectionResult,settleTicket} from '../model.js';
import {propLineOffers,lotOneSelection,collectPropLine} from '../scripts/propline-odds.mjs';
import {mergeCachedOffers,summarizeOffers} from '../odds-cache.js';
import {fixtureRow,planSettlements} from '../scripts/sync-supabase.mjs';
import {marketCard} from '../market-card.js';
const evidence=JSON.parse(await readFile(new URL('../docs/evidence/propline-lot-one-2026-11-03.json',import.meta.url),'utf8'));
test('BET-170 : sélections des prix fournisseur réels, étape explicite et régions séparées',()=>{
 for(const e of evidence.samples){
  const now=Date.parse(evidence.generatedAt),offers=propLineOffers(e,now,3),keys=Object.keys(summarizeOffers(offers).counts);
  assert.ok(keys.includes('score1_0'));assert.ok(keys.some(k=>k.startsWith('ehHome')));assert.ok(keys.includes('homeMargin1'));assert.ok(keys.includes('marginDraw0'));assert.ok(keys.includes('marginDrawGoals'));
  assert.ok(propLineOffers(e,now,2).every(o=>Object.keys(o).every(k=>!isExtendedMarket(k))));
  assert.ok(offers.every(o=>!Object.keys(o).some(k=>isExtendedMarket(k)&&!marketEnabled(k,3))));
 }
});
test('BET-170 : identité exacte, score domicile/extérieur, handicap trois issues et marges bornées',()=>{
 for(const [key,h,a,expected] of [['score1_0',1,0,'won'],['score1_0',0,1,'lost'],['ehDrawM1',2,1,'won'],['ehHomeM1',2,1,'lost'],['ehAwayP1',0,2,'won'],['homeMargin2',3,1,'won'],['homeMargin2',4,1,'lost'],['awayMargin4Plus',0,5,'won'],['marginDraw0',0,0,'won'],['marginDrawGoals',1,1,'won'],['marginDrawGoals',0,0,'lost'],['over05',0,0,'lost'],['under45',2,2,'won']])assert.equal(scoreOutcome(key,h,a),expected,key);
 for(const key of ['score01_0','score16_0','ehDrawM0','ehDrawP10','homeMargin0','over40','over25'])assert.equal(marketSpec(key),null,key);
 const e={home_team:'Alpha',away_team:'Beta'},block={key:'european_handicap',description:'3-Way Handicap -1',outcomes:[{name:'Alpha',point:-1},{name:'Draw',point:-1},{name:'Beta',point:-1}]};
 assert.equal(lotOneSelection(e,block,block.outcomes[1]),'ehDrawM1');assert.equal(lotOneSelection(e,{...block,description:'Handicap -1'},block.outcomes[1]),null);
 assert.equal(lotOneSelection(e,{...block,outcomes:[...block.outcomes,{name:'Other',point:-1}]},block.outcomes[1]),null);
 assert.equal(lotOneSelection(e,{key:'correct_score'},{name:'Beta 2-0'}),null);
 assert.equal(lotOneSelection(e,{key:'correct_score',period:'h1'},{name:'2-0'}),null);
 assert.equal(lotOneSelection({home_team:'Manchester City',away_team:'Manchester United'},{key:'winning_margin'},{name:'Manchester By 1'}),null);
});
test('BET-170 : pas de réapparition du cache, prix périmés/suspendus/retirés refusés',()=>{
 const e=evidence.samples[0],now=Date.parse(evidence.generatedAt),offers=propLineOffers(e,now,3);
 const cached=mergeCachedOffers([],offers);assert.ok(cached.every(o=>Object.keys(o).every(k=>!isExtendedMarket(k))));
 assert.equal(propLineOffers(e,now+61*60000,3).length,0);
 const market={key:'correct_score',last_update:evidence.generatedAt,outcomes:[{name:'1-0',price:500,restricted:true},{name:'2-0',price:700,suspended_at:evidence.generatedAt}]};
 assert.deepEqual(propLineOffers({...e,bookmakers:[{key:'test_fr',markets:[market]}]},now,3),[]);
});
test('BET-170 : sans modèle ni value, expiration locale et serveur, règlement 90 min indépendant des prix actuels',()=>{
 const until=new Date(Date.now()+3600000).toISOString(),match={id:'m',home:'Alpha',away:'Beta',homeGoals:1.4,awayGoals:1,odds:{home:2,draw:3,away:4,over:2,btts:2,score1_0:7,ehDrawM1:4},realOddsMarkets:['score1_0','ehDrawM1'],marketValidUntil:{score1_0:until,ehDrawM1:until}};
 const a=analyseMatch(match),score=a.markets.find(m=>m.key==='score1_0');assert.equal(score.probability,null);assert.equal(score.value,null);assert.ok(!isExtendedMarket(recommendedMarket(match).key));
 const card=marketCard(match,score);assert.match(card,/Sans modèle/);assert.ok(!/NaN|Value|Confiance estimée|confidence-track/.test(card));
 assert.equal(analyseMatch({...match,marketValidUntil:{}}).markets.some(m=>isExtendedMarket(m.key)),false);
 assert.equal(fixtureRow(match).market_valid_until.score1_0,until);
 const result={id:'m',completed:true,homeScore:2,awayScore:0,regulation:{extraTime:true,home:1,away:0}},items=[{matchId:'m',key:'score1_0',odd:7}];
 assert.equal(selectionResult(items[0],[result]).status,'won');assert.equal(selectionResult(items[0],[{...result,regulation:{extraTime:true,home:null,away:null}}]).status,'pending');
 assert.deepEqual(settleTicket({stake:10,items},[result]),{status:'won',payout:70});
 assert.deepEqual(settleTicket({stake:10,items},[{id:'m',voided:true}]),{status:'void',payout:10});
 assert.deepEqual(settleTicket({betType:'multiple',stake:10,items:[...items,{matchId:'n',key:'away',odd:2}],systemLines:[{indexes:[0,1],stake:10,odds:14}]},[result,{id:'n',voided:true}]),{status:'won',payout:70});
 assert.deepEqual(settleTicket({stake:10,items:[...items,{matchId:'n',key:'away',odd:2}]},[result,{id:'n',voided:true}]),{status:'won',payout:70});
 const plan=planSettlements([{id:'b',selections:items,stake:10,bet_type:'single'}],[result]);assert.equal(plan[0].payout,70);assert.equal(plan[0].points,40);
});
test('BET-170 : collecte étape 3 toujours groupée par compétition, sans nouvelle fréquence',async()=>{
 const e=evidence.samples[0],now=Date.parse(evidence.generatedAt);let count=0;
 const r=await collectPropLine([{id:'espn-'+e.espn_event_id,home:e.home_team,away:e.away_team,kickoff:e.commence_time,league:e.league}],{[e.league]:'soccer_epl'},{key:'test',stage:3,now,fetchImpl:async url=>{count++;assert.match(url,/correct_score/);return{ok:true,json:async()=>[e]}}});
 assert.equal(count,1);assert.equal(r.succeeded,1);
});
