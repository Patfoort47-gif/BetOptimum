// Réunit les xG d'équipe et le calendrier public sans transmettre le secret au navigateur.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const leagueIds = {
  'Ligue des champions': 2,
  'Coupe du monde des clubs': 3412,
  'Premier League': 8,
  'La Liga': 564,
  Bundesliga: 82,
  'Serie A': 384,
  'Ligue 1': 301,
  'Ligue des nations': 1538,
  'Qualifications Coupe du monde': 720,
  'Europa League': 5,
  'FA Cup': 24,
  'Coupe de France': 307,
  'Copa del Rey': 570,
  'Coppa Italia': 390,
  'DFB-Pokal': 109,
  'Conference League': 2286,
  'Carabao Cup': 27,
  'Ligue 2': 304
};
const normalize = (name) =>
  String(name ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export function matchXg(matches, fixtures) {
  const index = new Map();
  for (const fixture of fixtures) {
    const participants = fixture.participants ?? [];
    const home = normalize(participants.find((team) => team.meta?.location === 'home')?.name);
    const away = normalize(participants.find((team) => team.meta?.location === 'away')?.name);
    if (!home || !away || !Number.isFinite(fixture.starting_at_timestamp)) continue;
    const key = [fixture.league_id, home, away].join(':');
    const candidates = index.get(key) ?? new Map();
    candidates.set(fixture.id, fixture);
    index.set(key, candidates);
  }
  const result = {};
  for (const match of matches) {
    if (!match.completed || match.voided || !/^espn-\d+$/.test(match.id)) continue;
    const league = Object.hasOwn(leagueIds, match.league) ? leagueIds[match.league] : null;
    const key = [league, normalize(match.home), normalize(match.away)].join(':');
    const kickoff = Date.parse(match.kickoff);
    const candidates = [...(index.get(key)?.values() ?? [])].filter(
      (fixture) => Math.abs(kickoff - fixture.starting_at_timestamp * 1000) <= 15 * 60000
    );
    if (candidates.length !== 1) continue;
    const goals = (candidates[0].xgfixture ?? []).filter(
      (stat) => stat.type?.code === 'expected-goals'
    );
    const home = goals.find((stat) => stat.location === 'home')?.data?.value;
    const away = goals.find((stat) => stat.location === 'away')?.data?.value;
    if ([home, away].every((value) => Number.isFinite(value) && value >= 0))
      result[match.id] = { home, away };
  }
  return result;
}

async function collect(matches, token) {
  const days = matches
    .filter((match) => match.completed && !match.voided && /^\d{4}-\d{2}-\d{2}$/.test(match.date))
    .map((match) => match.date)
    .sort();
  if (!token || !days.length) return {};
  const start = new Date(Date.parse(days[0]) - 86400000).toISOString().slice(0, 10);
  const end = new Date(Date.parse(days.at(-1)) + 86400000).toISOString().slice(0, 10);
  const url = new URL(`https://api.sportmonks.com/v3/football/fixtures/between/${start}/${end}`);
  url.searchParams.set('include', 'participants;xGFixture.type');
  url.searchParams.set('per_page', '50');
  const fixtures = [];
  for (let page = 1; page <= 80; page++) {
    url.searchParams.set('page', String(page));
    const response = await fetch(url, {
      headers: { Authorization: token },
      redirect: 'error',
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`Réponse Sportmonks HTTP ${response.status}`);
    const { data, pagination } = await response.json();
    if (!Array.isArray(data)) throw new Error('Réponse Sportmonks invalide');
    fixtures.push(...data);
    if (!pagination?.has_more) return matchXg(matches, fixtures);
  }
  throw new Error('Pagination Sportmonks incomplète');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { matches } = JSON.parse(await readFile('_site/data/fixtures.json', 'utf8'));
  let data = {};
  try {
    data = await collect(matches, process.env.SPORTMONKS_API_TOKEN);
  } catch (error) {
    console.warn('Collecte des xG Sportmonks indisponible.', error.name);
  }
  await writeFile('_site/data/match-xg.json', JSON.stringify(data));
  console.log(`xG d’équipe publiables pour ${Object.keys(data).length} matchs.`);
}
