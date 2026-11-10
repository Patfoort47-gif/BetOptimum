const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.BET_BASE_URL||'http://127.0.0.1:4173';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const source=fs.readFileSync(__dirname+'/check-public-ui.cjs','utf8');
const mock=source.match(/const mock\s*=\s*`([\s\S]*?)`;/)[1];
const now=Date.now();
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const odds={home:2,draw:3,away:4,over:2,btts:2};
const offers=Array.from({length:10},(_,i)=>({key:'book-'+i,...odds,updatedAt:new Date(now).toISOString()}));
const match={id:'espn-1',date,time:'23:59',kickoff:new Date(now+7200000).toISOString(),league:'Ligue 1',home:'Domicile',away:'Extérieur',homeGoals:1.7,awayGoals:1.1,odds,realOddsMarkets:Object.keys(odds),bookmakerOffers:offers};
const fixtures={generatedAt:new Date(now).toISOString(),scoresUpdatedAt:new Date(now).toISOString(),oddsRefreshedAt:new Date(now).toISOString(),matches:[{...match,priority:100},{...match,id:'espn-2',home:'Autre domicile',priority:50}],settlements:[]};
let browser;
(async()=>{
 browser=await chromium.launch({executablePath:process.env.BET_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
 for(const width of [360,1280]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),requests=[],errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{const url=new URL(route.request().url());requests.push(url);if(url.origin!==new URL(base).origin)return route.abort();if(url.pathname.endsWith('/account.js'))return route.fulfill({contentType:'text/javascript',body:mock});if(url.pathname.endsWith('/data/fixtures.json'))return route.fulfill({json:fixtures});if(url.pathname.endsWith('/data/predictions-history.json'))return route.fulfill({json:[]});return route.continue()});
  await page.goto(base);
  await page.waitForFunction(()=>document.querySelectorAll('#match-list .match-card').length===2);
  assert.equal(requests.filter(url=>url.pathname.endsWith('/details.js')).length,0,'Les fiches restent chargées à la demande');
  const card=page.locator('#match-list .match-card').first(),handle=await card.elementHandle();
  const market=card.locator('.featured-markets [data-market="home"]');
  await market.click();
  assert.equal(await market.getAttribute('aria-pressed'),'true');
  assert.equal(await card.elementHandle(),handle,'Une sélection conserve la carte');
  if(width<700){const box=await card.boundingBox();assert.ok(box.y<900,`Premier match hors écran : ${box.y}px`);assert.deepEqual(await card.locator('[data-market]:visible').evaluateAll(nodes=>nodes.map(node=>node.dataset.market)),['home','draw','away'])}
  await card.locator('[data-details]').click();
  await page.locator('#detail-dialog').waitFor({state:'visible'});
  assert.equal(requests.filter(url=>url.pathname.endsWith('/details.js')).length,1);
  await page.keyboard.press('Escape');
  assert.deepEqual(errors,[]);
  console.log(`OK ${width}px : premier match, carte stable et fiche à la demande`);
  await page.close();
 }
 await browser.close();
})().catch(async error=>{console.error(error);if(browser)await browser.close();process.exit(1)});
