// BET-169 : règle de classement V3, validée le 3 novembre 2026.
// Le barème numérique V2 reste identique ; aucune période commencée n’est recalculée.
import { tieBreak } from '../model/model.js';
export const RANKING_ACTIVATION = '2026-11-09',
  CONFIRMED_DECISIONS = 10;
export const rankingVersion = (start) => (start && start >= RANKING_ACTIVATION ? 3 : 2);
export const decidedEntry = (entry) =>
  typeof entry.decided === 'boolean'
    ? entry.decided
    : ['won', 'lost'].includes(entry.status) || (!entry.status && Number(entry.points) !== 0);
export function rankPeriod(rows, start) {
  const version = rankingVersion(start),
    ranked = rows.map((row) => ({
      ...row,
      ranking_version: version,
      confirmed: version < 3 || Number(row.decided) >= CONFIRMED_DECISIONS
    }));
  ranked.sort((a, b) => Number(b.confirmed) - Number(a.confirmed) || tieBreak(a, b));
  let rank = 0;
  return ranked.map((row) => ({ ...row, rank: row.confirmed ? ++rank : null }));
}
