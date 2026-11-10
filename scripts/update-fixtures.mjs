import { teamForm } from '../src/matches/team-form.js';
import { enrichHalfTimeResults } from './h1-results.mjs';
import { selectionSnapshot } from '../src/model/selection-snapshot.js';
import { publishFixtures } from './fixture-files.mjs';
import { venueFromCompetition } from '../src/matches/stadiums.js';
import { regulationScore } from '../src/model/regulation-score.js';
import {
  marketKeys,
  marketEnabled,
  isExtendedMarket,
  EXTENDED_ODDS_MAX_AGE
} from '../src/model/markets.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parisDate, pickDailyChallenge } from '../src/model/model.js';
import {
  ODDS_REFRESH_HOURS,
  SECONDARY_ODDS_WINDOW_HOURS,
  mergeCachedOffers,
  summarizeOffers
} from '../src/model/odds-cache.js';
import { sameTeam } from '../src/matches/team-match.js';
import { collectCalendarOdds } from './propline-competitions.mjs';

const leagues = [
  ['eng.1', 'Premier League', 34],
  ['fra.1', 'Ligue 1', 30],
  ['esp.1', 'La Liga', 33],
  ['ita.1', 'Serie A', 31],
  ['ger.1', 'Bundesliga', 32],
  ['uefa.champions', 'Ligue des champions', 42],
  ['uefa.europa', 'Europa League', 28],
  ['uefa.europa.conf', 'Conference League', 24],
  ['uefa.super_cup', "Supercoupe d'Europe", 36],
  ['fifa.cwc', 'Coupe du monde des clubs', 38],
  ['fra.2', 'Ligue 2', 18],
  ['fra.coupe_de_france', 'Coupe de France', 26],
  ['eng.fa', 'FA Cup', 27],
  ['eng.league_cup', 'Carabao Cup', 24],
  ['esp.copa_del_rey', 'Copa del Rey', 26],
  ['ita.coppa_italia', 'Coppa Italia', 25],
  ['ger.dfb_pokal', 'DFB-Pokal', 25],
  ['uefa.nations', 'Ligue des nations', 30],
  ['fifa.worldq.uefa', 'Qualifications Coupe du monde', 30]
];
const providerMap = {
  'Premier League': ['PL', 'soccer_epl'],
  'Ligue 1': ['FL1', 'soccer_france_ligue_one'],
  'La Liga': ['PD', 'soccer_spain_la_liga'],
  'Serie A': ['SA', 'soccer_italy_serie_a'],
  Bundesliga: ['BL1', 'soccer_germany_bundesliga'],
  'Ligue des champions': ['CL', 'soccer_uefa_champs_league'],
  'Europa League': [null, 'soccer_uefa_europa_league'],
  'Conference League': [null, 'soccer_uefa_europa_conference_league']
};
const giants = [
  'Real Madrid',
  'Barcelona',
  'Manchester City',
  'Manchester United',
  'Liverpool',
  'Arsenal',
  'Chelsea',
  'Bayern',
  'Paris Saint-Germain',
  'Marseille',
  'Internazionale',
  'Milan',
  'Juventus',
  'Napoli',
  'Atlético Madrid',
  'Borussia Dortmund'
];
const voidStatuses = new Set(['STATUS_CANCELED', 'STATUS_ABANDONED']);
const smallLogo = (url) => {
  if (typeof url !== 'string') return null;
  const source = url.split('?')[0].replace('/96-dark/', '/500-dark/').replace('/96/', '/500/');
  return `${source}?h=96&w=96`;
};
const dateKey = (date) => date.toISOString().slice(0, 10).replaceAll('-', '');
const start = new Date();
start.setUTCHours(0, 0, 0, 0);
const historyStart = new Date(start);
historyStart.setUTCDate(historyStart.getUTCDate() - 3);
const end = new Date(start);
end.setUTCDate(end.getUTCDate() + 7);
const days = Array.from({ length: 15 }, (_, index) => {
  const date = new Date(start);
  date.setUTCDate(date.getUTCDate() + index - 7);
  return dateKey(date);
});
let previousData = { matches: [] };
try {
  previousData = JSON.parse(await readFile('data/fixtures.json', 'utf8'));
} catch {}
for (const date of new Set(
  (previousData.matches ?? []).map((match) => match.date).filter(Boolean)
)) {
  try {
    const detail = JSON.parse(await readFile(`data/offers/${date}.json`, 'utf8'));
    for (const match of previousData.matches ?? [])
      if (match.date === date && Array.isArray(detail.matches?.[match.id]))
        match.bookmakerOffers = detail.matches[match.id];
  } catch {}
}

