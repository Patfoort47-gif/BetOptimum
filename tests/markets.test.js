import test from 'node:test';
import assert from 'node:assert/strict';
import {analyseMatch,selectionResult,settleTicket} from '../model.js';
import {marketSpec,scoreOutcome} from '../markets.js';
import {propLineOffers} from '../scripts/propline-odds.mjs';
import {mergeCachedOffers,summarizeOffers} from '../odds-cache.js';
import {fixtureRow} from '../scripts/sync-supabase.mjs';
const match={id:'m',home:'Alpha',away:'Beta',homeGoals:1.5,awayGoals:1,odds:{home:2,draw:3,away:4,over:2,btts:2,under:2,bttsNo:2,over15:2,under15:2,over35:2,under35:2,homeDraw:1.4,drawAway:1.6,homeAway:1.3,homeDnb:2,awayDnb:3,homeOver15:2,awayUnder05:2}};
const result=(key,h,a)=>selectionResult({matchId:'m',key},[{id:'m',completed:true,homeScore:h,awayScore:a}]).status;
test('BET-153 : compléments, doubles chances, totaux équipe et value avec remboursement',()=>{
 const a=analyseMatch({...match,realOddsMarkets:Object.keys(match.odds)}),p=a.probs;
 for(const [x,y] of [['over','under'],['btts','bttsNo'],['over15','under15'],['over35','under35']])assert.ok(Math.abs(p[x]+p[y]-1)<1e-10);
 assert.ok(Math.abs(p.homeDraw-p.home-p.draw)<1e-10);assert.ok(Math.abs(p.drawAway-p.draw-p.away)<1e-10);assert.ok(Math.abs(p.homeAway-p.home-p.away)<1e-10);
 assert.ok(Math.abs(p.homeOver15-(1-Math.exp(-1.5)*2.5))<1e-10);assert.ok(Math.abs(p.awayUnder05-Math.exp(-1))<1e-10);
 const dnb=a.markets.find(m=>m.key==='homeDnb');assert.equal(dnb.refundProbability,p.draw);assert.equal(dnb.value,2*p.home+p.draw-1);assert.equal(dnb.probability,p.home);
});
test('BET-153 : scores frontières, nullité, annulation et scores absents',()=>{
 assert.equal(result('under',1,1),'won');assert.equal(result('over15',1,1),'won');assert.equal(result('under15',1,1),'lost');assert.equal(result('over35',2,1),'lost');assert.equal(result('bttsNo',0,2),'won');assert.equal(result('homeDraw',1,1),'won');assert.equal(result('homeAway',1,1),'lost');assert.equal(result('homeDnb',1,1),'void');assert.equal(result('homeDnb',0,1),'lost');assert.equal(result('awayDnb',0,1),'won');assert.equal(result('homeOver15',1,3),'lost');assert.equal(result('awayUnder05',2,0),'won');
 assert.equal(result('homeDnb',null,null),'pending');assert.equal(scoreOutcome('homeOver10',1,0),null);assert.equal(marketSpec('homeOver15').line,1.5);
 assert.equal(selectionResult({matchId:'m',key:'homeDnb'},[{id:'m',voided:true}]).status,'void');
});
test('BET-153 : remboursement en simple, combiné et système sans modifier les cotes stockées',()=>{
 const items=[{matchId:'m',key:'homeDnb',odd:2},{matchId:'n',key:'under',odd:1.8}],results=[{id:'m',completed:true,homeScore:1,awayScore:1},{id:'n',completed:true,homeScore:1,awayScore:0}];
 assert.deepEqual(settleTicket({stake:10,items:[items[0]]},results),{status:'void',payout:10});assert.deepEqual(settleTicket({stake:10,items},results),{status:'won',payout:18});
 assert.deepEqual(settleTicket({betType:'multiple',stake:10,items,systemLines:[{indexes:[0,1],stake:10,odds:3.6}]},results),{status:'won',payout:18});assert.equal(items[0].odd,2);
});
test('BET-153 : lignes séparées, prix réellement fournis et activation progressive',()=>{
 const now=Date.now(),stamp=new Date(now).toISOString(),e={home_team:'Alpha',away_team:'Beta',bookmakers:[{key:'test_fr',markets:[{key:'totals',last_update:stamp,outcomes:[{name:'Under',point:2.5,price:110},{name:'Over',point:1.5,price:-125},{name:'Over',point:2,price:100}]},{key:'both_teams_to_score',last_update:stamp,outcomes:[{name:'No',price:120}]},{key:'double_chance',last_update:stamp,outcomes:[{name:'Alpha/Draw',price:-150},{name:'Draw/Beta',price:-110},{name:'Alpha/Beta',price:-200}]},{key:'draw_no_bet',last_update:stamp,outcomes:[{name:'Alpha',price:100}]},{key:'team_totals',team:'Alpha',last_update:stamp,outcomes:[{name:'Over',point:1.5,price:120}]}]}]};
 assert.deepEqual(propLineOffers(e,now,0),[]);const first=propLineOffers(e,now,1)[0];assert.equal(first.under,2.1);assert.equal(first.over15,1.8);assert.equal(first.bttsNo,2.2);assert.equal(first.homeDnb,undefined);assert.equal(first.homeOver15,undefined);
 const second=propLineOffers(e,now,2)[0];assert.equal(second.homeOver15,2.2);assert.equal(second.homeDnb,2);assert.equal(second.homeDraw,1.6667);assert.equal(second.drawAway,1.9091);assert.equal(second.homeAway,1.5);assert.equal(second.over,undefined);
 const cache=mergeCachedOffers([],[second]);assert.equal(cache[0].homeOver15Cached,true);assert.equal(summarizeOffers(cache).counts.homeOver15,1);assert.equal(summarizeOffers(cache).averages.over15,1.8);
 const row=fixtureRow({...match,realOddsMarkets:['homeOver15'],oddsBookmakerCounts:{homeOver15:10}});assert.equal(row.odds.homeOver15,2);assert.equal(row.odds_source.homeOver15,'real');
});
const {regulationScore}=await import('../regulation-score.js');
test('BET-153 : prolongation et tirs au but ne remplacent pas le score réglementaire',()=>{
 const event={status:{period:4,type:{name:'STATUS_FINAL_AET'}},competitions:[{competitors:[{homeAway:'home',score:2,linescores:[{value:0},{value:1},{value:1},{value:0}]},{homeAway:'away',score:1,linescores:[{value:1},{value:0},{value:0},{value:0}]}]}]},regulation=regulationScore(event);
 assert.deepEqual(regulation,{extraTime:true,home:1,away:1});const r={id:'m',completed:true,homeScore:2,awayScore:1,regulation};assert.equal(selectionResult({matchId:'m',key:'homeDnb'},[r]).status,'void');assert.equal(selectionResult({matchId:'m',key:'under'},[r]).status,'won');assert.equal(selectionResult({matchId:'m',key:'home'},[r]).status,'won');
 assert.equal(selectionResult({matchId:'m',key:'homeDnb'},[{...r,regulation:{extraTime:true,home:null,away:null}}]).status,'pending');
});
