# BET-270 : référencement BetOptimum

À la demande du propriétaire, BetOptimum est le nom principal du titre, des métadonnées sociales et du schéma WebApplication ; « ValueStats » du ticket initial est remplacé. La description souligne football, Value Bets, bankroll virtuelle et les limites du service. Aucun mot-clé caché, avis fictif ou score inventé.

Les balises sont dans le HTML initial : canonique, og:url, titre/description, image PNG 1200 × 630, texte alternatif et Twitter summary_large_image. `icons/betoptimum-social.png` est une capture du tableau de bord, sans donnée de compte réel. Le JSON-LD décrit une application web gratuite en français. Il ne promet pas un résultat enrichi Google.

Le sitemap contient uniquement `https://patfoort47-gif.github.io/BetOptimum/` : les fragments de navigation ne sont pas des pages indexables. Une indexation distincte des sections nécessiterait des pages HTML propres avec contenu et canonique distincts.

`prepare-pages.mjs` copie sitemap.xml, robots.txt et la couverture dans l’artefact Pages. Après fusion et déploiement :

- `/BetOptimum/sitemap.xml`
- `/BetOptimum/robots.txt`
- `/BetOptimum/icons/betoptimum-social.png`

Les robots consultent **`https://patfoort47-gif.github.io/robots.txt` à la racine du domaine**, pas celui du sous-répertoire. Ce dépôt ne contrôle pas le site racine. Le robots livré autorise l’exploration, mais son placement à la racine du domaine nécessite une modification du dépôt `patfoort47-gif.github.io` ou un domaine personnalisé. Ne pas modifier un autre dépôt ni un domaine sans demande. Soumettre directement le sitemap à Google Search Console et Bing Webmaster Tools après publication ; les métadonnées ne garantissent ni indexation ni classement.

## Recette

`npm test` : 445 tests réussis, y compris cohérence titre/OG/Twitter/canonique, JSON-LD, taille PNG et contenu réel de l’artefact.

Lighthouse 13, Chromium 154 headless, audit SEO local : **100/100** le 10 novembre 2026. Audit local, pas une mesure du site publié. Relancer après déploiement sur l’URL officielle.

Les aperçus réels WhatsApp, Telegram et X doivent être vérifiés après publication : ces services récupèrent l’URL publique et peuvent conserver leur cache. Aucun aperçu réel dans ces clients n’a été validé dans cette session.
