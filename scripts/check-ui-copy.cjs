const assert = require('node:assert/strict'),
  { browser, page } = require('./ui-mobile-fixtures.cjs'),
  { mountHistory } = require('./ui-history-fixtures.cjs');
(async () => {
  const b = await browser();
  try {
    for (const width of [375, 390, 430, 767, 768, 1023, 1024, 1440]) {
      const p = await page(b, { width, logged: true, touch: width < 768 });
      await p.locator('.match-card').first().waitFor();
      assert.equal(await p.locator('#quick-combo').textContent(), 'Composer un ticket');
      assert.equal(
        await p.locator('.predictions-heading h3').first().textContent(),
        'Choisir un pronostic'
      );
      await p.locator('.match-selection').first().click();
      await p.locator('[data-open-ticket]').first().click();
      await p.locator('[data-stake-action=reset]').click();
      await p.locator('[data-stake-action="5"]').click();
      const value = await p.locator('#stake').inputValue();
      await p.locator('[data-metric-help=unit]').focus();
      assert.match(await p.locator('#metric-tooltip').textContent(), /ne confirme jamais le pari/);
      await p.keyboard.press('Escape');
      assert.equal(await p.locator('#stake').inputValue(), value);
      assert.equal(
        await p.locator('[data-metric-help=unit]').evaluate((el) => document.activeElement === el),
        true
      );
      await p.locator('#stake').fill('0.50');
      assert.match(await p.locator('#stake-feedback').textContent(), /minimale est de 1/);
      assert.equal(await p.locator('#place-bet').isDisabled(), true);
      assert.equal(await p.evaluate(() => __betCalls.length), 0);
      if (width <= 700) await p.locator('#close-builder').click();
      const nav = async (tab) =>
        p.locator(width < 768 ? `[data-mobile-target=${tab}]` : `[data-tab=${tab}]`).click();
      await nav('community');
      assert.equal(
        await p.locator('#club-section-description').textContent(),
        'Choisissez un classement.'
      );
      await nav('predictions');
      assert.equal(
        await p.locator('.model-filter-title strong').textContent(),
        'Filtrer les résultats'
      );
      assert.equal(
        await p.locator('.model-intro').textContent(),
        'Consultez les résultats des pronostics archivés.'
      );
      assert.match(await p.locator('.model-disclaimer').textContent(), /Simulation/);
      await nav('bankroll');
      assert.equal(await p.locator('#refresh-history').textContent(), 'Actualiser');
      await mountHistory(p);
      await p.waitForFunction(() => document.querySelector('#history-body').children.length === 5);
      assert.equal(await p.locator('[data-history-more]').textContent(), 'Charger plus');
      assert.match(
        await p.locator('.personal-history .archive-note').first().textContent(),
        /Paris virtuels · 18\+ · Aucune garantie/
      );
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(p.__errors, []);
      console.log('OK libellés quatre espaces, aide unité, erreurs et réserves', width);
      await p.close();
    }
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
