const assert = require('node:assert/strict'),
  { browser, page, fixtures } = require('./ui-mobile-fixtures.cjs');
(async () => {
  const b = await browser();
  try {
    for (const width of [320, 360, 390, 430, 767, 1280])
      for (const dark of [false, true]) {
        const p = await page(b, {
          width,
          dark,
          data: {
            ...fixtures,
            matches: fixtures.matches.map((m) => ({
              ...m,
              homeStats: { form: 'VNDVV' },
              awayStats: { form: 'DNVDV' }
            }))
          }
        });
        await p.locator('.match-card').first().waitFor();
        const bad = await p
          .locator('.match-hero')
          .first()
          .evaluate((hero) => {
            const rect = (e) => e.getBoundingClientRect(),
              overlap = (a, b) =>
                a.left < b.right - 1 &&
                a.right > b.left + 1 &&
                a.top < b.bottom - 1 &&
                a.bottom > b.top + 1,
              groups = [...hero.querySelectorAll('.team-group,.match-center')].map(rect),
              head = rect(hero.querySelector('.match-head'));
            return {
              collisions: groups.some((r, i) => groups.slice(i + 1).some((s) => overlap(r, s))),
              header: groups.some((r) => overlap(r, head)),
              overflow: hero.scrollWidth > hero.clientWidth + 1,
              ellipsis: [...hero.querySelectorAll('.team strong')].map(
                (e) => getComputedStyle(e).textOverflow
              )
            };
          });
        assert.equal(bad.collisions, false, JSON.stringify({ width, dark, bad }));
        assert.equal(bad.header, false);
        assert.equal(bad.overflow, false);
        if (width < 768) assert.deepEqual(bad.ellipsis, ['ellipsis', 'ellipsis']);
        assert.equal(
          await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false
        );
        assert.deepEqual(p.__errors, []);
        if (width === 320 && !dark)
          await p.locator('.match-hero').first().screenshot({ path: 'work/bet-219-320.png' });
        console.log('OK layout', width, dark);
        await p.close();
      }
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
