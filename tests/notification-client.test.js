import test from 'node:test';import assert from 'node:assert/strict';
import {createNotificationApi,loadNotificationSettings} from '../notification-client.js';
const data={preferences:{},plan:{},endpoints:[],history:[]},config={available:{web:true}};
test('le chargement distingue le refus SQL de l’échec de l’appel navigateur',async()=>{
 const client={rpc:async()=>({data}),functions:{invoke:async()=>({data:config})}},api=createNotificationApi(client);
 assert.deepEqual(await loadNotificationSettings(api),{data,config});
 client.rpc=async()=>({error:{code:'42501',message:'PRIVATE SQL'}});
 await assert.rejects(()=>loadNotificationSettings(api),e=>e.message.startsWith('Préférences :')&&e.message.includes('droits')&&!e.message.includes('PRIVATE'));
 client.rpc=async()=>({data});client.functions.invoke=async()=>({error:{name:'FunctionsFetchError',message:'PRIVATE HEADERS'}});
 await assert.rejects(()=>loadNotificationSettings(api),e=>e.message.startsWith('Connexion au service :')&&!e.message.includes('PRIVATE'));
});
test('les erreurs HTTP restent traduites sans exposer les corps privés',async()=>{
 let result;const api=createNotificationApi({functions:{invoke:async()=>result}});
 result={error:{context:new Response(JSON.stringify({error:'PRIVATE'}),{status:401})}};
 await assert.rejects(()=>api.action({action:'config'}),/session a expiré/);
 result={error:{context:new Response(JSON.stringify({error:'PRIVATE'}),{status:403})}};
 await assert.rejects(()=>api.action({}),/adresse du site/);
 const reference='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 result={error:{context:new Response(JSON.stringify({error:'PRIVATE',code:'CONFIG_SITE_URL',reference}),{status:503})}};
 await assert.rejects(()=>api.action({}),e=>e.message.includes(reference)&&!e.message.includes('PRIVATE'));
 result={error:{context:new Response('<html>PRIVATE</html>',{status:502})}};
 await assert.rejects(()=>api.action({}),e=>!e.message.includes('PRIVATE'));
});
test('les erreurs de configuration, réponses incomplètes et règles métier sont distinctes',async()=>{
 const api=createNotificationApi({rpc:async()=>({error:{code:'PGRST202',message:'PRIVATE'}})});
 await assert.rejects(()=>api.load(),/base du site/);
 const business=createNotificationApi({rpc:async()=>({error:{message:'NOTIFICATION_LIMIT'}})});
 await assert.rejects(()=>business.save({}),/limites/);
 await assert.rejects(()=>loadNotificationSettings({load:async()=>null,action:async()=>config}),/réponse incomplète/);
});
