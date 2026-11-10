// Recette locale : aucune requête ni écriture en production.
const assert = require('node:assert/strict'),
  { chromium } = require('playwright'),
  fs = require('node:fs');
const { fixtures, mock } = (() => {
  const ui = require('./ui-mobile-fixtures.cjs');
  return {
    fixtures: ui.fixtures,
    mock: fs
      .readFileSync('scripts/check-public-ui.cjs', 'utf8')
      .match(/const mock\s*=\s*`([\s\S]*?)`;/)[1]
  };
})();
(async () => {
  const b = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader']
  });
  try {
    for (const width of [390, 1440]) {
      const p = await b.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' }),
        errors = [],
        requests = [];
      p.on('pageerror', (e) => errors.push(e.message));
      p.on('request', (r) => requests.push(r.url()));
      await p.addInitScript(() => {
        window.__csp = [];
        window.__logged = true;
        document.addEventListener('securitypolicyviolation', (e) =>
          window.__csp.push({ directive: e.effectiveDirective, blocked: e.blockedURI })
        );
      });
      await p.route('**/*', (r) => {
        const u = new URL(r.request().url());
        if (u.hostname !== '127.0.0.1') return r.abort();
        if (u.pathname.endsWith('/src/account/account.js'))
          return r.fulfill({ contentType: 'text/javascript', body: mock });
        if (u.pathname.endsWith('/data/fixtures.json')) return r.fulfill({ json: fixtures });
        if (u.pathname.endsWith('/data/predictions-history.json')) return r.fulfill({ json: [] });
        return r.continue();
      });
      await p.goto('http://127.0.0.1:4173/');
      await p.locator('.match-card').first().waitFor();
      for (const hash of [
        '#bilan-pronos',
        '#bankroll',
        '#communaute',
        '#classements',
        '#profil',
        '#boutique'
      ]) {
        await p.evaluate((hash) => (location.hash = hash), hash);
        await p.waitForTimeout(100);
      }
      await p.evaluate(async () => {
        const root = document.createElement('section');
        root.id = 'security-studio';
        document.body.append(root);
        const { mountStudio } = await import('./avatar-studio.js');
        const html = (v) =>
          String(v ?? '').replace(
            /[&<>"']/g,
            (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
          );
        window.__studio = await mountStudio(root, {
          html,
          toast: () => {},
          authenticated: false,
          freeOnly: true,
          hideActions: true
        });
      });
      await p.locator('#security-studio canvas').first().waitFor();
      assert.ok(requests.some((url) => url.includes('/vendor/three-0.170.0.js')));
      assert.ok(!requests.some((url) => url.includes('cdn.jsdelivr.net')));
      assert.deepEqual(await p.evaluate(() => window.__csp), []);
      assert.deepEqual(errors, []);
      const box = await p.locator('#security-studio canvas').first().boundingBox();
      assert.ok(box.width > 100 && box.height > 100);
      await p.evaluate(() => {
        window.__studio.destroy();
        document.getElementById('security-studio').remove();
      });
      await p.evaluate(() => {
        window.__blocked = false;
        const script = document.createElement('script');
        script.textContent = 'window.__blocked=true';
        document.body.append(script);
        const image = document.createElement('img');
        image.setAttribute('onerror', 'window.__blocked=true');
        image.src = '/missing-csp-probe.png';
        document.body.append(image);
      });
      await p.waitForTimeout(200);
      assert.equal(await p.evaluate(() => window.__blocked), false);
      assert.ok(
        (await p.evaluate(() => window.__csp)).some((e) => e.directive === 'script-src-elem')
      );
      console.log(
        'OK CSP',
        width,
        'navigation, thème, Three local, studio 3D, scripts inline bloqués'
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
