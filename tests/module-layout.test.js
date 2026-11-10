import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { preparePages } from '../scripts/prepare-pages.mjs';
test('BET-314 : une ancienne URL publique charge le même modèle que le module rangé', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bet-modules-'));
  try {
    await preparePages(pathToFileURL(dir + '/'));
    const legacy = await import(pathToFileURL(join(dir, 'model.js')).href),
      current = await import(pathToFileURL(join(dir, 'src/model/model.js')).href);
    assert.equal(legacy.analyseMatch, current.analyseMatch);
    const assets = JSON.parse(await readFile(join(dir, 'offline-assets.json'), 'utf8'));
    assert.ok(assets.includes('model.js'));
    assert.ok(assets.includes('src/model/model.js'));
    await assert.rejects(readFile(join(dir, 'src/notifications/notification-delivery.js')), {
      code: 'ENOENT'
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
