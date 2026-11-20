import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authCallbackStatus,
  rememberNotificationReturn,
  takeNotificationReturn
} from '../src/account/auth-return.js';
import { translateAuthError } from '../src/account/auth-model.js';
test('le refus Google ne devient pas une erreur de confirmation email', () => {
  for (const suffix of [
    '#error=access_denied&error_description=secret',
    '?error=access_denied&error_description=secret'
  ]) {
    const r = authCallbackStatus('https://example.org/' + suffix);
    assert.equal(r.kind, 'oauth-error');
    assert.match(r.message, /annulée ou refusée/);
    assert.ok(!r.message.includes('secret'));
  }
});
test('confirmation expirée, inscription et récupération restent distinctes', () => {
  assert.equal(
    authCallbackStatus('https://example.org/#error_code=otp_expired').kind,
    'confirmation-error'
  );
  assert.equal(authCallbackStatus('https://example.org/#type=signup').kind, 'signup');
  assert.equal(authCallbackStatus('https://example.org/#type=recovery').kind, 'recovery');
  assert.equal(authCallbackStatus('https://example.org/#access_token=private').kind, 'none');
  assert.equal(authCallbackStatus('https://example.org/?error=server_error').kind, 'oauth-error');
});
test('un lien de récupération expiré renvoie vers une nouvelle demande', () => {
  for (const suffix of [
    '?auth_return=recovery#error_code=otp_expired&error_description=private',
    '#type=recovery&error_code=otp_expired',
    '?auth_return=recovery&error=access_denied'
  ]) {
    const result = authCallbackStatus('https://example.org/' + suffix);
    assert.equal(result.kind, 'recovery-error');
    assert.match(result.message, /nouveau lien de réinitialisation/);
    assert.ok(!result.message.includes('private'));
  }
  assert.equal(authCallbackStatus('https://example.org/?auth_return=recovery').kind, 'none');
  assert.equal(
    authCallbackStatus('https://example.org/?auth_return=recovery#type=recovery').kind,
    'recovery'
  );
});
test('le fournisseur désactivé reçoit une explication exploitable', () => {
  assert.match(
    translateAuthError({ message: 'Unsupported provider: provider is not enabled' }),
    /connexion Google.*indisponible/
  );
  assert.match(translateAuthError({ code: 'access_denied' }), /annulée/);
});

test('le retour de connexion restaure une seule fois une destination privée autorisée', (t) => {
  const values = new Map();
  t.mock.method(Date, 'now', () => 1_000_000);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      setItem: (k, v) => values.set(k, v),
      getItem: (k) => values.get(k) ?? null,
      removeItem: (k) => values.delete(k)
    }
  });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'sessionStorage', descriptor);
    else delete globalThis.sessionStorage;
  });
  for (const hash of ['#bankroll', '#mes-alertes']) {
    rememberNotificationReturn(hash);
    assert.equal(takeNotificationReturn(), hash);
    assert.equal(takeNotificationReturn(), null);
  }
  rememberNotificationReturn('https://example.org/');
  assert.equal(takeNotificationReturn(), null);
  rememberNotificationReturn('#bankroll');
  t.mock.method(Date, 'now', () => 2_000_000);
  assert.equal(takeNotificationReturn(), null);
});
