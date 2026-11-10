import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decimalPrice,
  matchPropLineEvent,
  propLineOffers,
  supplementOffers,
  collectPropLine
} from '../scripts/propline-odds.mjs';
import { mergeCachedOffers, summarizeOffers } from '../src/model/odds-cache.js';
const now = Date.parse('2026-11-02T12:00:00Z'),
  stamp = new Date(now - 60000).toISOString();
const match = {
  id: 'espn-123',
  league: 'Premier League',
  home: 'Newcastle United',
  away: 'Everton',
  kickoff: new Date(now + 3600000).toISOString()
};
const event = {
  espn_event_id: '123',
  home_team: match.home,
  away_team: match.away,
  commence_time: match.kickoff,
  bookmakers: [
    {
      key: 'betclic',
      markets: [
        {
          key: 'totals',
          last_update: stamp,
          outcomes: [
            { name: 'Over', point: 3.5, price: -110 },
            { name: 'Over', point: 2.5, price: -125 }
          ]
        },
        { key: 'both_teams_to_score', last_update: stamp, outcomes: [{ name: 'Yes', price: 120 }] }
      ]
    }
  ]
};
test('PropLine : conversion américaine explicite, prix masqués rejetés', () => {
  assert.equal(decimalPrice({ price: -125 }), 1.8);
  assert.equal(decimalPrice({ price: 120 }), 2.2);
  assert.equal(decimalPrice({ price: -125, price_decimal: 1.79 }), 1.79);
  for (const price of [null, 0, 1.9, NaN]) assert.equal(decimalPrice({ price }), null);
});
test('PropLine : identité, date et orientation sans rapprochement ambigu', () => {
  assert.equal(matchPropLineEvent(match, [event]), event);
  assert.equal(matchPropLineEvent(match, [event, event]), null);
  assert.equal(
    matchPropLineEvent(match, [
      { ...event, commence_time: new Date(now + 86400000).toISOString() }
    ]),
    null
  );
  assert.equal(matchPropLineEvent(match, [{ ...event, live: true }]), null);
  assert.equal(matchPropLineEvent(match, [{ ...event, espn_event_id: '999' }]), null);
  assert.equal(
    matchPropLineEvent(match, [
      { ...event, espn_event_id: null, home_team: match.away, away_team: match.home }
    ]),
    null
  );
});
test('PropLine : une ligne par bookmaker FR et moyennes sans doublons', () => {
  const extra = propLineOffers(event, now);
  assert.equal(extra[0].over, 1.8);
  assert.equal(extra[0].btts, 2.2);
  const offers = mergeCachedOffers(
    supplementOffers([{ key: 'betclic_fr', name: 'Betclic (FR)', home: 2, over: 1.9 }], extra),
    [{ key: 'betclic_fr', name: 'Betclic (FR)', btts: 1.6 }]
  );
  assert.equal(offers.length, 1);
  assert.equal(offers[0].over, 1.9);
  assert.equal(offers[0].btts, 2.2);
  assert.equal(offers[0].bttsCached, undefined);
  assert.equal(offers[0].bttsSource, 'PropLine');
  assert.equal(summarizeOffers(offers).counts.btts, 1);
  const cached = mergeCachedOffers([], offers);
  assert.equal(cached[0].bttsSource, 'PropLine');
  assert.equal(cached[0].bttsUpdatedAt, stamp);
});
test('PropLine : exclut périodes, totaux équipe, cotes anciennes et retraits', () => {
  for (const patch of [
    { period: 'h1' },
    { team: 'Newcastle United' },
    { last_update: new Date(now - 7200000).toISOString() },
    {
      outcomes: [
        {
          name: 'Over',
          point: 2.5,
          price: -125,
          last_seen_at: new Date(now - 120000).toISOString()
        }
      ]
    }
  ]) {
    const e = {
      ...event,
      bookmakers: [{ key: 'winamax', markets: [{ ...event.bookmakers[0].markets[0], ...patch }] }]
    };
    assert.deepEqual(propLineOffers(e, now), []);
  }
});
test('PropLine : un appel par sport et panne isolée', async () => {
  let calls = 0;
  const fetchImpl = async (url, options) => {
    calls++;
    assert.equal(options.headers['X-API-Key'], 'test');
    assert.equal(new URL(url).searchParams.get('markets'), 'h2h,totals,both_teams_to_score');
    return { ok: true, json: async () => [event] };
  };
  const result = await collectPropLine(
    [
      match,
      { ...match, id: 'other' },
      { ...match, kickoff: new Date(now + 49 * 3600000).toISOString() }
    ],
    { 'Premier League': 'soccer_epl' },
    { key: 'test', now, fetchImpl }
  );
  assert.equal(calls, 1);
  assert.equal(result.offersByMatch.get(match.id)[0].btts, 2.2);
  assert.equal(result.requested, 1);
  const absent = await collectPropLine(
    [match],
    { 'Premier League': 'soccer_epl' },
    { key: '', now, fetchImpl }
  );
  assert.equal(absent.requested, 0);
  const failed = await collectPropLine(
    [match],
    { 'Premier League': 'soccer_epl' },
    {
      key: 'test',
      now,
      fetchImpl: async () => {
        throw Error('secret URL');
      }
    }
  );
  assert.equal(failed.failures.length, 1);
  assert.equal(JSON.stringify(failed).includes('secret URL'), false);
});
test('BET-152 : 1N2, régions distinctes, doublons et exchanges', () => {
  const market = {
    key: 'h2h',
    last_update: stamp,
    outcomes: [
      { name: match.home, price: 110 },
      { name: 'Draw', price: 250 },
      { name: match.away, price: 200 }
    ]
  };
  const book = (key) => ({ key, title: 'Même nom', markets: [market] });
  const offers = propLineOffers(
    {
      ...event,
      bookmakers: ['unibet_fr', 'unibet_uk', 'unibet_fr', 'betfair_ex_eu', 'polymarket'].map(book)
    },
    now
  );
  assert.equal(offers.length, 2);
  assert.equal(offers[0].key, 'unibet_fr');
  assert.equal(offers[1].key, 'unibet_uk');
  assert.equal(offers[0].home, 2.1);
  assert.equal(offers[0].draw, 3.5);
  assert.equal(offers[0].away, 3);
  assert.equal(summarizeOffers(offers).counts.home, 2);
  assert.equal(
    matchPropLineEvent(match, [{ ...event, home_team: match.away, away_team: match.home }]),
    null
  );
});
test('BET-152 : plafond par collecte et arrêt au quota sans tentative répétée', async () => {
  const matches = [match, { ...match, id: 'espn-456', league: 'Ligue 1' }],
    sports = { 'Premier League': 'soccer_epl', 'Ligue 1': 'soccer_france_ligue_one' };
  let calls = 0;
  const response = async (url) => {
    calls++;
    assert.equal(new URL(url).searchParams.has('bookmakers'), false);
    return { ok: true, json: async () => [event] };
  };
  const bounded = await collectPropLine(matches, sports, {
    key: 'test',
    now,
    fetchImpl: response,
    maxRequests: 1
  });
  assert.equal(calls, 1);
  assert.equal(bounded.failures.length, 1);
  calls = 0;
  const limited = await collectPropLine(matches, sports, {
    key: 'test',
    now,
    fetchImpl: async () => {
      calls++;
      return { ok: false, status: 429 };
    }
  });
  assert.equal(calls, 1);
  assert.match(limited.failures[0], /429/);
});
test('BET-170 : exchanges et DFS documentés exclus même sans champ type', () => {
  const market = { key: 'h2h', last_update: stamp, outcomes: [{ name: match.home, price: 110 }] };
  const keys = [
    'novig',
    'prophetx',
    'sxbet',
    'betdaq',
    'prizepicks',
    'sleeper',
    'dabble',
    'parlayplay',
    'draftkings_pick6',
    'novig_us',
    'draftkings'
  ];
  assert.deepEqual(
    propLineOffers(
      { ...event, bookmakers: keys.map((key) => ({ key, markets: [market] })) },
      now
    ).map((b) => b.key),
    ['draftkings']
  );
});
test('BET-262 : conserve tous les marchés de la Ligue des nations à J+3 et J+7 dans un seul appel', async () => {
  const matches = [72, 168].map((hours, i) => ({
    ...match,
    id: `espn-${800 + i}`,
    league: 'Ligue des nations',
    kickoff: new Date(now + hours * 3600000).toISOString()
  }));
  const events = matches.map((m) => ({
    ...event,
    espn_event_id: m.id.slice(5),
    commence_time: m.kickoff,
    bookmakers: [
      {
        key: 'book',
        markets: [
          ...event.bookmakers[0].markets,
          { key: 'h2h', last_update: stamp, outcomes: [{ name: m.home, price: 110 }] },
          { key: 'double_chance', last_update: stamp, outcomes: [{ name: '1X', price: -200 }] },
          { key: 'correct_score', last_update: stamp, outcomes: [{ name: '2-1', price: 800 }] }
        ]
      }
    ]
  }));
  let calls = 0;
  const result = await collectPropLine(
    [
      ...matches,
      { ...matches[0], id: 'past', kickoff: new Date(now - 1).toISOString() },
      { ...matches[0], id: 'completed', completed: true },
      { ...matches[1], id: 'outside', kickoff: new Date(now + 168 * 3600000 + 1).toISOString() }
    ],
    { 'Ligue des nations': 'soccer_uefa_nations_league' },
    {
      key: 'test',
      now,
      stage: 3,
      fetchImpl: async () => {
        calls++;
        return { ok: true, json: async () => events };
      }
    }
  );
  assert.equal(calls, 1);
  assert.equal(result.offersByMatch.size, 2);
  for (const m of matches) {
    const offer = result.offersByMatch.get(m.id)[0];
    assert.equal(offer.home, 2.1);
    assert.equal(offer.over, 1.8);
    assert.equal(offer.btts, 2.2);
    assert.equal(offer.homeDraw, 1.5);
    assert.equal(offer.score2_1, 9);
    assert.equal(offer.score2_1UpdatedAt, stamp);
  }
});
