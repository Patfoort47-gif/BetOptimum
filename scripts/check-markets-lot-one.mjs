// Diagnostic hors production : valide les formats/prix réels, jamais le seul catalogue /markets.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { propLineOffers } from './propline-odds.mjs';
import { isExtendedMarket, marketSpec } from '../markets.js';
export function auditLotOne(report) {
  const families = ['Score exact', 'Handicap européen', 'Marge de victoire', 'Buts'],
    coverage = Object.fromEntries(
      families.map((f) => [f, { matches: new Set(), leagues: new Set(), selections: 0 }])
    );
  for (const event of report.samples ?? []) {
    const keys = new Set(
      propLineOffers(event, Date.parse(report.generatedAt), 3).flatMap((o) =>
        Object.keys(o).filter(isExtendedMarket)
      )
    );
    for (const key of keys) {
      const c = coverage[marketSpec(key).family];
      c.matches.add(event.id);
      c.leagues.add(event.league);
      c.selections++;
    }
  }
  const summary = Object.fromEntries(
    families.map((f) => [
      f,
      {
        matches: coverage[f].matches.size,
        leagues: [...coverage[f].leagues],
        selections: coverage[f].selections
      }
    ])
  );
  const valid =
    (report.failures ?? []).length === 0 &&
    families.every((f) => summary[f].matches >= 2 && summary[f].leagues.length >= 2);
  return { valid, coverage: summary };
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const result = auditLotOne(
    JSON.parse(await readFile(process.argv[2] ?? 'propline-prices.json', 'utf8'))
  );
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) throw new Error('Premier lot : couverture de prix réels insuffisante');
}
