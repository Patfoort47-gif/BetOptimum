import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parisDate, pickDailyChallenge, recommendedMarket } from '../model.js';
import { ODDS_REFRESH_HOURS, SECONDARY_ODDS_WINDOW_HOURS, isInSecondaryOddsWindow, mergeCachedOffers, summarizeOffers } from '../odds-cache.js';
import { sameTeam } from '../team-match.js';

const leagues = [
  ['eng.1', 'Premier League', 34], ['fra.1', 'Ligue 1', 30],
  ['esp.1', 'La Liga', 33], ['ita.1', 'Serie A', 31],
  ['ger.1', 'Bundesliga', 32], ['uefa.champions', 'Ligue des champions', 42],
  ['uefa.europa', 'Europa League', 28], ['uefa.europa.conf', 'Conference League', 24],
  ['uefa.super_cup', "Supercoupe d'Europe", 36], ['fifa.cwc', 'Coupe du monde des clubs', 38],
  ['fra.2', 'Ligue 2', 18], ['fra.coupe_de_france', 'Coupe de France', 26],
  ['eng.fa', 'FA Cup', 27], ['eng.league_cup', 'Carabao Cup', 24],
  ['esp.copa_del_rey', 'Copa del Rey', 26], ['ita.coppa_italia', 'Coppa Italia', 25],
  ['ger.dfb_pokal', 'DFB-Pokal', 25], ['uefa.nations', 'Ligue des nations', 30],
  ['fifa.worldq.uefa', 'Qualifications Coupe du monde', 30]
];
const providerMap = {
  'Premier League': ['PL', 'soccer_epl'], 'Ligue 1': ['FL1', 'soccer_france_ligue_one'],
  'La Liga': ['PD', 'soccer_spain_la_liga'], 'Serie A': ['SA', 'soccer_italy_serie_a'],
  'Bundesliga': ['BL1', 'soccer_germany_bundesliga'],
  'Ligue des champions': ['CL', 'soccer_uefa_champs_league'],
  'Europa League': [null, 'soccer_uefa_europa_league'],
  'Conference League': [null, 'soccer_uefa_europa_conference_league']
};
const giants = ['Real Madrid','Barcelona','Manchester City','Manchester United','Liverpool','Arsenal','Chelsea','Bayern','Paris Saint-Germain','Marseille','Internazionale','Milan','Juventus','Napoli','Atlético Madrid','Borussia Dortmund'];
const voidStatuses = new Set(['STATUS_CANCELED', 'STATUS_ABANDONED']);
const dateKey = date => date.toISOString().slice(0, 10).replaceAll('-', '');
const start = new Date(); start.setUTCHours(0, 0, 0, 0);
const historyStart = new Date(start); historyStart.setUTCDate(historyStart.getUTCDate() - 3);
const end = new Date(start); end.setUTCDate(end.getUTCDate() + 7);
const days = Array.from({ length: 15 }, (_, index) => { const date = new Date(start); date.setUTCDate(date.getUTCDate() + index - 7); return dateKey(date); });
let previousData = {matches:[]};
try { previousData = JSON.parse(await readFile('data/fixtures.json','utf8')); } catch {}

function model(home, away, priority) {
  const homeBig = giants.some(name => home.includes(name));
  const awayBig = giants.some(name => away.includes(name));
  const homeGoals = 1.45 + (homeBig ? .45 : 0) + (priority > 60 ? .15 : 0);
  const awayGoals = 1.15 + (awayBig ? .35 : 0) + (priority > 60 ? .1 : 0);
  const total = homeGoals + awayGoals;
  const overProbability = 1 - Math.exp(-total) * (1 + total + total ** 2 / 2);
  const bttsProbability = (1 - Math.exp(-homeGoals)) * (1 - Math.exp(-awayGoals));
  const fairOdd = probability => Number(Math.min(4.5, Math.max(1.15, 1 / (probability * .95))).toFixed(2));
  return {
    homeGoals, awayGoals,
    odds: {
      home: Number(Math.max(1.3, 3.45 / homeGoals).toFixed(2)),
      draw: Number((3.15 + Math.abs(homeGoals - awayGoals) * .55).toFixed(2)),
      away: Number(Math.max(1.45, 3.65 / awayGoals).toFixed(2)),
      over: fairOdd(overProbability),
      btts: fairOdd(bttsProbability)
    }
  };
}

const clamp = value => Math.max(.3, Math.min(3.5, value));

