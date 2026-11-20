import { gaugeArc, vizCurve } from '../core/design-viz.js';
import { decimal } from '../core/number-format.js';
import { metricHelp } from '../matches/metric-help.js?v=bet194';
// BET-135 : lecture visuelle du bilan public, à partir du même échantillon que les indicateurs.
export function trajectoryOf(items) {
  const days = new Map();
  for (const item of items
    .slice()
    .sort(
      (a, b) =>
        String(a.date).localeCompare(String(b.date)) ||
        String(a.id ?? '').localeCompare(String(b.id ?? ''))
    )) {
    const delta = item.status === 'won' ? Number(item.odd) * 10 - 10 : -10;
    const day = days.get(item.date) ?? { date: item.date, profit: 0, wins: 0, total: 0 };
    day.profit += delta;
    day.wins += item.status === 'won' ? 1 : 0;
    day.total++;
    days.set(item.date, day);
  }
  let cumulative = 0;
  return [...days.values()].map((day) => ({
    ...day,
    profit: Math.round(day.profit * 100) / 100,
    cumulative: Math.round((cumulative += day.profit) * 100) / 100
  }));
}
export function renderPredictionShowcase(
  report,
  { html, money, resultFilter = 'all', period = 'all' } = {}
) {
  const { items, won, profit, roi } = report,
    total = items.length,
    rate = total ? Math.round((won.length / total) * 100) : 0,
    lost = total - won.length;
  const ordered = items
      .slice()
      .sort(
        (a, b) =>
          String(a.date).localeCompare(String(b.date)) ||
          String(a.id ?? '').localeCompare(String(b.id ?? ''))
      ),
    recent = ordered.slice(-20),
    recentWins = recent.filter((item) => item.status === 'won').length;
  const label =
      period === 'all'
        ? 'Depuis le début'
        : period === 'yesterday'
          ? 'Hier'
          : `${Number(period)} derniers jours`,
    filtered = resultFilter !== 'all',
    signed = (value) => `${value > 0 ? '+' : ''}${money(value)}`;
  const days = trajectoryOf(items),
    dateLabel = (value) =>
      new Date(value + 'T12:00:00Z').toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        timeZone: 'Europe/Paris'
      });
  const min = Math.min(0, ...days.map((day) => day.cumulative)),
    max = Math.max(0, ...days.map((day) => day.cumulative)),
    range = max - min || 1,
    y = (value) => 190 - ((value - min) / range) * 150;
  const points = [
      { x: 36, y: y(0) },
      ...days.map((day, index) => ({
        x: 36 + ((index + 1) / days.length) * 648,
        y: y(day.cumulative),
        day
      }))
    ],
    path = vizCurve(
      points.map(({ x, y }) => [x, y]),
      {
        baseline: 210,
        id: 'model-curve-fill',
        color: profit < 0 ? 'var(--danger)' : 'var(--accent)'
      }
    );
  const chart = days.length
    ? `<svg class="model-curve" viewBox="0 0 720 240" role="img" aria-labelledby="model-curve-title model-curve-desc"><title id="model-curve-title">Évolution du profit simulé</title><desc id="model-curve-desc">${html(label)} : ${total} pronostics réglés, ${html(signed(profit))} de profit simulé. Détail par journée disponible sous le graphique.</desc>${[min, (min + max) / 2, max].map((value) => `<line x1="36" x2="684" y1="${y(value)}" y2="${y(value)}" class="model-grid-line"/>`).join('')}<line x1="36" x2="684" y1="${y(0)}" y2="${y(0)}" class="model-zero"/>${path}${points
        .slice(1)
        .map(
          (point) =>
            `<circle cx="${point.x}" cy="${point.y}" r="10" class="viz-hit" data-viz-value="${html(`${dateLabel(point.day.date)} : ${signed(point.day.cumulative)} cumulés · ${point.day.wins}/${point.day.total} gagnés`)}"/>`
        )
        .join(
          ''
        )}<text x="36" y="229">${html(dateLabel(days[0].date))}</text><text x="684" y="229" text-anchor="end">${html(dateLabel(days.at(-1).date))}</text><text x="684" y="25" text-anchor="end">${html(signed(max))} · sommet de la période</text></svg>`
    : '<p class="model-chart-empty">La courbe se dessinera au fil des résultats.<br>Essayez une autre période ou une autre compétition.</p>';
  return `${filtered ? '<p class="model-filter-alert" role="status">Vue filtrée par résultat : ces chiffres ne représentent pas la performance globale. Choisissez « Tous » pour comparer les gains et les pertes.</p>' : ''}<details class="section-details model-showcase"><summary>Voir la courbe et les résultats récents</summary><div class="model-spotlight"><div class="model-success"><div class="model-ring gauge-face${rate < 50 && total ? ' gauge-low' : ''}${rate === 0 ? ' gauge-zero' : ''}">${gaugeArc(rate, 'model-gauge')}<div class="gauge-reading"><small>${filtered ? 'RÉUSSITE DE LA SÉLECTION FILTRÉE' : 'TAUX DE RÉUSSITE'}</small><strong>${total ? rate : '-'}<small>${total ? '%' : ''}</small></strong><span>${total ? 'de pronostics gagnés' : 'en attente de résultats'}</span></div></div><div class="model-result-counts"><span><i class="result-key won"></i><b>${won.length}</b> gagnés</span><span><i class="result-key lost"></i><b>${lost}</b> perdus</span></div><p>${total ? `${total} résultats réglés dans cet échantillon.` : 'Aucun résultat pour les filtres choisis.'} ${total > 0 && total < 30 ? 'Échantillon encore limité.' : ''}</p></div></div><div class="model-evidence-grid"><article class="model-trajectory card ${profit < 0 ? 'is-negative' : ''}"><header><div><p class="eyebrow">LA TRAJECTOIRE</p><h3>Le résultat, dans la durée.</h3></div><span class="model-profit-tag">${total ? html(signed(profit)) : '-'}<small>profit simulé</small></span></header>${chart}<div class="model-chart-caption"><span>Départ à 0 € de profit · cumul par journée</span><span>${roi == null ? 'ROI non disponible' : `ROI ${roi >= 0 ? '+' : ''}${decimal(roi, 1)} %`}</span>${metricHelp('roi')}</div><details class="model-curve-data"><summary>Voir les chiffres par journée</summary>${days.length ? `<div class="model-data-scroll"><table><caption>Échantillon sélectionné · mise fictive de 10 € par pronostic</caption><thead><tr><th>Date</th><th>Gagnés / réglés</th><th>Profit du jour</th><th>Cumul</th></tr></thead><tbody>${days.map((day) => `<tr><th scope="row">${html(day.date)}</th><td>${day.wins} / ${day.total}</td><td>${html(signed(day.profit))}</td><td>${html(signed(day.cumulative))}</td></tr>`).join('')}</tbody></table></div>` : '<p>Aucun résultat.</p>'}</details></article><article class="model-form card"><p class="eyebrow">LA FORME RÉCENTE</p><h3>Chaque résultat compte.</h3><p>Les ${recent.length || 20} derniers pronostics réglés de la sélection, du plus ancien au plus récent.</p><div class="model-form-grid">${recent.map((item) => `<span class="model-form-result ${item.status}" tabindex="0" role="img" aria-label="${html(`${dateLabel(item.date)} · ${item.match} · ${item.status === 'won' ? 'gagné' : 'perdu'}`)}"><span aria-hidden="true">${item.status === 'won' ? '✓' : '×'}</span><span class="model-result-tip">${html(item.match)}<small>${html(dateLabel(item.date))} · ${item.status === 'won' ? 'Gagné' : 'Perdu'} · cote ${decimal(Number(item.odd), 2)}</small></span></span>`).join('') || '<p class="muted">Pas encore de résultat sur cette sélection.</p>'}</div><div class="model-form-summary"><strong>${recent.length ? `${recentWins}<span> / ${recent.length}</span>` : '-'}</strong><span>gagnés dans<br>cette séquence</span></div><a class="text-button" href="#model-journal">Voir les matchs et les scores <span aria-hidden="true">→</span></a></article></div></details>`;
}
