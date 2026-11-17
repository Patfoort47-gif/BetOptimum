import test from 'node:test';
import assert from 'node:assert/strict';
import { emailSenderDomain, emailSenderStatus } from '../src/notifications/email-sender.js';
test('BET-350 : domaine seul, expéditeur de test identifié, aucune clé ni inventaire exposé', async () => {
  assert.equal(emailSenderDomain('BetOptimum <alerts@EXAMPLE.COM>'), 'example.com');
  assert.equal(emailSenderDomain('bad@example.com\nInjected'), null);
  const result = await emailSenderStatus(
    { EMAIL_FROM: 'BetOptimum <onboarding@resend.dev>', RESEND_API_KEY: 'secret' },
    async () =>
      new Response(JSON.stringify({ data: [{ name: 'private.example', status: 'verified' }] }))
  );
  assert.equal(result.test_sender, true);
  assert.equal(result.verified, false);
  assert.equal(result.verified_domains, 1);
  assert.doesNotMatch(JSON.stringify(result), /secret|private.example|onboarding/);
});
test('BET-350 : domaine vérifié seulement si SPF et DKIM sont validés', async () => {
  const env = { EMAIL_FROM: 'alerts@example.com', RESEND_API_KEY: 'secret' };
  for (const spf of ['verified', 'pending']) {
    const result = await emailSenderStatus(
      env,
      async (url) =>
        new Response(
          JSON.stringify(
            url.includes('?')
              ? { data: [{ id: 'd', name: 'example.com', status: 'verified' }] }
              : {
                  status: 'verified',
                  records: [
                    { record: 'SPF', type: 'TXT', status: spf },
                    { record: 'DKIM', type: 'TXT', status: 'verified' }
                  ]
                }
          )
        )
    );
    assert.equal(result.verified, spf === 'verified');
    assert.equal(result.spf, spf);
  }
  const denied = await emailSenderStatus(env, async () => new Response('{}', { status: 403 }));
  assert.equal(denied.code, 'RESEND_DOMAIN_ACCESS_DENIED');
  assert.equal(denied.verified, false);
});
