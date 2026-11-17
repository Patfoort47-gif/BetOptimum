const assert = require('node:assert/strict');
const { browser, page, fixtures } = require('./ui-mobile-fixtures.cjs');
(async () => {
  const b = await browser();
  try {
    for (const width of [320, 375, 390, 430, 767, 768, 1024, 1440]) {
      for (const dark of [false, true]) {
        const matches = fixtures.matches.map((m, i) => ({
          ...m,
          analysisStatus: 'ready',
          venue: i ? { id: 'unknown' } : { id: '26' }
        }));
        const p = await page(b, { width, dark, data: { ...fixtures, matches } });
        await p.locator('#match-espn-1.stadium-ready, #match-espn-1 .stadium-ready').waitFor();
        for (const card of ['#match-espn-1', '#match-espn-2']) {
          const hero = p.locator(`${card} .match-hero`);
          assert.equal(Math.round((await hero.boundingBox()).height), width < 768 ? 115 : 130);
          const result = await hero.evaluate((e) => {
            const box = e.getBoundingClientRect();
            const text = [...e.querySelectorAll('.team strong, .kickoff, .match-head')];
            return {
              white: [...e.querySelectorAll('.team strong')].every(
                (n) => getComputedStyle(n).color === 'rgb(255, 255, 255)'
              ),
              overflow: e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1,
              contained: text.every((n) => {
                const r = n.getBoundingClientRect();
                return (
                  r.left >= box.left - 1 &&
                  r.right <= box.right + 1 &&
                  r.top >= box.top - 1 &&
                  r.bottom <= box.bottom + 1
                );
              }),
              overlay: getComputedStyle(e, '::before').backgroundImage,
              lazy: [...e.querySelectorAll('img')]
                .filter((n) => /stadiums\//.test(n.src))
                .every((n) => n.loading === 'lazy')
            };
          });
          assert.ok(
            result.white && result.contained && result.lazy,
            JSON.stringify({ width, dark, result })
          );
          assert.equal(result.overflow, false, JSON.stringify({ width, dark, result }));
          assert.match(result.overlay, /rgba\(17, 28, 22, 0\.45\)/);
          assert.ok(
            await hero.locator('.stadium-name:visible, .stadium-placeholder-name:visible').count()
          );
        }
        assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const first = p.locator('#match-espn-1 .match-stadium-photo');
        await first.evaluate((e) => e.dispatchEvent(new Event('error')));
        assert.ok(await p.locator('#match-espn-1 .stadium-placeholder img').isVisible());
        assert.ok(await p.locator('#match-espn-1 .stadium-placeholder-name').isVisible());
        assert.deepEqual(p.__errors, []);
        if (width === 390 && !dark)
          await p
            .locator('#match-espn-2 .match-hero')
            .screenshot({ path: 'work/BET-358-mobile.png' });
        console.log('OK bandeau', width, dark);
        await p.close();
      }
    }
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
