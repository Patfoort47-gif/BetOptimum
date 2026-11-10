import test from 'node:test';
import assert from 'node:assert/strict';
import {
  localDate,
  planBriefing,
  briefingPicks,
  ticketProjection,
  buildBriefing
} from '../src/notifications/notification-briefing.js';
import { prepareBriefing } from '../src/notifications/notification-briefing-service.js';
import { briefingEmail } from '../src/notifications/notification-email.js';
import { deliver } from '../src/notifications/notification-delivery.js';
const now = Date.parse('2026-10-30T07:05:00Z');
const prefs = {
  enabled: true,
  channels: ['email'],
  daily_briefing: true,
  favorite_briefing: true,
  briefing_minute: 480,
  favorite_lead_minutes: 120,
  timezone: 'Europe/Paris',
  quiet_start: 1320,
  quiet_end: 480,
  teams: ['Lille'],
  leagues: [],
  min_value: 0.01,
  min_confidence: 0.3
};
const match = (id = 'm', kickoff = '2026-10-30T20:00:00Z') => ({
  id,
  home: 'Lille',
  away: 'Paris',
  league: 'Ligue 1',
  kickoff,
  homeGoals: 2,
  awayGoals: 1,
  odds: { home: 2, draw: 3, away: 4, over: 2, btts: 2 },
  realOddsMarkets: ['home', 'draw', 'away', 'over', 'btts'],
  bookmakerOffers: Array.from({ length: 10 }, (_, i) => ({
    key: `book-${i}`,
    name: 'Test',
    home: 2,
    draw: 3,
    away: 4,
    over: 2,
    btts: 2,
    updatedAt: new Date(now - 60000).toISOString()
  }))
});
const bet = (id, key = 'home', extra = {}) => ({
  id,
  status: 'pending',
  bet_type: 'single',
  stake: 10,
  odds: 2,
  selections: [{ matchId: 'm', key }],
  ...extra
});
test('opt-in séparé, pas de favoris sans match, fusion des rendez-vous dus', () => {
  assert.equal(planBriefing([], { ...prefs, enabled: false }, now), null);
  assert.equal(planBriefing([], { ...prefs, channels: ['web'] }, now), null);
  assert.deepEqual(planBriefing([], { ...prefs, daily_briefing: false }, now).kinds, ['daily']);
  assert.deepEqual(planBriefing([match()], prefs, now).kinds, ['daily']);
  const early = match('early', '2026-10-30T09:00:00Z');
  assert.deepEqual(planBriefing([early], prefs, now).kinds, ['daily']);
  assert.equal(
    planBriefing(
      [early],
      { ...prefs, daily_briefing: false, favorite_briefing: false },
      Date.parse(early.kickoff)
    ),
    null
  );
  assert.equal(planBriefing([], { ...prefs, briefing_minute: 600 }, now), null);
});
test('date locale, plage silencieuse, jours sans matchs et passage de minuit', () => {
  assert.equal(localDate('2026-10-30T23:30:00Z'), '2026-10-31');
  assert.ok(planBriefing([], { ...prefs, quiet_end: 600 }, now));
  assert.equal(
    planBriefing(
      [match('m', '2026-10-31T01:00:00Z')],
      { ...prefs, daily_briefing: false, favorite_briefing: false },
      now
    ),
    null
  );
  const event = planBriefing([], prefs, now);
  assert.equal(event.kickoff, '2026-10-30T23:00:00.000Z');
});
test('changement d’heure : heure inexistante reportée, heure répétée première occurrence', () => {
  const p = {
    ...prefs,
    favorite_briefing: false,
    quiet_start: 0,
    quiet_end: 0,
    briefing_minute: 150
  };
  assert.equal(planBriefing([], p, Date.parse('2026-03-29T00:55:00Z')), null);
  assert.ok(planBriefing([], p, Date.parse('2026-03-29T01:00:00Z')));
  assert.ok(planBriefing([], p, Date.parse('2026-10-25T00:30:00Z')));
  assert.ok(planBriefing([], p, Date.parse('2026-10-25T01:15:00Z')));
});
test('conseils limités à trois matchs distincts, seuils conservés, cotes datées uniquement', () => {
  assert.equal(
    briefingPicks([match('a'), match('b'), match('c'), match('d')], prefs, now).length,
    3
  );
  assert.equal(briefingPicks([match()], { ...prefs, min_confidence: 1 }, now).length, 0);
  for (const date of [
    undefined,
    'invalide',
    new Date(now - 864e5).toISOString(),
    new Date(now + 1000).toISOString()
  ]) {
    const m = match();
    m.bookmakerOffers.forEach((o) => (o.updatedAt = date));
    assert.equal(briefingPicks([m], prefs, now).length, 0);
  }
  assert.equal(briefingPicks([match('past', '2026-10-30T06:00:00Z')], prefs, now).length, 0);
});
test('les combinés sont comptés une fois, les multi-affiches et systèmes sont isolés', () => {
  const bets = [
    bet('a'),
    bet('a'),
    bet('b', 'home', {
      bet_type: 'combined',
      odds: 4,
      selections: [
        { matchId: 'm', key: 'home' },
        { matchId: 'n', key: 'btts' }
      ]
    }),
    bet('c', 'home', {
      bet_type: 'combined',
      selections: [
        { matchId: 'm', key: 'home' },
        { matchId: 'outside', key: 'home' }
      ]
    }),
    bet('system', 'home', { bet_type: 'multiple' })
  ];
  const p = ticketProjection(bets, ['m', 'n']);
  assert.equal(p.tickets.length, 2);
  assert.equal(p.stake, 20);
  assert.equal(p.gross, 60);
  assert.equal(p.net, 40);
  assert.equal(p.outside.length, 1);
  assert.equal(p.unsupported, 1);
});
test('un scénario tous gagnants incompatible n’a aucun total trompeur', () => {
  const p = ticketProjection([bet('a'), bet('b', 'away')], ['m']);
  assert.equal(p.incompatible, true);
  assert.equal(p.gross, null);
  assert.equal(p.net, null);
  assert.equal(p.stake, 20);
  assert.equal(ticketProjection([bet('a'), bet('b', 'btts')], ['m']).gross, 40);
  assert.equal(ticketProjection([bet('a', 'home', { status: 'won' })], ['m']).tickets.length, 0);
});
test('relecture privée par propriétaire juste avant envoi et retrait immédiat du consentement', async () => {
  const e = planBriefing([match()], prefs, now),
    calls = [];
  const db = async (...args) => {
    calls.push(args);
    return { account: { bankroll: 150 }, bets: [bet('a')] };
  };
  const content = await prepareBriefing(
    db,
    'owner',
    e,
    prefs,
    [match()],
    new Date(now).toISOString(),
    now
  );
  assert.deepEqual(calls, [['rpc/notification_briefing_snapshot', 'POST', { p_user: 'owner' }]]);
  assert.equal(content.bankroll, 150);
  assert.equal(
    await prepareBriefing(
      db,
      'owner',
      e,
      { ...prefs, daily_briefing: false, favorite_briefing: false },
      [match()],
      null,
      now
    ),
    null
  );
  assert.equal(
    await prepareBriefing(db, 'owner', e, prefs, [match()], null, Date.parse('2026-10-31T08:00Z')),
    null
  );
  assert.equal(calls.length, 1);
});
test('données périmées : pas de conseil ; absence de compte distincte d’une bankroll nulle', () => {
  const e = planBriefing([match()], prefs, now);
  const b = buildBriefing([match()], prefs, e, null, [], now, '2026-10-28T07:00:00Z');
  assert.equal(b.picks.length, 0);
  assert.equal(b.bankroll, null);
  assert.equal(buildBriefing([match()], prefs, e, { bankroll: 0 }, [], now, null).bankroll, 0);
});
test('HTML et texte cohérents, échappement, liens sûrs, aucun script ni image requis', () => {
  const m = match();
  m.home = '<script>"&';
  const e = planBriefing([m], prefs, now);
  const b = buildBriefing([m], prefs, e, { bankroll: 250 }, [], now, new Date(now).toISOString());
  const mail = briefingEmail({ ...b, demo: true }, 'https://example.com/bet/');
  assert.match(mail.html, /&lt;script&gt;/);
  assert.ok(!mail.html.includes('<script>'));
  assert.match(mail.text, /bankroll virtuelle actuelle/);
  assert.match(mail.html, /DONNÉES FICTIVES/);
  assert.match(mail.text, /18\+/);
  assert.match(mail.text, /me désabonner/);
  assert.match(mail.html, /role="presentation"/);
  assert.match(mail.html, /name="viewport"/);
  assert.ok(!mail.html.includes('<img'));
  assert.throws(() => briefingEmail(b, 'javascript:alert(1)'));
});
test('livraison briefing par Resend avec HTML, texte, idempotence et reprise 429', async () => {
  const b = buildBriefing(
    [match()],
    prefs,
    planBriefing([match()], prefs, now),
    { bankroll: 100 },
    [],
    now,
    new Date(now).toISOString()
  );
  const env = {
    SITE_URL: 'https://example.com/',
    EMAIL_FROM: 'bot@example.com',
    RESEND_API_KEY: 'secret'
  };
  const e = { briefing_content: b };
  const result = await deliver(
    'email',
    { email: 'owner@example.com' },
    e,
    98,
    env,
    async (url, init) => {
      const body = JSON.parse(init.body);
      assert.match(body.html, /Mes équipes favorites/);
      assert.match(body.text, /bankroll virtuelle actuelle/);
      assert.match(body.subject, /Ligue 1.*Lille - Paris/);
      assert.equal(init.headers['Idempotency-Key'], 'bet-notification-98');
      return new Response('{}');
    }
  );
  assert.equal(result.status, 'sent');
  assert.equal(
    (
      await deliver(
        'email',
        { email: 'owner@example.com' },
        e,
        98,
        env,
        async () => new Response('', { status: 429 })
      )
    ).status,
    'pending'
  );
});
test('BET-143 : trois conseils, favoris avant conseils, héros identifié sans répétition', () => {
  const m = match(),
    b = buildBriefing(
      [m],
      prefs,
      planBriefing([m], prefs, now),
      { bankroll: 0 },
      [],
      now,
      new Date(now).toISOString()
    );
  b.picks = Array.from({ length: 3 }, () => b.picks[0]);
  const mail = briefingEmail(b, 'https://example.com/');
  assert.ok(
    mail.text.indexOf('Mes équipes favorites') < mail.text.indexOf('Les 3 conseils du jour')
  );
  assert.match(mail.text, /★ Le match du jour/);
  assert.match(mail.text, /3 · Lille/);
  assert.match(mail.text, /bankroll virtuelle actuelle/);
  const limited = briefingEmail(
    { ...b, favorites: [], picks: b.picks.slice(0, 1) },
    'https://example.com/'
  );
  assert.ok(!limited.text.includes('Mes équipes favorites'));
  assert.match(limited.text, /Les 3 conseils du jour/);
  const stale = briefingEmail({ ...b, fresh: false }, 'https://example.com/');
  assert.doesNotMatch(stale.text, /indisponible|conseil\(s\)|Probabilités du modèle/i);
});
test('BET-125 : nouvelle heure future, aucun rattrapage et révision portée au worker', async () => {
  const p = {
    ...prefs,
    favorite_briefing: false,
    quiet_start: 0,
    quiet_end: 0,
    briefing_minute: 1080,
    daily_revision: 1,
    daily_not_before: '2026-10-30T15:00:00Z'
  };
  assert.equal(planBriefing([], p, Date.parse('2026-10-30T16:59:00Z')), null);
  const event = planBriefing([], p, Date.parse('2026-10-30T17:00:00Z'));
  assert.equal(event.daily_revision, 1);
  assert.deepEqual(event.kinds, ['daily']);
  assert.equal(
    planBriefing(
      [],
      { ...p, briefing_minute: 840, daily_not_before: '2026-10-30T23:00:00Z' },
      Date.parse('2026-10-30T15:01:00Z')
    ),
    null
  );
  assert.ok(
    planBriefing(
      [],
      { ...p, briefing_minute: 840, daily_not_before: '2026-10-30T23:00:00Z' },
      Date.parse('2026-10-31T13:00:00Z')
    )
  );
  let reads = 0;
  const db = async () => {
    reads++;
    return { account: null, bets: [] };
  };
  assert.equal(
    await prepareBriefing(
      db,
      'u',
      { ...event, daily_revision: 0 },
      p,
      [],
      null,
      Date.parse('2026-10-30T17:00:00Z')
    ),
    null
  );
  assert.equal(reads, 0);
  assert.ok(await prepareBriefing(db, 'u', event, p, [], null, Date.parse('2026-10-30T17:00:00Z')));
  assert.equal(reads, 1);
  assert.equal(
    await prepareBriefing(
      db,
      'u',
      event,
      { ...p, enabled: false },
      [],
      null,
      Date.parse('2026-10-30T17:00:00Z')
    ),
    null
  );
});
test('BET-125 : un horaire déjà écoulé au changement d’heure attend le lendemain', () => {
  const p = {
    ...prefs,
    favorite_briefing: false,
    quiet_start: 0,
    quiet_end: 0,
    briefing_minute: 150,
    daily_revision: 2,
    daily_not_before: '2026-10-25T01:15:00Z'
  };
  assert.equal(planBriefing([], p, Date.parse('2026-10-25T01:30:00Z')), null);
  assert.ok(planBriefing([], p, Date.parse('2026-10-26T01:30:00Z')));
});

