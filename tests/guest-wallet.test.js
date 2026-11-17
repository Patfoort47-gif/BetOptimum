import test from 'node:test';
import assert from 'node:assert/strict';
import {
  guestWalletFrom,
  readGuestWallet,
  saveGuestWallet,
  placeGuestTicket,
  settleGuestWallet,
  GUEST_STORAGE_KEY
} from '../src/ticket/guest-wallet.js';
const now = Date.parse('2026-11-17T12:00:00Z');
const match = {
  id: 'espn-42',
  home: 'A',
  away: 'B',
  date: '2026-11-17',
  kickoff: '2026-11-17T20:00:00Z',
  homeGoals: 1.8,
  awayGoals: 1,
  analysisStatus: 'ready',
  odds: { home: 2.5 },
  realOddsMarkets: ['home'],
  oddsBookmakerCounts: { home: 10 }
};
const item = { matchId: match.id, key: 'home', odd: 2.5, label: 'A gagne', match: 'A - B' };
const options = { now, uuid: () => 'guest-42' };
const ticket = { items: [item], stake: '10.50' };
test('BET-347 : démarrage à 1000 €, sauvegarde/relecture et panne de stockage sans crash', () => {
  const values = new Map(),
    storage = { getItem: (k) => values.get(k), setItem: (k, v) => values.set(k, v) };
  const initial = readGuestWallet(storage);
  assert.equal(initial.bankroll, 1000);
  const wallet = placeGuestTicket(initial, ticket, [match], options);
  assert.equal(wallet.bankroll, 989.5);
  assert.equal(initial.bankroll, 1000);
  assert.equal(wallet.history[0].certified, false);
  assert.equal(wallet.history[0].countsGeneral, false);
  assert.equal(saveGuestWallet(wallet, storage), true);
  assert.ok(values.has(GUEST_STORAGE_KEY));
  assert.deepEqual(readGuestWallet(storage), wallet);
  assert.equal(readGuestWallet({ getItem: () => '{cassé' }).bankroll, 1000);
  assert.equal(
    saveGuestWallet(wallet, {
      setItem() {
        throw Error('quota');
      }
    }),
    false
  );
  assert.equal(readGuestWallet(null).bankroll, 1000);
  assert.equal(guestWalletFrom({ ...wallet, history: [{ certified: true }] }).history.length, 0);
});
test('BET-347 : refus avant débit des mises invalides, modèles absents, cotes changées et matchs fermés', () => {
  const wallet = guestWalletFrom(null);
  for (const stake of ['0', '-1', '0.99', '10.555', '1001', 'NaN'])
    assert.throws(() => placeGuestTicket(wallet, { ...ticket, stake }, [match], options));
  for (const bad of [
    { ...match, completed: true },
    { ...match, kickoff: new Date(now).toISOString() },
    { ...match, oddsBookmakerCounts: { home: 9 } },
    { ...match, analysisStatus: 'unavailable' },
    { ...match, odds: { home: 2.6 } }
  ])
    assert.throws(() => placeGuestTicket(wallet, ticket, [bad], options));
  assert.throws(() =>
    placeGuestTicket(wallet, { ...ticket, items: [item, item] }, [match], options)
  );
  assert.equal(wallet.bankroll, 1000);
  assert.equal(wallet.history.length, 0);
});
test('BET-347 : règlement local idempotent, gain, défaite et annulation', () => {
  for (const [result, expected, status] of [
    [{ homeScore: 2, awayScore: 0 }, 1015.75, 'won'],
    [{ homeScore: 0, awayScore: 2 }, 989.5, 'lost'],
    [{ voided: true }, 1000, 'void']
  ]) {
    const wallet = placeGuestTicket(guestWalletFrom(null), ticket, [match], options);
    const results = [{ ...match, completed: true, ...result }];
    const first = settleGuestWallet(wallet, results, now + 1);
    assert.equal(first.settled, 1);
    assert.equal(first.wallet.bankroll, expected);
    assert.equal(first.wallet.history[0].status, status);
    const second = settleGuestWallet(first.wallet, results, now + 2);
    assert.equal(second.settled, 0);
    assert.deepEqual(second.wallet, first.wallet);
  }
});
test('BET-347 : simples indépendants et système conservent leurs mises et indices', () => {
  const other = { ...match, id: 'espn-43' },
    items = [item, { ...item, matchId: other.id }];
  const singles = placeGuestTicket(
    guestWalletFrom(null),
    { items, stake: '10', mode: 'single' },
    [match, other],
    options
  );
  assert.equal(singles.bankroll, 980);
  assert.equal(singles.history.length, 2);
  assert.ok(singles.history.every((b) => b.stake === 10 && b.items.length === 1));
  const third = { ...match, id: 'espn-44' };
  const system = placeGuestTicket(
    guestWalletFrom(null),
    {
      items: [...items, { ...item, matchId: third.id }],
      stake: '30',
      mode: 'multiple',
      formula: '2/3'
    },
    [match, other, third],
    options
  );
  assert.equal(system.bankroll, 970);
  assert.equal(system.history[0].systemLines.length, 3);
  assert.ok(system.history[0].systemLines.every((l) => l.stake === 10));
});
