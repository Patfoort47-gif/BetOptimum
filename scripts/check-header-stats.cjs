const assert = require('node:assert/strict');
const { browser, page, fixtures } = require('./ui-mobile-fixtures.cjs');
(async () => {
  const b = await browser();
  try {
    for (const width of [320, 390, 1024])
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
          const event = new URL(route.request().url()).searchParams.get('event');
          requests.push(event);
          const team = (id, shots) => ({
            team: { id },
            statistics: [{ name: 'totalShots', value: shots }]
          });
          return route.fulfill({
            json: event === '2' ? { boxscore: { teams: [team('102', 4), team('101', 9)] } } : {}
          });
        });
        const first = p.locator('#match-espn-1'),
          second = p.locator('#match-espn-2');
        const shortcut = first.locator('[data-match-stats]'),
          panel = first.locator('.match-explanation');
        await shortcut.waitFor();
        assert.equal(await shortcut.getAttribute('aria-controls'), 'detail-dialog');
        assert.equal(await shortcut.getAttribute('aria-haspopup'), 'dialog');
        await shortcut.focus();
        await p.keyboard.press('Enter');
        const dialog = p.locator('#detail-dialog');
        await dialog.waitFor();
        const initialTab = width < 768 ? 'Forme et H2H' : 'Stats du match';
        await dialog.getByRole('tab', { name: initialTab, exact: true, selected: true }).waitFor();
        if (width < 768)
          await dialog.getByRole('tab', { name: 'Stats du match', exact: true }).click();
        await dialog.getByText(/statistiques de jeu sont publiées/i).waitFor();
        assert.ok(requests.includes('1'));
        await dialog.getByRole('tab', { name: 'Forme et H2H' }).click();
        await dialog.getByRole('heading', { name: 'Face-à-face (H2H)' }).waitFor();
        await dialog.getByRole('tab', { name: 'Compo' }).click();
        await dialog.getByText('Compo indisponible', { exact: true }).first().waitFor();
        await p.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        assert.equal(await panel.getAttribute('open'), null);
        await panel.locator('summary').first().click();
        assert.match(await panel.textContent(), /Le match en chiffres/);
        await second.locator('[data-match-stats]').click();
        if (width < 768)
          await dialog.getByRole('tab', { name: 'Stats du match', exact: true }).click();
        const shots = dialog.locator('.live-stat-values').filter({ hasText: 'Tirs' });
        assert.equal(await shots.textContent(), '9Tirs4');
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
