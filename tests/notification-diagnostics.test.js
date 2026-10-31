import test from 'node:test';
import assert from 'node:assert/strict';
import {NotificationFailure,safeNotificationDiagnostic,reportNotificationFailure,workerFailureMessage} from '../notification-diagnostics.js';
test('les erreurs SQL utiles sont identifiables sans exposer le contenu de la réponse',()=>{
 const e=new NotificationFailure('database','42501',403,'notification_preferences');e.message='Bearer secret webhook privé';
 const log=[],reference='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',body=reportNotificationFailure(e,reference,v=>log.push(v));
 assert.deepEqual(JSON.parse(log[0]),{event:'notification_error',reference,stage:'database',code:'42501',status:403,resource:'notification_preferences'});
 assert.equal(body.code,'42501');assert.ok(!JSON.stringify({body,log}).includes('secret'));
 assert.equal(safeNotificationDiagnostic(new Error('private key')).code,'UNEXPECTED');
 assert.deepEqual(safeNotificationDiagnostic(new NotificationFailure('secret','private-key',999,'endpoint?token=private')),{stage:'request',code:'UNEXPECTED'});
});
test('GitHub affiche une référence sûre et ne journalise jamais un corps brut',async()=>{
 const reference='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const useful=await workerFailureMessage(new Response(JSON.stringify({code:'PGRST205',reference,error:'secret'}),{status:503}));
 assert.ok(useful.includes('PGRST205'));assert.ok(useful.includes(reference));assert.ok(!useful.includes('secret'));
 const unsafe=await workerFailureMessage(new Response(JSON.stringify({code:'Bearer private',reference:'https://secret',error:'secret'}),{status:503}));
 assert.equal(unsafe,'Service d’alertes : HTTP 503');
 assert.equal(await workerFailureMessage(new Response('<html>secret</html>',{status:502})),'Service d’alertes : HTTP 502');
});
