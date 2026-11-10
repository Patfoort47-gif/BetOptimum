const assert = require('node:assert/strict'),
  { browser, page } = require('./ui-mobile-fixtures.cjs');
(async () => {
  const b = await browser();
  try {
    for (const width of [375, 390, 430, 767, 768, 1023, 1024, 1440]) {
      const p = await page(b, { width, logged: true });
      await p.locator('.match-selection').first().click();
      const selected = await p.locator('.match-selection').first().getAttribute('data-market');
      await p.locator('[data-open-ticket]').first().click();
      await p.locator('[data-stake-action=reset]').click();
      for (const [action, value] of [
        ['5', '5.00'],
        ['10', '15.00'],
        ['50', '65.00']
      ]) {
        await p.locator(`[data-stake-action="${action}"]`).click();
        assert.equal(await p.locator('#stake').inputValue(), value);
        assert.equal(
          await p.locator('#stake').evaluate((el) => document.activeElement === el),
          false
        );
      }
      assert.equal(await p.locator('[data-stake-action=unit]').isDisabled(), true);
      assert.match(await p.locator('#stake-unit-help').textContent(), /indisponible/);
      assert.equal(await p.evaluate(() => __betCalls.length), 0);
      await p.locator('.stake-unit-settings summary').click();
      await p.locator('#stake-unit').fill('12.34');
      await p.locator('#save-stake-unit').click();
      await p.locator('[data-stake-action=unit]').click();
      assert.equal(await p.locator('#stake').inputValue(), '12.34');
      await p.locator('[data-stake-action="5"]').evaluate((el) => {
        for (let i = 0; i < 10; i++) el.click();
      });
      assert.equal(await p.locator('#stake').inputValue(), '62.34');
      await p.locator('#manual-stake').click();
      assert.equal(await p.locator('#stake').evaluate((el) => document.activeElement === el), true);
      assert.equal(await p.locator('#stake').getAttribute('inputmode'), 'decimal');
      await p.locator('#stake').fill('1001');
      assert.equal(await p.locator('#place-bet').isDisabled(), true);
      assert.match(await p.locator('#stake-feedback').textContent(), /dépasse/);
      assert.equal(await p.locator('#ticket-items [data-remove]').count(), 1);
      await p.locator('#stake').fill('0.50');
      assert.match(await p.locator('#stake-feedback').textContent(), /minimale/);
      await p.locator('#stake').fill('1.001');
      assert.equal(await p.locator('#place-bet').isDisabled(), true);
      await p.locator('#stake').fill('12.34');
      await p.locator('#place-bet').dblclick();
      await p.waitForFunction(() => __betCalls.length === 1);
      const jobs = await p.evaluate(() => __betCalls);
      assert.equal(jobs[0].stake, 12.34);
      assert.equal(jobs[0].selections[0].key, selected);
      assert.equal(jobs[0].selections[0].matchId, 'espn-1');
      assert.deepEqual(p.__errors, []);
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      console.log('OK ajouts, unité, rafale, validation et confirmation', width);
      if (width === 375) {
        await p.reload();
        await p.locator('[data-mobile-target=matches]').click();
        await p.locator('.match-card').first().waitFor();
        await p.locator('[data-open-ticket]').first().click();
        assert.equal(await p.locator('[data-stake-action=unit]').isDisabled(), false);
        assert.match(await p.locator('#stake-unit-help').textContent(), /12,34/);
      }
      await p.close();
    }
    const p = await page(b, { logged: true, failure: 'unknown' });
    await p.locator('.match-selection').first().click();
    await p.locator('[data-open-ticket]').first().click();
    await p.locator('#place-bet').click();
    await p.getByRole('button', { name: 'Vérifier le pari en attente', exact: true }).waitFor();
    assert.ok(
      await p.locator('#stake-controls button').evaluateAll((els) => els.every((el) => el.disabled))
    );
    const before = await p.locator('#stake').inputValue();
    await p.locator('[data-stake-action="50"]').evaluate((el) => el.click());
    assert.equal(await p.locator('#stake').inputValue(), before);
    assert.equal(await p.evaluate(() => __betCalls.length), 1);
    await p.locator('#place-bet').click();
    assert.equal(await p.evaluate(() => __betCalls.length), 1);
    await p.close();
    console.log('OK confirmation incertaine : commandes verrouillées, vérification sans doublon');
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
