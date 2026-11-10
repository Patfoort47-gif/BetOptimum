import test from 'node:test';
import assert from 'node:assert/strict';
import { inLiveWindow, applyLiveSnapshot, liveEntryFromPayload } from '../src/matches/live.js';
const kickoff = '2026-11-06T19:00:00Z',
  time = Date.parse(kickoff);
test('les objets Date et les dates ISO déclenchent le direct pendant les quatre heures du match', () => {
  for (const value of [kickoff, new Date(kickoff), time]) {
    assert.equal(inLiveWindow(value, time - 600001), false);
    assert.equal(inLiveWindow(value, time - 600000), true);
    assert.equal(inLiveWindow(value, time), true);
    assert.equal(inLiveWindow(value, time + 3600000), true);
    assert.equal(inLiveWindow(value, time + 14400000), false);
  }
  assert.equal(inLiveWindow('invalide', time), false);
});
test('les scores du résumé, y compris 0-0, alimentent le même état que le scoreboard', () => {
  const payload = {
    header: {
      id: '42',
      competitions: [
        {
          status: { displayClock: "54'", type: { state: 'in' } },
          competitors: [
            { homeAway: 'away', score: '0' },
            { homeAway: 'home', score: '0' }
          ]
        }
      ]
    }
  };
  const entry = liveEntryFromPayload(payload, 'espn-42', 2),
    state = { live: {}, liveErrors: { 'espn-42': 1 }, results: [] },
    match = { id: 'espn-42', home: 'A', away: 'B' };
  assert.deepEqual([entry.home, entry.away, entry.clock], [0, 0, "54'"]);
  assert.equal(applyLiveSnapshot(state, match, entry).changed, true);
  assert.equal(state.liveErrors[match.id], undefined);
  assert.equal(applyLiveSnapshot(state, match, { ...entry, home: 1, updatedAt: 3 }).goal, true);
  assert.equal(applyLiveSnapshot(state, match, entry).changed, false);
  assert.equal(state.live[match.id].home, 1);
  const final = { ...entry, home: 2, away: 1, completed: true, state: 'post', updatedAt: 4 };
  assert.equal(applyLiveSnapshot(state, match, final).finished, 1);
  assert.equal(match.homeScore, 2);
  assert.equal(match.awayScore, 1);
  assert.equal(applyLiveSnapshot(state, match, final).finished, 0);
  assert.equal(state.results.length, 1);
  assert.equal(applyLiveSnapshot(state, match, { ...entry, updatedAt: 5 }).changed, false);
});
