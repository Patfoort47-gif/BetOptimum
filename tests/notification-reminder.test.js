import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectFavoriteReminders,
  favoriteReminderCurrent
} from '../src/notifications/notification-reminder.js';
import { deliver } from '../src/notifications/notification-delivery.js';
const now = Date.parse('2026-11-06T16:00:00Z');
const match = {
  id: 'espn-1',
  home: 'Lille',
  away: 'Paris',
  league: 'Ligue 1',
  kickoff: new Date(now + 7200000).toISOString()
};
const prefs = {
  enabled: true,
  favorite_reminders: true,
  quiet_start: 1320,
  quiet_end: 480,
  timezone: 'Europe/Paris'
};
const favorites = { teams: ['Lille', 'Paris'], leagues: ['Ligue 1'] };
test('un rappel par match des équipes favorites, sans cote et seulement à H-2', () => {
  assert.equal(detectFavoriteReminders([match], prefs, favorites, now - 1).length, 0);
  assert.equal(detectFavoriteReminders([match], prefs, favorites, now).length, 1);
  assert.equal(detectFavoriteReminders([match], prefs, favorites, now + 14 * 60000).length, 1);
  assert.equal(detectFavoriteReminders([match], prefs, favorites, now + 15 * 60000).length, 0);
  assert.equal(
    detectFavoriteReminders([match], prefs, { teams: [], leagues: ['Ligue 1'] }, now).length,
    0
  );
  for (const changes of [
    { enabled: false },
    { favorite_reminders: false },
    { favorite_reminders: undefined },
    { quiet_start: 0, quiet_end: 1439 }
  ])
    assert.equal(
      detectFavoriteReminders([match], { ...prefs, ...changes }, favorites, now).length,
      0
    );
  for (const changes of [{ completed: true }, { voided: true }, { kickoff: 'invalide' }])
    assert.equal(
      detectFavoriteReminders([{ ...match, ...changes }], prefs, favorites, now).length,
      0
    );
});
test('la livraison relit favoris, consentement, calendrier et expiration', () => {
  const [event] = detectFavoriteReminders([match], prefs, favorites, now);
  const current = (p = prefs, f = favorites, m = [match], n = now) =>
    favoriteReminderCurrent(event, p, f, m, n);
  assert.equal(current(), true);
  assert.equal(current({ ...prefs, favorite_reminders: false }), false);
  assert.equal(current(prefs, { teams: [] }), false);
  assert.equal(current(prefs, favorites, []), false);
  assert.equal(
    current(prefs, favorites, [{ ...match, kickoff: new Date(now + 7500000).toISOString() }]),
    false
  );
  assert.equal(current(prefs, favorites, [match], now + 900000), false);
});
test('le push de rappel ouvre le bon match et fonctionne sans statistiques de cote', async () => {
  const [event] = detectFavoriteReminders([match], prefs, favorites, now);
  const target = {
    endpoint: 'https://web.push.apple.com/example',
    keys: { p256dh: 'a'.repeat(87), auth: 'b'.repeat(22) }
  };
  let payload;
  const result = await deliver(
    'web',
    target,
    event,
    42,
    { SITE_URL: 'https://example.com/bet/' },
    async () => {
      throw Error('Réseau inattendu');
    },
    async (_target, text) => {
      payload = JSON.parse(text);
    }
  );
  assert.equal(result.status, 'sent');
  assert.match(payload.title, /Lille - Paris/);
  assert.match(payload.body, /Lille - Paris/);
  assert.match(payload.body, /Conseil et cote indisponibles/);
  assert.equal(payload.url, 'https://example.com/bet/#match-espn-1');
  assert.equal(
    (await deliver('telegram', { chat_id: '123' }, event, 42, { SITE_URL: 'https://example.com/' }))
      .status,
    'failed'
  );
});

test('seules les équipes favorites déclenchent, sans doublon équipe/championnat', () => {
  const other = { ...match, id: 'espn-2', home: 'Rennes', away: 'Lyon' };
  assert.equal(
    detectFavoriteReminders([match, other], prefs, { teams: [], leagues: ['Ligue 1'] }, now).length,
    0
  );
  assert.equal(detectFavoriteReminders([match, match], prefs, favorites, now).length, 1);
  const [event] = detectFavoriteReminders([match], prefs, favorites, now);
  assert.equal(
    favoriteReminderCurrent(event, prefs, { teams: [], leagues: ['Ligue 1'] }, [match], now),
    false
  );
});
test('le rappel reprend le conseil courant du modèle avec cote et confiance', () => {
  const m = {
    ...match,
    homeGoals: 3,
    awayGoals: 0.5,
    odds: { home: 2 },
    realOddsMarkets: ['home'],
    oddsBookmakerCounts: { home: 10 }
  };
  const [event] = detectFavoriteReminders([m], prefs, favorites, now);
  assert.equal(event.advice.key, 'home');
  assert.equal(event.advice.odd, 2);
  assert.ok(event.advice.confidence > 0);
});
