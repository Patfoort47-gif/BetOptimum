// Formats de prix observés dans l'artefact 13324580825, le 4 novembre 2026.
// Un prix conjoint reste une seule sélection ; aucune cote n'est reconstruite.
import {sameTeam} from '../team-match.js';
import {compositeMarketSpec} from '../markets.js';
export const COMPOSITE_MARKETS=['btts_total_goals','double_chance_btts','double_chance_total_goals','result_btts','result_total_goals'];
function issue(event,name){
 const home=sameTeam(name,event.home_team),away=sameTeam(name,event.away_team),draw=/^Draw$/.test(name);
 return Number(home)+Number(away)+Number(draw)!==1?null:home?'Home':away?'Away':'Draw';
}
export function compositeSelection(event,market,outcome){
 if(!COMPOSITE_MARKETS.includes(market.key)||market.period||market.team||['suspended','removed','closed'].includes(market.status)||outcome.period||outcome.team||outcome.player_id||outcome.side)return null;
 const parts=String(outcome.name??'').split(' & ');if(parts.length!==2)return null;
 const total=market.key.endsWith('total_goals'),dc=market.key.startsWith('double_chance'),btts=market.key==='btts_total_goals';
 const title=btts?'Both Teams To Score':dc?'Double Chance':'Result';
 let suffix,line;
 if(total){
  const m=/^(Over|Under) ([0-9]\.5)$/.exec(parts[1]);if(!m||typeof outcome.point!=='number'||outcome.point!==Number(m[2]))return null;
  line=m[2];suffix=m[1]+String(outcome.point*10).padStart(2,'0');
 }else{if(outcome.point!=null||!['Yes','No'].includes(parts[1]))return null;suffix='Btts'+parts[1];}
 if(market.description!==`${title} & ${total?'Total Goals '+line:'Both Teams To Score'}`)return null;
 let prefix;
 if(btts){if(!['Yes','No'].includes(parts[0]))return null;prefix='Btts'+parts[0];}
 else if(dc){
  const pair=parts[0].split('/');if(pair.length!==2)return null;
  const sides=pair.map(name=>issue(event,name));if(sides.some(side=>!side)||sides[0]===sides[1])return null;
  prefix=sides.includes('Home')?(sides.includes('Draw')?'HomeDraw':'HomeAway'):'DrawAway';
 }else prefix=issue(event,parts[0]);
 const key=prefix?`combo${prefix}${suffix}`:null;return key&&compositeMarketSpec(key)?key:null;
}
