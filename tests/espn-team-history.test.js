import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scheduleHistory,
  collectMissingTeamForms,
  teamHistoryKey
} from '../scripts/espn-team-history.mjs';
import { teamForm } from '../src/matches/team-form.js';
const now = Date.parse('2026-11-17T12:00:00Z');
const event = (id, date = '2026-11-14T20:00:00Z') => ({
  id,
  date,
  competitions: [
    {
      status: { type: { completed: true, state: 'post', name: 'STATUS_FULL_TIME' } },
      competitors: [
        { homeAway: 'home', team: { id: '482', displayName: 'Portugal' }, score: { value: 2 } },
        { homeAway: 'away', team: { id: '578', displayName: 'Wales' }, score: { value: 0 } }
      ]
    }
  ]
});
const options = { teamId: '482', teamName: 'Portugal', now };
const match = {
  league: 'Ligue des nations',
  homeId: '482',
  awayId: '578',
  home: 'Portugal',
  away: 'Wales',
  kickoff: '2026-11-17T20:00:00Z'
};
test('BET-341 : historique réel avec identité, score nul, dates et déduplication', () => {
  const valid = event('1'),
    future = event('2', '2026-11-18T12:00:00Z'),
    old = event('3', '2025-01-01T12:00:00Z'),
    pending = event('4'),
    missing = event('5'),
    wrong = event('6');
  pending.competitions[0].status.type.state = 'pre';
  missing.competitions[0].competitors[0].score.value = null;
  wrong.competitions[0].competitors[0].team.id = '999';
  const history = scheduleHistory(
    { events: [valid, valid, future, old, pending, missing, wrong] },
    options
  );
  assert.equal(history.length, 1);
  assert.equal(history[0].score.fullTime.away, 0);
  const stats = teamForm('Portugal', history);
  assert.equal(stats.avgScored, 2);
  assert.equal(stats.avgConceded, 0);
  assert.equal(stats.recent[0].opponent, 'Wales');
});
test('BET-341 : prolongation sans score réglementaire et forfait exclus', () => {
  const extra = event('1');
  extra.competitions[0].status.period = 4;
  assert.equal(scheduleHistory({ events: [extra] }, options).length, 0);
  for (const t of extra.competitions[0].competitors)
    t.linescores = [{ value: 1 }, { value: 0 }, { value: 3 }];
  assert.equal(scheduleHistory({ events: [extra] }, options)[0].score.fullTime.home, 1);
  const awarded = event('2');
  awarded.competitions[0].status.type.name = 'STATUS_FORFEIT';
  assert.equal(scheduleHistory({ events: [awarded] }, options).length, 0);
});
test('BET-341 : collecte mutualisée par équipe, deuxième saison si nécessaire et échec sans faux modèle', async () => {
  let count = 0;
  const result = await collectMissingTeamForms(
    [match, { ...match, kickoff: '2026-11-18T20:00:00Z' }],
    [],
    { 'Ligue des nations': 'uefa.nations' },
    {
      now,
      fetcher: async (url) => {
        count++;
        return {
          ok: true,
          json: async () => ({
            events: [
              event(
                url.includes('season=2025') ? '2' : '1',
                url.includes('season=2025') ? '2026-09-01T20:00:00Z' : undefined
              )
            ]
          })
        };
      }
    }
  );
  assert.equal(count, 4);
  assert.equal(result.forms.size, 2);
  assert.equal(result.forms.get(teamHistoryKey(match.league, '482')).sample, 2);
  assert.equal(result.forms.get(teamHistoryKey(match.league, '578')).avgConceded, 2);
  const failed = await collectMissingTeamForms(
    [match],
    [],
    { 'Ligue des nations': 'uefa.nations' },
    {
      now,
      maxRequests: 1,
      fetcher: async () => {
        throw Error('réseau');
      }
    }
  );
  assert.equal(failed.requests, 1);
  assert.equal(failed.forms.size, 0);
  assert.ok(failed.failures.length);
  const covered = await collectMissingTeamForms(
    [match],
    scheduleHistory({ events: [event('1'), event('2')] }, options),
    { 'Ligue des nations': 'uefa.nations' },
    {
      now,
      fetcher: async () => {
        assert.fail('historique déjà couvert');
      }
    }
  );
  assert.equal(covered.requests, 0);
});
