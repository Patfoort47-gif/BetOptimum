const assert = require('node:assert/strict');
const { browser, page, fixtures } = require('./ui-mobile-fixtures.cjs');

(async () => {
  const b = await browser();
  try {
    for (const width of [320, 390, 768])
      for (const dark of [false, true]) {
        const p = await page(b, {
          width,
          dark,
          touch: width < 768,
          data: {
            ...fixtures,
            matches: fixtures.matches.map((match) => ({ ...match, analysisStatus: 'ready' }))
          }
        });
        const card = p.locator('#match-list .match-card').first();
        const pick = card.locator('.selection-summary');
        await pick.waitFor();
        assert.match(await pick.innerText(), /Probabilité estimée/);
        assert.match(await pick.innerText(), /Cote réelle/);
        const add = pick.getByRole('button', { name: /^Ajouter au ticket/ });
        assert.ok((await add.boundingBox()).height >= 44);
        assert.ok((await add.innerText()).length < 24);
        const details = card.locator('details.match-explanation');
        assert.equal(await details.getAttribute('open'), null);
        await card.getByRole('button', { name: /Voir les statistiques/ }).click();
        assert.match(await details.innerText(), /cote juste/i);
        assert.match(await details.innerText(), /Flux de cotes PropLine/);
        await add.click();
        assert.equal(await p.locator('#ticket-items [data-remove]').count(), 1);
        await details.getByRole('button', { name: 'Résultats du modèle' }).click();
        assert.ok(await p.locator('#predictions').isVisible());
        assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.deepEqual(p.__errors, []);
        await p.close();
        console.log('OK lecture des cartes', width, dark);
      }
    const [base, second] = fixtures.matches;
    const states = await page(b, {
      width: 390,
      data: {
        ...fixtures,
        matches: [
          { ...base, completed: true, homeScore: 2, awayScore: 1, analysisStatus: 'ready' },
          {
            ...second,
            analysisStatus: 'ready',
            bookmakerOffers: second.bookmakerOffers.slice(0, 9)
          }
        ]
      }
    });
    await states.locator('#match-list .match-card.completed').waitFor();
    assert.match(await states.locator('#match-list').innerText(), /Score officiel/);
    assert.equal(await states.locator('#match-list .match-card').count(), 1);
    assert.equal(await states.locator('#match-list [data-market]').count(), 0);
    await states.close();
  } finally {
    await b.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
