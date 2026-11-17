const assert = require('node:assert/strict');
const { browser, page, fixtures } = require('./ui-mobile-fixtures.cjs');
(async () => {
  const b = await browser();
  try {
    for (const width of [320, 375, 390, 430, 767, 768, 1024, 1440])
      for (const dark of [false, true]) {
        const p = await page(b, {
          width,
          dark,
          data: {
            ...fixtures,
            matches: fixtures.matches.map((m) => ({ ...m, analysisStatus: 'ready' }))
          }
        });
        const card = p.locator('#match-espn-1');
        await card.waitFor();
        assert.equal(await card.locator('.match-other-markets').getAttribute('open'), null);
        assert.ok(await card.locator('.match-overview .recommended').isVisible());
        if (width < 768) {
          const filter = await p.locator('[data-league-menu]').boundingBox();
          assert.ok(filter.x >= 0, JSON.stringify(filter));
          for (const selector of ['.filters', '.date-navigator'])
            assert.equal(
              await p
                .locator(selector)
                .first()
                .evaluate((e) => getComputedStyle(e).scrollbarWidth),
              'none'
            );
          assert.equal(await card.locator('.result-pick:visible').count(), 3);
        }
        await card.locator('.match-other-markets > summary').click();
        assert.ok(await card.locator('.featured-markets').isVisible());
        await card.locator('.match-explanation > summary').click();
        assert.ok(
          await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `overflow ${width}`
        );
        const over = await card
          .locator('.fair-odds')
          .evaluate((e) => e.scrollWidth > e.clientWidth + 1);
        assert.equal(over, false, `table ${width}`);
        assert.doesNotMatch(
          await card.locator('.match-explanation').textContent(),
          /Qualité des données : 5\/100/
        );
        assert.deepEqual(p.__errors, []);
        await p.close();
        console.log('OK', width, dark);
      }
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
