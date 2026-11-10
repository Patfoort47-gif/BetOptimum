// BET-259 : diagnostic borné du retour OAuth, sans afficher les paramètres sensibles.
export function authCallbackStatus(href) {
  const url = new URL(href),
    hash = new URLSearchParams(url.hash.slice(1)),
    params = url.searchParams;
  const get = (key) => hash.get(key) ?? params.get(key),
    error = get('error_code') ?? get('error'),
    type = get('type');
  if (error) {
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
