import { dailyPushText } from './notification-daily.js';
// BET-69 : adaptateurs utilisés uniquement côté serveur. Aucune clé dans le navigateur.
import { briefingEmail, alertEmail } from './notification-email.js';
import { favoriteReminderText } from './notification-reminder.js';
import { alertText } from './notification-model.js';
export function validateDestination(channel, value) {
  if (channel === 'discord') return typeof value?.url === 'string' && /^https:\/\/discord\.com\/api\/webhooks\/[0-9]{10,25}\/[A-Za-z0-9_-]{20,200}$/.test(value.url);
  if (channel === 'email') return typeof value?.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email);
  if (channel === 'web') {
    try { const url=new URL(value.endpoint); return url.protocol==='https:' && url.port==='' && url.username==='' && url.password==='' && (['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(url.hostname)||url.hostname.endsWith('.notify.windows.com')) && /^[A-Za-z0-9_-]{80,100}$/.test(value.keys?.p256dh??'') && /^[A-Za-z0-9_-]{20,30}$/.test(value.keys?.auth??''); } catch { return false; }
  }
  return false;
}
export async function seal(value, secret) {
  const raw=Uint8Array.from(atob(secret),c=>c.charCodeAt(0)); if(raw.length!==32)throw new Error('ENCRYPTION_CONFIG');
  const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt']),iv=crypto.getRandomValues(new Uint8Array(12));
  const bytes=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(value))));
  return btoa(String.fromCharCode(...iv,...bytes));
}
export async function unseal(value, secret) {
  const raw=Uint8Array.from(atob(secret),c=>c.charCodeAt(0)),data=Uint8Array.from(atob(value),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:data.slice(0,12)},key,data.slice(12))));
}
/** @param {null | ((target: object, payload: string) => Promise<unknown>)} webSender */
export async function deliver(channel, target, event, id, env, fetcher=fetch, webSender=null) {
  if(!validateDestination(channel,target))return {status:'failed',error:'Destination invalide'};
  const site=new URL(env.SITE_URL); if(site.protocol!=='https:')throw new Error('SITE_CONFIG');
  const briefing=event.briefing_content?briefingEmail(event.briefing_content,env.SITE_URL):null;
  if(briefing&&channel!=='email')return {status:'failed',error:'Briefing réservé à l’email'};
  const challenge=event.daily_challenge_reminder===true;
  if(challenge&&channel!=='web')return {status:'failed',error:'Défi réservé aux notifications push'};
  const daily=event.daily_summary===true;
  if(daily&&channel!=='web')return {status:'failed',error:'Résumé réservé aux notifications push'};
  const result=event.result_validated===true;
  if(result&&channel!=='web')return {status:'failed',error:'Résultat réservé aux notifications push'};
  const reminder=event.favorite_reminder===true;
  if(reminder&&channel!=='web')return {status:'failed',error:'Rappel réservé aux notifications push'};
  const testing=Boolean(event.test_channel);
  if(daily)site.searchParams.set('conseils_tz',event.timezone);
  const link=new URL(challenge?'#defi-du-jour':daily?'#conseils-du-jour':result?'#bankroll':testing?'#profil':`#match-${encodeURIComponent(event.match_id)}`,site).href,text=(challenge?'Ton défi du jour t’attend. Fais tes pronostics gratuits avant les matchs.':daily?dailyPushText(event):result?'Un résultat de pari virtuel est disponible.':briefing?'':reminder?favoriteReminderText(event):testing?'Ceci est un message de test BetOptimum. Votre canal est bien associé. Ce message ne correspond à aucun pronostic réel.':alertText(event))+'\n'+link;
  try {
    let response;
    if(channel==='web') {
      if(!webSender) return {status:'failed',error:'Notifications web non configurées'};
      await webSender(target,JSON.stringify({title:challenge?'Ton défi du jour t’attend':daily?`${event.picks.length} conseil${event.picks.length>1?'s':''} du jour`:result?'Résultat validé':testing?'Test de vos alertes BetOptimum':reminder?`${event.home} - ${event.away}`:`${event.home} - ${event.away}`,body:challenge?'Fais tes pronostics gratuits avant les matchs. Paris virtuels · 18+ · Aucune garantie.':daily?dailyPushText(event):result?'Un pari virtuel vient d’être réglé. Consultez Mes paris pour voir votre résultat.':testing?'Votre canal de notifications fonctionne.':reminder?favoriteReminderText(event):`${event.label} · cote ${Number(event.odd).toFixed(2)} · confiance ${Math.round(event.confidence*100)} %\nParis virtuels · 18+ · Aucune garantie.`,url:link,tag:challenge?`challenge-${event.challenge_day}`:daily?`daily-${event.date}`:result?'bet-results':`bet-${id}`,expiresAt:new Date(Date.now()+120000).toISOString()}));return {status:'sent'};
    }
    if(channel==='discord') response=await fetcher(target.url+'?wait=true',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:text,allowed_mentions:{parse:[]}}),signal:AbortSignal.timeout(10000)});
    else {
      if(!env.RESEND_API_KEY||!env.EMAIL_FROM)return {status:'failed',error:'Email non configuré'};
      const email=(briefing||alertEmail({title:testing?'Votre alerte de test':'Une alerte sur vos favoris',message:testing?'Ceci est un message de test BetOptimum. Votre canal est bien associé. Ce message ne correspond à aucun pronostic réel.':`${event.home} - ${event.away}\n${event.label} · cote ${event.odd.toFixed(2)}\n${event.bookmaker} · cote réelle${event.cached?' en cache':''}\nProbabilité du modèle : ${Math.round(event.confidence*100)} %. Une estimation ne garantit aucun résultat.\n${new Date(event.kickoff).toLocaleString('fr-FR',{timeZone:'Europe/Paris'})} (Paris)`,url:link,siteUrl:env.SITE_URL,testing}));
      response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`bet-notification-${id}`},body:JSON.stringify({from:env.EMAIL_FROM,to:[target.email],...email,subject:briefing?briefing.subject:testing?'BetOptimum : test de vos alertes email':'BetOptimum : une alerte sur vos favoris',text:email.text}),signal:AbortSignal.timeout(10000)});
    }
    if(response.ok)return {status:'sent'};
    if([404,410].includes(response.status))return {status:'failed',error:'Destination expirée',expired:true};
    if(response.status===429)return {status:'pending',error:'Quota du fournisseur atteint',retry:Math.min(3600,Math.max(60,Number(response.headers.get('retry-after'))||300))};
    // Un 5xx ou une réponse perdue peut avoir suivi un envoi accepté. Évite un double envoi automatique.
    return {status:response.status>=500?'unknown':'failed',error:`Fournisseur : HTTP ${response.status}`};
  } catch(error) {
    if([404,410].includes(error.statusCode))return {status:'failed',error:'Destination expirée',expired:true};
    return {status:'unknown',error:'Résultat de livraison inconnu'};
  }
}
