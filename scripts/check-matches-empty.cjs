const assert = require('node:assert/strict');
const { browser, page, fixtures } = require('./ui-mobile-fixtures.cjs');
const date = (offset) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(Date.now() + offset * 86400000);
(async () => {
  const b = await browser();
  try {
    for (const width of [320, 360, 390, 430, 768, 1440])
      for (const dark of [false, true]) {
        const ready = fixtures.matches.map((m) => ({ ...m, analysisStatus: 'ready' }));
        const tomorrow = ready.map((m) => ({
          ...m,
          date: date(1),
          kickoff: new Date(Date.now() + 26 * 3600000).toISOString()
        }));
        const p = await page(b, {
          width,
          dark,
          query: `/?date=${date(0)}`,
          data: { ...fixtures, matches: tomorrow }
        });
        const next = p.locator('#next-match-day');
        await next.waitFor();
        assert.match(await next.innerText(), /Voir les matchs du/);
        const nextBox = await next.boundingBox();
        assert.ok(nextBox.y + nextBox.height < 600);
        assert.equal(await p.locator('#reset-match-filters').isVisible(), false);
        assert.equal(await p.locator('#daily-selection').isVisible(), false);
        await next.click();
        await p.locator('.match-card').first().waitFor();
        assert.ok(await p.locator(`[data-date="${date(1)}"].active`).count());
        await p.locator('[data-filter=Favoris]').click();
        assert.ok(await p.locator('#reset-match-filters').isVisible());
        assert.match(await p.locator('#match-list').innerText(), /Aucun match favori/);
        await p.locator('[data-leave-favorites]').click();
        assert.ok(await p.locator(`[data-date="${date(1)}"].active`).count());
        assert.equal(await p.locator('#reset-match-filters').isVisible(), false);
        await p.locator(`[data-date="${date(-1)}"]`).click();
        assert.match(await p.locator('#match-list').innerText(), /Aucun match sur cette période/);
        assert.equal(await p.locator('[data-empty-challenges]').count(), 0);
        await p.close();

        const q = await page(b, { width, dark, data: { ...fixtures, matches: ready } });
        await q.locator('.match-card').first().waitFor();
        assert.ok(await q.locator('#daily-selection').isVisible());
        assert.equal(await q.locator('#today-empty').isVisible(), false);
        assert.deepEqual(q.__errors, []);
        await q.close();
        console.log('OK accueil et filtres', width, dark);
      }
    const future = {
      ...fixtures.matches[0],
      id: 'espn-3',
      date: date(1),
      kickoff: new Date(Date.now() + 26 * 3600000).toISOString()
    };
    const noOdds = { ...fixtures.matches[0], realOddsMarkets: [], bookmakerOffers: [] };
    const initial = await page(b, { data: { ...fixtures, matches: [noOdds, future] } });
    await initial.locator('#match-espn-3').waitFor();
    assert.equal(await initial.locator('[data-date].active').getAttribute('data-date'), date(1));
    assert.match(await initial.locator('#calendar-hero-title').innerText(), /^Vos matchs du /);
    assert.equal(
      await initial.evaluate(() => localStorage.getItem('betoptimum-calendar-context')),
      null
    );
    await initial.locator(`[data-date="${date(0)}"]`).click();
    await initial.locator('#next-match-day').waitFor();
    await initial.reload();
    await initial.locator('#next-match-day').waitFor();
    assert.equal(await initial.locator('[data-date].active').getAttribute('data-date'), date(0));
    await initial.close();
    const noUpcoming = await page(b, { data: { ...fixtures, matches: [] } });
    await noUpcoming.locator('#today-empty').waitFor();
    assert.equal(await noUpcoming.locator('#next-match-day').isVisible(), false);
    const report = noUpcoming.locator('#today-empty-report');
    await report.waitFor();
    await report.click();
    await noUpcoming.locator('#predictions').waitFor();
    await noUpcoming.close();
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const loading = await page(b, {
      delay: gate,
      data: {
        ...fixtures,
        matches: fixtures.matches.map((m) => ({ ...m, analysisStatus: 'ready' }))
      }
    });
    await loading.locator('.match-skeleton').first().waitFor();
    assert.equal(await loading.locator('#match-list .guided-empty').count(), 0);
    assert.equal(await loading.locator('#daily-selection').isVisible(), false);
    release();
    await loading.locator('.match-card').first().waitFor();
    await loading.close();
    const failed = await page(b, { network: true });
    await failed.locator('#match-list [data-retry-matches]').waitFor();
    assert.equal(await failed.locator('#match-list .guided-empty').count(), 0);
    assert.equal(await failed.locator('#daily-selection').isVisible(), false);
    await failed.close();
    console.log('OK chargement et erreur distincts');
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
