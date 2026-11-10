import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdmin } from '../scripts/supabase-admin.mjs';
import { payGeneralSeasons, updateStreaks } from '../scripts/token-engine.mjs';

test('la synchronisation conserve le fuseau de Paris dans les filtres REST des paris et défis', async () => {
  const queries = [];
  const admin = createAdmin(
    {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key-without-real-access'
    },
    async (url) => {
      queries.push(new URL(url));
      return { ok: true, text: async () => '[]' };
    }
  );
  assert.equal(await updateStreaks(admin, new Date('2026-10-30T12:00:00Z'), '2026-2027'), 0);
  for (const [table, column] of [
    ['bets', 'settled_at'],
    ['daily_picks', 'placed_at']
  ]) {
    const query = queries.find((url) => url.pathname === `/rest/v1/${table}`);
    assert.equal(query.searchParams.get(column), 'gte.2026-07-01T00:00:00+02:00');
    assert.equal(
      new Date(query.searchParams.get(column).slice(4)).toISOString(),
      '2026-06-30T22:00:00.000Z'
    );
    assert.equal(query.searchParams.get('select'), table === 'bets' ? 'id,odds' : 'id,odd');
    assert.equal(query.searchParams.get('limit'), '1000');
  }
});

// BET-164 : la clôture annuelle (saisons BET-78 « 2026-2027 ») ne doit pas planter et doit filtrer depuis le 1er juillet.
for (const [season, now, betsFrom, picksFrom] of [
  ['2026-2027', '2027-07-01T00:30:00Z', '2026-06-28T00:00:00.000Z', '2026-07-01'],
  ['2026-10', '2026-11-01T00:30:00Z', '2026-09-28T00:00:00.000Z', '2026-10-01']
]) {
  test(`la paie de fin de saison ${season} filtre les paris et les défis depuis le début de la saison`, async () => {
    const queries = [];
    const admin = createAdmin(
      {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key-without-real-access'
      },
      async (url) => {
        const parsed = new URL(url);
        queries.push(parsed);
        return {
          ok: true,
          text: async () =>
            JSON.stringify(parsed.pathname === '/rest/v1/league_seasons' ? [{ season }] : [])
        };
      }
    );
    assert.equal(await payGeneralSeasons(admin, new Date(now)), 0);
    assert.equal(
      queries.find((url) => url.pathname === '/rest/v1/bets').searchParams.get('settled_at'),
      `gte.${betsFrom}`
    );
    assert.equal(
      queries.find((url) => url.pathname === '/rest/v1/daily_picks').searchParams.get('day'),
      `gte.${picksFrom}`
    );
  });
}
