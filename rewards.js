// Récompenses du Club (BET-57) : barème d'XP, trophées et défis hebdomadaires. Fonctions pures, sans DOM ni réseau.
// Le niveau est du prestige seul : il ne débloque rien et ne compte dans aucun classement. Chaque événement n'est enregistré qu'une fois (clé unique).
import { streakMultiplier, streakState } from './model.js';

export const XP = { counted: 2, won: 10, bigOdds: 5, bigOddsFrom: 2.5, dailyFull: 10, promotion: 200, groupChampion: 500, specialChampion: 1000, streak: { 3: 15, 5: 25, 8: 50, 12: 100 } };
// XP de fin de saison selon la place : de `max` pour le premier à `min` pour le dernier.
export const rankXp = (rank, size, min, max) => size <= 1 ? max : Math.round(min + (max - min) * (1 - (rank - 1) / (size - 1)));

// Trophées de départ : XP gagnés à l'obtention (de 50 à 500).
export const BADGES = [
  { id: 'first-pick', name: 'Premier prono', xp: 50, hint: 'Placer un premier prono compté' },
  { id: 'streak-5', name: 'Série de 5', xp: 100, hint: '5 bons pronos d’affilée à 1,50 ou plus' },
  { id: 'streak-12', name: 'Série de 12', xp: 500, hint: '12 bons pronos d’affilée à 1,50 ou plus' },
  { id: 'value-hunter', name: 'Chasseur de value', xp: 150, hint: 'Gagner 10 value bets' },
  { id: 'big-odds', name: 'Gros coup', xp: 100, hint: 'Gagner un pari à la cote de 5,00 ou plus' },
  { id: 'perfect-day', name: 'Défi parfait', xp: 150, hint: 'Réussir les 4 pronos du défi du jour' },
  { id: 'promoted', name: 'Promu', xp: 100, hint: 'Monter d’un échelon en fin de saison' },
  { id: 'group-champion', name: 'Champion de groupe', xp: 200, hint: 'Finir premier de son groupe' },
  { id: 'special-champion', name: 'Champion de ligue spéciale', xp: 300, hint: 'Remporter le titre d’une ligue spéciale' },
  { id: 'daily-30', name: '30 jours d’affilée', xp: 150, hint: 'Jouer 30 jours consécutifs' },
  { id: 'loyal', name: 'Fidèle', xp: 300, hint: 'Jouer 6 saisons' },
  { id: 'collector', name: 'Collectionneur', xp: 100, hint: 'Compléter une collection de la boutique' }
];
// Jours consécutifs jouables : plus longue série de jours (AAAA-MM-JJ) se terminant à la date la plus récente.
export function dayStreak(days) {
  const sorted = [...new Set(days)].sort(); let best = 0, run = 0, previous = null;
  for (const day of sorted) { const gap = previous ? Math.round((Date.parse(day) - Date.parse(previous)) / 864e5) : 1; run = gap === 1 ? run + 1 : 1; best = Math.max(best, run); previous = day; }
  return best;
}
// stats : {picks, bestStreak, wonOdds:[cotes des paris gagnés], valueWins, perfectDay, promoted, groupChampion, specialChampion, dayStreak, seasons, collector}. Renvoie les identifiants de trophées obtenus.
export function evaluateBadges(stats) {
  const rules = { 'first-pick': stats.picks >= 1, 'streak-5': stats.bestStreak >= 5, 'streak-12': stats.bestStreak >= 12, 'value-hunter': stats.valueWins >= 10, 'big-odds': (stats.wonOdds ?? []).some(odds => odds >= 5), 'perfect-day': Boolean(stats.perfectDay),
    promoted: Boolean(stats.promoted), 'group-champion': Boolean(stats.groupChampion), 'special-champion': Boolean(stats.specialChampion), 'daily-30': stats.dayStreak >= 30, loyal: stats.seasons >= 6, collector: Boolean(stats.collector) };
  return BADGES.filter(badge => rules[badge.id]).map(badge => badge.id);
}

