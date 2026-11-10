const { chromium } = require('playwright'),
  fs = require('node:fs'),
  assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox']
  });
  for (const width of [360, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', (r) => {
      const u = new URL(r.request().url());
      if (u.hostname !== '127.0.0.1') return r.abort();
      if (u.pathname === '/src/history/personal-dashboard.js')
        return r.fulfill({
          contentType: 'text/javascript',
          body: fs.readFileSync('src/history/personal-dashboard.js', 'utf8')
        });
      if (u.pathname === '/styles/components.css')
        return r.fulfill({
          contentType: 'text/css',
          body: fs.readFileSync('styles/components.css', 'utf8')
        });
      if (u.pathname === '/')
        return r.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><html><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/styles/components.css"></head><body></body></html>'
        });
      return r.continue();
    });
    await page.goto('http://127.0.0.1:4173');
    await page.evaluate(async () => {
      const { initPersonalDashboard } = await import('/src/history/personal-dashboard.js');
      document.body.innerHTML =
        '<section id="bankroll"><div id="personal-filters"><select id="history-period"><option value="all">Tout</option><option value="7">7 jours</option></select><select id="history-status"><option value="all">Tous</option><option value="won">Gagnés</option><option value="pending">En attente</option></select><input id="history-search"><button id="reset-history">Réinitialiser</button></div><dl id="personal-summary"></dl><dl id="personal-secondary"></dl><div id="personal-charts"></div><p id="history-count"></p><div id="history-body"></div><div id="empty-history"></div><div id="history-pagination"></div></section>';
      window.calls = [];
      window.gates = [];
      window.api = {
        personalDashboard: async (f) => {
          calls.push({ ...f });
          if (window.delay) await new Promise((resolve) => gates.push(resolve));
          return {
            page: 1,
            total: f.search === 'absent' ? 0 : 1,
            rows: [],
            summary: {
              bankroll: 1000,
              total: 1,
              won: f.status === 'won' ? 1 : 0,
              lost: 0,
              pending: f.status === 'pending' ? 1 : 0,
              void: 0,
              net: f.status === 'won' ? 15 : 0,
              decided: 1,
              wins: 1,
              engaged: 0,
              potential: 0,
              staked: 10,
              returned: 25,
              settled: 1
            },
            openingDate: '2026-11-01',
            curve: [{ day: '2026-11-02', balance: 15, delta: 15 }],
            bars: [{ period: '2026-11-01', net: 15, staked: 10, returned: 25 }]
          };
        }
      };
      window.dashboard = initPersonalDashboard({ root: document.querySelector('#bankroll'), api });
      await dashboard.load();
    });
    await page.locator('#history-status').selectOption('won');
    await page.waitForFunction(
      () =>
        calls.at(-1).status === 'won' &&
        document.querySelector('#bankroll').getAttribute('aria-busy') === 'false'
    );
    await page.locator('#history-period').selectOption('7');
    await page.locator('#history-search').fill('Paris');
    await page.waitForFunction(() => calls.at(-1).search === 'Paris');
    assert.deepEqual(await page.evaluate(() => calls.at(-1)), {
      days: 7,
      status: 'won',
      search: 'Paris',
      page: 1
    });
    await page.evaluate(() => {
      window.delay = true;
      document.querySelector('#history-search').value = 'ancien';
      document
        .querySelector('#history-search')
        .dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForFunction(() => gates.length === 1);
    await page.locator('#history-search').fill('nouveau');
    await page.evaluate(() => gates.shift()());
    await page.waitForFunction(() => gates.length === 1);
    await page.evaluate(() => {
      window.delay = false;
      gates.shift()();
    });
    await page.waitForFunction(
      () => document.querySelector('#bankroll').getAttribute('aria-busy') === 'false'
    );
    await page.locator('#reset-history').click();
    await page.waitForFunction(() => calls.at(-1).status === 'all' && calls.at(-1).search === '');
    assert.equal(await page.locator('.dashboard-charts svg text').count(), 0);
    assert.equal(
      await page
        .locator('.chart-labels')
        .first()
        .evaluate((el) => getComputedStyle(el).fontSize),
      '13px'
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true
    );
    assert.deepEqual(errors, []);
    await page.close();
    console.log(
      `OK ${width}px : filtres combinés, réinitialisation, réponse périmée ignorée, chiffres HTML nets, aucune erreur JS ni débordement`
    );
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
