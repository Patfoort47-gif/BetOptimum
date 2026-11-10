import { recommendedMarket } from './model.js';
// Un pronostic ne se recalcule jamais après le coup d'envoi, même si le match n'est pas encore marqué terminé.
export function selectionSnapshot(match, previous = match, now = Date.now()) {
  const kickoff = Date.parse(match.kickoff ?? `${match.date}T${match.time || '12:00'}:00`);
  if (match.completed || match.voided || !Number.isFinite(kickoff) || kickoff <= now)
    return previous?.suggestedPick ?? null;
  const pick = recommendedMarket(match);
  return pick ? { ...pick, capturedAt: new Date(now).toISOString() } : null;
}