function model(home, away, priority) {
  const homeBig = giants.some((name) => home.includes(name));
  const awayBig = giants.some((name) => away.includes(name));
  const homeGoals = 1.45 + (homeBig ? 0.45 : 0) + (priority > 60 ? 0.15 : 0);
  const awayGoals = 1.15 + (awayBig ? 0.35 : 0) + (priority > 60 ? 0.1 : 0);
  const total = homeGoals + awayGoals;
  const overProbability = 1 - Math.exp(-total) * (1 + total + total ** 2 / 2);
  const bttsProbability = (1 - Math.exp(-homeGoals)) * (1 - Math.exp(-awayGoals));
  const fairOdd = (probability) =>
    Number(Math.min(4.5, Math.max(1.15, 1 / (probability * 0.95))).toFixed(2));
  return {
    homeGoals,
    awayGoals,
    odds: {
      home: Number(Math.max(1.3, 3.45 / homeGoals).toFixed(2)),
      draw: Number((3.15 + Math.abs(homeGoals - awayGoals) * 0.55).toFixed(2)),
      away: Number(Math.max(1.45, 3.65 / awayGoals).toFixed(2)),
      over: fairOdd(overProbability),
      btts: fairOdd(bttsProbability)
    }
  };
}

const clamp = (value) => Math.max(0.3, Math.min(3.5, value));

async function footballHistory() {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error('secret FOOTBALL_DATA_TOKEN absent');
  const dateFrom = new Date(start);
  dateFrom.setUTCDate(dateFrom.getUTCDate() - 90);
  const codes = [
    ...new Set(
      Object.values(providerMap)
        .map(([code]) => code)
        .filter(Boolean)
    )
  ];
  const responses = [];
  for (const code of codes) {
    const url = `https://api.football-data.org/v4/competitions/${code}/matches?dateFrom=${dateFrom.toISOString().slice(0, 10)}&dateTo=${start.toISOString().slice(0, 10)}&status=FINISHED`;
    const response = await fetch(url, { headers: { 'X-Auth-Token': token } });
    if (response.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 6500));
      continue;
    }
    if (!response.ok) throw new Error(`football-data ${code}: HTTP ${response.status}`);
    const data = await response.json();
    responses.push(...(data.matches ?? []));
  }
  return responses;
}

function consensus(currentOffers = [], previousOffers = []) {
  const stage = Number(process.env.PROPLINE_MARKET_STAGE ?? 0),
    keys = marketKeys(Object.assign({}, ...currentOffers, ...previousOffers)).filter((key) =>
      marketEnabled(key, stage, false)
    );
  const mergedOffers = mergeCachedOffers(currentOffers, previousOffers, keys);
  if (!mergedOffers.length) return null;
  const summary = summarizeOffers(mergedOffers, keys);
  const validUntil = Object.fromEntries(
    keys
      .filter((key) => isExtendedMarket(key) && summary.counts[key] > 0)
      .map((key) => [
        key,
        new Date(
          Math.min(
            ...mergedOffers
              .filter((offer) => Number(offer[key]) > 1)
              .map((offer) => Date.parse(offer[key + 'UpdatedAt']))
          ) + EXTENDED_ODDS_MAX_AGE
        ).toISOString()
      ])
  );
  return {
    offers: mergedOffers,
    counts: summary.counts,
    cachedMarkets: summary.cachedMarkets,
    validUntil,
    ...summary.averages
  };
}

