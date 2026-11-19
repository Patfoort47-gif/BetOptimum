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
              homeId: '101',
              awayId: '102',
              analysisStatus: 'ready',
              venue: { id: '26' }
            }))
          }
        });
        const requests = [];
        await p.route('https://site.api.espn.com/**/summary?event=*', (route) => {
          requests.push(new URL(route.request().url()).searchParams.get('event'));
          return route.fulfill({ json: {} });
        });
        const first = p.locator('#match-espn-1'),
          second = p.locator('#match-espn-2');
        const shortcut = first.locator('[data-match-stats]'),
          panel = first.locator('.match-explanation');
        await shortcut.waitFor();
        assert.equal(await shortcut.getAttribute('aria-controls'), 'detail-dialog');
        assert.equal(await shortcut.getAttribute('aria-haspopup'), 'dialog');
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
        const dialog = p.locator('#detail-dialog');
        await dialog.waitFor();
        await dialog.getByText(/statistiques de jeu sont publiées/i).waitFor();
        assert.ok(requests.includes('1'));
        await dialog.getByRole('tab', { name: 'Forme et H2H' }).click();
        await dialog.getByRole('heading', { name: 'Face-à-face (H2H)' }).waitFor();
        await dialog.getByRole('tab', { name: 'Compo' }).click();
        await dialog.getByText('Compo indisponible', { exact: true }).first().waitFor();
        await p.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        assert.equal(await panel.getAttribute('open'), null);
        await panel.locator('summary').click();
        assert.match(await panel.textContent(), /Le match en chiffres/);
        await second.locator('[data-match-stats]').click();
        await dialog.getByText(/statistiques de jeu sont publiées/i).waitFor();
        assert.ok(requests.includes('2'));
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
