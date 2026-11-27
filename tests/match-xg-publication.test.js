import test from 'node:test';
import assert from 'node:assert/strict';
import { matchXg } from '../scripts/publish-match-xg.mjs';

test('publie uniquement les xG complets du match terminé et identifié sans ambiguïté', () => {
  const kickoff = '2026-11-22T20:00:00Z';
  const match = {
    id: 'espn-123',
    league: 'Ligue 1',
    home: 'Équipe A',
    away: 'Équipe B',
    kickoff,
    completed: true
  };
  const fixture = {
    id: 456,
    league_id: 301,
    starting_at_timestamp: Date.parse(kickoff) / 1000,
    participants: [
      { name: 'Equipe B', meta: { location: 'away' } },
      { name: 'Equipe A', meta: { location: 'home' } }
    ],
    xgfixture: [
      { location: 'away', type: { code: 'expected-goals' }, data: { value: 1.38 } },
      { location: 'home', type: { code: 'expected-goals' }, data: { value: 0 } },
      { location: 'home', type: { code: 'expected-goals-on-target' }, data: { value: 3 } }
    ]
  };
  assert.deepEqual(matchXg([match], [fixture]), { 'espn-123': { home: 0, away: 1.38 } });
  assert.deepEqual(matchXg([{ ...match, completed: false }], [fixture]), {});
  assert.deepEqual(matchXg([{ ...match, voided: true }], [fixture]), {});
  assert.deepEqual(matchXg([match], [{ ...fixture, league_id: 304 }]), {});
  assert.deepEqual(matchXg([match], [{ ...fixture, starting_at_timestamp: 1 }]), {});
  assert.deepEqual(matchXg([match], [{ ...fixture, xgfixture: fixture.xgfixture.slice(1) }]), {});
  assert.deepEqual(matchXg([match], [fixture, { ...fixture, id: 457 }]), {});
});
