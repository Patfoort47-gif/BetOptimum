const assert = require('node:assert/strict');
const { browser, page, fixtures } = require('./ui-mobile-fixtures.cjs');
(async () => {
  const b = await browser();
  try {
    for (const width of [390, 1440]) {
      const p = await page(b, {
        width,
        data: {
          ...fixtures,
          oddsHealth: { status: 'unavailable', todayAvailable: 0, todayMatches: 2 },
          matches: fixtures.matches.map((m) => ({ ...m, analysisStatus: 'unavailable' }))
        }
      });
      const first = p.locator('#match-espn-1');
      await first.waitFor();
      assert.equal(await first.locator('.result-pick strong').first().textContent(), '2,50');
      assert.equal(await first.locator('.result-pick').first().isDisabled(), true);
      assert.match(
        await first.locator('.result-pick small').first().textContent(),
        /Probabilité indisponible/
      );
      assert.ok(await first.locator('.match-result-picks').isVisible());
      assert.match(await p.locator('#data-source').textContent(), /Cotes réelles indisponibles/);
      assert.deepEqual(p.__errors, []);
      await p.close();
      console.log('OK cotes sans modèle', width);
    }
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
