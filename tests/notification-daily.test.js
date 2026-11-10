import test from 'node:test';
import assert from 'node:assert/strict';
import { planDailyPush, dailyPushCurrent } from '../src/notifications/notification-daily.js';
import { dailyPicks } from '../src/club/daily-picks.js';
import { deliver } from '../src/notifications/notification-delivery.js';
const prefs = {
  enabled: true,
  daily_summary: true,
  essential: false,
  timezone: 'Europe/Paris',
  quiet_start: 1320,
  quiet_end: 480
};
function matches(now) {
  return Array.from({ length: 4 }, (_, i) => ({
    id: `espn-${i + 1}`,
    home: `Club ${i}`,
    away: 'Paris',
    kickoff: new Date(now + 3600000 * (i + 1)).toISOString(),
    homeGoals: 3,
    awayGoals: 0.5,
    odds: { home: 2 },
    realOddsMarkets: ['home'],
    oddsBookmakerCounts: { home: 10 }
  }));
}
test('résumé à 9 h dans le fuseau du compte, été comme hiver, sans filtrage de favoris', () => {
  for (const date of ['2026-03-29T07:00:00Z', '2026-10-25T08:00:00Z', '2026-11-09T08:00:00Z']) {
    const now = Date.parse(date),
      rows = matches(now);
    const e = planDailyPush(rows, prefs, now);
    assert.equal(e.picks.length, 3);
    assert.deepEqual(
      e.picks.map((p) => p.match_id),
      dailyPicks(rows, prefs.timezone, now).map((x) => x.match.id)
    );
    assert.equal(e.date, date.slice(0, 10));
    assert.equal(planDailyPush(rows, prefs, now - 1), null);
    assert.equal(planDailyPush(rows, prefs, now + 15 * 60000), null);
    assert.equal(planDailyPush([], prefs, now), null);
    assert.equal(planDailyPush(rows.slice(0, 1), prefs, now).picks.length, 1);
  }
});
test('consentement séparé, mode essentiel, silence et relecture des conseils avant livraison', () => {
  const now = Date.parse('2026-11-09T08:00:00Z'),
    rows = matches(now),
    e = planDailyPush(rows, prefs, now);
  for (const p of [
    { enabled: false },
    { daily_summary: false },
    { essential: true },
    { quiet_start: 0, quiet_end: 1439 }
  ])
    assert.equal(planDailyPush(rows, { ...prefs, ...p }, now), null);
  assert.equal(dailyPushCurrent(e, prefs, [], now), null);
  assert.equal(dailyPushCurrent(e, prefs, rows, now + 900000), null);
  assert.equal(dailyPushCurrent(e, { ...prefs, timezone: 'America/New_York' }, rows, now), null);
  const updated = rows.map((m) => ({ ...m, odds: { home: 2.2 } }));
  assert.equal(dailyPushCurrent(e, prefs, updated, now).picks[0].odd, 2.2);
});
test('push quotidien : trois sélections avec cotes, lien de sélection et regroupement journalier', async () => {
  const now = Date.parse('2026-11-09T08:00:00Z'),
    e = planDailyPush(matches(now), prefs, now);
  let payload;
  const target = {
    endpoint: 'https://web.push.apple.com/demo',
    keys: { p256dh: 'a'.repeat(87), auth: 'b'.repeat(22) }
  };
  const result = await deliver(
    'web',
    target,
    e,
    42,
    { SITE_URL: 'https://example.org/app/' },
    () => {
      throw Error('appel externe inattendu');
    },
    async (_, data) => (payload = JSON.parse(data))
  );
  assert.equal(result.status, 'sent');
  assert.equal(payload.title, '3 conseils du jour');
  assert.match(payload.body, /Club 0 - Paris/);
  assert.match(payload.body, /cote 2.00/);
  assert.equal(payload.url, 'https://example.org/app/?conseils_tz=Europe%2FParis#conseils-du-jour');
  assert.equal(payload.tag, 'daily-2026-11-09');
});
