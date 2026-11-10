import test from 'node:test';
import assert from 'node:assert/strict';
import { ticketToken, readTicketDraft, saveTicketDraft } from '../src/ticket/ticket-url.js';
import { restoreTicket } from '../src/ticket/ticket-restore.js';
import { ticketPreviewResponse } from '../src/server/ticket-preview.js';
const now = Date.now(),
  match = {
    id: 'espn-42',
    home: 'Lille',
    away: 'Paris',
    kickoff: new Date(now + 7200000).toISOString(),
    date: new Date(now).toISOString().slice(0, 10),
    time: '20:00',
    league: 'Ligue 1',
    homeGoals: 3,
    awayGoals: 0.5,
    odds: { home: 2 },
    realOddsMarkets: ['home'],
    oddsBookmakerCounts: { home: 10 }
  };
test('simple/combiné/système restaurent le marché exact et signalent cotes changées et indisponibles', () => {
  for (const mode of ['single', 'combined', 'multiple']) {
    const token = ticketToken(
        [
          { matchId: 'espn-42', key: 'home', odd: 1.8 },
          { matchId: 'espn-43', key: 'away', odd: 3 }
        ],
        { mode, formula: 'trixie' }
      ),
      r = restoreTicket(token, [match], now);
    assert.equal(r.mode, mode);
    assert.equal(r.formula, 'trixie');
    assert.equal(r.items.length, 1);
    assert.equal(r.items[0].key, 'home');
    assert.equal(r.items[0].odd, 2);
    assert.match(r.changed[0], /1.80 à 2.00/);
    assert.equal(r.unavailable.length, 1);
    assert.equal(restoreTicket(token, [{ ...match, completed: true }], now).items.length, 0);
    assert.equal(
      restoreTicket(token, [{ ...match, oddsBookmakerCounts: { home: 9 } }], now).items.length,
      0
    );
  }
});
test('le brouillon survit au retour OAuth sans stocker de donnée de compte et expire', () => {
  const data = new Map(),
    storage = {
      getItem: (k) => data.get(k),
      setItem: (k, v) => data.set(k, v),
      removeItem: (k) => data.delete(k)
    },
    token = ticketToken([{ matchId: 'espn-42', key: 'home', odd: 2 }]);
  saveTicketDraft(storage, token, now);
  assert.equal(readTicketDraft(storage, now + 3600000), token);
  assert.equal(readTicketDraft(storage, now + 864e5 + 1), null);
  saveTicketDraft(storage, null);
  assert.equal(readTicketDraft(storage), null);
  assert.doesNotThrow(() =>
    saveTicketDraft(
      {
        setItem() {
          throw Error();
        }
      },
      token
    )
  );
});
test('aperçu Open Graph avec PNG et coupon canonique, sans redirection vers un autre site', async () => {
  const token = ticketToken([{ matchId: 'espn-42', key: 'home', odd: 2 }]),
    url =
      'https://test.supabase.co/functions/v1/ticket-preview?ticket=' +
      encodeURIComponent(token) +
      '&image=11111111-1111-4111-8111-111111111111&access_token=private';
  const r = ticketPreviewResponse(
    new Request(url),
    'https://example.org/app/',
    'https://test.supabase.co'
  );
  assert.equal(r.status, 200);
  const text = await r.text();
  assert.match(text, /og:image/);
  assert.match(text, /11111111-1111-4111-8111-111111111111.png/);
  assert.match(text, /location.replace/);
  assert.ok(!text.includes('private'));
  assert.ok(!text.includes('user_id'));
  assert.equal(
    ticketPreviewResponse(
      new Request('https://test.supabase.co/?ticket=%3Cscript%3E'),
      'https://example.org/',
      'https://test.supabase.co'
    ).status,
    400
  );
});
