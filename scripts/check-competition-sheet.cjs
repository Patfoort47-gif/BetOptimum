const assert = require('node:assert/strict');
const { browser, page, fixtures } = require('./ui-mobile-fixtures.cjs');

(async () => {
  const b = await browser();
  try {
    for (const width of [320, 390]) {
      const p = await page(b, {
        width,
        touch: true,
        data: {
          ...fixtures,
          matches: [fixtures.matches[0], { ...fixtures.matches[1], league: 'Ligue 1' }]
        }
      });
      await p.locator('#match-list .match-card').first().waitFor();
      const trigger = p.locator('[data-league-menu]');
      const dialog = p.locator('#league-dialog');
      const apply = dialog.locator('#apply-competitions');
      const premier = dialog.locator('[data-filter="Premier League"]');
      const ligue = dialog.locator('[data-filter="Ligue 1"]');
      await trigger.click();
      assert.match(await apply.innerText(), /2 matchs/);
      await premier.click();
      assert.equal(await premier.getAttribute('aria-pressed'), 'true');
      assert.match(await apply.innerText(), /Voir 1 match/);
      await ligue.click();
      assert.match(await apply.innerText(), /2 matchs/);
      await premier.click();
      await apply.click();
      await dialog.waitFor({ state: 'hidden' });
      await p.waitForFunction(() => document.activeElement?.matches('[data-league-menu]'));
      assert.equal(await p.locator('#match-list .match-card').count(), 1);
      assert.match(await p.locator('#match-filter-summary').innerText(), /Ligue 1/);
      await trigger.click();
      await premier.click();
      await dialog.getByRole('button', { name: 'Annuler' }).click();
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(await p.locator('#match-list .match-card').count(), 1);
      await trigger.click();
      await premier.focus();
      await p.keyboard.press('Enter');
      assert.equal(await premier.getAttribute('aria-pressed'), 'true');
      await p.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(await p.locator('#match-list .match-card').count(), 1);
      await p.locator('#filters [data-filter=Favoris]').click();
      await trigger.click();
      assert.match(await apply.innerText(), /0/);
      await apply.click();
      assert.match(await p.locator('#match-list').innerText(), /Aucun résultat/);
      assert.deepEqual(p.__errors, []);
      await p.close();
      console.log('OK sélection, favoris, confirmation, annulation et focus', width);
    }
  } finally {
    await b.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
