import test from 'node:test';
import assert from 'node:assert/strict';
import { rankPeriod, rankingVersion, decidedEntry } from '../src/club/ranking-policy.js';
import { specialStandings } from '../src/club/special.js';
import { planTitles } from '../scripts/special-engine.mjs';
import { planClosure } from '../scripts/league-engine.mjs';
import { planMonthlyPrizes } from '../scripts/token-engine.mjs';
import { renderClubTable } from '../src/club/club-table.js';
const members = ['a', 'b', 'c'].map((user_id) => ({ user_id, joined_at: '2026-11-01' })),
  series = (user_id, n, w) =>
    Array.from({ length: n }, (_, i) => ({
      user_id,
      status: i < w ? 'won' : 'lost',
      points: i < w ? 10 : -10,
      settled_at: '2026-12-02',
      round_id: 'r'
    }));
test('Activation par période et seuil à 9/10, sans bonus de volume perdant', () => {
  assert.equal(rankingVersion('2026-11-02'), 2);
  assert.equal(rankingVersion('2026-11-09'), 3);
  const rows = [
    { user_id: 'a', points: 40, roi: 400, wins: 1, decided: 1 },
    { user_id: 'b', points: -10, roi: -10, wins: 5, decided: 11 },
    { user_id: 'c', points: 0, roi: 0, wins: 10, decided: 20 }
  ];
  assert.deepEqual(
    rankPeriod(rows, '2026-11-09').map((r) => [r.user_id, r.rank]),
    [
      ['c', 1],
      ['b', 2],
      ['a', null]
    ]
  );
  assert.equal(rankPeriod([{ ...rows[0], decided: 9 }], '2026-11-09')[0].confirmed, false);
  assert.equal(rankPeriod([{ ...rows[0], decided: 10 }], '2026-11-09')[0].confirmed, true);
  assert.equal(rankPeriod(rows, '2026-11-02')[0].user_id, 'a');
  assert.equal(decidedEntry({ status: 'void', points: 0 }), false);
  assert.equal(decidedEntry({ status: 'won', points: 0 }), true);
});
test('Spéciales : classement et titres ne confirment pas une série isolée', () => {
  const picks = [...series('a', 1, 1), ...series('b', 11, 5), ...series('c', 20, 10)],
    rows = specialStandings(picks, members, 'season', undefined, '2026-11-09');
  assert.deepEqual(
    rows.map((r) => [r.user_id, r.rank]),
    [
      ['c', 1],
      ['b', 2],
      ['a', null]
    ]
  );
  assert.equal(
    planMonthlyPrizes({ league: { id: 'x' }, month: '2026-12', standings: rows }).length,
    2
  );
  const titles = planTitles({
    league: { id: 'x', season_start: '2026-11-09', season_end: '2027-06-30' },
    rounds: [{ id: 'r', starts_at: '2026-12-01', ends_at: '2026-12-02' }],
    members,
    picks,
    season: '2026-27'
  });
  assert.ok(!titles.some((t) => t.user_id === 'a'));
  assert.equal(titles.find((t) => t.kind === 'champion').user_id, 'c');
});
test('Placement V3 : joueur provisoire sans champion confirmé ni échelon prématuré', () => {
  const plan = planClosure({
    season: '2026-2027',
    players: [{ user_id: 'a', echelon: null }],
    standings: [
      { user_id: 'a', points: 40, picks: 1, qualified: false, confirmed: false, ranking_version: 3 }
    ],
    groups: [],
    groupMembers: [],
    weekendPoints: {}
  });
  assert.equal(plan.results[0].group_rank, null);
  assert.equal(plan.results[0].to_echelon, null);
  assert.equal(plan.results[0].ranking_version, 3);
});
test('Table : zone provisoire accessible avec compteur, sans faux rang zéro', () => {
  const html = renderClubTable(
    [
      {
        nickname: 'A',
        user_id: 'a',
        rank: null,
        picks: 3,
        wins: 1,
        points: 40,
        decided: 1,
        confirmed: false,
        ranking_version: 3
      }
    ],
    { html: String, avatar: () => '' }
  );
  assert.match(html, /Provisoires/);
  assert.match(html, /1\/10 résultats décidés/);
  assert.doesNotMatch(html, /<td>0<\/td>/);
  assert.match(html, /Aucun joueur confirmé/);
});
