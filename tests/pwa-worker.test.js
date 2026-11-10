import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { notificationConfig } from '../notification-config.js';
test('push : destination limitée au site et clic sur le match', async () => {
  const listeners = {},
    shown = [],
    opened = [];
  const self = {
    location: { origin: 'https://example.test' },
    registration: {
      scope: 'https://example.test/BetOptimum/',
      showNotification: async (...args) => shown.push(args)
    },
    addEventListener: (name, handler) => (listeners[name] = handler),
    clients: { matchAll: async () => [], openWindow: async (url) => opened.push(url) }
  };
  vm.runInNewContext(await readFile(new URL('../notification-sw.js', import.meta.url), 'utf8'), {
    self,
    URL,
    console
  });
  let pending;
  listeners.push({
    data: { json: () => ({ title: 'EV+', url: 'https://evil.test/' }) },
    waitUntil: (p) => (pending = p)
  });
  assert.equal(shown.length, 0);
  listeners.push({
    data: {
      json: () => ({
        title: 'EV+',
        body: 'Test',
        url: 'https://example.test/BetOptimum/#match-espn-1'
      })
    },
    waitUntil: (p) => (pending = p)
  });
  await pending;
  assert.equal(shown.length, 1);
  listeners.notificationclick({
    notification: { data: shown[0][1].data, close() {} },
    waitUntil: (p) => (pending = p)
  });
  await pending;
  assert.deepEqual(opened, ['https://example.test/BetOptimum/#match-espn-1']);
  let intercepted = false;
  listeners.fetch({
    request: { method: 'GET', url: 'https://example.test/BetOptimum/data/fixtures.json' },
    respondWith() {
      intercepted = true;
    }
  });
  assert.equal(intercepted, false);
  listeners.fetch({
    request: { method: 'GET', url: 'https://db.supabase.co/rest/v1/bets' },
    respondWith() {
      intercepted = true;
    }
  });
  assert.equal(intercepted, false);
});
test('le canal push reste indisponible sans configuration et chiffrement complets', () => {
  assert.equal(notificationConfig({}).available.web, false);
  const env = {
    NOTIFICATION_ENCRYPTION_KEY: btoa('a'.repeat(32)),
    VAPID_PUBLIC_KEY: 'a'.repeat(87),
    VAPID_PRIVATE_KEY: 'a'.repeat(43),
    VAPID_SUBJECT: 'mailto:alerts@example.test'
  };
  assert.equal(notificationConfig(env).available.web, true);
  assert.equal(
    notificationConfig({ ...env, NOTIFICATION_ENCRYPTION_KEY: '' }).available.web,
    false
  );
});
