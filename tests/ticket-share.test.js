import test from 'node:test';
import assert from 'node:assert/strict';
import { shareSummary } from '../src/ticket/ticket-share.js';
test('le partage décrit un simple par sa sélection et sa cote', () => {
  assert.equal(
    shareSummary({ items: [{ label: 'Victoire Paris', odd: 1.75 }], betType: 'single' }),
    'Pari simple : Victoire Paris · cote 1,75'
  );
});
test('le partage décrit un combiné par son nombre de sélections et sa cote', () => {
  assert.equal(
    shareSummary({
      items: [
        { label: 'Victoire Paris', odd: 1.75 },
        { label: 'Plus de 2,5 buts', odd: 2 }
      ],
      betType: 'combined'
    }),
    'Combiné : 2 sélections · cote 3,50'
  );
});
test('le partage décrit chaque pari quand le mode simple contient plusieurs sélections', () => {
  assert.equal(
    shareSummary({
      items: [
        { label: 'Victoire Paris', odd: 1.75 },
        { label: 'Match nul', odd: 3.2 }
      ],
      betType: 'single'
    }),
    '2 paris simples : Victoire Paris · cote 1,75 ; Match nul · cote 3,20'
  );
});
