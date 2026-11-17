import test from 'node:test';
import assert from 'node:assert/strict';
import { stadiumFor, stadiumMarkup, venueFromCompetition } from '../src/matches/stadiums.js';
const photo = {
  venueId: '42',
  name: 'Stade test',
  image: 'stadiums/test.webp',
  author: 'Auteur',
  source: 'https://example.org/source',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/'
};
const catalog = { 160: photo, 176: { ...photo, venueId: '43', image: 'stadiums/other.webp' } };
test('stade associé seulement par identifiant stable et terrain neutre exclu', () => {
  assert.equal(stadiumFor({ home: 'Paris Saint-Germain' }, catalog), null);
  assert.equal(stadiumFor({ homeId: 160 }, catalog).confirmed, false);
  assert.equal(stadiumFor({ homeId: '160', neutralSite: true }, catalog), null);
  assert.equal(
    stadiumFor({ homeId: '160', neutralSite: true, venue: { id: 42 } }, catalog).confirmed,
    true
  );
  assert.equal(stadiumFor({ homeId: '999' }, catalog), null);
});
test('lieu explicite prioritaire, stade temporaire inconnu sans photo trompeuse', () => {
  assert.equal(
    stadiumFor({ homeId: 160, venue: { id: 43 } }, catalog).image,
    'stadiums/other.webp'
  );
  assert.equal(stadiumFor({ homeId: 160, venue: { id: 'unknown' } }, catalog), null);
  assert.equal(stadiumFor({ homeId: 160, venue: { id: 42 } }, catalog).confirmed, true);
});
test('photo locale documentée, chargement différé et attribution échappée sans message dans la carte', () => {
  assert.doesNotMatch(
    stadiumMarkup({ homeId: 160 }, { 160: { ...photo, image: 'https://example.org/photo.webp' } }),
    /class="match-stadium-photo"/
  );
  assert.doesNotMatch(
    stadiumMarkup({ homeId: 160 }, { 160: { ...photo, author: '' } }),
    /class="match-stadium-photo"/
  );
  const markup = stadiumMarkup({ homeId: 160, home: '<Club>' }, catalog);
  assert.match(markup, /loading="lazy"/);
  assert.match(markup, /width="960" height="540"/);
  assert.match(markup, /lieu du match non confirmé/);
  assert.match(markup, /CC BY 4.0/);
  assert.match(markup, /Crédit photo/);
  assert.doesNotMatch(markup, />Photo du stade</);
});
test('pipeline conserve l’identifiant du stade et le terrain neutre', () => {
  assert.deepEqual(
    venueFromCompetition({ venue: { id: 42, fullName: 'Stade' }, neutralSite: true }),
    { neutralSite: true, venue: { id: '42', name: 'Stade' } }
  );
  assert.deepEqual(venueFromCompetition({}), { neutralSite: false, venue: null });
});

test('stade sans photo : photo d’ambiance locale clairement indiquée', () => {
  const markup = stadiumMarkup(
    { homeId: 'inconnu', venue: { id: 'inconnu', name: 'Stade <inconnu>' } },
    {}
  );
  assert.match(markup, /default-stadium\.webp/);
  assert.match(markup, /Photo d’ambiance/);
  assert.match(markup, /ne représente pas nécessairement le lieu du match/);
  assert.doesNotMatch(markup, /class="match-stadium-photo"/);
});

test('BET-358 : photo d’ambiance WebP locale inférieure à 40 Ko', async () => {
  const { stat, readFile } = await import('node:fs/promises');
  const path = new URL('../stadiums/default-stadium.webp', import.meta.url);
  assert.ok((await stat(path)).size < 40000);
  const bytes = await readFile(path);
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
});
