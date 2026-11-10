import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteAvailable, selectionBookmakerCount, dailyQuoteAvailable } from '../quote-policy.js';
import { fixtureRow } from '../scripts/sync-supabase.mjs';
import { marketCard } from '../market-card.js';
import { analyseMatch, optimizeCombo } from '../model.js';
const match = (n, key = 'home') => ({
  id: 'm',
  home: 'Alpha',
  away: 'Beta',
  homeGoals: 2,
  awayGoals: 1,
  odds: { home: 2, draw: 3, away: 4, over: 2, btts: 2, score1_0: 7 },
  realOddsMarkets: [key],
  bookmakerCount: 100,
  oddsBookmakerCounts: { [key]: 100 },
  bookmakerOffers: Array.from({ length: n }, (_, i) => ({
    key: 'book_' + i,
    [key]: key === 'score1_0' ? 7 : 2
  })),
  marketValidUntil: { score1_0: new Date(Date.now() + 3600000).toISOString() }
});
test('BET-170 : neuf offres refusées, dix acceptées par sélection, doublons et nombre global ignorés', () => {
  const nine = match(9),
    ten = match(10);
  assert.equal(selectionBookmakerCount(nine, 'home'), 9);
  assert.equal(quoteAvailable(nine, 'home'), false);
  assert.equal(quoteAvailable(ten, 'home'), true);
  assert.equal(quoteAvailable(ten, 'draw'), false);
  const duplicate = {
    ...nine,
    bookmakerOffers: [...nine.bookmakerOffers, nine.bookmakerOffers[0]]
  };
  assert.equal(quoteAvailable(duplicate, 'home'), false);
  assert.equal(quoteAvailable({ ...ten, realOddsMarkets: [] }, 'home'), false);
  assert.equal(
    quoteAvailable({ odds: { home: 2 }, realOddsMarkets: ['home'], bookmakerCount: 100 }, 'home'),
    false
  );
  assert.equal(quoteAvailable(match(9, 'score1_0'), 'score1_0'), false);
  assert.equal(quoteAvailable(match(10, 'score1_0'), 'score1_0'), true);
});
test('BET-170 : aucun prix ni value rendu sous le seuil, probabilités préservées et combinés filtrés', () => {
  const nine = match(9),
    ten = match(10),
    raw = analyseMatch(nine).markets.find((m) => m.key === 'home');
  assert.ok(raw.probability > 0);
  assert.equal(marketCard(nine, raw), '');
  assert.deepEqual(fixtureRow(nine).odds, {});
  assert.equal(fixtureRow(ten).odds.home, 2);
  assert.match(
    marketCard(
      ten,
      analyseMatch(ten).markets.find((m) => m.key === 'home')
    ),
    /2,00/
  );
  assert.deepEqual(optimizeCombo([nine, { ...nine, id: 'n' }]), []);
  assert.equal(optimizeCombo([ten, { ...ten, id: 'n' }]).length, 2);
});
test('BET-170 : défi figé avec compteurs par issue ou cote égale au consensus actuel qualifié', () => {
  const m = match(10),
    p = { odds: { home: 1.8 } };
  assert.equal(dailyQuoteAvailable(p, m, 'home'), false);
  assert.equal(dailyQuoteAvailable({ ...p, bookmakerCounts: { home: 10 } }, m, 'home'), true);
  assert.equal(dailyQuoteAvailable({ odds: { home: 2 } }, m, 'home'), true);
  assert.equal(
    dailyQuoteAvailable({ odds: { home: 2 }, bookmakerCounts: { home: 100 } }, match(9), 'home'),
    false
  );
});
