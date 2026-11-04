import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {halfTimeMarketSpec,marketEnabled,marketSpec,selectionCondition} from '../markets.js';
import {propLineOffers,collectPropLine} from '../scripts/propline-odds.mjs';
import {quoteAvailable} from '../quote-policy.js';
import {halfTimeResult,enrichHalfTimeResults} from '../scripts/h1-results.mjs';
import {analyseMatch,recommendedMarket,selectionResult,settleTicket} from '../model.js';
import {fixtureRow,buildResults,planSettlements} from '../scripts/sync-supabase.mjs';
import {marketCard} from '../market-card.js';
import {historyCard} from '../bet-history.js';
const read=name=>JSON.parse(gunzipSync(readFileSync(new URL(`../docs/evidence/${name}-2026-11-04.json.gz`,import.meta.url))));
const evidence=read('propline-h1'),official=read('espn-market-results'),sample=official.samples[0],teams=sample.header.competitions[0].competitors,home=teams.find(t=>t.homeAway==='home'),away=teams.find(t=>t.homeAway==='away');
const match={id:sample.id,league:sample.league,home:'Liverpool',away:'Arsenal',homeId:home.id,awayId:away.id,completed:true,homeScore:Number(home.score),awayScore:Number(away.score)},scores=halfTimeResult(sample,match);
test('BET-170 H1 : prix réels isolés, neuf identités, seuil 9/10, aucune activation implicite',()=>{
 let qualified=0;
 for(const event of evidence.samples){
  const now=Date.parse(evidence.generatedAt);assert.deepEqual(propLineOffers(event,now,3),[]);
  const offers=propLineOffers(event,now,3,true),keys=new Set(offers.flatMap(o=>Object.keys(o).filter(k=>halfTimeMarketSpec(k))));
  for(const key of keys){assert(marketEnabled(key,3,true));assert.equal(marketEnabled(key,3),false);const count=offers.filter(o=>o[key]>1).length;if(count>=10)qualified++;assert.equal(quoteAvailable({odds:{[key]:2},realOddsMarkets:[key],bookmakerOffers:offers,marketValidUntil:{[key]:new Date(Date.now()+3600000).toISOString()}},key),count>=10);}
  assert.deepEqual(propLineOffers({...event,bookmakers:event.bookmakers.map(b=>({...b,markets:b.markets.map(m=>({...m,period:'h2'}))}))},now,3,true),[]);
 }
 assert.equal(qualified,142);
 for(const key of ['h1Home','h1Draw','h1Away','h1Over05','h1Under05','h1Over15','h1Under15','h1Over25','h1Under25'])assert(marketSpec(key)?.period==='h1');
 for(const key of ['h2Home','h1home','h1Over25extra','h1Over00','h1Over10','h1Over35'])assert.equal(marketSpec(key),null);
});
test('BET-170 H1 : collecte tout-périodes bornée, sans appel supplémentaire ni mélange H2/full',async()=>{
 const event=evidence.samples[0],now=Date.parse(evidence.generatedAt),m={id:'espn-test',home:event.home_team,away:event.away_team,league:'Test',kickoff:new Date(now+3600000).toISOString()};let requests=0;
 const r=await collectPropLine([m],{Test:'soccer_test'},{key:'test',now,stage:3,h1Enabled:true,fetchImpl:async url=>{requests++;assert.equal(new URL(url).searchParams.get('period'),'all');assert(!url.includes('result_btts'));return{ok:true,json:async()=>[{...event,espn_event_id:null,commence_time:m.kickoff}]}}});
 assert.equal(requests,1);assert(r.offersByMatch.get(m.id).some(o=>o.h1Home>1));
});
test('BET-170 H1 : requête réelle de production tout-périodes, 142 choix au seuil dont 52 à moins de 48 h',()=>{
 const r=read('propline-h1-release'),now=Date.parse(r.generatedAt);let qualified=0,within=0;assert.equal(r.requests,8);assert.deepEqual(r.failures,[]);assert.equal(r.requestedPeriod,'all');
 for(const event of r.samples){const offers=propLineOffers(event,now,3,true),keys=new Set(offers.flatMap(o=>Object.keys(o).filter(k=>halfTimeMarketSpec(k))));for(const key of keys)if(offers.filter(o=>o[key]>1).length>=10){qualified++;if(Date.parse(event.commence_time)<=now+48*3600000)within++;}assert(propLineOffers(event,now,3).every(o=>Object.keys(o).every(k=>!halfTimeMarketSpec(k))));}
 assert.equal(qualified,142);assert.equal(within,52);assert(r.usage.every(u=>u['x-daily-remaining']>=953));
});
test('BET-170 H1 : preuve ESPN réelle, absence et incohérence attendent sans inventer zéro',()=>{
 assert.deepEqual(scores.h1,{home:0,away:1});
 for(const patch of [{completed:false},{id:'espn-999'},{homeId:away.id},{homeScore:8}])assert.equal(halfTimeResult(sample,{...match,...patch}),null);
 for(const value of [undefined,null,'',false,'unknown']){const changed=structuredClone(sample);changed.header.competitions[0].competitors[0].linescores[0]={displayValue:value};assert.equal(halfTimeResult(changed,match),null);}
 const changed=structuredClone(sample);changed.header.competitions[0].competitors[0].linescores[0]={value:1,displayValue:'0'};assert.equal(halfTimeResult(changed,match),null);
});
test('BET-170 H1 : prolongation, tirs au but et arrêts de jeu n’entrent pas dans H1',()=>{
 const final=read('espn-h1-extra-time');assert.deepEqual(halfTimeResult(final,{id:'espn-633850',completed:true,homeScore:3,awayScore:3,homeId:'202',awayId:'478'}).h1,{home:2,away:0});
 for(const name of ['STATUS_FINAL_AET','STATUS_FINAL_PEN']){const p=structuredClone(sample),c=p.header.competitions[0];c.status.type.name=name;c.competitors[0].score='2';c.competitors[0].linescores.push({displayValue:'2'},{displayValue:'0'});assert.deepEqual(halfTimeResult(p,{...match,homeScore:2}).h1,scores.h1);}
 const p=structuredClone(sample);p.header.competitions[0].competitors[1].linescores[0]={displayValue:'3'};assert.equal(halfTimeResult(p,match),null);
});
test('BET-170 H1 : résultat borné, cache cohérent, correction réinterrogée, échec sans repli périmé',async()=>{
 const fresh=halfTimeResult(sample,match,new Date().toISOString()),a={...match};let calls=0;
 await enrichHalfTimeResults([a],[{id:match.id,periodScores:fresh}],{fetchImpl:async()=>{calls++;throw Error('unused')}});assert.equal(calls,0);assert.deepEqual(a.periodScores,fresh);
 const b={...match,homeScore:2};await enrichHalfTimeResults([b],[{id:match.id,periodScores:fresh}],{fetchImpl:async()=>{calls++;return{ok:false,status:503}}});assert.equal(calls,1);assert.equal(b.periodScores.h1,null);
 const r=await enrichHalfTimeResults([{...match},{...match,id:'espn-999'}],[],{maxRequests:1,fetchImpl:async()=>({ok:true,json:async()=>sample})});assert.equal(r.requested,1);assert.equal(r.succeeded,1);
});
test('BET-170 H1 : règlement serveur, attente, annulation, combiné/système et historique indépendants du score final',()=>{
 const result={...match,periodScores:scores},item={matchId:match.id,key:'h1Away',label:marketSpec('h1Away',match).label,odd:2,match:'Liverpool - Arsenal'},bet={betType:'single',stake:10,items:[item]};
 assert.equal(selectionResult(item,[result]).status,'won');assert.equal(selectionResult({...item,key:'h1Home'},[result]).status,'lost');
 assert.equal(selectionResult(item,[{...match}]).status,'pending');assert.equal(selectionResult(item,[{...result,homeScore:3}]).status,'pending');
 assert.deepEqual(settleTicket(bet,[result]),{status:'won',payout:20});assert.deepEqual(settleTicket(bet,[{id:match.id,voided:true}]),{status:'void',payout:10});
 const items=[item,{matchId:'n',key:'home',odd:3}];for(const betType of ['combined','multiple'])assert.deepEqual(settleTicket({betType,stake:10,items,systemLines:[{indexes:[0,1],stake:10,odds:6}]},[result,{id:'n',voided:true}]),{status:'won',payout:20});
 const planned=planSettlements([{id:'b',bet_type:'single',stake:10,selections:[item]}],[result]);assert.equal(planned[0].points,10);assert.equal(planned[0].payout,20);
 const row=fixtureRow(result);assert.deepEqual(row.period_scores,scores);assert.deepEqual(buildResults([], [{...row,home_score:match.homeScore,away_score:match.awayScore}])[0].periodScores,scores);
 const html=historyCard({...bet,id:'b',status:'won',returnAmount:20,odds:2},{results:[result]});assert.match(html,/Score à la mi-temps : 0 : 1/);assert(!html.includes('Score final :'));
});
test('BET-170 H1 : interface datée sans probabilité/value/recommandation inventée, expiration ferme',()=>{
 const m={id:'m',home:'A',away:'B',homeGoals:1.4,awayGoals:1,odds:{home:2,draw:3,away:4,over:2,btts:2,h1Home:2},realOddsMarkets:['h1Home'],oddsBookmakerCounts:{h1Home:10},marketValidUntil:{h1Home:new Date(Date.now()+3600000).toISOString()}};
 const h1=analyseMatch(m).markets.find(m=>m.key==='h1Home');assert.equal(h1.probability,null);assert.equal(h1.value,null);assert.equal(recommendedMarket(m),null);const html=marketCard(m,h1);assert.match(html,/1re mi-temps/);assert.match(html,/Sans modèle/);assert(!html.includes('NaN'));assert.match(selectionCondition('h1Home'),/arrêts de jeu/);
 assert.equal(marketCard({...m,marketValidUntil:{}},h1),'');assert.equal(marketCard({...m,oddsBookmakerCounts:{h1Home:9}},h1),'');
});
