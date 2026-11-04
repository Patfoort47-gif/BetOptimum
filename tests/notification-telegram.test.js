import test from 'node:test';
import assert from 'node:assert/strict';
import {detectTelegramAlerts,telegramEventCurrent} from '../notification-telegram.js';
import {workerPayload} from '../notification-worker-request.js';
import {decodeWorkerMatches} from '../notification-worker-codec.js';
const now=Date.parse('2026-11-04T13:00:00Z');
const preferences={enabled:true,min_value:.1,min_confidence:.65,quiet_start:1320,quiet_end:480,timezone:'Europe/Paris'};
const favorites={teams:['Lille'],leagues:[]};
const match={id:'m',home:'Lille',away:'Paris',league:'Ligue 1',kickoff:'2026-11-05T18:00:00Z',homeGoals:3,awayGoals:.5,odds:{home:2},realOddsMarkets:['home'],bookmakerOffers:Array.from({length:10},(_,i)=>({key:`b${i}`,name:`Bookmaker ${i}`,home:2,updatedAt:new Date(now-3600000).toISOString()}))};
test('Telegram exige consentement, favori, seuils forts, dix bookmakers et prix datés',()=>{
 const events=detectTelegramAlerts([match],preferences,favorites,now);
 assert.equal(events.length,1);assert.equal(events[0].telegram,true);assert.equal(events[0].expires_at,'2026-11-04T17:00:00.000Z');
 assert.deepEqual(detectTelegramAlerts([match],{...preferences,enabled:false},favorites,now),[]);
 assert.deepEqual(detectTelegramAlerts([match],preferences,{teams:[],leagues:[]},now),[]);
 for(const offers of [match.bookmakerOffers.slice(0,9),match.bookmakerOffers.map(o=>({...o,key:'same'})),match.bookmakerOffers.map(o=>({...o,updatedAt:undefined})),match.bookmakerOffers.map(o=>({...o,updatedAt:'2026-11-01T00:00:00Z'})),match.bookmakerOffers.map(o=>({...o,updatedAt:'2026-11-05T00:00:00Z'}))])assert.deepEqual(detectTelegramAlerts([{...match,bookmakerOffers:offers}],preferences,favorites,now),[]);
 assert.deepEqual(detectTelegramAlerts([match],{...preferences,min_value:1},favorites,now),[]);
 assert.deepEqual(detectTelegramAlerts(decodeWorkerMatches(JSON.parse(workerPayload({matches:[match],generatedAt:new Date(now).toISOString()}).body)),preferences,favorites,now),events);
});
test('un seul choix par match, et relecture du signal avant envoi',()=>{
 const events=detectTelegramAlerts([match,match],preferences,favorites,now);assert.equal(events.length,1);
 const event=events[0];assert.equal(telegramEventCurrent(event,preferences,favorites,[match],now),true);
 assert.equal(telegramEventCurrent(event,preferences,favorites,[{...match,completed:true}],now),false);
 assert.equal(telegramEventCurrent(event,preferences,{teams:[],leagues:[]},[match],now),false);
 assert.equal(telegramEventCurrent(event,preferences,favorites,[],now),false);
 assert.equal(telegramEventCurrent(event,preferences,favorites,[match],now+4*3600000),false);
 assert.equal(telegramEventCurrent(event,{...preferences,quiet_start:0,quiet_end:1439},favorites,[match],now),false);
});
