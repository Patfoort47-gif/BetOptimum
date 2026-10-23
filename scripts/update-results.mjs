import { readFile, writeFile } from 'node:fs/promises';
import { selectionResult } from '../model.js';

const leagues = ['eng.1','fra.1','esp.1','ita.1','ger.1','uefa.champions','uefa.europa','uefa.europa.conf','uefa.super_cup','fifa.cwc','fra.2','fra.coupe_de_france','eng.fa','eng.league_cup','esp.copa_del_rey','ita.coppa_italia','ger.dfb_pokal','uefa.nations','fifa.worldq.uefa'];
// Matchs annulés : les paris certifiés sont remboursés (BET-52).
const voidStatuses = new Set(['STATUS_CANCELED', 'STATUS_ABANDONED']);
const dateKey = date => date.toISOString().slice(0, 10).replaceAll('-', '');
const today = new Date(); today.setUTCHours(0, 0, 0, 0);
const days = Array.from({length:4},(_,index)=>{const date=new Date(today);date.setUTCDate(date.getUTCDate()+index-3);return dateKey(date)});
const settlements = [];

for (const league of leagues) {
  for (const day of days) {
    const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${day}&limit=100`, { headers:{'User-Agent':'BetMaster-Results/1.0'} });
    if (!response.ok) { console.warn(`${league}: HTTP ${response.status} (${day})`); continue; }
    const data = await response.json();
    for (const event of data.events ?? []) {
      const competition = event.competitions?.[0];
      const home = competition?.competitors?.find(team => team.homeAway === 'home');
      const away = competition?.competitors?.find(team => team.homeAway === 'away');
      if (voidStatuses.has(event.status?.type?.name) && home && away) { settlements.push({ id:`espn-${event.id}`, date:event.date.slice(0,10), home:home.team?.displayName, away:away.team?.displayName, completed:false, voided:true }); continue; }
      if (!event.status?.type?.completed || home?.score == null || away?.score == null) continue;
      settlements.push({ id:`espn-${event.id}`, date:event.date.slice(0,10), home:home.team?.displayName, away:away.team?.displayName, homeScore:Number(home.score), awayScore:Number(away.score), completed:true });
    }
  }
}

const file = 'data/fixtures.json';
const data = JSON.parse(await readFile(file, 'utf8'));
const merged = new Map((data.settlements ?? []).map(result => [result.id, result]));
for (const result of settlements) merged.set(result.id, result);
data.settlements = [...merged.values()].sort((a,b) => b.date.localeCompare(a.date));
for (const match of data.matches ?? []) {
  const result = merged.get(match.id);
  if (!result) continue;
  if (result.voided) { match.voided = true; match.status = 'Annulé'; continue; }
  match.completed = true; match.status = 'Terminé'; match.homeScore = result.homeScore; match.awayScore = result.awayScore;
}
data.scoresUpdatedAt = new Date().toISOString();
data.coverage = {...data.coverage, settlements:data.settlements.length};
await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
const historyFile='data/predictions-history.json';
let predictionHistory=[];
try{predictionHistory=JSON.parse(await readFile(historyFile,'utf8'))}catch{}
const predictions=new Map(predictionHistory.map(item=>[item.id,item]));
for(const match of data.matches??[]){
  if(!match.completed||!match.suggestedPick||predictions.has(match.id))continue;
  const pick=match.suggestedPick,status=selectionResult({...pick,matchId:match.id},[match]).status;
  if(status==='pending')continue;
  predictions.set(match.id,{id:match.id,date:match.date,league:match.league,match:`${match.home} – ${match.away}`,label:pick.label,key:pick.key,odd:pick.odd,probability:pick.probability,status,score:`${match.homeScore} : ${match.awayScore}`});
}
predictionHistory=[...predictions.values()].sort((a,b)=>b.date.localeCompare(a.date));
await writeFile(historyFile,`${JSON.stringify(predictionHistory,null,2)}\n`);
console.log(`${settlements.length} résultats contrôlés, ${data.settlements.length} disponibles pour régler les paris.`);
