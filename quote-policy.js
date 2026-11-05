import {extendedPriceAvailable} from './markets.js';
export const MIN_BOOKMAKERS=10;
// Par sélection, jamais le nombre global de bookmakers du match. Une identité ne compte qu'une fois.
export function selectionBookmakerCount(match,key){
 if(Array.isArray(match?.bookmakerOffers))return new Set(match.bookmakerOffers.filter(o=>Number.isFinite(Number(o[key]))&&Number(o[key])>1).map(o=>String(o.key??o.name??'').trim().toLowerCase()).filter(Boolean)).size;
 const count=match?.oddsBookmakerCounts?.[key];return Number.isSafeInteger(count)&&count>=0?count:0;
}
export function quoteAvailable(match,key){return !/^h1/.test(key)&&match?.realOddsMarkets?.includes(key)===true&&Number.isFinite(Number(match.odds?.[key]))&&Number(match.odds[key])>1&&selectionBookmakerCount(match,key)>=MIN_BOOKMAKERS&&extendedPriceAvailable(match,key)}
export function dailyQuoteAvailable(pick,match,key){return quoteAvailable(match,key)&&(Number(pick.bookmakerCounts?.[key])>=MIN_BOOKMAKERS||Number(pick.odds?.[key])===Number(match.odds?.[key]))}
