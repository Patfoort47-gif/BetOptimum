import { confidenceKpi, parisDate } from '../model/model.js';
import { publicPredictionHistory } from '../history/prediction-report.js';
export function previousParisDay(now = Date.now()) {
  const today = parisDate(now),
    date = new Date(Date.parse(`${today}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
  const midnight = (day) => {
    const nominal = Date.parse(`${day}T00:00:00Z`);
    for (let offset = -3; offset <= 3; offset++) {
      const instant = nominal + offset * 3600000;
      if (parisDate(instant) === day && parisDate(instant - 1) !== day)
        return new Date(instant).toISOString();
    }
    throw Error('PARIS_DAY_BOUNDARY');
  };
  return { date, start: midnight(date), end: midnight(today) };
}
export function settledSummary(bets) {
  const rows = [...new Map(bets.map((b) => [b.id, b])).values()].filter((b) =>
    ['won', 'lost', 'void'].includes(b.status)
  );
  const valid = rows.filter(
    (b) =>
      b.stake != null &&
      b.payout != null &&
      Number.isFinite(Number(b.stake)) &&
      Number(b.stake) > 0 &&
      Number.isFinite(Number(b.payout)) &&
      Number(b.payout) >= 0
  );
  const money = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  return {
    count: rows.length,
    won: rows.filter((b) => b.status === 'won').length,
    lost: rows.filter((b) => b.status === 'lost').length,
    voided: rows.filter((b) => b.status === 'void').length,
    profit:
      valid.length === rows.length
        ? money(valid.reduce((sum, b) => sum + Number(b.payout) - Number(b.stake), 0))
        : null
  };
}
export function briefingSummary(
  matches,
  history = [],
  settled = [],
  now = Date.now(),
  fresh = true
) {
  const previous = previousParisDay(now),
    publicHistory = publicPredictionHistory(history).filter(
      (p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && Number.isFinite(Date.parse(p.date))
    ),
    model = publicHistory.filter(
      (p) =>
        parisDate(Number.isFinite(Date.parse(p.kickoff)) ? p.kickoff : `${p.date}T12:00:00Z`) ===
          previous.date && ['won', 'lost'].includes(p.status)
    ),
    metrics = fresh ? confidenceKpi(publicHistory, matches, parisDate(now), now) : { score: null };
  return {
    metrics,
    yesterday: {
      ...previous,
      tickets: settledSummary(settled),
      model: {
        count: model.length,
        won: model.filter((p) => p.status === 'won').length,
        lost: model.filter((p) => p.status === 'lost').length
      }
    }
  };
}
