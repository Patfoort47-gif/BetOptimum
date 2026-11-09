// BET-242 : rappels de calendrier, indépendants des cotes et des opportunités.
import { quoteAvailable } from './quote-policy.js';
import { recommendedMarket } from './model.js';
import { quietAt } from './notification-model.js';
export const REMINDER_LEAD_MS = 2 * 3600000;
export const REMINDER_WINDOW_MS = 15 * 60000;
export function detectFavoriteReminders(matches, preferences, favorites, now = Date.now()) {
  if (!preferences?.enabled || !preferences.favorite_reminders || quietAt(now, preferences)) return [];
  const teams = Array.isArray(favorites?.teams) ? favorites.teams : [];
  const seen=new Set();
  return matches.flatMap(match => {
    const kickoff = Date.parse(match.kickoff), due = kickoff - REMINDER_LEAD_MS;
    if (!match.id || seen.has(match.id) || match.completed || match.voided || !Number.isFinite(kickoff) || now < due || now >= due + REMINDER_WINDOW_MS || !teams.some(team => team === match.home || team === match.away)) return [];
    seen.add(match.id);const candidate=match.notificationPick??recommendedMarket(match),advice=candidate&&quoteAvailable(match,candidate.key)&&Number.isFinite(candidate.probability)&&Number(candidate.odd)===Number(match.odds?.[candidate.key])?candidate:null;
    return [{advice:advice?{key:advice.key,label:advice.label,odd:advice.odd,confidence:advice.probability}:null,web:true, favorite_reminder:true, key:`favorite-reminder:${match.id}`, match_id:match.id, home:match.home, away:match.away, league:match.league, kickoff:new Date(kickoff).toISOString(), due_at:new Date(due).toISOString(), expires_at:new Date(due + REMINDER_WINDOW_MS).toISOString()}];
  });
}
export function favoriteReminderCurrent(event, preferences, favorites, matches, now = Date.now()) {
  return event.favorite_reminder === true && Date.parse(event.expires_at) > now && detectFavoriteReminders(matches, preferences, favorites, now).some(current => current.match_id === event.match_id && current.kickoff === event.kickoff);
}
export function favoriteReminderText(event) {
  const advice=event.advice;
  return `${event.home} - ${event.away} · ${new Date(event.kickoff).toLocaleTimeString('fr-FR', {timeZone:'Europe/Paris', hour:'2-digit', minute:'2-digit'})} (Paris)\n${advice?`${advice.label} · cote ${Number(advice.odd).toFixed(2)} · confiance ${Math.round(advice.confidence*100)} %`:'Conseil et cote indisponibles pour ce match.'}\nParis virtuels · 18+ · Aucune garantie.`;
}
