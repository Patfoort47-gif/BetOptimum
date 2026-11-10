import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readFixtureCache,
  writeFixtureCache,
  clearLegacyFixtureCache
} from '../src/core/fixture-cache.js';
test('BET-293 : le cache du calendrier utilise Cache API et supprime seulement l’ancienne clé', async () => {
  const entries = new Map(),
    original = globalThis.caches;
  globalThis.caches = {
    open: async () => ({
      match: async (key) => entries.get(key),
      put: async (key, response) => entries.set(key, response)
    })
  };
  try {
    const data = { matches: [{ id: 'm' }] };
    assert.equal(await writeFixtureCache(data), true);
    assert.deepEqual(await readFixtureCache(), data);
    const removed = [];
    clearLegacyFixtureCache({ removeItem: (key) => removed.push(key) });
    assert.deepEqual(removed, ['betmaster-fixtures-cache-v2']);
  } finally {
    globalThis.caches = original;
  }
});
test('BET-291 : un stockage interdit ne bloque pas le démarrage ni le thème', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('Stockage interdit');
    }
  });
  try {
    assert.doesNotThrow(() => clearLegacyFixtureCache());
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});
