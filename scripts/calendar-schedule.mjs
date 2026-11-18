import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { sourceFreshness } from '../src/core/data-freshness.js';
import { reserveSync } from './odds-sync-quota.mjs';
// Rattrapage horaire : le garde de quota reste l'autorité sur les appels payants.
export function calendarDue(fixtures, attempts, now = Date.now()) {
  const calendar = sourceFreshness(fixtures.generatedAt, 'odds', now).status;
  const odds = sourceFreshness(fixtures.oddsRefreshedAt, 'odds', now).status;
  return calendar !== 'fresh' || (odds !== 'fresh' && reserveSync(attempts, now) !== null);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fixtures = JSON.parse(await readFile('data/fixtures.json', 'utf8'));
  const attempts = JSON.parse(
    await readFile('data/odds-sync-attempts.json', 'utf8').catch((e) => {
      if (e.code === 'ENOENT') return '[]';
      throw e;
    })
  );
  console.log(
    `run=${process.env.MANUAL_CALENDAR_SYNC === 'true' || calendarDue(fixtures, attempts)}`
  );
}
