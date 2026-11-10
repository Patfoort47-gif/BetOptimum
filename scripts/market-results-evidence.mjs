// Diagnostic serveur en lecture seule : preuves de résultat pour BET-170, jamais un règlement.
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const SLUGS = {
  'Premier League': 'eng.1',
  'Ligue 1': 'fra.1',
  'La Liga': 'esp.1',
  'Serie A': 'ita.1',
  Bundesliga: 'ger.1',
  'Ligue des champions': 'uefa.champions',
  'Europa League': 'uefa.europa',
  'Conference League': 'uefa.europa.conf'
};
export async function resultEvidence(
  matches,
  { fetchImpl = fetch, budget = 8, now = new Date() } = {}
) {
  const report = {
      generatedAt: now.toISOString(),
      source: 'ESPN summary',
      budget: Math.min(8, Math.max(1, Math.floor(Number(budget) || 8))),
      requests: 0,
      failures: [],
      samples: []
    },
    leagues = new Set();
  for (const match of matches) {
    if (
      !match.completed ||
      !/^espn-\d+$/.test(match.id) ||
      !SLUGS[match.league] ||
      leagues.has(match.league)
    )
      continue;
    if (report.requests >= report.budget) break;
    leagues.add(match.league);
    report.requests++;
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${SLUGS[match.league]}/summary?event=${match.id.slice(5)}`;
    try {
      const response = await fetchImpl(url, {
        redirect: 'error',
        signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) {
        report.failures.push(`${match.id}: HTTP ${response.status}`);
        if ([401, 403, 429].includes(response.status)) break;
        continue;
      }
      const data = await response.json();
      if (String(data.header?.id) !== match.id.slice(5)) {
        report.failures.push(`${match.id}: identité inattendue`);
        continue;
      }
      // Projection explicite : pas d'article, vidéo, publicité ni texte de commentaire.
      report.samples.push({
        id: match.id,
        league: match.league,
        url,
        header: data.header,
        boxscore: data.boxscore,
        rosters: data.rosters,
        keyEvents: data.keyEvents,
        format: data.format
      });
    } catch {
      report.failures.push(`${match.id}: réponse indisponible`);
    }
  }
  return report;
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const data = JSON.parse(await readFile('data/fixtures.json', 'utf8')),
    report = await resultEvidence(data.matches ?? []);
  await writeFile(
    process.argv[2] ?? 'market-results-evidence.json',
    JSON.stringify(report, null, 2) + '\n'
  );
  console.log(
    JSON.stringify({
      requests: report.requests,
      failures: report.failures,
      samples: report.samples.map((e) => ({ id: e.id, league: e.league }))
    })
  );
  if (report.failures.length || !report.samples.length)
    throw new Error('Diagnostic de résultats incomplet');
}
