// BET-178 : parcours simulé local, aucun compte ni pronostic réel.
const { chromium } = require('playwright'),
  assert = require('node:assert/strict'),
  fs = require('node:fs');
const base = process.env.BET_BASE_URL || 'http://127.0.0.1:4174';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const now = Date.now(),
  date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now),
  future = new Date(now + 7200000).toISOString();
const matches = ['phare', 'libre'].map((id) => ({
  id,
  date,
  time: '23:59',
  kickoff: future,
  league: 'Ligue 1',
  home: 'Une équipe au nom particulièrement long',
  away: 'Visiteurs',
  homeGoals: 1.6,
  awayGoals: 1.1,
  odds: { home: 2, draw: 3, away: 4, over: 2, btts: 2 },
  realOddsMarkets: ['home', 'draw', 'away', 'over', 'btts'],
  oddsBookmakerCounts: { home: 10, draw: 10, away: 10, over: 10, btts: 10 }
}));
const rows = [
  {
    user_id: 'me',
    nickname: 'Un joueur au pseudo long',
    rank: 1,
    picks: 12,
    wins: 8,
    points: 120,
    roi: 50
  }
];
const special = {
  leagues: [
    { id: 'l1', kind: 'competition', name: 'Ligue 1', league_label: 'Ligue 1', access: 'free' },
    {
      id: 'l2',
      kind: 'competition',
      name: 'Premier League',
      league_label: 'Premier League',
      access: 'free'
    }
  ],
  mine: [],
  counts: {},
  picks: [],
  standings: [],
  rounds: [
    {
      id: 'r1',
      league_id: 'l1',
      label: 'Journée du jour',
      ends_at: future,
      match_ids: ['phare', 'libre'],
      anchor: 'phare',
      free_slots: 1
    }
  ]
};
const mock = `export async function initAccountSync(c){const data=${JSON.stringify(special)};window.__calls=[];c.onAuthChange(true,{id:'me'});c.onServerData({account:{bankroll:1000,initial:1000},bets:[],events:[],dailyPicks:[]});c.onCommunityStatus('ready');c.onSpecialData(data);return {configured:true,auth:{},community:{unread:async()=>0,ranking:async()=>({rows:${JSON.stringify(rows)},total:1}),podium:async()=>({rows:[]})},leagueStandings:async()=>${JSON.stringify(rows)},playSpecialPick:async(league,match,key)=>{window.__calls.push([match,key]);await new Promise(r=>setTimeout(r,250));if(window.__fail)throw new Error('Enregistrement refusé');data.picks=[{league_id:league,round_id:'r1',match_ids:[match],kind:match==='phare'?'anchor':'free',source:'grid',key,status:'pending'}];c.onSpecialData(data)},clearSpecialPick:async()=>{window.__calls.push(['clear']);data.picks=[];c.onSpecialData(data)}}}`;
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.BET_CHROMIUM || '/usr/bin/chromium',
    args: ['--no-sandbox']
  });
  try {
    for (const width of [320, 390, 768, 1280])
      for (const dark of [true, false]) {
        const page = await browser.newPage({
            viewport: { width, height: 950 },
            reducedMotion: 'reduce'
          }),
          errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.addInitScript(
          (dark) => localStorage.setItem('betmaster-theme', dark ? 'dark' : 'light'),
          dark
        );
        await page.route('**/*', (r) => {
          const u = new URL(r.request().url());
          if (u.hostname === 'a.espncdn.com')
            return r.fulfill({
              contentType: 'image/svg+xml',
              body: '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><rect width="500" height="500" fill="green"/></svg>'
            });
          if (u.origin !== new URL(base).origin) return r.abort();
          if (u.pathname.endsWith('/src/account/account.js'))
            return r.fulfill({ contentType: 'text/javascript', body: mock });
          if (u.pathname.endsWith('/data/fixtures.json'))
            return r.fulfill({
              json: { generatedAt: new Date(now).toISOString(), matches, settlements: [] }
            });
          if (u.pathname.endsWith('/data/predictions-history.json')) return r.fulfill({ json: [] });
          return r.continue();
        });
        await page.goto(base + '/#communaute');
        await page.locator('#club-league-select option[value=l1]').waitFor({ state: 'attached' });
        await page.locator('#club-league-select').selectOption('l1');
        await page.locator('#club-special-ranking table').waitFor();
        const badge = page.locator('#club-competition .competition-badge');
        assert.deepEqual(await badge.evaluate((e) => [e.clientWidth, e.clientHeight]), [32, 32]);
        assert.equal(
          await page
            .locator('#club-competition .league-watermark')
            .evaluate((e) => getComputedStyle(e).opacity),
          '0.06'
        );
        await page.locator('#club-league-select').selectOption('l2');
        await page.locator('#club-special-ranking table').waitFor();
        const next = await page
          .locator('#club-competition .league-watermark img')
          .getAttribute('src');
        await page.locator('#club-league-select').selectOption('l1');
        assert.notEqual(
          await page.locator('#club-competition .league-watermark img').getAttribute('src'),
          next
        );
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
        await page.getByRole('button', { name: 'Remplir ma grille du jour', exact: true }).click();
        await page.getByRole('heading', { name: 'Ma grille du jour', exact: true }).waitFor();
        assert.ok(
          await page.locator('.grid-guide').evaluate((e) => e.getBoundingClientRect().top >= 0)
        );
        const pick = page.locator('[data-special-match=phare][data-special-key=home]');
        await pick.click();
        await page.locator('.special-match[aria-busy=true]').waitFor();
        assert.equal(await page.locator('[data-special-match=phare]:enabled').count(), 0);
        await page
          .locator('[data-special-match=phare][data-special-key=home][aria-pressed=true]')
          .waitFor();
        assert.equal(await page.evaluate(() => window.__calls.length), 1);
        assert.match(
          await page.locator('.special-pick-status').first().innerText(),
          /Pronostic enregistré/
        );
        await page.locator('[data-special-match=phare][data-special-key=home]').click();
        await page
          .locator('[data-special-match=phare][data-special-key=home][aria-pressed=false]')
          .waitFor();
        await page.evaluate(() => (window.__fail = true));
        await page.locator('[data-special-match=libre][data-special-key=draw]').click();
        await page.getByText('Enregistrement refusé', { exact: true }).waitFor();
        assert.equal(
          await page
            .locator('[data-special-match=libre][data-special-key=draw]')
            .getAttribute('aria-pressed'),
          'false'
        );
        assert.equal(
          await page.locator('#special-dialog').evaluate((e) => e.scrollWidth <= e.clientWidth),
          true
        );
        assert.deepEqual(errors, []);
        fs.mkdirSync('work/community-ui', { recursive: true });
        await page.screenshot({
          path: `work/community-ui/${width}-${dark ? 'dark' : 'light'}.png`
        });
        console.log('OK', width, dark ? 'sombre' : 'clair');
        await page.close();
      }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
