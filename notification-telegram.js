// BET-69 : alertes rares, indépendantes du briefing email. Aucun accès privé ici.
import { detectAlerts, quietAt } from './notification-model.js';
import { quoteAvailable } from './quote-policy.js';
import { marketKeys } from './markets.js';
export function detectTelegramAlerts(matches, preferences, favorites, now=Date.now()) {
 if(!preferences?.enabled)return [];
 const fresh=matches.map(match=>({...match,bookmakerOffers:(match.bookmakerOffers??[]).filter(offer=>{
  const date=Date.parse(offer.updatedAt);return Number.isFinite(date)&&date<=now+60000&&now-date<20*3600000;
 })})).map(match=>{const keys=marketKeys(match.odds).filter(key=>quoteAvailable(match,key));return {...match,bookmakerOffers:match.bookmakerOffers.map(offer=>Object.fromEntries(['key','name','updatedAt',...keys,...keys.map(key=>`${key}Cached`)].filter(key=>offer[key]!==undefined).map(key=>[key,offer[key]])))};});
 const prefs={...preferences,channels:['telegram'],teams:favorites?.teams??[],leagues:favorites?.leagues??[],min_value:Math.max(.1,preferences.min_value),min_confidence:Math.max(.65,preferences.min_confidence)};
 const events=detectAlerts(fresh,prefs,{max_favorites:10000,odds_step:.1},now).sort((a,b)=>b.value-a.value||b.confidence-a.confidence||a.key.localeCompare(b.key));
 const seen=new Set();
 return events.filter(event=>{if(seen.has(event.match_id))return false;seen.add(event.match_id);return true;}).map(event=>({...event,telegram:true,expires_at:new Date(Math.min(Date.parse(event.kickoff),now+4*3600000)).toISOString()}));
}
export function telegramEventCurrent(event,preferences,favorites,matches,now=Date.now()) {
 if(!preferences?.enabled||quietAt(now,preferences)||Date.parse(event.expires_at)<=now)return false;
 return detectTelegramAlerts(matches,preferences,favorites,now).some(current=>current.match_id===event.match_id&&current.market===event.market&&current.odd>=event.odd*.98);
}
