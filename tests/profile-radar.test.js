import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardRadarAttributes, cardAttributes } from '../model.js';
test('radar : mêmes formules que la carte pour des données complètes', () => {
  const raw = {
    settled: 100,
    wins: 45,
    staked: 1000,
    returned: 1100,
    avgOdds: 2.65,
    tickets30: 10,
    activeDays30: 10,
    avgStakeRatio: 0.11
  };
  assert.deepEqual(cardRadarAttributes(raw), cardAttributes(raw));
  assert.equal(cardRadarAttributes(raw).PRÉ, 60);
});
test('radar : aucune note fictive pour les absences et valeurs invalides', () => {
  assert.ok(Object.values(cardRadarAttributes({})).every((v) => v === null));
  assert.equal(cardRadarAttributes({ settled: 0, avgStakeRatio: null }).DIS, null);
  assert.equal(cardRadarAttributes({ tickets30: -2 }).VOL, null);
  assert.equal(cardRadarAttributes({ activeDays30: Infinity }).RÉG, null);
  assert.equal(cardRadarAttributes({ activeDays30: 0 }).RÉG, 20);
  assert.equal(cardRadarAttributes({ settled: 3, wins: 4 }).PRÉ, null);
});
