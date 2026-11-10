import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  aggregate,
  familyOf,
  inventory,
  parseMarkets,
  periodWarnings,
  renderMarkdown,
  MAX_BUDGET
} from '../scripts/propline-inventory.mjs';

// BET-154 · inventaire PropLine : faux fournisseur, aucune requête réelle.
const KEY = 'cle-de-test-ne-doit-jamais-sortir';
const fakeFetch =
  (routes, calls = []) =>
  async (url, options) => {
    calls.push({ url, key: options.headers['X-API-Key'] });
    const path = new URL(url).pathname + new URL(url).search,
      hit = Object.entries(routes).find(([pattern]) => path.endsWith(pattern));
    if (!hit) return { ok: true, json: async () => [] };
    const [, value] = hit;
    return typeof value === 'number'
      ? { ok: false, status: value, json: async () => ({}) }
      : { ok: true, json: async () => value };
  };

test('les clés fournisseur sont rangées dans une famille proposée', () => {
  assert.equal(familyOf('h2h'), 'Résultat');
  assert.equal(familyOf('totals'), 'Buts');
  assert.equal(familyOf('both_teams_to_score'), 'Équipes');
  assert.equal(familyOf('player_goal_scorer_anytime'), 'Joueurs');
  assert.equal(familyOf('alternate_totals_corners'), 'Corners');
  assert.equal(familyOf('player_cards'), 'Joueurs');
  assert.equal(familyOf('total_cards'), 'Cartons');
  assert.equal(familyOf('2plus_goals'), 'Joueurs');
  assert.equal(familyOf('3plus_goals'), 'Joueurs');
  assert.equal(familyOf('winning_margin'), 'Résultat');
  assert.equal(familyOf('h2h', 'h1'), 'Périodes · Résultat');
  assert.equal(familyOf('mystere'), 'Autre');
});

test('le format fournisseur réel conserve outcomes_count sans transformer une absence en zéro', async () => {
  const report = JSON.parse(
    await readFile(
      new URL('../docs/evidence/propline-inventory-2026-11-03.json', import.meta.url),
      'utf8'
    )
  );
  // L'extrait d'origine est tronqué à 800 caractères : ses deux premiers objets sont complets.
  const sample = JSON.parse(
    '[' + report.raw.full.sample.match(/^\[(\{[^}]+\},\{[^}]+\})/)[1] + ']'
  );
  assert.deepEqual(parseMarkets(sample), [
    { key: '2plus_goals', outcomes: 125 },
    { key: '3plus_goals', outcomes: 6 }
  ]);
  assert.deepEqual(
    parseMarkets([
      { key: 'h2h', outcomes_count: 0 },
      { key: 'totals', outcomes_count: null },
      { key: 'spreads', outcomes_count: -1 }
    ]),
    [
      { key: 'h2h', outcomes: 0 },
      { key: 'totals', outcomes: null },
      { key: 'spreads', outcomes: null }
    ]
  );
});

test('un catalogue répété sur plusieurs périodes est signalé sans annoncer leur disponibilité', async () => {
  const report = await inventory({
    key: KEY,
    sports: { 'Ligue 1': 'soccer_france_ligue_one' },
    fetchImpl: fakeFetch({
      '/events': [{ id: 'e1' }],
      '/events/e1/markets': [
        { key: 'h2h', outcomes_count: 9 },
        { key: 'totals', outcomes_count: 12 }
      ],
      '/events/e1/markets?period=h1': [
        { key: 'totals', outcomes_count: 12 },
        { key: 'h2h', outcomes_count: 9 }
      ],
      '/events/e1/markets?period=h2': [{ key: 'h2h', outcomes_count: 3 }]
    })
  });
  assert.equal(report.requests, 4);
  assert.deepEqual(report.warnings, ['e1 : catalogue h1 identique à full, période non confirmée']);
  assert.match(renderMarkdown(report), /Périodes à confirmer/);
  assert.deepEqual(
    periodWarnings([{ eventId: 'e2', period: 'h1', markets: [{ key: 'h2h', outcomes: 3 }] }]),
    []
  );
});

test('les formats de réponse /markets acceptés donnent les mêmes lignes', () => {
  const expected = [
    { key: 'h2h', outcomes: 3 },
    { key: 'totals', outcomes: 2 }
  ];
  assert.deepEqual(
    parseMarkets([
      { key: 'h2h', outcomes: 3 },
      { market: 'totals', outcome_count: 2 }
    ]),
    expected
  );
  assert.deepEqual(parseMarkets({ markets: { h2h: 3, totals: 2 } }), expected);
  assert.deepEqual(parseMarkets({ h2h: 3, totals: 2 }), expected);
  assert.deepEqual(parseMarkets(['h2h']), [{ key: 'h2h', outcomes: null }]);
  assert.deepEqual(parseMarkets([{ key: '<script>' }]), []);
  assert.equal(parseMarkets('texte'), null);
  assert.deepEqual(parseMarkets({ event_id: 'e1', bookmakers: [], home_team: 'A' }), [
    { key: 'bookmakers', outcomes: 0 }
  ]);
  assert.deepEqual(parseMarkets({ markets: [] }), []);
});

