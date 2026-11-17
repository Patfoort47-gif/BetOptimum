import test from 'node:test';
import assert from 'node:assert/strict';
import { teamLogoSources, teamLogoMarkup } from '../src/matches/team-logos.js';
import { imageFallback } from '../src/core/image-fallback.js';
const club = 'https://a.espncdn.com/i/teamlogos/soccer/500/160.png?h=96&w=96';
const flag = 'https://a.espncdn.com/i/teamlogos/countries/500/fra.png?h=96&w=96';
test('BET-359 : blason officiel prioritaire, identifiant club et drapeau national', () => {
  assert.deepEqual(teamLogoSources({ homeLogo: club, homeFlag: flag }, 'home'), {
    logo: club,
    flag
  });
  assert.equal(teamLogoSources({ homeId: '160' }, 'home').logo, club);
  assert.deepEqual(teamLogoSources({ homeLogo: flag }, 'home'), { logo: null, flag });
  assert.equal(teamLogoSources({ homeId: '478', league: 'Ligue des nations' }, 'home').logo, null);
  assert.equal(
    teamLogoSources({ homeId: '../evil', homeLogo: 'javascript:alert(1)' }, 'home').logo,
    null
  );
  assert.match(
    teamLogoMarkup({ home: 'Paris Saint-Germain', homeLogo: club }, 'home'),
    /loading="lazy"/
  );
  assert.match(teamLogoMarkup({ home: '<Club inconnu>' }, 'home'), /no-logo/);
  assert.doesNotMatch(teamLogoMarkup({ home: '<Club inconnu>' }, 'home'), /<Club/);
});
test('BET-359 : erreur de blason puis de drapeau mène aux initiales sans boucle', () => {
  let removed = 0,
    initial = false;
  const image = {
    src: club,
    dataset: { imageFallback: 'logo', logoFallback: flag },
    parentNode: {
      classList: {
        add: (c) => {
          initial = c === 'no-logo';
        }
      }
    },
    remove: () => removed++
  };
  imageFallback(image);
  assert.equal(image.src, flag);
  assert.equal(removed, 0);
  imageFallback(image);
  assert.equal(removed, 1);
  assert.equal(initial, true);
});
