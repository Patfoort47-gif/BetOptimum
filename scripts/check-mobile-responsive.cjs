const { chromium } = require('playwright'),
  assert = require('node:assert/strict'),
  fs = require('node:fs');
const base = process.env.BET_BASE_URL || 'http://127.0.0.1:4173',
  out = process.env.BET_UI_REPORT || '/tmp/bet-ui-report';
assert.ok(
  ['127.0.0.1', 'localhost'].includes(new URL(base).hostname),
  'Cette recette simulée doit utiliser un serveur local'
);
fs.mkdirSync(out, { recursive: true });
const now = Date.now(),
  date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now),
  future = new Date(now + 7200000).toISOString();
const match = {
  id: 'espn-1',
  date,
  time: '20:00',
  kickoff: future,
  league: 'Ligue 1',
  home: 'Équipe domicile au nom très long',
  away: 'Équipe extérieure',
  homeGoals: 1.7,
  awayGoals: 1.1,
  odds: { home: 2, draw: 3, away: 4, over: 2, btts: 2 }
};
const fixtures = {
  generatedAt: new Date(now).toISOString(),
  scoresUpdatedAt: new Date(now).toISOString(),
  oddsRefreshedAt: new Date(now).toISOString(),
  matches: [
    match,
    { ...match, id: 'espn-2', home: 'Deuxième domicile', away: 'Deuxième extérieur' }
  ],
  settlements: []
};
const mock = `export async function initAccountSync(c){window.__betCalls=[];window.__stored=[];let signed=false;const server=()=>({account:{bankroll:1000,initial:1000},bets:[],events:[],dailyPicks:[]});const login=()=>{signed=true;c.onAuthChange(true,{id:'test-user'});c.onServerData(server())};if(window.__logged)login();else c.onAuthChange(false);c.onCommunityStatus('off');return {configured:!window.__unconfigured,auth:{signIn:async()=>{login();return{id:'test-user'}},signOut:async()=>{signed=false;c.onAuthChange(false);c.onServerData(null)},nicknameAvailable:async()=>true},refreshServer:async()=>{if(signed)c.onServerData(server());return signed},findBetsByRefs:async()=>window.__stored.map(x=>x.clientRef),placeBet:async job=>{window.__betCalls.push(job);if(window.__failure==='cote')throw Object.assign(new Error('Une cote a changé : vérifiez le ticket.'),{code:'COTE_CHANGEE'});window.__stored.push(job);if(window.__failure==='unknown'){window.__failure=null;throw Object.assign(new Error('Indisponible'),{code:'UNAVAILABLE'})}return{id:'confirmed'}},community:{unread:async()=>0},reloadCommunity:()=>{},shop:{load:async()=>({items:[],weekly:null,inventory:[],equipped:[],balance:0,shields:[],duels:[],leagues:[],myLeagues:[],following:[],names:{}})},loadPlayer:async()=>({missing:true})}}`;

(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    for (const width of [320, 360, 390, 700, 768, 1280]) {
      const p = await b.newPage({ viewport: { width, height: 900 } });
      await p.route('**/*', async (r) => {
        const u = new URL(r.request().url());
        if (u.origin !== base) return r.abort();
        if (u.pathname.endsWith('/src/account/account.js'))
          return r.fulfill({ contentType: 'text/javascript', body: mock });
        if (u.pathname.endsWith('/data/fixtures.json')) return r.fulfill({ json: fixtures });
        if (u.pathname.endsWith('/data/predictions-history.json')) return r.fulfill({ json: [] });
        return r.continue();
      });
      await p.goto(base);
      await p.waitForSelector('.match-card');
      for (const hash of [
        '#matchs',
        '#bilan-pronos',
        '#communaute',
        '#bankroll',
        '#profil',
        '#boutique'
      ]) {
        await p.evaluate((hash) => (location.hash = hash), hash);
        await p.waitForTimeout(150);
        assert.equal(
          await p.evaluate(() => document.documentElement.scrollWidth),
          width,
          `${width} ${hash}`
        );
      }
      await p.evaluate(() => (location.hash = '#communaute'));
      await p.waitForTimeout(100);
      await p.evaluate(async () => {
        const { renderClubTable } = await import('./club-table.js');
        document.querySelector('#general-list').innerHTML = renderClubTable(
          [
            {
              nickname: 'Un pseudonyme particulièrement long pour vérifier le classement',
              rank: 1,
              picks: 12,
              wins: 8,
              points: 123.4,
              roi: 40
            }
          ],
          { html: (s) => s, avatar: () => '', me: 'other' }
        );
      });
      if (width <= 700) {
        const table = p.locator('.club-table');
        assert.ok(await table.evaluate((e) => e.scrollWidth <= e.clientWidth));
        assert.ok(
          await p
            .locator('.club-player button')
            .evaluate((e) => e.getBoundingClientRect().height >= 44)
        );
      }
      await p.screenshot({ path: out + '/responsive-' + width + '.png' });
      console.log('OK', width);
      await p.close();
    }
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
