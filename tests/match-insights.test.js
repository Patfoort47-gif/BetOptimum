import test from 'node:test';
import assert from 'node:assert/strict';
import { matchInsights, prematchProjection, recentXg } from '../src/matches/match-insights.js';
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

test('la projection publiée avant le coup d’envoi est conservée après le match', () => {
  const kickoff = '2026-11-27T20:00:00Z';
  const capturedAt = '2026-11-27T17:00:00Z';
  const later = '2026-11-27T23:00:00Z';
  const match = { kickoff, homeGoals: 1.53, awayGoals: 1.23 };
  const saved = prematchProjection(match, null, null, capturedAt);
  assert.deepEqual(saved, { home: 1.53, away: 1.23, capturedAt });
  const finished = { ...match, completed: true, homeGoals: 3, awayGoals: 2 };
  assert.deepEqual(
    prematchProjection(finished, { ...match, prematchGoals: saved }, later, later),
    saved
  );
  assert.deepEqual(prematchProjection(finished, match, capturedAt, later), saved);
  assert.equal(prematchProjection(finished, match, later, later), null);
  assert.equal(
    prematchProjection({ ...match, analysisStatus: 'unavailable' }, null, null, capturedAt),
    null
  );
});

test('les xG récents suivent l’équipe à domicile et à l’extérieur, avec zéros et échantillon', () => {
  const future = { id: 'next', homeId: '1', awayId: '2' };
  const played = [
    { id: 'a', homeId: 3, awayId: 1, kickoff: '2026-11-25T20:00:00Z', completed: true },
    { id: 'b', homeId: 1, awayId: 4, kickoff: '2026-11-26T20:00:00Z', completed: true },
    { id: 'c', homeId: 2, awayId: 5, kickoff: '2026-11-28T20:00:00Z', completed: true }
  ];
  const feed = {
    a: { home: 2, away: 0, source: 'PitchAPI' },
    b: { home: 1, away: 0, source: 'Sportmonks' },
    c: { home: 1, away: 1, source: 'PitchAPI' }
  };
  assert.deepEqual(recentXg(future, [...played, played[0]], feed, Date.parse('2026-11-27')), {
    home: { count: 2, for: 0.5, against: 1 },
    away: null
  });
});
