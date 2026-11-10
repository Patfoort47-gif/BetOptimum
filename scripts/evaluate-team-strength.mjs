import { readFile } from 'node:fs/promises';
import { createTeamStrength } from '../src/model/team-strength.js';
import { forecastMatch } from '../src/model/prediction-model.js';
const file = process.argv[2];
if (!file) throw new Error('Usage : node scripts/evaluate-team-strength.mjs archive.json');
const source = JSON.parse(await readFile(file, 'utf8'));
const rows = source.rows
  .filter(
    (r) =>
      r.match.homeId &&
      r.match.awayId &&
      !r.match.knockout &&
      !/coupe|cup|copa|pokal/i.test(r.match.league) &&
      Number.isFinite(r.resultSeenAt)
  )
  .sort((a, b) => a.captured - b.captured);
if (rows.length < 30) throw new Error('Archive datée insuffisante');
const cut = rows[Math.floor(rows.length * 0.7)].match.date;
const model = createTeamStrength(),
  observed = new Set(),
  pairs = [];
for (const row of rows) {
  if (row.captured >= row.kickoff || row.match.completed)
    throw new Error('Fuite après coup d’envoi');
  for (const past of rows
    .filter((r) => r.resultSeenAt < row.captured)
    .sort((a, b) => a.resultSeenAt - b.resultSeenAt)) {
    if (observed.has(past.match.id)) continue;
    model.observe(past.match, past.homeScore, past.awayScore);
    observed.add(past.match.id);
  }
  const candidate = model.predict(row.match);
  if (row.match.date >= cut)
    pairs.push({
      date: row.match.date,
      league: row.match.league,
      actual:
        row.homeScore > row.awayScore ? 'home' : row.homeScore < row.awayScore ? 'away' : 'draw',
      baseline: forecastMatch(row.match).probs,
      candidate: forecastMatch({ ...row.match, ...candidate }).probs
    });
}
const keys = ['home', 'draw', 'away'];
const brier = (r, variant) =>
  keys.reduce((s, k) => s + (r[variant][k] - Number(r.actual === k)) ** 2, 0);
function metrics(data, variant) {
  const cells = Array.from({ length: 10 }, () => []);
  for (const r of data)
    for (const k of keys)
      cells[Math.min(9, Math.floor(r[variant][k] * 10))].push([
        r[variant][k],
        Number(r.actual === k)
      ]);
  return {
    count: data.length,
    brier: data.reduce((s, r) => s + brier(r, variant), 0) / data.length,
    ece:
      cells.reduce((s, c) => s + Math.abs(c.reduce((v, [p, y]) => v + p - y, 0)), 0) /
      (data.length * 3)
  };
}
const days = [...new Set(pairs.map((r) => r.date))];
let seed = 316;
const random = () => (seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296;
const boot = Array.from({ length: 2000 }, () => {
  const sample = days.flatMap(() => {
    const day = days[Math.floor(random() * days.length)];
    return pairs.filter((r) => r.date === day);
  });
  return (
    sample.reduce((s, r) => s + brier(r, 'candidate') - brier(r, 'baseline'), 0) / sample.length
  );
}).sort((a, b) => a - b);
const baseline = metrics(pairs, 'baseline'),
  candidate = metrics(pairs, 'candidate');
console.log(
  JSON.stringify(
    {
      snapshots: source.snapshots,
      total: rows.length,
      testStart: cut,
      testDays: days.length,
      baseline,
      candidate,
      deltaBrier: candidate.brier - baseline.brier,
      dayBootstrapCI95: [boot[50], boot[1949]],
      byCompetition: [...new Set(pairs.map((r) => r.league))].map((league) => ({
        league,
        baseline: metrics(
          pairs.filter((r) => r.league === league),
          'baseline'
        ),
        candidate: metrics(
          pairs.filter((r) => r.league === league),
          'candidate'
        )
      })),
      activation: false,
      reasons: [
        'Recherche isolée, aucun remplacement dans le pipeline actif',
        'Archive trop courte pour démontrer une amélioration dans toutes les compétitions',
        'Coupes à élimination directe exclues sans preuve du score à 90 minutes',
        'Résultats utilisables seulement après leur première publication Git ; paramètres Elo fixés avant le test',
        'Un Brier et une calibration améliorés hors échantillon, avec couverture suffisante par compétition et incertitude maîtrisée, sont indispensables avant activation'
      ]
    },
    null,
    2
  )
);
