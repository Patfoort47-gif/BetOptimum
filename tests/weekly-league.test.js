import test from 'node:test';import assert from 'node:assert/strict';
import {roundEnd,parisMidnight} from '../league-round.js';
import {closeWeeklyRounds} from '../scripts/weekly-league-engine.mjs';
test('BET-133 : fin de journée lundi Paris, changements d’heure inclus',()=>{
 assert.equal(new Date(roundEnd('2026-10-24T12:00:00Z')).toISOString(),'2026-10-25T23:00:00.000Z');
 assert.equal(new Date(roundEnd('2026-03-28T12:00:00Z')).toISOString(),'2026-03-29T22:00:00.000Z');
 assert.equal(new Date(parisMidnight('2026-07-06')).toISOString(),'2026-07-05T22:00:00.000Z');
});
test('BET-133 : une journée sans résultats est neutralisée et aucune semaine passée n’est créée',async()=>{
 const calls=[],admin={select:async()=>[{week_start:'2026-10-19',season:'2026-2027'}],selectAll:async()=>[],rpc:async(name,args)=>{calls.push([name,args]);return name==='league_round_standings'?[]:true},insertIgnore:async(...args)=>calls.push(args)};
 assert.equal(await closeWeeklyRounds(admin,new Date('2026-10-26T02:00:00Z')),1);
 assert.deepEqual(calls[1],['apply_league_round',{p_week:'2026-10-19',p_results:[],p_groups:[]}]);assert.equal(calls[2][1][0].week_start,'2026-10-26');
});
test('BET-133 : les inactifs ne sont pas pénalisés à répétition et la relance respecte le serveur',async()=>{
 let count=0,results;
 const players=Array.from({length:40},(_,i)=>({user_id:`u${i}`,echelon:4,joined_at:'2026-01-01',inactive:false}));players.push({user_id:'idle',echelon:4,inactive:true,joined_at:'2026-01-01'});
 const admin={select:async()=>[{week_start:'2026-10-19',season:'2026-2027'}],selectAll:async table=>table==='player_league'?players:[],rpc:async(name,args)=>{if(name==='league_round_standings')return players.map((p,i)=>({user_id:p.user_id,picks:p.user_id==='idle'?0:10,points:100-i,roi:5,qualified:true}));results=args.p_results;return count++===0},insertIgnore:async()=>{}};
 assert.equal(await closeWeeklyRounds(admin,new Date('2026-10-26')),1);assert.ok(!results.some(r=>r.user_id==='idle'));assert.equal(await closeWeeklyRounds(admin,new Date('2026-10-26')),0);
});
import {closeOneSeason} from '../scripts/league-engine.mjs';
test('BET-133 : la clôture annuelle conserve les échelons et le placement',async()=>{
 let payload;const admin={upsert:async()=>{},patch:async()=>{},select:async()=>[{week_start:'2026-10-19'}],selectAll:async(table)=>table==='player_league'?[{user_id:'new',echelon:null,joined_at:'2026-01-01',inactive:false,protected:false}]:[],rpc:async(name,args)=>{payload=args;return true}};
 await closeOneSeason(admin,'2026-2027');assert.equal(payload.p_results[0].to_echelon,null);assert.equal(payload.p_results[0].outcome,'MAINTENU');assert.deepEqual(payload.p_results[0].unlocks,[]);
});
