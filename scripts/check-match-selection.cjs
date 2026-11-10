// BET-175 : recette locale uniquement, aucun pari envoyé au serveur.
const { chromium } = require('playwright'),
  assert = require('node:assert/strict'),
  fs = require('node:fs');
const base = process.env.BET_BASE_URL || 'http://127.0.0.1:4173';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
(async () => {
  const { recommendedMarket } = await import('../model.js'),
    now = Date.now(),
    date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now),
    fixture = (id, odds, patch = {}) => ({
      id,
      date,
      time: '23:59',
      kickoff: new Date(now + 7200000).toISOString(),
      league: 'Ligue 1',
      home: 'Équipe ' + id,
      away: 'Visiteur',
      homeGoals: 1.6,
      awayGoals: 1,
      odds,
      realOddsMarkets: Object.keys(odds),
      oddsBookmakerCounts: Object.fromEntries(Object.keys(odds).map((k) => [k, 10])),
      marketValidUntil: Object.fromEntries(
        Object.keys(odds).map((k) => [k, new Date(now + 3600000).toISOString()])
      ),
      ...patch
    });
  const matches = [
    fixture('different', { home: 2, btts: 1.9, under35: 1.16, under45: 1.14, homeDraw: 1.15 }),
    fixture('none', { home: 1.15, btts: 1.1 }),
    fixture('extended', { under45: 1.25, score1_0: 6 }),
    fixture(
      'coverage',
      { home: 2, under35: 1.2 },
      { oddsBookmakerCounts: { home: 10, under35: 9 } }
    ),
    fixture(
      'past',
      { home: 2, under35: 1.2 },
      {
        completed: true,
        kickoff: new Date(now - 7200000).toISOString(),
        homeScore: 1,
        awayScore: 0,
        suggestedPick: { key: 'home', label: 'Choix archivé', odd: 2, probability: 0.4 }
      }
    )
  ];
  const browser = await chromium.launch({
    executablePath: process.env.BET_CHROMIUM || '/usr/bin/chromium',
    args: ['--no-sandbox']
  });
  for (const width of [390, 1366]) {
    const page = await browser.newPage({
        viewport: { width, height: 950 },
        reducedMotion: 'reduce'
      }),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', (r) => {
      const u = new URL(r.request().url());
      if (u.origin !== new URL(base).origin) return r.abort();
      if (u.pathname.endsWith('/account.js'))
        return r.fulfill({
          contentType: 'text/javascript',
          body: 'export async function initAccountSync(c){c.onAuthChange(false);c.onCommunityStatus("off");return {configured:false,community:{ranking:async()=>({rows:[],total:0}),podium:async()=>({rows:[]})},auth:{}}}'
        });
      if (u.pathname.endsWith('/data/fixtures.json'))
        return r.fulfill({
          json: { generatedAt: new Date(now).toISOString(), matches, settlements: [] }
        });
      if (u.pathname.endsWith('/data/predictions-history.json')) return r.fulfill({ json: [] });
      return r.continue();
    });
    await page.goto(base);
    await page.locator('#match-different').waitFor();
    for (const m of matches.filter((m) => !m.completed)) {
      const card = page.locator('#match-' + m.id),
        pick = recommendedMarket(m);
      if (!pick) {
        assert.equal(await card.locator('.match-selection').count(), 0);
        assert.match(await card.innerText(), /Aucune sélection admissible/);
        assert.equal(await card.locator('.highest-confidence').count(), 0);
      } else {
        assert.equal(await card.locator('.match-selection').getAttribute('data-market'), pick.key);
        assert.equal(await card.locator('.highest-confidence').count(), 1);
        assert.equal(
          await card.locator('.highest-confidence').getAttribute('data-market'),
          pick.key
        );
        assert.match(
          await card.locator('.match-selection').innerText(),
          new RegExp(Math.round(pick.probability * 100) + ' %')
        );
      }
    }
    assert.match(await page.locator('#match-past').innerText(), /Choix archivé/);
    await page.locator('#match-extended .match-selection').click();
    await page.getByText('Moins de 4,5 buts ajouté au ticket', { exact: false }).waitFor();
    assert.equal(
      await page.locator('#daily-selection [data-market]').getAttribute('data-market'),
      'under45'
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true
    );
    assert.deepEqual(errors, []);
    fs.mkdirSync('work/recette-selections', { recursive: true });
    await page.screenshot({ path: `work/recette-selections/${width}.png`, fullPage: true });
    console.log(
      'OK ' +
        width +
        'px : sélection du match, maximum admissible unique, seuil strict, absence de repli, marché étendu, ticket, archive, sélection du jour.'
    );
    await page.close();
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
