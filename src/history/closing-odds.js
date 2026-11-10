import { quoteAvailable } from '../model/quote-policy.js';
// Première recommandation publiée, puis dernière observation du même marché avant le coup d'envoi.
export function trackClosingOdds(match, previous, now = Date.now()) {
  const old = previous?.quoteTracking;
  const kickoff = Date.parse(match.kickoff);
  if (!Number.isFinite(kickoff) || kickoff <= now || match.completed || match.voided)
    return old ?? null;
  const key = old?.key ?? match.suggestedPick?.key;
  if (!key || !quoteAvailable(match, key) || match.oddsCachedMarkets?.includes(key))
    return old ?? null;
  const quote = { odd: Number(match.odds[key]), observedAt: new Date(now).toISOString() };
  if (!old) return { version: 1, key, kickoff: match.kickoff, prediction: quote, last: quote };
  if (Date.parse(old.last.observedAt) >= now) return old;
  return { ...old, kickoff: match.kickoff, last: quote };
}
export function closingValue(tracking, key, kickoff) {
  if (tracking?.version !== 1 || tracking.key !== key) return null;
  const { prediction: p, last: c } = tracking;
  const start = Date.parse(kickoff),
    a = Date.parse(p?.observedAt),
    b = Date.parse(c?.observedAt);
  if (
    ![start, a, b, p?.odd, c?.odd].every(Number.isFinite) ||
    a >= b ||
    b >= start ||
    p.odd <= 1 ||
    c.odd <= 1
  )
    return null;
  return {
    percent: (p.odd / c.odd - 1) * 100,
    predictionOdd: p.odd,
    closingOdd: c.odd,
    predictedAt: p.observedAt,
    observedAt: c.observedAt,
    hoursBeforeKickoff: (start - b) / 3600000
  };
}
export function closingReport(items) {
  const values = items.map((i) => closingValue(i.quoteTracking, i.key, i.kickoff)).filter(Boolean);
  const beat = values.filter((v) => v.percent > 1e-9).length;
  return {
    total: items.length,
    covered: values.length,
    beat,
    tied: values.filter((v) => Math.abs(v.percent) <= 1e-9).length,
    rate: values.length ? (beat / values.length) * 100 : null
  };
}
export function closingMarkup(items) {
  const r = closingReport(items);
  return `<div><p class="eyebrow">QUALITÉ DU PRIX</p><h3>Cote à la première publication contre dernière cote observée</h3></div><p>${r.rate === null ? 'Pas encore de paire comparable.' : `${r.rate.toFixed(1).replace('.', ',')} % dépassent la dernière cote observée (${r.beat}/${r.covered}).`}</p><p class="archive-note">Couverture : ${r.covered}/${r.total} pronostics réglés. Même sélection, cotes réelles non mises en cache, au moins dix bookmakers. Collectes à 6 h et 18 h : ce prix peut précéder le match de plusieurs heures et ne constitue pas une clôture officielle. Les sélections modifiées et paires absentes sont exclues ; aucune reconstitution des anciens prix. Un meilleur prix ne garantit aucun gain.</p>`;
}
