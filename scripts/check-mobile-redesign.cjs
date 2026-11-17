const assert = require('node:assert/strict');
const { browser, page } = require('./ui-mobile-fixtures.cjs');
(async () => {
  const b = await browser();
  try {
    for (const width of [320, 390, 767, 768, 1440]) {
      const p = await page(b, { width, dark: true });
      await p.locator('#match-espn-1').waitFor();
      assert.ok(
        await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `débordement ${width}`
      );
      if (width < 768) {
        assert.equal(await p.locator('.mobile-nav button:visible').count(), 4);
        const header = await p.locator('.topbar').boundingBox();
        assert.ok(header.height <= 56);
        assert.ok(await p.locator('.topbar-bankroll').isVisible());
        assert.equal(await p.locator('.hero').isVisible(), false);
        for (const tab of ['predictions', 'standings', 'bankroll', 'matches']) {
          await p.locator(`[data-mobile-target=${tab}]`).click();
          assert.equal(
            await p.locator(`[data-mobile-target=${tab}]`).getAttribute('aria-current'),
            'page'
          );
        }
      }
      assert.deepEqual(p.__errors, []);
      await p.close();
      console.log('OK navigation', width);
    }
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
