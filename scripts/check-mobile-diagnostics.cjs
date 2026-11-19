const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { readFileSync } = require('node:fs');
const { dirname, join } = require('node:path');

async function run() {
  const browser = await chromium.launch({
    executablePath: process.env.BET_CHROMIUM || '/usr/bin/chromium'
  });
  try {
    const url = new URL(process.argv[2] || 'http://127.0.0.1:4174/');
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'reduce'
    });
    const bundle = readFileSync(
      join(dirname(require.resolve('web-vitals')), 'web-vitals.iife.js'),
      'utf8'
    );
    await context.addInitScript({
      content:
        bundle +
        `
        window.betVitals = {};
        for (const name of ['LCP', 'CLS', 'INP'])
          webVitals['on' + name](({ value }) => (window.betVitals[name] = value), {
            reportAllChanges: true
          });
      `
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: 200000,
      uploadThroughput: 93750
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const read = () =>
      page.evaluate(() => ({
        vitals: window.betVitals,
        marks: performance
          .getEntriesByType('mark')
          .filter((entry) => entry.name.startsWith('bet-mobile:'))
          .map(({ name, startTime }) => [name, Math.round(startTime)])
      }));
    const waitCalendar = () =>
      page
        .locator('.match-card, #match-list .guided-empty, #today-empty:visible')
        .first()
        .waitFor();
    await page.goto(url.href, { waitUntil: 'domcontentloaded' });
    await waitCalendar();
    assert.deepEqual((await read()).marks, []);
    await context.clearCookies();
    await cdp.send('Storage.clearDataForOrigin', { origin: url.origin, storageTypes: 'all' });
    await cdp.send('Network.clearBrowserCache');

    url.searchParams.set('diagnostic-mobile', '');
    for (const cache of ['froid', 'chaud']) {
      await page.goto(url.href, { waitUntil: 'domcontentloaded' });
      await waitCalendar();
      const marks = () =>
        page.evaluate(() => performance.getEntriesByType('mark').map((entry) => entry.name));
      await page.waitForFunction(
        () =>
          performance.getEntriesByName('bet-mobile:reseau-json-parse').length &&
          performance.getEntriesByName('bet-mobile:calendrier-enrichi').length
      );
      const first = await read();
      for (const phase of ['requete', 'corps-recu', 'json-parse'])
        assert.equal(
          first.marks.filter(([name]) => name === 'bet-mobile:reseau-' + phase).length,
          1
        );
      if (!(await page.locator('.match-card').count())) {
        await page.locator('[data-date=week]').click();
      }
      if (await page.locator('[data-match-stats]').count()) {
        await page.locator('[data-match-stats]').first().click();
        await page
          .locator('[data-favorite-league]:not(.active):visible')
          .first()
          .click({ timeout: 5000 });
        assert.equal(
          (await marks()).filter((name) => name === 'bet-mobile:ouverture-analyse').length,
          1
        );
        assert.equal(
          (await marks()).filter((name) => name === 'bet-mobile:ajout-favori').length,
          1
        );
      }
      await page.locator('[data-mobile-target=predictions]').click();
      assert.equal(
        (await marks()).filter((name) => name === 'bet-mobile:consultation-resultats').length,
        1
      );
      await page.locator('[data-mobile-target=bankroll]').click();
      await page.locator('#bankroll-guest [data-open-join]').click();
      assert.equal(
        (await marks()).filter((name) => name === 'bet-mobile:intention-synchronisation').length,
        1
      );
      await page.waitForTimeout(400);
      const result = await read();
      assert.equal(
        result.marks.filter(([name]) => name === 'bet-mobile:calendrier-utilisable').length,
        1
      );
      for (const name of ['LCP', 'CLS', 'INP'])
        assert.ok(Number.isFinite(result.vitals[name]), name + ' non mesuré');
      console.log(JSON.stringify({ cache, ...result }));
    }
    await context.close();
  } finally {
    await browser.close();
  }
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
