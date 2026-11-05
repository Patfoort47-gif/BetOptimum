import {analyseMatch} from './model.js';
import {quoteAvailable} from './quote-policy.js';
export function copyBetSelections(bet,nickname,matches,now=Date.now()){
 if(bet?.status!=='pending'||bet.bet_type==='multiple'||!Array.isArray(bet.selections)||!bet.selections.length)throw Error('Ce pari ne peut plus être copié.');
 const ids=new Set();return bet.selections.map(item=>{const match=matches.find(m=>m.id===item.matchId);if(!match||match.completed||match.voided||Date.parse(match.kickoff??`${match.date}T${match.time}:00`)<=now||!quoteAvailable(match,item.key)||/^h1/.test(item.key)||ids.has(match.id))throw Error('Une sélection est fermée ou sa cote est indisponible.');ids.add(match.id);const current=analyseMatch(match).markets.find(m=>m.key===item.key);if(!current)throw Error('Marché indisponible.');return{...current,matchId:match.id,match:`${match.home} - ${match.away}`,home:match.home,away:match.away,league:match.league,date:match.date,time:match.time,sourceBetId:bet.id,sourceNickname:nickname};});
}
