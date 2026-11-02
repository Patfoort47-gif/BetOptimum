// Read-only comparison: The Odds API <=4 credits; PropLine 1 bulk request.
import {writeFile} from 'node:fs/promises';
import {sameTeam} from '../team-match.js';
import {decimalPrice} from './propline-odds.mjs';
const oddsKey=process.env.THE_ODDS_API_KEY,propKey=process.env.PROPLINE_API_KEY;
if(!oddsKey||!propKey)throw Error('Secrets fournisseur manquants');
const sport='soccer_epl',startedAt=new Date().toISOString();let credits=0;
async function get(url,options={}){
 let r;try{r=await fetch(url,{...options,signal:AbortSignal.timeout(30000),redirect:'error'})}catch{throw Error('Collecte fournisseur indisponible')}
 if(!r.ok)throw Error(`Collecte fournisseur : HTTP ${r.status}`);
 const cost=Number(r.headers.get('x-requests-last'));if(Number.isFinite(cost))credits+=cost;
 return r.json();
}
const root=`https://api.the-odds-api.com/v4/sports/${sport}`;
const events=await get(`${root}/events?apiKey=${encodeURIComponent(oddsKey)}`),now=Date.now();
const event=events.filter(e=>Date.parse(e.commence_time)>now&&Date.parse(e.commence_time)<now+48*3600000).sort((a,b)=>Date.parse(a.commence_time)-Date.parse(b.commence_time))[0];
if(!event)throw Error('Aucun match de Premier League dans les prochaines 48 h');
const [odds,props]=await Promise.all([
 get(`${root}/events/${encodeURIComponent(event.id)}/odds?apiKey=${encodeURIComponent(oddsKey)}&regions=eu,uk&markets=btts,totals&oddsFormat=decimal`),
 get('https://api.prop-line.com/v1/sports/soccer_epl/odds?markets=totals,both_teams_to_score&max_age=3600',{headers:{'X-API-Key':propKey}})
]);
const candidates=props.filter(e=>!e.live&&Math.abs(Date.parse(e.commence_time)-Date.parse(event.commence_time))<=15*60000&&sameTeam(e.home_team,event.home_team)&&sameTeam(e.away_team,event.away_team));
if(candidates.length!==1)throw Error('Rapprochement PropLine absent ou ambigu');
function summarize(data,prop){
 const books=new Map();
 for(const b of data.bookmakers??[]){
  const row=books.get(b.key)??{key:b.key,name:b.title,over:false,btts:false};books.set(b.key,row);
  for(const m of b.markets??[]){
   const time=Date.parse(m.last_update??b.last_update);
   if(m.period||m.team||!Number.isFinite(time)||now-time>3600000||time>now+60000)continue;
   for(const o of m.outcomes??[]){
    if(o.team||o.redacted||o.restricted||(o.last_seen_at&&Date.parse(o.last_seen_at)<time))continue;
    const price=prop?decimalPrice(o):Number(o.price);if(!Number.isFinite(price)||price<=1)continue;
    if(m.key===(prop?'both_teams_to_score':'btts')&&/^yes$/i.test(o.name))row.btts=true;
    if(m.key==='totals'&&/^over$/i.test(o.name)&&Number(o.point)===2.5)row.over=true;
   }
  }
 }
 const rows=[...books.values()].filter(b=>b.over||b.btts).sort((a,b)=>a.name.localeCompare(b.name));
 return {bookmakers:rows.length,btts:rows.filter(b=>b.btts).length,over:rows.filter(b=>b.over).length,both:rows.filter(b=>b.btts&&b.over).length,rows};
}
const report={startedAt,completedAt:new Date().toISOString(),event:{home:event.home_team,away:event.away_team,kickoff:event.commence_time},scope:{theOddsApi:'eu,uk',propLine:'tous les bookmakers, sans filtre',freshnessMinutes:60,markets:'BTTS Yes et total du match Over exactement 2,5, temps réglementaire',variants:'Chaque identifiant régional reste distinct'},theOddsApiCredits:credits,theOddsApi:summarize(odds,false),propLine:summarize(candidates[0],true)};
await writeFile('french-odds-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
