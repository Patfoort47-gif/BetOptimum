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
        assert.equal(buttons.length, 4);
        assert.equal(await nav.getByRole('button', { name: 'Classement des équipes' }).count(), 0);
        const navBox = await nav.boundingBox();
        assert.equal(navBox.x, 0);
        assert.equal(navBox.width, width);
        assert.equal(navBox.y + navBox.height, await p.evaluate(() => innerHeight));
        for (const button of buttons) {
          const box = await button.boundingBox();
          assert.ok(box.width >= 44 && box.height >= 44);
        }
        const dates = await p.locator('#date-navigator').boundingBox();
        const prev = await p.getByRole('button', { name: 'Dates précédentes' }).boundingBox();
        const next = await p.getByRole('button', { name: 'Dates suivantes' }).boundingBox();
        assert.ok(prev.x + prev.width <= dates.x + 1 && dates.x + dates.width <= next.x + 1);
        await p.locator('[data-mobile-target=bankroll]').click();
        await p.goBack();
        assert.ok(await p.locator('#matches').isVisible());
        await p
          .getByRole('navigation', { name: 'Dans Matchs' })
          .getByRole('button', { name: 'Classement' })
          .click();
        assert.ok(await p.locator('#standings').isVisible());
        assert.equal(
          await nav.getByRole('button', { name: 'Matchs' }).getAttribute('aria-current'),
          'page'
        );
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
