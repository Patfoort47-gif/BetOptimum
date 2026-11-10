import test from 'node:test';
import assert from 'node:assert/strict';
import { selectDailySelection } from '../model.js';
import { forecastMatch } from '../prediction-model.js';
const now = Date.parse('2026-11-04T10:00:00Z'),
  day = '2026-11-04';
const fixture = (odds, extra = {}) => ({
  id: 'a',
  date: day,
  kickoff: '2026-11-04T20:00:00Z',
  home: 'A',
  away: 'B',
  homeGoals: 1.6,
  awayGoals: 1,
  odds,
  realOddsMarkets: Object.keys(odds),
  oddsBookmakerCounts: Object.fromEntries(Object.keys(odds).map((key) => [key, 10])),
  marketValidUntil: Object.fromEntries(
    Object.keys(odds).map((key) => [key, '2099-01-01T00:00:00Z'])
  ),
  ...extra
});
test('Double chance et total équipe peuvent battre les marchés historiques', () => {
  const m = fixture({ home: 2, over: 2, btts: 2, homeDraw: 1.4, awayUnder35: 1.2 });
  const chosen = selectDailySelection([m], day, now);
  assert.equal(chosen.pick.key, 'awayUnder35');
  assert.ok(chosen.pick.probability > 0.98);
});
test('Compare toutes les familles, y compris scores, handicaps, marges et demi-lignes', () => {
  for (const key of ['score1_0', 'ehHomeP1', 'homeMargin1Plus', 'under45']) {
    assert.equal(selectDailySelection([fixture({ [key]: 1.2 })], day, now).pick.key, key);
  }
  const m = fixture({ score1_0: 6, ehHomeP1: 1.5, homeMargin1Plus: 2, under45: 1.3 });
  const p = forecastMatch(m, { includeExtended: true }).probs;
  assert.equal(selectDailySelection([m], day, now).pick.probability, Math.max(...Object.values(p)));
});
test('Seuil strict et aucun repli sous 1,15 ou sans cote disponible', () => {
  for (const price of [1.15, 1.14, 1, 0, NaN, Infinity])
    assert.equal(selectDailySelection([fixture({ under35: price })], day, now), null);
  assert.equal(selectDailySelection([fixture({ under35: 1.15001 })], day, now).pick.key, 'under35');
  assert.equal(
    selectDailySelection(
      [fixture({ under35: 1.2 }, { oddsBookmakerCounts: { under35: 9 } })],
      day,
      now
    ),
    null
  );
});
test('La confiance prime sans bonus de value ou de cote, sur tous les matchs du jour', () => {
  const a = fixture({ home: 3 }),
    b = fixture({ under35: 1.2 }, { id: 'b' });
  assert.equal(selectDailySelection([a, b], day, now).match.id, 'b');
  assert.deepEqual(selectDailySelection([a, b], day, now), selectDailySelection([b, a], day, now));
});
test('Exclut passé, direct, dates différentes, données invalides et prix expirés', () => {
  const m = fixture({ under45: 1.2 });
  for (const patch of [
    { completed: true },
    { voided: true },
    { kickoff: '2026-11-04T09:00:00Z' },
    { date: '2026-11-05' },
    { homeGoals: 0 },
    { marketValidUntil: { under45: '2020-01-01T00:00:00Z' } }
  ])
    assert.equal(selectDailySelection([{ ...m, ...patch }], day, now), null);
  assert.equal(selectDailySelection([m], day, now, new Set(['a'])), null);
});
test('La sélection de chaque match suit exactement la même règle que celle du jour', async () => {
  const { recommendedMarket, analyseMatch } = await import('../model.js');
  const m = fixture({ home: 2.1, btts: 1.9, under35: 1.16, homeDraw: 1.15, under45: 1.14 });
  const pick = recommendedMarket(m);
  assert.equal(pick.key, 'under35');
  assert.deepEqual(selectDailySelection([m], day, now).pick, pick);
  assert.equal(pick.probability, analyseMatch(m).probs.under35);
  assert.equal(pick.modelVersion, 'poisson-confidence-v4');
});
test('Sans sélection admissible, aucun ancien marché ni cote synthétique ne sert de repli', async () => {
  const { recommendedMarket } = await import('../model.js');
  assert.equal(recommendedMarket(fixture({ home: 1.15, btts: 1.1 })), null);
  assert.equal(recommendedMarket(fixture({ home: 2 }, { realOddsMarkets: [] })), null);
  assert.equal(recommendedMarket(fixture({ home: 2 }, { oddsBookmakerCounts: { home: 9 } })), null);
  assert.equal(recommendedMarket(fixture({ home: 2 }, { homeGoals: NaN })), null);
});
test('Aucun plafond de cote ou minimum de confiance ne masque un candidat admissible', async () => {
  const { recommendedMarket } = await import('../model.js');
  const m = fixture({ score1_0: 7 });
  assert.equal(recommendedMarket(m).key, 'score1_0');
  assert.ok(recommendedMarket(m).probability < 0.48);
});
test('Instantanés : réactualise les matchs futurs, fige les matchs commencés et ne crée pas de pari absent', async () => {
  const { selectionSnapshot } = await import('../selection-snapshot.js');
  const old = {
      key: 'home',
      label: 'A',
      odd: 2,
      probability: 0.4,
      modelVersion: 'poisson-value-v3'
    },
    m = fixture({ home: 2, under35: 1.2 }, { suggestedPick: old });
  assert.equal(selectionSnapshot(m, m, now).key, 'under35');
  assert.deepEqual(selectionSnapshot({ ...m, kickoff: '2026-11-04T09:00:00Z' }, m, now), old);
  assert.deepEqual(selectionSnapshot({ ...m, completed: true }, m, now), old);
  assert.equal(selectionSnapshot(fixture({ home: 1.15 }), undefined, now), null);
  assert.deepEqual(m.suggestedPick, old);
});
