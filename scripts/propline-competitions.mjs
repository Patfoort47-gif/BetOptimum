// Server-side competition discovery. Never substitute a different competition.
import { collectPropLine } from './propline-odds.mjs';
export const PROPLINE_SPORTS = {
  'Premier League': 'soccer_epl',
  'Ligue 1': 'soccer_france_ligue_one',
  'La Liga': 'soccer_spain_la_liga',
  'Serie A': 'soccer_italy_serie_a',
  Bundesliga: 'soccer_germany_bundesliga',
  'Ligue des champions': 'soccer_uefa_champs_league',
  'Europa League': 'soccer_uefa_europa_league',
  'Conference League': 'soccer_uefa_europa_conference_league',
  'DFB-Pokal': 'soccer_germany_dfb_pokal',
  'Ligue des nations': 'soccer_uefa_nations_league'
};
const aliases = {
  'Premier League': ['epl', 'English Premier League'],
  'Ligue 1': ['ligue_1', 'france_ligue_one'],
  'La Liga': ['la_liga', 'spain_la_liga'],
  'Serie A': ['serie_a', 'italy_serie_a'],
  Bundesliga: ['germany_bundesliga'],
  'Ligue des champions': ['UEFA Champions League', 'uefa_champs_league'],
  'Europa League': ['UEFA Europa League'],
  'Conference League': ['UEFA Conference League', 'UEFA Europa Conference League'],
  "Supercoupe d'Europe": ['UEFA Super Cup', 'uefa_super_cup'],
  'Coupe du monde des clubs': ['FIFA Club World Cup', 'fifa_club_world_cup'],
  'Ligue 2': ['France Ligue 2', 'france_ligue_two', 'france_ligue_2'],
  'Coupe de France': ['France Coupe de France', 'French Cup', 'france_coupe_de_france'],
  'FA Cup': ['England FA Cup', 'English FA Cup', 'england_fa_cup'],
  'Carabao Cup': [
    'EFL Cup',
    'England EFL Cup',
    'English League Cup',
    'England League Cup',
    'england_efl_cup',
    'england_league_cup'
  ],
  'Copa del Rey': ['Coupe du Roi', 'Spain Copa del Rey', 'Spanish Cup', 'spain_copa_del_rey'],
  'Coppa Italia': ['Italy Coppa Italia', 'Italian Cup', 'italy_coppa_italia'],
  'DFB-Pokal': ['Germany DFB Pokal', 'German Cup', 'germany_dfb_pokal'],
  'Ligue des nations': ['UEFA Nations League', 'uefa_nations_league'],
  'Qualifications Coupe du monde': [
    'FIFA World Cup Qualifiers Europe',
    'FIFA World Cup European Qualifiers',
    'fifa_world_cup_qualifiers_europe',
    'fifa_world_cup_qualifiers_uefa'
  ]
};
const normalize = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
export function resolveCompetition(league, catalog) {
  const names = new Set([league, ...(aliases[league] ?? [])].map(normalize));
  const found = catalog.filter(
    (sport) =>
      typeof sport.key === 'string' &&
      sport.key.startsWith('soccer_') &&
      sport.active !== false &&
      sport.has_outrights !== true &&
      (names.has(normalize(sport.key.slice(7))) || names.has(normalize(sport.title)))
  );
  const keys = [...new Set(found.map((sport) => sport.key))];
  return keys.length === 1 ? keys[0] : null;
}
export async function collectCalendarOdds(
  matches,
  {
    key = process.env.PROPLINE_API_KEY,
    fetchImpl = fetch,
    now = Date.now(),
    maxRequests = 8,
    ...options
  } = {}
) {
  const upcoming = matches
    .filter(
      (match) =>
        !match.completed &&
        !match.voided &&
        Date.parse(match.kickoff) > now &&
        Date.parse(match.kickoff) <= now + 7 * 86400000
    )
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
  const leagues = [...new Set(upcoming.map((match) => match.league))],
    sports = { ...PROPLINE_SPORTS };
  let discoveryRequests = 0;
  const failures = [],
    catalogSports = [];
  if (key && maxRequests > 0 && leagues.some((league) => !sports[league])) {
    discoveryRequests++;
    try {
      const response = await fetchImpl('https://api.prop-line.com/v1/sports', {
        headers: { 'X-API-Key': key },
        signal: AbortSignal.timeout(20000),
        redirect: 'error'
      });
      if (!response.ok) {
        failures.push(`PropLine catalogue: HTTP ${response.status}`);
        if ([401, 403, 429].includes(response.status))
          return {
            offersByMatch: new Map(),
            requested: 1,
            succeeded: 0,
            discoveryRequests,
            failures,
            unavailableLeagues: leagues.filter((league) => !sports[league])
          };
      } else {
        const catalog = await response.json();
        if (!Array.isArray(catalog)) throw Error('format');
        catalogSports.push(
          ...catalog
            .filter((sport) => typeof sport.key === 'string' && sport.key.startsWith('soccer_'))
            .map(({ key, title, active }) => ({ key, title, active }))
        );
        for (const league of leagues) {
          const sport = resolveCompetition(league, catalog);
          if (sport) sports[league] = sport;
        }
      }
    } catch {
      failures.push('PropLine : catalogue des compétitions indisponible');
    }
  }
  const unavailableLeagues = leagues.filter((league) => !sports[league]);
  for (const league of unavailableLeagues)
    failures.push(`PropLine : compétition sans couverture confirmée : ${league}`);
  const result = await collectPropLine(upcoming, sports, {
    ...options,
    key,
    fetchImpl,
    now,
    maxRequests: Math.max(0, maxRequests - discoveryRequests)
  });
  return {
    ...result,
    requested: result.requested + discoveryRequests,
    discoveryRequests,
    catalogSports,
    failures: [...failures, ...result.failures],
    unavailableLeagues
  };
}
