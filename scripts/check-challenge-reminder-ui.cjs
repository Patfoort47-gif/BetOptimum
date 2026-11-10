// Recette locale avec faux compte et faux transport, aucun envoi de notification.
const { chromium, devices } = require('playwright'),
  assert = require('node:assert/strict'),
  fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox']
  });
  try {
    for (const scenario of ['android', 'ios-browser', 'ios-installed']) {
      const page = await browser.newPage({
          ...devices[scenario === 'android' ? 'Pixel 7' : 'iPhone 13'],
          viewport: { width: 390, height: 844 }
        }),
        errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.route('**/*', (r) => {
        const u = new URL(r.request().url());
        if (u.hostname !== '127.0.0.1') return r.abort();
        if (u.pathname === '/')
          return r.fulfill({
            contentType: 'text/html',
            body: '<!doctype html><html lang="fr"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/styles/components.css"></head><body><main><section id="root"></section></main></body></html>'
          });
        return r.continue();
      });
      await page.goto('http://127.0.0.1:4173');
      await page.evaluate(async (scenario) => {
        Object.defineProperty(navigator, 'standalone', {
          configurable: true,
          value: scenario === 'ios-installed'
        });
        window.Notification = {
          requestPermission: async () => {
            window.permissionCalls++;
            return 'granted';
          }
        };
        window.PushManager = function () {};
        window.permissionCalls = 0;
        window.saved = [];
        window.disconnected = 0;
        window.prefs = {
          enabled: scenario !== 'ios-browser',
          essential: false,
          daily_challenge_reminder: false,
          timezone: 'Europe/Paris',
          quiet_start: 1320,
          quiet_end: 480
        };
        const { mountWebPush } = await import('/src/notifications/web-push-page.js');
        window.view = await mountWebPush(document.querySelector('#root'), {
          api: {
            web: async () => ({ preferences: prefs }),
            saveWeb: async (p) => {
              saved.push({ ...p });
              prefs = p;
            },
            disconnectWeb: async () => {
              disconnected++;
              prefs = { ...prefs, enabled: false, daily_challenge_reminder: false };
            },
            action: async () => {}
          },
          config: { available: { web: true }, vapid: '' },
          html: String,
          toast: () => {}
        });
      }, scenario);
      assert.equal(await page.evaluate(() => saved.length + permissionCalls), 0);
      assert.equal(await page.locator('[data-daily-challenge-reminder]').isChecked(), false);
      if (scenario === 'ios-browser') {
        assert.equal(await page.locator('[data-web-push]').isDisabled(), true);
        assert.equal(await page.locator('[data-daily-challenge-reminder]').isDisabled(), true);
        assert.match(await page.locator('#root').textContent(), /installez d’abord/i);
        assert.equal(await page.locator('[data-install-app]').isVisible(), true);
      } else {
        assert.equal(await page.locator('[data-daily-challenge-reminder]').isDisabled(), false);
        await page.locator('[data-daily-challenge-reminder]').check();
        await page.waitForFunction(() => saved.length === 1);
        assert.equal(await page.evaluate(() => saved[0].daily_challenge_reminder), true);
        await page.locator('[data-daily-challenge-reminder]').uncheck();
        await page.waitForFunction(() => saved.length === 2);
        assert.equal(await page.evaluate(() => saved[1].daily_challenge_reminder), false);
        assert.equal(await page.evaluate(() => permissionCalls), 0);
        await page.locator('[data-web-essential]').check();
        await page.waitForFunction(() => saved.length === 3);
        assert.equal(await page.locator('[data-daily-challenge-reminder]').isDisabled(), true);
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
      console.log('OK', scenario, 'accord distinct, désactivation, installation et mode Essentiel');
      await page.close();
    }
    const ui = require('./ui-mobile-fixtures.cjs'),
      data = {
        ...ui.fixtures,
        dailyChallenge: {
          date: ui.fixtures.matches[0].date,
          picks: ui.fixtures.matches.map((m) => ({
            matchId: m.id,
            league: m.league,
            home: m.home,
            away: m.away,
            kickoff: m.kickoff,
            odds: m.odds,
            bookmakerCounts: { home: 12, draw: 12, away: 12 }
          }))
        }
      };
    let resolve;
    const gate = new Promise((r) => (resolve = r)),
      linked = await ui.page(browser, { logged: true, data, delay: gate });
    await linked.evaluate(() => (location.hash = '#defi-du-jour'));
    resolve();
    await linked.locator('#daily-challenge .daily-row').first().waitFor();
    await linked.waitForTimeout(250);
    assert.equal(await linked.locator('#daily-challenge').isVisible(), true);
    assert.ok((await linked.locator('#daily-challenge').boundingBox()).y < 1000);
    assert.equal(await linked.evaluate(() => location.hash), '#defi-du-jour');
    assert.equal(await linked.evaluate(() => window.__betCalls.length), 0);
    assert.deepEqual(linked.__errors, []);
    await linked.close();
    console.log('OK lien du défi après chargement différé, aucun pronostic automatique');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
