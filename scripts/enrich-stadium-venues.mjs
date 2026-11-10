// Enrichit uniquement le lieu des rencontres. Aucune collecte de cotes.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { venueFromCompetition } from '../stadiums.js';
const LEAGUES = {
  'Premier League': 'eng.1',
  'Ligue 1': 'fra.1',
  'La Liga': 'esp.1',
  'Serie A': 'ita.1',
  Bundesliga: 'ger.1',
  'Ligue des champions': 'uefa.champions',
  'Europa League': 'uefa.europa',
  'Conference League': 'uefa.europa.conf',
  "Supercoupe d'Europe": 'uefa.super_cup',
  'Coupe du monde des clubs': 'fifa.cwc',
  'Ligue 2': 'fra.2',
  'Coupe de France': 'fra.coupe_de_france',
  'FA Cup': 'eng.fa',
  'Carabao Cup': 'eng.league_cup',
  'Copa del Rey': 'esp.copa_del_rey',
  'Coppa Italia': 'ita.coppa_italia',
  'DFB-Pokal': 'ger.dfb_pokal',
  'Ligue des nations': 'uefa.nations',
  'Qualifications Coupe du monde': 'fifa.worldq.uefa'
};
export function verifiedVenue(match, summary) {
  const header = summary?.header,
    competition = header?.competitions?.[0];
  if (String(header?.id) !== String(match.id).replace(/^espn-/, '')) return null;
  for (const side of ['home', 'away']) {
    const team = competition?.competitors?.find((c) => c.homeAway === side)?.team;
    if (!match[`${side}Id`] || String(team?.id) !== String(match[`${side}Id`])) return null;
  }
  const venue = summary?.gameInfo?.venue ?? competition?.venue;
  if (!venue?.id || !venue.fullName) return null;
  return venueFromCompetition({
    venue,
    neutralSite: match.neutralSite === true || competition?.neutralSite === true
  });
}
export async function enrichVenues(data, { fetchSummary } = {}) {
  const result = { ...data, matches: [...data.matches] },
    pending = data.matches
      .map((m, index) => ({ m, index }))
      .filter(({ m }) => !m.venue?.id && LEAGUES[m.league] && /^espn-\d+$/.test(m.id));
  let cursor = 0,
    enriched = 0,
    failed = 0;
  async function worker() {
    while (cursor < pending.length) {
      const { m, index } = pending[cursor++];
      try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${LEAGUES[m.league]}/summary?event=${m.id.slice(5)}`,
          summary = await fetchSummary(m, url),
          venue = verifiedVenue(m, summary);
        if (venue) {
          result.matches[index] = { ...m, ...venue };
          enriched++;
        } else failed++;
      } catch {
        failed++;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, pending.length) }, worker));
  return { data: result, enriched, failed };
}
async function main() {
  const file = 'data/fixtures.json',
    data = JSON.parse(await readFile(file, 'utf8')),
    cacheArg = process.argv.find((x) => x.startsWith('--cache=')),
    cache = cacheArg?.slice(8);
  const result = await enrichVenues(data, {
    fetchSummary: async (m, url) => {
      if (cache) return JSON.parse(await readFile(resolve(cache, `${m.id}.json`), 'utf8'));
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`ESPN ${response.status}`);
      return response.json();
    }
  });
  if (result.enriched) await writeFile(file, JSON.stringify(result.data, null, 2) + '\n');
  console.log(
    `Lieux ESPN : ${result.enriched} ajoutés, ${result.failed} indisponibles, ${result.data.matches.filter((m) => m.venue?.id).length}/${result.data.matches.length} renseignés`
  );
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  await main();
