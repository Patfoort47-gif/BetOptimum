import test from 'node:test';
import assert from 'node:assert/strict';
import { validatedResultCurrent } from '../notification-result.js';
import { deliver } from '../notification-delivery.js';
const now = Date.now(),
  event = {
    result_validated: true,
    status: 'won',
    expires_at: new Date(now + 10000).toISOString()
  },
  prefs = { enabled: true, essential: true };
test('résultat validé : consentement, mode et résultat serveur relus', () => {
  assert.equal(validatedResultCurrent(event, prefs, { status: 'won' }, now), true);
  for (const bet of [null, { status: 'pending' }, { status: 'lost' }])
    assert.equal(validatedResultCurrent(event, prefs, bet, now), false);
  assert.equal(
    validatedResultCurrent(event, { ...prefs, enabled: false }, { status: 'won' }, now),
    false
  );
  assert.equal(
    validatedResultCurrent(event, { ...prefs, essential: false }, { status: 'won' }, now),
    false
  );
  assert.equal(validatedResultCurrent(event, prefs, { status: 'won' }, now + 20000), false);
});
test('push de résultat privé, regroupé et expiration courte', async () => {
  let payload;
  const target = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/demo',
    keys: { p256dh: 'a'.repeat(87), auth: 'b'.repeat(22) }
  };
  const result = await deliver(
    'web',
    target,
    event,
    123,
    { SITE_URL: 'https://example.org/' },
    () => {
      throw Error('aucun appel réel');
    },
    async (t, p) => (payload = JSON.parse(p))
  );
  assert.equal(result.status, 'sent');
  assert.equal(payload.title, 'Résultat validé');
  assert.equal(payload.tag, 'bet-results');
  assert.equal(payload.url, 'https://example.org/#bankroll');
  assert.ok(Date.parse(payload.expiresAt) <= Date.now() + 120000);
  assert.ok(!JSON.stringify(payload).includes('bet_id'));
  assert.equal(
    (
      await deliver('email', { email: 'test@example.org' }, event, 123, {
        SITE_URL: 'https://example.org/'
      })
    ).status,
    'failed'
  );
});