async function footballHistory() {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error('secret FOOTBALL_DATA_TOKEN absent');
  const dateFrom = new Date(start); dateFrom.setUTCDate(dateFrom.getUTCDate() - 90);
  const codes = [...new Set(Object.values(providerMap).map(([code]) => code).filter(Boolean))];
  const responses = [];
  for (const code of codes) {
    const url = `https://api.football-data.org/v4/competitions/${code}/matches?dateFrom=${dateFrom.toISOString().slice(0,10)}&dateTo=${start.toISOString().slice(0,10)}&status=FINISHED`;
    const response = await fetch(url, { headers: { 'X-Auth-Token': token } });
    if (response.status === 429) { await new Promise(resolve => setTimeout(resolve, 6500)); continue; }
    if (!response.ok) throw new Error(`football-data ${code}: HTTP ${response.status}`);
    const data = await response.json(); responses.push(...(data.matches ?? []));
  }
  return responses;
}

async function oddsFailure(response,context){let detail='';try{const body=await response.json();detail=body.error_code??body.message??body.error??''}catch{}return `${context}: HTTP ${response.status}${detail?` (${detail})`:''}`}

async function bookmakerOdds(upcomingMatches, refreshSecondary) {
  const key = process.env.THE_ODDS_API_KEY;
  if (!key) throw new Error('secret THE_ODDS_API_KEY absent');
  const sports = [...new Set(Object.values(providerMap).map(([, sport]) => sport))];
  const responses = [], failures = [];
  for (const sport of sports) {
    const params = new URLSearchParams({ apiKey:key, regions:'eu', markets:'h2h', oddsFormat:'decimal', dateFormat:'iso' });
    const response = await fetch(`https://api.the-odds-api.com/v4/sports/${sport}/odds?${params}`);
    if (response.status === 404) continue;
    if (!response.ok) { failures.push(await oddsFailure(response,`The Odds API ${sport}`)); continue; }
    responses.push(...(await response.json()).map(event => ({...event, _sport:sport})));
  }
  const secondaryEvents = refreshSecondary ? upcomingMatches.filter(match=>isInSecondaryOddsWindow(match)).map(match => responses.find(event => sameTeam(event.home_team,match.home)&&sameTeam(event.away_team,match.away))).filter(Boolean) : [];
  let secondarySuccesses = 0;
  for (const event of secondaryEvents) {
    const params = new URLSearchParams({ apiKey:key, regions:'eu,uk', markets:'btts,totals', oddsFormat:'decimal', dateFormat:'iso' });
    const response = await fetch(`https://api.the-odds-api.com/v4/sports/${event._sport}/events/${event.id}/odds?${params}`);
    if (!response.ok) { failures.push(await oddsFailure(response,`The Odds API ${event._sport} ${event.id}`)); continue; }
    secondarySuccesses++;
    const extra = await response.json();
    for (const bookmaker of extra.bookmakers ?? []) {
      const target = event.bookmakers?.find(item => item.key === bookmaker.key);
      if (target) target.markets.push(...(bookmaker.markets ?? []));
      else event.bookmakers?.push(bookmaker);
    }
  }
  return { events:responses, secondarySuccesses, secondaryRequested:secondaryEvents.length, failures };
}

function teamForm(team, history) {
  const games = history.filter(game => sameTeam(game.homeTeam?.name ?? '', team) || sameTeam(game.awayTeam?.name ?? '', team))
    .sort((a,b) => new Date(b.utcDate) - new Date(a.utcDate)).slice(0, 6);
  let scored = 0, conceded = 0;
  const form = games.map(game => {
    const home = sameTeam(game.homeTeam.name, team), own = Number(game.score?.fullTime?.[home?'home':'away'] ?? 0), opp = Number(game.score?.fullTime?.[home?'away':'home'] ?? 0);
    scored += own; conceded += opp; return own > opp ? 'V' : own === opp ? 'N' : 'D';
  });
  return { sample:games.length, form:form.join(''), avgScored:games.length?scored/games.length:null, avgConceded:games.length?conceded/games.length:null };
}

