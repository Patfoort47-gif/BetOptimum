import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewsletterApi} from '../newsletter.js';
test('le choix newsletter passe uniquement par les RPC privés et exige un booléen explicite',async()=>{
 const calls=[],api=createNewsletterApi({rpc:async(name,args)=>{calls.push([name,args]);return {data:{status:'subscribed'}}}});
 assert.equal((await api.load()).status,'subscribed');await api.set(true);await api.set(false);await api.set('true');
 assert.deepEqual(calls,[['my_newsletter',undefined],['set_newsletter',{p_subscribed:true}],['set_newsletter',{p_subscribed:false}],['set_newsletter',{p_subscribed:false}]]);
});
test('une migration absente ou un refus SQL ne divulgue pas les erreurs internes',async()=>{
 const api=createNewsletterApi({rpc:async()=>({error:{code:'PGRST202',message:'private'}})});await assert.rejects(()=>api.load(),/mise à jour du serveur/);
 const denied=createNewsletterApi({rpc:async()=>({error:{code:'42501',message:'private'}})});await assert.rejects(()=>denied.set(true),e=>!e.message.includes('private'));
});
