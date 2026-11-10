import test from 'node:test';
import assert from 'node:assert/strict';
import { fairMarket, dataConfidence, evTone } from '../opportunity.js';
import { analyseMatch } from '../model.js';
import { prepareAnalyses } from '../analysis-loader.js';
const at = '2026-11-10T06:00:00Z',
  offer = (key = 'a') => ({
    key,
    home: 2,
    draw: 4,
    away: 4,
    homeUpdatedAt: at,
    drawUpdatedAt: at,
    awayUpdatedAt: at
  }),
  match = () => ({
    id: 'x',
    kickoff: '2026-11-11T12:00:00Z',
    homeGoals: 1.7,
    awayGoals: 1.1,
    odds: { home: 2, draw: 4, away: 4, over: 2, btts: 2 },
    realOddsMarkets: ['home', 'draw', 'away'],
    bookmakerOffers: [offer()],
    oddsBookmakerCounts: { home: 10, draw: 10, away: 10 }
  });
test('normalisation proportionnelle par bookmaker, sans modifier le prix payable', () => {
  const m = match();
  m.bookmakerOffers[0].home = 1.8;
  const p = fairMarket(m, 'home');
  assert.ok(Math.abs(p - 1 / 1.8 / (1 / 1.8 + 1 / 4 + 1 / 4)) < 1e-12);
  const a = analyseMatch(m).markets.find((x) => x.key === 'home');
  assert.equal(a.value, a.probability * 2 - 1);
  assert.equal(a.marketDelta, a.probability - p);
  assert.equal(a.odd, 2);
});
test('aucun de-vigging incomplet, non daté, décalé ou de marchés qui se recouvrent', () => {
  const m = match();
  assert.equal(fairMarket(m, 'homeDraw'), null);
  delete m.bookmakerOffers[0].awayUpdatedAt;
  assert.equal(fairMarket(m, 'home'), null);
  m.bookmakerOffers = [{ ...offer(), awayUpdatedAt: '2026-11-09T06:00:00Z' }];
  assert.equal(fairMarket(m, 'home'), null);
  m.bookmakerOffers = [offer()];
  m.realOddsMarkets = ['home'];
  assert.equal(fairMarket(m, 'home'), null);
});
test('bornes EV inclusives, données manquantes à zéro sans renormalisation', () => {
  assert.equal(evTone(0.03), 'neutral');
  assert.equal(evTone(-0.03), 'neutral');
  assert.equal(evTone(0.031), 'positive');
  assert.equal(evTone(-0.031), 'negative');
  assert.equal(evTone(null), 'neutral');
  const quality = dataConfidence(match(), 'home');
  assert.equal(quality.score, 0);
  assert.equal(quality.xgAvailable, false);
  assert.equal(quality.coverage, 0);
});
test('consensus pénalisé par la dispersion et dédupliqué', () => {
  const m = match();
  m.bookmakerOffers = Array.from({ length: 10 }, (_, i) => offer(String(i)));
  const q = dataConfidence(m, 'home');
  assert.equal(q.consensus, 100);
  assert.equal(q.score, 30);
  m.bookmakerOffers[9].home = 4;
  assert.ok(dataConfidence(m, 'home').consensus < 100);
  m.bookmakerOffers = Array(10).fill(offer());
  assert.equal(dataConfidence(m, 'home').consensus, 0);
});
test('cache isolé et invalidé lorsque les cotes ou les données changent', () => {
  const m = match(),
    a = analyseMatch(m);
  a.markets[0].dataConfidence.score = 100;
  a.probs.home = 0;
  assert.notEqual(analyseMatch(m).probs.home, 0);
  assert.notEqual(analyseMatch(m).markets[0].dataConfidence.score, 100);
  m.odds.home = 3;
  assert.notEqual(analyseMatch(m).markets[0].value, a.markets[0].value);
});
test('au-delà de 100 matchs le Worker prépare le même modèle et est libéré', async () => {
  let called = 0,
    terminated = 0;
  class WorkerStub {
    postMessage(matches) {
      called++;
      queueMicrotask(() => this.onmessage({ data: { results: matches.map(analyseMatch) } }));
    }
    terminate() {
      terminated++;
    }
  }
  const matches = Array.from({ length: 101 }, (_, i) => ({ ...match(), id: String(i) }));
  await prepareAnalyses(matches, { WorkerClass: WorkerStub });
  assert.equal(called, 1);
  assert.equal(terminated, 1);
  assert.deepEqual(analyseMatch(matches[0]), analyseMatch(match()));
});
test('échec du Worker : repli coopératif sans bloquer le chargement', async () => {
  class BrokenWorker {
    postMessage() {
      queueMicrotask(() => this.onerror());
    }
    terminate() {}
  }
  await prepareAnalyses(
    Array.from({ length: 101 }, () => match()),
    { WorkerClass: BrokenWorker }
  );
});
