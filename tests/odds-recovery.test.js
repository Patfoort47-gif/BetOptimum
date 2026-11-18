import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarDue } from '../scripts/calendar-schedule.mjs';
import { oddsHealth, oddsHealthLabel } from '../src/core/odds-health.js';
const now = Date.parse('2026-11-18T09:00:00Z');
test('BET-361 : créneau manqué rattrapé, quota conservé et aucun doublon à jour', () => {
  const old = { generatedAt: '2026-11-17T23:48:00Z', oddsRefreshedAt: '2026-11-17T14:07:00Z' };
  assert.equal(calendarDue(old, ['2026-11-17T14:06:00Z'], now), true);
  const updated = { ...old, generatedAt: new Date(now).toISOString() };
  assert.equal(calendarDue(updated, ['2026-11-18T08:00:00Z'], now), false);
  assert.equal(calendarDue(updated, ['2026-11-17T14:06:00Z'], now), true);
  assert.equal(
    calendarDue({ ...updated, oddsRefreshedAt: new Date(now).toISOString() }, [], now),
    false
  );
  // Créneau été : 6 h Paris = 4 h UTC.
  assert.equal(
    calendarDue({ generatedAt: '2026-07-01T03:00:00Z' }, [], Date.parse('2026-07-01T05:00:00Z')),
    true
  );
});
test('BET-361 : cache seul et zéro cote du jour ne deviennent jamais une collecte verte', () => {
  const m = { date: '2026-11-18', kickoff: '2026-11-18T18:00:00Z', odds: { home: 2.38 } };
  const h = oddsHealth([m], { now, refreshedAt: '2026-11-17T14:07:00Z' });
  assert.equal(h.status, 'unavailable');
  assert.equal(h.todayAvailable, 0);
  assert.equal(h.reason, 'quota-cache');
  assert.match(oddsHealthLabel(h), /indisponibles/);
  const eligible = { ...m, realOddsMarkets: ['home'], oddsBookmakerCounts: { home: 10 } };
  assert.equal(
    oddsHealth([eligible], {
      now,
      refreshedAt: new Date(now).toISOString(),
      requested: 1,
      reserved: true
    }).status,
    'fresh'
  );
  assert.equal(
    oddsHealth([eligible], { now, refreshedAt: '2026-11-17T14:07:00Z' }).status,
    'delayed'
  );
  assert.equal(
    oddsHealth([{ ...eligible, oddsBookmakerCounts: { home: 9 } }], { now }).todayAvailable,
    0
  );
});
