import assert from 'node:assert/strict';
import test from 'node:test';
import { syncStudy } from '../src/core/sync-study.js';

test('BET-383 : cohorte volontaire, attribution stable et activité au septième jour civil', () => {
  let saved = null;
  const storage = {
    getItem: () => saved,
    setItem: (_, value) => (saved = value),
    removeItem: () => (saved = null)
  };
  let day = '2026-11-19';
  const today = () => day;
  assert.equal(syncStudy(storage, null, today), null);
  assert.equal(saved, null);
  const cohort = syncStudy(storage, 'temoin', today);
  assert.equal(cohort.control, true);
  cohort.calendar(false);
  cohort.calendar(true);
  cohort.eligible();
  cohort.intent();
  cohort.created();
  day = '2026-11-25';
  syncStudy(storage, 'proposition', today).useful('analyse');
  assert.equal(JSON.parse(saved).usefulDay7, undefined);
  day = '2026-11-26';
  syncStudy(storage, null, today).useful('resultats');
  assert.deepEqual(JSON.parse(saved), {
    group: 'temoin',
    arrival: '2026-11-19',
    matchDay: false,
    eligible: true,
    intent: true,
    created: true,
    usefulDay7: 'resultats'
  });
  day = '2026-12-04';
  assert.equal(syncStudy(storage, null, today), null);
  assert.equal(saved, null);
});
