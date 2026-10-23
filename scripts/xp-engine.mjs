// Moteur d'XP, de trophées et de défis hebdomadaires (BET-57). Décisions pures dans rewards.js ; ce fichier assemble les données et écrit avec la clé service_role.
import { streakState, weekKey } from '../model.js';
import { completedCollections } from '../shop.js';
import { challengeScore, challengeTokens, challengeXp, dayStreak, evaluateBadges, planXpEvents, rankChallenge } from '../rewards.js';

const parisDay = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
export const group = (rows, key) => { const map = new Map(); for (const row of rows) map.set(row[key], [...(map.get(row[key]) ?? []), row]); return map; };
const effectiveOdds = bet => bet.status === 'won' && Number(bet.stake) > 0 ? Number(bet.payout) / Number(bet.stake) : Number(bet.odds);

// Pronos de ligue générale par joueur, du plus ancien au plus récent, avec la cote du ticket ou du prono du défi.
export function entrySequences(entries, betById, pickById) {
  const sequences = {};
  for (const [user, list] of group(entries.slice().sort((a, b) => String(a.settled_at).localeCompare(String(b.settled_at))), 'user_id'))
    sequences[user] = list.map(entry => ({ id: entry.id, settled_at: entry.settled_at, points: entry.points, odds: entry.bet_id ? Number(betById.get(entry.bet_id)?.odds ?? 0) : Number(pickById.get(entry.daily_pick_id)?.odd ?? 0) }));
  return sequences;
}
// Assemble les entrées de planXpEvents et les statistiques de trophées à partir des lignes de la base (fonction pure, testée).
export function buildXpInputs({ entries, bets, dailyPicks, challenges, specialPicks, seasonResults, standings, titles, collectors = new Set() }) {
  const betById = new Map(bets.map(bet => [bet.id, bet])), pickById = new Map(dailyPicks.map(pick => [pick.id, pick]));
  const counted = [...entries.map(entry => ({ user_id: entry.user_id, ref: `le:${entry.id}` })), ...specialPicks.filter(pick => pick.status !== 'pending').map(pick => ({ user_id: pick.user_id, ref: `sp:${pick.id}` }))];
  const countedBets = new Set([...entries.map(entry => entry.bet_id), ...specialPicks.map(pick => pick.bet_id)].filter(Boolean));
  const wins = [...bets.filter(bet => bet.status === 'won' && countedBets.has(bet.id)).map(bet => ({ user_id: bet.user_id, ref: `bet:${bet.id}`, odds: effectiveOdds(bet) })),
    ...dailyPicks.filter(pick => pick.status === 'won').map(pick => ({ user_id: pick.user_id, ref: `daily:${pick.id}`, odds: Number(pick.odd) })),
    ...specialPicks.filter(pick => pick.source === 'grid' && pick.status === 'won').map(pick => ({ user_id: pick.user_id, ref: `grid:${pick.id}`, odds: Number(pick.odd) }))];
  const offered = new Map(challenges.map(item => [item.day, item.picks.length])), dailyDays = [];
  for (const [user, picks] of group(dailyPicks, 'user_id')) for (const [day, list] of group(picks, 'day')) dailyDays.push({ user_id: user, day, played: list.length, offered: offered.get(day) ?? 0, settled: list.every(pick => pick.status !== 'pending') });
  const sequences = entrySequences(entries, betById, pickById);
  const titled = new Set(titles.map(title => `${title.league_id}|${title.season}`)), specials = [];
  for (const [league, rows] of group(standings.filter(row => row.scope === 'season' && row.picks > 0), 'league_id')) for (const season of [...titled].filter(key => key.startsWith(`${league}|`)).map(key => key.split('|')[1])) for (const row of rows) specials.push({ user_id: row.user_id, league_id: league, season, rank: row.rank, size: rows.length });
  const stats = {};
  const users = new Set([...entries, ...bets, ...dailyPicks, ...specialPicks, ...seasonResults, ...titles].map(item => item.user_id));
  for (const user of users) {
    const own = sequences[user] ?? [], ownBets = bets.filter(bet => bet.user_id === user && bet.status === 'won'), days = [...entries.filter(entry => entry.user_id === user).map(entry => parisDay(entry.settled_at)), ...dailyPicks.filter(pick => pick.user_id === user).map(pick => pick.day)], results = seasonResults.filter(result => result.user_id === user);
    const perDay = dailyDays.filter(day => day.user_id === user && day.offered === 4 && day.played === 4);
    stats[user] = { picks: counted.filter(item => item.user_id === user).length, bestStreak: streakState(own).best, wonOdds: ownBets.map(effectiveOdds), valueWins: ownBets.filter(bet => bet.value_bet).length,
      perfectDay: perDay.some(day => dailyPicks.filter(pick => pick.user_id === user && pick.day === day.day).every(pick => pick.status === 'won')), promoted: results.some(result => result.outcome === 'PROMU'),
      groupChampion: results.some(result => result.group_rank === 1 && result.group_size >= 10 && result.outcome !== 'INACTIF'), specialChampion: titles.some(title => title.user_id === user && title.kind === 'champion'), dayStreak: dayStreak(days), seasons: results.filter(result => result.outcome !== 'INACTIF').length, collector: collectors.has(user) };
  }
  return { counted, wins, dailyDays, sequences, seasons: seasonResults, specials, titles, stats };
}

