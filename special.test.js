import test from 'node:test';import assert from 'node:assert/strict';
// BET-56 · ligues spéciales : compétitions, clubs, grille de journée
const S=await import('./special.js');
const ldc={id:'ldc',kind:'competition',league_label:'Ligue des champions'},liga={id:'liga',kind:'competition',league_label:'La Liga'},barca={id:'club-83',kind:'club',team_id:'83'};
const m=(id,league,home,away,homeId,awayId,kickoff,priority=50,extra={})=>({id,league,home,away,homeId,awayId,kickoff,priority,...extra});
const ms=[m('barca-bayern','Ligue des champions','FC Barcelone','Bayern Munich','83','132','2026-10-21T19:00:00Z',120),m('city-psg','Ligue des champions','Manchester City','Paris SG','382','160','2026-10-21T19:00:00Z',100),m('inter-ajax','Ligue des champions','Inter','Ajax','110','139','2026-10-22T19:00:00Z',60),m('porto-x','Ligue des champions','Porto','X','1','2','2026-10-22T19:00:00Z',40),m('late','Ligue des champions','A','B','3','4','2026-10-28T19:00:00Z',10),m('real-sev','La Liga','Real Madrid','Séville','86','243','2026-10-24T19:00:00Z',90),m('barca-gir','La Liga','FC Barcelone','Gérone','83','9812','2026-10-25T19:00:00Z',70),m('annule','La Liga','C','D','5','6','2026-10-25T20:00:00Z',10,{voided:true})];
test('l’appartenance : compétition par son libellé, club par l’identifiant ESPN d’une des deux équipes',()=>{
  assert.equal(S.belongsToLeague(ldc,ms[0]),true);assert.equal(S.belongsToLeague(liga,ms[0]),false);assert.equal(S.belongsToLeague(barca,ms[0]),true);assert.equal(S.belongsToLeague(barca,ms[6]),true);assert.equal(S.belongsToLeague(barca,ms[1]),false);assert.equal(S.belongsToLeague(barca,{homeId:null,awayId:undefined}),false);
});
test('une journée de compétition regroupe la semaine, avec l’affiche comme match phare et 3 pronos libres',()=>{
  const rounds=S.planRounds(ldc,ms);assert.equal(rounds.length,2);assert.deepEqual(rounds[0].match_ids,['barca-bayern','city-psg','inter-ajax','porto-x']);assert.equal(rounds[0].anchor,'barca-bayern');assert.equal(rounds[0].free_slots,3);assert.equal(rounds[0].id,'ldc|2026-10-19');assert.equal(rounds[1].anchor,'late');
});
test('en élimination directe il reste 2 pronos libres',()=>{
  const ko=['a','b'].map((id,i)=>m(id,'Ligue des champions','H'+i,'A'+i,'1','2','2027-03-09T20:00:00Z',10+i,{knockout:true})),[round]=S.planRounds(ldc,ko);assert.equal(round.knockout,true);assert.equal(round.free_slots,2);assert.equal(round.anchor,'b');
  assert.equal(S.planRounds(ldc,[...ko,m('c','Ligue des champions','H','A','1','2','2027-03-10T20:00:00Z',1)])[0].free_slots,3);
});
test('une journée de ligue club est un match, toutes compétitions confondues, et les matchs annulés sont ignorés',()=>{
  const rounds=S.planRounds(barca,ms);assert.deepEqual(rounds.map(r=>r.anchor),['barca-bayern','barca-gir']);assert.ok(rounds.every(r=>r.free_slots===1&&r.match_ids.length===1));assert.equal(S.planRounds(liga,ms).flatMap(r=>r.match_ids).includes('annule'),false);
});
test('un pari Barça - Bayern compte en LDC et en Barça, pas en Liga',()=>{
  const sel=[{matchId:'barca-bayern',key:'home'}],fit=(league,picks=[])=>S.ticketFit(league,S.planRounds(league,ms),picks,sel);
  assert.deepEqual(fit(ldc),{counts:true,kind:'anchor',roundId:'ldc|2026-10-19'});assert.deepEqual(fit(barca),{counts:true,kind:'anchor',roundId:'club-83|barca-bayern'});assert.deepEqual(fit(liga),{counts:false,reason:'HORS_LIGUE'});
});
test('le quota de la journée : 3 pronos libres, un seul prono par match et par ligue',()=>{
  const rounds=S.planRounds(ldc,ms),pick=(id,kind='free')=>({round_id:'ldc|2026-10-19',match_ids:[id],kind}),sel=id=>[{matchId:id,key:'over'}];
  assert.equal(S.ticketFit(ldc,rounds,[],sel('inter-ajax')).kind,'free');
  assert.equal(S.ticketFit(ldc,rounds,[pick('city-psg'),pick('inter-ajax'),pick('porto-x')],sel('barca-bayern')).reason,'QUOTA_JOURNEE');
  assert.equal(S.ticketFit(ldc,rounds,[pick('inter-ajax')],sel('inter-ajax')).reason,'MATCH_DEJA_COMPTE');
  assert.equal(S.ticketFit(ldc,rounds,[pick('barca-bayern','anchor')],[{matchId:'city-psg',key:'home'}]).kind,'free');
  assert.equal(S.ticketFit(ldc,rounds,[pick('barca-bayern','anchor')],[{matchId:'barca-bayern',key:'home'}]).reason,'MATCH_DEJA_COMPTE');
  assert.equal(S.ticketFit(ldc,rounds,[],[{matchId:'barca-bayern',key:'home'},{matchId:'late',key:'home'}]).reason,'HORS_LIGUE');
  const combo=S.ticketFit(ldc,rounds,[],[{matchId:'city-psg',key:'home'},{matchId:'inter-ajax',key:'over'}]);assert.deepEqual([combo.counts,combo.kind],[true,'free']);
});
test('en ligue club : 1N2 sur le match du club puis un autre marché, rien de plus',()=>{
  const rounds=S.planRounds(barca,ms),pick=kind=>({round_id:'club-83|barca-bayern',match_ids:['x'],kind});
  assert.equal(S.ticketFit(barca,rounds,[],[{matchId:'barca-bayern',key:'draw'}]).kind,'anchor');assert.equal(S.ticketFit(barca,rounds,[],[{matchId:'barca-bayern',key:'btts'}]).kind,'free');
  assert.equal(S.ticketFit(barca,rounds,[pick('free')],[{matchId:'barca-bayern',key:'over'}]).reason,'QUOTA_JOURNEE');assert.equal(S.ticketFit(barca,rounds,[{round_id:'club-83|barca-bayern',match_ids:['barca-bayern'],kind:'anchor'}],[{matchId:'barca-bayern',key:'over'}]).kind,'free');
  const two=[{round_id:'club-83|barca-bayern',match_ids:['p'],kind:'anchor'},{round_id:'club-83|barca-bayern',match_ids:['q'],kind:'free'}];
  assert.equal(S.ticketFit(barca,rounds,two,[{matchId:'barca-bayern',key:'btts'}]).reason,'QUOTA_JOURNEE');assert.equal(S.ticketFit(barca,rounds,[two[0]],[{matchId:'barca-bayern',key:'home'}]).reason,'QUOTA_JOURNEE');
});
test('le titre de champion demande 60 % des journées depuis l’arrivée, une arrivée tardive réduit la base',()=>{
  assert.equal(S.championEligible(6,10),true);assert.equal(S.championEligible(5,10),false);assert.equal(S.championEligible(3,4),true);assert.equal(S.championEligible(0,0),false);
});
test('les paliers Top 1 % et Top 10 %',()=>{assert.equal(S.tier(1,50),'top1');assert.equal(S.tier(2,50),'top10');assert.equal(S.tier(5,50),'top10');assert.equal(S.tier(6,50),null);assert.equal(S.tier(2,300),'top1');assert.equal(S.tier(1,0),null)});
test('le classement d’une ligue additionne les pronos réglés, par saison ou par mois, et départage par ROI puis ancienneté',()=>{
  const members=[{user_id:'a',joined_at:'2026-09-01'},{user_id:'b',joined_at:'2026-08-01'},{user_id:'c',joined_at:'2026-08-15'}],picks=[{user_id:'a',points:15,status:'won',settled_at:'2026-10-02'},{user_id:'a',points:-10,status:'lost',settled_at:'2026-10-03'},{user_id:'b',points:5,status:'won',settled_at:'2026-09-20'},{user_id:'b',points:0,status:'pending',settled_at:null},{user_id:'a',points:3,status:'won',settled_at:'2026-09-21'}];
  const season=S.specialStandings(picks,members);assert.deepEqual(season.map(r=>[r.user_id,r.points,r.picks,r.rank]),[['a',8,3,1],['b',5,1,2],['c',0,0,3]]);
  const month=S.specialStandings(picks,members,'2026-10');assert.deepEqual(month.map(r=>[r.user_id,r.points]),[['a',5],['b',0],['c',0]]);assert.equal(month[1].user_id,'b');
});
const E=await import('./scripts/special-engine.mjs');
test('les pronos de grille sont réglés avec le barème de la ligue, un match annulé vaut 0',()=>{
  const done=(id,h,a)=>({id,completed:true,homeScore:h,awayScore:a}),picks=[{id:1,match_ids:['a'],key:'home',odd:2.5},{id:2,match_ids:['a'],key:'over',odd:1.8},{id:3,match_ids:['b'],key:'draw',odd:3},{id:4,match_ids:['c'],key:'home',odd:2}];
  assert.deepEqual(E.planGridSettlements(picks,[done('a',1,0),{id:'b',voided:true}]),[{id:1,status:'won',points:15},{id:2,status:'lost',points:-10},{id:3,status:'void',points:0}]);
});
test('les lignes de classement comptent saison, mois et journées jouées',()=>{
  const members=[{user_id:'a',joined_at:'2026-09-01'},{user_id:'b',joined_at:'2026-09-02'}],picks=[{user_id:'a',round_id:'r1',points:15,status:'won',settled_at:'2026-10-02T10:00:00Z'},{user_id:'a',round_id:'r2',points:-10,status:'lost',settled_at:'2026-09-30T10:00:00Z'},{user_id:'a',round_id:'r2',points:9,status:'won',settled_at:'2026-10-03T10:00:00Z'}];
  const rows=E.standingRows('ldc',members,picks,'2026-10',new Date('2026-10-04T00:00:00Z')),a=scope=>rows.find(r=>r.user_id==='a'&&r.scope===scope);
  assert.equal(rows.length,4);assert.equal(a('season').points,14);assert.equal(a('season').played_rounds,2);assert.equal(a('2026-10').points,24);assert.equal(a('2026-10').picks,2);assert.equal(rows.find(r=>r.user_id==='b'&&r.scope==='season').rank,2);
});
test('les titres de fin de saison : champion avec 60 % des journées, paliers Top 1 % et Top 10 %',()=>{
  const league={id:'ldc',season_end:'2027-06-30'},rounds=Array.from({length:10},(_,i)=>({id:'r'+i,starts_at:`2026-10-${10+i}T19:00:00Z`,ends_at:`2026-10-${10+i}T21:00:00Z`})),members=[{user_id:'a',joined_at:'2026-08-01'},{user_id:'b',joined_at:'2026-08-01'},{user_id:'c',joined_at:'2026-08-01'}];
  const picks=[...Array.from({length:4},(_,i)=>({user_id:'a',round_id:'r'+i,points:50,status:'won',settled_at:'2026-11-01'})),...Array.from({length:7},(_,i)=>({user_id:'b',round_id:'r'+i,points:10,status:'won',settled_at:'2026-11-01'})),{user_id:'c',round_id:'r0',points:-10,status:'lost',settled_at:'2026-11-01'}];
  const titles=E.planTitles({league,rounds,members,picks,season:'2026-27'});
  assert.deepEqual(titles.filter(t=>t.kind==='champion').map(t=>t.user_id),['b']);assert.ok(titles.some(t=>t.user_id==='a'&&t.kind==='top1'));assert.equal(titles.some(t=>t.kind==='champion'&&t.user_id==='a'),false);assert.equal(E.leagueSeasonLabel({season_start:'2026-08-01',season_end:'2027-06-30'}),'2026-27');
});