// Événements d'XP à enregistrer. Les clés sont stables : rejouer le calcul ne crée jamais un second événement.
// counted : [{user_id, ref}] pronos comptés dans une ligue ; wins : [{user_id, ref, odds}] pronos gagnés ; dailyDays : [{user_id, day, played, offered, settled}] ;
// sequences : {user_id: [{id, points, odds}]} pronos de ligue générale du plus ancien au plus récent ; seasons : season_results ; specials : [{user_id, league_id, season, rank, size}] ; titles : special_titles.
export function planXpEvents({ counted = [], wins = [], dailyDays = [], sequences = {}, seasons = [], specials = [], titles = [], badges = [] }) {
  const events = [], add = (user_id, event_key, kind, xp) => { if (xp > 0) events.push({ user_id, event_key, kind, xp }); };
  for (const item of counted) add(item.user_id, `counted:${item.ref}`, 'counted', XP.counted);
  for (const item of wins) add(item.user_id, `won:${item.ref}`, 'won', XP.won + (Number(item.odds) >= XP.bigOddsFrom ? XP.bigOdds : 0));
  for (const day of dailyDays) if (day.offered === 4 && day.played === 4 && day.settled) add(day.user_id, `daily-full:${day.day}`, 'daily', XP.dailyFull);
  for (const [userId, entries] of Object.entries(sequences)) for (const step of streakState(entries).milestones) add(userId, `streak:${step.at}:${step.id}`, 'streak', XP.streak[step.at]);
  for (const result of seasons) {
    if (result.outcome === 'INACTIF' || !result.group_size) continue;
    add(result.user_id, `season:${result.season}`, 'season', rankXp(result.group_rank, result.group_size, 150, 600));
    if (result.outcome === 'PROMU') add(result.user_id, `promo:${result.season}`, 'promotion', XP.promotion);
    if (result.group_rank === 1 && result.group_size >= 10) add(result.user_id, `group-champion:${result.season}`, 'champion', XP.groupChampion);
  }
  for (const item of specials) add(item.user_id, `special:${item.league_id}:${item.season}`, 'special', rankXp(item.rank, item.size, 100, 400));
  for (const title of titles) if (title.kind === 'champion') add(title.user_id, `special-title:${title.league_id}:${title.season}`, 'special-title', XP.specialChampion);
  for (const badge of badges) add(badge.user_id, `badge:${badge.badge}`, 'badge', BADGES.find(item => item.id === badge.badge)?.xp ?? 0);
  return events;
}

// Défis hebdomadaires (les trois anciens challenges). Ils rapportent de l'XP et des jetons, jamais de points de ligue.
export const CHALLENGES = {
  'safe-week': { name: 'La semaine sécurisée', rule: 'Meilleur score avec des cotes de 2,00 ou moins' },
  'value-hunter': { name: 'Chasseur de value', rule: 'Un maximum de points sur les value bets gagnants' },
  'perfect-five': { name: 'Perfect Five', rule: 'La plus longue série de paris gagnants' }
};
export const CHALLENGE_XP = [100, 60, 30], CHALLENGE_PARTICIPATION_XP = 10;
// bets : paris certifiés réglés de la semaine du joueur, du plus ancien au plus récent [{status, stake, payout, odds, value_bet}].
export function challengeScore(id, bets) {
  const settled = bets.filter(bet => bet.status === 'won' || bet.status === 'lost');
  if (id === 'perfect-five') { let run = 0, best = 0; for (const bet of settled) { run = bet.status === 'won' ? run + 1 : 0; best = Math.max(best, run); } return { score: best, bets: settled.length, wins: settled.filter(bet => bet.status === 'won').length }; }
  const pool = id === 'safe-week' ? settled.filter(bet => Number(bet.odds) <= 2) : settled.filter(bet => bet.value_bet);
  return { score: pool.reduce((sum, bet) => sum + (bet.status === 'won' ? Math.round(Number(bet.payout) / Number(bet.stake || 1) * 10) : -5), 0), bets: pool.length, wins: pool.filter(bet => bet.status === 'won').length };
}
// Classement d'un défi : rows [{user_id, score, bets, wins}] ; renvoie les lignes classées (score puis victoires puis identifiant, stable).
export function rankChallenge(rows) {
  return rows.filter(row => row.bets > 0).sort((a, b) => b.score - a.score || b.wins - a.wins || String(a.user_id).localeCompare(String(b.user_id))).map((row, index) => ({ ...row, rank: index + 1 }));
}
export const challengeXp = rank => CHALLENGE_XP[rank - 1] ?? CHALLENGE_PARTICIPATION_XP;

