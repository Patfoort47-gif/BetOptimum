// Vérification du déploiement uniquement : aucune détection ni livraison de notification.
const url = process.env.SUPABASE_URL?.replace(/\/$/, ''),
  secret = process.env.NOTIFICATION_WORKER_SECRET;
if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url ?? '') || !secret)
  throw Error('Configuration du contrôle absente');
const response = await fetch(url + '/functions/v1/notifications', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-worker-secret': secret },
  body: JSON.stringify({ action: 'health' }),
  signal: AbortSignal.timeout(30000)
});
if (!response.ok) throw Error('Contrôle du worker : HTTP ' + response.status);
const result = await response.json();
if (result.revision !== 'BET-310' || result.dry_run !== true)
  throw Error('Version du worker inattendue');
console.log(
  JSON.stringify({ revision: result.revision, available: result.available, dry_run: true })
);
if (result.available?.web !== true) throw Error('Le canal push n’est pas prêt côté serveur');
