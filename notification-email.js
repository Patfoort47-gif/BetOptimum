// HTML et texte partagent la même sélection courte. Aucun envoi dans ce module.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const euros=n=>n==null?'Indisponible':new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(n);
function emailLayout(title,caption,sections,action,profile){
 const copy=s=>`<p style="margin:10px 0;color:#526059;font-size:15px;line-height:1.7">${esc(s).replaceAll('\n','<br>')}</p>`;
 const footer='Paris virtuels · 18+ · Probabilités indicatives · Aucune garantie de gain. Aucun pari n’est placé depuis cet email.';
 const text=[caption,title,...sections.map(s=>`${s.title}\n${s.body}`),`${action.label} : ${action.url}`,`Gérer mes préférences et me désabonner (après connexion) : ${profile}`,footer].join('\n\n');
 const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)}</title></head><body style="margin:0;background:#edf1eb;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding:24px 12px"><!--[if mso]><table role="presentation" width="580"><tr><td><![endif]--><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:580px;table-layout:fixed;overflow-wrap:anywhere;background:#fff;border-radius:24px;overflow:hidden"><tr><td style="padding:30px 24px;background:#14251b;border-top:5px solid #c8f03c"><p style="margin:0 0 26px;color:#c8f03c;font-size:17px;font-weight:bold;letter-spacing:2px">BETOPTIMUM</p><p style="color:#d8e9c8;font-size:11px;letter-spacing:1px">${esc(caption)}</p><h1 style="margin:12px 0;color:#fff;font-size:30px;line-height:1.2">${esc(title)}</h1></td></tr>${sections.map(s=>`<tr><td style="padding:22px 24px 0"><h2 style="margin:0;color:#192d20;font-size:18px;line-height:1.4">${esc(s.title)}</h2>${copy(s.body)}</td></tr>`).join('')}<tr><td style="padding:26px 24px 32px"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#c8f03c" style="border-radius:12px;text-align:center"><a href="${esc(action.url)}" style="display:inline-block;padding:16px 22px;color:#14251b;font-size:15px;font-weight:bold;text-decoration:none">${esc(action.label)} →</a></td></tr></table></td></tr><tr><td style="padding:22px 24px;background:#f3f6f0;font-size:12px;line-height:1.7;color:#526059"><a href="${esc(profile)}" style="color:#3f6600">Gérer mes préférences et me désabonner</a><p>Après connexion : Mon profil &gt; Mes alertes.</p><p>${esc(footer)}</p></td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
 return {text,html};
}
function safeSite(siteUrl){const site=new URL(siteUrl);if(site.protocol!=='https:')throw new Error('SITE_CONFIG');return site}
export function briefingEmail(b,siteUrl){
 const site=safeSite(siteUrl),href=hash=>new URL(hash,site).href,profile=href('#profil'),clock=iso=>new Date(iso).toLocaleTimeString('fr-FR',{timeZone:b.timezone,hour:'2-digit',minute:'2-digit'});
 const daily=b.kinds.includes('daily'),title=daily?'Votre pause foot du jour':'Vos favoris entrent en jeu',subject=daily?'BetOptimum : votre briefing foot du jour':'BetOptimum : jour de match pour vos favoris';
 const caption=b.demo?'MAQUETTE · DONNÉES FICTIVES':`${b.date} · L’ESSENTIEL DU JOUR`,sections=[];
 if(b.hero)sections.push({title:`${b.hero.home} - ${b.hero.away}`,body:`${b.hero.league} · ${clock(b.hero.kickoff)} (${b.timezone})\n${b.matches.length} rencontre(s) à retrouver sur le site.`});
 else sections.push({title:'Une journée au calme',body:'Aucune rencontre à venir dans votre sélection. Retrouvez vos analyses et vos résultats sur le site.'});
 const picks=b.fresh?b.picks.slice(0,2):[];
 for(const pick of picks)sections.push({title:`À analyser : ${pick.match.home} - ${pick.match.away}`,body:`${pick.label} · cote ${pick.odd.toFixed(2)}\n${pick.bookmaker} · cote réelle${pick.cached?' en cache':''}, actualisée le ${new Date(pick.updatedAt).toLocaleString('fr-FR',{timeZone:b.timezone})}.\nProbabilité du modèle : ${Math.round(pick.probability*100)} %. Une estimation ne garantit aucun résultat.`});
 if(!picks.length)sections.push({title:'Pas de conseil forcé',body:b.fresh?'Aucune piste ne répond à vos critères aujourd’hui.':'Données indisponibles ou de plus de 24 h : aucun conseil publié.'});
 sections.push({title:'Votre espace',body:`Bankroll disponible : ${euros(b.bankroll)}.\n${b.projection.tickets.length||b.projection.outside.length?'Retrouvez vos paris, leurs détails et leurs scénarios sur votre profil.':'Aucun pari placé sur ces affiches.'}`});
 const matches=b.matches.slice(0,3);
 if(matches.length)sections.push({title:'Le fil de votre journée',body:matches.map(m=>`${clock(m.kickoff)} · ${m.home} - ${m.away}${b.favorites.some(f=>f.id===m.id)?' · FAVORI':''}`).join('\n')+(b.matches.length>3?`\nEt ${b.matches.length-3} autre(s) rencontre(s) sur le site.`:'')});
 const action={label:b.hero?'Découvrir ma journée':'Consulter mon espace',url:b.hero?href(`#match-${encodeURIComponent(b.hero.id)}`):profile};
 return {subject,...emailLayout(title,caption,sections,action,profile)};
}
export function alertEmail({title,message,url,siteUrl,testing=false}){
 const site=safeSite(siteUrl),target=new URL(url,site);if(target.origin!==site.origin)throw new Error('SITE_CONFIG');
 return emailLayout(title,testing?'TEST DE VOS ALERTES':'VOTRE ALERTE FOOT',[{title:testing?'Votre canal est prêt':'Une piste à découvrir',body:message}],{label:testing?'Gérer mes alertes':'Voir l’analyse',url:target.href},new URL('#profil',site).href);
}
