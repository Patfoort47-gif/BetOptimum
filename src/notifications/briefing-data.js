import { localDate } from './notification-briefing.js';
// L'absence d'une sélection jouable ne signifie jamais l'absence de rencontre.
export function briefingDataStatus(matches, generatedAt, now = Date.now()) {
  const stamp = Date.parse(generatedAt);
  if (
    !Array.isArray(matches) ||
    !Number.isFinite(stamp) ||
    stamp > now ||
    localDate(stamp, 'Europe/Paris') !== localDate(now, 'Europe/Paris')
  )
    return { ok: false, code: 'BRIEFING_CALENDAR_STALE' };
  const today = matches.filter(
    (m) =>
      !m.voided &&
      Number.isFinite(Date.parse(m.kickoff)) &&
      localDate(m.kickoff, 'Europe/Paris') === localDate(now, 'Europe/Paris')
  );
  if (
    today.some((m) => !m.completed && Date.parse(m.kickoff) > now) &&
    !today.some(
      (m) =>
        m.analysisStatus !== 'unavailable' &&
        [m.homeGoals, m.awayGoals].every((n) => Number.isFinite(n) && n > 0 && n <= 10)
    )
  )
    return { ok: false, code: 'BRIEFING_ANALYSIS_UNAVAILABLE' };
  return { ok: true, code: 'BRIEFING_DATA_READY', matches: today.length };
}
