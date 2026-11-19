import test from 'node:test';
import assert from 'node:assert/strict';
import { createInbox } from '../src/club/in-app-notifications.js';
const store = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k), setItem: (k, v) => m.set(k, v) };
};
test('aucun rejeu historique, nouveaux règlements gagnés/perdus persistants une seule fois', () => {
  const storage = store();
  let box = createInbox(storage, 'a');
  box.bets([
    { id: 'old', status: 'won' },
    { id: 'next', status: 'pending' }
  ]);
  assert.equal(box.unread(), 0);
  box.bets([
    { id: 'old', status: 'won' },
    { id: 'next', status: 'lost' }
  ]);
  assert.equal(box.unread(), 1);
  box = createInbox(storage, 'a');
  box.bets([{ id: 'next', status: 'lost' }]);
  assert.equal(box.unread(), 1);
  box.read();
  assert.equal(box.unread(), 0);
  assert.equal(createInbox(storage, 'b').items().length, 0);
});
test('défis terminés signalés une fois, historique borné et stockage indisponible toléré', () => {
  const box = createInbox(
    {
      getItem() {
        throw Error();
      },
      setItem() {
        throw Error();
      }
    },
    'a'
  );
  box.rewards({ results: [] });
  box.rewards({ results: [{ week_start: '2026-11-02', challenge_id: 'safe-week' }] });
  box.rewards({ results: [{ week_start: '2026-11-02', challenge_id: 'safe-week' }] });
  assert.equal(box.unread(), 1);
  box.bets([]);
  for (let i = 0; i < 110; i++) box.bets([{ id: String(i), status: 'won' }]);
  assert.equal(box.items().length, 100);
  box.read(box.items()[0].id);
  assert.equal(box.unread(), 99);
});
