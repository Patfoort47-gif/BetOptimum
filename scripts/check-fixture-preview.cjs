const assert = require('node:assert/strict');
const { browser, page, fixtures } = require('./ui-mobile-fixtures.cjs');

async function run() {
  const b = await browser();
  try {
    const tomorrow = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(Date.now() + 86400000);
    const matches = Array.from({ length: 105 }, (_, i) => ({
      ...fixtures.matches[i % 2],
      analysisStatus: 'ready',
      id: 'espn-' + (i + 1),
      ...(i === 103
        ? { date: tomorrow, home: 'Équipe de demain' }
        : i === 104
          ? { date: '2099-01-01' }
          : {})
    }));
    const p = await page(b, {
      width: 390,
      touch: true,
      data: { ...fixtures, matches },
      init: () => {
        window.Worker = class {
          postMessage(matches) {
            window.sentDates = [...new Set(matches.map((match) => match.date))];
            window.resumeAnalysis = () => this.onerror();
          }
          terminate() {}
        };
      }
    });
    await p.waitForFunction(() => typeof window.resumeAnalysis === 'function');
    assert.deepEqual(await p.evaluate(() => window.sentDates), [fixtures.matches[0].date]);
    const during = await p.evaluate((day) => {
      const hasMarkets = Boolean(document.querySelector('#match-list [data-market]'));
      document.querySelector(`[data-date="${day}"]`).click();
      return { hasMarkets, selected: document.querySelector('.match-preview-card')?.textContent };
    }, tomorrow);
    assert.equal(during.hasMarkets, false);
    assert.match(during.selected ?? '', /Équipe de demain/);
    await p.evaluate(() => window.resumeAnalysis());
    await p.locator('#match-list .match-card').first().waitFor();
    assert.equal(await p.locator('.match-preview-card').count(), 0);
    assert.equal(await p.locator('#match-list .match-card').count(), 1);
    assert.match(await p.locator('#match-list .match-card').innerText(), /Équipe de demain/);
    assert.deepEqual(p.__errors, []);
    console.log('OK aperçu sans marché, changement de date et repli du worker');
  } finally {
    await b.close();
  }
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
