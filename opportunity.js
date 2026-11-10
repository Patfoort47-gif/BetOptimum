// BET-271 : qualité des données, distincte de la probabilité de succès.
const clamp = (n) => Math.max(0, Math.min(1, n));
const cv = (values) => {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return mean
    ? Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length) / mean
    : 0;
};
export function marketGroup(key) {
  if (['home', 'draw', 'away'].includes(key)) return ['home', 'draw', 'away'];
  if (['btts', 'bttsNo'].includes(key)) return ['btts', 'bttsNo'];
  if (/^(over|under)(\d*)$/.test(key)) {
    const suffix = key.replace(/^(over|under)/, '');
    return ['over' + suffix, 'under' + suffix];
  }
  if (/^(home|away)(Over|Under)\d+$/.test(key))
    return [key.replace('Under', 'Over'), key.replace('Over', 'Under')];
  return null;
}
export function comparableOffers(match, keys) {
  const seen = new Set();
  return (match.bookmakerOffers ?? []).filter((o) => {
    const id = String(o.key ?? o.name ?? '')
        .trim()
        .toLowerCase(),
      dates = keys.map((k) => Date.parse(o[k + 'UpdatedAt']));
    if (
      !id ||
      seen.has(id) ||
      !keys.every((k) => match.realOddsMarkets?.includes(k) && Number.isFinite(o[k]) && o[k] > 1) ||
      !dates.every(Number.isFinite) ||
      Math.max(...dates) - Math.min(...dates) > 3600000 ||
      Math.max(...dates) > Date.parse(match.kickoff)
    )
      return false;
    seen.add(id);
    return true;
  });
}
export function fairMarket(match, key) {
  const keys = marketGroup(key);
  if (!keys) return null;
  const offers = comparableOffers(match, keys);
  if (!offers.length) return null;
  const probabilities = offers
    .map((o) => {
      const sum = keys.reduce((s, k) => s + 1 / o[k], 0);
      return sum >= 0.9 && sum <= 1.3 ? 1 / o[key] / sum : null;
    })
    .filter(Number.isFinite);
  return probabilities.length
    ? probabilities.reduce((a, b) => a + b, 0) / probabilities.length
    : null;
}
export function dataConfidence(match, key) {
  const sample = (stats) =>
      Number.isInteger(stats?.sample) && stats.sample >= 0 ? clamp(stats.sample / 20) : 0,
    competition = Number.isInteger(match.competitionSample)
      ? clamp(match.competitionSample / 100)
      : 0,
    volume = (sample(match.homeStats) + sample(match.awayStats) + competition) / 3,
    keys = marketGroup(key),
    offers = keys ? comparableOffers(match, keys) : [],
    consensus =
      offers.length >= 2
        ? clamp(1 - cv(offers.map((o) => o[key])) / 0.2) * clamp(offers.length / 10)
        : 0;
  const recent = (stats) =>
      (stats?.recent ?? [])
        .filter(
          (g) =>
            ['V', 'N', 'D'].includes(g.result) &&
            Number.isFinite(Date.parse(g.date)) &&
            Date.parse(g.date) < Date.parse(match.kickoff)
        )
        .slice(0, 5),
    home = recent(match.homeStats),
    away = recent(match.awayStats),
    formValues = (games) => games.map((g) => ({ V: 1, N: 0.5, D: 0 })[g.result]),
    stability = (values) =>
      values.length
        ? clamp(
            1 -
              2 *
                Math.sqrt(
                  values.reduce(
                    (s, v) => s + (v - values.reduce((a, b) => a + b, 0) / values.length) ** 2,
                    0
                  ) / values.length
                )
          )
        : 0,
    form =
      (((stability(formValues(home)) + stability(formValues(away))) / 2) *
        Math.min(home.length, away.length)) /
      5;
  // Aucune source xG observée intégrée : la moitié xG de ce facteur reste à zéro.
  const recentScore = form * 0.5,
    score = Math.round(100 * (0.3 * volume + 0.3 * consensus + 0.4 * recentScore));
  return {
    score,
    volume: Math.round(volume * 100),
    consensus: Math.round(consensus * 100),
    recent: Math.round(recentScore * 100),
    xgAvailable: false,
    competitionAvailable: Number.isInteger(match.competitionSample),
    bookmakers: offers.length,
    coverage: Math.round(
      100 *
        (0.1 * (match.homeStats?.sample > 0) +
          0.1 * (match.awayStats?.sample > 0) +
          0.1 * Number.isInteger(match.competitionSample) +
          0.3 * (offers.length >= 2) +
          0.2 * (home.length === 5 && away.length === 5))
    )
  };
}
export function evTone(value) {
  return !Number.isFinite(value) || (value >= -0.03 - 1e-12 && value <= 0.03 + 1e-12)
    ? 'neutral'
    : value > 0.03
      ? 'positive'
      : 'negative';
}
export function opportunityMarkup(analysis, pick) {
  const market = analysis.markets.find((m) => m.key === pick?.key),
    quality = dataConfidenceFrom(analysis, pick);
  return `<div class="opportunity"><span class="ev-${evTone(market?.value)}">EV nette : ${Number.isFinite(market?.value) ? `${market.value >= 0 ? '+' : ''}${(market.value * 100).toFixed(1)} %` : 'indisponible'}</span><span>Écart au marché sans marge : ${Number.isFinite(market?.marketDelta) ? `${market.marketDelta >= 0 ? '+' : ''}${(market.marketDelta * 100).toFixed(1)} points` : 'indisponible'}</span><label>Qualité des données : ${quality?.score ?? 0}/100 <meter min="0" max="100" value="${quality?.score ?? 0}">${quality?.score ?? 0}/100</meter></label><small>Qualité des données, pas une probabilité de gain. xG observés indisponibles.</small></div>`;
}
function dataConfidenceFrom(analysis, pick) {
  return analysis.markets.find((m) => m.key === pick?.key)?.dataConfidence;
}
