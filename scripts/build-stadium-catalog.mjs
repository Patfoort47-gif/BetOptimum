// Compile uniquement les photos approuvées dans stadiums/sources.json, sans réseau.
import { readFile, writeFile, stat } from 'node:fs/promises';
const sources = JSON.parse(await readFile('stadiums/sources.json', 'utf8')),
  photos = {};
for (const source of sources) {
  const { venue, image, author, license, licenseUrl, url } = source;
  if (
    !venue?.id ||
    !venue.fullName ||
    !/^stadiums\/[a-z0-9-]+\.webp$/.test(image) ||
    !author ||
    !license ||
    !/^https:\/\//.test(url) ||
    !/^https:\/\//.test(licenseUrl)
  )
    throw new Error(`Source incomplète : ${image}`);
  if (photos[venue.id]) throw new Error(`Stade en double : ${venue.id}`);
  if ((await stat(image)).size > 120000) throw new Error(`Photo trop lourde : ${image}`);
  photos[venue.id] = {
    venueId: String(venue.id),
    name: venue.fullName,
    image,
    author,
    source: url,
    license,
    licenseUrl
  };
}
await writeFile(
  'src/matches/stadium-catalog.js',
  '// Généré par scripts/build-stadium-catalog.mjs depuis les sources approuvées.\nexport const STADIUM_PHOTOS=Object.freeze(' +
    JSON.stringify(photos, null, 2) +
    ');\n'
);
console.log(`${sources.length} photographies de stades compilées`);
