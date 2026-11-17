import { escapeHtml } from '../core/html.js';
import { decimal } from '../core/number-format.js';
// Cote d'équilibre du modèle ; DNB tient compte du remboursement sur nul.
export function fairOdd(market) {
  const p = market?.probability,
    refund = market?.refundProbability ?? 0;
  if (
    !Number.isFinite(p) ||
    p <= 0 ||
    p > 1 ||
    !Number.isFinite(refund) ||
    refund < 0 ||
    p + refund > 1 + 1e-12
  )
    return null;
  return (1 - refund) / p;
}
export function fairOddsMarkup(analysis, pick) {
  const keys = new Set(['home', 'draw', 'away', pick?.key]);
  const rows = analysis.markets.filter(
    (m) => keys.has(m.key) && m.real && m.available && fairOdd(m) != null
  );
  if (!rows.length)
    return '<p class="analysis-note">Comparaison des cotes indisponible : modèle ou cotes réelles manquants.</p>';
  return `<div class="fair-odds"><h3>Cote réelle et cote juste</h3><table><caption>Cote juste calculée par le modèle, sans marge et sans garantie.</caption><thead><tr><th scope="col">Sélection</th><th scope="col">Cote réelle</th><th scope="col">Cote juste</th></tr></thead><tbody>${rows.map((m) => `<tr><th scope="row">${escapeHtml(m.label)}</th><td>${decimal(m.odd, 2)}</td><td>${decimal(fairOdd(m), 2)}</td></tr>`).join('')}</tbody></table></div>`;
}
