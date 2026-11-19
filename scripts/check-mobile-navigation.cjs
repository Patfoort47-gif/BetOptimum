const assert = require('node:assert/strict');
const { browser, page, fixtures } = require('./ui-mobile-fixtures.cjs');

(async () => {
  const b = await browser();
  try {
    for (const width of [320, 360, 390, 430, 767, 768, 1440]) {
      const p = await page(b, {
        width,
        touch: true,
        data: {
          ...fixtures,
          matches: fixtures.matches.map((match) => ({ ...match, analysisStatus: 'ready' }))
        }
      });
      const nav = p.locator('.mobile-nav');
      assert.equal(await nav.isVisible(), width < 768);
      if (width < 768) {
        const buttons = await nav.getByRole('button').all();
        assert.equal(buttons.length, 5);
        for (const button of buttons) {
          const box = await button.boundingBox();
          assert.ok(box.width >= 44 && box.height >= 44);
        }
        assert.equal(await buttons[0].evaluate((el) => getComputedStyle(el).fontSize), '12px');
        const dates = await p.locator('#date-navigator').boundingBox();
        const prev = await p.getByRole('button', { name: 'Dates précédentes' }).boundingBox();
        const next = await p.getByRole('button', { name: 'Dates suivantes' }).boundingBox();
        assert.ok(prev.x + prev.width <= dates.x + 1 && dates.x + dates.width <= next.x + 1);
        await p.locator('#open-help').click();
        await p.getByRole('button', { name: 'Guide en trois étapes' }).click();
        assert.ok(await p.locator('.tutorial-dialog').isVisible());
        await p.keyboard.press('Escape');
        await p.locator('[data-mobile-target=bankroll]').click();
        await p.locator('[data-mobile-target=standings]').click();
        await p.goBack();
        assert.ok(await p.locator('#bankroll').isVisible());
        await p.goBack();
        assert.ok(await p.locator('#matches').isVisible());
        await p.locator('.match-card .match-selection').first().click();
        assert.ok(await p.locator('#mobile-coupon').isVisible());
        assert.ok(
          await p.locator('body').evaluate((el) => el.classList.contains('has-mobile-coupon'))
        );
        await p.addStyleTag({ content: 'html { font-size: 150%; }' });
      }
      assert.ok(
        await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `overflow ${width}`
      );
      assert.deepEqual(p.__errors, []);
      await p.close();
      console.log('OK navigation', width);
    }
  } finally {
    await b.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
