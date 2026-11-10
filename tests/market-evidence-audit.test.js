import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { auditMarketEvidence } from '../scripts/audit-market-evidence.mjs';
const read = (name) =>
  JSON.parse(
    gunzipSync(
      readFileSync(new URL(`../docs/evidence/${name}-2026-11-04.json.gz`, import.meta.url))
    )
  );
test('BET-170 : prix réels H1/H2 isolés par période, seuil par sélection et totaux équipe exclus', () => {
  const h1 = read('propline-h1'),
    h2 = read('propline-h2');
  assert.deepEqual(auditMarketEvidence(h1).periods.h1, {
    events: 16,
    selections: 318,
    maxBookmakersPerSelection: 23,
    qualifiedSelections: 142,
    qualifiedKeys: [
      'away',
      'draw',
      'home',
      'over',
      'over05',
      'over15',
      'under',
      'under05',
      'under15'
    ]
  });
  assert.equal(auditMarketEvidence(h2).periods.h2.qualifiedSelections, 0);
  assert.equal(auditMarketEvidence(h2).periods.h2.maxBookmakersPerSelection, 6);
  const teamOnly = {
    ...h1,
    samples: h1.samples.map((e) => ({
      ...e,
      bookmakers: e.bookmakers.map((b) => ({ ...b, markets: b.markets.filter((m) => m.team) }))
    }))
  };
  assert.deepEqual(auditMarketEvidence(teamOnly).periods, {});
  const notPeriod = {
    ...h1,
    samples: h1.samples.map((e) => ({
      ...e,
      bookmakers: e.bookmakers.map((b) => ({
        ...b,
        markets: b.markets.map((m) => ({ ...m, period: null }))
      }))
    }))
  };
  assert.deepEqual(auditMarketEvidence(notPeriod).periods, {});
});
test('BET-170 : preuve des quarts asiatiques et absence d’identité stable des trois buts joueurs', () => {
  const r = auditMarketEvidence(read('propline-remaining'));
  for (const line of [0.25, -0.25, 0.75, -0.75, 1.25, -1.25])
    assert(r.families.spreads.lines.includes(line));
  assert.equal(r.families['3plus_goals'].outcomes, 45);
  assert.equal(r.families['3plus_goals'].identifiedPlayerOutcomes, 0);
  assert.equal(r.families.first_team_to_score.bookmakers.length, 4);
  assert.equal(r.families.half_time_full_time.bookmakers.length, 5);
});
