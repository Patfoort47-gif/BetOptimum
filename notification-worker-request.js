// Contrat minimal du worker : ne pas transférer les statistiques détaillées du site.
import { marketKeys } from './markets.js';
import { encodeWorkerMatch } from './notification-worker-codec.js';
export const WORKER_MAX_BYTES=2_000_000;
const fields=['id','home','away','league','kickoff','completed','voided','homeGoals','awayGoals','odds','realOddsMarkets','oddsMovement','marketValidUntil'];
export function workerPayload(data) {
 const matches=(data.matches??[]).filter(match=>!match.completed&&!match.voided&&!(Date.parse(match.kickoff)<=Date.parse(data.generatedAt))).map(match=>{
  const row=Object.fromEntries(fields.filter(key=>match[key]!==undefined).map(key=>[key,match[key]]));
  const keys=marketKeys(match.odds);
  row.bookmakerOffers=(match.bookmakerOffers??[]).map(offer=>Object.fromEntries(['key','name','updatedAt',...keys,...keys.map(key=>`${key}Cached`)].filter(key=>offer[key]!==undefined).map(key=>[key,offer[key]])));
  return row;
 });
 const offerFields=[...new Set(matches.flatMap(match=>match.bookmakerOffers.flatMap(offer=>Object.keys(offer))))];
 const body=JSON.stringify({action:'worker',format:2,offerFields,matches:matches.map(match=>encodeWorkerMatch(match,offerFields)),generatedAt:data.generatedAt});
 const bytes=new TextEncoder().encode(body).byteLength;
 if(bytes>WORKER_MAX_BYTES)throw new Error(`Requête d’alertes trop volumineuse : ${bytes} octets, limite ${WORKER_MAX_BYTES}. Aucun appel effectué.`);
 return {body,bytes,matches:matches.length};
}
export async function callNotificationWorker(url,secret,data,fetcher=fetch,timeout=110000) {
 const payload=workerPayload(data),started=Date.now();
 let response;
 try {
  response=await fetcher(`${url}/functions/v1/notifications`,{method:'POST',headers:{'Content-Type':'application/json','x-worker-secret':secret},body:payload.body,signal:AbortSignal.timeout(timeout)});
  if(!response.ok){const {workerFailureMessage}=await import('./notification-diagnostics.js');throw new Error(await workerFailureMessage(response));}
  return await response.json();
 }catch(error){
  if(error?.name==='TimeoutError'||error?.name==='AbortError')throw new Error(`Worker d’alertes : délai dépassé après ${Date.now()-started} ms (${payload.bytes} octets, ${payload.matches} matchs). Livraison potentiellement partielle : vérifier la file et les journaux Supabase avant toute reprise. Aucun rejeu automatique.`);
  if(error instanceof TypeError)throw new Error(`Worker d’alertes : erreur réseau après ${Date.now()-started} ms. Résultat incertain : vérifier la file Supabase. Aucun rejeu automatique.`);
  throw error;
 }
}