const results = await Promise.allSettled(
  leagues.map(async ([slug, label, weight]) => {
    const events = [];
    let leagueLogo = null,
      leagueLogoDark = null;
    for (const day of days) {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${day}&limit=100`;
      const response = await fetch(url, { headers: { 'User-Agent': 'BetOptimum-Fixtures/1.0' } });
      if (!response.ok) throw new Error(`${slug}: HTTP ${response.status} (${day})`);
      const data = await response.json();
      events.push(...(data.events ?? []));
      const logos = data.leagues?.[0]?.logos ?? [];
      leagueLogo ??= logos.find((logo) => !logo.rel?.includes('dark'))?.href ?? null;
      leagueLogoDark ??=
        logos.find((logo) => logo.rel?.includes('dark') && logo.href.includes('/500-dark/'))
          ?.href ?? null;
    }
    return events
      .map((event) => {
        const competition = event.competitions?.[0];
        const homeCompetitor = competition?.competitors?.find((team) => team.homeAway === 'home');
        const awayCompetitor = competition?.competitors?.find((team) => team.homeAway === 'away');
        const homeTeam = homeCompetitor?.team?.displayName;
        const awayTeam = awayCompetitor?.team?.displayName;
        if (!homeTeam || !awayTeam) return null;
        const giantCount = giants.filter(
          (name) => homeTeam.includes(name) || awayTeam.includes(name)
        ).length;
        const priority = weight + giantCount * 30;
        const kickoff = new Date(event.date);
        return {
          id: `espn-${event.id}`,
          date: kickoff.toISOString().slice(0, 10),
          kickoff: kickoff.toISOString(),
          time: kickoff.toLocaleTimeString('fr-FR', {
            timeZone: 'Europe/Paris',
            hour: '2-digit',
            minute: '2-digit'
          }),
          league: label,
          home: homeTeam,
          away: awayTeam,
          ...venueFromCompetition(competition),
          leagueLogo: smallLogo(leagueLogo),
          leagueLogoDark: smallLogo(leagueLogoDark),
          homeId: homeCompetitor?.team?.id ?? null,
          awayId: awayCompetitor?.team?.id ?? null,
          homeLogo: smallLogo(homeCompetitor?.team?.logo),
          awayLogo: smallLogo(awayCompetitor?.team?.logo),
          priority,
          featured: priority >= 75,
          status: event.status?.type?.description ?? 'Programmé',
          completed: event.status?.type?.completed === true,
          voided: voidStatuses.has(event.status?.type?.name),
          knockout: /round of|quarter|semi|final|knockout|play-?off/i.test(
            competition?.notes?.[0]?.headline ?? ''
          ),
          regulation: regulationScore(event),
          homeScore: homeCompetitor?.score == null ? null : Number(homeCompetitor.score),
          awayScore: awayCompetitor?.score == null ? null : Number(awayCompetitor.score),
          ...model(homeTeam, awayTeam, priority)
        };
      })
      .filter(Boolean);
  })
);

const matches = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
const failures = results.flatMap((result, index) =>
  result.status === 'rejected'
    ? [`${leagues[index][0]}: ${result.reason?.message ?? 'échec inconnu'}`]
    : []
);
const allUnique = [...new Map(matches.map((match) => [match.id, match])).values()];
const unique = allUnique
  .filter(
    (match) =>
      match.date >= historyStart.toISOString().slice(0, 10) &&
      match.date <= end.toISOString().slice(0, 10)
  )
  .sort((a, b) => a.date.localeCompare(b.date) || b.priority - a.priority);
const settlements = allUnique
  .filter(
    (match) =>
      match.completed && Number.isFinite(match.homeScore) && Number.isFinite(match.awayScore)
  )
  .map(
    ({
      id,
      date,
      league,
      home,
      away,
      homeId,
      awayId,
      homeScore,
      awayScore,
      completed,
      regulation
    }) => ({
      id,
      date,
      league,
      home,
      away,
      homeId,
      awayId,
      homeScore,
      awayScore,
      completed,
      regulation
    })
  );
// Les résultats H1 restent nécessaires pour régler les anciens tickets.
{
  const h1 = await enrichHalfTimeResults(settlements, previousData.settlements ?? [], {
    slugs: Object.fromEntries(leagues.map(([slug, label]) => [label, slug]))
  });
  console.info('Résultats H1 :', JSON.stringify(h1));
  for (const match of unique) {
    const result = settlements.find((r) => r.id === match.id);
    if (result?.periodScores) match.periodScores = result.periodScores;
  }
}
const providerFailures = [...failures];
let history = [];
try {
  history = await footballHistory();
} catch (error) {
  providerFailures.push(error.message);
}
const reservations = JSON.parse(
    await readFile('data/odds-sync-attempts.json', 'utf8').catch((error) => {
      if (error.code === 'ENOENT') return '[]';
      throw error;
    })
  ),
  reservedAt = process.env.ODDS_SYNC_RESERVED_AT;
const quotaReserved = Boolean(
  reservedAt &&
    reservations.at(-1) === reservedAt &&
    Date.now() - Date.parse(reservedAt) >= 0 &&
    Date.now() - Date.parse(reservedAt) < 15 * 60000
);
if (!quotaReserved) console.info('Cotes : aucune réservation de quota, cache uniquement.');
const propLineResult = quotaReserved
  ? await collectCalendarOdds(unique)
  : { offersByMatch: new Map(), requested: 0, succeeded: 0, failures: [] };
providerFailures.push(...propLineResult.failures);
const enriched = unique.map((match) => {
  const homeStats = teamForm(match.home, history),
    awayStats = teamForm(match.away, history);
  if (homeStats.sample >= 2 && awayStats.sample >= 2) {
    match.homeGoals = Number(
      clamp(((homeStats.avgScored + awayStats.avgConceded) / 2) * 1.08).toFixed(2)
    );
    match.awayGoals = Number(
      clamp(((awayStats.avgScored + homeStats.avgConceded) / 2) * 0.92).toFixed(2)
    );
    match.statsSource = 'football-data.org';
    match.homeStats = homeStats;
    match.awayStats = awayStats;
  }
  const previous = previousData.matches?.find((item) => item.id === match.id);
  const realOdds = consensus(propLineResult.offersByMatch.get(match.id), previous?.bookmakerOffers);
  if (realOdds) {
    const realMarkets = marketKeys(realOdds).filter((key) => realOdds[key]);
    match.odds = {
      ...match.odds,
      ...Object.fromEntries(realMarkets.map((key) => [key, realOdds[key]]))
    };
    match.marketValidUntil = realOdds.validUntil;
    match.oddsSource = realOdds.offers.some((offer) =>
      Object.keys(offer).some((key) => key.endsWith('Source') && offer[key] === 'PropLine')
    )
      ? 'PropLine'
      : 'Cache historique';
    match.bookmakerOffers = realOdds.offers;
    match.bookmakerCount = realOdds.offers.length;
    match.oddsBookmakerCounts = realOdds.counts;
    match.realOddsMarkets = realMarkets;
    match.oddsCachedMarkets = realOdds.cachedMarkets;
  }
  if (previous?.odds)
    match.oddsMovement = Object.fromEntries(
      Object.keys(match.odds).map((key) => {
        const before = Number(previous.odds[key]),
          current = Number(match.odds[key]),
          percent =
            before && current ? Number((((current - before) / before) * 100).toFixed(1)) : 0;
        return [key, { previous: before, current, percent, significant: Math.abs(percent) >= 5 }];
      })
    );
  match.suggestedPick = selectionSnapshot(match, previous);
  return match;
});
// Diagnostic de couverture à chaque collecte, sans nouvel appel fournisseur.
const coverage = (matches) => {
  const upcoming = matches.filter(
    (match) =>
      !match.completed &&
      !match.voided &&
      Date.parse(match.kickoff ?? `${match.date}T${match.time}:00Z`) > Date.now()
  );
  return {
    upcoming: upcoming.length,
    withOffers: upcoming.filter((match) => match.bookmakerOffers?.length).length
  };
};
console.info(
  'Couverture bookmakers (avant / après) :',
  JSON.stringify({ before: coverage(previousData.matches ?? []), after: coverage(enriched) })
);
// Défi du jour : sélection figée une fois publiée (voir pickDailyChallenge).
const dailyChallenge = pickDailyChallenge(
  enriched,
  parisDate(new Date()),
  Object.fromEntries(leagues.map(([, label, weight]) => [label, weight])),
  previousData.dailyChallenge
);
await mkdir('data', { recursive: true });
const refreshedAt = new Date().toISOString(),
  oddsRefreshedAt = propLineResult.offersByMatch.size
    ? refreshedAt
    : (previousData.oddsRefreshedAt ?? null);
const secondaryOddsRefreshedAt = propLineResult.offersByMatch.size
  ? refreshedAt
  : (previousData.secondaryOddsRefreshedAt ?? null);
await publishFixtures({
  generatedAt: refreshedAt,
  oddsRefreshedAt,
  oddsRefreshHours: ODDS_REFRESH_HOURS,
  oddsRefreshTimezone: 'Europe/Paris',
  secondaryOddsRefreshedAt,
  secondaryOddsWindowHours: SECONDARY_ODDS_WINDOW_HOURS,
  movementThresholdPercent: 5,
  dailyChallenge,
  source: 'ESPN + football-data.org + PropLine',
  providerStatus: providerFailures.length ? 'partial' : 'ok',
  failures: providerFailures,
  coverage: {
    propLineRequested: propLineResult.requested,
    propLineDiscoveryRequests: propLineResult.discoveryRequests ?? 0,
    propLineUnavailableLeagues: propLineResult.unavailableLeagues ?? [],
    propLineSucceeded: propLineResult.succeeded,
    propLineMatches: propLineResult.offersByMatch.size,
    historicalMatches: history.length,
    secondaryOddsMatches: enriched.filter((match) =>
      match.realOddsMarkets?.some((key) => key === 'over' || key === 'btts')
    ).length,
    statsMatches: enriched.filter((x) => x.statsSource).length,
    oddsMatches: enriched.filter((x) => x.oddsSource).length,
    settlements: settlements.length
  },
  settlements,
  matches: enriched
});
console.log(
  `${enriched.length} rencontres, ${settlements.length} résultats récents, ${history.length} historiques, ${propLineResult.offersByMatch.size} rencontres cotées.`
);
if (providerFailures.length) console.warn(providerFailures.join('\n'));
