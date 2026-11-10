import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { propLineOffers } from './propline-odds.mjs';
import { COMPOSITE_MARKETS, compositeSelection } from './propline-composites.mjs';
import { MIN_BOOKMAKERS } from '../quote-policy.js';
export function auditComposites(report) {
  const coverage = Object.fromEntries(
    COMPOSITE_MARKETS.map((key) => [
      key,
      {
        matches: 0,
        leagues: new Set(),
        bookmakers: new Set(),
        selections: 0,
        maxBookmakersPerSelection: 0,
        qualifiedSelections: 0,
        rejectedOutcomes: 0
      }
    ])
  );
  for (const event of report.samples ?? []) {
    const offers = propLineOffers(event, Date.parse(report.generatedAt), 4),
      keys = Object.fromEntries(COMPOSITE_MARKETS.map((key) => [key, new Set()]));
    for (const book of event.bookmakers ?? [])
      for (const market of book.markets ?? [])
        if (keys[market.key])
          for (const outcome of market.outcomes ?? []) {
            const key = compositeSelection(event, market, outcome);
            if (key) keys[market.key].add(key);
            else coverage[market.key].rejectedOutcomes++;
          }
    for (const family of COMPOSITE_MARKETS) {
      const c = coverage[family];
      let present = false;
      for (const key of keys[family]) {
        const books = new Set(offers.filter((o) => Number(o[key]) > 1).map((o) => o.key));
        if (!books.size) continue;
        present = true;
        c.selections++;
        for (const book of books) c.bookmakers.add(book);
        c.maxBookmakersPerSelection = Math.max(c.maxBookmakersPerSelection, books.size);
        if (books.size >= MIN_BOOKMAKERS) c.qualifiedSelections++;
      }
      if (present) {
        c.matches++;
        c.leagues.add(event.league);
      }
    }
  }
  const summary = Object.fromEntries(
    Object.entries(coverage).map(([key, c]) => [
      key,
      { ...c, leagues: [...c.leagues], bookmakers: [...c.bookmakers].sort() }
    ])
  );
  return {
    providerFormatsValid:
      !(report.failures ?? []).length &&
      Object.values(summary).every((c) => c.matches >= 2 && c.leagues.length >= 2),
    priceThresholdSatisfied: Object.values(summary).every((c) => c.qualifiedSelections > 0),
    coverage: summary
  };
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)
  console.log(
    JSON.stringify(
      auditComposites(
        JSON.parse(await readFile(process.argv[2] ?? 'propline-prices.json', 'utf8'))
      ),
      null,
      2
    )
  );
