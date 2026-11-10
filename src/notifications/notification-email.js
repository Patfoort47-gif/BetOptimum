import { analyseMatch } from '../model/model.js';
// HTML et texte partagent la même sélection courte. Aucun envoi dans ce module.
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
function emailLayout(title, caption, sections, action, profile) {
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
    title,
    ...sections.map(
      (s) =>
        `${s.group ? s.group + '\n' : ''}${s.title}\n${s.odd ? `${s.label} · cote ${Number(s.odd).toFixed(2)}\n` : ''}${s.body}`
    ),
    `${action.label} : ${action.url}`,
    `Gérer mes préférences et me désabonner (après connexion) : ${profile}`,
    footer
  ].join('\n\n');
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${esc(title)}</title><style>@media(prefers-color-scheme:dark){body{background:#111c16!important}.mail-shell{background:#19291f!important}.mail-card{background:#22372b!important}.mail-card h2,.mail-card p{color:#edf4e9!important}.mail-card a{color:#c8f03c!important}.mail-card a.mail-button{color:#14251b!important;background:#c8f03c!important}.mail-footer{background:#22372b!important;color:#d8e9c8!important}.mail-footer a{color:#c8f03c!important}}@media(max-width:480px){.mail-cell{padding-left:16px!important;padding-right:16px!important}h1{font-size:26px!important}}</style></head><body style="margin:0;background:#edf1eb;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding:24px 12px"><!--[if mso]><table role="presentation" width="580"><tr><td><![endif]--><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="mail-shell" style="max-width:580px;table-layout:fixed;overflow-wrap:anywhere;background:#fff;border-radius:24px;overflow:hidden"><tr><td style="padding:30px 24px;background:#14251b;border-top:5px solid #c8f03c"><p style="margin:0 0 26px;color:#c8f03c;font-size:17px;font-weight:bold;letter-spacing:2px">BETOPTIMUM</p><p style="color:#d8e9c8;font-size:11px;letter-spacing:1px">${esc(caption)}</p><h1 style="margin:12px 0;color:#fff;font-size:30px;line-height:1.2">${esc(title)}</h1></td></tr>${sections.map((s) => `<tr><td class="mail-cell" style="padding:22px 24px 0">${s.group ? `<p style="font-size:12px;font-weight:bold;color:#526059;letter-spacing:1px">${esc(s.group)}</p>` : ''}<div class="mail-card" style="padding:20px;border:1px solid #dce6d7;border-left:4px solid ${s.tone === 'favorite' ? '#6c9135' : s.tone === 'hero' ? '#14251b' : '#c8f03c'};border-radius:14px;background:#f8faf5"><h2 style="margin:0;color:#192d20;font-size:18px;line-height:1.4">${esc(s.title)}</h2>${s.odd ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px"><tr><td style="color:#526059;font-size:14px;line-height:1.5;padding-right:12px;word-break:break-word">${esc(s.label)}<br><span style="font-size:11px;color:#526059">COTE CONSEILLÉE</span></td><td align="right" width="90" style="font-size:30px;font-weight:bold;color:#14251b;background:#c8f03c;border-radius:10px;padding:10px 6px">${Number(s.odd).toFixed(2)}</td></tr></table>` : ''}${copy(s.body)}</div></td></tr>`).join('')}<tr><td style="padding:26px 24px 32px"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#c8f03c" style="border-radius:12px;text-align:center"><a href="${esc(action.url)}" style="display:inline-block;padding:16px 22px;color:#14251b;font-size:15px;font-weight:bold;text-decoration:none">${esc(action.label)} →</a></td></tr></table></td></tr><tr><td class="mail-footer mail-cell" style="padding:22px 24px;background:#f3f6f0;font-size:12px;line-height:1.7;color:#526059"><a href="${esc(profile)}" style="color:#3f6600">Gérer mes préférences et me désabonner</a><p>Après connexion : Mon profil &gt; Mes alertes.</p><p>${esc(footer)}</p></td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
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
        timeZone: b.timezone,
        hour: '2-digit',
        minute: '2-digit'
      });
  const title = b.hero
      ? `${b.hero.league} : notre analyse pour ${b.hero.home} - ${b.hero.away}`
      : 'Votre prochain rendez-vous foot se prépare',
    subject = `BetOptimum : ${title}`;
  const caption = b.demo ? 'MAQUETTE · DONNÉES FICTIVES' : `${b.date} · L’ESSENTIEL DU JOUR`,
    sections = [];
  const hrefMatch = (m) => href(`#match-${encodeURIComponent(m.id)}`);
  const advice = (m) => (b.recommendations ?? b.picks).find((p) => p.match.id === m.id);
  const analysis = (m) => {
    if (!b.fresh)
      return 'Le rendez-vous à suivre : retrouvez les dernières informations et les compositions sur la fiche du match.';
    if (![m.homeGoals, m.awayGoals].every((n) => Number.isFinite(n) && n > 0 && n <= 10))
      return 'Le rendez-vous à suivre : comparez la forme des équipes et les compositions avant le coup d’envoi.';
    const p = analyseMatch(m).probs;
    if (!['home', 'draw', 'away'].every((k) => Number.isFinite(p[k]) && p[k] >= 0 && p[k] <= 1))
      return 'Découvrez les clés de cette affiche et les compositions sur le site.';
    return `Probabilités du modèle : ${m.home} ${Math.round(p.home * 100)} % · Nul ${Math.round(p.draw * 100)} % · ${m.away} ${Math.round(p.away * 100)} %.\nEstimations statistiques, sans recommandation de pari.`;
  };
  const card = (m, pick, group, tone = 'pick', title = null) => ({
    title: title ?? `${m.home} - ${m.away}`,
    group,
    tone,
    label: pick?.label,
    odd: pick?.odd,
    body: `${m.league} · ${clock(m.kickoff)} (${b.timezone})\n${pick ? 'Cote réelle · paris virtuels' : ''}\n${analysis(m)}\nVoir le match : ${hrefMatch(m)}`
  });
  for (const [i, m] of b.favorites.entries())
    sections.push(
      card(
        m,
        b.fresh ? advice(m) : null,
        i === 0 ? 'Mes équipes favorites' : null,
        'favorite',
        `${m.id === b.hero?.id ? '★ Le match du jour · ' : ''}${m.home} - ${m.away}`
      )
    );
  if (b.hero && !b.favorites.some((m) => m.id === b.hero.id))
    sections.push(card(b.hero, b.fresh ? advice(b.hero) : null, 'Le match du jour', 'hero'));
  if (!b.hero)
    sections.push({
      title: 'Une journée au calme',
      body: 'Aucun match du jour disponible. Retrouvez les prochaines rencontres sur le site.'
    });
  const picks = b.fresh ? b.picks.slice(0, 3) : [];
  for (const [i, pick] of picks.entries())
    sections.push(
      card(
        pick.match,
        pick,
        i === 0 ? 'Les 3 conseils du jour' : null,
        'pick',
        `${i + 1} · ${pick.match.home} - ${pick.match.away}`
      )
    );
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
  sections.push({
    title: 'Mon suivi',
    body: balance
      ? `Votre bankroll virtuelle actuelle : ${balance}. Retrouvez vos paris et votre progression dans votre espace personnel.`
      : 'Retrouvez vos paris et votre progression dans votre espace personnel.'
  });
  const action = picks.length
    ? { label: 'Découvrir les conseils du jour', url: href('#conseils-du-jour') }
    : {
        label: b.hero ? 'Explorer le match du jour' : 'Explorer le calendrier',
        url: b.hero ? hrefMatch(b.hero) : href('#matchs')
      };
  return { subject, ...emailLayout(title, caption, sections, action, profile) };
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
