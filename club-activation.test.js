import test from 'node:test';import assert from 'node:assert/strict';
import {checkClubActivation} from './scripts/check-club-activation.mjs';
const now=new Date('2026-10-23T12:00:00Z');
test('le contrôle du Club refuse un accès manquant et une migration absente avant toute écriture',async()=>{
 await assert.rejects(()=>checkClubActivation(null,now),/SUPABASE_SERVICE_ROLE_KEY/);
 await assert.rejects(()=>checkClubActivation({rpc:async()=>{throw Error('secret');}},now),e=>e.message.includes('saison de football')&&!e.message.includes('secret'));
 await assert.rejects(()=>checkClubActivation({rpc:async()=>{throw Error('HTTP 401 PRIVATE');}},now),e=>e.message.includes('clé serveur')&&!e.message.includes('PRIVATE'));
 await assert.rejects(()=>checkClubActivation({rpc:async()=>'2026-10'},now),/calendrier/);
 await assert.rejects(()=>checkClubActivation({rpc:async()=>'2026-2027',select:async()=>[{id:'club'}]},now),/encore ouvertes/);
});
test('le contrôle du Club exige la validation des quatre catégories de nouveautés',async()=>{
 const calls=[],admin={select:async()=>[],rpc:async(name,args)=>{calls.push({name,args});return name==='football_season'?'2026-2027':true;}};
 assert.equal(await checkClubActivation(admin,now),'2026-2027');assert.equal(calls.filter(c=>c.name==='avatar_config_valid').length,4);
 admin.rpc=async name=>name==='football_season'?'2026-2027':false;
 await assert.rejects(()=>checkClubActivation(admin,now),/nouveaux objets/);
});
