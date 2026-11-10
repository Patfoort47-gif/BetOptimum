const assert = require('node:assert/strict'),
  { chromium } = require('playwright'),
  { fixtures } = require('./ui-mobile-fixtures.cjs');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    for (const width of [390, 1440]) {
      const p = await b.newPage({ viewport: { width, height: 1000 } }),
        errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.addInitScript(() => {
        window.__csp = [];
        document.addEventListener('securitypolicyviolation', (e) =>
          window.__csp.push(e.effectiveDirective)
        );
      });
      await p.route('**/*', (r) => {
        const u = new URL(r.request().url());
        if (u.hostname !== '127.0.0.1') return r.abort();
        if (u.pathname.endsWith('/account.js'))
          return r.fulfill({
            contentType: 'text/javascript',
            body: 'export async function initAccountSync(){return {configured:false}}'
          });
        if (u.pathname.endsWith('/data/fixtures.json')) return r.fulfill({ json: fixtures });
        if (u.pathname.endsWith('/data/predictions-history.json')) return r.fulfill({ json: [] });
        return r.continue();
      });
      await p.goto('http://127.0.0.1:4173/');
      await p.evaluate(async () => {
        const { initJoin } = await import('./join.js');
        window.__authCalls = [];
        window.__join = initJoin({
          auth: {
            nicknameAvailable: async () => {
              window.__authCalls.push('nickname');
              throw Error('Interdit avant inscription');
            },
            signUp: async (data) => {
              window.__authCalls.push({ signup: data.username });
              return { confirmed: false };
            },
            signIn: async () => {
              window.__authCalls.push('signin');
              return {};
            },
            google: async () => window.__authCalls.push('google'),
            reset: async () => window.__authCalls.push('reset')
          },
          getTeams: () => [],
          getLeagues: () => ['Premier League'],
          toast: () => {},
          onDone: () => {}
        });
        window.__join.open('signup');
      });
      const root = p.locator('#rejoindre');
      assert.match(await root.textContent(), /pseudo disponible vous sera attribué/);
      await root.locator('#join-nickname').fill('VictorTest');
      await root.locator('#join-email').fill('demo@example.test');
      await root.locator('#join-password').fill('Securite!47Lot15');
      await root.locator('[name=adult]').check();
      await root.getByRole('button', { name: 'Continuer', exact: true }).click();
      await root.getByRole('button', { name: 'Créer mon compte', exact: true }).click();
      await root.getByRole('heading', { name: 'Vérifiez vos emails' }).waitFor();
      assert.deepEqual(await p.evaluate(() => window.__authCalls), [{ signup: 'VictorTest' }]);
      await p.evaluate(() => window.__join.open('forgot'));
      await root.locator('#join-email').fill('demo@example.test');
      await root.getByRole('button', { name: 'Envoyer le lien', exact: true }).click();
      assert.ok((await p.evaluate(() => window.__authCalls)).includes('reset'));
      await p.evaluate(() => window.__join.open('login'));
      await root.locator('[data-google]').click();
      assert.ok((await p.evaluate(() => window.__authCalls)).includes('google'));
      await p.evaluate(() => window.__join.open('login'));
      await root.locator('#join-email').fill('demo@example.test');
      await root.locator('#join-password').fill('Securite!47Lot15');
      await root.locator('button[type=submit]').click();
      assert.ok((await p.evaluate(() => window.__authCalls)).includes('signin'));
      assert.deepEqual(await p.evaluate(() => window.__csp), []);
      assert.deepEqual(errors, []);
      console.log(
        'OK inscription',
        width,
        'identité/préférences/confirmation sans recherche de pseudo, connexion, Google et récupération simulés, CSP intacte'
      );
      await p.close();
    }
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
