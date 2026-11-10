import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ticketUrl, readTicket } from '../src/ticket/ticket-url.js';
test('lien avec cote de référence, sans mise ni paramètres de compte', () => {
  const items = [{ matchId: 'espn-42', key: 'home', odd: 200, stake: 100 }];
  const url = new URL(ticketUrl('https://example.org/?token=secret#profil', items));
  assert.equal(url.searchParams.size, 1);
  assert.deepEqual(readTicket(url.searchParams.get('ticket')), {
    items: [{ matchId: 'espn-42', key: 'home', sharedOdd: 200 }],
    invalid: false,
    mode: 'single',
    formula: 'auto'
  });
  assert.equal(url.hash, '');
});
test('liens malformés, dupliqués ou trop longs bornés', () => {
  assert.equal(readTicket('espn-42:home,espn-42:away,<script>').invalid, true);
  assert.deepEqual(readTicket('x'.repeat(12001)), { items: [], invalid: true });
  assert.equal(readTicket(Array(40).fill('espn-42:home').join(',')).items.length, 1);
});

test('les scores exacts conservent leur identifiant avec séparateur', () => {
  const url = new URL(ticketUrl('https://example.org/', [{ matchId: 'espn-42', key: 'score2_1' }]));
  assert.deepEqual(readTicket(url.searchParams.get('ticket')), {
    items: [{ matchId: 'espn-42', key: 'score2_1' }],
    invalid: false,
    mode: 'single',
    formula: 'auto'
  });
});
