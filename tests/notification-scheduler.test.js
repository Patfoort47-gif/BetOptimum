import test from 'node:test';
import assert from 'node:assert/strict';
import { runScheduledReminders } from '../notification-scheduler.js';
const now = Date.parse('2026-11-06T18:00:00Z');
test('le minuteur saute un traitement déjà réservé sans lire ni envoyer de données', async () => {
  let calls = 0;
  const result = await runScheduledReminders(
    async (path) => {
      calls++;
      assert.equal(path, 'rpc/claim_notification_scheduler');
      return false;
    },
    async () => {
      throw Error('envoi inattendu');
    },
    now
  );
  assert.equal(result.skipped, true);
  assert.equal(calls, 1);
});
test('le minuteur lit le calendrier récent côté serveur puis ne traite que les rappels', async () => {
  const match = {
      id: 'match',
      home: 'A',
      away: 'B',
      league: 'Ligue 1',
      kickoff: '2026-11-06T20:00:00Z'
    },
    calls = [];
  const db = async (path, method, body) => {
    calls.push([path, method, body]);
    if (path === 'rpc/claim_notification_scheduler') return true;
    if (path.startsWith('fixtures?')) return [match];
  };
  const result = await runScheduledReminders(
    db,
    async (matches, date, remindersOnly) => {
      assert.equal(matches.length, 1);
      assert.equal(matches[0].id, match.id);
      assert.equal(date, new Date(now).toISOString());
      assert.equal(remindersOnly, true);
      return { queued: 1, sent: 1, revision: 'BET-243' };
    },
    now
  );
  assert.equal(result.sent, 1);
  assert.match(calls[1][0], /completed=eq.false&voided=eq.false/);
  assert.ok(calls[1][0].includes('updated_at=gt.2026-11-05T18:00:00.000Z'));
  assert.deepEqual(calls.at(-1), [
    'rpc/finish_notification_scheduler',
    'POST',
    { p_ok: true, p_queued: 1, p_sent: 1 }
  ]);
});
test('un échec de lecture ou de livraison libère le bail et signale un échec sans données privées', async () => {
  for (const stage of ['read', 'worker']) {
    const calls = [];
    const db = async (path, method, body) => {
      calls.push([path, body]);
      if (path === 'rpc/claim_notification_scheduler') return true;
      if (path.startsWith('fixtures?')) {
        if (stage === 'read') throw Error('failure');
        return [];
      }
    };
    await assert.rejects(
      () =>
        runScheduledReminders(
          db,
          async () => {
            throw Error('failure');
          },
          now
        ),
      /failure/
    );
    assert.deepEqual(calls.at(-1), [
      'rpc/finish_notification_scheduler',
      { p_ok: false, p_queued: 0, p_sent: 0 }
    ]);
  }
});
