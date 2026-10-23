// Diagnostics serveur autorisés : jamais de message brut, corps, destination ou secret.
const STAGES = new Set(['configuration','database','web-push','delivery','request']);
const RESOURCES = new Set(['notification_preferences','notification_plans','notification_entitlements','notification_endpoints','notification_events','notification_deliveries','notification_pairings','enqueue_notification','claim_notification_deliveries']);
const validCode = code => /^(?:PGRST\d{3}|[0-9]{2}[A-Z0-9]{3}|NETWORK|INVALID_RESPONSE|CONFIG_SITE_URL|CONFIG_SUPABASE|WEB_PUSH_SETUP|UNEXPECTED)$/.test(String(code));
export class NotificationFailure extends Error {
  /** @param {string} stage @param {string} code @param {number | null} status @param {string | null} resource */
  constructor(stage, code, status = null, resource = null) {
    super('Notification service failure');
    this.stage = stage; this.code = code; this.status = status; this.resource = resource;
  }
}
export function safeNotificationDiagnostic(error) {
  if (!(error instanceof NotificationFailure)) return { stage: 'request', code: 'UNEXPECTED' };
  return { stage: STAGES.has(error.stage) ? error.stage : 'request', code: validCode(error.code) ? error.code : 'UNEXPECTED',
    ...(Number.isInteger(error.status) && error.status >= 100 && error.status <= 599 ? { status: error.status } : {}),
    ...(RESOURCES.has(error.resource) ? { resource: error.resource } : {}) };
}
export function reportNotificationFailure(error, reference, logger = console.error) {
  const diagnostic = safeNotificationDiagnostic(error);
  logger(JSON.stringify({ event: 'notification_error', reference, ...diagnostic }));
  return { error: 'Le service d’alertes est indisponible ou non configuré', code: diagnostic.code, reference };
}
// Les logs GitHub n’affichent que ces deux champs contrôlés, même si une passerelle renvoie un corps sensible.
export async function workerFailureMessage(response) {
  let body; try { body = await response.json(); } catch { /* réponse non JSON */ }
  const code = validCode(body?.code) ? body.code : null;
  const reference = /^[a-f0-9-]{36}$/.test(String(body?.reference)) ? body.reference : null;
  return `Service d’alertes : HTTP ${response.status}${code ? ` · ${code}` : ''}${reference ? ` · référence ${reference}` : ''}`;
}
