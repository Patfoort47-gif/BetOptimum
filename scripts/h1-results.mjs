// Résultat H1 serveur : jamais déduit de la moitié du score final ou d'un texte de but.
export const RESULT_SLUGS={'Premier League':'eng.1','Ligue 1':'fra.1','La Liga':'esp.1','Serie A':'ita.1','Bundesliga':'ger.1','Ligue des champions':'uefa.champions','Europa League':'uefa.europa','Conference League':'uefa.europa.conf',"Supercoupe d'Europe":'uefa.super_cup','Ligue 2':'fra.2','Coupe de France':'fra.coupe_de_france','FA Cup':'eng.fa','Carabao Cup':'eng.league_cup','Copa del Rey':'esp.copa_del_rey','Coppa Italia':'ita.coppa_italia','DFB-Pokal':'ger.dfb_pokal','Ligue des nations':'uefa.nations','Qualifications Coupe du monde':'fifa.worldq.uefa','Coupe du monde des clubs':'fifa.cwc'};
const integer=v=>typeof v==='number'&&Number.isInteger(v)&&v>=0?v:typeof v==='string'&&/^\d+$/.test(v)?Number(v):null;
export function halfTimeResult(payload,match,verifiedAt=new Date().toISOString()){
 const header=payload?.header,c=header?.competitions?.[0],teams=c?.competitors,status=header?.status??c?.status;
 if(match.voided||!match.completed||String(header?.id)!==String(match.id).replace(/^espn-/,'')||status?.type?.completed!==true||!Array.isArray(teams)||teams.length!==2)return null;
 const home=teams.find(t=>t.homeAway==='home'),away=teams.find(t=>t.homeAway==='away');
 if(!home||!away||String(home.id)===String(away.id)||match.homeId!=null&&String(home.id)!==String(match.homeId)||match.awayId!=null&&String(away.id)!==String(match.awayId))return null;
 const halves=team=>{const rows=team.linescores;if(!Array.isArray(rows)||rows.length<2)return null;const values=rows.slice(0,2).map(r=>{const a=integer(r.value),b=integer(r.displayValue);return a!=null&&b!=null&&a!==b?null:a??b;});return values.every(v=>v!=null)?values:null;};
 const h=halves(home),a=halves(away),hs=integer(home.score),as=integer(away.score);
 if(!h||!a||hs==null||as==null||hs!==match.homeScore||as!==match.awayScore)return null;
 // La cohérence porte sur 90 minutes si le match comporte une prolongation ou une séance.
 const extra=(home.linescores.length>2||away.linescores.length>2||/EXTRA|AET|PEN|SHOOTOUT/i.test(status.type.name??'')||/extra time|penalt/i.test(status.type.detail??''));
 if(extra){if(h[0]+h[1]>hs||a[0]+a[1]>as)return null;}else if(h[0]+h[1]!==hs||a[0]+a[1]!==as)return null;
 return{source:'ESPN',matchId:match.id,homeId:String(home.id),awayId:String(away.id),verifiedAt,final:{home:hs,away:as},h1:{home:h[0],away:a[0]}};
}
export async function enrichHalfTimeResults(results,previous=[],{fetchImpl=fetch,now=Date.now(),maxRequests=16,slugs=RESULT_SLUGS}={}){
 const cache=new Map(previous.map(r=>[r.id,r.periodScores])),report={requested:0,succeeded:0,failures:[]};
 const candidates=[];
 for(const result of results){if(!result.completed||result.voided)continue;const saved=cache.get(result.id);if(saved?.source==='ESPN'&&saved.matchId===result.id&&saved.final?.home===result.homeScore&&saved.final?.away===result.awayScore){result.periodScores=saved;if(now-Date.parse(saved.verifiedAt)<6*3600000)continue;}candidates.push(result);}
 candidates.sort((a,b)=>(Date.parse(a.periodScores?.lastAttemptAt??a.periodScores?.verifiedAt)||0)-(Date.parse(b.periodScores?.lastAttemptAt??b.periodScores?.verifiedAt)||0)||String(b.date??'').localeCompare(String(a.date??'')));
 const unavailable=result=>{result.periodScores={source:'ESPN',matchId:result.id,final:{home:result.homeScore,away:result.awayScore},h1:null,lastAttemptAt:new Date(now).toISOString()};};
 for(const result of candidates){
  const slug=slugs[result.league];if(!slug||!/^espn-\d+$/.test(result.id))continue;if(report.requested>=maxRequests)break;report.requested++;
  try{const response=await fetchImpl(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary?event=${result.id.slice(5)}`,{redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok){report.failures.push(`${result.id}: HTTP ${response.status}`);unavailable(result);if([401,403,429].includes(response.status))break;continue;}const scores=halfTimeResult(await response.json(),result,new Date(now).toISOString());if(scores){result.periodScores=scores;report.succeeded++;}else{unavailable(result);report.failures.push(`${result.id}: score H1 non vérifié`);}}catch{unavailable(result);report.failures.push(`${result.id}: résumé indisponible`);}
 }
 return report;
}
