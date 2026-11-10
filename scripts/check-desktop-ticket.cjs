const assert = require('node:assert/strict'),
  { browser, page } = require('./ui-mobile-fixtures.cjs');
(async () => {
  const b = await browser();
  try {
    for (const width of [1024, 1280, 1440]) {
      const p = await page(b, { width, logged: true });
      await p.locator('.match-card').first().waitFor();
      const dims = await p.evaluate(() => {
        const left = document.querySelector('#matches').getBoundingClientRect(),
          right = document.querySelector('#builder').getBoundingClientRect();
        return {
          ratio: left.width / (left.width + right.width),
          gap: right.left - left.right,
          position: getComputedStyle(document.querySelector('#builder')).position
        };
      });
      assert.ok(Math.abs(dims.ratio - 0.65) < 0.002);
      assert.equal(dims.gap, 24);
      assert.equal(dims.position, 'sticky');
      await p.locator('.match-selection').first().click();
      await p.locator('#stake').fill('32.45');
      await p.locator('#share-combo').scrollIntoViewIfNeeded();
      await p.locator('#share-combo').focus();
      const rect = await p.locator('#share-combo').boundingBox();
      assert.ok(rect.y >= 0 && rect.y + rect.height <= 1000);
      assert.ok(await p.locator('#builder').evaluate((el) => el.scrollTop > 0));
      await p.setViewportSize({ width: 1023, height: 1000 });
      assert.equal(await p.locator('#ticket-items [data-remove]').count(), 1);
      assert.equal(await p.locator('#stake').inputValue(), '32.45');
      assert.equal(
        await p.locator('#builder').evaluate((el) => getComputedStyle(el).position),
        'static'
      );
      await p.setViewportSize({ width: 375, height: 1000 });
      await p.locator('[data-open-ticket]').first().click();
      assert.equal(await p.locator('#stake').inputValue(), '32.45');
      assert.equal(await p.locator('#ticket-items [data-remove]').count(), 1);
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(p.__errors, []);
      console.log('OK 65/35, volet long, focus et redimensionnement', width);
      await p.close();
    }
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
