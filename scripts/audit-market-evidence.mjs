// Audit de preuves, sans rendre ces marchés jouables ni déduire leur règlement.
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { propLineOffers, excludedPropLineBook } from './propline-odds.mjs';
import { marketSpec } from '../src/model/markets.js';
import { MIN_BOOKMAKERS } from '../src/model/quote-policy.js';
export function auditMarketEvidence(report) {
  const families = {};
  for (const event of report.samples ?? [])
    for (const book of event.bookmakers ?? [])
      for (const market of book.markets ?? []) {
        const c = (families[market.key] ??= {
          events: new Set(),
          books: new Set(),
          eligibleBooks: new Set(),
          periods: new Set(),
          outcomes: 0,
          playerOutcomes: 0,
          identifiedPlayerOutcomes: 0,
          lines: new Set()
        });
        c.events.add(event.id);
        c.books.add(book.key);
        c.periods.add(market.period ?? 'full');
        if (!excludedPropLineBook(book)) c.eligibleBooks.add(book.key);
        for (const outcome of market.outcomes ?? []) {
          c.outcomes++;
          if (outcome.point != null) c.lines.add(outcome.point);
          if (/player_|scorer|assist|saves|^[23]plus/.test(market.key)) {
            c.playerOutcomes++;
            if (/^espn:\d+$/.test(outcome.player_id ?? '')) c.identifiedPlayerOutcomes++;
          }
        }
      }
  const summary = Object.fromEntries(
    Object.entries(families).map(([key, c]) => [
      key,
      {
        events: c.events.size,
        bookmakers: [...c.books].sort(),
        eligibleBookmakers: [...c.eligibleBooks].sort(),
        periods: [...c.periods].sort(),
        outcomes: c.outcomes,
        playerOutcomes: c.playerOutcomes,
        identifiedPlayerOutcomes: c.identifiedPlayerOutcomes,
        lines: [...c.lines].sort((a, b) => a - b)
      }
    ])
  );
  // Mesure par choix des marchés de score déjà normalisables, séparément par période réelle.
  // Retirer period ici sert uniquement à réutiliser la normalisation existante dans l'audit.
  const periods = {};
  for (const period of ['h1', 'h2']) {
    const c = {
      events: 0,
      selections: 0,
      maxBookmakersPerSelection: 0,
      qualifiedSelections: 0,
      qualifiedKeys: new Set()
    };
    for (const event of report.samples ?? []) {
      const isolated = {
        ...event,
        bookmakers: (event.bookmakers ?? []).map((book) => ({
          ...book,
          markets: (book.markets ?? [])
            .filter((m) => m.period === period)
            .map((m) => ({ ...m, period: null }))
        }))
      };
      const offers = propLineOffers(isolated, Date.parse(report.generatedAt), 3),
        keys = new Set(offers.flatMap((o) => Object.keys(o).filter((k) => marketSpec(k))));
      if (keys.size) c.events++;
      for (const key of keys) {
        const books = new Set(offers.filter((o) => Number(o[key]) > 1).map((o) => o.key));
        c.selections++;
        c.maxBookmakersPerSelection = Math.max(c.maxBookmakersPerSelection, books.size);
        if (books.size >= MIN_BOOKMAKERS) {
          c.qualifiedSelections++;
          c.qualifiedKeys.add(key);
        }
      }
    }
    if (c.events) periods[period] = { ...c, qualifiedKeys: [...c.qualifiedKeys].sort() };
  }
  return {
    requests: report.requests,
    failures: report.failures,
    requestedPeriod: report.requestedPeriod ?? 'full',
    families: summary,
    periods,
    warning:
      'Les présences et identifiants ne valident ni les prix, ni les règles fournisseur, ni les données de règlement. Les nombres globaux de bookmakers ne sont pas des nombres par sélection.'
  };
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const path = process.argv[2],
    raw = await readFile(path);
  console.log(
    JSON.stringify(
      auditMarketEvidence(JSON.parse(path.endsWith('.gz') ? gunzipSync(raw) : raw)),
      null,
      2
    )
  );
}
