// Recette locale uniquement, prix simulés pour éprouver l'interface. Les preuves de couverture sont séparées.
const { chromium } = require('playwright'),
  assert = require('node:assert/strict'),
  fs = require('node:fs');
const base = process.env.BET_BASE_URL || 'http://127.0.0.1:4173';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const mock = fs
  .readFileSync(__dirname + '/check-public-ui.cjs', 'utf8')
  .match(/const mock\s*=\s*`([\s\S]*?)`;/)[1];
const now = Date.now(),
  date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now),
  stamp = new Date(now).toISOString(),
  until = new Date(now + 20 * 3600000).toISOString();
function match(id, count) {
  const odds = { home: 2, draw: 3, away: 4, over: 2, btts: 2, h1Home: 2.1, h1Over05: 1.5 },
    keys = Object.keys(odds);
  return {
    id,
    date,
    time: '23:59',
    kickoff: new Date(now + 7200000).toISOString(),
    league: 'Ligue 1',
    home: id === 'espn-1' ? 'Alpha' : 'Gamma',
    away: 'Beta',
    homeGoals: 1.5,
    awayGoals: 1.1,
    odds,
    realOddsMarkets: keys,
    marketValidUntil: { h1Home: until, h1Over05: until },
    bookmakerOffers: Array.from({ length: 10 }, (_, i) => ({
      key: 'book' + i,
      name: 'Book ' + i,
      ...Object.fromEntries(
        keys
          .filter((k) => !k.startsWith('h1') || i < count)
          .flatMap((k) => [
            [k, odds[k]],
            [k + 'UpdatedAt', stamp]
          ])
      )
    }))
  };
}
const fixtures = {
  generatedAt: stamp,
  oddsRefreshedAt: stamp,
  matches: [match('espn-1', 10), match('espn-2', 9)],
  settlements: []
};
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.BET_CHROMIUM || '/usr/bin/chromium',
    args: ['--no-sandbox']
  });
  try {
    for (const width of [320, 1280])
      for (const light of [false, true]) {
        const page = await browser.newPage({ viewport: { width, height: 1000 } }),
          errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.route('**/*', (r) => {
          const u = new URL(r.request().url());
          if (u.origin !== new URL(base).origin) return r.abort();
          if (u.pathname.endsWith('/src/account/account.js'))
            return r.fulfill({ contentType: 'text/javascript', body: mock });
          if (u.pathname.endsWith('/data/fixtures.json')) return r.fulfill({ json: fixtures });
          if (u.pathname.endsWith('/data/predictions-history.json')) return r.fulfill({ json: [] });
          return r.continue();
        });
        await page.goto(base);
        await page.waitForSelector('[data-market="h1Home"]', { state: 'attached' });
        await page.evaluate(
          (light) => document.documentElement.classList.toggle('light', light),
          light
        );
        const card = page.locator('#match-espn-1'),
          group = card.locator('details').filter({ has: page.locator('[data-market="h1Home"]') });
        assert.equal(await page.locator('#match-espn-2 [data-market^="h1"]').count(), 0);
        await group.locator('summary').focus();
        await page.keyboard.press('Enter');
        const button = card.locator('[data-market="h1Home"]');
        await button.focus();
        await page.keyboard.press('Enter');
        if (width < 700) await page.locator('[data-mobile-target="builder"]').click();
        assert.match(await page.locator('#ticket-items').innerText(), /1re mi-temps : Alpha/);
        assert.match(await page.locator('#ticket-items').innerText(), /sans modèle/);
        assert.equal(await page.locator('#ticket-items .ticket-row').count(), 1);
        if (width < 700) await page.locator('#close-builder').click();
        assert.match(await group.innerText(), /Sans modèle/);
        assert(!/NaN|undefined/.test(await group.innerText()));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        assert.deepEqual(errors, []);
        console.log(
          `H1 OK ${width}px ${light ? 'clair' : 'sombre'} : clavier, famille, seuil 9/10, ticket, sans modèle et débordement.`
        );
        await page.close();
      }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
