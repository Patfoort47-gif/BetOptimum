// Notification générique : aucun montant ni détail de sélection sur l’écran verrouillé.
export function validatedResultCurrent(event, prefs, bet, now = Date.now()) {
  return Boolean(
    event?.result_validated === true &&
      prefs?.enabled &&
      prefs.essential &&
      bet &&
      ['won', 'lost', 'void'].includes(bet.status) &&
      bet.status === event.status &&
      Date.parse(event.expires_at) > now
  );
}
