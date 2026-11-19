const assert = require('node:assert/strict');
const { browser, page, fixtures, base } = require('./ui-mobile-fixtures.cjs');

async function run() {
  const b = await browser();
  try {
    const next = { ...fixtures, fixtureVersion: 'network-recovered' };
    const cold = await page(b, { network: true });
    await cold.locator('#match-list [data-retry-matches]').waitFor();
    await cold.route('**/data/fixtures.json', (route) => route.fulfill({ json: next }));
    await cold.locator('#match-list [data-retry-matches]').click();
    await cold.locator('#match-list .match-card').first().waitFor();
    assert.equal(await cold.locator('#fixture-network-notice').isVisible(), false);
    await cold.close();

    const cached = await page(b);
    await cached.locator('#match-list .match-card').first().waitFor();
    await cached.waitForFunction(async () => Boolean(await caches.match('./data/fixtures.json')));
    let requests = 0;
    const handle = (route) => {
      requests++;
      return route.abort('internetdisconnected');
    };
    await cached.route('**/data/fixtures.json', handle);
    await cached.goto(base);
    const notice = cached.locator('#fixture-network-notice');
    await notice.waitFor();
    await cached.locator('#match-list .match-card').first().waitFor();
    for (const name of ['calendrier', 'scores', 'cotes'])
      assert.match(await notice.innerText(), new RegExp(name + ' .*Paris'));
    await cached.evaluate(() => {
      for (let i = 0; i < 5; i++) document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(requests, 1);
    await cached.route('**/data/fixtures.json', (route) => route.fulfill({ json: next }));
    await cached.evaluate(() => window.dispatchEvent(new Event('online')));
    await notice.waitFor({ state: 'hidden' });
    assert.deepEqual(cached.__errors, []);
    await cached.close();
    const live = await page(b, {
      data: {
        ...fixtures,
        matches: [{ ...fixtures.matches[0], kickoff: new Date().toISOString() }]
      },
      init: () => {
        const realNow = Date.now.bind(Date);
        window.liveTimeShift = 0;
        Date.now = () => realNow() + window.liveTimeShift;
      }
    });
    await live.locator('#match-list .match-card').first().waitFor();
    let espnRequests = 0;
    let fail = false;
    await live.route('https://site.api.espn.com/**', (route) => {
      espnRequests++;
      if (fail) return route.abort();
      return route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        json: {
          events: [
            {
              id: '1',
              status: { type: { state: 'in' }, displayClock: '12:00' },
              competitions: [
                {
                  competitors: [
                    { homeAway: 'home', score: 1 },
                    { homeAway: 'away', score: 0 }
                  ]
                }
              ]
            }
          ]
        }
      });
    });
    await live.evaluate(() => window.dispatchEvent(new Event('online')));
    await live
      .locator('.live-badge')
      .getByText(/En direct/)
      .waitFor();
    async function resumeAfter(ms) {
      await live.evaluate((elapsed) => {
        window.liveTimeShift += elapsed;
        document.dispatchEvent(new Event('visibilitychange'));
      }, ms);
    }
    fail = true;
    await resumeAfter(21000);
    await live
      .locator('.live-badge')
      .getByText(/indisponible/)
      .waitFor();
    const failedRequests = espnRequests;
    await resumeAfter(21000);
    assert.equal(espnRequests, failedRequests);
    fail = false;
    await resumeAfter(21000);
    await live
      .locator('.live-badge')
      .getByText(/En direct/)
      .waitFor();
    assert.deepEqual(live.__errors, []);
    await live.close();
    console.log(
      'OK panne à froid, réessai, cache daté, reprises groupées retour en ligne et reprise ESPN'
    );
  } finally {
    await b.close();
  }
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
