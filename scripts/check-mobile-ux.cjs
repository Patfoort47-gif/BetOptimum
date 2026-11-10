const assert = require('node:assert/strict'),
  { browser, page, fixtures } = require('./ui-mobile-fixtures.cjs');
(async () => {
  const b = await browser();
  try {
    for (const width of [360, 390, 767, 768, 1280]) {
      const p = await page(b, { width, logged: true, touch: true });
      await p.locator('.match-selection').first().waitFor();
      await p.waitForFunction(() => document.querySelector('.ticket-drag-handle'));
      await p.locator('[data-onboarding-dismiss]').first().click();
      await p.locator('.match-selection').first().click();
      await p
        .locator('#mobile-coupon')
        .isVisible()
        .then((v) => (width < 768 ? assert.ok(v) : null));
      await p.locator('[data-open-ticket]').first().click();
      if (width < 768) {
        assert.equal(await p.locator('#builder').getAttribute('role'), 'dialog');
        assert.ok((await p.locator('#builder').boundingBox()).height <= 1000 * 0.85 + 1);
        assert.equal(await p.evaluate(() => getComputedStyle(document.body).overflow), 'hidden');
      }
      assert.equal(await p.locator('#stake-unit').count(), 0);
      for (const [percent, amount] of [
        [1, '10.00'],
        [2, '20.00'],
        [3, '30.00'],
        [5, '50.00']
      ]) {
        await p.locator(`[data-stake-percent="${percent}"]`).click();
        assert.equal(await p.locator('#stake').inputValue(), amount);
      }
      await p.locator('#stake').fill('12.34');
      assert.equal(
        await p.locator('[data-stake-percent="5"]').getAttribute('aria-pressed'),
        'false'
      );
      await p.locator('#share-combo').click();
      await p.locator('.ticket-share-dialog').waitFor();
      assert.equal(await p.locator('.ticket-share-dialog img').count(), 0);
      assert.match(await p.locator('[data-share-summary]').textContent(), /Pari simple|Combiné/);
      await p.locator('[data-share-close]').click();
      if (width < 768) {
        await p.locator('.ticket-backdrop').click({ position: { x: 5, y: 5 } });
        assert.equal(
          await p.evaluate(() => document.body.classList.contains('ticket-drawer-open')),
          false
        );
        await p.locator('#mobile-coupon').click();
        await p
          .locator('.ticket-drag-handle')
          .dispatchEvent('pointerdown', { pointerId: 1, clientX: 195, clientY: 190 });
        await p
          .locator('.ticket-drag-handle')
          .dispatchEvent('pointerup', { pointerId: 1, clientX: 195, clientY: 270 });
        assert.equal(
          await p.evaluate(() => document.body.classList.contains('ticket-drawer-open')),
          false
        );
        await p.locator('[data-mobile-target=community]').click();
        await p.locator('#mobile-coupon').click();
        assert.equal(await p.locator('#community').isVisible(), true);
        await p.keyboard.press('Escape');
        await p.locator('[data-mobile-target=matches]').click();
        await p.locator('#mobile-coupon').click();
      }
      await p.evaluate(() => {
        window.__vibrations = [];
        navigator.vibrate = (arr) => {
          __vibrations.push(arr);
          return true;
        };
      });
      await p.locator('#place-bet').click();
      await p.locator('#place-bet.bet-confirmed').waitFor();
      assert.equal(await p.locator('#place-bet').isDisabled(), true);
      assert.equal(await p.locator('#ticket-items [data-remove]').count(), 1);
      await p.waitForFunction(() => location.hash === '#bankroll');
      assert.equal(await p.locator('#ticket-items [data-remove]').count(), 0);
      assert.equal(await p.evaluate(() => __betCalls.length), 1);
      assert.deepEqual(await p.evaluate(() => __vibrations), [[50]]);
      await p.locator('#share-confirmed-ticket').click();
      await p.locator('.ticket-share-dialog').waitFor();
      await p.locator('[data-share-close]').click();
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(p.__errors, []);
      console.log('OK ticket, pourcentages, partage, validation et navigation', width);
      await p.close();
    }
    const p = await page(b, { width: 390 });
    await p.locator('.match-card').first().waitFor();
    await p.locator('[data-onboarding-dismiss]').first().click();
    await p.locator('[data-mobile-target=predictions]').click();
    await p.locator('.model-more-filters summary').click();
    await p.waitForFunction(
      () => document.querySelector('#prediction-market').dataset.chipsReady === '1'
    );
    await p
      .locator('.chip-field')
      .filter({ hasText: 'Marché' })
      .getByRole('button', { name: 'Match nul', exact: true })
      .click();
    assert.equal(await p.locator('#prediction-market').inputValue(), 'draw');
    assert.equal(await p.locator('#prediction-market').isVisible(), false);
    assert.equal(
      await p
        .locator('.chip-field')
        .filter({ hasText: 'Marché' })
        .getByRole('button', { name: 'Match nul', exact: true })
        .getAttribute('aria-pressed'),
      'true'
    );
    await p.locator('#reset-prediction-filters').click();
    assert.equal(
      await p
        .locator('.chip-field')
        .filter({ hasText: 'Marché' })
        .getByRole('button', { name: 'Tous', exact: true })
        .getAttribute('aria-pressed'),
      'true'
    );
    assert.deepEqual(p.__errors, []);
    await p.close();
    console.log('OK filtres en puces et réinitialisation');
    const empty = await page(b, { data: { ...fixtures, matches: [] } });
    await empty.locator('[data-empty-challenges]').waitFor();
    await empty.locator('[data-empty-challenges]').click();
    assert.equal(await empty.locator('#community').isVisible(), true);
    assert.equal(
      await empty.locator('[data-ctab=challenges]').getAttribute('aria-selected'),
      'true'
    );
    assert.deepEqual(empty.__errors, []);
    await empty.close();
    console.log('OK état vide et accès aux défis');
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
