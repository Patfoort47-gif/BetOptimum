import test from 'node:test';
import assert from 'node:assert/strict';
import {collectCalendarOdds,resolveCompetition} from '../scripts/propline-competitions.mjs';
const now=Date.parse('2026-11-09T08:00:00Z');
const match=(league,hours=2)=>({id:league,league,home:'Home',away:'Away',kickoff:new Date(now+hours*3600000).toISOString()});
const catalog=[{key:'soccer_france_coupe_de_france',title:'Coupe de France',active:true},{key:'soccer_copa_del_rey',title:'Copa del Rey',active:true}];
test('BET-251 : résolution exacte des coupes, absence et ambiguïté rejetées',()=>{
 assert.equal(resolveCompetition('Coupe de France',catalog),catalog[0].key);
 assert.equal(resolveCompetition('Copa del Rey',catalog),catalog[1].key);
 for(const rows of [[],[{key:'soccer_france_ligue_one',title:'Ligue 1'}],[{...catalog[0],active:false}],[catalog[0],{...catalog[0],key:'soccer_other'}],[{...catalog[0],has_outrights:true}]])assert.equal(resolveCompetition('Coupe de France',rows),null);
});
test('BET-251 : cotes des coupes et sélections par compétition après découverte',async()=>{
 const matches=[match('Coupe de France'),match('Copa del Rey',3),match('Ligue des nations',4)],calls=[];
 const result=await collectCalendarOdds(matches,{key:'test',now,fetchImpl:async(url,options)=>{
  calls.push(url);assert.equal(options.headers['X-API-Key'],'test');
  if(url.endsWith('/sports'))return{ok:true,json:async()=>catalog};
  const league=url.includes('coupe_de_france')?'Coupe de France':url.includes('copa_del_rey')?'Copa del Rey':'Ligue des nations',m=matches.find(m=>m.league===league);
  return{ok:true,json:async()=>[{home_team:m.home,away_team:m.away,commence_time:m.kickoff,bookmakers:[{key:'book',markets:[{key:'h2h',last_update:new Date(now).toISOString(),outcomes:[{name:'Home',price_decimal:2}]}]}]}]};
 }});
 assert.equal(calls.length,4);assert.equal(result.requested,4);assert.equal(result.succeeded,3);assert.equal(result.offersByMatch.size,3);assert.deepEqual(result.failures,[]);
});
test('BET-251 : coupe absente signalée, matchs passés ignorés',async()=>{
 const result=await collectCalendarOdds([match('Coupe de France')],{key:'test',now,fetchImpl:async()=>({ok:true,json:async()=>[]})});
 assert.deepEqual(result.unavailableLeagues,['Coupe de France']);assert.match(result.failures[0],/Coupe de France/);
 let calls=0;await collectCalendarOdds([match('Coupe de France',-2)],{key:'test',now,fetchImpl:async()=>{calls++;}});assert.equal(calls,0);
});
test('BET-251 : catalogue inclus dans le budget, priorité aux rencontres proches',async()=>{
 const calls=[];const result=await collectCalendarOdds([match('Copa del Rey',10),match('Coupe de France',2)],{key:'test',now,maxRequests:2,fetchImpl:async url=>{calls.push(url);return{ok:true,json:async()=>url.endsWith('/sports')?catalog:[]}}});
 assert.equal(calls.length,2);assert.match(calls[1],/coupe_de_france/);assert.equal(result.requested,2);assert.match(result.failures.join(','),/budget/);
});
test('BET-251 : arrêt après refus et repli des compétitions connues sur panne catalogue',async()=>{
 for(const status of [401,403,429]){let calls=0;const result=await collectCalendarOdds([match('Coupe de France'),match('Ligue des nations')],{key:'test',now,fetchImpl:async()=>{calls++;return{ok:false,status}}});assert.equal(calls,1);assert.match(result.failures[0],new RegExp(String(status)));}
 let calls=0;const result=await collectCalendarOdds([match('Coupe de France'),match('Ligue des nations')],{key:'test',now,fetchImpl:async url=>{calls++;if(url.endsWith('/sports'))throw Error('secret');return{ok:true,json:async()=>[]}}});assert.equal(calls,2);assert.equal(result.succeeded,1);assert.equal(JSON.stringify(result).includes('secret'),false);
});
