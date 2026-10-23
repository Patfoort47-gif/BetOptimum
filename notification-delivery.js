// BET-69 : adaptateurs utilisés uniquement côté serveur. Aucune clé dans le navigateur.
import { alertText } from './notification-model.js';
export function validateDestination(channel, value) {
  if (channel === 'discord') return typeof value?.url === 'string' && /^https:\/\/discord\.com\/api\/webhooks\/[0-9]{10,25}\/[A-Za-z0-9_-]{20,200}$/.test(value.url);
  if (channel === 'telegram') return /^-?[0-9]{1,20}$/.test(String(value?.chat_id));
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
  const link=new URL(`#match-${encodeURIComponent(event.match_id)}`,site).href,text=alertText(event)+'\n'+link;
  try {
    let response;
    if(channel==='web') {
      if(!webSender) return {status:'failed',error:'Notifications web non configurées'};
      await webSender(target,JSON.stringify({title:'Value bet sur un favori',body:alertText(event),url:link,tag:`bet-${id}`}));return {status:'sent'};
    }
    if(channel==='telegram') {
      if(!env.TELEGRAM_BOT_TOKEN)return {status:'failed',error:'Telegram non configuré'};
      response=await fetcher(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:target.chat_id,text,disable_web_page_preview:true}),signal:AbortSignal.timeout(10000)});
    } else if(channel==='discord') response=await fetcher(target.url+'?wait=true',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:text,allowed_mentions:{parse:[]}}),signal:AbortSignal.timeout(10000)});
    else {
      if(!env.RESEND_API_KEY||!env.EMAIL_FROM)return {status:'failed',error:'Email non configuré'};
      response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`bet-notification-${id}`},body:JSON.stringify({from:env.EMAIL_FROM,to:[target.email],subject:'BetOptimum : une alerte sur vos favoris',text:text+'\n\nGérer les alertes et se désabonner : '+new URL('#profil',site).href}),signal:AbortSignal.timeout(10000)});
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
