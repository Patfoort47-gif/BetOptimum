import test from 'node:test';
import assert from 'node:assert/strict';
import { valueBetMarkup, opportunityMarkup, dataBasisMarkup } from '../src/matches/opportunity.js';
test('BET-356 : badge fondé sur tout marché admissible EV strictement positive', () => {
  const market = { key: 'away', label: '<Extérieur>', value: 0.00001, real: true, available: true };
  assert.match(
    valueBetMarkup({ markets: [{ ...market, value: -0.02 }, market] }),
    /Value Bet · &lt;Extérieur&gt;/
  );
  for (const value of [-0.02, 0, null, NaN, Infinity])
    assert.equal(valueBetMarkup({ markets: [{ ...market, value }] }), '');
  for (const flags of [{ real: false }, { available: false }])
    assert.equal(valueBetMarkup({ markets: [{ ...market, ...flags }] }), '');
});
test('BET-356 : xG absents, explication qualitative sans score brut', () => {
  assert.match(dataBasisMarkup({ score: 5, xgAvailable: false }), /forme et les buts réels/);
  const markup = opportunityMarkup(
    { markets: [{ key: 'home', value: -0.02, dataConfidence: { score: 5, xgAvailable: false } }] },
    { key: 'home' }
  );
  assert.doesNotMatch(markup, /5\/100|<meter/);
  assert.match(markup, /xG observés indisponibles/);
});
