import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdmin } from './scripts/supabase-admin.mjs';
import { updateStreaks } from './scripts/token-engine.mjs';

test('la synchronisation conserve le fuseau de Paris dans les filtres REST des paris et défis', async () => {
  const queries = [];
  const admin = createAdmin({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-key-without-real-access' }, async url => {
    queries.push(new URL(url));
    return { ok: true, text: async () => '[]' };
  });
  assert.equal(await updateStreaks(admin, new Date('2026-10-30T12:00:00Z'), '2026-2027'), 0);
  for (const [table, column] of [['bets', 'settled_at'], ['daily_picks', 'placed_at']]) {
    const query = queries.find(url => url.pathname === `/rest/v1/${table}`);
    assert.equal(query.searchParams.get(column), 'gte.2026-07-01T00:00:00+02:00');
    assert.equal(new Date(query.searchParams.get(column).slice(4)).toISOString(), '2026-06-30T22:00:00.000Z');
    assert.equal(query.searchParams.get('select'), table === 'bets' ? 'id,odds' : 'id,odd');
    assert.equal(query.searchParams.get('limit'), '1000');
  }
});
