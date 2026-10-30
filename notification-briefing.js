// BET-98 : planification et calculs purs. Aucune destination ni clé fournisseur.
import { analyseMatch } from './model.js';
import { nextAllowed } from './notification-model.js';
const formatters=new Map();
function formatter(timezone) {
  if(!formatters.has(timezone)){if(formatters.size>=100)formatters.clear();formatters.set(timezone,new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}));}
  return formatters.get(timezone);
}
function localParts(now,timezone){return Object.fromEntries(formatter(timezone).formatToParts(new Date(now)).map(p=>[p.type,p.value]));}
export function localDate(now, timezone = 'Europe/Paris') {
  const p=localParts(now,timezone);return `${p.year}-${p.month}-${p.day}`;
}
const minuteAt=(now,timezone)=>{const p=localParts(now,timezone);return Number(p.hour)*60+Number(p.minute);};
const favorite = (m,p) => (p.teams??[]).includes(m.home)||(p.teams??[]).includes(m.away)||(p.leagues??[]).includes(m.league);
export function dayMatches(matches, prefs, now) {
  const date=localDate(now,prefs.timezone);
  return [...new Map(matches.filter(m=>!m.completed&&!m.voided&&Number.isFinite(Date.parse(m.kickoff))&&localDate(m.kickoff,prefs.timezone)===date).map(m=>[m.id,m])).values()].sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff)||String(a.id).localeCompare(String(b.id)));
}
// Recherche sur l’axe UTC : la première occurrence d’une heure répétée fait foi,
// une heure absente au printemps est reportée au premier instant local suivant.
const schedules=new Map();
function daySchedule(now,prefs) {
  const date=localDate(now,prefs.timezone),key=`${prefs.timezone}:${date}`;
  if(!schedules.has(key)){
    if(schedules.size>=100)schedules.clear();
    let start=Math.floor(now/60000)*60000;
    while(localDate(start-3600000,prefs.timezone)===date)start-=3600000;
    while(localDate(start-60000,prefs.timezone)===date)start-=60000;
    const due=new Array(1440).fill(Infinity);let minute=0,t=start;
    for(;localDate(t,prefs.timezone)===date;t+=60000){const current=minuteAt(t,prefs.timezone);while(minute<=current)due[minute++]=t;}
    schedules.set(key,{due,end:t});
  }
  return schedules.get(key);
}
function dailyDue(now,prefs){return daySchedule(now,prefs).due[Number(prefs.briefing_minute??900)];}
export function planBriefing(matches, prefs, now=Date.now()) {
  if(!prefs.enabled||!prefs.channels?.includes('email'))return null;
  const today=dayMatches(matches,prefs,now),fav=today.filter(m=>favorite(m,prefs)),kinds=[];
  const daily=dailyDue(now,prefs);
  if(prefs.daily_briefing&&Number.isFinite(daily)&&nextAllowed(daily,prefs)<=now)kinds.push('daily');
  if(prefs.favorite_briefing&&fav.length){const first=Date.parse(fav[0].kickoff),due=nextAllowed(first-Number(prefs.favorite_lead_minutes??120)*60000,prefs);if(now>=due&&now<first)kinds.push('favorites');}
  if(!kinds.length)return null;
  // Une file différée ne peut pas envoyer le briefing d’hier.
  let expiry=daySchedule(now,prefs).end;
  if(kinds.includes('favorites'))expiry=Math.min(expiry,Date.parse(fav[0].kickoff));
  return {briefing:true,kinds,date:localDate(now,prefs.timezone),kickoff:new Date(expiry).toISOString()};
}
export function briefingPicks(matches,prefs,now=Date.now()) {
  const candidates=[];
  for(const m of matches){
    if(Date.parse(m.kickoff)<=now||!m.odds||![m.homeGoals,m.awayGoals].every(n=>Number.isFinite(Number(n))&&Number(n)>=0))continue;
    const markets=analyseMatch(m).markets.flatMap(market=>{
      const offers=(m.bookmakerOffers??[]).filter(o=>Number(o[market.key])>1&&Number.isFinite(Number(o[market.key]))&&Number.isFinite(Date.parse(o.updatedAt))&&Date.parse(o.updatedAt)<=now&&now-Date.parse(o.updatedAt)<864e5);
      const offer=offers.sort((a,b)=>b[market.key]-a[market.key])[0];if(!offer)return [];
      const odd=Number(offer[market.key]),value=market.probability*odd-1;
      return value>=prefs.min_value&&market.probability>=prefs.min_confidence?[{...market,odd,value,bookmaker:String(offer.name??'Bookmaker'),cached:Boolean(offer[`${market.key}Cached`]),updatedAt:offer.updatedAt}]:[];
    }).sort((a,b)=>b.probability-a.probability||b.value-a.value);
    if(markets.length)candidates.push({...markets[0],match:m});
  }
  return candidates.sort((a,b)=>b.value-a.value||b.probability-a.probability||String(a.match.id).localeCompare(String(b.match.id))).slice(0,3);
}
const money=n=>Math.round((n+Number.EPSILON)*100)/100;
export function ticketProjection(bets, matchIds) {
  const ids=new Set(matchIds),seen=new Set(),tickets=[],outside=[];let unsupported=0;
  for(const bet of bets){
    if(seen.has(bet.id)||bet.status!=='pending'||!Array.isArray(bet.selections)||!bet.selections.some(s=>ids.has(s.matchId)))continue;
    seen.add(bet.id);
    if(bet.bet_type==='multiple'||!['single','combined'].includes(bet.bet_type)||!bet.selections.length||!bet.selections.every(s=>['home','draw','away','over','btts'].includes(s.key))||!Number.isFinite(Number(bet.stake))||Number(bet.stake)<=0||!Number.isFinite(Number(bet.odds))||Number(bet.odds)<=1){unsupported++;continue;}
    const stake=Number(bet.stake),gross=money(stake*Number(bet.odds)),row={id:bet.id,stake,gross,net:money(gross-stake),selections:bet.selections};
    (bet.selections.every(s=>ids.has(s.matchId))?tickets:outside).push(row);
  }
  // Les marchés actuels over et btts sont positifs et compatibles avec chacun
  // des résultats 1N2. Toute divergence 1N2 interdit le total « tous gagnants ».
  const outcomes=new Map();let incompatible=false;
  for(const t of tickets)for(const s of t.selections)if(['home','draw','away'].includes(s.key)){if(outcomes.has(s.matchId)&&outcomes.get(s.matchId)!==s.key)incompatible=true;outcomes.set(s.matchId,s.key);}
  const stake=money(tickets.reduce((s,t)=>s+t.stake,0)),gross=incompatible?null:money(tickets.reduce((s,t)=>s+t.gross,0));
  return {tickets,outside,unsupported,incompatible,stake,gross,net:gross===null?null:money(gross-stake)};
}
export function buildBriefing(matches,prefs,event,account,bets,now=Date.now(),generatedAt=null) {
  const today=dayMatches(matches,prefs,now).filter(m=>Date.parse(m.kickoff)>now),favorites=today.filter(m=>favorite(m,prefs));
  const selected=event.kinds.includes('daily')?today:favorites;
  const fresh=Number.isFinite(Date.parse(generatedAt))&&Date.parse(generatedAt)<=now&&now-Date.parse(generatedAt)<864e5;
  const picks=fresh?briefingPicks(selected,prefs,now):[];
  return {date:event.date,kinds:event.kinds,timezone:prefs.timezone,generatedAt,now:new Date(now).toISOString(),fresh,matches:selected,favorites,hero:picks[0]?.match??selected[0]??null,picks,bankroll:account&&Number.isFinite(Number(account.bankroll))?Number(account.bankroll):null,projection:ticketProjection(bets,selected.map(m=>m.id))};
}
