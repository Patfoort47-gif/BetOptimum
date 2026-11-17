import { readFile } from 'node:fs/promises';
import { localDate } from '../src/notifications/notification-briefing.js';
export async function notificationData({
  file = 'data/fixtures.json',
  offersDir = 'data/offers',
  reader = readFile,
  now = Date.now()
} = {}) {
  const data = JSON.parse(await reader(file, 'utf8'));
  if (!Array.isArray(data.matches)) throw Error('Calendrier invalide');
  const today = localDate(now, 'Europe/Paris');
  // Les rappels couvrent les prochaines 24 h ; le briefing conserve aussi les matchs du jour déjà commencés.
  const matches = data.matches.filter(
    (m) =>
      !m.voided &&
      Number.isFinite(Date.parse(m.kickoff)) &&
      (localDate(m.kickoff, 'Europe/Paris') === today ||
        (Date.parse(m.kickoff) > now && Date.parse(m.kickoff) <= now + 86400000))
  );
  const offers = new Map();
  for (const date of new Set(matches.map((m) => m.date))) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) throw Error('Date de calendrier invalide');
    try {
      offers.set(date, JSON.parse(await reader(`${offersDir}/${date}.json`, 'utf8')).matches ?? {});
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      offers.set(date, {});
    }
  }
  const history = JSON.parse(await reader('data/predictions-history.json', 'utf8'));
  if (!Array.isArray(history)) throw Error('Historique public invalide');
  const historyStart = new Date(now - 12 * 86400000).toISOString().slice(0, 10);
  return {
    ...data,
    modelHistory: history
      .filter((p) => p.date >= historyStart && ['won', 'lost', 'void'].includes(p.status))
      .map((p) =>
        Object.fromEntries(
          ['id', 'date', 'kickoff', 'status', 'odd', 'oddsSource']
            .filter((key) => p[key] !== undefined)
            .map((key) => [key, p[key]])
        )
      ),
    matches: matches.map((m) => ({
      ...m,
      analysisStatus: m.analysisStatus ?? (m.statsSource ? 'ready' : 'unavailable'),
      bookmakerOffers: offers.get(m.date)?.[m.id] ?? m.bookmakerOffers ?? []
    }))
  };
}
