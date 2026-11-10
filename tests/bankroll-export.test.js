import test from 'node:test';
import assert from 'node:assert/strict';
import { bankrollCsv } from '../src/history/bankroll-export.js';
const data = {
  account: { bankroll: 1010 },
  capital_events: [],
  bets: [
    {
      id: 'a',
      placed_at: '2026-11-01T12:00:00Z',
      settled_at: '2026-11-02T12:00:00Z',
      stake: 10,
      odds: 2,
      payout: 20,
      status: 'won',
      selections: [{ match: 'Équipe "A";B', label: '=FORMULE()' }]
    }
  ]
};
test('CSV UTF-8, échappement et mouvements complets malgré un filtre de période', () => {
  const csv = bankrollCsv(data);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /Équipe ""A"";B/);
  assert.match(csv, /'=FORMULE/);
  assert.match(csv, /"1010,00"/);
  assert.match(csv, /Gagné/);
  assert.equal(bankrollCsv(data, { from: '2026-11-02' }).split('\r\n').length, 2);
});
test('les paris en attente ne génèrent aucun gain fictif', () => {
  const d = {
    account: { bankroll: 990 },
    bets: [{ ...data.bets[0], status: 'pending', settled_at: null, payout: null }]
  };
  assert.match(bankrollCsv(d), /"En cours";"";"990,00"/);
});

test('les montants négatifs restent des nombres dans le tableur', () => {
  const csv = bankrollCsv({
    account: { bankroll: 990 },
    bets: [{ ...data.bets[0], status: 'lost', payout: 0 }]
  });
  assert.match(csv, /\"Perdu\";\"-10,00\"/);
  assert.doesNotMatch(csv, /'-10/);
});
