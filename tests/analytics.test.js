import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnalytics } from '../analytics.js';
test('BET-91 : mises et retours à leurs dates, apports distincts des profits', () => {
  const bet = { id: 'a', date: '2026-10-01T10:00Z', settledAt: '2026-10-03T10:00Z', status: 'won', stake: 20, returnAmount: 50 };
  const result = buildAnalytics({ initial: 100, now: '2026-10-05', bets: [bet, bet, { date: '2026-10-02', stake: 10, status: 'pending' }], capitalEvents: [{ date: '2026-10-02', amount: 40 }, { date: '2026-10-04', amount: -10 }] });
  assert.equal(result.rows[0].balance, 80); assert.equal(result.balance, 150); assert.equal(result.profit, 30); assert.equal(result.capital, 30); assert.equal(result.winrate, 100); assert.equal(result.volume, 2);
});
test('BET-91 : début de période et remboursement exclus des gains et réussites', () => {
  const result = buildAnalytics({ initial: 100, period: '7', now: '2026-10-10T12:00Z', bets: [{ date: '2026-10-01', settledAt: '2026-10-05', status: 'void', stake: 20, returnAmount: 20 }, { date: '2026-10-09', status: 'lost', stake: 10 }] });
  assert.equal(result.opening, 80); assert.equal(result.balance, 90); assert.equal(result.profit, -10); assert.equal(result.settled, 1); assert.equal(result.winrate, 0);
});
test('BET-91 : historique vide, données invalides et dates de Paris', () => {
  assert.deepEqual(buildAnalytics().rows, []);
  assert.equal(buildAnalytics({ bets: [{ date: 'incorrect', stake: 20 }] }).balance, 1000);
  const result = buildAnalytics({ now: '2026-10-24', bets: [{ date: '2026-10-22T23:00Z', status: 'pending', stake: 10 }] });
  assert.equal(result.rows[0].date, '2026-10-23'); assert.equal(result.winrate, null);
});
