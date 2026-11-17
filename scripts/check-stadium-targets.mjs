// Contrôle le périmètre éditorial vérifié, indépendamment du calendrier du jour.
import { readFile, stat } from 'node:fs/promises';
import { stadiumFor } from '../src/matches/stadiums.js';
const inventory = JSON.parse(await readFile('stadiums/coverage-targets.json', 'utf8'));
let missing = 0;
for (const group of inventory.groups) {
  if (process.argv.includes('--clubs-only') && group.league === 'national') continue;
  let covered = 0;
  const venues = new Set();
  for (const team of group.teams) {
    let complete = team.venues.length > 0;
    if (!complete) {
      missing++;
      console.log(`Lieu non vérifié : ${group.name} · ${team.name}`);
    }
    for (const venue of team.venues) {
      venues.add(venue.id);
      const photo = stadiumFor({ neutralSite: true, venue: { id: venue.id } });
      if (photo) await stat(photo.image);
      else {
        complete = false;
        missing++;
        console.log(`Photo manquante : ${group.name} · ${team.name} · ${venue.name} (${venue.id})`);
      }
    }
    if (complete) covered++;
  }
  console.log(
    `${group.name} : ${covered}/${group.teams.length} équipes couvertes, ${venues.size} lieux vérifiés`
  );
}
console.log(
  `Inventaire ESPN vérifié le ${inventory.checked} ; les futurs changements de stade nécessitent une nouvelle vérification.`
);
if (missing && process.argv.includes('--require-photos')) process.exitCode = 1;
