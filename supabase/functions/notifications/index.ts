// BET-69 : déployer avec --no-verify-jwt ; chaque route vérifie explicitement son identité.
import { NotificationFailure, reportNotificationFailure } from '../../../notification-diagnostics.js';
import { notificationConfig } from '../../../notification-config.js';
import { planBriefing } from '../../../notification-briefing.js';
import { prepareBriefing } from '../../../notification-briefing-service.js';
import { detectAlerts } from '../../../notification-model.js';
import { deliver, seal, unseal, validateDestination } from '../../../notification-delivery.js';
const env = Object.fromEntries(['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','NOTIFICATION_WORKER_SECRET','NOTIFICATION_ENCRYPTION_KEY','SITE_URL','TELEGRAM_BOT_TOKEN','TELEGRAM_WEBHOOK_SECRET','TELEGRAM_BOT_NAME','VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT','RESEND_API_KEY','EMAIL_FROM'].map(k=>[k,Deno.env.get(k)??'']));
let site: URL | null = null;
try { const candidate = new URL(env.SITE_URL); if (candidate.protocol === 'https:') site = candidate; } catch { /* Diagnostiqué dans le gestionnaire, sans empêcher son démarrage. */ }
const cors = { 'Access-Control-Allow-Origin': site?.origin ?? 'null', 'Access-Control-Allow-Headers': 'authorization,content-type,apikey,x-client-info,x-worker-secret', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Vary':'Origin' };
const json = (value: unknown,status=200) => new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json'}});
const enc = new TextEncoder();
const hash = async (text:string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');
async function sameSecret(a:string,b:string) { return Boolean(b) && (await hash(a))===(await hash(b)); }
async function db(path:string, method='GET',body?:unknown) {
 const resource = path.split('?')[0].replace(/^rpc\//,'');
 if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(env.SUPABASE_URL) || !env.SUPABASE_SERVICE_ROLE_KEY) throw new NotificationFailure('configuration','CONFIG_SUPABASE');
 let r: Response;
 try { r=await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`,{method,headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json',Prefer:'return=representation,resolution=merge-duplicates'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)}); }
 catch { throw new NotificationFailure('database','NETWORK',null,resource); }
 if(!r.ok){let code='UNEXPECTED';try{code=(await r.json()).code??code;}catch{}throw new NotificationFailure('database',code,r.status,resource);}
 try {const text=await r.text();return text?JSON.parse(text):null;}catch{throw new NotificationFailure('database','INVALID_RESPONSE',r.status,resource);}
}
async function endpoint(uid:string,channel:string,target:unknown) {
 if(!validateDestination(channel,target))throw new Error('DESTINATION');
 await db('notification_endpoints?on_conflict=user_id,channel','POST',{user_id:uid,channel,encrypted:await seal(target,env.NOTIFICATION_ENCRYPTION_KEY)});
}
async function pageAll(table:string,query:string) {
 const result=[];for(let offset=0;;offset+=1000){const rows=await db(`${table}?${query}&limit=1000&offset=${offset}`);result.push(...rows);if(rows.length<1000)return result;}
}
async function worker(matches:unknown[],generatedAt:string|null) {
 const prefs=await pageAll('notification_preferences','enabled=eq.true&select=*'),plans=await db('notification_plans?select=*'),entitlements=await pageAll('notification_entitlements','select=*');
 let queued=0;
 for(const p of prefs){const plan=plans.find((l:any)=>l.id===(entitlements.find((e:any)=>e.user_id===p.user_id)?.plan??'free'));if(!plan)continue;
  const briefing=(p.teams.length+p.leagues.length<=plan.max_favorites)?planBriefing(matches,p):null;
  if(briefing&&await db('rpc/enqueue_notification_briefing','POST',{p_user:p.user_id,p_event:briefing}))queued++;
  for(const event of detectAlerts(matches,p,plan)) if(await db('rpc/enqueue_notification','POST',{p_user:p.user_id,p_key:event.key,p_event:event,p_due:event.due_at}))queued++;
 }
 const deliveries=await db('rpc/claim_notification_deliveries','POST',{});let sent=0;
 let webSender=null;
 for(const delivery of deliveries){
  try {
   // Relit le consentement juste avant l’appel au fournisseur, même après la réservation de la file.
   const [p]=await db(`notification_preferences?user_id=eq.${delivery.user_id}&enabled=eq.true&select=*`),[e]=await db(`notification_endpoints?user_id=eq.${delivery.user_id}&channel=eq.${delivery.channel}&select=encrypted`),[event]=await db(`notification_events?id=eq.${delivery.event_id}&select=payload`);
   if(!p?.channels.includes(delivery.channel)||!e){await db(`notification_deliveries?id=eq.${delivery.id}`,'PATCH',{status:'cancelled'});continue;}
   // Initialisation seulement pour une livraison web : un VAPID invalide n’arrête pas les autres canaux.
   if(delivery.channel==='web'&&!webSender&&env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY&&env.VAPID_SUBJECT){
    try {const {default:webpush}=await import('npm:web-push@3.6.7');webpush.setVapidDetails(env.VAPID_SUBJECT,env.VAPID_PUBLIC_KEY,env.VAPID_PRIVATE_KEY);webSender=(target:any,payload:string)=>webpush.sendNotification(target,payload,{TTL:300,timeout:10000});}
    catch {reportNotificationFailure(new NotificationFailure('web-push','WEB_PUSH_SETUP'),crypto.randomUUID());await db(`notification_deliveries?id=eq.${delivery.id}&status=eq.sending`,'PATCH',{status:'failed',error:'Configuration Web Push invalide'});continue;}
   }
   const target=await unseal(e.encrypted,env.NOTIFICATION_ENCRYPTION_KEY);
   let payload=event.payload;
   if(payload.briefing){
    if(delivery.channel!=='email'){await db(`notification_deliveries?id=eq.${delivery.id}`,'PATCH',{status:'cancelled'});continue;}
    // Une ancienne association email ne doit pas recevoir de données de compte après changement d’adresse.
    const authResponse=await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${delivery.user_id}`,{headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`},signal:AbortSignal.timeout(10000)});
    if(!authResponse.ok)throw new NotificationFailure('database','AUTH_EMAIL_CHECK',authResponse.status);
    const recipient=await authResponse.json();
    if(!recipient.email_confirmed_at||recipient.email!==target.email){await db(`notification_deliveries?id=eq.${delivery.id}`,'PATCH',{status:'cancelled',error:'Réassociez votre adresse email confirmée'});continue;}
    const content=await prepareBriefing(db,delivery.user_id,payload,p,matches,generatedAt);
    if(!content){await db(`notification_deliveries?id=eq.${delivery.id}`,'PATCH',{status:'cancelled'});continue;}
    payload={...payload,briefing_content:content};
   }
   if(payload.briefing){
    const [latest]=await db(`notification_preferences?user_id=eq.${delivery.user_id}&enabled=eq.true&select=*`);
    if(!latest?.channels.includes('email')||latest.updated_at!==p.updated_at||Date.parse(payload.kickoff)<=Date.now()){await db(`notification_deliveries?id=eq.${delivery.id}`,'PATCH',{status:'cancelled'});continue;}
   }
   const result=await deliver(delivery.channel,target,payload,delivery.id,env,fetch,webSender);
   const status=result.status==='pending'&&delivery.attempts>=4?'failed':result.status;
   await db(`notification_deliveries?id=eq.${delivery.id}&status=eq.sending`,'PATCH',{status,error:result.error??null,...(status==='sent'?{sent_at:new Date().toISOString()}:{}),...(status==='pending'?{due_at:new Date(Date.now()+(result.retry??300)*1000).toISOString()}: {})});
   if(result.expired)await db(`notification_endpoints?user_id=eq.${delivery.user_id}&channel=eq.${delivery.channel}`,'DELETE');if(status==='sent')sent++;
  }catch(error) {reportNotificationFailure(error,crypto.randomUUID());await db(`notification_deliveries?id=eq.${delivery.id}&status=eq.sending`,'PATCH',{status:'unknown',error:'Résultat de livraison inconnu'});}
 }
 await db('notification_pairings?expires_at=lt.'+new Date().toISOString(),'DELETE');
 await db('notification_events?created_at=lt.'+new Date(Date.now()-30*864e5).toISOString(),'DELETE');
 return {queued,sent};
}
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response(null,{headers:cors});
 if(request.method!=='POST')return json({error:'Méthode refusée'},405);
 try {
  if(!site)throw new NotificationFailure('configuration','CONFIG_SITE_URL');
  if(Number(request.headers.get('content-length')??0)>2000000)return json({error:'Requête trop volumineuse'},413);
  const raw=await request.text();if(raw.length>2000000)return json({error:'Requête trop volumineuse'},413);const body=JSON.parse(raw);
  if(body.action==='worker'){
   if(!await sameSecret(request.headers.get('x-worker-secret')??'',env.NOTIFICATION_WORKER_SECRET))return json({error:'Non autorisé'},401);
   return json(await worker(Array.isArray(body.matches)&&Number.isFinite(Date.parse(body.generatedAt))&&Date.now()-Date.parse(body.generatedAt)<864e5?body.matches:[],body.generatedAt??null));
  }
  if(new URL(request.url).searchParams.get('action')==='telegram-webhook'){
   if(!await sameSecret(request.headers.get('x-telegram-bot-api-secret-token')??'',env.TELEGRAM_WEBHOOK_SECRET))return json({error:'Non autorisé'},401);
   const message=body.message,code=String(message?.text??'').match(/^\/start ([a-f0-9]{48})$/)?.[1];
   if(code&&message?.chat?.type==='private'){
    const rows=await db(`notification_pairings?code_hash=eq.${await hash(code)}&expires_at=gt.${new Date().toISOString()}`,'DELETE');
    if(rows?.length)await endpoint(rows[0].user_id,'telegram',{chat_id:String(message.chat.id)});
   }return json({ok:true});
  }
  if(request.headers.get('origin')&&request.headers.get('origin')!==site.origin)return json({error:'Origine refusée'},403);
  const authorization=request.headers.get('authorization')??'';
  const auth=await fetch(`${env.SUPABASE_URL}/auth/v1/user`,{headers:{Authorization:authorization,apikey:env.SUPABASE_SERVICE_ROLE_KEY}});
  if(!auth.ok)return json({error:'Connexion requise'},401);const user=await auth.json(),uid=user.id;
  const config=notificationConfig(env);
  if(body.action==='config')return json(config);
  if(body.action==='telegram-pair'){
   if(!config.available.telegram)return json({error:'Canal non configuré'},503);
   const code=[...crypto.getRandomValues(new Uint8Array(24))].map(x=>x.toString(16).padStart(2,'0')).join('');
   await db('notification_pairings?on_conflict=user_id','POST',{user_id:uid,code_hash:await hash(code),expires_at:new Date(Date.now()+600000).toISOString()});
   return json({url:`https://t.me/${env.TELEGRAM_BOT_NAME}?start=${code}`});
  }
  if(body.action==='connect'){
   const channel=body.channel;
   if(!['web','discord','email'].includes(channel))return json({error:'Canal invalide'},400);
   if(!config.available[channel])return json({error:'Canal non configuré'},503);
   if(channel==='email'&&!user.email_confirmed_at)return json({error:'Confirmez votre adresse email'},400);
   await endpoint(uid,channel,channel==='email'?{email:user.email}:body.destination);return json({ok:true});
  }
  if(body.action==='test'){
   if(!['web','telegram','discord','email'].includes(body.channel))return json({error:'Canal invalide'},400);
   if(!config.available[body.channel])return json({error:'Canal non configuré'},503);
   // Le test utilise la même file et les mêmes limites que les alertes.
   const event={match_id:'test',home:'Test',away:'BetOptimum',label:'Vos alertes fonctionnent',odd:2,bookmaker:'Démonstration',value:.1,confidence:.6,movement:0,kickoff:new Date(Date.now()+864e5).toISOString(),test_channel:body.channel};
   const [p]=await db(`notification_preferences?user_id=eq.${uid}&select=enabled,channels`);if(!p?.enabled||!p.channels.includes(body.channel))return json({error:'Activez et enregistrez ce canal avant de le tester'},400);
   const queued=await db('rpc/enqueue_notification','POST',{p_user:uid,p_key:`test:${body.channel}:${Math.floor(Date.now()/3600000)}`,p_event:event,p_due:new Date().toISOString()});return json({ok:true,queued:Boolean(queued),message:queued?'Test placé dans la file, heures silencieuses et fréquence respectées':'Un test a déjà été demandé pour ce canal pendant cette heure. Consultez l’historique avant de réessayer.'});
  }
  return json({error:'Action inconnue'},400);
 }catch(error){return json(reportNotificationFailure(error,crypto.randomUUID()),503);}
});
