import test from 'node:test';
import assert from 'node:assert/strict';
import { comparePlayer, compareRanking, controlledSeries } from '../league-scoring-study.js';
test('Étude : barème intact, pertes, plafond, annulations et quatre approches', () => {
  const rows = [
    { status: 'won', odd: 10 },
    { status: 'lost', odd: 2 },
    { status: 'void', odd: 2 },
    { status: 'pending', odd: 3 }
  ];
  assert.deepEqual(comparePlayer(rows), {
    n: 2,
    wins: 1,
    roi: 195,
    raw: 39,
    positive: 40,
    weighted: 6.5,
    confirmed: false,
    threshold: 10,
    k: 10
  });
  assert.throws(() => comparePlayer([{ status: 'won', odd: NaN }]), /Cote/);
});
test('Seuil : pas de premier confirmé sur un seul pari ; le volume perdant n’ajoute pas de points', () => {
  const groups = {
    isolé: controlledSeries(1, 1, 5),
    durable: controlledSeries(11, 6),
    perdant: controlledSeries(100, 0)
  };
  assert.equal(compareRanking(groups, 'raw')[0].player, 'durable');
  assert.equal(compareRanking(groups, 'threshold')[0].player, 'durable');
  assert.equal(comparePlayer(groups.perdant).raw, -100);
  assert.equal(comparePlayer(controlledSeries(9, 9)).confirmed, false);
  assert.equal(comparePlayer(controlledSeries(10, 10)).confirmed, true);
});
test('Pondération des scores négatifs : le petit échantillon est artificiellement rapproché de zéro', () => {
  assert.ok(
    comparePlayer(controlledSeries(3, 0)).weighted > comparePlayer(controlledSeries(30, 0)).weighted
  );
  assert.equal(comparePlayer([{ status: 'void', odd: 2 }]).n, 0);
  assert.equal(
    compareRanking({ b: controlledSeries(10, 5), a: controlledSeries(10, 5) }, 'raw')[0].player,
    'a'
  );
});

test('Combiné annulé partiellement : cote effective certifiée ; systèmes partiels exclus de la ligue', () => {
  assert.equal(comparePlayer([{ kind: 'combined', status: 'won', odd: 2.5 }]).raw, 15);
  assert.equal(
    comparePlayer([{ kind: 'multiple', status: 'won', odd: 6, payout: 15, stake: 30 }]).n,
    0
  );
  assert.equal(comparePlayer([{ status: 'void', odd: 1 }]).raw, 0);
});
