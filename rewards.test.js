import test from 'node:test';import assert from 'node:assert/strict';
// BET-57 · niveaux, XP, titres, trophées, défis hebdomadaires
const M=await import('./model.js'),R=await import('./rewards.js');
test('la courbe d’XP : 85 pour le niveau 2, 205 au niveau 100, environ 790 au niveau 1000, environ 486 000 au total',()=>{
  assert.equal(M.xpForLevel(1),85);assert.equal(M.xpForLevel(100),205);assert.equal(M.xpForLevel(999),790);assert.ok(Math.abs(M.xpForLevel(500)-500)<=10);
  assert.ok(Math.abs(M.totalXpForLevel(1000)-486000)<=1000);assert.equal(M.totalXpForLevel(1),0);assert.equal(M.totalXpForLevel(2),85);
});
test('le niveau se déduit de l’XP, plafonné à 1000, avec la progression vers le suivant',()=>{
  assert.equal(M.levelFromXp(0).level,1);assert.equal(M.levelFromXp(84).level,1);assert.equal(M.levelFromXp(85).level,2);assert.equal(M.levelFromXp(-5).level,1);assert.equal(M.levelFromXp(1e9).level,1000);assert.equal(M.levelFromXp(1e9).progress,1);
  const info=M.levelFromXp(100);assert.deepEqual([info.level,info.into,info.next],[2,15,M.xpForLevel(2)]);assert.ok(info.progress>0&&info.progress<1);
  for(const level of [2,50,100,500,999])assert.equal(M.levelFromXp(M.totalXpForLevel(level)).level,level);
});
test('un joueur régulier (environ 1 500 XP par mois) atteint le niveau 100 en une dizaine de mois',()=>{const months=M.totalXpForLevel(100)/1500;assert.ok(months>8&&months<12,`${months} mois`)});
test('les titres suivent les paliers de niveau',()=>{assert.deepEqual([1,24,25,99,100,249,250,499,500,749,750,999,1000].map(M.titleForLevel),['Rookie','Rookie','Titulaire','Titulaire','Confirmé','Confirmé','Expert','Expert','Vétéran','Vétéran','Légende','Légende','Immortel'])});
const win=(id,odds)=>({id,points:(odds-1)*10,odds}),loss=id=>({id,points:-10,odds:2});
test('une série compte les bons pronos à 1,50 ou plus, une défaite la remet à zéro',()=>{
  const state=M.streakState([win(1,2),win(2,2),win(3,2),win(4,1.2),win(5,2)]);assert.deepEqual([state.current,state.best,state.multiplier],[4,4,1.2]);assert.deepEqual(state.milestones,[{at:3,id:3}]);
  const reset=M.streakState([win(1,2),win(2,2),loss(3),win(4,2)]);assert.deepEqual([reset.current,reset.best,reset.multiplier],[1,2,1]);
  assert.deepEqual(M.streakState([{id:1,points:0,odds:2},win(2,2)]).current,1);
  assert.deepEqual([3,5,8,12,2,20].map(M.streakMultiplier),[1.2,1.5,2,3,1,3]);
  assert.deepEqual(M.streakState(Array.from({length:12},(_,i)=>win(i,2))).milestones.map(step=>step.at),[3,5,8,12]);
});
test('le barème d’XP : compté +2, gagné +10 (+5 dès 2,50), défi complet +10, paliers de série, rien pour un prono perdu',()=>{
  const events=R.planXpEvents({counted:[{user_id:'a',ref:'le:1'}],wins:[{user_id:'a',ref:'bet:x',odds:2},{user_id:'a',ref:'bet:y',odds:2.5}],dailyDays:[{user_id:'a',day:'2026-10-22',played:4,offered:4,settled:true},{user_id:'a',day:'2026-10-21',played:3,offered:4,settled:true},{user_id:'b',day:'2026-10-22',played:4,offered:4,settled:false}],sequences:{a:Array.from({length:5},(_,i)=>win(i+1,2))}}),xp=Object.fromEntries(events.map(e=>[e.event_key,e.xp]));
  assert.deepEqual(xp,{'counted:le:1':2,'won:bet:x':10,'won:bet:y':15,'daily-full:2026-10-22':10,'streak:3:3':15,'streak:5:5':25});
});
test('un même événement ne donne jamais deux fois de l’XP : clés stables et uniques',()=>{
  const input={counted:[{user_id:'a',ref:'le:1'}],wins:[{user_id:'a',ref:'bet:x',odds:3}],sequences:{a:Array.from({length:8},(_,i)=>win(i+1,2))},seasons:[{user_id:'a',season:'2026-10',outcome:'PROMU',group_rank:1,group_size:20}]},once=R.planXpEvents(input),twice=R.planXpEvents(structuredClone(input));
  assert.deepEqual(once,twice);assert.equal(new Set(once.map(e=>`${e.user_id}|${e.event_key}`)).size,once.length);
});
test('fin de saison : de 150 à 600 XP selon la place, montée +200, champion de groupe +500, rien pour un inactif',()=>{
  const xp=R.planXpEvents({seasons:[{user_id:'a',season:'2026-10',outcome:'PROMU',group_rank:1,group_size:20},{user_id:'b',season:'2026-10',outcome:'MAINTENU',group_rank:20,group_size:20},{user_id:'c',season:'2026-10',outcome:'INACTIF',group_rank:null,group_size:null},{user_id:'d',season:'2026-10',outcome:'RELEGUE',group_rank:10,group_size:19}]});
  const by=(u,k)=>xp.find(e=>e.user_id===u&&e.event_key.startsWith(k))?.xp;assert.equal(by('a','season:'),600);assert.equal(by('a','promo:'),200);assert.equal(by('a','group-champion:'),500);assert.equal(by('b','season:'),150);assert.equal(by('c','season:'),undefined);assert.ok(by('d','season:')>150&&by('d','season:')<600);assert.equal(by('b','promo:'),undefined);
  assert.equal(R.rankXp(1,1,100,400),400);assert.equal(R.rankXp(5,5,100,400),100);
});
test('ligues spéciales : de 100 à 400 XP selon le classement et 1 000 XP pour le titre',()=>{
  const events=R.planXpEvents({specials:[{user_id:'a',league_id:'ldc',season:'2026-27',rank:1,size:30},{user_id:'b',league_id:'ldc',season:'2026-27',rank:30,size:30}],titles:[{user_id:'a',league_id:'ldc',season:'2026-27',kind:'champion'},{user_id:'a',league_id:'ldc',season:'2026-27',kind:'top1'}]}),by=(u,k)=>events.find(e=>e.user_id===u&&e.event_key.startsWith(k))?.xp;
  assert.equal(by('a','special:'),400);assert.equal(by('b','special:'),100);assert.equal(by('a','special-title:'),1000);assert.equal(events.filter(e=>e.kind==='special-title').length,1);
});
test('les 12 trophées de départ valent de 50 à 500 XP et se débloquent selon les statistiques',()=>{
  assert.equal(R.BADGES.length,12);assert.ok(R.BADGES.every(b=>b.xp>=50&&b.xp<=500));
  const all=R.evaluateBadges({picks:1,bestStreak:12,valueWins:10,wonOdds:[5.5],perfectDay:true,promoted:true,groupChampion:true,specialChampion:true,dayStreak:30,seasons:6,collector:true});assert.equal(all.length,12);
  assert.deepEqual(R.evaluateBadges({picks:3,bestStreak:5,valueWins:9,wonOdds:[4.9],dayStreak:29,seasons:5}),['first-pick','streak-5']);assert.deepEqual(R.evaluateBadges({picks:0,bestStreak:0,valueWins:0,wonOdds:[],dayStreak:0,seasons:0}),[]);
  assert.equal(R.planXpEvents({badges:[{user_id:'a',badge:'streak-12'}]})[0].xp,500);
});
test('la série de jours consécutifs',()=>{assert.equal(R.dayStreak([]),0);assert.equal(R.dayStreak(['2026-10-01','2026-10-02','2026-10-03','2026-10-05']),3);assert.equal(R.dayStreak(['2026-10-31','2026-11-01','2026-11-02','2026-11-02']),3);assert.equal(R.dayStreak(Array.from({length:30},(_,i)=>new Date(Date.UTC(2026,9,1+i)).toISOString().slice(0,10))),30)});
test('défis hebdomadaires : score, classement stable et XP par place, jamais de points de ligue',()=>{
  const bets=[{status:'won',stake:10,payout:18,odds:1.8,value_bet:true},{status:'lost',stake:10,payout:0,odds:1.5,value_bet:false},{status:'won',stake:10,payout:35,odds:3.5,value_bet:true},{status:'pending',stake:10,payout:0,odds:2,value_bet:false}];
  assert.deepEqual(R.challengeScore('safe-week',bets),{score:13,bets:2,wins:1});assert.deepEqual(R.challengeScore('value-hunter',bets),{score:53,bets:2,wins:2});assert.deepEqual(R.challengeScore('perfect-five',bets),{score:1,bets:3,wins:2});
  const rows=R.rankChallenge([{user_id:'c',score:5,bets:2,wins:1},{user_id:'a',score:20,bets:3,wins:2},{user_id:'b',score:20,bets:3,wins:2},{user_id:'d',score:0,bets:0,wins:0}]);assert.deepEqual(rows.map(r=>[r.user_id,r.rank]),[['a',1],['b',2],['c',3]]);
  assert.deepEqual([1,2,3,4].map(R.challengeXp),[100,60,30,10]);assert.equal(Object.keys(R.CHALLENGES).length,3);
});
const X=await import('./scripts/xp-engine.mjs');
test('les entrées d’XP sont assemblées depuis la base : pronos comptés, victoires, défi complet, séries, saisons et trophées',()=>{
  const entries=Array.from({length:5},(_,i)=>({id:i+1,user_id:'a',bet_id:'b'+(i+1),daily_pick_id:null,points:10,settled_at:`2026-10-0${i+1}T10:00:00Z`}));
  const bets=entries.map((e,i)=>({id:e.bet_id,user_id:'a',odds:2,stake:10,payout:20,status:'won',value_bet:i<2}));
  const dailyPicks=['m1','m2','m3','m4'].map((m,i)=>({id:i+1,user_id:'a',day:'2026-10-06',odd:2.5,status:'won'}));
  const inputs=X.buildXpInputs({entries,bets,dailyPicks,challenges:[{day:'2026-10-06',picks:[1,2,3,4]}],specialPicks:[{id:9,user_id:'a',source:'grid',bet_id:null,status:'won',odd:3}],seasonResults:[{season:'2026-09',user_id:'a',outcome:'PROMU',group_rank:1,group_size:20}],standings:[{league_id:'ldc',scope:'season',user_id:'a',picks:3,rank:1}],titles:[{league_id:'ldc',season:'2026-27',user_id:'a',kind:'champion'}]});
  assert.equal(inputs.counted.length,6);assert.equal(inputs.wins.length,10);assert.deepEqual(inputs.dailyDays,[{user_id:'a',day:'2026-10-06',played:4,offered:4,settled:true}]);assert.equal(inputs.sequences.a.length,5);assert.deepEqual(inputs.specials,[{user_id:'a',league_id:'ldc',season:'2026-27',rank:1,size:1}]);
  const stats=inputs.stats.a;assert.deepEqual([stats.picks,stats.bestStreak,stats.valueWins,stats.perfectDay,stats.promoted,stats.groupChampion,stats.specialChampion,stats.seasons],[6,5,2,true,true,true,true,1]);
  assert.ok(R.evaluateBadges(stats).includes('streak-5'));assert.ok(R.evaluateBadges(stats).includes('perfect-day'));
  const events=R.planXpEvents(inputs),keys=events.map(e=>e.event_key);assert.equal(new Set(keys).size,keys.length);assert.ok(keys.includes('daily-full:2026-10-06')&&keys.includes('streak:5:5')&&keys.includes('special-title:ldc:2026-27'));
});
// BET-58 · jetons et récompenses de saison
test('exemple de la proposition : (640 × 1,25 + 570) × 2 = 2 740 jetons',()=>{
  const reward=R.seasonReward({piggy:640,share:.85,prize:570,difficulty:2,feats:[]});assert.equal(reward.total,2740);assert.equal(reward.regularity,1.25);
});
test('la régularité : 100 % ×1,5 ; 80 % et plus ×1,25 ; 60 % et plus ×1,1 ; en dessous ×1',()=>{assert.deepEqual([1,.9,.8,.7,.6,.59,0].map(R.regularityMultiplier),[1.5,1.25,1.25,1.1,1.1,1,1])});
test('la prime de classement partage une cagnotte de 500 jetons par joueur : 1 800 au 1er, 570 au 5e, 250 au 20e pour un groupe de 20',()=>{
  const prizes=Array.from({length:20},(_,i)=>R.rankPrize(i+1,20));assert.ok(Math.abs(prizes[0]-1800)<=5);assert.ok(Math.abs(prizes[4]-570)<=5);assert.ok(Math.abs(prizes[19]-250)<=8);
  assert.ok(Math.abs(prizes.reduce((a,b)=>a+b,0)-10000)<=20);assert.ok(prizes.every((p,i)=>i===0||p<=prizes[i-1]));assert.equal(R.rankPrize(1,1),500);assert.equal(R.rankPrize(0,20),0);assert.equal(R.rankPrize(21,20),0);
});
test('la difficulté et les primes d’exploit sont multipliées par la division',()=>{
  assert.deepEqual([0,1,2,3,4,5,6].map(R.divisionDifficulty),[1,1.25,1.5,2,3,4,5]);
  const reward=R.seasonReward({piggy:100,share:0,prize:100,difficulty:3,feats:['promotion','group-champion']});assert.equal(reward.total,(100+100)*3+(300+1000)*3);assert.equal(R.seasonReward({piggy:0,share:1,prize:0,difficulty:5,feats:['master-champion']}).total,50000);
});
test('les primes d’exploit viennent du résultat de saison : montée, barrage, champion de groupe, champion du Master',()=>{
  assert.deepEqual(R.featsOf({outcome:'PROMU',barrage:true,group_rank:1,group_size:20,from_echelon:5}),['promotion','barrage','group-champion']);assert.deepEqual(R.featsOf({outcome:'MAINTENU',group_rank:3,group_size:20}),[]);
  assert.deepEqual(R.featsOf({outcome:'MAINTENU',group_rank:1,group_size:20,from_echelon:16}),['group-champion','master-champion']);assert.deepEqual(R.featsOf({outcome:'INACTIF',group_rank:1,group_size:20}),[]);assert.deepEqual(R.featsOf({outcome:'MAINTENU',group_rank:1,group_size:5,from_echelon:2}),[]);
});
test('la tirelire ajoute les gains au multiplicateur de série du moment, un prono perdu ne retire rien',()=>{
  const w=(id,odds)=>({id,points:(odds-1)*10,odds}),l=id=>({id,points:-10,odds:2});
  const bank=R.piggyBank([w(1,2),w(2,2),w(3,2),w(4,2),l(5),w(6,2)]);
  assert.deepEqual(bank.parts.map(p=>p.gain),[10,10,12,12,10]);assert.equal(bank.total,54);assert.equal(bank.streak,1);
  assert.equal(R.piggyBank([w(1,1.2),w(2,1.2)]).total,4);assert.equal(R.piggyBank([l(1)]).total,0);assert.equal(R.piggyBank([{id:1,points:0,odds:2}]).total,0);
  assert.equal(R.piggyBank(Array.from({length:12},(_,i)=>w(i,2))).parts.at(-1).gain,30);
});
test('défis hebdomadaires : jetons 500, 300 et 150 pour le podium',()=>{assert.deepEqual([1,2,3,4].map(R.challengeTokens),[500,300,150,0])});
const T=await import('./scripts/token-engine.mjs');
test('séries et tirelires de la saison par ligue',()=>{
  const w=(id,odds)=>({id,points:(odds-1)*10,odds}),rows=T.planStreaks({season:'2026-10',sequences:{a:[w(1,2),w(2,2),w(3,2)]},specialSequences:{ldc:{a:[w(9,2)],b:[{id:8,points:-10,odds:2}]}}}),by=(u,l)=>rows.find(r=>r.user_id===u&&r.league===l);
  assert.deepEqual([by('a','general').current,by('a','general').multiplier,by('a','general').piggy],[3,1.2,32]);assert.equal(by('a','ldc').current,1);assert.equal(by('b','ldc').piggy,0);assert.equal(rows.length,3);
});
test('la fin de saison de la ligue générale verse les jetons du barème et ignore les inactifs',()=>{
  const results=[{user_id:'a',from_echelon:11,to_echelon:12,outcome:'PROMU',group_rank:1,group_size:20,barrage:false},{user_id:'b',from_echelon:11,to_echelon:11,outcome:'MAINTENU',group_rank:20,group_size:20},{user_id:'c',from_echelon:11,to_echelon:10,outcome:'INACTIF',group_rank:null,group_size:null}];
  const sequences={a:Array.from({length:4},(_,i)=>({id:i,points:10,odds:2}))},plan=T.planGeneralRewards({season:'2026-10',results,participation:{a:{played:4,offered:4},b:{played:2,offered:4}},sequences});
  assert.equal(plan.rewards.length,2);const a=plan.rewards.find(r=>r.user_id==='a'),b=plan.rewards.find(r=>r.user_id==='b');
  assert.deepEqual(a.feats,['promotion','group-champion']);assert.equal(a.regularity,1.5);assert.equal(a.difficulty,2);assert.equal(a.piggy,44);assert.equal(a.total,Math.round((44*1.5+R.rankPrize(1,20))*2+(300+1000)*2));
  assert.equal(b.regularity,1);assert.equal(b.total,Math.round(R.rankPrize(20,20)*2));assert.deepEqual(plan.ledger.map(l=>[l.user_id,l.reason,l.ref]),[['a','season','2026-10:general'],['b','season','2026-10:general']]);
});
test('fin de compétition d’une ligue spéciale : difficulté de la ligue et prime de champion',()=>{
  const league={id:'ldc',difficulty:1.5},rounds=[1,2,3,4].map(i=>({id:'r'+i,starts_at:`2026-10-0${i}T19:00:00Z`})),members=[{user_id:'a',joined_at:'2026-09-01'},{user_id:'b',joined_at:'2026-10-03'}],pick=(id,user,round,points)=>({id,user_id:user,round_id:round,odd:2,points,status:points>0?'won':'lost',settled_at:`2026-10-0${id}`});
  const picks=[pick(1,'a','r1',10),pick(2,'a','r2',10),pick(3,'b','r3',10),pick(4,'b','r4',-10)],ranked=[{user_id:'a',picks:2,rank:1},{user_id:'b',picks:2,rank:2},{user_id:'z',picks:0,rank:3}];
  const plan=T.planSpecialRewards({league,season:'2026-27',rounds,members,picks,ranked,titles:[{user_id:'a',kind:'champion'}]}),a=plan.rewards.find(r=>r.user_id==='a'),b=plan.rewards.find(r=>r.user_id==='b');
  assert.equal(plan.rewards.length,2);assert.deepEqual(a.feats,['special-champion']);assert.equal(a.difficulty,1.5);assert.equal(a.regularity,1);assert.equal(b.regularity,1.5);assert.equal(a.total,Math.round((20*1+R.rankPrize(1,2))*1.5+1000*1.5));assert.equal(plan.ledger[0].ref,'2026-27:ldc');
});
test('primes mensuelles des ligues spéciales : 300, 200 et 100 jetons au podium du mois, multipliés par la difficulté',()=>{
  const prizes=T.planMonthlyPrizes({league:{id:'liga',difficulty:1.25},month:'2026-09',standings:[{user_id:'c',picks:3,rank:3},{user_id:'a',picks:5,rank:1},{user_id:'b',picks:2,rank:2},{user_id:'d',picks:1,rank:4},{user_id:'z',picks:0,rank:1}]});
  assert.deepEqual(prizes.map(p=>[p.user_id,p.delta]),[['a',375],['b',250],['c',125]]);assert.ok(prizes.every(p=>p.reason==='special-month'&&p.ref==='liga:2026-09'));
});
// BET-50 · carte joueur
test('la carte joueur : 6 attributs entre 20 et 99, note générale entre 1 et 99',()=>{
  const none=M.cardAttributes({});assert.deepEqual(Object.keys(none),M.CARD_ATTRIBUTES);assert.ok(Object.values(none).every(v=>v>=20&&v<=99));assert.equal(none.PRÉ,20);assert.equal(none.DIS,50);assert.ok(M.cardOverall(none)>=1&&M.cardOverall(none)<=99);
  const star=M.cardAttributes({settled:200,wins:140,staked:2000,returned:2800,avgOdds:4,tickets30:100,activeDays30:20,avgStakeRatio:.02});assert.deepEqual(Object.values(star),[99,99,99,99,99,99]);assert.equal(M.cardOverall(star),99);
  const bad=M.cardAttributes({settled:50,wins:5,staked:500,returned:100,avgOdds:1.2,tickets30:0,activeDays30:0,avgStakeRatio:.5});assert.deepEqual(Object.values(bad),[20,20,20,20,20,20]);assert.equal(M.cardOverall(bad),20);
});
test('chaque attribut suit sa formule : précision, value, régularité, audace, volume, discipline',()=>{
  const base={settled:100,wins:45,staked:1000,returned:1000,avgOdds:2.65,tickets30:10,activeDays30:10,avgStakeRatio:.11},a=M.cardAttributes(base);
  assert.equal(a.PRÉ,60);assert.equal(M.cardAttributes({...base,wins:70}).PRÉ,99);assert.ok(M.cardAttributes({...base,wins:60}).PRÉ>a.PRÉ);assert.ok(M.cardAttributes({...base,returned:1300}).VAL>a.VAL);assert.ok(M.cardAttributes({...base,activeDays30:15}).RÉG>a.RÉG);assert.ok(M.cardAttributes({...base,avgOdds:3.5}).AUD>a.AUD);assert.ok(M.cardAttributes({...base,tickets30:50}).VOL>a.VOL);assert.ok(M.cardAttributes({...base,avgStakeRatio:.05}).DIS>a.DIS);
  assert.equal(M.cardAttributes({...base,settled:0,wins:0}).PRÉ,20);
});
test('la carte est provisoire sous 10 paris réglés, la moyenne du groupe arrondit chaque attribut',()=>{
  assert.equal(M.cardProvisional({settled:9}),true);assert.equal(M.cardProvisional({settled:10}),false);assert.equal(M.cardProvisional(undefined),true);
  assert.deepEqual(M.averageAttributes([{PRÉ:40,VAL:50,RÉG:60,AUD:70,VOL:80,DIS:90},{PRÉ:60,VAL:51,RÉG:61,AUD:71,VOL:81,DIS:91}]),{PRÉ:50,VAL:51,RÉG:61,AUD:71,VOL:81,DIS:91});assert.deepEqual(M.averageAttributes([]),{PRÉ:0,VAL:0,RÉG:0,AUD:0,VOL:0,DIS:0});
});
