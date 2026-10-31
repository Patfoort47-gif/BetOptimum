// Recette locale BET-114 : données simulées, aucun appel externe.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.BET_BASE_URL||'http://127.0.0.1:4173',out=process.env.BET_UI_REPORT||'/tmp/bet-ui-report';assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Cette recette simulée doit utiliser un serveur local');fs.mkdirSync(out,{recursive:true});const axePath=require.resolve('axe-core/axe.min.js',{paths:[process.env.BET_UI_TOOLS||'/tmp/bet-ui-tools']});
const now=Date.now(),date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(now),future=new Date(now+7200000).toISOString();
const match={id:'espn-1',date,time:'20:00',kickoff:future,league:'Ligue 1',home:'Équipe domicile au nom très long',away:'Équipe extérieure',homeGoals:1.7,awayGoals:1.1,odds:{home:2,draw:3,away:4,over:2,btts:2}};
const fixtures={generatedAt:new Date(now).toISOString(),scoresUpdatedAt:new Date(now).toISOString(),oddsRefreshedAt:new Date(now).toISOString(),matches:[match,{...match,id:'espn-2',home:'Deuxième domicile',away:'Deuxième extérieur'}],settlements:[]};
const mock=`export async function initAccountSync(c){window.__betCalls=[];window.__stored=[];let signed=false;const server=()=>({account:{bankroll:1000,initial:1000},bets:[],events:[],dailyPicks:[]});const login=()=>{signed=true;c.onAuthChange(true,{id:'test-user'});c.onServerData(server())};if(window.__logged)login();else c.onAuthChange(false);c.onCommunityStatus('off');return {configured:!window.__unconfigured,auth:{signIn:async()=>{login();return{id:'test-user'}},signOut:async()=>{signed=false;c.onAuthChange(false);c.onServerData(null)},nicknameAvailable:async()=>true},refreshServer:async()=>{if(signed)c.onServerData(server());return signed},findBetsByRefs:async()=>window.__stored.map(x=>x.clientRef),placeBet:async job=>{window.__betCalls.push(job);if(window.__failure==='cote')throw Object.assign(new Error('Une cote a changé : vérifiez le ticket.'),{code:'COTE_CHANGEE'});window.__stored.push(job);if(window.__failure==='unknown'){window.__failure=null;throw Object.assign(new Error('Indisponible'),{code:'UNAVAILABLE'})}return{id:'confirmed'}},community:{unread:async()=>0},reloadCommunity:()=>{},shop:{load:async()=>({items:[],weekly:null,inventory:[],equipped:[],balance:0,shields:[],duels:[],leagues:[],myLeagues:[],following:[],names:{}})},loadPlayer:async()=>({missing:true})}}`;
let b;async function page(options={}){const p=await b.newPage({viewport:{width:options.width||360,height:900},reducedMotion:options.reduce?'reduce':'no-preference'});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(opts=>{window.__logged=opts.logged;window.__unconfigured=opts.unconfigured;window.__failure=opts.failure;if(opts.dark)localStorage.setItem('betmaster-theme','dark');if(opts.storage)Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError')}})},options);await p.route('**/*',async r=>{const u=new URL(r.request().url());if(u.origin!==base)return r.abort();if(u.pathname.endsWith('/account.js'))return r.fulfill({contentType:'text/javascript',body:mock});if(u.pathname.endsWith('/data/fixtures.json'))return options.network?r.abort():r.fulfill({json:options.fixtures||fixtures});if(u.pathname.endsWith('/data/predictions-history.json'))return r.fulfill({json:[{id:'p1',date,league:'Ligue 1',match:'A - B',key:'home',label:'A',odd:2,status:'won',score:'2 : 0'},{id:'p2',date,league:'Ligue 1',match:'C - D',key:'away',label:'D',odd:2,status:'lost',score:'2 : 0'}]});return r.continue()});await p.goto(base);await p.waitForFunction(()=>document.querySelectorAll('.match-card').length>0);await p.waitForTimeout(100);p.__errors=errors;return p}

(async()=>{
 b=await chromium.launch({executablePath:process.env.BET_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
 const results=[];
 for(const width of [320,360,390,700,701,768,900,1024,1100,1101,1280,1366,1440,1599,1600,1920,2560])for(const dark of [false,true]){
  const p=await page({width,dark,reduce:true});
  // Long account names and balances exercise the header's reserved action area.
  await p.locator('#account-label').evaluate(e=>e.textContent='UnPseudoTrèsLongDeJoueur');
  await p.locator('#topbar-bankroll').evaluate(e=>e.textContent='1 234 567,89 €');
  for(const tab of ['matches','standings','predictions','community','bankroll']){
   if(tab==='standings')await p.locator('#match-navigation [data-open-tab=standings]').click();
   else if(width>700)await p.locator('.tabs [data-tab='+tab+']').click();
   else await p.locator('.mobile-nav [data-mobile-target='+tab+']').click();
   const layout=await p.evaluate(()=>{
    const header=document.querySelector('.topbar').getBoundingClientRect();
    const nav=document.querySelector('.tabs').getBoundingClientRect();
    const actions=document.querySelector('.topbar-actions').getBoundingClientRect();
    return {width:innerWidth,scroll:document.documentElement.scrollWidth,headerBottom:header.bottom,offset:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-offset')),navBottom:nav.bottom,buttons:[...document.querySelectorAll('.tabs .tab-button')].map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,font:parseFloat(getComputedStyle(e).fontSize),clipped:e.scrollWidth>e.clientWidth+1}}),actions:{left:actions.left,right:actions.right,top:actions.top,bottom:actions.bottom}};
   });
   assert.equal(layout.scroll,width,JSON.stringify({width,dark,tab,layout}));
   if(width>700){
    assert.ok(layout.headerBottom<layout.offset,JSON.stringify({width,tab,layout}));
    for(const button of layout.buttons){assert.ok(button.font>=11&&!button.clipped&&button.left>=0&&button.right<=width&&button.bottom<=layout.headerBottom,JSON.stringify({width,tab,button,layout}));assert.ok(button.bottom<=layout.actions.top||button.top>=layout.actions.bottom||button.right<=layout.actions.left||button.left>=layout.actions.right,JSON.stringify({width,tab,button,layout}));}
   }
  }
  if([360,1366,1920].includes(width)){await p.evaluate(()=>document.querySelector('.tabs [data-tab=matches]').click());await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:out+'/responsive-'+width+'-'+(dark?'sombre':'clair')+'.png',fullPage:false});}
  if(width<=700){await p.locator('[data-mobile-target=builder]').click();assert.equal(await p.locator('#close-builder').isVisible(),true);await p.locator('#close-builder').click();assert.equal(await p.locator('body').evaluate(e=>e.classList.contains('ticket-drawer-open')),false);}
  assert.deepEqual(p.__errors,[]);results.push({width,dark,passed:true});await p.close();
 }
 fs.writeFileSync(out+'/responsive.json',JSON.stringify(results,null,2));console.log('OK',results.length,'configurations, cinq destinations chacune');await b.close();
})().catch(async e=>{console.error(e);if(b)await b.close();process.exit(1)});
