// Raccordement côté serveur : aucun jeton ne quitte les secrets Edge.
import { NotificationFailure } from './notification-diagnostics.js';
export function createTelegramSetup(env,fetcher=fetch) {
 let pending=null;
 const configure=async()=>{
  if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(env.SUPABASE_URL)||!env.TELEGRAM_BOT_TOKEN||!/^[A-Za-z0-9_]{5,32}$/.test(env.TELEGRAM_BOT_NAME??'')||!/^[A-Za-z0-9_-]{32,256}$/.test(env.TELEGRAM_WEBHOOK_SECRET??''))throw new NotificationFailure('configuration','TELEGRAM_SETUP');
  const call=async(method,body)=>{
   try {
    const response=await fetcher(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body??{}),signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error();
    const data=await response.json();if(!data.ok)throw new Error();return data.result;
   }catch{throw new NotificationFailure('configuration','TELEGRAM_SETUP');}
  };
  const bot=await call('getMe');
  if(bot?.is_bot!==true||String(bot.username).toLowerCase()!==env.TELEGRAM_BOT_NAME.toLowerCase())throw new NotificationFailure('configuration','TELEGRAM_SETUP');
  const url=`${env.SUPABASE_URL}/functions/v1/notifications?action=telegram-webhook`,current=await call('getWebhookInfo');
  // Un bot utilisé par une autre application ne doit pas être détourné silencieusement.
  if(current?.url&&current.url!==url)throw new NotificationFailure('configuration','TELEGRAM_WEBHOOK_CONFLICT');
  await call('setWebhook',{url,secret_token:env.TELEGRAM_WEBHOOK_SECRET,allowed_updates:['message'],drop_pending_updates:false});
  const verified=await call('getWebhookInfo');
  if(verified?.url!==url)throw new NotificationFailure('configuration','TELEGRAM_SETUP');
  return {username:bot.username};
 };
 return ()=>pending??(pending=configure().catch(error=>{pending=null;throw error;}));
}
