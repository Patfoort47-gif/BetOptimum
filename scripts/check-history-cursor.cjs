const assert = require('node:assert/strict'),
  { browser, page } = require('./ui-mobile-fixtures.cjs'),
  { mountHistory } = require('./ui-history-fixtures.cjs');
(async () => {
  const b = await browser();
  try {
    for (const width of [375, 390, 430, 767, 768, 1023, 1024, 1440]) {
      const p = await page(b, { width, logged: true });
      await p.locator('.match-card').first().waitFor();
      await p
        .locator(width < 768 ? '[data-mobile-target=bankroll]' : '[data-tab=bankroll]')
        .click();
      await mountHistory(p);
      await p.waitForFunction(() => document.querySelector('#history-body').children.length === 5);
      const kpis = await p.locator('#personal-kpis').textContent();
      await p.evaluate(
        () => (window.__first = document.querySelector('#history-body').firstElementChild)
      );
      await p.locator('[data-history-more]').evaluate((el) => {
        for (let i = 0; i < 10; i++) el.click();
      });
      await p.waitForFunction(() => document.querySelector('#history-body').children.length === 10);
      assert.equal(await p.evaluate(() => __h.calls.length), 2);
      assert.equal(
        await p.evaluate(
          () => __first === document.querySelector('#history-body').firstElementChild
        ),
        true
      );
      assert.equal(await p.locator('#personal-kpis').textContent(), kpis);
      await p.evaluate(() => (__h.fail = true));
      await p.locator('[data-history-more]').click();
      await p.waitForFunction(
        () => document.querySelector('#history-pagination button').textContent === 'Réessayer'
      );
      assert.equal(await p.locator('#history-body>*').count(), 10);
      const failed = await p.evaluate(() => JSON.stringify(__h.calls.at(-1).cursor));
      await p.locator('[data-history-more]').click();
      await p.waitForFunction(() => document.querySelector('#history-body').children.length === 15);
      assert.equal(await p.evaluate(() => JSON.stringify(__h.calls.at(-1).cursor)), failed);
      await p.evaluate(() =>
        __h.rows.unshift({
          ...__h.rows[0],
          id: '99999999-0000-0000-0000-000000000001',
          placed_at: new Date().toISOString()
        })
      );
      while (await p.locator('[data-history-more]').count()) {
        await p.locator('[data-history-more]').click();
        await p.waitForFunction(
          () => document.querySelector('#bankroll').getAttribute('aria-busy') === 'false'
        );
      }
      assert.equal(await p.locator('#history-body>*').count(), 25);
      assert.match(await p.locator('#history-pagination').textContent(), /Fin de l’historique/);
      assert.ok(
        await p.evaluate(
          () =>
            document.querySelector('#history-body').textContent &&
            !__h.calls.slice(1).some((c) => !c.cursor)
        )
      );
      await p.locator('#refresh-history').click();
      await p.waitForFunction(() => document.querySelector('#history-body').children.length === 5);
      assert.match(await p.locator('#history-count').textContent(), /5 sur 26/);
      await p.locator('#history-search').fill('absent');
      await p.waitForFunction(() => document.querySelector('#empty-history').hidden === false);
      assert.equal(await p.locator('#history-body>*').count(), 0);
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(p.__errors, []);
      console.log('OK lots 5, rafale, reprise, ajout concurrent, agrégats et filtres', width);
      await p.close();
    }
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
