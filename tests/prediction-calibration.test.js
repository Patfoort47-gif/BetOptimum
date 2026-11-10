import { predictionProvenance } from '../src/history/prediction-provenance.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calibrationReport,
  evaluateCalibration,
  renderCalibration
} from '../src/history/prediction-calibration.js';
const row = (date, p, status, key = 'home') => ({
  date,
  probability: p,
  status,
  key,
  oddsSource: 'bookmaker'
});
test('BET-300 : calibration, bornes, Brier et exclusions', () => {
  const report = calibrationReport([
    row('2026-10-01', 0, 'lost'),
    row('2026-10-01', 1, 'won'),
    row('2026-10-01', 0.5, 'lost'),
    row('2026-10-01', 0.5, 'pending'),
    row('2026-10-01', null, 'won'),
    row('2026-10-01', 1.01, 'won')
  ]);
  assert.equal(report.count, 3);
  assert.equal(report.excluded, 3);
  assert.equal(report.brier, 1 / 12);
  assert.equal(report.bins[0].count, 1);
  assert.equal(report.bins[9].count, 1);
  assert.equal(report.bins[5].observed, 0);
  assert.ok(report.bins[5].interval[1] > 0);
  assert.equal(calibrationReport([]).brier, null);
  assert.match(renderCalibration([]), /Aucune probabilité/);
});
test('BET-300 : séparation temporelle, pas de fuite des résultats test dans les facteurs', () => {
  const rows = Array.from({ length: 10 }, (_, i) =>
    row(`2026-10-${String(i + 1).padStart(2, '0')}`, 0.6, i < 5 ? 'won' : 'lost')
  );
  const a = evaluateCalibration(rows),
    b = evaluateCalibration(rows.map((r) => (r.date >= a.testStart ? { ...r, status: 'won' } : r)));
  assert.equal(a.training.count, 7);
  assert.equal(a.test.count, 3);
  assert.equal(a.testStart, '2026-10-08');
  assert.deepEqual(a.factors, b.factors);
  assert.equal(a.activation, false);
  assert.equal(a.sufficient, false);
  assert.equal(a.prematchProven, false);
  assert.notEqual(a.test.before.brier, b.test.before.brier);
  assert.deepEqual(
    evaluateCalibration([
      ...rows,
      { ...rows[0], oddsSource: 'model' },
      { ...rows[0], oddsSource: 'unknown' }
    ]),
    a
  );
});
test('BET-300 : dates entières dans le test, aucun découpage intra-journée', () => {
  const rows = [
    ...Array.from({ length: 5 }, () => row('2026-10-01', 0.5, 'won')),
    ...Array.from({ length: 8 }, () => row('2026-10-02', 0.5, 'lost'))
  ];
  const r = evaluateCalibration(rows);
  assert.equal(r.training.count, 5);
  assert.equal(r.test.count, 8);
  assert.equal(r.test.days, 1);
  assert.equal(r.activation, false);
  const html = renderCalibration(rows);
  assert.match(html, /Intervalle observé/);
  assert.match(html, /Effectif/);
  assert.match(html, /aria-labelledby/);
});

test('BET-300 : capture et coup d’envoi conservés pour la validation prospective', () => {
  const pick = { real: true, capturedAt: '2026-11-10T10:00:00Z', modelVersion: 'v4' },
    match = { kickoff: '2026-11-10T20:00:00Z' };
  assert.deepEqual(predictionProvenance(pick, match), {
    oddsSource: 'bookmaker',
    capturedAt: pick.capturedAt,
    modelVersion: 'v4',
    kickoff: match.kickoff
  });
  assert.equal(
    evaluateCalibration([
      { ...row('2026-11-10', 0.7, 'won'), ...predictionProvenance(pick, match) }
    ]).prematchProven,
    true
  );
});
