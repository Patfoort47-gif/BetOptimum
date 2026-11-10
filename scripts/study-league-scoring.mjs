import { readFile } from 'node:fs/promises';
import {
  comparePlayer,
  compareRanking,
  controlledSeries
} from '../src/club/league-scoring-study.js';
const path = process.argv[2] ?? 'docs/studies/BET-169-anonymized.json';
const week = process.argv[3] ?? '2026-11-02';
const groups = {};
if (path) {
  const input = JSON.parse(await readFile(path, 'utf8'));
  for (const entry of input) {
    if (entry.week_start !== week) continue;
    const label = `J${entry.player}`;
    (groups[label] ??= []).push(entry);
  }
}
const samples = {
    A: controlledSeries(1, 1),
    B: controlledSeries(11, 5),
    C: controlledSeries(20, 10)
  },
  volumes = Object.fromEntries(
    [3, 10, 30, 100].map((n) => [`n${n}`, controlledSeries(n, Math.floor(n / 2))])
  );
const output = {
  week,
  parameters: { k: 10, threshold: 10, cap: 5, stake: 10 },
  real: Object.fromEntries(
    Object.entries(groups).map(([id, entries]) => [id, comparePlayer(entries)])
  ),
  rankings: Object.fromEntries(
    ['raw', 'positive', 'weighted', 'threshold'].map((key) => [key, compareRanking(groups, key)])
  ),
  comparableOdds: Object.fromEntries(
    Object.entries(samples).map(([id, rows]) => [id, comparePlayer(rows)])
  ),
  volumes: Object.fromEntries(
    Object.entries(volumes).map(([id, rows]) => [id, comparePlayer(rows)])
  ),
  exactSameRate: [0, 1].map((rate) => ({
    rate,
    rows: [3, 10, 30, 100].map((n) => comparePlayer(controlledSeries(n, n * rate, 2)))
  })),
  sensitivity: {
    k: [5, 10, 20].map((k) => ({ k, ranking: compareRanking(groups, 'weighted', { k }) })),
    threshold: [5, 10, 20].map((threshold) => ({
      threshold,
      ranking: compareRanking(groups, 'threshold', { threshold })
    }))
  },
  sameSuccessRate: [
    { n: 3, wins: 1 },
    { n: 10, wins: 3 },
    { n: 30, wins: 10 },
    { n: 100, wins: 33 }
  ].map((x) => ({ ...x, ...comparePlayer(controlledSeries(x.n, x.wins, 2.5)) })),
  odds: [1.1, 2, 5, 10].map((odd) => ({ odd, ...comparePlayer(controlledSeries(10, 6, odd)) }))
};
console.log(JSON.stringify(output, null, 2));
