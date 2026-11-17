const assert = require('node:assert/strict');
const { browser, page, fixtures } = require('./ui-mobile-fixtures.cjs');
const club = 'https://a.espncdn.com/i/teamlogos/soccer/500/160.png?h=96&w=96';
const missing = 'https://a.espncdn.com/i/teamlogos/soccer/500/missing.png';
const flag = 'https://a.espncdn.com/i/teamlogos/countries/500/fra.png';
(async () => {
  const b = await browser();
  try {
    for (const width of [320, 375, 390, 430, 767, 768, 1024, 1440])
      for (const dark of [false, true]) {
        const data = {
          ...fixtures,
          matches: fixtures.matches.map((m, i) => ({
            ...m,
            analysisStatus: 'ready',
            homeLogo: i ? flag : club,
            awayLogo: missing,
            ...(i ? { awayFlag: flag } : {}),
            venue: { id: '26' }
          }))
        };
        const p = await page(b, { width, dark, data });
        await p.route('https://a.espncdn.com/**', (r) =>
          r.request().url().includes('missing.png')
            ? r.fulfill({ status: 404, body: '' })
            : r.fulfill({
                contentType: 'image/svg+xml',
                body: '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><path fill="#111" d="M3 3h30v25L18 35 3 28z"/></svg>'
              })
        );
        await p.reload();
        await p.locator('#match-espn-1 .team.away .no-logo').waitFor();
        await p.locator('#match-espn-2 .match-hero').scrollIntoViewIfNeeded();
        await p.waitForFunction(() =>
          document
            .querySelector('#match-espn-2 .team.away img')
            ?.src.includes('countries/500/fra.png')
        );
        for (const selector of [
          '#match-espn-1 .team.home img',
          '#match-espn-2 .team.home img',
          '#match-espn-2 .team.away img'
        ]) {
          await p.locator(selector).scrollIntoViewIfNeeded();
          await p.locator(selector).evaluate((e) => e.decode());
          const result = await p.locator(selector).evaluate((e) => ({
            w: e.getBoundingClientRect().width,
            h: e.getBoundingClientRect().height,
            fit: getComputedStyle(e).objectFit,
            lazy: e.loading,
            loaded: e.complete && e.naturalWidth > 0
          }));
          assert.equal(result.w, 36, JSON.stringify({ width, result }));
          assert.equal(result.h, 36);
          assert.equal(result.fit, 'contain');
          assert.equal(result.lazy, 'lazy');
          assert.ok(result.loaded);
        }
        assert.ok(await p.locator('#match-espn-1 .team.away .crest').getAttribute('data-initials'));
        assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        for (const hero of await p.locator('.match-hero').all())
          assert.equal(Math.round((await hero.boundingBox()).height), 125);
        assert.deepEqual(p.__errors, []);
        if (width === 390 && !dark)
          await p
            .locator('#match-espn-1 .match-hero')
            .screenshot({ path: 'work/BET-359-mobile.png' });
        await p.close();
        console.log('OK logos', width, dark);
      }
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
