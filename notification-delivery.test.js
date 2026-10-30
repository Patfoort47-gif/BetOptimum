import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDestination, deliver, seal, unseal } from './notification-delivery.js';
const env={SITE_URL:'https://example.com/bet/',TELEGRAM_BOT_TOKEN:'test',RESEND_API_KEY:'test',EMAIL_FROM:'test@example.com'};
const event={match_id:'m',home:'Rennes',away:'Paris',label:'Victoire',odd:2,value:.1,confidence:.6,movement:5,kickoff:'2026-10-24T20:00:00Z'};
test('les destinations ne peuvent pas détourner les appels vers un serveur arbitraire',()=>{
 assert.ok(!validateDestination('discord',{url:'https://evil.com/api/webhooks/123/a'}));
 assert.ok(!validateDestination('web',{endpoint:'https://127.0.0.1/push',keys:{}}));
 assert.ok(!validateDestination('telegram',{chat_id:'123/../getUpdates'}));
 assert.ok(validateDestination('discord',{url:'https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz'}));
});
test('chiffrement authentifié des destinations et refus d’une mauvaise clé',async()=>{
 const key=btoa('a'.repeat(32)),value={chat_id:'123'},cipher=await seal(value,key);
 assert.ok(!cipher.includes('123'));assert.deepEqual(await unseal(cipher,key),value);
 await assert.rejects(()=>unseal(cipher,btoa('b'.repeat(32))));
});
test('les échecs de fournisseurs sont isolés, temporisés ou marqués incertains sans exposer les secrets',async()=>{
 const target={chat_id:'123'};
 for(const [http,status] of [[200,'sent'],[429,'pending'],[503,'unknown'],[403,'failed'],[410,'failed']]){
  const result=await deliver('telegram',target,event,1,env,async()=>new Response('',{status:http}));assert.equal(result.status,status);assert.ok(!JSON.stringify(result).includes(env.TELEGRAM_BOT_TOKEN));
 }
 const fail=await deliver('telegram',target,event,1,env,async()=>{throw new Error('clé privée')});assert.equal(fail.status,'unknown');assert.ok(!fail.error.includes('clé'));
 const sent=await deliver('email',{email:'me@example.com'},event,2,env,async(url,init)=>{assert.equal(init.headers['Idempotency-Key'],'bet-notification-2');assert.ok(JSON.parse(init.body).text.includes('#profil'));return new Response('{}');});assert.equal(sent.status,'sent');
});

test('le test email utilise Resend, une destination confirmée et un lien vers les préférences',async()=>{
 const result=await deliver('email',{email:'confirmed@example.com'},{...event,test_channel:'email'},42,env,async(url,init)=>{
  assert.equal(url,'https://api.resend.com/emails');assert.equal(init.headers['Idempotency-Key'],'bet-notification-42');
  const body=JSON.parse(init.body);assert.deepEqual(body.to,['confirmed@example.com']);assert.match(body.subject,/test.*email/);assert.match(body.text,/aucun pronostic réel/);assert.ok(body.text.includes('https://example.com/bet/#profil'));assert.ok(!body.text.includes('#match-test'));return Response.json({id:'message-id'});
 });assert.equal(result.status,'sent');
});
