import test from 'node:test';
import assert from 'node:assert/strict';
import { matchInsights } from '../match-insights.js';
const ids = { home: '1', away: '2' },
  event = (id, date, home = '1', away = '2') => ({
    id,
    date,
    competitions: [
      {
        status: { type: { state: 'post' } },
        competitors: [
          { homeAway: 'home', team: { id: home, displayName: home }, score: { value: 2 } },
          { homeAway: 'away', team: { id: away, displayName: away }, score: '1' }
        ]
      }
    ]
  });
test('forme limitée à cinq matchs antérieurs et face-à-face dédupliqués', () => {
  const games = Array.from({ length: 7 }, (_, i) =>
    event(String(i), `2026-11-0${i + 1}T12:00:00Z`)
  );
  games.push(
    event('future', '2026-12-01T12:00:00Z'),
    event('other', '2026-11-08T12:00:00Z', '1', '3')
  );
  const r = matchInsights(
    {},
    [{ events: games }, { events: games }],
    ids,
    Date.parse('2026-11-10')
  );
  assert.equal(r.form.home.length, 5);
  assert.equal(r.form.home[0].opponent, '3');
  assert.equal(r.form.away[0].result, 'L');
  assert.equal(r.h2h.length, 5);
  assert.equal(r.h2h[0].date, '2026-11-07T12:00:00Z');
  assert.equal(r.xg, null);
});
test('xG : zéro fourni accepté, valeur absente ou invalide jamais remplacée par Poisson', () => {
  const summary = {
    boxscore: {
      teams: [
        { team: { id: '1' }, statistics: [{ name: 'expectedGoals', value: 0 }] },
        { team: { id: '2' }, statistics: [{ name: 'expectedGoals', displayValue: '1.4' }] }
      ]
    }
  };
  assert.deepEqual(matchInsights(summary, [], ids).xg, { home: 0, away: 1.4 });
  summary.boxscore.teams[1].statistics[0].displayValue = 'N/A';
  assert.equal(matchInsights(summary, [], ids).xg, null);
  assert.deepEqual(matchInsights().h2h, []);
});
test('forme ESPN triée, limitée, sans confusion entre équipes', () => {
  const r = matchInsights(
    {
      lastFiveGames: [
        {
          team: { id: '2' },
          events: [
            {
              gameDate: '2026-11-02',
              gameResult: 'D',
              opponent: { displayName: 'Trois' },
              score: '1-1'
            },
            { gameDate: '2026-11-01', gameResult: 'W', score: '2-0' }
          ]
        }
      ]
    },
    [],
    ids
  );
  assert.equal(r.form.home.length, 0);
  assert.equal(r.form.away[0].result, 'D');
});
