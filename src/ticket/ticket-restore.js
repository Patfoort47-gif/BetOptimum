import { decimal } from '../core/number-format.js';
import { readTicket } from './ticket-url.js';
import { analyseMatch } from '../model/model.js';
import { quoteAvailable } from '../model/quote-policy.js';
export function restoreTicket(value, matches, now = Date.now()) {
  const parsed = readTicket(value),
    items = [],
    unavailable = [],
    changed = [];
  for (const reference of parsed.items) {
    const match = matches.find((m) => m.id === reference.matchId),
      name = match ? `${match.home} - ${match.away}` : reference.matchId,
      market = match && analyseMatch(match).markets.find((m) => m.key === reference.key);
    if (
      !match ||
      match.completed ||
      match.voided ||
      !(Date.parse(match.kickoff) > now) ||
      !market ||
      !quoteAvailable(match, reference.key)
    ) {
      unavailable.push(`${name} · ${reference.key} : sélection indisponible`);
      continue;
    }
    items.push({
      ...market,
      matchId: match.id,
      match: name,
      home: match.home,
      away: match.away,
      league: match.league,
      date: match.date,
      time: match.time
    });
    if (Number.isFinite(reference.sharedOdd) && Math.abs(reference.sharedOdd - market.odd) >= 0.005)
      changed.push(
        `${name} · ${market.label} : cote passée de ${decimal(reference.sharedOdd, 2)} à ${decimal(market.odd, 2)}`
      );
  }
  return {
    items,
    unavailable,
    changed,
    invalid: parsed.invalid,
    mode: parsed.mode ?? (items.length > 1 ? 'combined' : 'single'),
    formula: parsed.formula ?? 'auto'
  };
}
