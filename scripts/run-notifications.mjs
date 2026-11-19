// Détection et envoi côté Edge Function, sans destination privée dans GitHub Actions.
import { callNotificationWorker } from '../src/notifications/notification-worker-request.js';
import { notificationData } from './notification-data.mjs';
import { briefingDataStatus } from '../src/notifications/briefing-data.js';
const url = process.env.SUPABASE_URL?.replace(/\/$/, ''),
  secret = process.env.NOTIFICATION_WORKER_SECRET;
if (!url || !secret) {
  console.log('Alertes non configurées : aucun envoi.');
  process.exit(0);
}
if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)) throw new Error('URL Supabase invalide');
const data = await notificationData();
data.briefingReady = process.env.BRIEFING_AFTER_UPDATE === 'true';
if (data.briefingReady) {
  const status = briefingDataStatus(data.matches, data.generatedAt);
  if (!status.ok) {
    console.error(status.code + ' : briefing bloqué, calendrier ou analyses indisponibles.');
    throw new Error(status.code);
  }
}
const started = Date.now(),
  result = await callNotificationWorker(url, secret, data);
console.log(
  `${Number(result.queued) || 0} alertes mises en file, ${Number(result.sent) || 0} messages acceptés par le transport · ${Date.now() - started} ms · worker ${/^BET-(195|200|242|243|348|349|350)$/.test(result.revision) ? result.revision : 'version antérieure'}.`
);
if (result.metrics)
  console.log(
    JSON.stringify({
      categories: result.metrics,
      multiChannelAccepted: result.multiChannelAccepted
    })
  );
if (result.claimed === 0 && Number(result.queued) === 0)
  console.log('Aucune alerte éligible à traiter.');
