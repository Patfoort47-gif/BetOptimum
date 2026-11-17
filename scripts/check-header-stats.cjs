const assert = require('node:assert/strict');
const { browser, page, fixtures } = require('./ui-mobile-fixtures.cjs');
(async () => {
  const b = await browser();
  try {
    for (const width of [320, 375, 390, 430, 767, 768, 1024, 1440])
      for (const dark of [false, true]) {
        const p = await page(b, {
          width,
          dark,
          data: {
            ...fixtures,
            matches: fixtures.matches.map((m) => ({
              ...m,
              analysisStatus: 'ready',
              venue: { id: '26' }
            }))
          }
        });
        const first = p.locator('#match-espn-1'),
          second = p.locator('#match-espn-2');
        const shortcut = first.locator('[data-match-stats]'),
          panel = first.locator('.match-explanation');
        await shortcut.waitFor();
        assert.equal(await shortcut.getAttribute('aria-controls'), await panel.getAttribute('id'));
        assert.equal(await shortcut.getAttribute('aria-expanded'), 'false');
        assert.equal(Math.round((await first.locator('.match-hero').boundingBox()).height), 125);
        const layout = await first.locator('.match-hero').evaluate((e) => {
          const box = e.getBoundingClientRect();
          const nodes = [...e.querySelectorAll('.match-head > *, .team, .kickoff')];
          const rects = nodes.map((n) => n.getBoundingClientRect());
          const head = [...e.querySelectorAll('.match-head > *, .team')].map((n) =>
            n.getBoundingClientRect()
          );
          return {
            overflow: e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1,
            contained: rects.every(
              (r) =>
                r.left >= box.left - 1 &&
                r.right <= box.right + 1 &&
                r.top >= box.top - 1 &&
                r.bottom <= box.bottom + 1
            ),
            collision: head.some((r, i) =>
              head
                .slice(i + 1)
                .some(
                  (s) =>
                    r.width &&
                    s.width &&
                    r.left < s.right - 1 &&
                    r.right > s.left + 1 &&
                    r.top < s.bottom - 1 &&
                    r.bottom > s.top + 1
                )
            ),
            circle: getComputedStyle(e.querySelector('.crest')).backgroundColor
          };
        });
        assert.equal(layout.overflow, false, JSON.stringify({ width, dark, layout }));
        assert.ok(layout.contained);
        assert.equal(layout.collision, false);
        assert.equal(layout.circle, 'rgba(255, 255, 255, 0.15)');
        if (width === 390 && !dark)
          await first.locator('.match-hero').screenshot({ path: 'work/BET-360-mobile.png' });
        await shortcut.focus();
        await p.keyboard.press('Enter');
        assert.equal(await panel.getAttribute('open'), '');
        assert.equal(await shortcut.getAttribute('aria-expanded'), 'true');
        assert.equal(await second.locator('.match-explanation').getAttribute('open'), null);
        assert.match(await panel.textContent(), /Le match en chiffres/);
        assert.match(await panel.textContent(), /xG observés indisponibles/);
        assert.match(await panel.textContent(), /Cote réelle et cote juste/);
        assert.equal(
          await panel
            .locator('summary')
            .first()
            .evaluate((e) => e === document.activeElement),
          true
        );
        if (width < 768) {
          await first.locator('.result-pick[data-market=home]').click();
          assert.equal(await panel.getAttribute('open'), '');
        }
        await panel.locator('summary').first().click();
        await p.waitForFunction(
          () =>
            document
              .querySelector('#match-espn-1 [data-match-stats]')
              .getAttribute('aria-expanded') === 'false'
        );
        await second.locator('[data-match-stats]').click();
        assert.equal(await second.locator('.match-explanation').getAttribute('open'), '');
        assert.equal(await p.locator('#detail-sheet:visible').count(), 0);
        assert.deepEqual(p.__errors, []);
        await p.close();
        console.log('OK Stats', width, dark);
      }
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
