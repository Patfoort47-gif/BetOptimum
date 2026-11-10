// BET-69 : état public des canaux. Aucune valeur secrète ne doit sortir de ce module.
export function notificationConfig(env) {
  let encryption = false;
  try {
    encryption =
      Uint8Array.from(atob(env.NOTIFICATION_ENCRYPTION_KEY ?? ''), (c) => c.charCodeAt(0))
        .length === 32;
  } catch {}
  const ready = {
    web: Boolean(
      /^[A-Za-z0-9_-]{87}$/.test(env.VAPID_PUBLIC_KEY ?? '') &&
        /^[A-Za-z0-9_-]{43}$/.test(env.VAPID_PRIVATE_KEY ?? '') &&
        /^(mailto:|https:)/.test(env.VAPID_SUBJECT ?? '')
    ),
    discord: false,
    email: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM)
  };
  const unavailable = {
    web: 'Le service push doit être configuré par l’administrateur.',
    discord: 'Discord ne fait pas partie des canaux proposés.',
    email: 'Le service d’email doit être configuré par l’administrateur.'
  };
  const available = Object.fromEntries(
    Object.entries(ready).map(([channel, ok]) => [channel, encryption && ok])
  );
  const reasons = Object.fromEntries(
    Object.entries(available)
      .filter(([, ok]) => !ok)
      .map(([channel]) => [
        channel,
        encryption
          ? unavailable[channel]
          : 'L’association sécurisée des canaux doit être configurée par l’administrateur.'
      ])
  );
  return { available, reasons, vapid: available.web ? env.VAPID_PUBLIC_KEY : '' };
}
