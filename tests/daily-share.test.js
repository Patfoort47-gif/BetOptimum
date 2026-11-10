import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyShare } from '../src/sharing/daily-share.js';
test('partage du défi limité aux carrés et à la série, sans données privées', () => {
  const challenge = {
    date: '2026-11-10',
    picks: [{ matchId: 'a' }, { matchId: 'b' }, { matchId: 'c' }, { matchId: 'd' }]
  };
  const choices = [
    {
      id: '1',
      day: challenge.date,
      match_id: 'a',
      status: 'won',
      placed_at: '2026-11-10T10:00Z',
      stake: 999,
      email: 'secret'
    },
    { id: '2', day: challenge.date, match_id: 'b', status: 'lost', placed_at: '2026-11-10T09:00Z' },
    { id: '3', day: challenge.date, match_id: 'c', status: 'pending' }
  ];
  const p = dailyShare(challenge, choices);
  assert.equal(p.lines[1], '🟩🟥🟨⬜');
  assert.match(p.lines[2], /1 bon prono/);
  assert.doesNotMatch(JSON.stringify(p), /999|secret|bankroll|stake|email/);
  assert.equal(dailyShare(challenge, []), null);
  assert.equal(dailyShare(null), null);
});
