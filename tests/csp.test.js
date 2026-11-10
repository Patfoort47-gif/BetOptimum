import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { imageFallback } from '../src/core/image-fallback.js';
test('BET-303 : CSP précoce, scripts locaux et pas de gestionnaires inline', async () => {
  const html = await readFile('index.html', 'utf8'),
    policy = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('<script'));
  assert.match(policy, /script-src 'self';/);
  assert.match(policy, /script-src-attr 'none'/);
  assert.doesNotMatch(policy, /unsafe-eval|script-src[^;]*unsafe-inline|\*\.supabase/);
  for (const file of [
    'app.js',
    'src/avatar/avatar-view.js',
    'src/matches/details.js',
    'index.html'
  ])
    assert.doesNotMatch(await readFile(file, 'utf8'), /\son(?:error|load|click|submit)=['"]/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /base-uri 'none'/);
});
test('BET-303 : repli des logos sans script inline', () => {
  const calls = [],
    image = {
      dataset: { imageFallback: 'logo' },
      parentNode: { classList: { add: (cls) => calls.push(cls) } },
      remove: () => calls.push('remove')
    };
  imageFallback(image);
  assert.deepEqual(calls, ['no-logo', 'remove']);
  imageFallback({});
  imageFallback({
    dataset: { imageFallback: 'remove' },
    parentNode: { remove: () => calls.push('parent') }
  });
  assert.equal(calls.at(-1), 'parent');
});
