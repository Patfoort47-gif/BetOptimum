const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  { browser, page, match, fixtures } = require('./ui-mobile-fixtures.cjs');
(async () => {
  const b = await browser();
  try {
    for (const width of [320, 375, 390, 430, 700, 767, 768, 1023, 1024, 1440])
      for (const dark of [false, true]) {
        const p = await page(b, { width, dark, logged: true });
        await p.locator('#match-espn-1').waitFor();
        assert.equal(await p.locator('#match-list>.match-card').count(), 2);
        assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const card = p.locator('#match-espn-1');
        assert.match(await card.locator('.selection-ev').textContent(), /EV estimée : [+-]?\d+ %/);
        assert.equal(await card.locator('.selection-action').textContent(), 'Ajouter au ticket');
        assert.equal(
          await card.locator('.team.home').getAttribute('aria-label'),
          'Fiche de ' + match.home
        );
        if (width < 1024) {
          const overview = await card
            .locator('.match-overview')
            .evaluate((el) => getComputedStyle(el).gridTemplateColumns);
          assert.equal(overview.split(' ').length, 1);
        }
        assert.ok(await card.locator('.match-selection').isVisible(), 'conseil visible');
        assert.ok(await card.locator('.selection-price').isVisible(), 'cote conseillée visible');
        const markets = card.locator('.featured-markets > .market');
        assert.ok((await markets.count()) > 3, 'plusieurs familles de marchés');
        assert.equal(
          await card.locator('.featured-markets > .market:visible').count(),
          await markets.count()
        );
        for (const market of await markets.all()) {
          assert.ok(await market.locator('.market-price strong').isVisible());
          assert.ok(await market.locator('.market-meta').isVisible(), 'source de la cote visible');
        }
        assert.ok(await card.locator('.match-disclaimer').isVisible());
        const selection = card.locator('.match-selection'),
          key = await selection.getAttribute('data-market');
        await selection.dblclick();
        assert.equal(await p.locator('#ticket-items [data-remove]').count(), 1);
        await p.locator('[data-open-ticket]').first().click();
        await p.locator('#place-bet').dblclick();
        await p.waitForFunction(() => window.__betCalls.length === 1);
        const jobs = await p.evaluate(() => __betCalls);
        assert.equal(jobs[0].selections.length, 1);
        assert.deepEqual(jobs[0].selections[0], { matchId: match.id, key, odd: match.odds[key] });
        assert.deepEqual(p.__errors, []);
        if (width === 390) {
          await p.keyboard.press('Escape');
          await p.locator('[data-mobile-target=matches]').click();
          fs.mkdirSync('work', { recursive: true });
          await card.screenshot({ path: `work/BET-182-${dark ? 'dark' : 'light'}.png` });
        }
        console.log('OK carte, sélection et confirmation unique', width, dark ? 'dark' : 'light');
        await p.close();
      }
    let release;
    const gate = new Promise((r) => (release = r)),
      loading = await page(b, { delay: gate });
    await loading.locator('.match-skeleton').first().waitFor();
    release();
    await loading.locator('.match-card').first().waitFor();
    await loading.close();
    const empty = await page(b, { data: { ...fixtures, matches: [] } });
    await empty.locator('[data-empty-challenges]').waitFor();
    assert.equal(await empty.locator('.match-card').count(), 0);
    await empty.locator('[data-empty-challenges]').click();
    await empty.close();
    const error = await page(b, { network: true });
    await error.locator('[data-retry-matches]').waitFor();
    let retried = 0;
    error.on('request', (r) => {
      if (r.url().includes('/data/fixtures.json')) retried++;
    });
    await error.locator('[data-retry-matches]').click();
    await error.waitForTimeout(100);
    assert.equal(retried, 1);
    await error.close();
    const missing = await page(b, {
      data: {
        ...fixtures,
        matches: [{ ...match, bookmakerOffers: match.bookmakerOffers.slice(0, 9) }]
      }
    });
    await missing.locator('.match-card').waitFor();
    assert.equal(await missing.locator('.match-card [data-market]').count(), 0);
    assert.ok(await missing.locator('.match-overview').isVisible(), 'indisponibilité visible');
    assert.match(
      await missing.locator('.match-overview').textContent(),
      /Aucune sélection admissible/
    );
    await missing.close();
    console.log('OK chargement, vide, erreur/réessayer et cote indisponible');
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
