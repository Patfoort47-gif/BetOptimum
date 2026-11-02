import {readFile,writeFile} from 'node:fs/promises';
import {collectPropLine} from './propline-odds.mjs';
import {isInSecondaryOddsWindow} from '../odds-cache.js';
if(!process.env.PROPLINE_API_KEY)throw new Error('Secret PROPLINE_API_KEY absent');
const data=JSON.parse(await readFile('data/fixtures.json','utf8')),matches=data.matches.filter(m=>m.league==='Premier League'&&isInSecondaryOddsWindow(m));
if(!matches.length)throw new Error('Aucun match de Premier League dans la fenêtre de 48 h');
let providerRows=[];
const result=await collectPropLine(matches,{'Premier League':'soccer_epl'},{fetchImpl:async(...args)=>{
 const response=await fetch(...args);
 if(response.ok){const events=await response.clone().json();if(Array.isArray(events))providerRows=events.filter(e=>!e.live).slice(0,3).map(e=>({id:e.id,espn_event_id:e.espn_event_id,home:e.home_team,away:e.away_team,kickoff:e.commence_time,books:(e.bookmakers??[]).map(b=>({key:b.key,markets:(b.markets??[]).map(m=>({key:m.key,period:m.period,team:m.team,updatedAt:m.last_update,outcomes:(m.outcomes??[]).slice(0,6).map(o=>({name:o.name,point:o.point,price:o.price,price_decimal:o.price_decimal,last_seen_at:o.last_seen_at}))}))}))}))}
 return response;
}});
const report={capturedAt:new Date().toISOString(),requested:result.requested,succeeded:result.succeeded,failures:result.failures,matches:[...result.offersByMatch].map(([matchId,offers])=>({matchId,offers})),providerRows};
await writeFile('french-odds-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
if(result.failures.length||!result.offersByMatch.size)throw new Error('Validation PropLine incomplète : consulter le rapport');
