// Server-side only. PropLine prices are American unless price_decimal is supplied.
import {sameTeam} from '../team-match.js';
import {isInSecondaryOddsWindow} from '../odds-cache.js';
const BOOKS={betclic:{key:'betclic_fr',name:'Betclic (FR)'},winamax:{key:'winamax_fr',name:'Winamax (FR)'}};
export function decimalPrice(outcome){
  const decimal=Number(outcome.price_decimal);
  if(Number.isFinite(decimal)&&decimal>1)return decimal;
  const price=Number(outcome.price);
  return Number.isFinite(price)&&Math.abs(price)>=100?Number((price>0?1+price/100:1+100/Math.abs(price)).toFixed(4)):null;
}
export function matchPropLineEvent(match,events){
  const kickoff=Date.parse(match.kickoff),near=events.filter(event=>!event.live&&!event.is_outright&&Math.abs(Date.parse(event.commence_time)-kickoff)<=15*60000);
  const identified=near.filter(event=>event.espn_event_id!=null&&`espn-${event.espn_event_id}`===match.id);
  if(identified.length)return identified.length===1?identified[0]:null;
  const named=near.filter(event=>event.espn_event_id==null&&sameTeam(event.home_team,match.home)&&sameTeam(event.away_team,match.away));
  return named.length===1?named[0]:null;
}
export function propLineOffers(event,now=Date.now()){
  const offers=[];
  for(const book of event?.bookmakers??[]){
    const identity=BOOKS[book.key];if(!identity)continue;
    const offer={...identity};
    for(const market of book.markets??[]){
      if(market.period||market.team)continue;
      const updated=Date.parse(market.last_update);
      if(!Number.isFinite(updated)||updated>now+60000||now-updated>60*60000)continue;
      for(const outcome of market.outcomes??[]){
        if(outcome.team||outcome.redacted||outcome.restricted)continue;
        if(outcome.last_seen_at&&Date.parse(outcome.last_seen_at)<updated)continue;
        const key=market.key==='totals'&&Number(outcome.point)===2.5&&/^over$/i.test(outcome.name)?'over':market.key==='both_teams_to_score'&&/^yes$/i.test(outcome.name)?'btts':null;
        const price=decimalPrice(outcome);if(!key||!price)continue;
        if(offer[key]&&Date.parse(offer[`${key}UpdatedAt`])>=updated)continue;
        offer[key]=price;offer[`${key}UpdatedAt`]=market.last_update;offer[`${key}Source`]='PropLine';
      }
    }
    if(offer.over||offer.btts)offers.push(offer);
  }
  return offers;
}
export function supplementOffers(primary,extra){
  const offers=primary.map(offer=>({...offer}));
  for(const added of extra){
    let offer=offers.find(item=>item.key===added.key);if(!offer){offer={key:added.key,name:added.name};offers.push(offer)}
    for(const key of ['over','btts'])if(!(Number(offer[key])>1)&&Number(added[key])>1){offer[key]=added[key];offer[`${key}UpdatedAt`]=added[`${key}UpdatedAt`];offer[`${key}Source`]='PropLine'}
  }
  return offers;
}
export async function collectPropLine(matches,leagueSports,{key=process.env.PROPLINE_API_KEY,fetchImpl=fetch,now=Date.now()}={}){
  const result={offersByMatch:new Map(),requested:0,succeeded:0,failures:[]};if(!key)return result;
  const eligible=matches.filter(match=>isInSecondaryOddsWindow(match,now)&&!match.voided&&leagueSports[match.league]);
  for(const sport of [...new Set(eligible.map(match=>leagueSports[match.league]))]){
    result.requested++;
    try{
      const query=new URLSearchParams({bookmakers:'betclic,winamax',markets:'totals,both_teams_to_score',max_age:'3600'});
      const response=await fetchImpl(`https://api.prop-line.com/v1/sports/${encodeURIComponent(sport)}/odds?${query}`,{headers:{'X-API-Key':key},signal:AbortSignal.timeout(20000),redirect:'error'});
      if(!response.ok){result.failures.push(`PropLine ${sport}: HTTP ${response.status}`);if([401,403,429].includes(response.status))break;continue}
      const events=await response.json();if(!Array.isArray(events))throw new Error('format');
      result.succeeded++;
      for(const match of eligible.filter(match=>leagueSports[match.league]===sport)){
        const offers=propLineOffers(matchPropLineEvent(match,events),now);if(offers.length)result.offersByMatch.set(match.id,offers);
      }
    }catch{result.failures.push(`PropLine ${sport}: collecte indisponible`)}
  }
  return result;
}
