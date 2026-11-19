import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState } from '../src/core/empty-state.js';
test('BET-371 : distinguer une période vide des filtres sans résultat', () => {
  const normal = emptyState('matches'),
    filtered = emptyState('matches', true);
  assert.match(filtered, /Aucun résultat ne correspond à vos filtres/);
  assert.match(filtered, /data-reset-matches/);
  assert.match(normal, /Aucun match sur cette période/);
  assert.match(normal, /data-empty-upcoming-matches/);
  assert.doesNotMatch(normal, /défi|data-empty-challenges|aujourd’hui/);
  assert.match(emptyState('history', true), /data-empty-reset-history/);
});