test('BET-143 : favoris relus sur le compte au moment de la préparation', async () => {
  const m = match(),
    event = planBriefing([m], prefs, now);
  const b = await prepareBriefing(
    async () => ({ account: null, bets: [], favorites: { teams: [], leagues: [] } }),
    'u',
    event,
    prefs,
    [m],
    new Date(now).toISOString(),
    now
  );
  assert.equal(b.favorites.length, 0);
  assert.equal(b.matches.length, 1);
});

test('BET-273 : aucun conseil, probabilités réelles du modèle, CTA et suivi personnalisé', () => {
  const m = match(),
    b = buildBriefing(
      [m],
      { ...prefs, min_confidence: 1 },
      planBriefing([m], prefs, now),
      { bankroll: 0 },
      [],
      now,
      new Date(now).toISOString()
    );
  assert.equal(b.picks.length, 0);
  const email = briefingEmail(b, 'https://example.com/');
  for (const content of [email.text, email.html]) {
    assert.match(content, /Probabilités du modèle/);
    assert.match(content, /Nul/);
    assert.match(content, /Mon suivi/);
    assert.match(content, /0,00/);
    assert.doesNotMatch(content, /indisponible|0 conseil|conseil\(s\)|Pas de conseil forcé/i);
  }
  assert.match(email.subject, /Ligue 1.*Lille - Paris/);
  assert.match(email.html, /class="mail-button"[^>]+background:#c8f03c/);
  assert.match(email.text, /Explorer le match du jour/);
  const missing = briefingEmail(
    { ...b, bankroll: null, hero: { ...m, homeGoals: null }, favorites: [] },
    'https://example.com/'
  );
  assert.doesNotMatch(missing.text, /Probabilités du modèle|bankroll virtuelle actuelle|NaN|null/);
  const empty = briefingEmail(
    { ...b, hero: null, favorites: [], matches: [] },
    'https://example.com/'
  );
  assert.match(empty.text, /Explorer le calendrier/);
  assert.doesNotMatch(empty.text, /indisponible|0 conseil/i);
});
