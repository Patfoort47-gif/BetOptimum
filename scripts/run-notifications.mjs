// Détection et envoi côté Edge Function, sans destination privée dans GitHub Actions.
import { callNotificationWorker } from '../notification-worker-request.js';
import { readFile } from 'node:fs/promises';
const url=process.env.SUPABASE_URL?.replace(/\/$/,''),secret=process.env.NOTIFICATION_WORKER_SECRET;
if(!url||!secret){console.log('Alertes non configurées : aucun envoi.');process.exit(0);}
if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url))throw new Error('URL Supabase invalide');
const data=JSON.parse(await readFile('data/fixtures.json','utf8'));
const started=Date.now(),result=await callNotificationWorker(url,secret,data);
console.log(`${Number(result.queued)||0} alertes mises en file, ${Number(result.sent)||0} livraisons confirmées · ${Date.now()-started} ms · worker ${/^BET-(195|200|242)$/.test(result.revision)?result.revision:'version antérieure'}.`);
if(result.claimed===0&&Number(result.queued)===0)console.log('Aucune alerte éligible à traiter.');