function consensus(match, oddsEvents, previousOffers = []) {
  const event = oddsEvents.find(item => sameTeam(item.home_team, match.home) && sameTeam(item.away_team, match.away));
  const offers = [];
  for (const bookmaker of event?.bookmakers ?? []) {
    const offer = { name: bookmaker.title };
    const h2h = bookmaker.markets?.find(item => item.key === 'h2h');
    for (const outcome of h2h?.outcomes ?? []) {
      if (sameTeam(outcome.name, match.home)) offer.home = outcome.price;
      else if (sameTeam(outcome.name, match.away)) offer.away = outcome.price;
      else if (outcome.name === 'Draw') offer.draw = outcome.price;
    }
    const btts = bookmaker.markets?.find(item => item.key === 'btts');
    offer.btts = btts?.outcomes?.find(outcome => /^(yes|oui)$/i.test(outcome.name))?.price;
    const totals = bookmaker.markets?.find(item => item.key === 'totals');
    offer.over = totals?.outcomes?.find(outcome => /^over$/i.test(outcome.name) && Number(outcome.point) === 2.5)?.price;
    if (offer.home || offer.draw || offer.away || offer.btts || offer.over) offers.push(offer);
  }
  const mergedOffers = mergeCachedOffers(offers, previousOffers);
  if (!mergedOffers.length) return null;
  const summary=summarizeOffers(mergedOffers);
  return { offers:mergedOffers, counts:summary.counts, cachedMarkets:summary.cachedMarkets, ...summary.averages };
}

