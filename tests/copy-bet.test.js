import test from 'node:test';
import assert from 'node:assert/strict';
import { copyBetSelections } from '../src/ticket/copy-bet.js';
const match = {
    id: 'x',
    home: 'A',
    away: 'B',
    kickoff: '2027-01-01T12:00:00Z',
    homeGoals: 1.4,
    awayGoals: 1.2,
    odds: { home: 2 },
    realOddsMarkets: ['home'],
    oddsBookmakerCounts: { home: 10 }
  },
  bet = {
    id: 'b',
    status: 'pending',
    bet_type: 'single',
    selections: [{ matchId: 'x', key: 'home', odd: 9 }]
  };
test('copier utilise les cotes actuelles et garde la provenance sans placer le pari', () => {
  const [s] = copyBetSelections(bet, 'Joueur', [match], 0);
  assert.equal(s.odd, 2);
  assert.equal(s.sourceBetId, 'b');
  assert.equal(s.sourceNickname, 'Joueur');
  assert.equal(bet.selections[0].odd, 9);
});
test('copie atomique refusée si une sélection est fermée ou privée/absente', () => {
  assert.throws(() => copyBetSelections(bet, 'J', [], 0));
  assert.throws(() => copyBetSelections({ ...bet, status: 'won' }, 'J', [match], 0));
  assert.throws(() => copyBetSelections(bet, 'J', [{ ...match, completed: true }], 0));
  assert.throws(() =>
    copyBetSelections(
      { ...bet, selections: [...bet.selections, ...bet.selections] },
      'J',
      [match],
      0
    )
  );
});

test('un horaire inconnu refuse la copie', () =>
  assert.throws(() => copyBetSelections(bet, 'J', [{ ...match, kickoff: 'invalide' }], 0)));
