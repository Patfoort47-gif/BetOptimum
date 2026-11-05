import {quoteAvailable} from './quote-policy.js';
export function spotlightMarkets(match, markets, renderCard) {
  const groups = [['Résultat', ['home','draw','away']], ['Buts', ['over','under','over_2_5','under_2_5']]];
  const selected = new Set();
  const markup = groups.map(([label, keys]) => {
    const items = markets.filter(m => keys.includes(m.key) || (label === 'Buts' && m.family === 'Buts' && !m.key.startsWith('h1_'))).filter(m => quoteAvailable(match, m.key));
    items.forEach(m => selected.add(m.key));
    return `<section class="spotlight-market-group" aria-label="Cotes ${label}"><h3>${label}</h3>${items.length ? `<div class="markets">${items.map(renderCard).join('')}</div>` : '<p class="bookmaker-unavailable">Cotes indisponibles pour ce marché.</p>'}</section>`;
  }).join('');
  return {markup, keys: selected};
}
