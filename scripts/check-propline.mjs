// Bounded read-only diagnostic, executed in Actions with the provider secret.
import {readFile,writeFile} from 'node:fs/promises';
import {STAGE_ONE,STAGE_TWO} from '../markets.js';
import {collectCalendarOdds} from './propline-competitions.mjs';
import {isInSecondaryOddsWindow,summarizeOffers} from '../odds-cache.js';
if(!process.env.PROPLINE_API_KEY)throw new Error('Secret PROPLINE_API_KEY absent');
const data=JSON.parse(await readFile('data/fixtures.json','utf8')),matches=data.matches.filter(m=>isInSecondaryOddsWindow(m));
if(!matches.length)throw new Error('Aucun match dans la fenêtre de 48 h');
const samples={};
const result=await collectCalendarOdds(matches,{fetchImpl:async(...args)=>{
 const response=await fetch(...args);
 if(response.ok&&Number(process.env.PROPLINE_MARKET_STAGE)>1){const events=await response.clone().json();for(const event of Array.isArray(events)?events:[])for(const book of event.bookmakers??[])for(const market of book.markets??[])if(['double_chance','team_totals'].includes(market.key)&&!samples[market.key])samples[market.key]={home:event.home_team,away:event.away_team,book:book.key,market};}
 return response;
}});
console.log('::notice title=Format marchés PropLine::'+JSON.stringify(samples));
const rows=[...result.offersByMatch].map(([matchId,offers])=>({matchId,league:matches.find(m=>m.id===matchId).league,offers,...summarizeOffers(offers)}));
const validated=rows.filter(row=>['home','draw','away','over','btts'].every(key=>row.counts[key]>=2));
const stage=Number(process.env.PROPLINE_MARKET_STAGE??0),extended=rows.filter(row=>(stage===1?STAGE_ONE:STAGE_TWO).every(key=>row.counts[key]>=2));
const report={stage,teamTotalsMatches:rows.filter(row=>Object.keys(row.counts).some(key=>/^(home|away)(Over|Under)/.test(key)&&row.counts[key]>0)).length,extendedValidatedMatches:extended.length,capturedAt:new Date().toISOString(),requested:result.requested,succeeded:result.succeeded,failures:result.failures,matches:rows,validatedMatches:validated.length,validatedLeagues:[...new Set(validated.map(row=>row.league))]};
console.log('::notice title=Couverture PropLine::'+JSON.stringify({stage,requested:result.requested,succeeded:result.succeeded,failures:result.failures,validated:validated.length,leagues:report.validatedLeagues,extended:extended.length,teamTotalsMatches:report.teamTotalsMatches,counts:rows.map(row=>({league:row.league,counts:row.counts}))}));
await writeFile('french-odds-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
if(result.failures.length||validated.length<2||report.validatedLeagues.length<2)throw new Error('Validation PropLine incomplète : plusieurs rencontres et compétitions avec cinq sélections et plusieurs bookmakers requises');

if(stage>0&&extended.length<2)throw new Error('Validation des marchés supplémentaires incomplète : consulter le rapport');
