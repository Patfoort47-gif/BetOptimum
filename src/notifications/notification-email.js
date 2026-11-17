import { decimal } from '../core/number-format.js';
import { analyseMatch } from '../model/model.js';
// HTML et texte partagent la même sélection courte. Aucun envoi dans ce module.
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
function emailLayout(title, caption, sections, action, profile, headerMetric = null) {
  const copy = (s) =>
    `<p style="margin:10px 0;color:#526059;font-size:15px;line-height:1.7">${String(s)
      .split('\n')
      .map((line) => {
        const link = line.match(/^(Voir le match|Voir l’analyse) : (https:\/\/\S+)$/);
        return link
          ? `<a href="${esc(link[2])}" class="mail-button" style="display:inline-block;margin-top:8px;padding:13px 18px;background:#c8f03c;border-radius:10px;color:#14251b;font-weight:bold;text-decoration:none">${esc(link[1])} →</a>`
          : esc(line);
      })
      .join('<br>')}</p>`;
  const footer =
    'Paris virtuels · 18+ · Probabilités indicatives · Aucune garantie de gain. Aucun pari n’est placé depuis cet email.';
  const text = [
    caption,
    ...(headerMetric ? [headerMetric] : []),
    title,
    ...sections.map(
      (s) =>
        `${s.group ? s.group + '\n' : ''}${s.title}\n${s.odd ? `${s.label} · cote ${decimal(s.odd, 2)}\n` : ''}${s.badge ? s.badge + '\n' : ''}${s.body}`
    ),
    `${action.label} : ${action.url}`,
    `Gérer mes préférences et me désabonner (après connexion) : ${profile}`,
    footer
  ].join('\n\n');
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${esc(title)}</title><style>@media(prefers-color-scheme:dark){body{background:#111c16!important}.mail-shell{background:#19291f!important}.mail-card{background:#22372b!important}.mail-card h2,.mail-card p{color:#edf4e9!important}.mail-card a{color:#c8f03c!important}.mail-card a.mail-button{color:#14251b!important;background:#c8f03c!important}.mail-footer{background:#22372b!important;color:#d8e9c8!important}.mail-footer a{color:#c8f03c!important}}@media(max-width:480px){.mail-cell{padding-left:16px!important;padding-right:16px!important}h1{font-size:26px!important}}</style></head><body style="margin:0;background:#edf1eb;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding:24px 12px"><!--[if mso]><table role="presentation" width="580"><tr><td><![endif]--><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="mail-shell" style="max-width:580px;table-layout:fixed;overflow-wrap:anywhere;background:#fff;border-radius:24px;overflow:hidden"><tr><td style="padding:30px 24px;background:#14251b;border-top:5px solid #c8f03c"><p style="margin:0 0 26px;color:#c8f03c;font-size:17px;font-weight:bold;letter-spacing:2px">BETOPTIMUM</p><p style="color:#d8e9c8;font-size:11px;letter-spacing:1px">${esc(caption)}</p>${headerMetric ? `<p class="mail-metric" style="margin:16px 0;color:#c8f03c;font-size:20px;font-weight:bold">${esc(headerMetric)}</p>` : ''}<h1 style="margin:12px 0;color:#fff;font-size:30px;line-height:1.2">${esc(title)}</h1></td></tr>${sections.map((s) => `<tr><td class="mail-cell" style="padding:22px 24px 0">${s.group ? `<p style="font-size:12px;font-weight:bold;color:#526059;letter-spacing:1px">${esc(s.group)}</p>` : ''}<div class="mail-card" style="padding:20px;border:1px solid #dce6d7;border-left:4px solid ${s.tone === 'favorite' ? '#6c9135' : s.tone === 'hero' ? '#14251b' : '#c8f03c'};border-radius:14px;background:#f8faf5"><h2 style="margin:0;color:#192d20;font-size:18px;line-height:1.4">${esc(s.title)}</h2>${s.odd ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px"><tr><td style="color:#526059;font-size:14px;line-height:1.5;padding-right:12px;word-break:break-word">${esc(s.label)}<br><span style="font-size:11px;color:#526059">COTE CONSEILLÉE</span></td><td align="right" width="90" style="font-size:30px;font-weight:bold;color:#14251b;background:#c8f03c;border-radius:10px;padding:10px 6px">${decimal(s.odd, 2)}</td></tr></table>` : ''}${s.badge ? `<p><span class="mail-value" style="display:inline-block;background:#c8f03c;color:#14251b;border-radius:8px;padding:6px 10px;font-weight:bold;font-size:13px">${esc(s.badge)}</span></p>` : ''}${copy(s.body)}</div></td></tr>`).join('')}<tr><td style="padding:26px 24px 32px"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#c8f03c" style="border-radius:12px;text-align:center"><a href="${esc(action.url)}" style="display:inline-block;padding:16px 22px;color:#14251b;font-size:15px;font-weight:bold;text-decoration:none">${esc(action.label)} →</a></td></tr></table></td></tr><tr><td class="mail-footer mail-cell" style="padding:22px 24px;background:#f3f6f0;font-size:12px;line-height:1.7;color:#526059"><a href="${esc(profile)}" style="color:#3f6600">Gérer mes préférences et me désabonner</a><p>Après connexion : Mon profil &gt; Mes alertes.</p><p>${esc(footer)}</p></td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
  return { text, html };
}
function safeSite(siteUrl) {
  const site = new URL(siteUrl);
  if (site.protocol !== 'https:') throw new Error('SITE_CONFIG');
  return site;
}
export function briefingEmail(b, siteUrl) {
  const site = safeSite(siteUrl),
    href = (hash) => new URL(hash, site).href,
    profile = href('#profil'),
    clock = (iso) =>
      new Date(iso).toLocaleTimeString('fr-FR', {
        timeZone: 'Europe/Paris',
        hour: '2-digit',
        minute: '2-digit'
      });
  const title = b.hero
      ? `${b.hero.league} : ${b.hero.home} - ${b.hero.away} et les analyses du modèle`
      : 'Votre prochain rendez-vous foot se prépare',
    subject = `BetOptimum : ${title}`;
  const caption = b.demo ? 'MAQUETTE · DONNÉES FICTIVES' : `${b.date} · L’ESSENTIEL DU JOUR`,
    sections = [];
  const hrefMatch = (m) => href(`#match-${encodeURIComponent(m.id)}`);
  const analysis = (m) => {
    if (m.completed || Date.parse(m.kickoff) <= Date.parse(b.now))
      return m.completed
        ? 'Match terminé. Retrouvez le résultat sur la fiche du match.'
        : 'Match commencé : aucun nouveau conseil de pari.';
    if (!b.fresh)
      return 'Le rendez-vous à suivre : retrouvez les dernières informations et les compositions sur la fiche du match.';
    if (![m.homeGoals, m.awayGoals].every((n) => Number.isFinite(n) && n > 0 && n <= 10))
      return 'Le rendez-vous à suivre : comparez la forme des équipes et les compositions avant le coup d’envoi.';
    const p = analyseMatch(m).probs;
    if (!['home', 'draw', 'away'].every((k) => Number.isFinite(p[k]) && p[k] >= 0 && p[k] <= 1))
      return 'Découvrez les clés de cette affiche et les compositions sur le site.';
    return `Probabilités du modèle : ${m.home} ${Math.round(p.home * 100)} % · Nul ${Math.round(p.draw * 100)} % · ${m.away} ${Math.round(p.away * 100)} %.\nProbabilités estimées, aucune garantie de résultat.`;
  };
  const card = (m, pick, group, tone = 'pick', title = null) => ({
    title: title ?? `${m.home} - ${m.away}`,
    group,
    tone,
    label: pick?.label,
    odd: pick?.odd,
    badge:
      pick?.real && Number.isFinite(pick.value) && pick.value > 0
        ? pick.value < 0.0001
          ? 'Value < +0,01 %'
          : `Value +${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(pick.value * 100)} %`
        : null,
    body: `${m.league} · ${clock(m.kickoff)} (Paris)\n${pick ? 'Cote réelle · paris virtuels' : ''}\n${analysis(m)}\nVoir le match : ${hrefMatch(m)}`
  });
  const picks = b.fresh
    ? [...new Map(b.picks.map((p) => [p.match.id, p])).values()].slice(0, 3)
    : [];
  if (picks.length) {
    for (const [i, pick] of picks.entries()) {
      const isFavorite = b.favorites.some((m) => m.id === pick.match.id);
      sections.push(
        card(
          pick.match,
          pick,
          i === 0 ? 'Les meilleurs pronostics du jour' : null,
          isFavorite ? 'favorite' : 'pick',
          `${i + 1} · ${isFavorite ? '★ ' : ''}${pick.match.home} - ${pick.match.away}`
        )
      );
    }
  } else if (b.hero) {
    sections.push(card(b.hero, null, 'L’affiche du jour', 'hero'));
  } else {
    sections.push({
      title: b.fresh ? 'Une journée au calme' : 'Calendrier en cours d’actualisation',
      body: b.fresh
        ? 'Aucun match programmé aujourd’hui. Retrouvez les prochaines rencontres sur le site.'
        : 'Les données doivent être actualisées avant de préparer les analyses du jour.'
    });
  }
  if (!picks.length && b.hero)
    sections.push({
      title: 'Les clés de l’affiche',
      body: b.fresh
        ? 'Le modèle ne retient pas de pari aujourd’hui. Prenez le temps de comparer les forces en présence et de découvrir les compositions : l’analyse du match reste votre point de départ.'
        : 'Préparez la soirée avec le calendrier, les horaires et les compositions sur le site. Les analyses chiffrées reprendront après actualisation des données.'
    });
  const balance = Number.isFinite(b.bankroll)
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(b.bankroll)
    : null;
  const formatMoney = (n) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
  const yesterday = b.summary?.yesterday,
    tickets = yesterday?.tickets,
    model = yesterday?.model;
  const previous = yesterday
    ? `Bilan de la veille (${new Date(yesterday.date + 'T12:00:00Z').toLocaleDateString('fr-FR')}, Paris) :\n${tickets?.count ? `Vos tickets réglés : ${tickets.won} gagné(s), ${tickets.lost} perdu(s), ${tickets.voided} remboursé(s). Résultat net : ${tickets.profit == null ? 'données incomplètes' : formatMoney(tickets.profit)}.` : 'Aucun ticket personnel réglé hier.'}\n${model?.count ? `Pronostics des matchs d’hier : ${model.won} gagné(s) / ${model.count} terminé(s).` : 'Aucun pronostic terminé pour les matchs d’hier.'}`
    : 'Bilan de la veille non calculé.';
  sections.push({
    title: 'Mon suivi · Bilan de la veille',
    body: `${balance ? `Votre bankroll virtuelle actuelle : ${balance}.` : 'Retrouvez votre bankroll virtuelle dans votre espace personnel.'}\n${previous}`
  });
  const action = picks.length
    ? { label: 'Découvrir les conseils du jour', url: href('#conseils-du-jour') }
    : {
        label: b.hero ? 'Explorer le match du jour' : 'Explorer le calendrier',
        url: b.hero ? hrefMatch(b.hero) : href('#matches')
      };
  const score = b.summary?.metrics?.score;
  const metric = Number.isFinite(score)
    ? `Indice Global du jour : ${Math.round(score * 100)}/100`
    : 'Indice Global du jour : données insuffisantes';
  return { subject, ...emailLayout(title, caption, sections, action, profile, metric) };
}

export function alertEmail({ title, message, url, siteUrl, testing = false }) {
  const site = safeSite(siteUrl),
    target = new URL(url, site);
  if (target.origin !== site.origin) throw new Error('SITE_CONFIG');
  return emailLayout(
    title,
    testing ? 'TEST DE VOS ALERTES' : 'VOTRE ALERTE FOOT',
    [{ title: testing ? 'Votre canal est prêt' : 'Une piste à découvrir', body: message }],
    { label: testing ? 'Gérer mes alertes' : 'Voir l’analyse', url: target.href },
    new URL('#profil', site).href
  );
}
