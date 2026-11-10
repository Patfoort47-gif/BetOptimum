import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compositeSelection } from '../scripts/propline-composites.mjs';
import { propLineOffers, collectPropLine } from '../scripts/propline-odds.mjs';
import { auditComposites } from '../scripts/check-markets-composites.mjs';
import { quoteAvailable } from '../quote-policy.js';
const report = JSON.parse(
  readFileSync(new URL('../docs/evidence/propline-composites-2026-11-04.json', import.meta.url))
);
const now = Date.parse(report.generatedAt),
  event = report.samples[0],
  market = event.bookmakers[0].markets[0],
  outcome = market.outcomes[0];
test('BET-170 : prix composites réels, cinq familles et aucun choix à dix bookmakers', () => {
  const result = auditComposites(report);
  assert.equal(result.providerFormatsValid, true);
  assert.equal(result.priceThresholdSatisfied, false);
  assert.deepEqual(
    Object.values(result.coverage).map((c) => [
      c.matches,
      c.selections,
      c.maxBookmakersPerSelection,
      c.qualifiedSelections
    ]),
    [
      [16, 32, 4, 0],
      [12, 24, 1, 0],
      [16, 330, 4, 0],
      [16, 48, 3, 0],
      [16, 282, 4, 0]
    ]
  );
  assert.equal(compositeSelection(event, market, outcome), 'comboBttsYesOver25');
  for (const e of report.samples) {
    assert.deepEqual(propLineOffers(e, now, 3), []);
    const offers = propLineOffers(e, now, 4);
    for (const o of offers)
      for (const key of Object.keys(o).filter(
        (k) => k.startsWith('combo') && !/(UpdatedAt|Source)$/.test(k)
      ))
        assert.equal(
          quoteAvailable(
            {
              bookmakerOffers: offers,
              odds: { [key]: o[key] },
              realOddsMarkets: [key],
              marketValidUntil: { [key]: new Date(Date.now() + 3600000).toISOString() }
            },
            key
          ),
          false
        );
  }
});
test('BET-170 : refuse lignes contradictoires, périodes, identités ambiguës et variantes opaques', () => {
  for (const patch of [
    { point: null },
    { point: '2.5' },
    { point: 3.5 },
    { name: 'Yes & Over 2.25' },
    { name: 'Yes & Over 2.5 & Boost' },
    { player_id: '42' },
    { period: 'h1' },
    { team: 'Everton' },
    { side: 'home' }
  ])
    assert.equal(compositeSelection(event, market, { ...outcome, ...patch }), null);
  for (const patch of [
    { period: 'h1' },
    { team: 'Everton' },
    { description: 'Both Teams To Score & Total Goals 3.5' },
    { key: 'bet_builder_boost' }
  ])
    assert.equal(compositeSelection(event, { ...market, ...patch }, outcome), null);
  const m = { key: 'double_chance_btts', description: 'Double Chance & Both Teams To Score' },
    o = { name: 'Everton/Everton & Yes' };
  assert.equal(compositeSelection(event, m, o), null);
  assert.equal(
    compositeSelection({ ...event, away_team: event.home_team }, m, { name: 'Everton/Draw & Yes' }),
    null
  );
});
test('BET-170 : suspension, retrait, prix périmé et régions conservent les protections', () => {
  const offer = (m, o) =>
    propLineOffers(
      {
        ...event,
        bookmakers: [
          { key: 'test', markets: [{ ...market, ...m, outcomes: [{ ...outcome, ...o }] }] }
        ]
      },
      now,
      4
    );
  for (const patch of [
    { suspended_at: report.generatedAt },
    { status: 'removed' },
    { redacted: true },
    { restricted: true },
    { payout_multiplier: 2 },
    { dfs_odds_type: 'boost' },
    { last_seen_at: '2026-11-01T00:00:00Z' }
  ])
    assert.deepEqual(offer({}, patch), []);
  assert.deepEqual(offer({ last_update: '2026-11-01T00:00:00Z' }, {}), []);
  assert.deepEqual(offer({ suspended_at: report.generatedAt }, {}), []);
});
test('BET-170 : collecte étape 4 groupée, aucun appel supplémentaire et seuil inchangé', async () => {
  let calls = 0;
  const result = await collectPropLine(
    [
      {
        id: 'espn-test',
        home: event.home_team,
        away: event.away_team,
        kickoff: new Date(now + 3600000).toISOString(),
        league: 'Test'
      }
    ],
    { Test: 'soccer_test' },
    {
      key: 'test',
      stage: 4,
      now,
      fetchImpl: async (url) => {
        calls++;
        const keys = new URL(url).searchParams.get('markets').split(',');
        for (const key of report.markets) assert(keys.includes(key));
        return {
          ok: true,
          json: async () => [{ ...event, commence_time: new Date(now + 3600000).toISOString() }]
        };
      }
    }
  );
  assert.equal(calls, 1);
  assert(result.offersByMatch.get('espn-test').length > 0);
});
