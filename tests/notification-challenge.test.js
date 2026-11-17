import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planChallengeReminder,
  challengeReminderCurrent
} from '../src/notifications/notification-challenge.js';
import { deliver } from '../src/notifications/notification-delivery.js';
test('BET-340 : aucun rappel même si un ancien compte a donné son accord', () => {
  const now = Date.parse('2026-11-17T09:05:00Z');
  const snapshot = {
    challenge: { day: '2026-11-17', picks: [{ matchId: 'm', kickoff: '2026-11-17T18:00:00Z' }] },
    played: []
  };
  const prefs = {
    enabled: true,
    daily_challenge_reminder: true,
    daily_challenge_consent_at: '2026-01-01',
    timezone: 'Europe/Paris',
    essential: false
  };
  assert.equal(planChallengeReminder(snapshot, prefs, now), null);
  assert.equal(
    challengeReminderCurrent(
      { daily_challenge_reminder: true, expires_at: '2026-11-17T09:15:00Z' },
      snapshot,
      prefs,
      now
    ),
    null
  );
});
test('BET-340 : un événement déjà en file ne contacte aucun transport', async () => {
  for (const channel of ['web', 'email']) {
    const unexpected = () => {
      throw Error('transport interdit');
    };
    const result = await deliver(
      channel,
      {},
      { daily_challenge_reminder: true },
      1,
      {},
      unexpected,
      unexpected
    );
    assert.equal(result.status, 'cancelled');
  }
});
