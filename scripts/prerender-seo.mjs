// BET-276 : HTML public généré au déploiement, sans appel réseau ni serveur permanent.
import { analyseMatch, parisDate } from '../src/model/model.js';
import { matchesWithBookmakers } from '../src/model/calendar-model.js';
const escape = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
export function prerenderMatches(data, now = Date.now()) {
  if (!Array.isArray(data.matches)) throw new Error('Calendrier public manquant');
  const day = parisDate(now),
    end = parisDate(now + 7 * 864e5);
  const matches = data.matches
    .filter((m) => !m.voided && m.date >= day && m.date <= end && matchesWithBookmakers([m]).length)
    .sort(
      (a, b) =>
        String(a.kickoff).localeCompare(String(b.kickoff)) ||
        String(a.id).localeCompare(String(b.id))
    )
    .slice(0, 60);
  const updated = Number.isFinite(Date.parse(data.generatedAt))
    ? `<p class="analysis-note">Calendrier public actualisé le <time datetime="${escape(data.generatedAt)}">${escape(new Date(data.generatedAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }))} (Paris)</time>. Les scores et analyses sont actualisés à l’ouverture du site.</p>`
    : '';
  return `<!-- BET-276 : aperçu HTML remplacé par le calendrier interactif -->${updated}${
    matches
      .map((m) => {
        const valid = [m.homeGoals, m.awayGoals].every(
            (n) => Number.isFinite(n) && n > 0 && n <= 10
          ),
          p = valid ? analyseMatch(m).probs : null,
          probs = p
            ? `<p>Probabilités du modèle : ${escape(m.home)} ${Math.round(p.home * 100)} % · Nul ${Math.round(p.draw * 100)} % · ${escape(m.away)} ${Math.round(p.away * 100)} %.</p>`
            : '';
        return `<article class="match-card card"><h3>${escape(m.home)} - ${escape(m.away)}</h3><p>${escape(m.league)} · ${escape(m.date)} · ${escape(m.time)} (Paris)</p>${m.completed ? `<p>Score final : ${escape(m.homeScore)} - ${escape(m.awayScore)}</p>` : probs}<p>Analyse football et paris virtuels · 18+ · Estimations sans garantie.</p></article>`;
      })
      .join('') ||
    '<p>Aucune rencontre publiée pour cette période. Consultez prochainement le calendrier.</p>'
  }`;
}
export function prerenderSeo(html, data, now = Date.now()) {
  const container = '<div id="match-list" class="match-list" aria-live="polite"></div>';
  if (!html.includes(container))
    throw new Error('Conteneur du calendrier introuvable pour le pré-rendu SEO');
  return html.replace(
    container,
    `<div id="match-list" class="match-list" aria-live="polite">${prerenderMatches(data, now)}</div>`
  );
}
