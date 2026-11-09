import test from 'node:test';
import assert from 'node:assert/strict';
import {reserveSync} from '../scripts/odds-sync-quota.mjs';
const now=Date.parse('2026-11-06T17:00:00Z'),at=hours=>new Date(now-hours*3600000).toISOString();
test('BET-211 : réserve au plus deux tentatives par 24 h espacées de 12 h',()=>{
 assert.equal(reserveSync([at(8)],now),null);
 assert.equal(reserveSync([at(23),at(12)],now),null);
 assert.equal(reserveSync([at(24),at(12)],now).length,2);
 assert.equal(reserveSync([at(-1)],now),null);
 assert.throws(()=>reserveSync(['invalide'],now));
 assert.equal(reserveSync([],now).length,1);
});

test('BET-252 : forçage explicite journalisé sans changer la protection automatique',()=>{
 const attempts=[at(8),at(2)],reserved=reserveSync(attempts,now,{force:true});
 assert.deepEqual(reserved,[...attempts,new Date(now).toISOString()]);
 assert.deepEqual(attempts,[at(8),at(2)]);
 assert.equal(reserveSync(attempts,now),null);
 assert.equal(reserveSync(attempts,now,{force:'true'}),null);
 assert.equal(reserveSync(reserved,now+3600000),null);
 assert.equal(reserveSync([at(-1)],now,{force:true}),null);
 assert.throws(()=>reserveSync(['invalide'],now,{force:true}));
});
