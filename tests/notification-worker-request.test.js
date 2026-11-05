import test from 'node:test';
import assert from 'node:assert/strict';
import {workerPayload,callNotificationWorker,WORKER_MAX_BYTES} from '../notification-worker-request.js';
import {decodeWorkerMatches,encodeWorkerMatch} from '../notification-worker-codec.js';
import {detectAlerts} from '../notification-model.js';
import {buildBriefing,planBriefing} from '../notification-briefing.js';
const now=Date.parse('2026-11-03T12:00:00Z');
const prefs={enabled:true,channels:['email','discord'],daily_briefing:true,briefing_minute:660,timezone:'Europe/Paris',teams:['Lille'],leagues:[],quiet_start:0,quiet_end:0,min_value:0,min_confidence:0};
const match={id:'m',home:'Lille',away:'Paris',league:'Ligue 1',kickoff:'2026-11-03T20:00:00Z',homeGoals:2,awayGoals:1,odds:{home:3,draw:4,away:5,over:3,btts:3,homeDnb:2},realOddsMarkets:['home'],oddsMovement:{home:{percent:6}},bookmakerOffers:[{name:'Test',home:3,draw:4,away:5,over:3,btts:3,homeDnb:2,homeCached:true,updatedAt:'2026-11-03T11:00:00Z',raw:'inutilisé'}],homeStats:{detail:'x'.repeat(2_100_000)}};
const data={matches:[match],generatedAt:'2026-11-03T11:00:00Z'};
test('le format 2 préserve les offres creuses et refuse les index invalides',()=>{
 const original={id:'sparse',bookmakerOffers:[{key:'one',name:'Réel',home:2},{key:'two',away:3,awayCached:false}]};
 assert.deepEqual(decodeWorkerMatches({format:2,matches:[encodeWorkerMatch(original)]}),[original]);
 assert.deepEqual(decodeWorkerMatches({matches:[original]}),[original]);
 for(const values of [[9,2],[0],[0,1,0,2],[-1,2]])assert.throws(()=>decodeWorkerMatches({format:2,offerFields:['home'],matches:[{bookmakerOffers:[values]}]}),/WORKER_FORMAT/);
 const payload=workerPayload({...data,matches:[match,{...match,completed:true},{...match,voided:true},{...match,kickoff:'2026-11-03T10:00:00Z'}]});
 assert.equal(payload.matches,1);
});
test('le contrat compact conserve détection, conseils et contenu du briefing sans les statistiques volumineuses',()=>{
 const p=workerPayload(data),compact=decodeWorkerMatches(JSON.parse(p.body));
 assert.ok(p.bytes<WORKER_MAX_BYTES);assert.equal(p.matches,1);assert.ok(!p.body.includes('homeStats'));assert.ok(!p.body.includes('inutilisé'));
 const plan={max_favorites:5,odds_step:.1};
 assert.deepEqual(detectAlerts(compact,prefs,plan,now),detectAlerts([match],prefs,plan,now));
 const event=planBriefing([],prefs,now);
 const full=buildBriefing([match],prefs,event,null,[],now,data.generatedAt),small=buildBriefing(compact,prefs,event,null,[],now,data.generatedAt);
 const visible=b=>JSON.parse(JSON.stringify(b,(key,value)=>key==='homeStats'?undefined:key==='raw'?undefined:value));
 assert.deepEqual(visible(small),visible(full));
});
test('un corps trop grand est refusé avant tout appel réseau, taille UTF-8 réelle',async()=>{
 let calls=0;
 await assert.rejects(callNotificationWorker('https://test.supabase.co','secret',{matches:[{...match,home:'é'.repeat(WORKER_MAX_BYTES)}]},async()=>{calls++;}),/trop volumineuse/);
 assert.equal(calls,0);
 assert.equal(workerPayload(data).bytes,Buffer.byteLength(workerPayload(data).body));
});
test('timeout et erreur réseau sont diagnostiqués sans secret et sans deuxième tentative',async()=>{
 for(const failure of [new DOMException('secret destination','TimeoutError'),new TypeError('secret destination')]){
  let calls=0;
  await assert.rejects(callNotificationWorker('https://test.supabase.co','secret',data,async()=>{calls++;throw failure;}),error=>error.message.includes('Aucun rejeu automatique')&&!error.message.includes('secret')&&!error.message.includes('destination'));
  assert.equal(calls,1);
 }
});
test('la réponse HTTP reste filtrée et les compteurs de succès sont lus',async()=>{
 await assert.rejects(callNotificationWorker('https://test.supabase.co','secret',data,async()=>new Response('secret',{status:413})),/HTTP 413$/);
 assert.deepEqual(await callNotificationWorker('https://test.supabase.co','secret',data,async()=>Response.json({queued:1,sent:1})),{queued:1,sent:1});
});

test('HTTP 546 est identifié sans exposer le corps ni rejouer un envoi partiel',async()=>{let calls=0;await assert.rejects(callNotificationWorker('https://test.supabase.co','private-secret',data,async()=>{calls++;return Response.json({code:'WORKER_LIMIT',message:'private-destination',secret:'private-secret'},{status:546})}),error=>/HTTP 546/.test(error.message)&&/limite de ressources/.test(error.message)&&/aucun rejeu automatique/.test(error.message)&&!/private/.test(error.message));assert.equal(calls,1)});
