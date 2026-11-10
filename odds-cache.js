import {marketKeys,isExtendedMarket} from './markets.js';
export const SECONDARY_ODDS_WINDOW_HOURS = 7 * 24;
export const ODDS_REFRESH_HOURS = [6, 18];

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

export function mergeCachedOffers(currentOffers = [], previousOffers = [], markets = marketKeys(Object.assign({},...currentOffers,...previousOffers))) {
  const sameBook = (a, b) => a.key && b.key ? a.key === b.key : a.name === b.name;
  const offers = [];
  for (const current of currentOffers) {
    const existing = offers.find(item => sameBook(item, current));
    if (!existing) { offers.push({ ...current }); continue; }
    for (const market of markets) if (Number.isFinite(Number(current[market])) && Number(current[market]) > 1) {
      existing[market] = current[market];
      existing[`${market}UpdatedAt`] = current[`${market}UpdatedAt`] ?? null;
      existing[`${market}Source`] = current[`${market}Source`] ?? null;
      delete existing[`${market}Cached`];
    }
  }
  for (const previous of previousOffers) {
    let offer = offers.find(item => sameBook(item, previous));
    for (const market of markets) {
      if (isExtendedMarket(market)) continue;
      const cached = Number(previous[market]);
      if (!Number.isFinite(cached) || cached <= 1 || Number(offer?.[market]) > 1) continue;
      if (!offer) { offer = { name: previous.name, ...(previous.key ? { key: previous.key } : {}) }; offers.push(offer); }
      offer[market] = cached;
      offer[`${market}Cached`] = true;
      offer[`${market}Source`] = previous[`${market}Source`] ?? null;
      offer[`${market}UpdatedAt`] = previous[`${market}UpdatedAt`] ?? null;
    }
  }
  return offers;
}

export function summarizeOffers(offers = [], markets = marketKeys(Object.assign({},...offers))) {
  const prices = market => offers.map(offer => Number(offer[market])).filter(price => Number.isFinite(price) && price > 1);
  const counts = Object.fromEntries(markets.map(market => [market, prices(market).length]));
  const averages = Object.fromEntries(markets.map(market => { const values=prices(market); return [market,values.length?Number((values.reduce((sum,price)=>sum+price,0)/values.length).toFixed(2)):null] }));
  const cachedMarkets = markets.filter(market => counts[market] > 0 && offers.filter(offer => Number(offer[market]) > 1).every(offer => offer[`${market}Cached`]));
  return { counts, averages, cachedMarkets };
}

// Read every block: complementary responses can contain several blocks of the same market.
export function bookmakerOffer(bookmaker, home, away, sameTeam) {
  const offer = { key: bookmaker.key, name: bookmaker.title };
  for (const market of bookmaker.markets ?? []) for (const outcome of market.outcomes ?? []) {
    let key;
    if (market.key === 'h2h') key = sameTeam(outcome.name, home) ? 'home' : sameTeam(outcome.name, away) ? 'away' : outcome.name === 'Draw' ? 'draw' : null;
    else if (market.key === 'btts' && /^(yes|oui)$/i.test(outcome.name)) key = 'btts';
    else if (market.key === 'totals' && /^over$/i.test(outcome.name) && Number(outcome.point) === 2.5) key = 'over';
    const price = Number(outcome.price);
    if (!key || !Number.isFinite(price) || price <= 1) continue;
    const updatedAt = market.last_update ?? bookmaker.last_update ?? null;
    if (offer[key] && Date.parse(offer[`${key}UpdatedAt`]) > Date.parse(updatedAt)) continue;
    offer[key] = price;
    offer[`${key}UpdatedAt`] = updatedAt;
  }
  return offer;
}
