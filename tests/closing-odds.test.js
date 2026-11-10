import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trackClosingOdds, closingValue, closingReport } from '../src/history/closing-odds.js';
const t = Date.parse('2026-11-11T06:00:00Z'),
  kickoff = '2026-11-11T21:00:00Z';
const m = {
  kickoff,
  odds: { home: 2.2 },
  suggestedPick: { key: 'home' },
  realOddsMarkets: ['home'],
  oddsBookmakerCounts: { home: 10 }
};
test('première cote conservée, dernière observation antérieure au coup d’envoi et calcul exact', () => {
  const first = trackClosingOdds(m, null, t);
  assert.equal(closingValue(first, 'home', kickoff), null);
  const last = trackClosingOdds(
    { ...m, odds: { home: 2 } },
    { quoteTracking: first },
    t + 12 * 3600000
  );
  assert.equal(last.prediction.odd, 2.2);
  assert(Math.abs(closingValue(last, 'home', kickoff).percent - 10) < 1e-8);
  assert.equal(closingValue(last, 'away', kickoff), null);
  assert.equal(closingValue(last, 'home', '2026-11-11T18:00:00Z'), null);
  assert.deepEqual(trackClosingOdds(m, { quoteTracking: last }, t + 24 * 3600000), last);
  assert.equal(
    closingReport([
      { key: 'home', kickoff, quoteTracking: last },
      { key: 'home', kickoff }
    ]).rate,
    100
  );
});
test('prix en cache, échantillon incomplet et horodatage invalide exclus', () => {
  assert.equal(trackClosingOdds({ ...m, oddsCachedMarkets: ['home'] }, null, t), null);
  assert.equal(trackClosingOdds({ ...m, oddsBookmakerCounts: { home: 9 } }, null, t), null);
  assert.equal(trackClosingOdds({ ...m, kickoff: 'bad' }, null, t), null);
  assert.equal(closingReport([]).rate, null);
});
