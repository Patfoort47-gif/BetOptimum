import test from 'node:test';import assert from 'node:assert/strict';
// BET-62 · boutique et usages des jetons
const S=await import('./shop.js');
test('le catalogue : identifiants uniques, prix dans la fourchette de la rareté, exclusifs non achetables',()=>{
  const ids=S.CATALOG.map(e=>e.id);assert.equal(new Set(ids).size,ids.length);assert.ok(S.CATALOG.every(S.validPrice),'prix hors fourchette');
  assert.ok(S.CATALOG.filter(e=>e.exclusive).every(e=>e.price===0&&e.rarity==='exclusive'));assert.ok(S.purchasable(S.CATALOG).every(e=>e.price>=300));assert.deepEqual(Object.keys(S.CATEGORIES).sort(),[...new Set(S.CATALOG.map(e=>e.category))].sort());
  assert.ok(S.CATALOG.some(e=>e.id==='acc-crown'&&e.exclusive)&&S.CATALOG.some(e=>e.id==='kit-champion'&&e.exclusive));
});
test('les trophées portent les noms des récompenses du football et les prix de référence : Ballon d’or 50 000, Soulier d’or 20 000',()=>{const price=id=>S.CATALOG.find(e=>e.id===id).price,name=id=>S.CATALOG.find(e=>e.id===id).name;assert.equal(price('trophy-ball'),50000);assert.equal(price('trophy-boot'),20000);assert.deepEqual(['trophy-ball','trophy-boot','trophy-glove','trophy-pichichi'].map(name),['Ballon d’or','Soulier d’or','Gant d’or','Pichichi']);assert.ok(price('trophy-glove')>=25000);assert.ok(S.CATALOG.filter(e=>e.category==='background').length>=15)});
test('aucun équipementier, aucun sponsor, aucune instance, aucun nom de stade réel (seuls les noms de récompenses sont repris du football)',()=>{
  const names=S.CATALOG.map(e=>e.name).concat(S.PACKS.map(p=>p.name)).join(' ');assert.doesNotMatch(names,/Allianz|Camp Nou|Maracan|Bernab|Wembley|Parc des Princes|Spotify|Nike|Adidas|Puma|UEFA|FIFA|Champions League/i);
});
test('la vitrine du jour : 8 objets, la même pour tous, renouvelée chaque jour, sans exclusif',()=>{
  const a=S.dailyShowcase(S.CATALOG,'2026-10-22'),b=S.dailyShowcase(S.CATALOG,'2026-10-22'),c=S.dailyShowcase(S.CATALOG,'2026-10-23');
  assert.equal(a.length,8);assert.deepEqual(a,b);assert.notDeepEqual(a,c);assert.equal(new Set(a).size,8);assert.ok(a.every(id=>!S.CATALOG.find(e=>e.id===id).exclusive));
  assert.deepEqual(S.dailyShowcase(S.CATALOG,'2026-10-22',3).length,3);
});
test('l’objet de la semaine est à -30 % et reste le même toute la semaine',()=>{
  const weekly=S.weeklyItem(S.CATALOG,'2026-10-19'),entry=S.CATALOG.find(e=>e.id===weekly);assert.ok(entry.price>=1500&&!entry.exclusive);assert.equal(S.weeklyItem(S.CATALOG,'2026-10-19'),weekly);
  assert.equal(S.priceFor(entry,weekly),Math.round(entry.price*.7));assert.equal(S.priceFor(entry,'autre'),entry.price);
  assert.ok(new Set(['2026-10-12','2026-10-19','2026-10-26','2026-11-02','2026-11-09','2026-11-16'].map(w=>S.weeklyItem(S.CATALOG,w))).size>1);
});
test('un pack stade coûte moins cher que ses éléments séparés',()=>{
  for(const pack of S.PACKS){const separate=pack.components.reduce((sum,id)=>sum+S.CATALOG.find(e=>e.id===id).price,0),price=S.packPrice(pack.components);assert.ok(price<separate);assert.equal(price,Math.round(separate*.8));assert.ok(pack.components.every(id=>S.CATALOG.some(e=>e.id===id)))}
  assert.equal(S.PACKS.length,6);
});
test('la revente rend 30 % du prix payé, arrondi à l’inférieur',()=>{assert.equal(S.resalePrice(1000),300);assert.equal(S.resalePrice(1799),539);assert.equal(S.resalePrice(0),0)});
test('une collection complète est reconnue : les deux vues d’un stade, les quatre maillots à motifs',()=>{
  assert.deepEqual(S.completedCollections(S.CATALOG,['bg-rio-in']),[]);assert.deepEqual(S.completedCollections(S.CATALOG,['bg-rio-in','bg-rio-out']),['stade-rio']);
  assert.deepEqual(S.completedCollections(S.CATALOG,['kit-stripe-vertical','kit-stripe-band','kit-stripe-hoops','kit-stripe-scarf','bg-paris-in','bg-paris-out']).sort(),['maillots-motifs','stade-paris']);assert.deepEqual(S.completedCollections(S.CATALOG,[]),[]);
});
test('achat impossible : exclusif, déjà possédé, division insuffisante, solde insuffisant',()=>{
  const item=S.CATALOG.find(e=>e.id==='bg-rio-in'),block=(entry,ctx)=>S.purchaseBlock(entry,{balance:5000,...ctx});
  assert.equal(block(S.CATALOG.find(e=>e.id==='acc-crown'),{}),'EXCLUSIF');assert.equal(block(item,{owned:['bg-rio-in']}),'POSSEDE');assert.equal(block({...item,minDivision:3},{division:2}),'DIVISION');assert.equal(block({...item,minDivision:3},{division:3}),null);assert.equal(block({...item,minDivision:3},{division:null}),'DIVISION');
  assert.equal(S.purchaseBlock(item,{balance:item.price-1}),'SOLDE');assert.equal(S.purchaseBlock(item,{balance:item.price}),null);const weekly=item.id;assert.equal(S.purchaseBlock(item,{balance:Math.round(item.price*.7),weeklyId:weekly}),null);
});
test('recharge de bankroll : 1 000 € fictifs contre 500 jetons, seulement sous 50 €',()=>{assert.equal(S.canRefill(49.99,500),true);assert.equal(S.canRefill(50,500),false);assert.equal(S.canRefill(10,499),false);assert.deepEqual(S.REFILL,{price:500,amount:1000,below:50});assert.equal(S.SHIELD_PRICE,800)});
test('duels : mises de 50 à 5 000 jetons, le meilleur prono du jour remporte le tout, égalité remboursée',()=>{
  assert.deepEqual([49,50,5000,5001,50.5,'100'].map(S.validDuelStake),[false,true,true,false,false,false]);
  assert.equal(S.duelWinner({picks:4,points:20},{picks:4,points:10}),'creator');assert.equal(S.duelWinner({picks:4,points:-5},{picks:2,points:3}),'opponent');assert.equal(S.duelWinner({picks:3,points:10},{picks:3,points:10}),null);
  assert.equal(S.duelWinner({picks:0,points:0},{picks:0,points:0}),null);assert.equal(S.duelWinner({picks:0,points:0},{picks:1,points:-10}),'opponent');assert.equal(S.duelWinner({picks:2,points:-10},{picks:0,points:0}),'creator');
});
const E=await import('./scripts/shop-engine.mjs'),M=await import('./model.js'),R=await import('./rewards.js');
test('les lignes envoyées au serveur : catalogue puis 6 packs recalculés, exclusifs gratuits, rien d’autre',()=>{
  const rows=E.shopRows();assert.equal(rows.length,S.CATALOG.length+6);assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
  const pack=rows.find(r=>r.id==='pack-rio');assert.equal(pack.category,'pack');assert.equal(pack.price,S.packPrice(S.PACKS[0].components));assert.deepEqual(pack.pack_of,S.PACKS[0].components);
  assert.ok(rows.filter(r=>r.exclusive).every(r=>r.price===0)&&rows.filter(r=>!r.exclusive).every(r=>r.price>0));assert.ok(rows.every(r=>['id','category','name','rarity','price','exclusive'].every(k=>k in r)));
});
test('les duels : expiration des invitations, règlement après le jour du défi, report tant que des pronos sont en attente',()=>{
  const duel=(id,status,day='2026-10-21')=>({id,day,creator_id:'a',opponent_id:'b',status}),pick=(user,points,status='won',day='2026-10-21')=>({user_id:user,day,points,status});
  assert.deepEqual(E.planDuelSettlements([duel('d1','pending')],[],'2026-10-22'),[{id:'d1',winner:null}]);assert.deepEqual(E.planDuelSettlements([duel('d1','pending','2026-10-22')],[],'2026-10-22'),[]);
  assert.deepEqual(E.planDuelSettlements([duel('d2','accepted')],[pick('a',15),pick('a',-10),pick('b',3)],'2026-10-22'),[{id:'d2',winner:'a'}]);
  assert.deepEqual(E.planDuelSettlements([duel('d3','accepted')],[pick('a',5),pick('b',9)],'2026-10-22'),[{id:'d3',winner:'b'}]);
  assert.deepEqual(E.planDuelSettlements([duel('d4','accepted')],[pick('a',5),pick('b',5)],'2026-10-22'),[{id:'d4',winner:null}]);
  assert.deepEqual(E.planDuelSettlements([duel('d5','accepted')],[pick('a',5,'pending'),pick('b',9)],'2026-10-22'),[]);assert.deepEqual(E.planDuelSettlements([duel('d5','accepted')],[pick('a',5,'pending'),pick('b',9)],'2026-10-24'),[{id:'d5',winner:'b'}]);
  assert.deepEqual(E.planDuelSettlements([duel('d6','accepted')],[],'2026-10-22'),[{id:'d6',winner:null}]);assert.deepEqual(E.planDuelSettlements([duel('d7','settled')],[],'2026-10-30'),[]);
});
test('le bouclier de série : la première défaite après l’achat ne casse pas la série, une seule fois',()=>{
  const w=(id,at)=>({id,settled_at:at,points:10,odds:2}),l=(id,at)=>({id,settled_at:at,points:-10,odds:2}),entries=[w(1,'2026-10-01'),w(2,'2026-10-02'),w(3,'2026-10-03'),l(4,'2026-10-04'),w(5,'2026-10-05'),l(6,'2026-10-06'),w(7,'2026-10-07')];
  assert.deepEqual([M.streakState(entries).current,M.streakState(entries).best],[1,3]);
  const shield={from:'2026-10-03T12:00:00Z'},state=M.streakState(entries,shield);assert.deepEqual([state.current,state.best,state.shieldUsed],[1,4,true]);
  assert.equal(M.streakState(entries,{from:'2026-10-05T00:00:00Z'}).best,3);assert.equal(M.streakState(entries,{from:'2026-10-08T00:00:00Z'}).shieldUsed,false);
  const bank=R.piggyBank(entries,shield),plain=R.piggyBank(entries);assert.ok(bank.total>=plain.total);assert.equal(bank.streak,1);
});
test('la collection complète donne le badge Collectionneur dans les statistiques de trophées',()=>{
  assert.deepEqual(S.completedCollections([{id:'a',collection:'c'},{id:'b',collection:'c'},{id:'z'}],['a','b']),['c']);
});
