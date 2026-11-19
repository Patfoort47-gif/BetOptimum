import test from 'node:test';
import assert from 'node:assert/strict';
import {
  previousParisDay,
  settledSummary,
  briefingSummary
} from '../src/notifications/briefing-summary.js';
import { briefingEmail } from '../src/notifications/notification-email.js';
import { prepareBriefing } from '../src/notifications/notification-briefing-service.js';
import { buildBriefing } from '../src/notifications/notification-briefing.js';
const now = Date.parse('2026-11-17T08:00:00Z'),
  stamp = new Date(now - 60000).toISOString();
const m = {
  id: 'espn-1',
  date: '2026-11-17',
  home: 'A',
  away: 'B',
  league: 'Ligue 1',
  kickoff: '2026-11-17T20:00:00Z',
  homeGoals: 1.8,
  awayGoals: 1.2,
  analysisStatus: 'ready',
  odds: { home: 4 },
  realOddsMarkets: ['home'],
  bookmakerOffers: Array.from({ length: 10 }, (_, i) => ({
    key: 'b' + i,
    home: 4,
    homeUpdatedAt: stamp
  }))
};
const history = [{ id: 'h', date: '2026-11-16', status: 'won', odd: 2 }];
test('BET-349 : veille de Paris et changements d’heure (23 h/25 h)', () => {
  const usual = previousParisDay(now);
  assert.equal(usual.date, '2026-11-16');
  assert.equal(usual.start, '2026-11-15T23:00:00.000Z');
  assert.equal(usual.end, '2026-11-16T23:00:00.000Z');
  for (const [date, hours] of [
    ['2026-03-30T10:00:00Z', 23],
    ['2026-10-26T10:00:00Z', 25]
  ]) {
    const p = previousParisDay(Date.parse(date));
    assert.equal((Date.parse(p.end) - Date.parse(p.start)) / 3600000, hours);
  }
});
test('BET-349 : bilan exact, doublons exclus et données manquantes explicites', () => {
  const bets = [
    { id: '1', status: 'won', stake: 10, payout: 25 },
    { id: '2', status: 'lost', stake: 10, payout: 0 },
    { id: '3', status: 'void', stake: 10, payout: 10 }
  ];
  const r = settledSummary([...bets, bets[0]]);
  assert.equal(r.count, 3);
  assert.equal(r.profit, 5);
  assert.equal(r.voided, 1);
  assert.equal(settledSummary([{ ...bets[0], payout: null }]).profit, null);
  const summary = briefingSummary([m], history, bets, now);
  assert.ok(summary.metrics.score > 0);
  assert.equal(summary.yesterday.model.won, 1);
  const b = buildBriefing(
    [m],
    { timezone: 'Europe/Paris', teams: [] },
    { date: '2026-11-17', kinds: ['daily'] },
    { bankroll: 321.55 },
    [],
    now,
    stamp,
    { history, settledBets: bets }
  );
  const email = briefingEmail(b, 'https://example.com/');
  for (const body of [email.html, email.text]) {
    assert.match(body, /Indice Global du jour : \d+\/100/);
    assert.match(body, /Avantage estimé \+/);
    assert.match(body, /Probabilités du modèle/);
    assert.match(body, /321,55/);
    assert.match(body, /Bilan de la veille/);
    assert.match(body, /1 gagné\(s\), 1 perdu\(s\), 1 remboursé\(s\)/);
    assert.match(body, /5,00/);
  }
  assert.match(email.subject, /A - B et les analyses du modèle/);
  assert.match(email.html, /prefers-color-scheme:dark/);
});
test('BET-349 : lecture privée bornée au destinataire et à la veille avant préparation', async () => {
  const paths = [];
  const b = await prepareBriefing(
    async (path) => {
      paths.push(path);
      return path.startsWith('bets?')
        ? [{ id: '1', status: 'won', stake: 10, payout: 20 }]
        : { account: { bankroll: 123 }, bets: [] };
    },
    'owner-id',
    { briefing: true, kinds: ['daily'], date: '2026-11-17', kickoff: '2026-11-17T23:00:00Z' },
    { enabled: true, daily_briefing: true, channels: ['email'], timezone: 'Europe/Paris' },
    [m],
    stamp,
    now,
    history
  );
  assert.match(
    paths[1],
    /user_id=eq.owner-id&settled_at=gte.2026-11-15T23:00:00.000Z&settled_at=lt.2026-11-16T23:00:00.000Z/
  );
  assert.equal(b.summary.yesterday.tickets.profit, 10);
  assert.equal(b.bankroll, 123);
});
