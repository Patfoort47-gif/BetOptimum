// Conserve les modules accessibles au navigateur, y compris imports différés et service worker.
import { mkdir, copyFile, cp, rm, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prerenderSeo } from './prerender-seo.mjs';
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
  for (const name of [
    'index.html',
    'theme-bootstrap.js',
    'styles.css',
    '.nojekyll',
    'manifest.webmanifest',
    'robots.txt',
    'sitemap.xml',
    'google9d3b820d95b3f0f8.html'
  ])
    await copyFile(new URL(name, root), new URL(name, out));
  for (const name of ['data', 'styles', 'stadiums', 'icons', 'fonts'])
    await cp(new URL(name, root), new URL(name, out), { recursive: true });
  await mkdir(new URL('vendor/', out), { recursive: true });
  for (const name of ['LICENSES.json', 'SHA256.json'])
    await copyFile(new URL('vendor/' + name, root), new URL('vendor/' + name, out));
  await writeFile(
    new URL('index.html', out),
    prerenderSeo(
      await readFile(new URL('index.html', root), 'utf8'),
      JSON.parse(await readFile(new URL('data/fixtures.json', root), 'utf8'))
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
      'styles/components.css',
      'styles/details.css',
      'manifest.webmanifest',
      'icons/favicon.svg',
      'icons/icon-192x192.png',
      'icons/icon-512x512.png',
      'icons/icon-maskable.png',
      'icons/apple-touch-icon.png',
      'icons/app-192.png',
      'icons/app-512.png',
      'fonts/inter-latin-400-normal.woff2',
      'fonts/inter-latin-500-normal.woff2',
      'fonts/inter-latin-600-normal.woff2',
      'fonts/inter-latin-700-normal.woff2',
      'fonts/inter-latin-800-normal.woff2',
      'fonts/barlow-condensed-latin-600-normal.woff2',
      'fonts/barlow-condensed-latin-700-normal.woff2',
      'fonts/barlow-condensed-latin-800-normal.woff2',
      ...[...seen].map((url) => new URL(url).pathname.slice(root.pathname.length))
    ])
  );
  return [...seen].map((url) => new URL(url).pathname.slice(root.pathname.length));
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const files = await preparePages();
  console.log(`Site public préparé : ${files.length} modules dans _site/`);
}
