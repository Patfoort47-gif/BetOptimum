import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createClient } from '../vendor/supabase-js-2.81.1.js';
test('BET-302 : artefacts figés, contrôlés et sans imports CDN', async () => {
  const hashes = JSON.parse(await readFile('vendor/SHA256.json', 'utf8'));
  for (const [file, hash] of Object.entries(hashes)) {
    const source = await readFile('vendor/' + file);
    assert.equal(createHash('sha256').update(source).digest('hex'), hash);
    assert.doesNotMatch(source.toString(), /(?:import\s*\(|from\s*)['"]https:\/\//);
  }
  assert.doesNotMatch(await readFile('src/account/account.js', 'utf8'), /cdn\.jsdelivr/);
  assert.doesNotMatch(await readFile('src/avatar/avatar.js', 'utf8'), /cdn\.jsdelivr/);
});
test('BET-302 : vrai SDK local, connexion, inscription, récupération et Google sur transport simulé', async () => {
  const calls = [],
    user = {
      id: '00000000-0000-0000-0000-000000000001',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'demo@example.test',
      identities: [{ id: 'demo' }]
    },
    fetch = async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(init.body || '{}') });
      const data = String(url).includes('/token')
        ? {
            user,
            access_token: 'demo',
            refresh_token: 'refresh',
            expires_in: 3600,
            token_type: 'bearer'
          }
        : String(url).includes('/signup')
          ? { user, session: null }
          : {};
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    },
    client = createClient('https://example.supabase.co', 'public-test-key', {
      global: { fetch },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
  assert.equal(
    (await client.auth.signInWithPassword({ email: user.email, password: 'not-a-real-password' }))
      .error,
    null
  );
  assert.equal(
    (await client.auth.signUp({ email: user.email, password: 'not-a-real-password' })).error,
    null
  );
  assert.equal(
    (await client.auth.resetPasswordForEmail(user.email, { redirectTo: 'https://example.test/' }))
      .error,
    null
  );
  const oauth = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { skipBrowserRedirect: true, redirectTo: 'https://example.test/' }
  });
  assert.equal(oauth.error, null);
  assert.match(oauth.data.url, /provider=google/);
  assert.ok(calls.some((c) => c.url.includes('/token?grant_type=password')));
  assert.ok(calls.some((c) => c.url.includes('/signup')));
  assert.ok(calls.some((c) => c.url.includes('/recover')));
  await client.auth.signOut({ scope: 'local' });
});
