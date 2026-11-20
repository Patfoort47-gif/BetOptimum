import test from 'node:test';
import assert from 'node:assert/strict';
import { historyReport, historyCard, ticketAmounts } from '../src/history/bet-history.js';
const item = {
  matchId: 'a',
  match: 'Paris - Lyon',
  league: 'Ligue 1',
  label: 'Paris gagne',
  key: 'home',
  odd: 2
};
const bet = {
  id: 'b',
  date: '2026-11-01T12:00:00Z',
  stake: 10,
  odds: 2,
  status: 'won',
  returnAmount: 20,
  certified: true,
  items: [item]
};
test('Bilan : résultat réglé séparé des mises en cours, remboursements et systèmes partiels', () => {
  const bets = [
    bet,
    { ...bet, status: 'lost', returnAmount: 0 },
    { ...bet, status: 'void', returnAmount: 10 },
    { ...bet, status: 'pending', returnAmount: undefined },
    {
      ...bet,
      betType: 'multiple',
      stake: 30,
      returnAmount: 12,
      systemLines: [{ indexes: [0], stake: 30, odds: 2 }]
    }
  ];
  const r = historyReport(bets);
  assert.deepEqual(r.totals, {
    staked: 70,
    engaged: 10,
    potential: 20,
    returned: 42,
    net: -18,
    missing: 0
  });
  assert.equal(ticketAmounts(bets[4]).net, -18);
  assert.equal(historyReport(bets, { status: 'pending', search: 'paris' }).visible.length, 1);
  assert.equal(historyReport(bets, { period: '7' }, Date.parse('2026-12-01')).visible.length, 0);
});
test('Pas de retour inventé quand le règlement serveur manque', () => {
  assert.equal(ticketAmounts({ ...bet, returnAmount: undefined }).returned, null);
  assert.match(historyCard({ ...bet, returnAmount: undefined }), /Indisponible/);
});
test('Annulation, progression, système partiel et échappement des données', () => {
  const html = historyCard(
    {
      ...bet,
      items: [{ ...item, match: '<img onerror=alert(1)>' }],
      betType: 'multiple',
      systemLines: [{ indexes: [0], stake: 10, odds: 2 }]
    },
    { results: [{ id: 'a', voided: true }] }
  );
  assert.match(html, /↩ Remboursé/);
  assert.match(html, /Match annulé/);
  assert.match(html, /Sous-pari 1/);
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('undefined : undefined'));
});

test('les montants invités en attente survivent au rechargement', () => {
  const single = {
    ...bet,
    certified: false,
    guest: true,
    status: 'pending',
    returnAmount: undefined,
    odds: 1.26,
    stake: 20,
    systemLines: []
  };
  const restored = JSON.parse(JSON.stringify(single));
  assert.equal(ticketAmounts(restored).potential, 25.2);
  assert.match(historyCard(restored), /5,20/);
  assert.equal(ticketAmounts({ ...restored, odds: 3 }).potential, 60);
  assert.equal(
    ticketAmounts({ ...restored, betType: 'multiple', systemLines: [{ stake: 10, odds: 2 }] })
      .potential,
    20
  );
  assert.match(historyCard({ ...restored, odds: null }), /Indisponible/);
  assert.equal(ticketAmounts({ ...restored, status: 'void' }).net, 0);
});
