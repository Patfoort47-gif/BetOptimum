import test from 'node:test';
import assert from 'node:assert/strict';
import { predictionReport } from '../src/history/prediction-report.js';
const now = Date.parse('2026-11-29T12:00Z'),
  base = { date: '2026-11-29', league: 'Ligue 1', key: 'home', odd: 2, oddsSource: 'bookmaker' };
test('bilan : profit et ROI excluent attente remboursement et cote invalide', () => {
  const r = predictionReport(
    [
      { ...base, status: 'won' },
      { ...base, status: 'lost' },
      { ...base, status: 'pending' },
      { ...base, status: 'void' },
      { ...base, status: 'won', odd: null }
    ],
    {},
    now
  );
  assert.equal(r.items.length, 2);
  assert.equal(r.stake, 20);
  assert.equal(r.returned, 20);
  assert.equal(r.roi, 0);
  assert.equal(r.pending, 1);
  assert.equal(r.voided, 1);
  assert.equal(r.invalid, 1);
});
test('bilan : filtres et période en jours de Paris, y compris minuit', () => {
  const rows = [
    { ...base, status: 'won', date: '2026-11-22' },
    { ...base, status: 'lost', date: '2026-11-23' },
    { ...base, status: 'won' }
  ];
  assert.equal(predictionReport(rows, { period: '7' }, now).items.length, 2);
  assert.equal(predictionReport(rows, { result: 'won', period: '7' }, now).profit, 10);
  assert.equal(predictionReport(rows, { league: 'Autre' }, now).roi, null);
  assert.equal(
    predictionReport(
      [{ ...base, status: 'won', date: '2026-11-30' }],
      { period: '1' },
      Date.parse('2026-11-29T23:30Z')
    ).items.length,
    1
  );
});

test('BET-207 : Hier suit la date de Paris au changement d’heure et les autres filtres', () => {
  const rows = [
    {
      date: '2027-10-31',
      league: 'A',
      key: 'home',
      status: 'won',
      odd: 2,
      oddsSource: 'bookmaker'
    },
    {
      date: '2027-10-31',
      league: 'B',
      key: 'away',
      status: 'lost',
      odd: 2,
      oddsSource: 'bookmaker'
    },
    {
      date: '2027-11-01',
      league: 'A',
      key: 'home',
      status: 'lost',
      odd: 2,
      oddsSource: 'bookmaker'
    }
  ];
  const report = predictionReport(
    rows,
    { period: 'yesterday', league: 'A' },
    Date.parse('2027-11-01T00:30:00+01:00')
  );
  assert.equal(report.items.length, 1);
  assert.equal(report.profit, 10);
  assert.equal(report.first, '2027-10-31');
  assert.equal(report.last, '2027-10-31');
});

test('BET-299 : cotes synthétiques et inconnues conservées et isolées', () => {
  const rows = [
    { ...base, status: 'won' },
    { ...base, status: 'won', oddsSource: 'model' },
    { ...base, status: 'lost', oddsSource: 'unknown' }
  ];
  assert.equal(predictionReport(rows, {}, now).items.length, 1);
  assert.equal(predictionReport(rows, { source: 'model' }, now).items.length, 1);
  assert.equal(predictionReport(rows, { source: 'all' }, now).items.length, 3);
  assert.equal(predictionReport(rows, { source: 'unknown' }, now).profit, -10);
  assert.equal(rows.length, 3);
});

test('BET-335 : le bilan et la courbe excluent toute donnée avant novembre sans modifier les archives', () => {
  const rows = [
    { ...base, date: '2026-10-31', status: 'won', odd: 10 },
    { ...base, date: '2026-11-01', status: 'lost' },
    { ...base, date: '2026-11-02', status: 'won', odd: 3 }
  ];
  const report = predictionReport(rows, { source: 'all' }, Date.parse('2026-11-17T12:00Z'));
  assert.equal(report.first, '2026-11-01');
  assert.deepEqual(
    report.items.map((x) => x.date),
    ['2026-11-01', '2026-11-02']
  );
  assert.equal(report.profit, 10);
  assert.equal(report.stake, 20);
  assert.equal(report.roi, 50);
  assert.equal(rows.length, 3);
});
