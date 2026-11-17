import { predictionOddsSource } from './prediction-provenance.js';
export const PUBLIC_RESULTS_START = '2026-11-01';
export const publicPredictionHistory = (history) =>
  (history ?? []).filter(
    (item) => typeof item.date === 'string' && item.date >= PUBLIC_RESULTS_START
  );
const dateInParis = (time) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(time));
export function predictionReport(history, filters = {}, now = Date.now()) {
  const days = Number(filters.period),
    today = dateInParis(now),
    dayStart = new Date(today + 'T12:00:00Z');
  if (Number.isFinite(days) && days > 0) dayStart.setUTCDate(dayStart.getUTCDate() - days + 1);
  if (filters.period === 'yesterday') dayStart.setUTCDate(dayStart.getUTCDate() - 1);
  const first =
      days > 0 || filters.period === 'yesterday'
        ? [PUBLIC_RESULTS_START, dayStart.toISOString().slice(0, 10)].sort().at(-1)
        : PUBLIC_RESULTS_START,
    last = filters.period === 'yesterday' ? first : today;
  const source = filters.source || 'bookmaker',
    sourceItems = publicPredictionHistory(history).filter(
      (item) => source === 'all' || predictionOddsSource(item) === source
    );
  const filtered = sourceItems.filter(
    (item) =>
      (!first || item.date >= first) &&
      item.date <= last &&
      ['league', 'market', 'result'].every(
        (key) =>
          !filters[key] ||
          filters[key] === 'all' ||
          item[key === 'market' ? 'key' : key === 'result' ? 'status' : key] === filters[key]
      )
  );
  const settled = filtered.filter(
      (i) =>
        ['won', 'lost'].includes(i.status) && Number.isFinite(Number(i.odd)) && Number(i.odd) > 1
    ),
    won = settled.filter((i) => i.status === 'won'),
    stake = settled.length * 10,
    returned = won.reduce((s, i) => s + Number(i.odd) * 10, 0);
  return {
    items: settled,
    won,
    stake,
    returned,
    profit: returned - stake,
    roi: stake ? ((returned - stake) / stake) * 100 : null,
    pending: filtered.filter((i) => i.status === 'pending').length,
    voided: filtered.filter((i) => ['void', 'voided'].includes(i.status)).length,
    invalid: filtered.filter(
      (i) =>
        ['won', 'lost'].includes(i.status) &&
        (!Number.isFinite(Number(i.odd)) || Number(i.odd) <= 1)
    ).length,
    first,
    last
  };
}
