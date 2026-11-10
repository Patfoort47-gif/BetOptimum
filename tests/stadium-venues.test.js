import test from 'node:test';
import assert from 'node:assert/strict';
import { verifiedVenue, enrichVenues } from '../scripts/enrich-stadium-venues.mjs';
const match = {
  id: 'espn-123',
  homeId: '1',
  awayId: '2',
  league: 'Ligue 1',
  odds: { home: 2 },
  homeGoals: 1.5
};
const summary = {
  header: {
    id: '123',
    competitions: [
      {
        neutralSite: true,
        competitors: [
          { homeAway: 'home', team: { id: '1' } },
          { homeAway: 'away', team: { id: '2' } }
        ]
      }
    ]
  },
  gameInfo: { venue: { id: '42', fullName: 'Stade du match' } }
};
test('lieu du match vérifié avec les deux équipes et l’identifiant ESPN, y compris terrain neutre', () => {
  assert.deepEqual(verifiedVenue(match, summary), {
    neutralSite: true,
    venue: { id: '42', name: 'Stade du match' }
  });
  assert.equal(verifiedVenue({ ...match, id: 'espn-999' }, summary), null);
  assert.equal(verifiedVenue({ ...match, homeId: '2' }, summary), null);
  assert.equal(verifiedVenue({ ...match, awayId: '3' }, summary), null);
});
test('enrichissement des lieux sans changer cotes, pronostics ni données annexes, échec isolé', async () => {
  const data = {
    generatedAt: 'date',
    matches: [
      match,
      { ...match, id: 'espn-124' },
      { ...match, id: 'espn-125', venue: { id: '50', name: 'Déjà confirmé' } }
    ],
    settlements: [{ id: 'archive' }],
    dailyChallenge: { matchIds: ['espn-123'] }
  };
  let calls = 0;
  const result = await enrichVenues(data, {
    fetchSummary: async (m) => {
      calls++;
      if (m.id === 'espn-124') throw new Error('indisponible');
      return summary;
    }
  });
  assert.equal(calls, 2);
  assert.equal(result.enriched, 1);
  assert.equal(result.failed, 1);
  assert.deepEqual(result.data, {
    ...data,
    matches: [
      { ...match, neutralSite: true, venue: { id: '42', name: 'Stade du match' } },
      data.matches[1],
      data.matches[2]
    ]
  });
  assert.equal(data.matches[0].venue, undefined);
});