export async function awardXp(admin, now = new Date()) {
  const since = new Date(now.getTime() - 120 * 864e5).toISOString(), sinceDay = since.slice(0, 10);
  const [entries, bets, dailyPicks, challenges, specialPicks, seasonResults, standings, titles, owned, inventories, shopItems] = await Promise.all([
    admin.selectAll('league_entries', `league=eq.general&settled_at=gte.${since}&select=id,user_id,bet_id,daily_pick_id,points,settled_at`),
    admin.selectAll('bets', `status=in.(won,lost,void)&settled_at=gte.${since}&select=id,user_id,odds,stake,payout,status,value_bet,counts_general`),
    admin.selectAll('daily_picks', `day=gte.${sinceDay}&select=id,user_id,day,odd,status`),
    admin.selectAll('daily_challenges', `day=gte.${sinceDay}&select=day,picks`),
    admin.selectAll('special_picks', 'status=neq.pending&select=id,user_id,source,bet_id,status,odd'),
    admin.selectAll('season_results', 'select=season,user_id,outcome,group_rank,group_size'),
    admin.selectAll('special_standings', 'scope=eq.season&select=league_id,scope,user_id,picks,rank'),
    admin.selectAll('special_titles', 'select=league_id,season,user_id,kind'),
    admin.selectAll('user_badges', 'select=user_id,badge'),
    admin.selectAll('inventories', 'select=user_id,item_id'),
    admin.selectAll('shop_items', 'collection=not.is.null&select=id,collection')
  ]);
  const catalog = shopItems, collectors = new Set([...group(inventories, 'user_id')].filter(([, rows]) => completedCollections(catalog, rows.map(row => row.item_id)).length).map(([user]) => user));
  const inputs = buildXpInputs({ entries, bets, dailyPicks, challenges, specialPicks, seasonResults, standings, titles, collectors }), have = new Set(owned.map(item => `${item.user_id}|${item.badge}`)), earned = [];
  for (const [user, stats] of Object.entries(inputs.stats)) for (const badge of evaluateBadges(stats)) if (!have.has(`${user}|${badge}`)) earned.push({ user_id: user, badge });
  await admin.insertIgnore('user_badges', earned, 'user_id,badge');
  const badgeRows = [...owned, ...earned], events = planXpEvents({ ...inputs, badges: badgeRows });
  await admin.insertIgnore('xp_events', events, 'user_id,event_key');
  return events.length + (await closeWeeklyChallenges(admin, now));
}

// Défis hebdomadaires terminés : classement, XP par place (jamais de points de ligue).
export async function closeWeeklyChallenges(admin, now = new Date()) {
  const current = weekKey(now), entries = (await admin.selectAll('challenge_entries', `week_start=lt.${current}&select=user_id,challenge_id,week_start`));
  if (!entries.length) return 0;
  const done = new Set((await admin.selectAll('challenge_results', `week_start=lt.${current}&select=week_start,challenge_id`)).map(row => `${row.week_start}|${row.challenge_id}`));
  const weeks = [...new Set(entries.map(entry => entry.week_start))].filter(week => entries.some(entry => entry.week_start === week && !done.has(`${week}|${entry.challenge_id}`)));
  let written = 0;
  for (const week of weeks) {
    const bets = await admin.selectAll('bets', `week_start=eq.${week}&status=in.(won,lost)&order=settled_at.asc&select=user_id,status,stake,payout,odds,value_bet`);
    for (const [challenge, list] of group(entries.filter(entry => entry.week_start === week && !done.has(`${week}|${entry.challenge_id}`)), 'challenge_id')) {
      const rows = rankChallenge(list.map(entry => ({ user_id: entry.user_id, ...challengeScore(challenge, bets.filter(bet => bet.user_id === entry.user_id)) })));
      await admin.insertIgnore('challenge_results', rows.map(row => ({ week_start: week, challenge_id: challenge, user_id: row.user_id, score: row.score, bets: row.bets, wins: row.wins, rank: row.rank })), 'week_start,challenge_id,user_id');
      await admin.insertIgnore('xp_events', rows.map(row => ({ user_id: row.user_id, event_key: `challenge:${week}:${challenge}`, kind: 'challenge', xp: challengeXp(row.rank) })), 'user_id,event_key');
      await admin.insertIgnore('token_ledger', rows.filter(row => challengeTokens(row.rank) > 0).map(row => ({ user_id: row.user_id, delta: challengeTokens(row.rank), reason: 'challenge', ref: `${week}:${challenge}` })), 'user_id,reason,ref');
      written += rows.length;
    }
  }
  return written;
}
