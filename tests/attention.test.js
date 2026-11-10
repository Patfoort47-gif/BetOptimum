import test from 'node:test';
import assert from 'node:assert/strict';
import { createAttention } from '../attention.js';
test('les pastilles détectent un nouveau résultat une fois, persistent et se vident à la visite', () => {
  const map = new Map(),
    store = { getItem: (k) => map.get(k), setItem: (k, v) => map.set(k, v) };
  let a = createAttention(store, 'user-a');
  assert.equal(a.update('bets', ['old']), false);
  assert.equal(a.update('bets', ['old', 'new']), true);
  a = createAttention(store, 'user-a');
  assert.equal(a.pending('bets'), true);
  a.clear('bets');
  assert.equal(a.update('bets', ['old', 'new']), false);
  assert.equal(a.update('bets', ['next'], true), false);
  assert.equal(createAttention(store, 'user-b').pending('bets'), false);
});
test('stockage indisponible et nouveaux trophées restent gérés dans la session', () => {
  const a = createAttention(null, 'x');
  a.update('rewards', []);
  assert.equal(a.update('rewards', ['badge']), true);
  a.clear('rewards');
  assert.equal(a.update('rewards', ['badge']), false);
});
