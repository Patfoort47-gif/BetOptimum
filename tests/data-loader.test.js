import test from 'node:test';
import assert from 'node:assert/strict';
import { createJsonLoader } from '../src/core/data-loader.js';
test('les appels simultanés partagent une revalidation et les appels suivants revalident', async () => {
  const calls = [];
  let release;
  const load = createJsonLoader((url, options) => {
      calls.push({ url, options });
      return new Promise((resolve) => (release = resolve));
    }),
    first = load('data/fixtures.json'),
    second = load('data/fixtures.json');
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(calls[0].url, 'data/fixtures.json');
  assert.equal(calls[0].options.cache, 'no-cache');
  assert.equal(calls[0].options.signal.aborted, false);
  release({ ok: true, json: async () => ({ matches: [{ id: 'a' }] }) });
  assert.deepEqual(await first, { matches: [{ id: 'a' }] });
  const third = load('data/fixtures.json');
  await Promise.resolve();
  assert.equal(calls.length, 2);
  release({ ok: true, json: async () => ({ matches: [{ id: 'b' }] }) });
  assert.equal((await third).matches[0].id, 'b');
});
test('un échec HTTP ou JSON ne bloque pas une nouvelle tentative', async () => {
  let count = 0;
  const load = createJsonLoader(async () => {
    count++;
    return count === 1
      ? { ok: false, status: 503 }
      : count === 2
        ? {
            ok: true,
            json: async () => {
              throw new SyntaxError('JSON');
            }
          }
        : { ok: true, json: async () => [] };
  });
  await assert.rejects(load('archive'), /503/);
  await assert.rejects(load('archive'), /JSON/);
  assert.deepEqual(await load('archive'), []);
});
test('une archive lente ne bloque pas le calendrier', async () => {
  const load = createJsonLoader(async (url) =>
    url === 'archive' ? new Promise(() => {}) : { ok: true, json: async () => ({ ready: true }) }
  );
  load('archive');
  assert.deepEqual(await load('fixtures'), { ready: true });
});

test('BET-342 : transport et décodage bloqués expirent, annulent et permettent de réessayer', async () => {
  for (const body of [false, true]) {
    let count = 0,
      signal;
    const load = createJsonLoader(
      async (_, options) => {
        signal = options.signal;
        if (++count > 1) return { ok: true, json: async () => ['reprise'] };
        return body ? { ok: true, json: () => new Promise(() => {}) } : new Promise(() => {});
      },
      { timeoutMs: 10 }
    );
    const keepAlive = setTimeout(() => {}, 1000);
    try {
      const first = load('bloqué');
      assert.equal(first, load('bloqué'));
      await assert.rejects(first, /Délai/);
      assert.equal(signal.aborted, true);
      assert.deepEqual(await load('bloqué'), ['reprise']);
    } finally {
      clearTimeout(keepAlive);
    }
  }
});

test('BET-370 : une requête partagée marque une seule fois la réception et le parsing', async () => {
  const marks = [];
  const load = createJsonLoader(async () => ({ ok: true, text: async () => '{"matches":[]}' }));
  const first = load('calendrier', (phase) => marks.push(phase));
  assert.equal(
    first,
    load('calendrier', (phase) => marks.push(phase))
  );
  assert.deepEqual(await first, { matches: [] });
  assert.deepEqual(marks, ['requete', 'corps-recu', 'json-parse']);
});
