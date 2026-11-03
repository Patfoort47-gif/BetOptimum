import test from 'node:test';
import assert from 'node:assert/strict';
import {priceInventory,PRICE_MARKETS} from '../scripts/propline-prices.mjs';
test('BET-170 : prix réels, budget borné, futurs seulement et aucune clé dans le rapport',async()=>{
 const calls=[],stamp='2026-11-04T20:00:00Z',key='secret-test';
 const report=await priceInventory({key,now:new Date('2026-11-03T12:00:00Z'),budget:1,sports:{A:'a',B:'b'},fetchImpl:async(url,opts)=>{calls.push(url);assert.equal(opts.headers['X-API-Key'],key);assert.equal(new URL(url).searchParams.get('markets'),PRICE_MARKETS.join(','));return{ok:true,json:async()=>[{id:'past',commence_time:'2026-01-01'},{id:'live',live:true,commence_time:stamp},{id:'e',commence_time:stamp,bookmakers:[{key:'book_fr',markets:[{key:'correct_score',outcomes:[{name:'1:0',price:500}]},{key:'unknown'}]}]}]}}});
 assert.equal(calls.length,1);assert.equal(report.requests,1);assert.equal(report.samples.length,1);assert.equal(report.samples[0].id,'e');assert.equal(report.samples[0].bookmakers[0].markets.length,1);assert.ok(!JSON.stringify(report).includes(key));
});
test('BET-170 : arrêt sur refus et aucun secret dans les erreurs',async()=>{
 const r=await priceInventory({key:'secret',fetchImpl:async()=>({ok:false,status:429})});assert.equal(r.requests,1);assert.match(r.failures[0],/429/);
 await assert.rejects(priceInventory({}),/PROPLINE_API_KEY absent/);
});
