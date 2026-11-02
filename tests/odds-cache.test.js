import test from 'node:test';
import assert from 'node:assert/strict';
import {bookmakerOffer,mergeCachedOffers,summarizeOffers} from '../odds-cache.js';
test('BET-151 : conserve les blocs complémentaires et la ligne 2,5',()=>{
 const offer=bookmakerOffer({key:'williamhill',title:'William Hill',markets:[{key:'totals',outcomes:[{name:'Over',point:3.5,price:2}]},{key:'totals',outcomes:[{name:'Over',point:2.5,price:1.4}]},{key:'btts',outcomes:[{name:'No',price:2}]},{key:'btts',outcomes:[{name:'Yes',price:1.4}]}]},'A','B',(a,b)=>a===b);
 assert.equal(offer.over,1.4);assert.equal(offer.btts,1.4);
});
test('BET-151 : fusion par identifiant et variantes régionales distinctes',()=>{
 const offers=mergeCachedOffers([{key:'unibet_fr',name:'Unibet',home:2},{key:'unibet_fr',name:'Unibet FR',btts:1.8},{key:'unibet_uk',name:'Unibet',over:1.9}],[{key:'unibet_fr',name:'Ancien nom',over:1.7},{key:'unibet_uk',name:'Unibet',btts:1.6}]);
 assert.equal(offers.length,2);assert.equal(offers[0].btts,1.8);assert.equal(offers[0].over,1.7);assert.equal(offers[0].overCached,true);assert.equal(offers[1].btts,1.6);
 const summary=summarizeOffers(offers);assert.equal(summary.counts.over,2);assert.equal(summary.averages.over,1.8);
});