const results = await Promise.allSettled(leagues.map(async ([slug, label, weight]) => {
  const events = [];
  let leagueLogo = null, leagueLogoDark = null;
  for (const day of days) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${day}&limit=100`;
    const response = await fetch(url, { headers: { 'User-Agent': 'BetMaster-Fixtures/1.0' } });
    if (!response.ok) throw new Error(`${slug}: HTTP ${response.status} (${day})`);
    const data = await response.json();
    events.push(...(data.events ?? []));
    const logos = data.leagues?.[0]?.logos ?? [];
    leagueLogo ??= logos.find(logo => !logo.rel?.includes('dark'))?.href ?? null;
    leagueLogoDark ??= logos.find(logo => logo.rel?.includes('dark') && logo.href.includes('/500-dark/'))?.href ?? null;
  }
  return events.map(event => {
    const competition = event.competitions?.[0];
    const homeCompetitor = competition?.competitors?.find(team => team.homeAway === 'home');
    const awayCompetitor = competition?.competitors?.find(team => team.homeAway === 'away');
    const homeTeam = homeCompetitor?.team?.displayName;
    const awayTeam = awayCompetitor?.team?.displayName;
    if (!homeTeam || !awayTeam) return null;
    const giantCount = giants.filter(name => homeTeam.includes(name) || awayTeam.includes(name)).length;
    const priority = weight + giantCount * 30;
    const kickoff = new Date(event.date);
    return {
      id: `espn-${event.id}`, date: kickoff.toISOString().slice(0, 10), kickoff: kickoff.toISOString(),
      time: kickoff.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }),
      league: label, home: homeTeam, away: awayTeam,
      leagueLogo, leagueLogoDark, homeId: homeCompetitor?.team?.id ?? null, awayId: awayCompetitor?.team?.id ?? null, homeLogo: homeCompetitor?.team?.logo ?? null, awayLogo: awayCompetitor?.team?.logo ?? null,
      priority, featured: priority >= 75, status: event.status?.type?.description ?? 'Programmé',
      completed: event.status?.type?.completed === true, voided: voidStatuses.has(event.status?.type?.name), knockout: /round of|quarter|semi|final|knockout|play-?off/i.test(competition?.notes?.[0]?.headline ?? ''),
      homeScore: homeCompetitor?.score == null ? null : Number(homeCompetitor.score),
      awayScore: awayCompetitor?.score == null ? null : Number(awayCompetitor.score),
      ...model(homeTeam, awayTeam, priority)
    };
  }).filter(Boolean);
}));

const matches = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
const failures = results.flatMap((result, index) => result.status === 'rejected' ? [`${leagues[index][0]}: ${result.reason?.message ?? 'échec inconnu'}`] : []);
const allUnique = [...new Map(matches.map(match => [match.id, match])).values()];
const unique = allUnique
  .filter(match => match.date >= historyStart.toISOString().slice(0, 10) && match.date <= end.toISOString().slice(0, 10))
  .sort((a, b) => a.date.localeCompare(b.date) || b.priority - a.priority);
const settlements = allUnique.filter(match => match.completed && Number.isFinite(match.homeScore) && Number.isFinite(match.awayScore))
  .map(({id,date,home,away,homeScore,awayScore,completed})=>({id,date,home,away,homeScore,awayScore,completed}));
const providerFailures = [...failures];
let history = [], oddsEvents = [], secondaryOddsResult = { secondarySuccesses:0, secondaryRequested:0, failures:[] };
try { history = await footballHistory(); } catch (error) { providerFailures.push(error.message); }
try { secondaryOddsResult = await bookmakerOdds(unique, true); oddsEvents = secondaryOddsResult.events; } catch (error) { providerFailures.push(error.message); }
providerFailures.push(...secondaryOddsResult.failures);
const unmatchedOddsEvents=oddsEvents.filter(event=>{const date=String(event.commence_time??'').slice(0,10);return date>=start.toISOString().slice(0,10)&&date<=end.toISOString().slice(0,10)&&!unique.some(match=>sameTeam(event.home_team,match.home)&&sameTeam(event.away_team,match.away))});
if(unmatchedOddsEvents.length)console.warn(`Événements de cotes non rapprochés (${unmatchedOddsEvents.length}) :\n${unmatchedOddsEvents.slice(0,20).map(event=>`${event.home_team} / ${event.away_team}`).join('\n')}`);
const enriched = unique.map(match => {
  const homeStats = teamForm(match.home, history), awayStats = teamForm(match.away, history);
  if (homeStats.sample >= 2 && awayStats.sample >= 2) {
    match.homeGoals = Number(clamp(((homeStats.avgScored + awayStats.avgConceded) / 2) * 1.08).toFixed(2));
    match.awayGoals = Number(clamp(((awayStats.avgScored + homeStats.avgConceded) / 2) * .92).toFixed(2));
    match.statsSource = 'football-data.org'; match.homeStats = homeStats; match.awayStats = awayStats;
  }
  const previous = previousData.matches?.find(item=>item.id===match.id);
  const realOdds = consensus(match, oddsEvents, previous?.bookmakerOffers);
  if (realOdds) {
    const realMarkets = ['home','draw','away','over','btts'].filter(key => realOdds[key]);
    match.odds = {...match.odds,...Object.fromEntries(realMarkets.map(key => [key,realOdds[key]]))};
    match.oddsSource = 'The Odds API'; match.bookmakerOffers = realOdds.offers; match.bookmakerCount = realOdds.offers.length; match.oddsBookmakerCounts = realOdds.counts; match.realOddsMarkets = realMarkets; match.oddsCachedMarkets=realOdds.cachedMarkets;
  }
  if (previous?.odds) match.oddsMovement=Object.fromEntries(Object.keys(match.odds).map(key=>{const before=Number(previous.odds[key]),current=Number(match.odds[key]),percent=before&&current?Number(((current-before)/before*100).toFixed(1)):0;return[key,{previous:before,current,percent,significant:Math.abs(percent)>=5}]}));
  match.suggestedPick=match.completed&&previous?.suggestedPick?previous.suggestedPick:{...recommendedMarket(match),capturedAt:new Date().toISOString()};
  return match;
});
// Défi du jour : sélection figée une fois publiée (voir pickDailyChallenge).
const dailyChallenge = pickDailyChallenge(enriched, parisDate(new Date()), Object.fromEntries(leagues.map(([, label, weight]) => [label, weight])), previousData.dailyChallenge);
await mkdir('data', { recursive: true });
const refreshedAt = new Date().toISOString(), oddsRefreshedAt=oddsEvents.length?refreshedAt:previousData.oddsRefreshedAt??null;
const secondaryOddsRefreshedAt = secondaryOddsResult.secondarySuccesses ? refreshedAt : previousData.secondaryOddsRefreshedAt ?? null;
await writeFile('data/fixtures.json', `${JSON.stringify({ generatedAt: refreshedAt, oddsRefreshedAt, oddsRefreshHours:ODDS_REFRESH_HOURS, oddsRefreshTimezone:'Europe/Paris', secondaryOddsRefreshedAt, secondaryOddsWindowHours:SECONDARY_ODDS_WINDOW_HOURS, movementThresholdPercent:5, dailyChallenge, source: 'ESPN + football-data.org + The Odds API', providerStatus: providerFailures.length ? 'partial' : 'ok', failures: providerFailures, coverage:{historicalMatches:history.length,oddsEvents:oddsEvents.length,secondaryOddsRequested:secondaryOddsResult.secondaryRequested,secondaryOddsEvents:secondaryOddsResult.secondarySuccesses,secondaryOddsMatches:enriched.filter(match=>match.realOddsMarkets?.some(key=>key==='over'||key==='btts')).length,statsMatches:enriched.filter(x=>x.statsSource).length,oddsMatches:enriched.filter(x=>x.oddsSource).length,settlements:settlements.length}, settlements, matches: enriched }, null, 2)}\n`);
console.log(`${enriched.length} rencontres, ${settlements.length} résultats récents, ${history.length} historiques, ${oddsEvents.length} événements cotés.`);
if (providerFailures.length) console.warn(providerFailures.join('\n'));
