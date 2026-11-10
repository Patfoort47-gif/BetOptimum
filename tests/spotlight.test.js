import test from 'node:test';
import assert from 'node:assert/strict';
import { selectSpotlight } from '../model.js';
import { buildBriefing } from '../notification-briefing.js';
import { briefingEmail } from '../notification-email.js';
const now = Date.parse('2026-11-10T08:00:00Z');
const match = (id, extra = {}) => ({
  id,
  date: '2026-11-10',
  kickoff: '2026-11-10T20:00:00Z',
  league: 'Ligue 1',
  home: id,
  away: 'Visiteurs',
  homeGoals: 1.5,
  awayGoals: 1.1,
  odds: { home: 2 },
  realOddsMarkets: ['home'],
  bookmakerOffers: Array.from({ length: 10 }, (_, i) => ({ key: `b${i}`, home: 2 })),
  ...extra
});
test('popularité parmi les matchs admissibles et indépendance de l’ordre', () => {
  const a = match('a', { priority: 100 }),
    b = match('b', { priority: 80, featured: true });
  assert.equal(selectSpotlight([b, a], now).id, 'a');
  assert.equal(selectSpotlight([a, b], now).id, 'a');
});
test('repli sur historique complet et exclusion des matchs indisponibles', () => {
  const a = match('a'),
    b = match('b', { homeStats: { sample: 12 }, awayStats: { sample: 10 } });
  assert.equal(selectSpotlight([a, b], now).id, 'b');
  assert.equal(selectSpotlight([{ ...b, voided: true }, a], now).id, 'a');
  assert.equal(selectSpotlight([{ ...b, completed: true }], now), null);
  assert.equal(selectSpotlight([b], now, new Set(['b'])), null);
});
test('email et site partagent la sélection et les probabilités sans pari forcé', () => {
  const matches = [match('petit'), match('populaire', { priority: 100 })],
    b = buildBriefing(
      matches,
      { timezone: 'Europe/Paris' },
      { date: '2026-11-10', kinds: ['daily'] },
      null,
      [],
      now,
      new Date(now).toISOString()
    );
  assert.equal(b.hero.id, selectSpotlight(matches, now).id);
  const mail = briefingEmail(b, 'https://patfoort47-gif.github.io/BetOptimum/');
  assert.match(mail.text, /Probabilités du modèle/);
  assert.doesNotMatch(mail.text, /Conseil et cote indisponibles|cote NaN/);
});
test('fallback value positive et confiance avant historique', () => {
  const value = match('value', {
      homeGoals: 2,
      awayGoals: 1,
      odds: { home: 2, draw: 3, away: 4, over: 2, btts: 2 },
      realOddsMarkets: ['home', 'draw', 'away', 'over', 'btts'],
      bookmakerOffers: Array.from({ length: 10 }, (_, i) => ({
        key: `b${i}`,
        home: 2,
        draw: 3,
        away: 4,
        over: 2,
        btts: 2,
        updatedAt: new Date(now - 60000).toISOString()
      }))
    }),
    history = match('history', { homeStats: { sample: 100 }, awayStats: { sample: 100 } });
  assert.equal(selectSpotlight([history, value], now).id, 'value');
});

test('BET-278 : aucune affiche ni contenu email sous dix bookmakers', () => {
  const rows = [
    match('zero', { bookmakerOffers: [], priority: 100 }),
    match('neuf', {
      bookmakerOffers: Array.from({ length: 9 }, (_, i) => ({ key: `b${i}`, home: 2 })),
      priority: 100
    })
  ];
  assert.equal(selectSpotlight(rows, now), null);
  const briefing = buildBriefing(
    rows,
    { timezone: 'Europe/Paris' },
    { date: '2026-11-10', kinds: ['daily'] },
    null,
    [],
    now,
    new Date(now).toISOString()
  );
  assert.equal(briefing.hero, null);
  assert.deepEqual(briefing.matches, []);
  assert.deepEqual(briefing.favorites, []);
  assert.equal(selectSpotlight([...rows, match('dix')], now).id, 'dix');
});
