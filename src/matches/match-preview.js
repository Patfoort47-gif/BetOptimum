import { decimal } from '../core/number-format.js';
import { escapeHtml } from '../core/html.js';
export function buildMatchPreview(match, now = Date.now()) {
  if (
    match.completed ||
    match.voided ||
    !Number.isFinite(Date.parse(match.kickoff)) ||
    Date.parse(match.kickoff) <= now
  )
    return null;
  const home = match.homeStats,
    away = match.awayStats,
    pick = match.suggestedPick;
  const observed = [home, away].every((s) => s?.sample >= 2 && Number.isFinite(s.avgScored));
  const first = observed
    ? `${match.home} : ${decimal(home.avgScored, 1)} but(s)/match sur ${home.sample} matchs ; ${match.away} : ${decimal(away.avgScored, 1)} sur ${away.sample}.`
    : Number.isFinite(match.homeGoals) && Number.isFinite(match.awayGoals)
      ? `Buts estimés : ${decimal(match.homeGoals, 1)} pour ${match.home}, ${decimal(match.awayGoals, 1)} pour ${match.away}.`
      : 'Les statistiques récentes sont insuffisantes pour expliquer ce match.';
  const context = match.knockout ? 'Élimination directe. ' : '';
  const second =
    context +
    (pick?.key && Number.isFinite(pick.probability)
      ? `${pick.label} : ${Math.round(pick.probability * 100)} % estimés. Aucune garantie.`
      : 'Pas de sélection admissible actuellement. Estimation, aucune garantie.');
  return {
    version: 1,
    generatedAt: new Date(now).toISOString(),
    source: observed ? 'forme observée + modèle' : 'modèle',
    costEur: 0,
    lines: [first, second]
  };
}
export function matchPreviewMarkup(match) {
  const preview = match.preview;
  if (preview?.version !== 1 || !Array.isArray(preview.lines) || preview.lines.length !== 2)
    return '';
  return `<section class="match-explanation" aria-label="Pourquoi ce pronostic ?"><small>POURQUOI CE PRONO ?</small>${preview.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}</section>`;
}
