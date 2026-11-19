import { decimal } from '../core/number-format.js';
import { dailyPicks, dayInZone } from '../club/daily-picks.js';
import { localMinute, quietAt } from './notification-model.js';
export function planDailyPush(matches, prefs, now = Date.now()) {
  if (!prefs?.enabled || !prefs.daily_summary || prefs.essential || quietAt(now, prefs))
    return null;
  const minute = localMinute(now, prefs.timezone);
  if (minute < 540 || minute >= 555) return null;
  const picks = dailyPicks(matches, prefs.timezone, now).slice(0, 1);
  if (!picks.length) return null;
  const expiry =
    now +
    (555 - minute) * 60000 -
    new Date(now).getUTCSeconds() * 1000 -
    new Date(now).getUTCMilliseconds();
  return {
    web: true,
    daily_summary: true,
    date: dayInZone(now, prefs.timezone),
    timezone: prefs.timezone,
    picks: picks.map(({ match, pick }) => ({
      match_id: match.id,
      home: match.home,
      away: match.away,
      market: pick.key,
      label: pick.label,
      odd: pick.odd,
      confidence: pick.probability
    })),
    kickoff: new Date(expiry).toISOString(),
    expires_at: new Date(expiry).toISOString()
  };
}
export function dailyPushCurrent(event, prefs, matches, now = Date.now()) {
  const current = planDailyPush(matches, prefs, now);
  return event.daily_summary && current && event.date === current.date ? current : null;
}
export function dailyPushText(event) {
  return event.picks
    .slice(0, 1)
    .map((p) => `${p.home} - ${p.away} : ${p.label} · cote ${decimal(p.odd)}`)
    .join('');
}
