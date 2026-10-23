import test from 'node:test';import assert from 'node:assert/strict';
const {settleTicket,settleBet,selectionResult,leaguePoints,weekKey,quotaUsed,quotaRemaining,leagueEligibility,tieBreak,pickDailyChallenge,parisDate}=await import('./model.js');
const {fixtureRow,buildResults,planSettlements,settleServerBets,syncFixtures,loadResults,planDailySettlements,syncDailyChallenge}=await import('./scripts/sync-supabase.mjs');
const {createAdmin}=await import('./scripts/supabase-admin.mjs');
// BET-52 · tickets certifiés : règlement côté serveur
const done=(id,homeScore,awayScore)=>({id,completed:true,homeScore,awayScore}),leg=(matchId,key,odd)=>({matchId,key,odd});
test('un pari simple gagné crédite mise × cote, un perdu ne crédite rien',()=>{
  assert.deepEqual(settleTicket({betType:'single',stake:10,items:[leg('a','home',1.9)]},[done('a',2,0)]),{status:'won',payout:19});
  assert.deepEqual(settleTicket({betType:'single',stake:10,items:[leg('a','home',1.9)]},[done('a',0,1)]),{status:'lost',payout:0});
  assert.equal(settleTicket({betType:'single',stake:10,items:[leg('a','home',1.9)]},[]).status,'pending');
});
test('un match annulé rembourse la mise d’un pari simple',()=>{
  assert.deepEqual(settleTicket({betType:'single',stake:25,items:[leg('a','home',2)]},[{id:'a',voided:true}]),{status:'void',payout:25});
  assert.equal(settleBet({items:[leg('a','home',2)]},[{id:'a',voided:true}]),'void');
});
test('un combiné retire la sélection annulée et garde les autres cotes',()=>{
  const bet={betType:'combined',stake:10,items:[leg('a','home',2),leg('b','over',1.5),leg('c','btts',3)]};
  assert.deepEqual(settleTicket(bet,[done('a',1,0),{id:'b',voided:true},done('c',1,1)]),{status:'won',payout:60});
  assert.equal(settleTicket(bet,[done('a',1,0),{id:'b',voided:true},done('c',0,0)]).status,'lost');
  assert.equal(settleTicket(bet,[done('a',1,0),{id:'b',voided:true}]).status,'pending');
  assert.deepEqual(settleTicket(bet,[{id:'a',voided:true},{id:'b',voided:true},{id:'c',voided:true}]),{status:'void',payout:10});
});
test('un combiné perdu dès une sélection perdue, même si d’autres matchs ne sont pas joués',()=>{
  const bet={betType:'combined',stake:10,items:[leg('a','home',2),leg('b','home',2)]};
  assert.equal(settleTicket(bet,[done('a',0,3)]).status,'lost');
});
test('un système 2 sur 3 paie les lignes gagnantes et tolère une erreur',()=>{
  const items=['a','b','c'].map(id=>leg(id,'home',2)),lines=[[0,1],[0,2],[1,2]].map(indexes=>({indexes,odds:4,stake:3})),bet={betType:'multiple',stake:9,items,systemLines:lines};
  assert.deepEqual(settleTicket(bet,[done('a',1,0),done('b',1,0),done('c',0,1)]),{status:'won',payout:12});
  assert.equal(settleTicket(bet,[done('a',1,0),done('b',1,0)]).status,'pending');
  assert.deepEqual(settleTicket(bet,[done('a',0,1),done('b',0,1),done('c',1,0)]),{status:'lost',payout:0});
  assert.deepEqual(settleTicket(bet,[{id:'a',voided:true},{id:'b',voided:true},{id:'c',voided:true}]),{status:'void',payout:9});
});
test('un résultat annulé est reconnu par selectionResult',()=>{assert.equal(selectionResult(leg('a','home',2),[{id:'a',voided:true}]).status,'void')});
test('la ligne de la table fixtures reprend scores, cotes et provenance',()=>{
  const row=fixtureRow({id:'espn-1',league:'Ligue 1',home:'Paris',away:'Lyon',homeId:'160',awayId:'167',kickoff:'2026-10-22T19:00:00.000Z',date:'2026-10-22',status:'Programmé',completed:false,odds:{home:1.8,draw:3.5,away:4.2,over:1.9,btts:0},realOddsMarkets:['home','draw']},new Date('2026-10-22T10:00:00Z'));
  assert.deepEqual(row.odds,{home:1.8,draw:3.5,away:4.2,over:1.9});assert.deepEqual(row.odds_source,{home:'real',draw:'real',away:'estimated',over:'estimated'});
  assert.equal(row.home_score,null);assert.equal(row.voided,false);assert.equal(row.home_id,'160');
});
test('les résultats ignorent les matchs en cours et annulent les matchs jamais joués après 10 jours',()=>{
  const now=Date.parse('2026-10-22T12:00:00Z'),rows=[{id:'x',kickoff:'2026-10-01T12:00:00Z',completed:false,voided:false},{id:'y',kickoff:'2026-10-21T12:00:00Z',completed:false,voided:false},{id:'z',home:'A',away:'B',kickoff:'2026-10-20T12:00:00Z',completed:true,voided:false,home_score:2,away_score:1},{id:'w',kickoff:'2026-10-20T12:00:00Z',completed:false,voided:true}];
  const results=buildResults([done('s',1,0),{id:'t',voided:true}],rows,now),byId=Object.fromEntries(results.map(r=>[r.id,r]));
  assert.equal(byId.x.voided,true);assert.equal(byId.y,undefined);assert.equal(byId.z.homeScore,2);assert.equal(byId.w.voided,true);assert.equal(byId.s.completed,true);assert.equal(byId.t.voided,true);
});
test('le règlement rapproche les sélections par identifiant seulement, pas par noms d’équipes',()=>{
  const bets=[{id:'b1',bet_type:'single',stake:10,selections:[{matchId:'espn-2',key:'home',odd:2,home:'Paris',away:'Lyon',match:'Paris - Lyon'}]}],old={id:'espn-1',home:'Paris',away:'Lyon',completed:true,homeScore:3,awayScore:0};
  assert.deepEqual(planSettlements(bets,[old]),[]);
  assert.deepEqual(planSettlements(bets,[old,done('espn-2',1,0)]),[{id:'b1',status:'won',payout:20,points:10}]);
});
test('le règlement est idempotent : seuls les paris acceptés par le serveur sont comptés',async()=>{
  const calls=[],admin={select:async table=>table==='bets'?[{id:'b1',bet_type:'single',stake:10,selections:[leg('espn-1','home',2)],system_lines:null},{id:'b2',bet_type:'single',stake:10,selections:[leg('espn-9','home',2)],system_lines:null}]:[{id:'espn-1',home:'A',away:'B',kickoff:'2026-10-22T10:00:00Z',completed:true,voided:false,home_score:1,away_score:0}],rpc:async(name,args)=>{calls.push([name,args]);return args.p_bet_id!=='b1'}};
  assert.equal(await settleServerBets(admin,await loadResults(admin,[],Date.parse('2026-10-22T14:00:00Z'))),0);
  assert.deepEqual(calls,[['settle_bet',{p_bet_id:'b1',p_status:'won',p_payout:20,p_points:10}]]);
});
test('la synchronisation des matchs ignore les matchs incomplets et envoie les autres par lots',async()=>{
  const sent=[],admin={upsert:async(table,rows)=>sent.push([table,rows.map(r=>r.id)])};
  await syncFixtures(admin,[{id:'espn-1',league:'L',home:'A',away:'B',kickoff:'2026-10-22T10:00:00Z',odds:{home:2}},{id:'espn-2',league:'L',home:'',away:'B'},{league:'L',home:'A',away:'B'}]);
  assert.deepEqual(sent,[['fixtures',['espn-1']]]);
});
test('le client service_role refuse une configuration incomplète et ne fuit pas la clé dans les erreurs',async()=>{
  assert.equal(createAdmin({}),null);assert.equal(createAdmin({SUPABASE_URL:'https://x.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'court'}),null);assert.equal(createAdmin({SUPABASE_URL:'http://evil.example',SUPABASE_SERVICE_ROLE_KEY:'a'.repeat(40)}),null);
  const secret='s'.repeat(40),admin=createAdmin({SUPABASE_URL:'https://x.supabase.co/',SUPABASE_SERVICE_ROLE_KEY:secret},async()=>({ok:false,status:401,text:async()=>'refusé'}));
  await assert.rejects(()=>admin.select('bets'),error=>error.message.includes('HTTP 401')&&!error.message.includes(secret));
});
// BET-53 · points de ligue et quota hebdomadaire
test('les points de ligue : mise fixe de 10, cote plafonnée à 10,00, annulé à 0',()=>{
  assert.equal(leaguePoints({status:'won',odds:1.01}),.1);assert.equal(leaguePoints({status:'won',odds:10}),90);assert.equal(leaguePoints({status:'won',odds:25}),90);
  assert.equal(leaguePoints({status:'lost',odds:3}),-10);assert.equal(leaguePoints({status:'void',odds:3}),0);assert.equal(leaguePoints({status:'won',odds:1.9}),9);
});
test('le règlement attribue les points d’un combiné compté avec sa cote totale, et 0 à un ticket non compté',()=>{
  const bet={id:'c',bet_type:'combined',stake:10,counts_general:true,selections:[leg('a','home',2),leg('b','over',2.5)]};
  assert.deepEqual(planSettlements([bet],[done('a',1,0),done('b',2,1)]),[{id:'c',status:'won',payout:50,points:40}]);
  assert.equal(planSettlements([{...bet,counts_general:false}],[done('a',1,0),done('b',2,1)])[0].points,40);
  assert.equal(planSettlements([bet],[done('a',1,0),{id:'b',voided:true}])[0].points,10);
  assert.equal(planSettlements([bet],[done('a',0,1)])[0].points,-10);
});
test('exemple de la proposition : A devant B devant C au classement par points',()=>{
  const score=(count,won,odds)=>won*leaguePoints({status:'won',odds})+(count-won)*leaguePoints({status:'lost'}),A=score(50,30,1.9),B=score(2,2,2.5),C=score(120,38,3);
  assert.deepEqual([A,B,C].map(Math.round),[70,30,-60]);assert.ok(A>B&&B>C);
});
test('la semaine de quota va du lundi 00:00 au dimanche 23:59, heure de Paris',()=>{
  assert.equal(weekKey('2026-10-19T00:00:00+02:00'),'2026-10-19');assert.equal(weekKey('2026-10-25T23:59:59+01:00'),'2026-10-19');assert.equal(weekKey('2026-10-26T00:00:00+01:00'),'2026-10-26');
  assert.equal(weekKey('2026-10-25T22:30:00Z'),'2026-10-19');assert.equal(weekKey('2026-10-25T23:30:00Z'),'2026-10-26');
});
test('le changement d’heure ne décale pas la semaine (passage à l’heure d’hiver le 25 octobre 2026)',()=>{
  assert.equal(weekKey('2026-10-24T22:30:00Z'),'2026-10-19');assert.equal(weekKey('2026-10-25T01:30:00Z'),'2026-10-19');assert.equal(weekKey('2026-03-29T00:30:00Z'),'2026-03-23');assert.equal(weekKey('2026-03-29T21:30:00Z'),'2026-03-23');assert.equal(weekKey('2026-03-29T23:30:00Z'),'2026-03-30');
});
test('une semaine à cheval sur deux mois reste une seule semaine de quota',()=>{
  assert.equal(weekKey('2026-09-30T10:00:00Z'),'2026-09-28');assert.equal(weekKey('2026-10-02T10:00:00Z'),'2026-09-28');assert.equal(weekKey('2026-10-05T10:00:00Z'),'2026-10-05');
});
test('le 11e pari de la semaine ne compte pas et le motif est donné avant validation',()=>{
  const now=Date.parse('2026-10-22T12:00:00Z'),counted=Array.from({length:10},(_,i)=>({countsGeneral:true,date:'2026-10-20T10:00:00Z',items:[{matchId:'m'+i}]}));
  assert.equal(quotaUsed(counted,now),10);assert.equal(quotaRemaining(counted,now),0);
  assert.deepEqual(leagueEligibility(['m11'],counted,now),{counts:false,reason:'QUOTA',remaining:0});
  assert.deepEqual(leagueEligibility(['m11'],counted.slice(1),now),{counts:true,reason:null,remaining:1});
  assert.equal(leagueEligibility(['m1'],counted.slice(0,3),now).reason,'MATCH_DEJA_COMPTE');
  assert.equal(quotaRemaining([...counted,{countsGeneral:true,date:'2026-10-12T10:00:00Z',items:[]}],now),0);
  assert.equal(quotaRemaining([{countsGeneral:false,date:'2026-10-20T10:00:00Z',items:[]}],now),10);
});
test('le départage suit points, ROI, bons pronos du défi du jour, puis ancienneté',()=>{
  const p={points:50,roi:5,dailyGood:3,joinedAt:'2026-01-01'};
  assert.ok(tieBreak({...p,points:60},p)<0);assert.ok(tieBreak({...p,roi:9},p)<0);assert.ok(tieBreak({...p,dailyGood:4},p)<0);assert.ok(tieBreak({...p,joinedAt:'2025-01-01'},p)<0);assert.equal(tieBreak(p,{...p}),0);
});
// BET-54 · défi du jour
const real=['home','draw','away'],fx=(id,league,home,away,kickoff,odds,extra={})=>({id,league,home,away,kickoff,odds:{home:odds[0],draw:odds[1],away:odds[2]},realOddsMarkets:real,oddsBookmakerCounts:{home:8},...extra}),W={'Ligue des champions':42,'Premier League':34,'Ligue 1':30};
const NOW=Date.parse('2026-10-22T05:00:00Z'),DAY='2026-10-22';
test('le défi du jour garde 4 matchs du jour avec cotes réelles, par importance puis cotes serrées',()=>{
  const matches=[fx('l1a','Ligue 1','A','B','2026-10-22T19:00:00Z',[2.1,3.3,3.4]),fx('pl','Premier League','C','D','2026-10-22T16:30:00Z',[2.5,3.3,2.8]),fx('cl1','Ligue des champions','E','F','2026-10-22T19:00:00Z',[1.5,4.2,6.5]),fx('cl2','Ligue des champions','G','H','2026-10-22T19:00:00Z',[2.4,3.3,2.9]),fx('l1b','Ligue 1','I','J','2026-10-22T19:00:00Z',[1.9,3.4,4]),fx('demain','Ligue des champions','K','L','2026-10-23T19:00:00Z',[2,3,3]),fx('estime','Ligue des champions','M','N','2026-10-22T19:00:00Z',[2,3,3],{realOddsMarkets:['home']})];
  const challenge=pickDailyChallenge(matches,DAY,W,null,NOW);
  assert.equal(challenge.date,DAY);assert.deepEqual(challenge.picks.map(p=>p.matchId),['cl2','cl1','pl','l1a']);assert.deepEqual(challenge.picks[0].odds,{home:2.4,draw:3.3,away:2.9});assert.equal(challenge.picks[0].bookmakers,8);
});
test('le défi compte moins de 4 matchs quand le jour est pauvre en matchs',()=>{
  const m=(n)=>Array.from({length:n},(_,i)=>fx('m'+i,'Ligue 1','A'+i,'B'+i,'2026-10-22T19:00:00Z',[2,3.2,3.5]));
  assert.equal(pickDailyChallenge([],DAY,W,null,NOW).picks.length,0);assert.equal(pickDailyChallenge(m(2),DAY,W,null,NOW).picks.length,2);assert.equal(pickDailyChallenge(m(4),DAY,W,null,NOW).picks.length,4);assert.equal(pickDailyChallenge(m(9),DAY,W,null,NOW).picks.length,4);
});
test('les égalités d’importance sont départagées par les cotes puis par l’identifiant, de façon stable',()=>{
  const ms=[fx('z','Ligue 1','A','B','2026-10-22T19:00:00Z',[2,3.2,3.5]),fx('a','Ligue 1','C','D','2026-10-22T19:00:00Z',[2,3.2,3.5]),fx('t','Ligue 1','E','F','2026-10-22T19:00:00Z',[2.9,3.1,3])];
  assert.deepEqual(pickDailyChallenge(ms,DAY,W,null,NOW).picks.map(p=>p.matchId),['t','a','z']);assert.deepEqual(pickDailyChallenge([...ms].reverse(),DAY,W,null,NOW).picks.map(p=>p.matchId),['t','a','z']);
});
test('la sélection publiée est figée avec ses cotes, seules les places libres sont complétées',()=>{
  const first=pickDailyChallenge([fx('a','Ligue 1','A','B','2026-10-22T19:00:00Z',[2,3.2,3.5])],DAY,W,null,NOW);
  const later=pickDailyChallenge([fx('a','Ligue 1','A','B','2026-10-22T19:00:00Z',[1.2,6,9]),fx('b','Ligue 1','C','D','2026-10-22T20:00:00Z',[2,3.2,3.5]),fx('c','Ligue 1','E','F','2026-10-22T09:00:00Z',[2,3.2,3.5])],DAY,W,first,Date.parse('2026-10-22T10:00:00Z'));
  assert.deepEqual(later.picks.map(p=>p.matchId),['a','b']);assert.deepEqual(later.picks[0].odds,{home:2,draw:3.2,away:3.5});
  assert.equal(pickDailyChallenge([fx('x','Ligue 1','A','B','2026-10-23T19:00:00Z',[2,3,3])],'2026-10-23',W,first,NOW).picks.map(p=>p.matchId).join(),'x');
});
test('le jour du défi suit l’heure de Paris',()=>{assert.equal(parisDate('2026-10-22T22:30:00Z'),'2026-10-23');assert.equal(parisDate('2026-10-22T21:30:00Z'),'2026-10-22')});
test('les pronos du défi sont réglés avec le barème de la ligue, un match annulé vaut 0',()=>{
  const picks=[{id:1,match_id:'a',pick:'home',odd:2.5},{id:2,match_id:'a',pick:'away',odd:3},{id:3,match_id:'b',pick:'draw',odd:3.2},{id:4,match_id:'c',pick:'home',odd:2}];
  assert.deepEqual(planDailySettlements(picks,[done('a',2,0),{id:'b',voided:true}]),[{id:1,status:'won',points:15},{id:2,status:'lost',points:-10},{id:3,status:'void',points:0}]);
});
test('le défi du jour est envoyé à Supabase une fois par jour',async()=>{
  const sent=[],admin={upsert:async(...args)=>sent.push(args)};
  assert.equal(await syncDailyChallenge(admin,{date:DAY,picks:[]}),0);assert.equal(await syncDailyChallenge(admin,{date:DAY,picks:[{matchId:'a'}]}),1);assert.equal(sent.length,1);assert.equal(sent[0][0],'daily_challenges');assert.equal(sent[0][2],'day');
});
