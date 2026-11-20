// BET-259 : diagnostic borné du retour OAuth, sans afficher les paramètres sensibles.
export function authCallbackStatus(href) {
  const url = new URL(href),
    hash = new URLSearchParams(url.hash.slice(1)),
    params = url.searchParams;
  const get = (key) => hash.get(key) ?? params.get(key),
    error = get('error_code') ?? get('error'),
    type = get('type');
  if (error) {
    if (type === 'magiclink' || params.get('auth_return') === 'magic') {
      return {
        kind: 'magic-error',
        message: 'Ce lien a expiré ou a déjà été utilisé. Demandez un nouveau lien de connexion.'
      };
    }
    if (type === 'recovery' || params.get('auth_return') === 'recovery') {
      return {
        kind: 'recovery-error',
        message:
          'Ce lien a expiré ou a déjà été utilisé. Demandez un nouveau lien de réinitialisation.'
      };
    }
    const confirmation = ['otp_expired', 'otp_disabled'].includes(error) || type === 'signup';
    return {
      kind: confirmation ? 'confirmation-error' : 'oauth-error',
      message: confirmation
        ? 'Le lien de confirmation a expiré. Demandez un nouveau lien.'
        : error === 'access_denied'
          ? 'Connexion Google annulée ou refusée. Vous pouvez réessayer.'
          : 'La connexion Google a échoué. Réessayez ou utilisez votre email.'
    };
  }
  return {
    kind: type === 'signup' ? 'signup' : type === 'recovery' ? 'recovery' : 'none',
    message: ''
  };
}

const magicDestinations = new Set([
  '#matches',
  '#conseils-du-jour',
  '#classements',
  '#bilan-pronos',
  '#communaute',
  '#bankroll',
  '#profil',
  '#mes-alertes'
]);

export function magicLinkRedirect(base, hash) {
  const url = new URL(base);
  url.searchParams.set('auth_return', 'magic');
  url.searchParams.set('return_to', magicDestinations.has(hash) ? hash : '#matches');
  return url.href;
}

export function readMagicDestination(href) {
  const { searchParams } = new URL(href);
  if (searchParams.get('auth_return') !== 'magic') return null;
  const hash = searchParams.get('return_to');
  return magicDestinations.has(hash) ? hash : '#matches';
}

const alertsReturnKey = 'betoptimum-alerts-auth-return';
const isNotificationDestination = (hash) => hash === '#mes-alertes' || hash === '#bankroll';

export function rememberNotificationReturn(hash) {
  try {
    if (isNotificationDestination(hash))
      sessionStorage.setItem(alertsReturnKey, JSON.stringify({ hash, saved: Date.now() }));
    else sessionStorage.removeItem(alertsReturnKey);
  } catch {}
}
export function takeNotificationReturn() {
  try {
    const raw = sessionStorage.getItem(alertsReturnKey);
    sessionStorage.removeItem(alertsReturnKey);
    const data = JSON.parse(raw);
    const { hash, saved } =
      typeof data === 'number' ? { hash: '#mes-alertes', saved: data } : (data ?? {});
    const age = Date.now() - saved;
    if (isNotificationDestination(hash) && saved > 0 && age >= 0 && age < 15 * 60 * 1000)
      return hash;
  } catch {}
  return null;
}
