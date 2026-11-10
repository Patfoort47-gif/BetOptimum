import test from 'node:test';
import assert from 'node:assert/strict';
import { marketSpec, scoreOutcome, marketEnabled } from '../markets.js';
import { forecastMatch } from '../prediction-model.js';
import { selectionResult, settleTicket } from '../model.js';
test('BET-170 : les cinq familles composites expriment une conjonction indivisible', () => {
  const keys = [
    'comboHomeBttsYes',
    'comboHomeDrawBttsNo',
    'comboAwayOver25',
    'comboDrawAwayUnder35',
    'comboBttsYesOver25'
  ];
  for (const key of keys) {
    const spec = marketSpec(key, { home: 'Alpha', away: 'Beta' });
    assert.equal(spec.family, 'Marchés combinés');
    for (let h = 0; h <= 5; h++)
      for (let a = 0; a <= 5; a++)
        assert.equal(
          scoreOutcome(key, h, a),
          spec.parts.every((part) => scoreOutcome(part, h, a) === 'won') ? 'won' : 'lost'
        );
    for (const stage of [0, 1, 2, 3]) assert.equal(marketEnabled(key, stage), false);
    assert.equal(marketEnabled(key, 4), true);
  }
  for (const key of [
    'comboHomeDnbBttsYes',
    'comboHomeOver20',
    'comboHomeOver025',
    'comboHomeBttsMaybe',
    'comboHomeAway',
    'comboHomeOver25BttsYes'
  ])
    assert.equal(marketSpec(key), null, key);
  assert.equal(scoreOutcome('comboDrawBttsNo', 0, 0), 'won');
  assert.equal(scoreOutcome('comboDrawBttsNo', 1, 1), 'lost');
  assert.equal(scoreOutcome('comboHomeBttsYes', 1, 0), 'lost');
});
test('BET-170 : probabilité jointe sur la grille, sans produit des marginales', () => {
  const match = {
      homeGoals: 1.5,
      awayGoals: 1,
      odds: { home: 2, btts: 2, comboHomeBttsYes: 3, comboHomeBttsNo: 3 }
    },
    p = forecastMatch(match, { includeExtended: true }).probs;
  assert.ok(Math.abs(p.comboHomeBttsYes + p.comboHomeBttsNo - p.home) < 1e-10);
  assert.ok(Math.abs(p.comboHomeBttsYes - p.home * p.btts) > 0.001);
});
test('BET-170 : règlement composite au score réglementaire, annulation et systèmes', () => {
  const item = { matchId: 'm', key: 'comboHomeBttsYes', odd: 3.4 },
    match = {
      id: 'm',
      completed: true,
      homeScore: 3,
      awayScore: 1,
      regulation: { extraTime: true, home: 1, away: 1 }
    };
  assert.equal(selectionResult(item, [match]).status, 'lost');
  assert.equal(
    selectionResult(item, [{ ...match, regulation: { extraTime: true, home: null, away: null } }])
      .status,
    'pending'
  );
  assert.deepEqual(
    settleTicket({ stake: 10, items: [item] }, [
      { ...match, regulation: { extraTime: true, home: 2, away: 1 } }
    ]),
    { status: 'won', payout: 34 }
  );
  assert.deepEqual(settleTicket({ stake: 10, items: [item] }, [{ id: 'm', voided: true }]), {
    status: 'void',
    payout: 10
  });
  const other = { matchId: 'n', key: 'away', odd: 2 },
    results = [
      { ...match, regulation: { extraTime: true, home: 2, away: 1 } },
      { id: 'n', voided: true }
    ];
  assert.deepEqual(
    settleTicket(
      {
        betType: 'multiple',
        stake: 10,
        items: [item, other],
        systemLines: [{ indexes: [0, 1], stake: 10, odds: 6.8 }]
      },
      results
    ),
    { status: 'won', payout: 34 }
  );
});