// Jetons (BET-58) : monnaie fictive, jamais achetable, jamais convertible, sans valeur. Distincte de la bankroll en euros fictifs.
// Tirelire d'une ligue : chaque prono gagné compté ajoute (cote - 1) × 10 × le multiplicateur de série du moment. Un prono perdu ne retire rien.
// entries : du plus ancien au plus récent [{id, points, odds}] (points = (cote - 1) × 10 pour un gagné).
export function piggyBank(entries, shield = null) {
  let streak = 0, total = 0, shielded = false;
  const parts = [];
  for (const entry of entries) {
    const points = Number(entry.points);
    if (points < 0) { if (shield && !shielded && String(entry.settled_at ?? '') >= String(shield.from)) shielded = true; else streak = 0; continue; }
    if (points > 0) { if (Number(entry.odds) >= 1.5) streak++; const gain = Math.round(points * streakMultiplier(streak) * 100) / 100; total += gain; parts.push({ id: entry.id, gain }); }
  }
  return { total: Math.round(total * 100) / 100, parts, streak };
}
// Régularité : part des défis du jour (ou des journées) joués.
export const regularityMultiplier = share => share >= 1 ? 1.5 : share >= .8 ? 1.25 : share >= .6 ? 1.1 : 1;
// Prime de classement : cagnotte de 500 jetons par joueur du groupe, 20 % partagés à parts égales, 80 % selon 1 / rang^0,8.
export const POOL_PER_PLAYER = 500;
export function rankPrize(rank, size) {
  if (!size || rank < 1 || rank > size) return 0;
  let weights = 0;
  for (let position = 1; position <= size; position++) weights += position ** -.8;
  return Math.round(POOL_PER_PLAYER * size * (.2 / size + .8 * (rank ** -.8) / weights));
}
// Difficulté de la ligue générale selon la division (District ×1 ... Élite ×3, Champions ×4, Master ×5). Ligues spéciales : special_leagues.difficulty.
export const DIVISION_DIFFICULTY = [1, 1.25, 1.5, 2, 3, 4, 5];
export const divisionDifficulty = division => DIVISION_DIFFICULTY[division] ?? 1;
export const FEATS = { promotion: 300, barrage: 500, 'group-champion': 1000, 'master-champion': 10000, 'special-champion': 1000 };
// Fin de saison : (tirelire × régularité + prime de classement) × difficulté, plus les primes d'exploit × difficulté.
export function seasonReward({ piggy, share, prize, difficulty, feats = [] }) {
  const regularity = regularityMultiplier(share), featTotal = feats.reduce((sum, feat) => sum + (FEATS[feat] ?? 0), 0);
  return { piggy: Math.round(piggy * 100) / 100, regularity, prize, difficulty, feats, total: Math.round((piggy * regularity + prize) * difficulty + featTotal * difficulty) };
}
// Primes d'exploit d'une ligne de season_results (la prime de barrage est enregistrée par la clôture).
export function featsOf(result) {
  const feats = [];
  if (result.outcome === 'PROMU') feats.push('promotion');
  if (result.barrage) feats.push('barrage');
  if (result.group_rank === 1 && result.group_size >= 10 && result.outcome !== 'INACTIF') feats.push('group-champion');
  if (result.from_echelon === 16 && result.group_rank === 1 && result.group_size >= 2) feats.push('master-champion');
  return feats;
}
export const CHALLENGE_TOKENS = [500, 300, 150], SPECIAL_MONTH_TOKENS = [300, 200, 100], SPECIAL_CHAMPION_BONUS = 1000;
export const challengeTokens = rank => CHALLENGE_TOKENS[rank - 1] ?? 0;
// Autres usages des jetons (BET-62) : prix et plafonds fixés ici pour que le site et le serveur partagent les mêmes valeurs.
export const TOKEN_USES = { shield: 800, bankrollRefill: { price: 500, amount: 1000, below: 50 } };