test('l’agrégation compte matchs et compétitions par clé et période, et signale les marchés déjà collectés', () => {
  const rows = aggregate([
    {
      league: 'Ligue 1',
      eventId: 'a',
      period: 'full',
      markets: [
        { key: 'h2h', outcomes: 3 },
        { key: 'corners_totals', outcomes: 12 }
      ]
    },
    { league: 'Serie A', eventId: 'b', period: 'full', markets: [{ key: 'h2h', outcomes: 3 }] },
    { league: 'Serie A', eventId: 'b', period: 'h1', markets: [{ key: 'h2h', outcomes: 3 }] }
  ]);
  const h2h = rows.find((row) => row.key === 'h2h' && row.period === 'full'),
    half = rows.find((row) => row.key === 'h2h' && row.period === 'h1');
  assert.deepEqual([h2h.events, h2h.leagues, h2h.supported], [2, ['Ligue 1', 'Serie A'], true]);
  assert.equal(half.supported, false);
  assert.equal(rows.find((row) => row.key === 'corners_totals').family, 'Corners');
  const counts = aggregate([
    {
      league: 'Ligue 1',
      eventId: 'c',
      period: 'full',
      markets: [
        { key: 'h2h', outcomes: 0 },
        { key: 'totals', outcomes: null }
      ]
    }
  ]);
  assert.equal(counts.find((row) => row.key === 'h2h').maxOutcomes, 0);
  assert.equal(counts.find((row) => row.key === 'totals').maxOutcomes, null);
});

test('l’inventaire interroge événements puis marchés par période, sans jamais exposer la clé', async () => {
  const calls = [];
  const report = await inventory({
    key: KEY,
    sports: { 'Ligue 1': 'soccer_france_ligue_one' },
    now: new Date('2026-11-03T10:00:00Z'),
    fetchImpl: fakeFetch(
      {
        '/sports/soccer_france_ligue_one/events': [
          { id: 'past', commence_time: '2026-11-01T20:00:00Z' },
          { id: 'e1', commence_time: '2026-11-05T20:00:00Z' }
        ],
        '/events/e1/markets': [
          { key: 'h2h', outcomes: 3 },
          { key: 'player_goal_scorer_anytime', outcomes: 40 }
        ],
        '/events/e1/markets?period=h1': { h2h: 3 },
        '/events/e1/markets?period=h2': { h2h: 3 }
      },
      calls
    )
  });
  assert.equal(report.requests, 4);
  assert.ok(calls.every((call) => call.key === KEY && !call.url.includes(KEY)));
  assert.ok(!calls.some((call) => call.url.includes('/events/past/')));
  assert.equal(report.events, 1);
  assert.equal(report.samples.length, 3);
  assert.equal(report.samples[0].eventId, 'e1');
  assert.deepEqual(report.leagues, ['Ligue 1']);
  const text = JSON.stringify(report) + renderMarkdown(report);
  assert.ok(!text.includes(KEY));
  assert.match(
    renderMarkdown(report),
    /\| Joueurs \| full \| `player_goal_scorer_anytime` \| non \| 1 \| 40 \| Ligue 1 \|/
  );
});

test('l’inventaire respecte le budget et s’arrête au premier refus de quota', async () => {
  const calls = [];
  const capped = await inventory({
    key: KEY,
    budget: 3,
    fetchImpl: fakeFetch({ '/events': [{ id: 'x' }, { id: 'y' }] }, calls)
  });
  assert.equal(capped.requests, 3);
  assert.ok(capped.failures.includes('Budget de requêtes atteint'));
  const huge = await inventory({ key: KEY, budget: 9999, fetchImpl: fakeFetch({}) });
  assert.ok(huge.budget <= MAX_BUDGET);
  const refused = [];
  const limited = await inventory({
    key: KEY,
    fetchImpl: fakeFetch({ '/sports/soccer_epl/events': 429 }, refused)
  });
  assert.equal(refused.length, 1);
  assert.deepEqual(limited.failures, ['Premier League : HTTP 429']);
  await assert.rejects(inventory({ key: '' }), /PROPLINE_API_KEY absent/);
});

test('une réponse /markets au format imprévu est conservée en extrait brut pour établir la matrice', async () => {
  const report = await inventory({
    key: KEY,
    sports: { 'Ligue 1': 'soccer_france_ligue_one' },
    fetchImpl: fakeFetch({
      '/sports/soccer_france_ligue_one/events': [{ id: 'e1' }],
      '/events/e1/markets': [{ id: 'h2h' }],
      '/events/e1/markets?period=h1': { markets: [] },
      '/events/e1/markets?period=h2': [{ key: 'h2h', outcomes: 3 }]
    })
  });
  assert.equal(report.unparsed.length, 2);
  assert.deepEqual(Object.keys(report.raw).sort(), ['full', 'h1', 'h2']);
  assert.match(report.raw.full.sample, /"id":"h2h"/);
  assert.equal(report.markets.length, 1);
  assert.ok(!JSON.stringify(report).includes(KEY));
});
