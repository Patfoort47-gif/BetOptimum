// Filtres de présentation : aucune modification du calcul des marchés.
export function quickMatchFilter(match,filters,today,markets){if(filters.today&&match.date!==today)return false;if(!filters.odds&&!filters.value)return true;return markets.some(m=>m.available&&(!filters.odds||m.odd>1.8)&&(!filters.value||(m.real&&m.value>.03)))}
