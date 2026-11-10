import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyOpportunity, opportunityMarkup } from '../market-opportunity.js';
test('table validée : bornes exactes avant arrondi, EV réelle et cote admissible', () => {
  for (const [value, level] of [
    [-1, null],
    [0, null],
    [0.00001, 'watch'],
    [0.03, 'watch'],
    [0.030001, 'strong'],
    [0.18, 'strong']
  ])
    assert.equal(classifyOpportunity(value).level, level);
  for (const value of [null, undefined, NaN, Infinity, '0.2'])
    assert.equal(classifyOpportunity(value).level, null);
  for (const flags of [{ real: false }, { available: false }])
    assert.equal(classifyOpportunity(0.5, flags).level, null);
});
test('badge explicite, EV numérique et absence expliquée sans promesse', () => {
  assert.match(opportunityMarkup(classifyOpportunity(0.18)), /Fort potentiel/);
  assert.match(opportunityMarkup(classifyOpportunity(0.03)), /À surveiller/);
  assert.match(opportunityMarkup(classifyOpportunity(-0.1)), /EV estimée -10 %/);
  assert.match(opportunityMarkup(classifyOpportunity(-0.1)), /Pas d’opportunité/);
  assert.doesNotMatch(opportunityMarkup(classifyOpportunity(null)), /Fort potentiel|NaN|garanti/);
});
