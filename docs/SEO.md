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

## BET-276 : hiérarchie et pré-rendu

Le HTML source contient un seul h1 principal et des titres de section h2. Les titres HTML, Open Graph et Twitter utilisent BetOptimum ; la description, le canonique et l’image sociale sont présents avant toute exécution JavaScript.

À chaque publication, `node scripts/prepare-pages.mjs` pré-rend dans `_site/index.html` un aperçu des rencontres publiques et de leurs probabilités à partir de `data/fixtures.json`. Aucun appel réseau supplémentaire, service payant ou serveur permanent. Le calendrier interactif remplace cet aperçu après chargement. Les données sont échappées ; aucune donnée de compte, bankroll ou classement privé n’est publiée. L’aperçu est daté, limité aux sept prochains jours et à 60 rencontres, sans cote ni conseil inventé. Les workflows de calendrier et de scores republient déjà le site après actualisation des données.

`robots.txt` autorise l’exploration et indique `sitemap.xml`. Le sitemap contient l’unique URL canonique : les onglets en `#` ne sont pas des pages indépendantes. Il n’existe pas de nouvelle vue publique à ajouter au sitemap.

Suivi : dans Google Search Console, inspecter l’URL canonique, demander l’indexation et soumettre le sitemap. Ce contrôle nécessite un accès à la propriété Search Console et n’a pas été effectué par Codex. Les classements du club et vues personnalisées restent interactifs ; ils ne sont pas exportés au déploiement. Si des pages publiques dédiées par compétition deviennent souhaitées, générer de vraies URL HTML et les ajouter au sitemap. Le pré-rendu améliore l’accès au contenu sans garantir une position ni un délai d’indexation.
