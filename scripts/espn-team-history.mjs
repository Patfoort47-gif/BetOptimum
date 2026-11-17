import { teamForm } from '../src/matches/team-form.js';
import { regulationScore } from '../src/model/regulation-score.js';

export const teamHistoryKey = (league, id) => `${league}:${id}`;
// Scores officiels, identités ESPN et dates strictement antérieures à la collecte.
export function scheduleHistory(payload, { teamId, teamName, now = Date.now() }) {
  const records = new Map();
  for (const event of payload?.events ?? []) {
    const competition = event.competitions?.[0],
      type = (event.status ?? competition?.status)?.type,
      date = Date.parse(event.date),
      teams = competition?.competitors ?? [],
      home = teams.find((t) => t.homeAway === 'home'),
      away = teams.find((t) => t.homeAway === 'away');
    if (
      !event.id ||
      !Number.isFinite(date) ||
      date >= now ||
      date < now - 365 * 86400000 ||
      type?.completed !== true ||
      type.state !== 'post' ||
      /CANCEL|POSTPON|ABANDON|SUSPEND|AWARD|FORFEIT/i.test(type.name ?? '') ||
      !home?.team?.id ||
      !away?.team?.id ||
      ![home, away].some((t) => String(t.team.id) === String(teamId))
    )
      continue;
    const regulation = regulationScore(event),
      score = (team, side) => {
        const raw = regulation?.extraTime
          ? regulation[side]
          : typeof team.score === 'object'
            ? team.score?.value
            : team.score;
        return raw == null || raw === '' ? NaN : Number(raw);
      },
      h = score(home, 'home'),
      a = score(away, 'away');
    if (![h, a].every((n) => Number.isInteger(n) && n >= 0 && n <= 99)) continue;
    const name = (team) =>
      String(team.team.id) === String(teamId) ? teamName : team.team.displayName;
    if (!name(home) || !name(away)) continue;
    records.set(String(event.id), {
      id: String(event.id),
      utcDate: event.date,
      homeTeam: { name: name(home) },
      awayTeam: { name: name(away) },
      score: { fullTime: { home: h, away: a } }
    });
  }
  return [...records.values()];
}

export async function collectMissingTeamForms(
  matches,
  history,
  slugs,
  { fetcher = globalThis.fetch, now = Date.now(), maxRequests = 80 } = {}
) {
  const needed = new Map(),
    forms = new Map(),
    failures = [];
  for (const match of matches) {
    if (match.completed || match.voided || !(Date.parse(match.kickoff) > now)) continue;
    for (const side of ['home', 'away']) {
      const id = match[side + 'Id'],
        slug = slugs[match.league];
      if (!id || !slug || teamForm(match[side], history).sample >= 2) continue;
      const key = teamHistoryKey(match.league, id);
      if (!needed.has(key)) needed.set(key, { key, id, slug, name: match[side] });
    }
  }
  const queue = [...needed.values()];
  let requests = 0;
  async function worker() {
    while (queue.length) {
      const item = queue.shift(),
        records = new Map();
      for (const season of [new Date(now).getUTCFullYear(), new Date(now).getUTCFullYear() - 1]) {
        if (requests >= maxRequests) {
          failures.push(`Historique ESPN ${item.id} : budget épuisé`);
          break;
        }
        requests++;
        try {
          const response = await fetcher(
            `https://site.api.espn.com/apis/site/v2/sports/soccer/${item.slug}/teams/${encodeURIComponent(item.id)}/schedule?season=${season}`,
            { signal: AbortSignal.timeout(8000) }
          );
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          for (const record of scheduleHistory(await response.json(), {
            teamId: item.id,
            teamName: item.name,
            now
          }))
            records.set(record.id, record);
        } catch (error) {
          failures.push(
            `Historique ESPN ${item.id} : ${error.name === 'TimeoutError' ? 'délai dépassé' : 'requête indisponible'}`
          );
        }
        if (records.size >= 2) break;
      }
      const stats = teamForm(item.name, [...records.values()]);
      if (stats.sample >= 2) forms.set(item.key, { ...stats, source: 'ESPN' });
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
  return { forms, failures, requests };
}
