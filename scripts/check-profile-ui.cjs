const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.BET_BASE_URL || 'http://127.0.0.1:4173';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
require('node:fs').mkdirSync('work', { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.BET_CHROMIUM || '/usr/bin/chromium',
    args: ['--no-sandbox']
  });
  for (const width of [390, 1366]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: 'reduce'
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/profile-ui-fixture.html', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html lang="fr"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/styles/details.css"><link rel="stylesheet" href="/styles/components.css"></head><body></body></html>'
      })
    );
    await page.route('**/*', (r) =>
      new URL(r.request().url()).origin === new URL(base).origin ? r.fallback() : r.abort()
    );
    await page.goto(base + '/profile-ui-fixture.html');
    await page.evaluate(async () => {
      document.body.innerHTML =
        '<main style="max-width:1240px;margin:auto;padding:12px"><div id="profile-page"></div></main>';
      const { initProfilePage } = await import('/profile.js'),
        model = await import('/model.js');
      window.calls = [];
      window.failSettings = false;
      const profile = {
          user_id: 'test',
          nickname: 'Patfoort47',
          is_public: true,
          show_bets: false,
          joined_at: '2026-10-21'
        },
        raw = {
          settled: 100,
          wins: 45,
          staked: 1000,
          returned: 1100,
          avgOdds: 2.65,
          tickets30: 10,
          activeDays30: 10,
          avgStakeRatio: 0.11
        };
      const data = {
        profile,
        self: true,
        xp: 0,
        echelon: 0,
        equipped: {},
        raw,
        groupRaws: [raw],
        badges: [],
        seasons: []
      };
      const state = { profile, history: [] };
      const api = {
        loadPlayer: async () => data,
        community: {
          connections: async (id, kind, offset) =>
            kind
              ? {
                  rows: kind === 'followers' ? [{ nickname: 'Ami public', user_id: 'ami' }] : [],
                  more: false
                }
              : { followers: 1, following: 0 }
        },
        newsletter: { load: async () => ({ subscribed: false }), set: async () => {} },
        updateSettings: async (patch) => {
          calls.push(patch);
          if (failSettings) throw Error('Échec simulé');
        },
        changeNickname: async (n) => n,
        updateEmail: async (email) => calls.push({ email }),
        auth: { updatePassword: async (password) => calls.push({ password }) }
      };
      window.profilePage = initProfilePage({
        html: (s) =>
          String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'),
        money: String,
        divisionBadge: () => '',
        levelInfo: () => ({ level: 1, title: 'Débutant' }),
        safeLogo: () => null,
        BADGES: [],
        echelonName: () => 'District',
        chevrons: () => '',
        divisionIndex: () => 0,
        model,
        accountApi: api,
        getState: () => state,
        toast: () => {},
        navigate: () => {},
        onLoggedOut: () => {}
      });
      await profilePage.show({ self: true, tab: 'seasons' });
    });
    await page.locator('.radar').waitFor();
    assert.equal(await page.locator('[data-radar-series]').count(), 1);
    assert.equal(await page.locator('[data-tab="seasons"]').count(), 0);
    assert.equal(
      (await page.locator('[data-connections="followers"]').innerText()).replace(/\s+/g, ' '),
      '1 Abonné'
    );
    await page.locator('[data-connections="followers"]').click();
    await page.locator('.connections-panel a').waitFor();
    assert.equal(
      await page.locator('.connections-panel a').getAttribute('href'),
      '#joueur-Ami%20public'
    );
    await page.locator('[data-close-connections]').click();
    await page.locator('[data-connections="following"]').click();
    await page.getByText('Aucun abonnement pour le moment.').waitFor();
    await page.locator('[data-close-connections]').click();
    await page.locator('#ptab-account').click();
    await page.locator('.account-intro').waitFor();
    assert.equal(await page.locator('.account-group').count(), 4);
    await page.locator('[data-setting="show_bets"]').check();
    await page.getByText('Préférence enregistrée', { exact: true }).waitFor();
    await page.evaluate(() => (failSettings = true));
    await page.locator('[data-setting="show_bets"]').click();
    await page.getByText('Échec simulé', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-setting="show_bets"]').isChecked(), true);
    await page.locator('[name="email"]').fill('test@example.org');
    await page.locator('[data-form="email"] button').click();
    await page
      .getByText('Lien de confirmation envoyé à la nouvelle adresse', { exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      'overflow ' + width
    );
    await page.screenshot({ path: `work/account-${width}.png`, fullPage: true });
    await page.locator('[data-tab="overview"]').click();
    await page.screenshot({ path: `work/overview-${width}.png`, fullPage: true });
    assert.deepEqual(errors, []);
    console.log(
      'OK profil ' +
        width +
        'px : radar, repli, listes, réglages, erreurs, formulaires, débordements'
    );
    await page.close();
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
