import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { preparePages } from '../scripts/prepare-pages.mjs';
const base = 'https://pronosafe.fr/';
test('SEO PronoSafe présent dans le HTML initial et cohérent avec le canonique', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8'),
    meta = (key, attr = 'name') =>
      html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))?.[1],
    title = html.match(/<title>([^<]+)<\/title>/)[1];
  assert.match(title, /^PronoSafe - Pronostics foot du jour/);
  assert.equal(meta('og:title', 'property'), title);
  assert.equal(meta('twitter:title'), title);
  assert.equal(meta('description'), meta('og:description', 'property'));
  assert.equal(meta('twitter:description'), meta('description'));
  assert.match(html, new RegExp(`<link rel="canonical" href="${base}">`));
  assert.equal(meta('og:url', 'property'), base);
  assert.equal(meta('twitter:card'), 'summary_large_image');
  assert.equal(meta('twitter:image'), meta('og:image', 'property'));
  const structuredData = Array.from(
    html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g),
    ([, json]) => JSON.parse(json)
  );
  const website = structuredData.find((entry) => entry['@type'] === 'WebSite');
  assert.equal(website.name, 'PronoSafe');
  assert.equal(website.alternateName, 'Prono Safe');
  assert.equal(website.url, base);
  const schema = structuredData.find((entry) => entry['@type'] === 'WebApplication');
  assert.equal(schema.name, 'PronoSafe');
  assert.equal(schema.url, base);
  assert.equal(schema.offers.price, '0');
  assert.equal(schema.inLanguage, 'fr');
  const image = await readFile(new URL('../icons/pronosafe-social.png', import.meta.url));
  assert.equal(image.readUInt32BE(16), 1200);
  assert.equal(image.readUInt32BE(20), 630);
});
test('publication avec sitemap sans ancres, robots et image sociale', async () => {
  const dir = await mkdtemp(tmpdir() + '/bet-seo-');
  try {
    await preparePages(pathToFileURL(dir + '/'));
    for (const file of ['sitemap.xml', 'robots.txt', 'icons/pronosafe-social.png'])
      await access(dir + '/' + file);
    const html = await readFile(dir + '/index.html', 'utf8');
    assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes">/);
    assert.match(html, /<meta name="apple-mobile-web-app-title" content="PronoSafe">/);
    const manifestUrl = html.match(/<link rel="manifest" href="\.\/([^"]+)"/)[1];
    const manifest = JSON.parse(await readFile(dir + '/' + manifestUrl.split('?')[0], 'utf8'));
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.start_url, './');
    assert.equal(manifest.scope, './');
    const offline = JSON.parse(await readFile(dir + '/offline-assets.json', 'utf8'));
    assert.ok(offline.includes(manifestUrl));
    const sitemap = await readFile(dir + '/sitemap.xml', 'utf8');
    const urls = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g), ([, url]) => url);
    const paths = ['', 'bilan-des-pronostics/', 'lexique-des-paris/'];
    assert.deepEqual(
      urls,
      paths.map((path) => base + path)
    );
    for (const path of paths) {
      const page = await readFile(dir + '/' + path + 'index.html', 'utf8');
      assert.ok(page.includes('<link rel="canonical" href="' + base + path + '">'));
      const linkedPath = path === 'lexique-des-paris/' ? path + '#paris-safe' : path;
      if (path) assert.ok(html.includes('href="./' + linkedPath + '"'));
      if (path === 'lexique-des-paris/') assert.match(page, /<h2 id="paris-safe">/);
    }
    assert.match(await readFile(dir + '/robots.txt', 'utf8'), /User-agent: \*\nAllow: \/\n/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('un seul h1 initial, court et lisible', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /<h1 id="calendar-hero-title">Vos matchs du jour<\/h1>/);
  assert.match(html, /<h2>Résultats du modèle<\/h2>/);
  assert.match(html, /<h2>Rejoignez le club<\/h2>/);
});

import { prerenderSeo } from '../scripts/prerender-seo.mjs';
test('HTML public lisible sans JS, échappé et sans match ancien ni donnée privée', () => {
  const now = Date.parse('2026-11-10T08:00Z'),
    m = {
      id: 'm',
      date: '2026-11-10',
      time: '21:00',
      kickoff: '2026-11-10T20:00Z',
      home: '<script>alert(1)</script>',
      away: 'Visiteurs',
      league: 'Ligue 1',
      priority: 100,
      homeGoals: 1.5,
      awayGoals: 1.1,
      odds: { home: 2 },
      realOddsMarkets: ['home'],
      bookmakerOffers: Array.from({ length: 10 }, (_, i) => ({ key: `b${i}`, home: 2 }))
    },
    data = {
      generatedAt: new Date(now).toISOString(),
      matches: [
        m,
        { ...m, id: 'ineligible', home: 'Masquer ce match', bookmakerOffers: [] },
        { ...m, id: 'old', date: '2026-11-09', home: 'Ancien' }
      ],
      accounts: [{ email: 'private@example.org' }]
    },
    html = prerenderSeo(
      '<div id="match-list" class="match-list" aria-live="polite"></div>',
      data,
      now
    );
  assert.match(html, /Probabilités du modèle/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>|Ancien|Masquer ce match|private@example/);
  assert.match(html, /18\+/);
  assert.throws(() => prerenderSeo('', data, now), /Conteneur/);
});
