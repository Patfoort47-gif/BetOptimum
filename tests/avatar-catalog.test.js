import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../avatar-config.js';
import { CATALOG } from '../shop.js';
import { CELEBRATIONS } from '../avatar.js';

test('chaque objet du catalogue avatar s’applique, se verrouille et se retire sans perte', () => {
  for (const item of CATALOG.filter(item => A.AVATAR_CATEGORIES.includes(item.category))) {
    const look = A.applyItem(A.defaultAvatar(), item.id);
    assert.ok(A.isWorn(look, item.id), item.id);
    assert.deepEqual(A.validateAvatar(look), []);
    assert.ok(!A.isWorn(A.stripUnowned(look, new Set()).config, item.id), item.id);
    assert.ok(A.isWorn(A.stripUnowned(look, new Set([item.id])).config, item.id), item.id);
    assert.ok(!A.isWorn(A.removeItem(look, item.id), item.id), item.id);
  }
});
test('toutes les célébrations possèdent une animation finie à chaque étape', () => {
  for (const [id] of A.CELEBRATIONS) {
    const spec = CELEBRATIONS[id]; assert.ok(spec?.dur > 0, id);
    for (let i = 0; i <= 20; i++) {
      const frame = spec.at(spec.dur * i / 20);
      assert.ok(Object.values(frame.pose).every(Number.isFinite), id);
      assert.ok(Number.isFinite(frame.rootY ?? 0), id);
    }
  }
});
