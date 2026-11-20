// Conserve les modules accessibles au navigateur, y compris imports différés et service worker.
import { mkdir, copyFile, cp, rm, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prerenderSeo } from './prerender-seo.mjs';
import { matchesWithBookmakers } from '../src/model/calendar-model.js';
const root = new URL('../', import.meta.url);
export async function preparePages(out = new URL('../_site/', import.meta.url)) {
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const pending = [new URL('app.js', root), new URL('notification-sw.js', root)],
    seen = new Set();
  while (pending.length) {
    const file = pending.pop();
    file.search = '';
    if (seen.has(file.href)) continue;
    if (!file.href.startsWith(root.href)) throw new Error('Module hors du site');
    seen.add(file.href);
    const source = await readFile(file, 'utf8'),
      relative = file.pathname.slice(root.pathname.length);
    await mkdir(new URL('./', new URL(relative, out)), { recursive: true });
    await copyFile(file, new URL(relative, out));
    for (const [, ref] of source.matchAll(/['"]((?:\.\.?\/)[^'"\s]+\.js(?:\?[^'"\s]*)?)['"]/g))
      pending.push(new URL(ref, file));
  }
  const modulePaths = JSON.parse(await readFile(new URL('config/module-paths.json', root), 'utf8'));
  const aliases = [];
  for (const [legacy, target] of Object.entries(modulePaths)) {
    if (!seen.has(new URL(target, root).href)) continue;
    await writeFile(new URL(legacy, out), `export * from './${target}';\n`);
    aliases.push(legacy);
  }
  for (const name of [
    'index.html',
    'theme-bootstrap.js',
    'styles.css',
    'style.css',
    '.nojekyll',
    'manifest.webmanifest',
    'robots.txt',
    'ads.txt',
    'sitemap.xml',
    'google9d3b820d95b3f0f8.html'
  ])
    await copyFile(new URL(name, root), new URL(name, out));
  for (const name of [
    'data',
    'styles',
    'stadiums',
    'icons',
    'fonts',
    'bilan-des-pronostics',
    'lexique-des-paris'
  ])
    await cp(new URL(name, root), new URL(name, out), { recursive: true });
  await mkdir(new URL('vendor/', out), { recursive: true });
  for (const name of ['LICENSES.json', 'SHA256.json'])
    await copyFile(new URL('vendor/' + name, root), new URL('vendor/' + name, out));
  const fixtureSource = await readFile(new URL('data/fixtures.json', root), 'utf8'),
    fixtures = JSON.parse(fixtureSource);
  // Les fichiers journaliers restent disponibles pour les anciens clients.
  const offersDir = new URL('data/match-offers/v1/', out);
  await mkdir(offersDir, { recursive: true });
  for (const date of new Set(fixtures.matches.map((match) => match.date))) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const daily = await readFile(new URL(`data/offers/${date}.json`, root), 'utf8').catch(
      (error) => {
        if (error.code !== 'ENOENT') throw error;
        return '{"matches":{}}';
      }
    );
    const offers = JSON.parse(daily).matches;
    await Promise.all(
      fixtures.matches
        .filter((match) => match.date === date)
        .map(async (match) => {
          if (!/^[a-zA-Z0-9_-]+$/.test(match.id) || !Array.isArray(offers[match.id])) return;
          const payload = JSON.stringify(offers[match.id]);
          match.offerVersion = createHash('sha256').update(payload).digest('hex');
          await writeFile(new URL(`${match.id}-${match.offerVersion}.json`, offersDir), payload);
        })
    );
  }
  await writeFile(
    new URL('data/fixtures.json', out),
    JSON.stringify({
      ...fixtures,
      matchOffersSchema: 1,
      fixtureVersion: createHash('sha256').update(JSON.stringify(fixtures)).digest('hex')
    })
  );
  const preview = matchesWithBookmakers(fixtures.matches).map(
    ({ id, date, kickoff, time, league, home, away, completed, voided, homeScore, awayScore }) => ({
      id,
      date,
      kickoff,
      time,
      league,
      home,
      away,
      completed,
      voided,
      homeScore,
      awayScore
    })
  );
  const index = prerenderSeo(await readFile(new URL('index.html', root), 'utf8'), fixtures);
  await writeFile(
    new URL('index.html', out),
    index.replace(
      '</body>',
      () =>
        `<script type="application/json" id="calendar-preview">${JSON.stringify(preview).replaceAll('<', '\\u003c')}</script>\n</body>`
    )
  );
  await (
    await import('node:fs/promises')
  ).writeFile(
    new URL('offline-assets.json', out),
    JSON.stringify([
      'index.html',
      'theme-bootstrap.js',
      'styles.css',
      'style.css',
      'styles/components.css',
      'manifest.webmanifest?v=bet407',
      'icons/favicon.svg?v=bet387',
      'icons/icon-192x192.png?v=bet387',
      'icons/icon-512x512.png?v=bet387',
      'icons/icon-maskable.png?v=bet387',
      'icons/apple-touch-icon.png?v=bet387',
      'icons/app-192.png',
      'icons/app-512.png',
      'fonts/plus-jakarta-sans-latin-wght-normal.woff2',
      'fonts/inter-latin-wght-normal.woff2',
      ...[...seen]
        .map((url) => new URL(url).pathname.slice(root.pathname.length))
        .filter((name) => name !== 'vendor/supabase-js-2.81.1.js'),
      ...aliases
    ])
  );
  return [...seen].map((url) => new URL(url).pathname.slice(root.pathname.length));
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const files = await preparePages();
  console.log(`Site public préparé : ${files.length} modules dans _site/`);
}
