import { readFile, stat } from 'node:fs/promises';
import { stadiumFor, stadiumMarkup } from '../src/matches/stadiums.js';
const fixtures = JSON.parse(await readFile('data/fixtures.json', 'utf8')),
  missing = [];
let confirmed = 0,
  totalBytes = 0;
const images = new Set();
for (const m of fixtures.matches) {
  const photo = stadiumFor(m);
  if (!stadiumMarkup(m).includes('stadium-placeholder')) throw new Error(`Visuel absent : ${m.id}`);
  if (!photo) {
    missing.push({ id: m.id, home: m.home, away: m.away, venue: m.venue ?? null });
    continue;
  }
  if (photo.confirmed) confirmed++;
  if (!images.has(photo.image)) {
    images.add(photo.image);
    totalBytes += (await stat(photo.image)).size;
  }
}
await stat('stadiums/default-stadium.svg');
console.log(
  `Photos : ${fixtures.matches.length - missing.length}/${fixtures.matches.length} matchs, ${confirmed} lieux confirmés, ${images.size} fichiers, ${(totalBytes / 1024 / 1024).toFixed(2)} Mo au total (chargement différé)`
);
if (missing.length) {
  console.log(
    `Illustration d’ambiance : ${missing.length} matchs (${new Set(missing.map((m) => m.venue?.id ?? m.home)).size} stades).`
  );
  if (process.argv.includes('--report')) console.log(JSON.stringify(missing, null, 2));
  if (process.argv.includes('--require-photos')) process.exitCode = 1;
}
