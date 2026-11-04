// BET-170 : diagnostic de prix, sans écriture de données de production ni déploiement.
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {API,SPORTS} from './propline-inventory.mjs';
export const H1_RELEASE_MARKETS=['h2h','totals','both_teams_to_score','double_chance','draw_no_bet','team_totals','correct_score','european_handicap','winning_margin'];
export const PRICE_MARKETS=['h2h','totals','correct_score','winning_margin','european_handicap'];
export const COMPOSITE_PRICE_MARKETS=['btts_total_goals','double_chance_btts','double_chance_total_goals','result_btts','result_total_goals'];
export const REMAINING_PRICE_MARKETS=['half_time_full_time','spreads','first_team_to_score','2plus_goals','3plus_goals','anytime_goal_scorer','first_goal_scorer','goal_or_assist','goalie_saves','player_assists','player_cards','player_shots','player_shots_on_target','player_tackles','corners_european_handicap','corners_spread','team_cards','team_corners','total_cards','total_corners'];
export const PERIOD_PRICE_MARKETS=['h2h','totals','both_teams_to_score','double_chance','draw_no_bet','team_totals'];
export async function priceInventory({key,fetchImpl=fetch,sports=SPORTS,budget=8,now=new Date(),markets=PRICE_MARKETS,period='full'}={}){
 if(!key)throw new Error('Secret PROPLINE_API_KEY absent');
 if(!['full','h1','h2','all'].includes(period)||!Array.isArray(markets)||!markets.length||new Set(markets).size!==markets.length||markets.some(m=>![...PRICE_MARKETS,...COMPOSITE_PRICE_MARKETS,...REMAINING_PRICE_MARKETS,...PERIOD_PRICE_MARKETS,...H1_RELEASE_MARKETS].includes(m)))throw new Error('Familles de diagnostic invalides');
 const report={generatedAt:now.toISOString(),markets,requestedPeriod:period,budget:Math.min(8,Math.max(1,Math.floor(Number(budget)||8))),requests:0,failures:[],usage:[],samples:[]};
 for(const [league,sport] of Object.entries(sports)){
  if(report.requests>=report.budget)break;
  report.requests++;
  try{
   const query=new URLSearchParams({markets:markets.join(','),max_age:'3600'});
   if(period!=='full')query.set('period',period);
   const response=await fetchImpl(`${API}/sports/${encodeURIComponent(sport)}/odds?${query}`,{headers:{'X-API-Key':key,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(20000)});
   // Liste fermée des compteurs documentés ; jamais de dump des en-têtes.
   const usage={};for(const field of ['x-daily-limit','x-daily-used','x-daily-remaining','x-daily-reset']){const value=response.headers?.get(field);if(value!=null&&/^\d+$/.test(value))usage[field]=Number(value);}report.usage.push({league,...usage});
   if(!response.ok){report.failures.push(`${league} : HTTP ${response.status}`);if([401,403,429].includes(response.status))break;continue}
   const events=await response.json();if(!Array.isArray(events)){report.failures.push(`${league} : format inattendu`);continue}
   // Conserver les prix de deux rencontres futures par compétition ; jamais les en-têtes de requête.
   for(const event of events.filter(e=>!e.live&&!e.is_outright&&Date.parse(e.commence_time)>now.getTime()).slice(0,2)){
    report.samples.push({league,id:event.id,espn_event_id:event.espn_event_id,home_team:event.home_team,away_team:event.away_team,commence_time:event.commence_time,bookmakers:(event.bookmakers??[]).map(book=>({key:book.key,title:book.title,type:book.type,markets:(book.markets??[]).filter(m=>markets.includes(m.key))}))});
   }
  }catch{report.failures.push(`${league} : réponse indisponible`)}
 }
 return report;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 const scope=process.env.PROPLINE_PRICE_SCOPE??'lot-one';
 if(!['lot-one','composites','remaining','h1','h2','h1-release'].includes(scope))throw new Error('Périmètre de diagnostic invalide');
 const report=await priceInventory({key:process.env.PROPLINE_API_KEY,budget:process.env.PROPLINE_INVENTORY_BUDGET,markets:scope==='h1-release'?H1_RELEASE_MARKETS:scope==='composites'?COMPOSITE_PRICE_MARKETS:scope==='remaining'?REMAINING_PRICE_MARKETS:['h1','h2'].includes(scope)?PERIOD_PRICE_MARKETS:PRICE_MARKETS,period:scope==='h1-release'?'all':['h1','h2'].includes(scope)?scope:'full'});
 await writeFile('propline-prices.json',JSON.stringify(report,null,2)+'\n');
 const coverage=report.samples.map(e=>({league:e.league,markets:[...new Set(e.bookmakers.flatMap(b=>b.markets.map(m=>m.key)))]}));
 console.log(JSON.stringify({requests:report.requests,failures:report.failures,coverage}));
 if(!report.samples.length||report.failures.length)throw new Error('Diagnostic de prix incomplet : consulter le rapport');
}
