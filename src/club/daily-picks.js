// BET-257 : même sélection éditoriale sur le site et dans le résumé push.
import { recommendedMarket } from '../model/model.js';
import { quoteAvailable } from '../model/quote-policy.js';
export function dayInZone(now, timezone = 'Europe/Paris') {
  const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date(now)),
    p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function dailyPicks(matches, timezone = 'Europe/Paris', now = Date.now()) {
  const day = dayInZone(now, timezone),
    seen = new Set(),
    items = [];
  for (const match of matches ?? []) {
    const start = Date.parse(match.kickoff);
    if (
      seen.has(match.id) ||
      match.completed ||
      match.voided ||
      !Number.isFinite(start) ||
      start <= now ||
      dayInZone(start, timezone) !== day
    )
      continue;
    const pick = match.notificationPick ?? recommendedMarket(match);
    if (
      !pick ||
      !quoteAvailable(match, pick.key) ||
      Number(pick.odd) !== Number(match.odds?.[pick.key]) ||
      !Number.isFinite(pick.probability)
    )
      continue;
    seen.add(match.id);
    items.push({ match, pick });
  }
  return items
    .sort(
      (a, b) =>
        b.pick.probability - a.pick.probability ||
        Date.parse(a.match.kickoff) - Date.parse(b.match.kickoff) ||
        String(a.match.id).localeCompare(String(b.match.id)) ||
        a.pick.key.localeCompare(b.pick.key)
    )
    .slice(0, 3);
}
