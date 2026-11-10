import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultAvatar, restrictedIds } from '../src/avatar/avatar-config.js';
import { registrationAvatar, resolveAccountAvatar } from '../src/account/registration-avatar.js';
const chosen = () => ({
  ...defaultAvatar(),
  skin: 4,
  hair: 5,
  face: 3,
  kit: { item: 'start-blue', name: 'VICTOR', number: 47 }
});
test('Le choix de création survit à un ancien état synchronisé et se recharge depuis le profil', () => {
  const meta = registrationAvatar(chosen());
  const first = resolveAccountAvatar({ avatar: 'lime' }, { avatar: 'lime' }, meta);
  assert.deepEqual(first, chosen());
  const persisted = JSON.parse(JSON.stringify(first));
  assert.deepEqual(resolveAccountAvatar(persisted, defaultAvatar(), meta), chosen());
  assert.deepEqual(resolveAccountAvatar(persisted, null, null), chosen());
});
test('Une modification du profil après inscription reste prioritaire sur les métadonnées', () => {
  const edited = { ...chosen(), hair: 8, rev: 123 };
  assert.deepEqual(resolveAccountAvatar(edited, chosen(), defaultAvatar()), edited);
});
test('Sans personnalisation, conserve le défaut et ne fabrique pas une configuration à publier', () => {
  assert.equal(registrationAvatar(null), null);
  assert.equal(resolveAccountAvatar(null, null, null), null);
  assert.deepEqual(registrationAvatar(defaultAvatar()), defaultAvatar());
});
test('Les métadonnées ne peuvent donner gratuitement un objet de boutique ou un déblocage', () => {
  const bad = {
    ...chosen(),
    kit: { item: 'kit-gold', name: 'TEST', number: 9 },
    accessories: ['acc-crown'],
    base: 'base-gold',
    background: 'bg-training',
    hairColor: 8,
    celebration: 'celeb-flip',
    rev: 999
  };
  const safe = registrationAvatar(bad);
  assert.deepEqual(restrictedIds(safe), []);
  assert.equal(safe.rev, 0);
  assert.equal(safe.skin, 4);
  assert.equal(safe.kit.name, 'TEST');
});
