// Évaluation rétrospective. Les données individuelles restent sur le runner.
import { readFile } from 'node:fs/promises';
import { checkPitchApiXg } from './check-pitchapi-xg.mjs';
import { blendXg, scoreProbabilities } from '../src/model/xg-evaluation.js';
import { analyseMatch, recommendedMarket, selectionResult } from '../src/model/model.js';

const DAY = 86400000;
const competitions = new Map([
  ['Ligue 1', ['FRA', /^Ligue 1$/i]],
  ['Ligue 2', ['FRA', /^Ligue 2$/i]],
  ['Premier League', ['ENG', /^Premier League$/i]],
  ['La Liga', ['ESP', /^(La Liga|LaLiga|Primera División)$/i]],
  ['Bundesliga', ['GER', /^Bundesliga$/i]],
  ['Serie A', ['ITA', /^Serie A$/i]]
]);
const normalize = (team) =>
  team
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function xgForecast(row, history) {
  const captured = row.captured * 1000;
  const recent = (name) =>
    (history.get(normalize(name)) ?? []).filter((item) => item.available < captured).slice(-6);
  const home = recent(row.match.home);
  const away = recent(row.match.away);
  if (home.length < 3 || away.length < 3) return null;
  const mean = (matches, field) =>
    matches.reduce((sum, game) => sum + game[field], 0) / matches.length;
  const clamp = (value) => Math.max(0.3, Math.min(3.5, value));
  return {
    home: clamp(((mean(home, 'scored') + mean(away, 'allowed')) / 2) * 1.08),
    away: clamp(((mean(away, 'scored') + mean(home, 'allowed')) / 2) * 0.92),
    availableAt: new Date(
      Math.max(...home.concat(away).map((game) => game.available))
    ).toISOString()
  };
}

async function getHistory(league, rows, key) {
  const url = new URL(
    '/v1/leagues/' + encodeURIComponent(league.id) + '/matches',
    'https://api.pitchapi.dev'
  );
  url.searchParams.set('status', 'played');
  const response = await fetch(url, {
    headers: { 'X-API-KEY': key },
    redirect: 'error',
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error('Calendrier PitchAPI HTTP ' + response.status);
  const { data } = await response.json();
  const firstCapture = Math.min(...rows.map((row) => row.captured * 1000));
  const lastCapture = Math.max(...rows.map((row) => row.captured * 1000));
  const games = (Array.isArray(data) ? data : data.matches)
    .map((match) => ({ id: match.id, kickoff: Date.parse(match.time_utc) }))
    .filter(
      (game) => game.kickoff >= firstCapture - 90 * DAY && game.kickoff + 2 * DAY < lastCapture
    )
    .sort((a, b) => a.kickoff - b.kickoff);
  const matches = [];
  for (let start = 0; start < games.length; start += 12) {
    const batch = games.slice(start, start + 12);
    const groups = await Promise.all(
      Array.from({ length: Math.min(3, batch.length) }, (_, index) =>
        checkPitchApiXg(
          batch.filter((_, position) => position % 3 === index).map((game) => game.id),
          key
        )
      )
    );
    matches.push(...groups.flatMap((group) => group.matches));
  }
  const byId = new Map(matches.map((match) => [match.id, match]));
  const history = new Map();
  for (const game of games) {
    const match = byId.get(game.id);
    if (!match?.home || !match.away || match.homeXg === null || match.awayXg === null) continue;
    for (const [name, scored, allowed] of [
      [match.home, match.homeXg, match.awayXg],
      [match.away, match.awayXg, match.homeXg]
    ]) {
      const label = normalize(name);
      if (!history.has(label)) history.set(label, []);
      history.get(label).push({ available: game.kickoff + 2 * DAY, scored, allowed });
    }
  }
  return {
    history,
    sampled: games.length,
    complete: matches.filter((match) => match.homeXg !== null && match.awayXg !== null).length
  };
}

function metrics(rows, weight) {
  let brier = 0;
  let logLoss = 0;
  let wins = 0;
  let losses = 0;
  let refunds = 0;
  let profit = 0;
  for (const row of rows) {
    const match = blendXg(row.match, row.xg, weight, new Date(row.captured * 1000).toISOString());
    const final = {
      ...row.match,
      completed: true,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      regulation: row.regulation
    };
    const result =
      row.homeScore > row.awayScore ? 'home' : row.homeScore < row.awayScore ? 'away' : 'draw';
    const score = scoreProbabilities(analyseMatch(match).probs, result);
    brier += score.brier;
    logLoss += score.logLoss;
    const pick = recommendedMarket(match);
    if (!pick) continue;
    const { status } = selectionResult({ matchId: match.id, key: pick.key }, [final]);
    if (status === 'won') {
      wins++;
      profit += pick.odd - 1;
    } else if (status === 'lost') {
      losses++;
      profit--;
    } else if (status === 'void') {
      refunds++;
    }
  }
  return {
    count: rows.length,
    withHistory: rows.filter((row) => row.xg).length,
    brier: rows.length ? brier / rows.length : null,
    logLoss: rows.length ? logLoss / rows.length : null,
    wins,
    losses,
    refunds,
    winRate: wins + losses ? wins / (wins + losses) : null,
    roi: wins + losses + refunds ? profit / (wins + losses + refunds) : null
  };
}

const { rows } = JSON.parse(await readFile(process.argv[2], 'utf8'));
const key = process.env.PITCHAPI_API_KEY;
const catalog = await checkPitchApiXg([], key);
const leagues = Array.isArray(catalog) ? catalog : catalog.leagues;
const coverage = [];
const ready = [];
for (const [name, [country, aliases]] of competitions) {
  const league = leagues.find((item) => item.country_code === country && aliases.test(item.name));
  const fixtures = rows.filter(
    (row) => row.match.league === name && analyseMatch(row.match).available
  );
  if (!league || !fixtures.length) continue;
  const { history, sampled, complete } = await getHistory(league, fixtures, key);
  coverage.push({ name, sampled, complete });
  ready.push(...fixtures.map((row) => ({ ...row, xg: xgForecast(row, history) })));
}
ready.sort((a, b) => a.kickoff - b.kickoff);
if (ready.length < 30) throw new Error('Échantillon de snapshots insuffisant');
const cut = ready[Math.floor(ready.length * 0.7)].match.date;
const valid = ready.filter((row) => row.match.date < cut);
const test = ready.filter((row) => row.match.date >= cut);
if (!valid.length || !test.length) throw new Error('Fenêtres chronologiques insuffisantes');
const validation = [0, 0.25, 0.5, 0.75, 1].map((weight) => ({ weight, ...metrics(valid, weight) }));
const { weight } = validation.reduce((best, item) => (item.brier < best.brier ? item : best));
const roiWeight = validation.reduce((best, item) =>
  item.brier <= validation[0].brier && item.roi > best.roi ? item : best
).weight;
const results = {
  cut,
  coverage,
  validation,
  baseline: metrics(test, 0),
  candidate: metrics(test, weight),
  selectedWeight: weight,
  exploratoryRoi: { weight: roiWeight, ...metrics(test, roiWeight) },
  activation: false,
  availability: 'Disponibilité rétrospective supposée 48 h après le coup d’envoi du match précédent'
};
console.log(JSON.stringify(results, null, 2));
if (process.env.GITHUB_ACTIONS)
  for (const [name, value] of Object.entries(results).filter(([name]) => name !== 'validation'))
    console.log('::notice::' + name + ' ' + JSON.stringify(value));
