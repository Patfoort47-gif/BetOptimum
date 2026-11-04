import test from 'node:test';import assert from 'node:assert/strict';
import {createTelegramSetup} from '../notification-telegram-setup.js';
import {safeNotificationDiagnostic} from '../notification-diagnostics.js';
const env={SUPABASE_URL:'https://example.supabase.co',TELEGRAM_BOT_TOKEN:'private-token',TELEGRAM_BOT_NAME:'example_bot',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(48)};
test('raccordement Telegram : identité vérifiée, webhook protégé, aucun message ni suppression',async()=>{
 const calls=[];let webhook='';
 const setup=createTelegramSetup(env,async(url,request)=>{
  const method=url.split('/').at(-1),body=JSON.parse(request.body);calls.push({method,body});
  if(method==='getMe')return Response.json({ok:true,result:{is_bot:true,username:'example_bot'}});
  if(method==='setWebhook'){webhook=body.url;return Response.json({ok:true,result:true});}
  return Response.json({ok:true,result:{url:webhook}});
 });
 assert.deepEqual(await setup(),{username:'example_bot'});assert.equal(calls.length,4);await setup();assert.equal(calls.length,4);
 assert.deepEqual(calls[2],{method:'setWebhook',body:{url:'https://example.supabase.co/functions/v1/notifications?action=telegram-webhook',secret_token:env.TELEGRAM_WEBHOOK_SECRET,allowed_updates:['message'],drop_pending_updates:false}});
 assert.ok(calls.every(c=>c.method!=='sendMessage'));
});
test('un bot déjà utilisé ailleurs ou une identité différente bloque le raccordement',async()=>{
 for(const conflict of ['name','webhook']){
  const calls=[];
  const setup=createTelegramSetup(env,async url=>{const method=url.split('/').at(-1);calls.push(method);return Response.json({ok:true,result:method==='getMe'?{is_bot:true,username:conflict==='name'?'other_bot':'example_bot'}:{url:'https://other.example/webhook'}});});
  await assert.rejects(setup(),e=>e.code===(conflict==='name'?'TELEGRAM_SETUP':'TELEGRAM_WEBHOOK_CONFLICT'));
  assert.ok(!calls.includes('setWebhook'));
 }
});
test('aucun corps ni URL avec jeton ne remonte dans une erreur, nouvel essai possible',async()=>{
 let calls=0;const setup=createTelegramSetup(env,async()=>{calls++;throw new Error('private-token private-provider-body');});
 for(let i=0;i<2;i++)await assert.rejects(setup(),error=>{assert.ok(!String(error).includes('private'));assert.deepEqual(safeNotificationDiagnostic(error),{stage:'configuration',code:'TELEGRAM_SETUP'});return true;});
 assert.equal(calls,2);
 const invalid=createTelegramSetup({...env,TELEGRAM_BOT_NAME:'@wrong'},async()=>{throw new Error('should not call');});await assert.rejects(invalid(),e=>e.code==='TELEGRAM_SETUP');
});
