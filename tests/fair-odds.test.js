import test from 'node:test';
import assert from 'node:assert/strict';
import { fairOdd, fairOddsMarkup } from '../src/matches/fair-odds.js';
test('BET-345 : cote juste standard et remboursement DNB, sans inventer de probabilité', () => {
  assert.equal(fairOdd({ probability: 0.5 }), 2);
  assert.equal(fairOdd({ probability: 0.4, refundProbability: 0.2 }), 2);
  for (const probability of [0, null, undefined, NaN, -1, 1.1])
    assert.equal(fairOdd({ probability }), null);
  assert.equal(fairOdd({ probability: 0.8, refundProbability: 0.3 }), null);
  const market = {
    key: 'home',
    label: '<A>',
    probability: 0.5,
    odd: 2.3,
    real: true,
    available: true
  };
  const markup = fairOddsMarkup({ markets: [market] });
  assert.match(markup, /&lt;A&gt;/);
  assert.match(markup, /2,30/);
  assert.match(markup, /2,00/);
  assert.match(fairOddsMarkup({ markets: [{ ...market, real: false }] }), /indisponible/);
});
