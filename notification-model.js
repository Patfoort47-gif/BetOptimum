// BET-69 : détection pure, sans destination privée ni accès réseau.
import { analyseMatch } from './model.js';
export const CHANNELS = ['web', 'telegram', 'discord', 'email'];
export function localMinute(now, timezone = 'Europe/Paris') {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now));
  return Number(parts.find(p => p.type === 'hour').value) * 60 + Number(parts.find(p => p.type === 'minute').value);
}
export function quietAt(now, prefs) {
  const start = Number(prefs.quiet_start), end = Number(prefs.quiet_end);
  if (start === end) return false;
  const minute = localMinute(now, prefs.timezone);
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}
export function nextAllowed(now, prefs) {
  let time = Number(now);
  // Recherche en temps UTC : respecte les heures répétées ou absentes au changement d’heure.
  for (let i = 0; quietAt(time, prefs) && i < 1500; i++) time += 60000;
  return time;
}
export function detectAlerts(matches, prefs, plan, now = Date.now()) {
  if (!prefs.enabled || !Array.isArray(prefs.channels) || !prefs.channels.length) return [];
  const teams = prefs.teams ?? [], leagues = prefs.leagues ?? [];
  if (teams.length + leagues.length > plan.max_favorites) return [];
  const step = Math.max(.01, Number(plan.odds_step)), events = [];
  for (const match of matches) {
    if (match.completed || match.voided || !((teams.includes(match.home) || teams.includes(match.away)) || leagues.includes(match.league))) continue;
    const kickoff = Date.parse(match.kickoff);
    if (!Number.isFinite(kickoff) || kickoff <= now || !match.bookmakerOffers?.length) continue;
    for (const market of analyseMatch(match).markets) {
      const offers = match.bookmakerOffers.filter(o => Number.isFinite(Number(o[market.key])) && Number(o[market.key]) > 1 && (!o[`${market.key}Cached`] || (o.updatedAt && now - Date.parse(o.updatedAt) < 864e5)));
      const offer = [...offers].sort((a, b) => Number(b[market.key]) - Number(a[market.key]))[0];
      if (!offer) continue;
      const odd = Number(offer[market.key]), value = market.probability * odd - 1;
      if (value < prefs.min_value || market.probability < prefs.min_confidence) continue;
      const due = nextAllowed(now, prefs); if (due >= kickoff) continue;
      const bucket = Math.floor(Math.log(odd) / Math.log(1 + step));
      events.push({ key: `${match.id}:${market.key}:${bucket}`, match_id: match.id, market: market.key, bucket, kickoff: new Date(kickoff).toISOString(), due_at: new Date(due).toISOString(), home: match.home, away: match.away, league: match.league, label: market.label, odd, bookmaker: String(offer.name ?? 'Bookmaker'), cached: Boolean(offer[`${market.key}Cached`]), value, confidence: market.probability, movement: Number(match.oddsMovement?.[market.key]?.percent ?? 0) });
    }
  }
  return events;
}
export function alertText(event) {
  return `${event.home} - ${event.away}\n${event.label} · cote ${event.odd.toFixed(2)} (${event.bookmaker}${event.cached ? ', cache' : ''})\nValue ${(event.value * 100).toFixed(1)} % · confiance ${Math.round(event.confidence * 100)} % · variation ${event.movement > 0 ? '+' : ''}${event.movement} %\n${new Date(event.kickoff).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })} (Paris)\nParis virtuels · aucune garantie`;
}
