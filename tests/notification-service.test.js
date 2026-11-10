import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationConfig } from '../src/notifications/notification-config.js';
const env = {
  NOTIFICATION_ENCRYPTION_KEY: btoa('x'.repeat(32)),
  VAPID_PUBLIC_KEY: 'public',
  VAPID_PRIVATE_KEY: 'private',
  VAPID_SUBJECT: 'mailto:test@example.com',
  RESEND_API_KEY: 'private',
  EMAIL_FROM: 'test@example.com',
  SITE_URL: 'https://example.com/app/',
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'private'
};
test('la disponibilité exige le chiffrement et tous les paramètres de chaque canal', () => {
  assert.deepEqual(notificationConfig(env).available, { web: false, discord: false, email: true });
  for (const key of ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'])
    assert.equal(notificationConfig({ ...env, [key]: '' }).available.web, false);
  for (const key of ['RESEND_API_KEY', 'EMAIL_FROM'])
    assert.equal(notificationConfig({ ...env, [key]: '' }).available.email, false);
  for (const key of ['', btoa('short'), '%%%'])
    assert.ok(
      Object.values(
        notificationConfig({ ...env, NOTIFICATION_ENCRYPTION_KEY: key }).available
      ).every((v) => !v)
    );
  assert.ok(!JSON.stringify(notificationConfig(env)).includes('private'));
});
