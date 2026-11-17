import { safeLogo, logoMarkup } from '../core/logos.js';
const nationalLeagues = new Set([
  'Ligue des nations',
  'Qualifications Coupe du monde',
  'Coupe du monde',
  'Euro',
  'Copa América',
  'CAN',
  'Matchs amicaux internationaux'
]);
export function teamLogoSources(match, side) {
  const supplied = safeLogo(match[side + 'Logo']);
  const isFlag = supplied?.includes('/teamlogos/countries/');
  const flag = safeLogo(match[side + 'Flag']) ?? (isFlag ? supplied : null);
  const national = Boolean(flag) || nationalLeagues.has(match.league);
  const id = String(match[side + 'Id'] ?? '');
  // Pas d’appel API par carte : URL ESPN issue de la collecte ou identifiant du club.
  const logo =
    (isFlag ? null : supplied) ??
    (!national && /^\d+$/.test(id)
      ? `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png?h=96&w=96`
      : null);
  return { logo, flag };
}
export function teamLogoMarkup(match, side) {
  const { logo, flag } = teamLogoSources(match, side);
  return logoMarkup('crest', logo ?? flag, match[side], logo ? flag : null);
}
