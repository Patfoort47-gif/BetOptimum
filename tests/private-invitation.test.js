import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  invitationPreview,
  invitationLink,
  invitationCard,
  parseInvitation,
  saveInvitation,
  readInvitation,
  INVITATION_KEY
} from '../src/club/private-invitation.js';
const base = 'https://example.org/app/',
  code = 'BM-AB2CDE3F';
const preview = invitationPreview({ name: 'Les amis', members: 12 }, [
  { nickname: 'secret', user_id: 'private', points: 12.3 }
]);
test('aperçu partagé : nom, effectif et podium anonyme bornés, anciens liens conservés', () => {
  const url = invitationLink(code, preview, base);
  assert.deepEqual(parseInvitation(url), { code, preview });
  assert.equal(parseInvitation(base + '#ligue-privee-BM-AB2C').code, 'BM-AB2C');
  assert.equal(parseInvitation(base + '?invitation=' + code).code, code);
  assert.doesNotMatch(JSON.stringify(invitationCard(preview)), /secret|private|user_id/);
  assert.equal(invitationPreview({ name: 'Amis', members: 51 }), null);
  assert.equal(parseInvitation(base + '#ligue-privee-invalide'), null);
  assert.equal(parseInvitation(base + '#ligue-privee-' + code + '?apercu=%'), null);
});
test('consentement de continuation en session uniquement, expiration 24 h et stockage indisponible', () => {
  const map = new Map(),
    storage = {
      setItem: (k, v) => map.set(k, v),
      getItem: (k) => map.get(k),
      removeItem: (k) => map.delete(k)
    };
  saveInvitation(storage, { code, preview }, false, 1000);
  assert.equal(readInvitation(storage, 1001).autoJoin, false);
  saveInvitation(storage, { code, preview }, true, 1000);
  assert.equal(readInvitation(storage, 1001).autoJoin, true);
  assert.equal(readInvitation(storage, 1000 + 86400001), null);
  assert.equal(map.has(INVITATION_KEY), false);
  assert.equal(readInvitation(null), null);
  assert.equal(saveInvitation(null, { code }, true), false);
  assert.equal(parseInvitation(base + '?invitation=' + code + '&join=1').autoJoin, undefined);
});
