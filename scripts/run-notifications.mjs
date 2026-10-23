// Détection et envoi côté Edge Function, sans destination privée dans GitHub Actions.
import { readFile } from 'node:fs/promises';
const url=process.env.SUPABASE_URL?.replace(/\/$/,''),secret=process.env.NOTIFICATION_WORKER_SECRET;
if(!url||!secret){console.log('Alertes non configurées : aucun envoi.');process.exit(0);}
if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url))throw new Error('URL Supabase invalide');
const data=JSON.parse(await readFile('data/fixtures.json','utf8'));
const response=await fetch(`${url}/functions/v1/notifications`,{method:'POST',headers:{'Content-Type':'application/json','x-worker-secret':secret},body:JSON.stringify({action:'worker',matches:data.matches??[],generatedAt:data.generatedAt}),signal:AbortSignal.timeout(110000)});
if(!response.ok)throw new Error(`Service d’alertes : HTTP ${response.status}`);
const result=await response.json();console.log(`${Number(result.queued)||0} alertes mises en file, ${Number(result.sent)||0} livraisons confirmées.`);
