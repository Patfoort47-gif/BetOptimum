import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { waitForPagesArtifact } from '../scripts/wait-pages-artifact.mjs';
const artifact = { id: 14493745554, name: 'github-pages', size: 19642692 };
const options = { artifactId: String(artifact.id), sleep: async () => {}, log: () => {} };
test('BET-363 : upload terminé mais liste initialement vide, puis confirmation stable', async () => {
  let calls = 0;
  const sleeps = [];
  const result = await waitForPagesArtifact(
    async () => ({ artifacts: ++calls < 3 ? [] : [artifact] }),
    { ...options, sleep: async (ms) => sleeps.push(ms) }
  );
  assert.equal(result.id, artifact.id);
  assert.equal(calls, 4);
  assert.deepEqual(sleeps, [2000, 4000, 8000]);
});
test('BET-363 : une lecture vide intermédiaire exige deux nouvelles confirmations', async () => {
  let calls = 0;
  await waitForPagesArtifact(async () => ({ artifacts: ++calls === 2 ? [] : [artifact] }), options);
  assert.equal(calls, 4);
});
test('BET-363 : absence durable arrêtée au plafond sans déployer ni rejouer la collecte', async () => {
  let calls = 0;
  const sleeps = [];
  await assert.rejects(
    waitForPagesArtifact(
      async () => {
        calls++;
        return { artifacts: [] };
      },
      { ...options, sleep: async (ms) => sleeps.push(ms) }
    ),
    /Aucun déploiement lancé/
  );
  assert.equal(calls, 6);
  assert.equal(
    sleeps.reduce((a, b) => a + b, 0),
    60000
  );
});
test('BET-363 : ID erroné, doublons, artefact vide ou expiré rejetés', async () => {
  for (const artifacts of [
    [{ ...artifact, id: 1 }],
    [artifact, artifact],
    [{ ...artifact, size: 0 }],
    [{ ...artifact, expired: true }]
  ])
    await assert.rejects(waitForPagesArtifact(async () => ({ artifacts }), options));
  let calls = 0;
  await assert.rejects(
    waitForPagesArtifact(
      async () => {
        calls++;
        return { artifacts: [artifact] };
      },
      { ...options, artifactId: '' }
    ),
    /Identifiant/
  );
  assert.equal(calls, 0);
});
test('BET-363 : refus API propagé, sans boucle de masquage', async () => {
  let calls = 0;
  await assert.rejects(
    waitForPagesArtifact(async () => {
      calls++;
      throw new Error('HTTP 403');
    }, options),
    /403/
  );
  assert.equal(calls, 1);
});
test('BET-363 : les trois publications partagent la protection et le calendrier garde sa condition', async () => {
  for (const name of ['pages', 'update-fixtures', 'update-results']) {
    const text = await readFile(
      new URL(`../.github/workflows/${name}.yml`, import.meta.url),
      'utf8'
    );
    assert.match(text, /uses: \.\/\.github\/actions\/publish-pages/);
    assert.doesNotMatch(text, /uses: actions\/deploy-pages@/);
    if (name === 'update-fixtures')
      assert.match(text, /id: deployment\n\s+if: steps\.schedule\.outputs\.run == 'true'/);
  }
  const action = await readFile(
    new URL('../.github/actions/publish-pages/action.yml', import.meta.url),
    'utf8'
  );
  assert.ok(
    action.indexOf('uses: ./.github/actions/wait-pages-artifact') <
      action.indexOf('uses: actions/deploy-pages')
  );
  assert.match(action, /steps\.upload\.outputs\.artifact_id/);
});
