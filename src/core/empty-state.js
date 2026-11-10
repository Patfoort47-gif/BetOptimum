const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
export function emptyState(kind = 'history', filtered = false) {
  if (kind === 'ticket' && !filtered)
    return `<div class="ticket-empty"><svg viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M18 22h60v16a10 10 0 0 0 0 20v16H18V58a10 10 0 0 0 0-20V22Z"/><path d="M58 28v8m0 8v8m0 8v8M30 40h16m-16 14h12"/></svg><h4>Votre ticket est vide.</h4><p>Sélectionnez une cote dans les matchs pour commencer votre analyse.</p></div>`;
  const states = {
    history: [
      'Vous n’avez pas encore testé vos stratégies.',
      'Voir les matchs du jour',
      'data-empty-matches'
    ],
    matches: [
      'Aucun match pertinent pour le modèle aujourd’hui.',
      'Découvrir le défi de la semaine',
      'data-empty-challenges'
    ],
    ticket: [
      'Votre combiné est vide. Sélectionnez une cote pour commencer l’analyse.',
      'Voir les matchs du jour',
      'data-empty-matches'
    ],
    predictions: [
      'Les résultats apparaîtront après les premiers matchs réglés.',
      'Voir les matchs du jour',
      'data-empty-matches'
    ]
  };
  let [message, label, action] = states[kind] ?? states.history;
  if (filtered) {
    message = 'Aucun résultat ne correspond à vos filtres.';
    label = 'Réinitialiser les filtres';
    action =
      kind === 'predictions'
        ? 'data-empty-reset-predictions'
        : kind === 'history'
          ? 'data-empty-reset-history'
          : 'data-reset-matches';
  }
  return `<div class="guided-empty"><svg viewBox="0 0 80 64" aria-hidden="true"><rect x="10" y="8" width="60" height="48" rx="10"/><path d="M24 24h32M24 34h20M24 44h12"/><circle cx="59" cy="45" r="11"/><path d="m67 53 8 8"/></svg><p>${escape(message)}</p><button type="button" class="button secondary" ${action}>${escape(label)}</button></div>`;
}
