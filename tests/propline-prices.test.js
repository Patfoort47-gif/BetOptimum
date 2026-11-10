import test from 'node:test';
import assert from 'node:assert/strict';
import {
  priceInventory,
  PRICE_MARKETS,
  COMPOSITE_PRICE_MARKETS,
  REMAINING_PRICE_MARKETS,
  PERIOD_PRICE_MARKETS
} from '../scripts/propline-prices.mjs';
test('BET-170 : prix réels, budget borné, futurs seulement et aucune clé dans le rapport', async () => {
  const calls = [],
    stamp = '2026-11-04T20:00:00Z',
    key = 'secret-test';
  const report = await priceInventory({
    key,
    now: new Date('2026-11-03T12:00:00Z'),
    budget: 1,
    sports: { A: 'a', B: 'b' },
    fetchImpl: async (url, opts) => {
      calls.push(url);
      assert.equal(opts.headers['X-API-Key'], key);
      assert.equal(new URL(url).searchParams.get('markets'), PRICE_MARKETS.join(','));
      return {
        ok: true,
        json: async () => [
          { id: 'past', commence_time: '2026-01-01' },
          { id: 'live', live: true, commence_time: stamp },
          {
            id: 'e',
            commence_time: stamp,
            bookmakers: [
              {
                key: 'book_fr',
                markets: [
                  { key: 'correct_score', outcomes: [{ name: '1:0', price: 500 }] },
                  { key: 'unknown' }
                ]
              }
            ]
          }
        ]
      };
    }
  });
  assert.equal(calls.length, 1);
  assert.equal(report.requests, 1);
  assert.equal(report.samples.length, 1);
  assert.equal(report.samples[0].id, 'e');
  assert.equal(report.samples[0].bookmakers[0].markets.length, 1);
  assert.ok(!JSON.stringify(report).includes(key));
});
test('BET-170 : diagnostics restants bornés, période demandée distincte de la période renvoyée', async () => {
  for (const period of ['full', 'h1', 'h2']) {
    const markets = period === 'full' ? REMAINING_PRICE_MARKETS : PERIOD_PRICE_MARKETS;
    const r = await priceInventory({
      key: 'test',
      markets,
      period,
      budget: 1,
      sports: { A: 'a', B: 'b' },
      fetchImpl: async (url) => {
        assert.equal(new URL(url).searchParams.get('period'), period === 'full' ? null : period);
        return {
          ok: true,
          json: async () => [
            {
              id: 'e',
              commence_time: '2099-01-01',
              bookmakers: [{ key: 'b', markets: [{ key: markets[0], period: null, outcomes: [] }] }]
            }
          ]
        };
      }
    });
    assert.equal(r.requests, 1);
    assert.equal(r.requestedPeriod, period);
    assert.equal(r.samples[0].bookmakers[0].markets[0].period, null);
  }
  await assert.rejects(priceInventory({ key: 'test', period: 'overtime' }), /invalides/);
});
test('BET-170 : arrêt sur refus et aucun secret dans les erreurs', async () => {
  const r = await priceInventory({
    key: 'secret',
    fetchImpl: async () => ({ ok: false, status: 429 })
  });
  assert.equal(r.requests, 1);
  assert.match(r.failures[0], /429/);
  await assert.rejects(priceInventory({}), /PROPLINE_API_KEY absent/);
});
test('BET-170 : compteurs de quota sur liste fermée, aucun autre en-tête conservé', async () => {
  const r = await priceInventory({
    key: 'secret',
    budget: 1,
    sports: { A: 'a' },
    fetchImpl: async () => ({
      ok: true,
      headers: new Headers({
        'x-daily-limit': '1000',
        'x-daily-used': '123',
        'x-daily-remaining': '877',
        'x-daily-reset': 'bad',
        authorization: 'secret'
      }),
      json: async () => []
    })
  });
  assert.deepEqual(r.usage, [
    { league: 'A', 'x-daily-limit': 1000, 'x-daily-used': 123, 'x-daily-remaining': 877 }
  ]);
  assert.equal(JSON.stringify(r).includes('secret'), false);
});
test('BET-170 : les composites sont relevés sans activation et sans ajout de requêtes', async () => {
  const report = await priceInventory({
    key: 'secret',
    markets: COMPOSITE_PRICE_MARKETS,
    budget: 1,
    sports: { A: 'a' },
    now: new Date('2026-11-04T12:00:00Z'),
    fetchImpl: async (url) => {
      assert.equal(new URL(url).searchParams.get('markets'), COMPOSITE_PRICE_MARKETS.join(','));
      return {
        ok: true,
        json: async () => [
          {
            id: 'sample',
            commence_time: '2026-11-05T20:00:00Z',
            bookmakers: [
              {
                key: 'book',
                markets: [
                  {
                    key: 'result_btts',
                    description: 'Example',
                    outcomes: [{ name: 'Home / Yes', price_decimal: 2.5 }]
                  },
                  { key: 'h2h' }
                ]
              }
            ]
          }
        ]
      };
    }
  });
  assert.equal(report.requests, 1);
  assert.deepEqual(report.markets, COMPOSITE_PRICE_MARKETS);
  assert.equal(report.samples[0].bookmakers[0].markets.length, 1);
  assert.equal(report.samples[0].bookmakers[0].markets[0].outcomes[0].price_decimal, 2.5);
  let calls = 0;
  await assert.rejects(
    priceInventory({
      key: 'secret',
      markets: ['unknown'],
      fetchImpl: async () => {
        calls++;
      }
    }),
    /invalides/
  );
  assert.equal(calls, 0);
});
