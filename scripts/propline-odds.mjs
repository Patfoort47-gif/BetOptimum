import {marketSpec,marketEnabled,isExtendedMarket} from '../markets.js';
// Server-side only. PropLine prices are American unless price_decimal is supplied.
import {sameTeam} from '../team-match.js';
import {isInSecondaryOddsWindow} from '../odds-cache.js';
import {compositeSelection,COMPOSITE_MARKETS} from './propline-composites.mjs';
const BOOKS={betclic:{key:'betclic_fr',name:'Betclic (FR)'},winamax:{key:'winamax_fr',name:'Winamax (FR)'}};
// La réponse peut omettre type : les identités d'exchanges/DFS documentées restent exclues.
export function excludedPropLineBook(book){return !book.key||/exchange|betfair|matchbook|smarkets|polymarket|kalshi/i.test(book.key)||/^(sxbet|novig|prophetx|betdaq|prizepicks|sleeper|dabble|parlayplay|draftkings_pick6)(_|$)/i.test(book.key)||['exchange','prediction_market','dfs'].includes(book.type)}
export function decimalPrice(outcome){
  const decimal=Number(outcome.price_decimal);
  if(Number.isFinite(decimal)&&decimal>1)return decimal;
  const price=Number(outcome.price);
  return Number.isFinite(price)&&Math.abs(price)>=100?Number((price>0?1+price/100:1+100/Math.abs(price)).toFixed(4)):null;
}
export function matchPropLineEvent(match,events){
  const kickoff=Date.parse(match.kickoff),near=events.filter(event=>!event.live&&!event.is_outright&&Math.abs(Date.parse(event.commence_time)-kickoff)<=15*60000);
  const identified=near.filter(event=>event.espn_event_id!=null&&`espn-${event.espn_event_id}`===match.id&&sameTeam(event.home_team,match.home)&&sameTeam(event.away_team,match.away));
  if(identified.length)return identified.length===1?identified[0]:null;
  const named=near.filter(event=>event.espn_event_id==null&&sameTeam(event.home_team,match.home)&&sameTeam(event.away_team,match.away));
  return named.length===1?named[0]:null;
}
export function propLineOffers(event,now=Date.now(),stage=0,h1Enabled=false){
  const offers=[];
  for(const book of event?.bookmakers??[]){
    if(excludedPropLineBook(book))continue;
    const identity=BOOKS[book.key]??{key:book.key,name:book.title??book.key};
    const offer={...identity};
    for(const market of book.markets??[]){
      const half=market.period==='h1'&&h1Enabled===true;if(market.suspended_at||market.period&&!half||(market.team&&market.key!=='team_totals'))continue;
      const updated=Date.parse(market.last_update);
      if(!Number.isFinite(updated)||updated>now+60000||now-updated>60*60000)continue;
      for(const outcome of market.outcomes??[]){
        if((outcome.team&&market.key!=='team_totals')||outcome.redacted||outcome.restricted)continue;
        if(outcome.last_seen_at&&(!Number.isFinite(Date.parse(outcome.last_seen_at))||Date.parse(outcome.last_seen_at)<updated||Date.parse(outcome.last_seen_at)>now+60000))continue;
        let key=null;
        if(half){if(['suspended','removed','closed'].includes(market.status)||/team total/i.test(market.description??''))continue;if(market.team||outcome.team||outcome.period&&outcome.period!=='h1'||outcome.point!=null&&market.key==='h2h')continue;if(market.key==='h2h'){const side=eventSide(event,outcome.name);key=side?'h1'+side:/^draw$/i.test(outcome.name)?'h1Draw':null;if(outcome.side&&String(outcome.side).toLowerCase()!==key?.slice(2).toLowerCase())key=null;}else if(market.key==='totals'&&typeof outcome.point==='number'&&[.5,1.5,2.5].includes(outcome.point)&&/^(Over|Under)$/.test(outcome.name))key='h1'+outcome.name+String(outcome.point*10).padStart(2,'0');}else if(market.key==='h2h')key=sameTeam(outcome.name,event.home_team)?'home':sameTeam(outcome.name,event.away_team)?'away':/^draw$/i.test(outcome.name)?'draw':null;
        else if(market.key==='both_teams_to_score')key=/^yes$/i.test(outcome.name)?'btts':/^no$/i.test(outcome.name)?'bttsNo':null;
        else if(market.key==='totals'&&/^(over|under)$/i.test(outcome.name)&&[1.5,2.5,3.5,...(stage>=3?[.5,4.5,5.5,6.5,7.5,8.5,9.5]:[])].includes(Number(outcome.point))){const side=outcome.name.toLowerCase();key=Number(outcome.point)===2.5?(side==='over'?'over':'under'):side+String(Number(outcome.point)*10).padStart(2,'0')}
        else if(market.key==='double_chance'){
          key=({'1N':'homeDraw','1X':'homeDraw','N2':'drawAway','X2':'drawAway','12':'homeAway'})[outcome.name];
          if(!key){const parts=String(outcome.name??'').split('/').map(name=>name.trim()),home=parts.some(name=>sameTeam(name,event.home_team)),away=parts.some(name=>sameTeam(name,event.away_team)),draw=parts.some(name=>/^draw$/i.test(name));if(parts.length===2)key=home&&draw?'homeDraw':away&&draw?'drawAway':home&&away?'homeAway':null;}
        }
        else if(market.key==='draw_no_bet')key=sameTeam(outcome.name,event.home_team)?'homeDnb':sameTeam(outcome.name,event.away_team)?'awayDnb':null;
        else if(market.key==='team_totals'&&/^(over|under)$/i.test(outcome.name)){
          const team=outcome.team??market.team,side=sameTeam(team,event.home_team)?'home':sameTeam(team,event.away_team)?'away':null,line=Number(outcome.point);
          if(side&&[.5,1.5,2.5,3.5,4.5,5.5].includes(line))key=side+outcome.name[0].toUpperCase()+outcome.name.slice(1).toLowerCase()+String(line*10).padStart(2,'0');
        }
        if(!half&&!key&&stage>=3)key=lotOneSelection(event,market,outcome);
        if(!half&&!key&&stage>=4)key=compositeSelection(event,market,outcome);
        if(!key||!marketEnabled(key,stage,h1Enabled))continue;
        if(isExtendedMarket(key)&&(outcome.player_id||outcome.payout_multiplier!=null||outcome.dfs_odds_type||outcome.suspended_at||['suspended','removed','closed'].includes(outcome.status)))continue;
        const price=decimalPrice(outcome);if(!key||!price)continue;
        if(offer[key]&&Date.parse(offer[`${key}UpdatedAt`])>=updated)continue;
        offer[key]=price;offer[`${key}UpdatedAt`]=market.last_update;offer[`${key}Source`]='PropLine';
      }
    }
    if(Object.keys(offer).some(key=>marketSpec(key))){const existing=offers.find(item=>item.key===offer.key);if(existing){for(const key of Object.keys(offer).filter(key=>marketSpec(key)))if(offer[key]&&(!existing[key]||Date.parse(offer[`${key}UpdatedAt`])>Date.parse(existing[`${key}UpdatedAt`]))){existing[key]=offer[key];existing[`${key}UpdatedAt`]=offer[`${key}UpdatedAt`];existing[`${key}Source`]='PropLine'}}else offers.push(offer)}
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
export async function collectPropLine(matches,leagueSports,{key=process.env.PROPLINE_API_KEY,fetchImpl=fetch,now=Date.now(),maxRequests=8,stage=Number(process.env.PROPLINE_MARKET_STAGE??0),h1Enabled=process.env.PROPLINE_H1_ENABLED==='true'}={}){
  const result={offersByMatch:new Map(),requested:0,succeeded:0,failures:[]};if(![0,1,2,3,4].includes(stage)){result.failures.push('PropLine : étape de marchés invalide');return result}if(!key){result.failures.push('PropLine : secret PROPLINE_API_KEY absent');return result;}
  const eligible=matches.filter(match=>!match.completed&&Date.parse(match.kickoff)>now&&Date.parse(match.kickoff)<=now+7*86400000&&!match.voided&&leagueSports[match.league]);
  for(const sport of [...new Set(eligible.map(match=>leagueSports[match.league]))]){
    if(result.requested>=maxRequests){result.failures.push('PropLine : budget de requêtes atteint');break}
    result.requested++;
    try{
      const query=new URLSearchParams({markets:stage>=3?'h2h,totals,both_teams_to_score,double_chance,draw_no_bet,team_totals,correct_score,european_handicap,winning_margin':stage>=2?'h2h,totals,both_teams_to_score,double_chance,draw_no_bet,team_totals':'h2h,totals,both_teams_to_score',max_age:'3600'});
      if(h1Enabled)query.set('period','all');
      if(stage>=4)query.set('markets',query.get('markets')+','+COMPOSITE_MARKETS.join(','));
      const response=await fetchImpl(`https://api.prop-line.com/v1/sports/${encodeURIComponent(sport)}/odds?${query}`,{headers:{'X-API-Key':key},signal:AbortSignal.timeout(20000),redirect:'error'});
      if(!response.ok){result.failures.push(`PropLine ${sport}: HTTP ${response.status}`);if([401,403,429].includes(response.status))break;continue}
      const events=await response.json();if(!Array.isArray(events))throw new Error('format');
      result.succeeded++;
      for(const match of eligible.filter(match=>leagueSports[match.league]===sport)){
        let offers=propLineOffers(matchPropLineEvent(match,events),now,stage,h1Enabled);if(!isInSecondaryOddsWindow(match,now))offers=offers.map(offer=>Object.fromEntries(Object.entries(offer).filter(([key])=>['key','name','home','draw','away'].includes(key)||/^(home|draw|away)(UpdatedAt|Source)$/.test(key)))).filter(offer=>offer.home||offer.draw||offer.away);if(offers.length)result.offersByMatch.set(match.id,offers);
      }
    }catch{result.failures.push(`PropLine ${sport}: collecte indisponible`)}
  }
  return result;
}

// Formats observés le 3 novembre. Les variantes ambiguës restent ignorées.
export function lotOneSelection(event,market,outcome){
 if(market.period||market.team||outcome.team||outcome.player_id)return null;
 const name=String(outcome.name??'');
 if(market.key==='correct_score'){
  const m=/^([0-9]|1[0-5])\s*[-:]\s*([0-9]|1[0-5])$/.exec(name);
  return m&&outcome.point==null?`score${m[1]}_${m[2]}`:null;
 }
 if(market.key==='european_handicap'){
  const m=/^3-Way Handicap ([+-][0-9])$/.exec(market.description??'');if(!m||Number(m[1])!==outcome.point)return null;
  // Le même handicap à domicile doit figurer sur les trois issues du bloc.
  const side=o=>/^Draw$/i.test(o.name)?'Draw':eventSide(event,o.name);
  if(market.outcomes?.length!==3||new Set(market.outcomes.map(side)).size!==3||market.outcomes.some(o=>!side(o)||o.point!==outcome.point))return null;
  const issue=side(outcome);if(!issue||outcome.side&&outcome.side.toLowerCase()!==issue.toLowerCase())return null;
  return `eh${issue}${outcome.point<0?'M':'P'}${Math.abs(outcome.point)}`;
 }
 if(market.key==='winning_margin'&&outcome.point==null){
  if(['0-0 Draw','No Goal'].includes(name))return 'marginDraw0';
  if(['Score Draw','Any Score Draw (0:0 Excluded)'].includes(name))return 'marginDrawGoals';
  const m=/^(.+?)(?: to win by (exactly )?([1-9]) (goal|goals)( or more)?| By ([1-9])(\+)?)$/.exec(name);if(!m)return null;
  if(m[2]&&m[5])return null;
  const team=eventSide(event,m[1])?.toLowerCase();
  return team?`${team}Margin${m[3]??m[6]}${m[5]||m[7]?'Plus':''}`:null;
 }
 return null;
}

function eventSide(event,name){const home=sameTeam(name,event.home_team),away=sameTeam(name,event.away_team);return home===away?null:home?'Home':'Away'}
