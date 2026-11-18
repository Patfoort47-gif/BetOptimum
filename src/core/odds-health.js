import { sourceFreshness } from './data-freshness.js';
import { matchHasAvailableQuote } from '../model/quote-policy.js';
export function oddsHealth(
  matches,
  { requested = 0, failures = [], reserved = false, refreshedAt = null, now = Date.now() } = {}
) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
  const upcoming = matches.filter((m) => !m.completed && !m.voided && Date.parse(m.kickoff) > now);
  const daily = upcoming.filter((m) => m.date === today);
  const available = (list) => list.filter(matchHasAvailableQuote).length;
  const stale = sourceFreshness(refreshedAt, 'odds', now).status !== 'fresh';
  return {
    status:
      daily.length && !available(daily)
        ? 'unavailable'
        : failures.length
          ? 'partial'
          : stale
            ? 'delayed'
            : requested
              ? 'fresh'
              : 'cache',
    reason: !reserved
      ? 'quota-cache'
      : failures.length
        ? 'provider-error'
        : requested
          ? 'collected'
          : 'no-requests',
    checkedAt: new Date(now).toISOString(),
    upcomingMatches: upcoming.length,
    availableMatches: available(upcoming),
    todayMatches: daily.length,
    todayAvailable: available(daily)
  };
}
export function oddsHealthLabel(health) {
  if (!health) return '';
  const coverage = `${health.todayAvailable}/${health.todayMatches} matchs du jour avec cotes admissibles`;
  return `${coverage}${health.status === 'unavailable' ? ' · Cotes réelles indisponibles pour les matchs du jour' : health.status === 'delayed' ? ' · Actualisation des cotes en retard, dernières offres conservées' : health.status === 'partial' ? ' · Collecte des cotes partielle' : health.status === 'cache' ? ' · Dernières offres conservées' : ''}`;
}
