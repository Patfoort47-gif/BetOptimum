// BET-98 : données privées lues uniquement côté serveur, juste avant livraison.
import { previousParisDay } from './briefing-summary.js';
import { buildBriefing, localDate } from './notification-briefing.js';
export async function prepareBriefing(
  db,
  userId,
  event,
  prefs,
  matches,
  generatedAt,
  now = Date.now(),
  history = []
) {
  if (
    !event.briefing ||
    !prefs?.enabled ||
    !prefs.channels?.includes('email') ||
    event.date !== localDate(now, prefs.timezone) ||
    Date.parse(event.kickoff) <= now
  )
    return null;
  const kinds = event.kinds.filter((k) =>
    k === 'daily'
      ? (prefs.daily_briefing || prefs.favorite_briefing) &&
        (event.daily_revision ?? 0) === (prefs.daily_revision ?? 0) &&
        (!prefs.daily_not_before || now >= Date.parse(prefs.daily_not_before))
      : k === 'favorites' && prefs.favorite_briefing
  );
  if (!kinds.length) return null;
  const snapshot = await db('rpc/notification_briefing_snapshot', 'POST', { p_user: userId });
  const favorites = snapshot.favorites;
  const current = favorites
    ? { ...prefs, teams: favorites.teams ?? [], leagues: favorites.leagues ?? [] }
    : prefs;
  const previous = previousParisDay(now),
    settledBets = [];
  for (let offset = 0; ; offset += 1000) {
    const rows = await db(
      `bets?user_id=eq.${encodeURIComponent(userId)}&settled_at=gte.${previous.start}&settled_at=lt.${previous.end}&status=in.(won,lost,void)&select=id,status,stake,payout,settled_at&order=id&limit=1000&offset=${offset}`
    );
    if (!Array.isArray(rows)) throw Error('BRIEFING_YESTERDAY_INVALID');
    settledBets.push(...rows);
    if (rows.length < 1000) break;
  }
  return buildBriefing(
    matches,
    current,
    { ...event, kinds },
    snapshot.account,
    snapshot.bets,
    now,
    generatedAt,
    { history, settledBets }
  );
}
