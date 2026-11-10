import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planChallengeReminder,
  challengeReminderCurrent
} from '../src/notifications/notification-challenge.js';
import { deliver } from '../src/notifications/notification-delivery.js';
const prefs = {
  enabled: true,
  daily_challenge_reminder: true,
  daily_challenge_consent_at: '2026-01-01T00:00:00Z',
  essential: false,
  timezone: 'Europe/Paris',
  quiet_start: 1320,
  quiet_end: 480
};
const snapshot = (now) => ({
  challenge: {
    day: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(now),
    picks: [{ matchId: 'm', kickoff: new Date(now + 3600000).toISOString() }]
  },
  played: []
});
test('BET-310 : 10 h local été/hiver, fenêtre bornée et aucun rappel sans défi jouable', () => {
  for (const date of ['2026-03-29T08:00:00Z', '2026-10-25T09:00:00Z', '2026-11-10T09:00:00Z']) {
    const now = Date.parse(date),
      s = snapshot(now),
      event = planChallengeReminder(s, prefs, now);
    assert.equal(event.challenge_day, date.slice(0, 10));
    assert.equal(Date.parse(event.expires_at), now + 900000);
    assert.equal(planChallengeReminder(s, prefs, now - 1), null);
    assert.equal(planChallengeReminder(s, prefs, now + 900000), null);
    assert.equal(planChallengeReminder(null, prefs, now), null);
    assert.equal(planChallengeReminder({ ...s, played: ['m'] }, prefs, now), null);
    assert.equal(
      planChallengeReminder(
        {
          challenge: {
            ...s.challenge,
            picks: [{ matchId: 'm', kickoff: new Date(now).toISOString() }]
          }
        },
        prefs,
        now
      ),
      null
    );
  }
});
test('BET-310 : consentement distinct, silence, essentiel, expiration et participation relus', () => {
  const now = Date.parse('2026-11-10T09:05:00Z'),
    s = snapshot(now),
    event = planChallengeReminder(s, prefs, now);
  for (const patch of [
    { enabled: false },
    { daily_challenge_reminder: false },
    { daily_challenge_consent_at: null },
    { daily_challenge_consent_at: 'invalid' },
    { daily_challenge_consent_at: '2027-01-01' },
    { essential: true },
    { quiet_start: 600, quiet_end: 660 },
    { quiet_start: 1300, quiet_end: 700 }
  ])
    assert.equal(planChallengeReminder(s, { ...prefs, ...patch }, now), null);
  assert.equal(challengeReminderCurrent(event, { ...s, played: ['m'] }, prefs, now), null);
  assert.equal(
    challengeReminderCurrent({ ...event, expires_at: new Date(now).toISOString() }, s, prefs, now),
    null
  );
  assert.equal(
    challengeReminderCurrent({ ...event, challenge_day: '2026-11-09' }, s, prefs, now),
    null
  );
  assert.equal(
    challengeReminderCurrent(event, s, { ...prefs, timezone: 'America/New_York' }, now),
    null
  );
  assert.equal(planChallengeReminder(s, prefs, now).daily_summary, undefined);
});
test('BET-310 : le jour du défi reste celui de Paris pour un compte dans un autre fuseau', () => {
  const now = Date.parse('2026-11-10T20:05:00Z'),
    s = snapshot(now),
    p = { ...prefs, timezone: 'Pacific/Honolulu' };
  assert.equal(planChallengeReminder(s, p, now).challenge_day, '2026-11-10');
  assert.equal(
    planChallengeReminder({ ...s, challenge: { ...s.challenge, day: '2026-11-11' } }, p, now),
    null
  );
});
test('BET-310 : transport Android et iOS simulé, contenu générique et lien du défi sans validation', async () => {
  const now = Date.parse('2026-11-10T09:05:00Z'),
    event = planChallengeReminder(snapshot(now), prefs, now);
  for (const host of ['fcm.googleapis.com', 'web.push.apple.com']) {
    let payload;
    const target = {
        endpoint: `https://${host}/demo`,
        keys: { p256dh: 'a'.repeat(87), auth: 'b'.repeat(22) }
      },
      result = await deliver(
        'web',
        target,
        event,
        123,
        { SITE_URL: 'https://example.org/app/' },
        () => {
          throw Error('Envoi réseau inattendu');
        },
        async (_, data) => (payload = JSON.parse(data))
      );
    assert.equal(result.status, 'sent');
    assert.equal(payload.title, 'Ton défi du jour t’attend');
    assert.equal(payload.url, 'https://example.org/app/#defi-du-jour');
    assert.equal(payload.tag, 'challenge-2026-11-10');
    assert.doesNotMatch(payload.body, /cote|€|bankroll/);
  }
  assert.equal(
    (await deliver('email', {}, event, 1, { SITE_URL: 'https://example.org/' })).status,
    'failed'
  );
});
