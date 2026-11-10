// BET-181 : calendrier de recette et fichiers de référence dans work/, serveur de boucle locale uniquement.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox']
  });
  const now = Date.now(),
    day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(now);
  const matches = JSON.parse(fs.readFileSync('work/benchmark-matches.json')).map((m, i) => ({
    ...m,
    id: 'bench-' + i,
    date: day,
    kickoff: new Date(now + 7200000).toISOString(),
    completed: false,
    voided: false
  }));
  let results = [];
  for (const version of (process.env.BET_BENCH_VERSIONS || 'before,after').split(','))
    for (let run = 0; run < Number(process.env.BET_BENCH_RUNS || 3); run++) {
      const page = await browser.newPage({
        viewport: { width: 360, height: 900 },
        reducedMotion: 'reduce'
      });
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      let errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.route('**/*', async (r) => {
        const u = new URL(r.request().url());
        if (u.hostname !== '127.0.0.1') return r.abort();
        if (u.pathname.endsWith('/src/account/account.js'))
          return r.fulfill({
            contentType: 'text/javascript',
            body: 'export async function initAccountSync(){return {configured:false}}'
          });
        if (u.pathname.endsWith('/data/fixtures.json'))
          return r.fulfill({
            json: { generatedAt: new Date(now).toISOString(), matches, settlements: [] }
          });
        if (u.pathname.endsWith('/data/predictions-history.json')) return r.fulfill({ json: [] });
        const name = u.pathname.slice(1);
        if (
          version === 'before' &&
          ['app.js', 'src/model/markets.js', 'src/model/prediction-model.js'].includes(name)
        )
          return r.fulfill({
            contentType: 'text/javascript',
            body: fs.readFileSync('work/before/' + name, 'utf8')
          });
        return r.continue();
      });
      let t = Date.now();
      await page.goto('http://127.0.0.1:4173');
      await page.waitForFunction(
        () => document.querySelectorAll('#match-list .match-card').length === 15,
        {},
        { timeout: 120000 }
      );
      const load = Date.now() - t;
      const filter = await page.evaluate(async () => {
        let t = performance.now();
        document.querySelector('[data-filter="Favoris"]').click();
        await new Promise(requestAnimationFrame);
        document.querySelector('[data-filter="Favoris"]').click();
        await new Promise(requestAnimationFrame);
        return performance.now() - t;
      });
      const select = await page.evaluate(async () => {
        let t = performance.now();
        document.querySelector('#match-list [data-market]').click();
        await new Promise(requestAnimationFrame);
        return performance.now() - t;
      });
      results.push({
        version,
        run,
        load,
        filter,
        select,
        nodes: await page.locator('*').count(),
        errors
      });
      console.log(results.at(-1));
      if (version === 'after') {
        await page.locator('.bookmaker-comparison summary').first().click();
        if (!(await page.locator('.bookmaker-comparison table').count()))
          throw Error('Comparaison absente');
        await page.locator('.market-category summary').first().click();
        const alternative = page.locator('.market-category .markets [data-market]').first();
        await alternative.waitFor();
        await alternative.click();
        if ((await alternative.getAttribute('aria-pressed')) !== 'true')
          throw Error('Alternative non sélectionnée');
        if (errors.length) throw Error(errors.join(', '));
      }
      await page.close();
    }
  fs.writeFileSync(
    process.env.BET_BENCH_REPORT || 'work/performance-results.json',
    JSON.stringify(results, null, 2)
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
