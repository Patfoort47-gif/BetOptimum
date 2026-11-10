import { fairMarket, dataConfidence } from './opportunity.js';
import { quoteAvailable, selectionBookmakerCount, matchHasAvailableQuote } from './quote-policy.js';
import {
  marketKeys,
  marketSpec,
  scoreOutcome,
  LEGACY_MARKETS,
  extendedPriceAvailable
} from './markets.js';
import { forecastMatch, analysisFamilies } from './prediction-model.js';
// Calculs purs partagés par le site (app.js) et le pipeline de données (scripts/update-fixtures.mjs).
export function poisson(k, lambda) {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return (Math.exp(-lambda) * lambda ** k) / f;
}
function computeAnalysis(match) {
  const { probs, reference } = forecastMatch(match, { includeExtended: true });
  const markets = marketKeys(match.odds)
    .filter((key) => extendedPriceAvailable(match, key))
    .map((key) => {
      const { label, family, dnb } = marketSpec(key, match);
      return [key, label, family, dnb];
    })
    .map(([key, label, family, dnb]) => {
      const odd = Number(match.odds[key]),
        real = match.realOddsMarkets?.includes(key) === true;
      const refundProbability = dnb ? probs.draw : 0;
      const marketProbability = fairMarket(match, key);
      return {
        key,
        label,
        family,
        odd,
        available: quoteAvailable(match, key),
        probability: probs[key] ?? null,
        refundProbability,
        marketProbability,
        marketDelta: marketProbability == null ? null : probs[key] - marketProbability,
        dataConfidence: dataConfidence(match, key),
        value:
          Number.isFinite(probs[key]) && real && Number.isFinite(odd) && odd > 1
            ? probs[key] * odd + refundProbability - 1
            : null,
        real
      };
    });
  return {
    probs,
    markets,
    reference,
    families: analysisFamilies(markets),
    confidence: Math.round(Math.max(...markets.map((m) => m.probability)) * 100)
  };
}
// Cache borné invalidé par les entrées complètes, jamais par les filtres visuels.
const analysisCache = new Map();
export const analysisKey = (match) => JSON.stringify(match);
export function primeAnalysis(match, result) {
  const key = analysisKey(match);
  if (analysisCache.size >= 1024) analysisCache.delete(analysisCache.keys().next().value);
  analysisCache.set(key, result);
}
export function analyseMatch(match) {
  const key = analysisKey(match);
  if (!analysisCache.has(key)) primeAnalysis(match, computeAnalysis(match));
  const result = analysisCache.get(key);
  return {
    ...result,
    probs: { ...result.probs },
    markets: result.markets.map((m) => ({ ...m, dataConfidence: { ...m.dataConfidence } })),
    reference: result.reference ? { ...result.reference } : null,
    families: structuredClone(result.families)
  };
}
// BET-175 : règle unique pour chaque match, les suggestions, les combinés et la sélection du jour.
export function rankRecommendedMarkets(markets) {
  return markets
    .filter(
      (m) =>
        m.available === true &&
        m.real === true &&
        marketSpec(m.key) &&
        Number.isFinite(m.odd) &&
        m.odd > 1.15 &&
        Number.isFinite(m.probability) &&
        m.probability >= 0 &&
        m.probability <= 1 + 1e-12
    )
    .slice()
    .sort((a, b) => b.probability - a.probability || a.key.localeCompare(b.key));
}
export function recommendedMarket(match) {
  if (![match?.homeGoals, match?.awayGoals].every((n) => Number.isFinite(n) && n > 0 && n <= 10))
    return null;
  const pick = rankRecommendedMarkets(analyseMatch(match).markets)[0];
  return pick
    ? {
        ...pick,
        probability: Math.min(1, pick.probability),
        basis: 'real-odds',
        modelVersion: 'poisson-confidence-v4'
      }
    : null;
}
export function confidenceKpi(predictions, matches, today) {
  const start = new Date(`${today}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 10);
  const startDate = start.toISOString().slice(0, 10),
    recent = (predictions ?? []).filter(
      (item) => item.date >= startDate && item.date < today && ['won', 'lost'].includes(item.status)
    ),
    wins = recent.filter((item) => item.status === 'won').length,
    form = recent.length ? wins / recent.length : null,
    todayProbabilities = (matches ?? [])
      .filter((match) => match.date === today)
      .map(
        (match) =>
          (match.completed ||
          Date.parse(match.kickoff ?? `${match.date}T${match.time || '12:00'}:00`) <= Date.now()
            ? match.suggestedPick
            : recommendedMarket(match)
          )?.probability
      )
      .filter(Number.isFinite),
    todayConfidence = todayProbabilities.length
      ? todayProbabilities.reduce((sum, value) => sum + value, 0) / todayProbabilities.length
      : null,
    score = form == null || todayConfidence == null ? null : form * 0.75 + todayConfidence * 0.25;
  return {
    score,
    form,
    todayConfidence,
    wins,
    recentCount: recent.length,
    todayCount: todayProbabilities.length,
    startDate,
    today
  };
}
// BET-175 : compare toutes les issues proposées, avec leur probabilité de gain (nul remboursé exclu).
export function selectDailySelection(
  matches,
  day = parisDate(Date.now()),
  now = Date.now(),
  liveIds = new Set()
) {
  const candidates = [];
  for (const match of matches ?? []) {
    if (
      match.date !== day ||
      match.completed ||
      match.voided ||
      liveIds.has(match.id) ||
      !(new Date(match.kickoff ?? `${match.date}T${match.time || '12:00'}:00`).getTime() > now)
    )
      continue;
    const pick = recommendedMarket(match);
    if (pick) candidates.push({ match, pick });
  }
  return (
    candidates.sort(
      (a, b) =>
        b.pick.probability - a.pick.probability ||
        String(a.match.kickoff ?? a.match.time).localeCompare(
          String(b.match.kickoff ?? b.match.time)
        ) ||
        String(a.match.id).localeCompare(String(b.match.id)) ||
        a.pick.key.localeCompare(b.pick.key)
    )[0] ?? null
  );
}
// BET-275 : popularité, opportunité positive, puis couverture historique ; jamais de cote inventée.
const spotlightKickoff = (m) =>
  new Date(m.kickoff ?? `${m.date}T${m.time || '12:00'}:00`).getTime();
const spotlightHistory = (m) =>
  [m.homeStats, m.awayStats].reduce((n, s) => n + Math.max(0, Number(s?.sample) || 0), 0);
export function selectSpotlight(matches, now = Date.now(), liveIds = new Set()) {
  const upcoming = (matches ?? []).filter(
    (m) =>
      matchHasAvailableQuote(m) &&
      !m.completed &&
      !m.voided &&
      !liveIds.has(m.id) &&
      spotlightKickoff(m) > now
  );
  if (!upcoming.length) return null;
  const day = parisDate(Math.min(...upcoming.map(spotlightKickoff))),
    sameDay = upcoming.filter((m) => parisDate(spotlightKickoff(m)) === day),
    tie = (a, b) =>
      spotlightKickoff(a) - spotlightKickoff(b) || String(a.id).localeCompare(String(b.id)),
    majors = sameDay.filter((m) => m.featured || Number(m.priority) >= 75);
  if (majors.length)
    return majors.sort(
      (a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0) || tie(a, b)
    )[0];
  const value = sameDay
    .map((match) => ({ match, pick: recommendedMarket(match) }))
    .filter((x) => x.pick?.value > 0 && x.pick.probability >= 0.5)
    .sort(
      (a, b) =>
        b.pick.value - a.pick.value ||
        b.pick.probability - a.pick.probability ||
        tie(a.match, b.match)
    );
  return (
    value[0]?.match ??
    sameDay.sort((a, b) => spotlightHistory(b) - spotlightHistory(a) || tie(a, b))[0]
  );
}

export function optimizeCombo(matches, target = 3, maxCount = 3, risk = 'balanced') {
  const profiles = {
      safe: { minProbability: 0.5, maxOdd: 2.5, valueWeight: 0.05, riskWeight: 1.15 },
      balanced: { minProbability: 0.42, maxOdd: 5, valueWeight: 0.15, riskWeight: 0.75 },
      bold: { minProbability: 0.28, maxOdd: 8, valueWeight: 0.65, riskWeight: 0.35 }
    },
    profile = profiles[risk] ?? profiles.balanced;
  const candidates = matches
    .map((match) => ({
      ...recommendedMarket(match),
      matchId: match.id,
      match: `${match.home} – ${match.away}`,
      home: match.home,
      away: match.away,
      league: match.league,
      date: match.date,
      time: match.time
    }))
    .filter(
      (x) => x.available && x.probability >= profile.minProbability && x.odd <= profile.maxOdd
    )
    .sort(
      (a, b) =>
        b.probability +
        Math.max(0, b.value) * profile.valueWeight -
        (a.probability + Math.max(0, a.value) * profile.valueWeight)
    )
    .slice(0, 18);
  let best = [],
    bestScore = Infinity;
  const evaluate = (selection) => {
    const odds = selection.reduce((p, x) => p * x.odd, 1),
      confidence = selection.reduce((p, x) => p * x.probability, 1) ** (1 / selection.length),
      value = selection.reduce((sum, x) => sum + Math.max(0, x.value), 0) / selection.length,
      distance = Math.abs(Math.log(odds / target)),
      under = odds < target ? 0.08 : 0,
      score =
        distance * 3 + under + (1 - confidence) * profile.riskWeight - value * profile.valueWeight;
    if (score < bestScore) {
      bestScore = score;
      best = [...selection];
    }
  };
  const search = (index, selection) => {
    if (selection.length >= 2) evaluate(selection);
    if (selection.length === maxCount) return;
    for (let i = index; i < candidates.length; i++) search(i + 1, [...selection, candidates[i]]);
  };
  search(0, []);
  return best;
}
export function selectionResult(item, results) {
  const teams = (item.match ?? '').split(/\s+[–-]\s+/),
    homeTeam = item.home ?? teams[0],
    awayTeam = item.away ?? teams[1];
  const result = results.find(
    (match) =>
      match.id === item.matchId ||
      (homeTeam && awayTeam && match.home === homeTeam && match.away === awayTeam)
  );
  if (result?.voided) return { status: 'void', result };
  if (!result?.completed) return { status: 'pending', result: null };
  const period = marketSpec(item.key)?.period;
  if (period) {
    const scores = result.periodScores?.[period];
    if (
      !scores ||
      result.periodScores?.source !== 'ESPN' ||
      result.periodScores?.matchId !== result.id ||
      result.periodScores?.final?.home !== result.homeScore ||
      result.periodScores?.final?.away !== result.awayScore ||
      ![scores.home, scores.away].every((n) => Number.isInteger(n) && n >= 0)
    )
      return { status: 'pending', result: null };
    return { status: scoreOutcome(item.key, scores.home, scores.away) ?? 'pending', result };
  }
  const regulation =
      !LEGACY_MARKETS.includes(item.key) && result.regulation?.extraTime ? result.regulation : null,
    home = regulation ? regulation.home : result.homeScore,
    away = regulation ? regulation.away : result.awayScore;
  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0)
    return { status: 'pending', result: null };
  return { status: scoreOutcome(item.key, home, away) ?? 'pending', result };
}
export function settleBet(bet, results) {
  let waiting = false,
    played = 0;
  for (const item of bet.items) {
    const selection = selectionResult(item, results);
    if (selection.status === 'lost') return 'lost';
    if (selection.status === 'pending') waiting = true;
    else if (selection.status === 'won') played++;
  }
  return waiting ? 'pending' : played ? 'won' : 'void';
}
export function combinations(size, pick) {
  const result = [];
  const walk = (start, current) => {
    if (current.length === pick) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < size; i++) walk(i + 1, [...current, i]);
  };
  walk(0, []);
  return result;
}
export function systemLines(items, formula = 'auto') {
  const n = items.length,
    required = { trixie: 3, yankee: 4, '2of3': 3, '2of4': 4, '3of4': 4 }[formula];
  if (required && n !== required) return [];
  const patterns =
    formula === 'trixie'
      ? [[2], [3]]
      : formula === 'yankee'
        ? [[2], [3], [4]]
        : formula === '2of3'
          ? [[2]]
          : formula === '2of4'
            ? [[2]]
            : formula === '3of4'
              ? [[3]]
              : [[Math.max(2, n - 1)]];
  return patterns.flatMap(([pick]) =>
    pick <= n
      ? combinations(n, pick).map((indexes) => ({
          indexes,
          odds: indexes.reduce((product, index) => product * items[index].odd, 1)
        }))
      : []
  );
}
export function settleSystemBet(bet, results) {
  const selections = bet.items.map((item) => selectionResult(item, results).status);
  if (selections.includes('pending')) return { status: 'pending', returnAmount: 0, wonLines: 0 };
  let returnAmount = 0,
    wonLines = 0;
  for (const line of bet.systemLines ?? []) {
    if (line.indexes.every((index) => selections[index] === 'won')) {
      returnAmount += line.stake * line.odds;
      wonLines++;
    }
  }
  return { status: wonLines ? 'won' : 'lost', returnAmount, wonLines };
}
// Règlement officiel d'un ticket certifié (serveur) : une sélection annulée est retirée du calcul (cote 1), un ticket entièrement annulé est remboursé.
// bet : {betType, stake, items:[{matchId,key,odd}], systemLines:[{indexes,odds,stake}]}. Renvoie {status:'pending'|'won'|'lost'|'void', payout}.
const cents = (value) => Math.round(value * 100) / 100;
export function settleTicket(bet, results) {
  const stake = Number(bet.stake) || 0,
    legs = bet.items.map((item) => ({
      odd: Number(item.odd),
      status: selectionResult(item, results).status
    }));
  if (bet.betType === 'multiple') {
    let payout = 0,
      waiting = false,
      wonLines = 0;
    for (const line of bet.systemLines ?? []) {
      const own = line.indexes.map((index) => legs[index]);
      if (own.some((leg) => leg.status === 'lost')) continue;
      if (own.some((leg) => leg.status === 'pending')) {
        waiting = true;
        continue;
      }
      const played = own.filter((leg) => leg.status === 'won');
      payout += Number(line.stake) * played.reduce((product, leg) => product * leg.odd, 1);
      if (played.length) wonLines++;
    }
    if (waiting) return { status: 'pending', payout: 0 };
    return { status: wonLines ? 'won' : payout > 0 ? 'void' : 'lost', payout: cents(payout) };
  }
  if (legs.some((leg) => leg.status === 'lost')) return { status: 'lost', payout: 0 };
  if (legs.some((leg) => leg.status === 'pending')) return { status: 'pending', payout: 0 };
  const played = legs.filter((leg) => leg.status === 'won');
  return played.length
    ? {
        status: 'won',
        payout: cents(stake * played.reduce((product, leg) => product * leg.odd, 1))
      }
    : { status: 'void', payout: cents(stake) };
}
// BET-132 : barème unique pour tous les pronostics, historique compris.
export const WEEKLY_QUOTA = 10,
  LEAGUE_ODDS_CAP = 5,
  LEAGUE_SCORE_VERSION = 2,
  MIN_RANKED_PICKS = 10;
export function leaguePoints({ status, odds }) {
  const odd = Number(odds),
    cap = LEAGUE_ODDS_CAP;
  return status === 'won'
    ? Number.isFinite(odd) && odd >= 1
      ? Math.round((Math.min(odd, cap) - 1) * 1000 + 1e-9) / 100
      : 0
    : status === 'lost'
      ? -1
      : 0;
}
// ROI normalisé des points, sans effet de la mise ni des annulations.
export function leagueRoi(points, decided) {
  return decided > 0
    ? (Math.sign(points) * Math.round((Math.abs(points) * 1000) / (decided * 10) + 1e-9)) / 10
    : 0;
}
const parisDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});
// Lundi (heure de Paris) de la semaine d'un instant, au format AAAA-MM-JJ : la semaine va du lundi 00:00 au dimanche 23:59.
export function weekKey(date) {
  const [y, m, d] = parisDay.format(new Date(date)).split('-').map(Number),
    day = new Date(Date.UTC(y, m - 1, d));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}
// Paris certifiés (forme du site : date, countsGeneral, items) comptés dans la semaine de `now` et places restantes.
export function quotaUsed(bets, now = Date.now()) {
  const week = weekKey(now);
  return bets.filter((bet) => bet.countsGeneral && weekKey(bet.date) === week).length;
}
export function quotaRemaining(bets, now = Date.now(), limit = WEEKLY_QUOTA) {
  return Math.max(0, limit - quotaUsed(bets, now));
}
// Un ticket compte en ligue s'il reste du quota et si aucun de ses matchs n'a déjà servi à un ticket compté (mêmes règles que le serveur).
export function leagueEligibility(matchIds, bets, now = Date.now()) {
  const remaining = quotaRemaining(bets, now);
  if (!remaining) return { counts: false, reason: 'QUOTA', remaining };
  const used = new Set(
    bets.filter((bet) => bet.countsGeneral).flatMap((bet) => bet.items.map((item) => item.matchId))
  );
  return matchIds.some((id) => used.has(id))
    ? { counts: false, reason: 'MATCH_DEJA_COMPTE', remaining }
    : { counts: true, reason: null, remaining };
}
// Même départage dans tous les classements : points, ROI, victoires, identifiant stable sans avantage d'ancienneté.
export function tieBreak(a, b) {
  return (
    b.points - a.points ||
    b.roi - a.roi ||
    (b.wins ?? 0) - (a.wins ?? 0) ||
    String(a.user_id ?? a.id ?? '').localeCompare(String(b.user_id ?? b.id ?? ''), 'en')
  );
}
// Défi du jour (BET-54) : 4 matchs du jour (heure de Paris) avec cotes 1N2 réelles, classés par importance de la compétition puis cotes les plus serrées.
// `previous` est le défi déjà publié : ses matchs et ses cotes restent figés, seules les places libres sont complétées avec des matchs pas encore commencés.
export const parisDate = (date) => parisDay.format(new Date(date));
export function pickDailyChallenge(
  matches,
  day,
  weights = {},
  previous = null,
  now = Date.now(),
  size = 4
) {
  const real = (match) => ['home', 'draw', 'away'].every((key) => quoteAvailable(match, key)),
    spread = (match) =>
      Math.max(match.odds.home, match.odds.draw, match.odds.away) -
      Math.min(match.odds.home, match.odds.draw, match.odds.away);
  const kept = previous?.date === day ? previous.picks : [],
    taken = new Set(kept.map((pick) => pick.matchId));
  const added = matches
    .filter(
      (match) =>
        parisDate(match.kickoff) === day &&
        !match.completed &&
        !match.voided &&
        real(match) &&
        !taken.has(match.id) &&
        new Date(match.kickoff) > now
    )
    .sort(
      (a, b) =>
        (weights[b.league] ?? 0) - (weights[a.league] ?? 0) ||
        spread(a) - spread(b) ||
        String(a.id).localeCompare(String(b.id))
    )
    .slice(0, Math.max(0, size - kept.length))
    .map((match) => ({
      matchId: match.id,
      league: match.league,
      home: match.home,
      away: match.away,
      kickoff: match.kickoff,
      odds: { home: match.odds.home, draw: match.odds.draw, away: match.odds.away },
      bookmakerCounts: Object.fromEntries(
        ['home', 'draw', 'away'].map((key) => [key, selectionBookmakerCount(match, key)])
      ),
      bookmakers: selectionBookmakerCount(match, 'home')
    }));
  return { date: day, picks: [...kept, ...added] };
}
// Niveaux 1 à 1000 (BET-57) : XP pour passer du niveau n au niveau n+1 = 80 + 4 × n^0,75, arrondi à 5. Le niveau ne débloque rien.
export const MAX_LEVEL = 1000;
export const xpForLevel = (n) => Math.round((80 + 4 * Math.pow(n, 0.75)) / 5) * 5;
const levelStarts = (() => {
  const starts = [0, 0];
  for (let n = 1; n < MAX_LEVEL; n++) starts.push(starts[n] + xpForLevel(n));
  return starts;
})();
export const totalXpForLevel = (level) => levelStarts[Math.min(MAX_LEVEL, Math.max(1, level))];
export function levelFromXp(xp) {
  const total = Math.max(0, Number(xp) || 0);
  let low = 1,
    high = MAX_LEVEL;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (levelStarts[mid] <= total) low = mid;
    else high = mid - 1;
  }
  const next = low < MAX_LEVEL ? xpForLevel(low) : 0,
    into = total - levelStarts[low];
  return { level: low, into, next, progress: next ? into / next : 1, total };
}
export const TITLES = [
  [1, 'Rookie'],
  [25, 'Titulaire'],
  [100, 'Confirmé'],
  [250, 'Expert'],
  [500, 'Vétéran'],
  [750, 'Légende'],
  [1000, 'Immortel']
];
export const titleForLevel = (level) => TITLES.filter(([from]) => level >= from).at(-1)[1];
// Série de pronos comptés (BET-58 s'appuie dessus) : entries triées du plus ancien au plus récent [{id, points, odds}]. Seuls les pronos gagnés à 1,50 ou plus
// font avancer la série, une défaite la remet à zéro, un prono annulé ou gagné sous 1,50 ne la change pas. Multiplicateurs : 3 → ×1,2 ; 5 → ×1,5 ; 8 → ×2 ; 12 → ×3.
export const STREAK_STEPS = [
  [12, 3],
  [8, 2],
  [5, 1.5],
  [3, 1.2]
];
export const streakMultiplier = (count) =>
  (STREAK_STEPS.find(([from]) => count >= from) ?? [0, 1])[1];
// shield : {from} (date ISO d'achat du bouclier) ; la première défaite réglée à partir de cette date ne remet pas la série à zéro (usage unique).
export function streakState(entries, shield = null) {
  let current = 0,
    best = 0,
    shielded = false;
  const milestones = [];
  for (const entry of entries) {
    const points = Number(entry.points);
    if (points < 0) {
      if (shield && !shielded && String(entry.settled_at ?? '') >= String(shield.from)) {
        shielded = true;
      } else current = 0;
    } else if (points > 0 && Number(entry.odds) >= 1.5) {
      current++;
      best = Math.max(best, current);
      if ([3, 5, 8, 12].includes(current)) milestones.push({ at: current, id: entry.id });
    }
  }
  return { current, best, multiplier: streakMultiplier(current), milestones, shieldUsed: shielded };
}
// Carte joueur (BET-50) : 6 attributs sur 99 calculés à partir de chiffres bruts publics (vue public_player_card), note générale pondérée.
// raw : {settled, wins, staked, returned, avgOdds, tickets30, activeDays30, avgStakeRatio}. Provisoire tant que moins de 10 paris sont réglés.
export const CARD_ATTRIBUTES = ['PRÉ', 'VAL', 'RÉG', 'AUD', 'VOL', 'DIS'];
export const CARD_PROVISIONAL_BELOW = 10;
const scale99 = (value, low, high) =>
  Math.round(20 + 79 * Math.min(1, Math.max(0, (value - low) / (high - low))));
export function cardAttributes(raw = {}) {
  const settled = Number(raw.settled) || 0,
    rate = settled ? Number(raw.wins || 0) / settled : 0,
    staked = Number(raw.staked) || 0,
    roi = staked > 0 ? ((Number(raw.returned || 0) - staked) / staked) * 100 : 0;
  return {
    PRÉ: settled ? scale99(rate, 0.2, 0.7) : 20, // précision : part de paris gagnés
    VAL: settled ? scale99(roi, -30, 40) : 20, // value : rendement des mises
    RÉG: scale99(Number(raw.activeDays30) || 0, 0, 20), // régularité : jours actifs sur 30
    AUD: Number(raw.avgOdds) > 0 ? scale99(Number(raw.avgOdds), 1.3, 4) : 20, // audace : cote moyenne
    VOL: scale99(Math.log10(1 + (Number(raw.tickets30) || 0)), 0, Math.log10(101)), // volume : tickets sur 30 jours
    DIS: raw.avgStakeRatio == null ? 50 : scale99(0.2 - Number(raw.avgStakeRatio), 0, 0.18) // discipline : mise moyenne rapportée au capital initial
  };
}
// BET-147 : les axes inconnus restent absents, sans note fictive.
export function cardRadarAttributes(raw = {}) {
  raw = raw ?? {};
  const valid = (key) =>
      raw[key] != null && Number.isFinite(Number(raw[key])) && Number(raw[key]) >= 0,
    attributes = cardAttributes(
      Object.fromEntries(Object.entries(raw).filter(([key]) => valid(key)))
    ),
    has = (...keys) => keys.every(valid);
  return {
    PRÉ:
      has('settled', 'wins') && Number(raw.settled) > 0 && Number(raw.wins) <= Number(raw.settled)
        ? attributes.PRÉ
        : null,
    VAL:
      has('settled', 'staked', 'returned') && Number(raw.settled) > 0 && Number(raw.staked) > 0
        ? attributes.VAL
        : null,
    RÉG: valid('activeDays30') ? attributes.RÉG : null,
    AUD: valid('avgOdds') && Number(raw.avgOdds) > 0 ? attributes.AUD : null,
    VOL: valid('tickets30') ? attributes.VOL : null,
    DIS: valid('avgStakeRatio') && has('settled') && Number(raw.settled) > 0 ? attributes.DIS : null
  };
}
export const cardOverall = (attributes) =>
  Math.min(
    99,
    Math.max(
      1,
      Math.round(
        0.2 * attributes.PRÉ +
          0.2 * attributes.VAL +
          0.2 * attributes.RÉG +
          0.1 * attributes.AUD +
          0.1 * attributes.VOL +
          0.2 * attributes.DIS
      )
    )
  );
export const cardProvisional = (raw) => (Number(raw?.settled) || 0) < CARD_PROVISIONAL_BELOW;
// Moyenne des attributs d'un groupe de joueurs, pour le radar comparé.
export function averageAttributes(list) {
  const out = {};
  for (const key of CARD_ATTRIBUTES)
    out[key] = list.length
      ? Math.round(list.reduce((sum, item) => sum + item[key], 0) / list.length)
      : 0;
  return out;
}
