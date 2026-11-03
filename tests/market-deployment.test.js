import test from 'node:test';
import assert from 'node:assert/strict';
import {checkMarketDeployment} from '../scripts/check-market-deployment.mjs';
import {auditLotOne} from '../scripts/check-markets-lot-one.mjs';
import {readFile} from 'node:fs/promises';
test('BET-170 : étape 3 refusée avant V40, contrôle sans écriture',async()=>{
 await checkMarketDeployment(2,null);
 await assert.rejects(checkMarketDeployment(3,null),/Supabase serveur requis/);
 await assert.rejects(checkMarketDeployment(4,null),/Étape de marchés invalide/);
 const calls=[],admin={select:async(...args)=>{calls.push(args);return[]},rpc:async()=>null};
 await assert.rejects(checkMarketDeployment(3,admin),/V40/);assert.equal(calls[0][1],'select=market_valid_until&limit=1');
 admin.rpc=async()=> 'Score exact 1 - 0';await checkMarketDeployment(3,admin);
});
test('BET-170 : le catalogue seul ne valide pas une activation, prix sur plusieurs compétitions requis',async()=>{
 assert.equal(auditLotOne({generatedAt:new Date().toISOString(),samples:[],failures:[]}).valid,false);
 const r=JSON.parse(await readFile(new URL('../docs/evidence/propline-lot-one-2026-11-03.json',import.meta.url),'utf8'));
 assert.equal(auditLotOne(r).valid,true);
 assert.equal(auditLotOne({...r,samples:[r.samples[0]]}).valid,false);
 assert.equal(auditLotOne({...r,failures:['quota']}).valid,false);
});
