import test from 'node:test';
import assert from 'node:assert/strict';
import { deliver, validateDestination } from '../notification-delivery.js';
import { notificationConfig } from '../notification-config.js';
test('le canal retiré ne peut plus envoyer même avec une ancienne configuration', async () => {
  let calls = 0;
  const channel = ['tele', 'gram'].join('');
  assert.equal(validateDestination(channel, { chat_id: '123' }), false);
  assert.equal(
    (
      await deliver(
        channel,
        { chat_id: '123' },
        {},
        1,
        { SITE_URL: 'https://example.org/' },
        async () => {
          calls++;
        }
      )
    ).status,
    'failed'
  );
  assert.equal(calls, 0);
  assert.equal(Object.hasOwn(notificationConfig({}).available, channel), false);
});
