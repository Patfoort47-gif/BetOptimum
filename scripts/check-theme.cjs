const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  { browser, fixtures, root } = require('./ui-mobile-fixtures.cjs');
const mock = fs
    .readFileSync(root + '/scripts/check-public-ui.cjs', 'utf8')
    .match(/const mock\s*=\s*`([\s\S]*?)`;/)[1],
  base = 'http://127.0.0.1:4173';
async function open(context, { stored, blocked = false } = {}) {
  const p = await context.newPage();
  p.setDefaultTimeout(10000);
  p.__errors = [];
  p.on('pageerror', (e) => p.__errors.push(e.message));
  await p.addInitScript(
    ({ stored, blocked }) => {
      if (stored !== undefined && !sessionStorage.getItem('theme-test-init')) {
        localStorage.setItem('betmaster-theme', stored);
        sessionStorage.setItem('theme-test-init', '1');
      }
      if (blocked)
        Object.defineProperty(window, 'localStorage', {
          get() {
            throw new DOMException('blocked', 'SecurityError');
          }
        });
    },
    { stored, blocked }
  );
  await p.route('**/*', (r) => {
    const u = new URL(r.request().url());
    if (u.origin !== base) return r.abort();
    if (u.pathname === '/__axe.js')
      return r.fulfill({
        contentType: 'text/javascript',
        body: fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')
      });
    if (u.pathname.endsWith('/src/account/account.js'))
      return r.fulfill({ contentType: 'text/javascript', body: mock });
    if (u.pathname.endsWith('/data/fixtures.json')) return r.fulfill({ json: fixtures });
    if (u.pathname.endsWith('/data/predictions-history.json')) return r.fulfill({ json: [] });
    return r.continue();
  });
  await p.goto(base);
  await p.locator('.match-card').first().waitFor();
  return p;
}
async function choose(p, value) {
  await p.locator('#account-button').click();
  await p.locator('[data-menu=theme]').click();
  const input = p.locator('[data-theme-choice][value="' + value + '"]');
  await input.focus();
  await p.keyboard.press('Space');
  await p.keyboard.press('Escape');
}
const dark = (p) => p.evaluate(() => !document.documentElement.classList.contains('light'));
(async () => {
  const b = await browser();
  try {
    for (const scheme of ['light', 'dark'])
      for (const stored of [undefined, 'invalid', 'light', 'dark']) {
        const c = await b.newContext({
            colorScheme: scheme,
            viewport: { width: 390, height: 1000 }
          }),
          p = await open(c, { stored });
        assert.equal(
          await dark(p),
          stored === 'light' ? false : stored === 'dark' ? true : scheme === 'dark'
        );
        await choose(p, (await dark(p)) ? 'light' : 'dark');
        const chosen = await dark(p);
        assert.equal(
          await p
            .locator('[data-theme-choice][value="' + (chosen ? 'dark' : 'light') + '"]')
            .isChecked(),
          true
        );
        await p.reload();
        await p.locator('.match-card').first().waitFor();
        assert.equal(await dark(p), chosen);
        assert.deepEqual(p.__errors, []);
        console.log('OK système, valeur validée, clavier et rechargement', scheme, stored);
        await c.close();
      }
    const c = await b.newContext({ colorScheme: 'dark' }),
      p = await open(c),
      other = await open(c);
    await choose(p, (await dark(p)) ? 'light' : 'dark');
    await other.waitForFunction(
      () => document.documentElement.classList.contains('light'),
      {},
      { timeout: 10000 }
    );
    await p.evaluate(() => localStorage.removeItem('betmaster-theme'));
    await other.waitForFunction(
      () => !document.documentElement.classList.contains('light'),
      {},
      { timeout: 10000 }
    );
    await c.close();
    for (const scheme of ['light', 'dark']) {
      const c = await b.newContext({ colorScheme: scheme, viewport: { width: 390, height: 1000 } }),
        p = await open(c, { blocked: true });
      assert.equal(await dark(p), scheme === 'dark');
      await choose(p, (await dark(p)) ? 'light' : 'dark');
      const changed = await dark(p);
      await p.locator('[data-mobile-target=community]').click();
      assert.equal(await dark(p), changed);
      assert.deepEqual(p.__errors, []);
      await c.close();
    }
    for (const width of [375, 390, 430, 767, 768, 1023, 1024, 1440])
      for (const scheme of ['light', 'dark']) {
        const c = await b.newContext({ colorScheme: scheme, viewport: { width, height: 1000 } }),
          p = await open(c);
        assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await p.addScriptTag({ url: base + '/__axe.js' });
        const violations = await p.evaluate(async () => {
          const r = await axe.run(
            { include: [['#matches'], ['#account-button']] },
            { runOnly: { type: 'rule', values: ['color-contrast'] } }
          );
          return r.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary }))
          }));
        });
        assert.deepEqual(violations, [], `contraste ${width} ${scheme}`);
        await p.locator('#account-button').click();
        await p.locator('[data-menu=theme]').click();
        const tooltip = await p.evaluate(async () => {
          const r = await axe.run('#theme-dialog', {
            runOnly: { type: 'rule', values: ['color-contrast'] }
          });
          return r.violations.map((v) => v.id);
        });
        assert.deepEqual(tooltip, []);
        await p.keyboard.press('Escape');
        await p.locator('#open-help').click();
        const dialog = await p.evaluate(async () => {
          const r = await axe.run('#help-dialog', {
            runOnly: { type: 'rule', values: ['color-contrast'] }
          });
          return r.violations.map((v) => v.id);
        });
        assert.deepEqual(dialog, []);
        assert.deepEqual(p.__errors, []);
        console.log('OK contraste, cartes/aides/fenêtre', width, scheme);
        await c.close();
      }
    console.log('OK onglets et stockage indisponible');
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
