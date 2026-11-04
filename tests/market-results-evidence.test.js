import test from 'node:test';
import assert from 'node:assert/strict';
import {resultEvidence} from '../scripts/market-results-evidence.mjs';
const match={id:'espn-123',league:'Premier League',completed:true};
test('BET-170 : preuve de résultat bornée, identité explicite, une rencontre terminée par compétition',async()=>{
 let calls=0;const r=await resultEvidence([{...match,completed:false},match,match,{...match,id:'espn-456',league:'Ligue 1'}],{budget:1,fetchImpl:async url=>{calls++;assert.match(url,/eng\.1\/summary\?event=123$/);return{ok:true,json:async()=>({header:{id:'123'},boxscore:{teams:[]},news:['ignored'],commentary:['ignored']})}}});
 assert.equal(calls,1);assert.equal(r.samples.length,1);assert.equal(r.samples[0].commentary,undefined);assert.equal(r.samples[0].news,undefined);assert.equal(r.samples[0].header.id,'123');
});
test('BET-170 : refus, quota et identité de résultat incorrecte ne deviennent jamais une preuve',async()=>{
 const refused=await resultEvidence([match,{...match,id:'espn-456',league:'Ligue 1'}],{fetchImpl:async()=>({ok:false,status:429})});assert.equal(refused.requests,1);assert.equal(refused.samples.length,0);
 const wrong=await resultEvidence([match],{fetchImpl:async()=>({ok:true,json:async()=>({header:{id:'999'}})})});assert.equal(wrong.samples.length,0);assert.equal(wrong.failures.length,1);
});
