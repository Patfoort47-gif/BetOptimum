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
export function predictionStakeCents(probability, odds) {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) return 1000;
  return probability * odds >= 1.1 ? 1500 : 500;
}
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
  let stakedCents = 0,
    returnedCents = 0;
  const settled = filtered
    .filter(
      (item) =>
        ['won', 'lost'].includes(item.status) &&
        Number.isFinite(Number(item.odd)) &&
        Number(item.odd) > 1
    )
    .map((item) => {
      const odds = Number(item.odd);
      const stake = predictionStakeCents(item.probability, odds);
      const payout = item.status === 'won' ? Math.round(stake * odds) : 0;
      stakedCents += stake;
      returnedCents += payout;
      return {
        ...item,
        stake: stake / 100,
        returnAmount: payout / 100,
        profit: (payout - stake) / 100
      };
    });
  const won = settled.filter((item) => item.status === 'won'),
    stake = stakedCents / 100,
    returned = returnedCents / 100,
    profit = (returnedCents - stakedCents) / 100;
  return {
    items: settled,
    won,
    stake,
    returned,
    profit,
    roi: stake ? (profit / stake) * 100 : null,
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
