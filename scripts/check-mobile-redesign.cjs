const assert = require('node:assert/strict');
const { browser, page, fixtures, match } = require('./ui-mobile-fixtures.cjs');
(async () => {
  const b = await browser();
  try {
    for (const width of [320, 390, 767, 768, 1440]) {
      const p = await page(b, {
        width,
        dark: true,
        data: {
          ...fixtures,
          matches: fixtures.matches.map((m) => ({ ...m, analysisStatus: 'ready' }))
        }
      });
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
      if (width < 768) {
        const card = p.locator('#match-espn-1');
        const home = card.locator('.result-pick[data-market=home]');
        const draw = card.locator('.result-pick[data-market=draw]');
        assert.equal(await card.locator('.result-pick:visible').count(), 3);
        assert.ok((await home.boundingBox()).height >= 44);
        await home.click();
        assert.equal(await home.getAttribute('aria-pressed'), 'true');
        assert.equal(await p.locator('#ticket-items [data-remove]').count(), 1);
        await draw.click();
        assert.equal(await home.getAttribute('aria-pressed'), 'false');
        assert.equal(await draw.getAttribute('aria-pressed'), 'true');
        assert.equal(await p.locator('#ticket-items [data-remove]').count(), 1);
        await draw.click();
        assert.equal(await p.locator('#ticket-items [data-remove]').count(), 0);
      }
      assert.deepEqual(p.__errors, []);
      await p.close();
      console.log('OK navigation', width);
    }
    const partial = await page(b, {
      data: {
        ...fixtures,
        matches: [
          {
            ...match,
            analysisStatus: 'ready',
            bookmakerOffers: match.bookmakerOffers.map((offer, i) =>
              i < 9 ? offer : { ...offer, home: undefined }
            )
          }
        ]
      }
    });
    await partial.locator('.result-pick').first().waitFor();
    assert.equal(await partial.locator('.result-pick[data-market=home]').isDisabled(), true);
    assert.equal(await partial.locator('.result-pick[data-market=draw]').isEnabled(), true);
    await partial.close();
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
