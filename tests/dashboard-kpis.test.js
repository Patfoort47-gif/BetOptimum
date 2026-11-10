import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardKpis } from '../src/history/personal-dashboard.js';
test('KPI : solde global, net signé et ROI des seules mises décidées', () => {
  const figures = dashboardKpis({
    bankroll: 950,
    net: 15,
    decided_staked: 30,
    staked: 80,
    engaged: 50
  });
  assert.deepEqual(
    figures.map((x) => x[0]),
    ['Capital actuel', 'ROI', 'Bénéfice net']
  );
  assert.equal(figures[1][1], '+50 %');
  assert.match(figures[2][1], /^\+15/);
  assert.equal(dashboardKpis({ bankroll: 950, net: -15, decided_staked: 30 })[1][1], '-50 %');
});
test('KPI : aucune mise décidée ou donnée absente ne produit NaN, infini ou faux zéro', () => {
  for (const summary of [
    { bankroll: 1000, net: 0, decided_staked: 0 },
    {},
    { bankroll: null, net: Infinity, decided_staked: 10 }
  ]) {
    const figures = dashboardKpis(summary);
    assert.equal(figures[1][1], '-');
    assert.doesNotMatch(JSON.stringify(figures), /NaN|Infinity/);
  }
  assert.equal(dashboardKpis({})[0][1], 'Indisponible');
  assert.equal(dashboardKpis({})[2][1], 'Indisponible');
});
