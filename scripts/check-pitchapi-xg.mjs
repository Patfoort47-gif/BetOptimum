// Diagnostic de recherche, sans écriture de données ni activation en production.
import { fileURLToPath } from 'node:url';

const origin = 'https://api.pitchapi.dev';

export async function checkPitchApiXg(matchIds, key, request = fetch) {
  if (!key) throw new Error('Secret PITCHAPI_API_KEY absent');

  async function read(path) {
    let response;
    try {
      response = await request(new URL(path, origin), {
        headers: { 'X-API-KEY': key },
        redirect: 'error',
        signal: AbortSignal.timeout(12000)
      });
    } catch {
      throw new Error('Connexion à PitchAPI impossible');
    }
    if (response.status === 404 && path !== '/v1/leagues') return null;
    if (!response.ok) throw new Error(`PitchAPI HTTP ${response.status}`);
    const { data } = await response.json();
    if (!data || typeof data !== 'object') throw new Error('Réponse PitchAPI invalide');
    return data;
  }

  if (!matchIds.length) return read('/v1/leagues');
  const matches = [];
  for (const id of new Set(matchIds)) {
    if (!/^m_[A-Za-z0-9]+$/.test(id)) throw new Error('Identifiant de match PitchAPI invalide');
    const stats = await read(`/v1/matches/${id}/stats`);
    if (stats && stats.match_id !== id) throw new Error('Le match renvoyé ne correspond pas à la demande');
    const totals = stats?.periods?.find(({ period }) => period === 'All');
    const expected = totals?.groups?.flatMap(({ items }) => items).find(({ key }) =>
      key === 'expected_goals'
    );
    const numberOrNull = (raw) => {
      if (typeof raw !== 'number' && (typeof raw !== 'string' || !raw.trim())) return null;
      const value = Number(raw);
      return Number.isFinite(value) && value >= 0 ? value : null;
    };
    matches.push({
      id,
      home: stats?.home_team?.name ?? null,
      away: stats?.away_team?.name ?? null,
      homeXg: numberOrNull(expected?.home),
      awayXg: numberOrNull(expected?.away)
    });
  }
  return {
    matches,
    withBothXg: matches.filter(({ homeXg, awayXg }) => homeXg !== null && awayXg !== null).length
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await checkPitchApiXg(process.argv.slice(2), process.env.PITCHAPI_API_KEY);
  console.log(JSON.stringify(report, null, 2));
}
