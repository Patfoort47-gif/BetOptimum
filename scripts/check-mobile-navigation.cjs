const assert = require('node:assert/strict');
const { browser, page, fixtures, mock } = require('./ui-mobile-fixtures.cjs');

(async () => {
  const b = await browser();
  try {
    for (const width of [320, 360, 390, 430, 767, 768, 1440]) {
      const p = await page(b, {
        accountMock: mock.replace(
          "c.onCommunityStatus('off');",
          "c.onCommunityStatus('off');c.registerCloudSave(state=>{window.__cloudState=state});"
        ),
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
        assert.equal(await nav.locator('#mobile-ticket-count').innerText(), '1');
        assert.equal(await p.locator('[data-open-ticket]:visible').count(), 1);
        if (width === 360) {
          const ticket = nav.locator('.mobile-ticket-action');
          await ticket.click();
          await p.locator('#close-builder').click();
          assert.equal(await ticket.evaluate((el) => el === document.activeElement), true);
          await ticket.click();
          await p.locator('#ticket-items [data-remove]').click();
          await p.locator('#close-builder').click();
          assert.equal(await nav.locator('#mobile-ticket-count').isVisible(), false);
          await p.locator('.match-card .match-selection').first().click();
          await ticket.click();
          await p.locator('#stake').fill('20,50');
          const potential = await p.locator('#potential-win').innerText();
          await p.locator('#place-bet').click();
          await nav.locator('[data-mobile-target=bankroll]').click();
          const guestReturn = p.locator('#bankroll-guest .ticket-figures dd').nth(2);
          assert.equal((await guestReturn.innerText()).split('\n')[0], potential);
          await p.reload();
          assert.equal((await guestReturn.innerText()).split('\n')[0], potential);
          await p.evaluate(() => {
            window.__logged = true;
          });
          await p.locator('#account-button').click();
          await p.locator('#account-menu [data-menu=login]').click();
          await p.locator('.join-close').click();
          await p.locator('[data-save-guest]').click();
          const saved = await p.evaluate(() => window.__cloudState.guestSimulation);
          assert.equal(saved.history[0].stake, 20.5);
          assert.equal(saved.history[0].certified, false);
          assert.equal(saved.bankroll, 979.5);
          await nav.locator('[data-mobile-target=matches]').click();
          await p.locator('.match-card .match-selection').first().click();
          await ticket.click();
          await p.locator('#place-bet').click();
          await p.waitForFunction(() => window.__betCalls?.length === 1);
        }
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
