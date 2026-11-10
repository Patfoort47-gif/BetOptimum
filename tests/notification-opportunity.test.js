import test from 'node:test';
import assert from 'node:assert/strict';
import { detectWebAlerts, webEventCurrent } from '../notification-opportunity.js';
import { workerPayload } from '../notification-worker-request.js';
import { decodeWorkerMatches } from '../notification-worker-codec.js';
const now = Date.parse('2026-11-04T13:00:00Z');
const preferences = {
  enabled: true,
  min_value: 0.1,
  min_confidence: 0.65,
  quiet_start: 1320,
  quiet_end: 480,
  timezone: 'Europe/Paris'
};
const favorites = { teams: ['Lille'], leagues: [] };
const match = {
  id: 'm',
  home: 'Lille',
  away: 'Paris',
  league: 'Ligue 1',
  kickoff: '2026-11-05T18:00:00Z',
  homeGoals: 3,
  awayGoals: 0.5,
  odds: { home: 2 },
  realOddsMarkets: ['home'],
  bookmakerOffers: Array.from({ length: 10 }, (_, i) => ({
    key: `b${i}`,
    name: `Bookmaker ${i}`,
    home: 2,
    updatedAt: new Date(now - 3600000).toISOString()
  }))
};
test('Le push exige consentement, favori, seuils forts, dix bookmakers et prix datés', () => {
  const events = detectWebAlerts([match], preferences, favorites, now);
  assert.equal(events.length, 1);
  assert.equal(events[0].web, true);
  assert.equal(events[0].expires_at, '2026-11-04T17:00:00.000Z');
  assert.deepEqual(
    detectWebAlerts([match], { ...preferences, enabled: false }, favorites, now),
    []
  );
  assert.deepEqual(detectWebAlerts([match], preferences, { teams: [], leagues: [] }, now), []);
  for (const offers of [
    match.bookmakerOffers.slice(0, 9),
    match.bookmakerOffers.map((o) => ({ ...o, key: 'same' })),
    match.bookmakerOffers.map((o) => ({ ...o, updatedAt: undefined })),
    match.bookmakerOffers.map((o) => ({ ...o, updatedAt: '2026-11-01T00:00:00Z' })),
    match.bookmakerOffers.map((o) => ({ ...o, updatedAt: '2026-11-05T00:00:00Z' }))
  ])
    assert.deepEqual(
      detectWebAlerts([{ ...match, bookmakerOffers: offers }], preferences, favorites, now),
      []
    );
  assert.deepEqual(detectWebAlerts([match], { ...preferences, min_value: 1 }, favorites, now), []);
  assert.deepEqual(
    detectWebAlerts(
      decodeWorkerMatches(
        JSON.parse(
          workerPayload({ matches: [match], generatedAt: new Date(now).toISOString() }).body
        )
      ),
      preferences,
      favorites,
      now
    ),
    events
  );
});
test('un seul choix par match, et relecture du signal avant envoi', () => {
  const events = detectWebAlerts([match, match], preferences, favorites, now);
  assert.equal(events.length, 1);
  const event = events[0];
  assert.equal(webEventCurrent(event, preferences, favorites, [match], now), true);
  assert.equal(
    webEventCurrent(event, preferences, favorites, [{ ...match, completed: true }], now),
    false
  );
  assert.equal(
    webEventCurrent(event, preferences, { teams: [], leagues: [] }, [match], now),
    false
  );
  assert.equal(webEventCurrent(event, preferences, favorites, [], now), false);
  assert.equal(webEventCurrent(event, preferences, favorites, [match], now + 4 * 3600000), false);
  assert.equal(
    webEventCurrent(
      event,
      { ...preferences, quiet_start: 0, quiet_end: 1439 },
      favorites,
      [match],
      now
    ),
    false
  );
});

test('un championnat favori seul ne déclenche aucune opportunité push', () => {
  assert.deepEqual(
    detectWebAlerts([match], preferences, { teams: [], leagues: ['Ligue 1'] }, now),
    []
  );
  assert.equal(
    detectWebAlerts([match], preferences, { teams: ['Lille'], leagues: ['Ligue 1'] }, now).length,
    1
  );
});
