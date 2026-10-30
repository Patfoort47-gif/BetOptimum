export const SECONDARY_ODDS_WINDOW_HOURS = 48;
export const ODDS_REFRESH_HOURS = [7, 14, 19];

export function nextOddsRefresh(hours = ODDS_REFRESH_HOURS, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('fr-FR', { timeZone:'Europe/Paris', hour:'2-digit', minute:'2-digit', hour12:false }).formatToParts(now).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
  const next = hours.find(hour => hour * 60 > parts.hour * 60 + parts.minute);
  return { hour: next ?? hours[0], tomorrow: next == null };
}

export function isInSecondaryOddsWindow(match, now = Date.now()) {
  const kickoff = new Date(match?.kickoff).getTime();
  return !match?.completed && Number.isFinite(kickoff) && kickoff >= now && kickoff <= now + SECONDARY_ODDS_WINDOW_HOURS * 3600000;
}

export function mergeCachedSecondaryOffers(currentOffers = [], previousOffers = []) {
  return mergeCachedOffers(currentOffers, previousOffers, ['over', 'btts']);
}

export function mergeCachedOffers(currentOffers = [], previousOffers = [], markets = ['home', 'draw', 'away', 'over', 'btts']) {
  const offers = currentOffers.map(offer => ({ ...offer }));
  for (const previous of previousOffers) {
    let offer = offers.find(item => item.name === previous.name);
    for (const market of markets) {
      const cached = Number(previous[market]);
      if (!Number.isFinite(cached) || cached <= 1 || Number(offer?.[market]) > 1) continue;
      if (!offer) { offer = { name: previous.name }; offers.push(offer); }
      offer[market] = cached;
      offer[`${market}Cached`] = true;
      offer[`${market}UpdatedAt`] = previous[`${market}UpdatedAt`] ?? null;
    }
  }
  return offers;
}

export function summarizeOffers(offers = [], markets = ['home', 'draw', 'away', 'over', 'btts']) {
  const prices = market => offers.map(offer => Number(offer[market])).filter(price => Number.isFinite(price) && price > 1);
  const counts = Object.fromEntries(markets.map(market => [market, prices(market).length]));
  const averages = Object.fromEntries(markets.map(market => { const values=prices(market); return [market,values.length?Number((values.reduce((sum,price)=>sum+price,0)/values.length).toFixed(2)):null] }));
  const cachedMarkets = markets.filter(market => counts[market] > 0 && offers.filter(offer => Number(offer[market]) > 1).every(offer => offer[`${market}Cached`]));
  return { counts, averages, cachedMarkets };
}
