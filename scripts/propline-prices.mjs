// BET-170 : diagnostic de prix, sans écriture de données de production ni déploiement.
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {API,SPORTS} from './propline-inventory.mjs';
export const PRICE_MARKETS=['h2h','totals','correct_score','winning_margin','european_handicap'];
export async function priceInventory({key,fetchImpl=fetch,sports=SPORTS,budget=8,now=new Date()}={}){
 if(!key)throw new Error('Secret PROPLINE_API_KEY absent');
 const report={generatedAt:now.toISOString(),markets:PRICE_MARKETS,budget:Math.min(8,Math.max(1,Math.floor(Number(budget)||8))),requests:0,failures:[],samples:[]};
 for(const [league,sport] of Object.entries(sports)){
  if(report.requests>=report.budget)break;
  report.requests++;
  try{
   const query=new URLSearchParams({markets:PRICE_MARKETS.join(','),max_age:'3600'});
   const response=await fetchImpl(`${API}/sports/${encodeURIComponent(sport)}/odds?${query}`,{headers:{'X-API-Key':key,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(20000)});
   if(!response.ok){report.failures.push(`${league} : HTTP ${response.status}`);if([401,403,429].includes(response.status))break;continue}
   const events=await response.json();if(!Array.isArray(events)){report.failures.push(`${league} : format inattendu`);continue}
   // Conserver les prix de deux rencontres futures par compétition ; jamais les en-têtes de requête.
   for(const event of events.filter(e=>!e.live&&!e.is_outright&&Date.parse(e.commence_time)>now.getTime()).slice(0,2)){
    report.samples.push({league,id:event.id,espn_event_id:event.espn_event_id,home_team:event.home_team,away_team:event.away_team,commence_time:event.commence_time,bookmakers:(event.bookmakers??[]).map(book=>({key:book.key,title:book.title,type:book.type,markets:(book.markets??[]).filter(m=>PRICE_MARKETS.includes(m.key))}))});
   }
  }catch{report.failures.push(`${league} : réponse indisponible`)}
 }
 return report;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 const report=await priceInventory({key:process.env.PROPLINE_API_KEY,budget:process.env.PROPLINE_INVENTORY_BUDGET});
 await writeFile('propline-prices.json',JSON.stringify(report,null,2)+'\n');
 const coverage=report.samples.map(e=>({league:e.league,markets:[...new Set(e.bookmakers.flatMap(b=>b.markets.map(m=>m.key)))]}));
 console.log(JSON.stringify({requests:report.requests,failures:report.failures,coverage}));
 if(!report.samples.length||report.failures.length)throw new Error('Diagnostic de prix incomplet : consulter le rapport');
}
