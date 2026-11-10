import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { mergeCachedOffers, summarizeOffers } from '../odds-cache.js';

const ref = process.argv[2];
if (!/^[0-9a-f]{7,40}$/i.test(ref ?? ''))
  throw new Error('Usage : node scripts/restore-odds-cache.mjs <commit>');
const run = promisify(execFile),
  current = JSON.parse(await readFile('data/fixtures.json', 'utf8')),
  { stdout } = await run('git', ['show', `${ref}:data/fixtures.json`], {
    maxBuffer: 32 * 1024 * 1024
  }),
  snapshot = JSON.parse(stdout),
  sources = new Map(snapshot.matches.map((match) => [match.id, match]));
let restoredMatches = 0,
  restoredPrices = 0;
for (const match of current.matches) {
  const source = sources.get(match.id);
  if (!source?.bookmakerOffers?.length) continue;
  const before = match.bookmakerOffers ?? [],
    offers = mergeCachedOffers(before, source.bookmakerOffers),
    added = offers.reduce((total, offer) => {
      const previous = before.find((item) => item.name === offer.name);
      return (
        total +
        ['home', 'draw', 'away', 'over', 'btts'].filter(
          (market) => Number(offer[market]) > 1 && !(Number(previous?.[market]) > 1)
        ).length
      );
    }, 0);
  if (!added) continue;
  restoredMatches++;
  restoredPrices += added;
  const { counts, averages, cachedMarkets } = summarizeOffers(offers),
    realMarkets = Object.keys(averages).filter((market) => averages[market]);
  match.bookmakerOffers = offers;
  match.bookmakerCount = offers.length;
  match.oddsBookmakerCounts = counts;
  match.realOddsMarkets = realMarkets;
  match.oddsCachedMarkets = cachedMarkets;
  match.oddsSource = 'The Odds API';
  match.odds = {
    ...match.odds,
    ...Object.fromEntries(realMarkets.map((market) => [market, averages[market]]))
  };
  delete match.oddsMovement;
}
if (!restoredMatches) throw new Error(`Aucune cote restaurée depuis ${ref}`);
current.oddsRefreshedAt = snapshot.oddsRefreshedAt ?? snapshot.generatedAt;
current.oddsCacheRestoredFrom = ref;
current.oddsCacheRestoredAt = new Date().toISOString();
current.coverage = {
  ...current.coverage,
  oddsMatches: current.matches.filter((match) => match.bookmakerOffers?.length).length,
  secondaryOddsMatches: current.matches.filter((match) =>
    match.realOddsMarkets?.some((market) => market === 'over' || market === 'btts')
  ).length
};
await writeFile('data/fixtures.json', `${JSON.stringify(current, null, 2)}\n`);
console.log(`${restoredPrices} cotes restaurées sur ${restoredMatches} matchs depuis ${ref}.`);
