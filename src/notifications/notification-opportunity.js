// BET-255 : opportunités sur les équipes favorites uniquement.
import { detectAlerts, quietAt } from './notification-model.js';
import { quoteAvailable } from '../model/quote-policy.js';
import { marketKeys } from '../model/markets.js';
export function detectWebAlerts(matches, preferences, favorites, now = Date.now()) {
  if (!preferences?.enabled) return [];
  const fresh = matches
    .map((match) => ({
      ...match,
      bookmakerOffers: (match.bookmakerOffers ?? []).filter((offer) => {
        const date = Date.parse(offer.updatedAt);
        return Number.isFinite(date) && date <= now + 60000 && now - date < 20 * 3600000;
      })
    }))
    .map((match) => {
      const keys = marketKeys(match.odds).filter((key) => quoteAvailable(match, key));
      return {
        ...match,
        bookmakerOffers: match.bookmakerOffers.map((offer) =>
          Object.fromEntries(
            ['key', 'name', 'updatedAt', ...keys, ...keys.map((key) => `${key}Cached`)]
              .filter((key) => offer[key] !== undefined)
              .map((key) => [key, offer[key]])
          )
        )
      };
    });
  const prefs = {
    ...preferences,
    channels: ['web'],
    teams: favorites?.teams ?? [],
    leagues: [],
    min_value: Math.max(0.1, preferences.min_value),
    min_confidence: Math.max(0.65, preferences.min_confidence)
  };
  const events = detectAlerts(fresh, prefs, { max_favorites: 10000, odds_step: 0.1 }, now).sort(
    (a, b) => b.value - a.value || b.confidence - a.confidence || a.key.localeCompare(b.key)
  );
  const seen = new Set();
  return events
    .filter((event) => {
      if (seen.has(event.match_id)) return false;
      seen.add(event.match_id);
      return true;
    })
    .map((event) => ({
      ...event,
      web: true,
      expires_at: new Date(Math.min(Date.parse(event.kickoff), now + 4 * 3600000)).toISOString()
    }));
}
export function webEventCurrent(event, preferences, favorites, matches, now = Date.now()) {
  if (!preferences?.enabled || quietAt(now, preferences) || Date.parse(event.expires_at) <= now)
    return false;
  return detectWebAlerts(matches, preferences, favorites, now).some(
    (current) =>
      current.match_id === event.match_id &&
      current.market === event.market &&
      current.odd >= event.odd * 0.98
  );
}
