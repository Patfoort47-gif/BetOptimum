import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modelComparison, comparisonCard } from '../src/history/model-comparison.js';
const bet = {
  id: '1',
  date: '2026-11-10T10:00Z',
  certified: true,
  betType: 'single',
  items: [{ matchId: 'a', key: 'home' }],
  status: 'won',
  odds: 2,
  stake: 999
};
const prediction = { id: 'a', status: 'lost', odd: 3, oddsSource: 'bookmaker' };
test('mêmes matchs, unité constante, dernier simple seulement et aucune donnée privée dans la carte', () => {
  const r = modelComparison(
    [bet, { ...bet, id: 'old', date: '2026-11-09', status: 'lost' }],
    [prediction]
  );
  assert.deepEqual(r, { count: 1, player: 100, model: -100 });
  const card = comparisonCard(r);
  assert.doesNotMatch(JSON.stringify(card), /999|stake|bankroll|email/);
  assert.match(card.lines[1], /100,0/);
});
test('combinés, remboursés, anciens paris, estimation et match absent exclus symétriquement', () => {
  for (const b of [
    { ...bet, betType: 'combined' },
    { ...bet, items: [...bet.items, ...bet.items] },
    { ...bet, status: 'void' },
    { ...bet, certified: false },
    { ...bet, legacy: true },
    { ...bet, odds: NaN },
    { ...bet, items: [{ matchId: 'b' }] }
  ])
    assert.equal(modelComparison([b], [prediction]).count, 0);
  for (const p of [
    { ...prediction, oddsSource: 'model' },
    { ...prediction, oddsSource: 'unknown' },
    { ...prediction, status: 'pending' }
  ])
    assert.equal(modelComparison([bet], [p]).count, 0);
  assert.equal(comparisonCard(modelComparison([], [])), null);
});
