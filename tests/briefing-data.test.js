import test from 'node:test';
import assert from 'node:assert/strict';
import { briefingDataStatus } from '../src/notifications/briefing-data.js';
import { dayMatches, buildBriefing } from '../src/notifications/notification-briefing.js';
import { notificationData } from '../scripts/notification-data.mjs';
import { workerPayload } from '../src/notifications/notification-worker-request.js';
import { decodeWorkerMatches } from '../src/notifications/notification-worker-codec.js';
const now = Date.parse('2026-11-17T08:00:00Z'),
  stamp = new Date(now - 60000).toISOString();
const m = {
  id: 'espn-1',
  home: 'A',
  away: 'B',
  league: 'Ligue des nations',
  date: '2026-11-17',
  kickoff: '2026-11-17T20:00:00Z',
  homeGoals: 1.8,
  awayGoals: 1.2,
  analysisStatus: 'ready',
  odds: { home: 2.5 },
  realOddsMarkets: ['home']
};
test('BET-348 : journée de Paris, matchs sans cote présents et calendrier périmé bloqué même vide', () => {
  const prefs = { timezone: 'Europe/Paris' };
  assert.equal(dayMatches([m], prefs, now).length, 1);
  assert.equal(dayMatches([{ ...m, kickoff: '2026-11-16T23:30:00Z' }], prefs, now).length, 1);
  assert.equal(dayMatches([{ ...m, kickoff: '2026-11-17T23:30:00Z' }], prefs, now).length, 0);
  assert.equal(dayMatches([{ ...m, completed: true }], prefs, now).length, 1);
  assert.equal(briefingDataStatus([], '2026-11-10T08:00:00Z', now).ok, false);
  assert.equal(briefingDataStatus([], stamp, now).ok, true);
  assert.equal(briefingDataStatus([m], stamp, now).ok, true);
  assert.equal(
    briefingDataStatus([{ ...m, analysisStatus: 'unavailable' }], stamp, now).code,
    'BRIEFING_ANALYSIS_UNAVAILABLE'
  );
  const b = buildBriefing(
    [m],
    prefs,
    { date: '2026-11-17', kinds: ['daily'] },
    null,
    [],
    now,
    stamp
  );
  assert.equal(b.matches.length, 1);
  assert.equal(b.picks.length, 0);
  assert.ok(b.hero);
});
test('BET-348 : calendrier compact hydraté et dates par marché conservées jusqu’au worker', async () => {
  const offers = Array.from({ length: 10 }, (_, i) => ({
    key: 'b' + i,
    home: 2.5,
    homeUpdatedAt: stamp
  }));
  const files = {
    'data/fixtures.json': {
      generatedAt: stamp,
      matches: [m, { ...m, id: 'later', date: '2026-11-24', kickoff: '2026-11-24T20:00:00Z' }]
    },
    'data/offers/2026-11-17.json': { matches: { 'espn-1': offers } }
  };
  const data = await notificationData({ now, reader: async (p) => JSON.stringify(files[p]) });
  assert.equal(data.matches.length, 1);
  const payload = workerPayload({ ...data, briefingReady: true });
  const body = JSON.parse(payload.body),
    rows = decodeWorkerMatches(body);
  assert.equal(body.briefingReady, true);
  assert.deepEqual(rows[0].bookmakerOffers, offers);
  assert.equal(rows[0].analysisStatus, 'ready');
  const b = buildBriefing(
    rows,
    { timezone: 'Europe/Paris', min_value: 0, min_confidence: 0 },
    { date: '2026-11-17', kinds: ['daily'] },
    null,
    [],
    now,
    stamp
  );
  assert.equal(b.picks.length, 1);
});
