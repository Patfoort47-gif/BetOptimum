# BET-270 : référencement BetOptimum

À la demande du propriétaire, BetOptimum est le nom principal du titre, des métadonnées sociales et du schéma WebApplication ; « ValueStats » du ticket initial est remplacé. La description souligne football, Value Bets, bankroll virtuelle et les limites du service. Aucun mot-clé caché, avis fictif ou score inventé.

Les balises sont dans le HTML initial : canonique, og:url, titre/description, image PNG 1200 × 630, texte alternatif et Twitter summary_large_image. `icons/betoptimum-social.png` est une capture du tableau de bord, sans donnée de compte réel. Le JSON-LD décrit une application web gratuite en français. Il ne promet pas un résultat enrichi Google.

Le sitemap contient uniquement `https://pronosafe.fr/` : les fragments de navigation ne sont pas des pages indexables. Une indexation distincte des sections nécessiterait des pages HTML propres avec contenu et canonique distincts.

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

## Basculer le site vers pronosafe.fr

Le domaine principal est `https://pronosafe.fr/`. `www.pronosafe.fr` et `pronosafe.eu` doivent rediriger vers lui. Le nom affiché reste BetOptimum.

1. Dans GitHub, **Settings → Pages**, vérifier que le domaine du dépôt est `pronosafe.fr`. Dans les paramètres Pages du compte, vérifier la propriété avec le TXT indiqué par GitHub et conserver cet enregistrement.
2. Dans la zone DNS OVHcloud de `pronosafe.fr`, faire pointer la racine sur les quatre adresses IPv4 GitHub Pages ci-dessous. Retirer les anciennes entrées web concurrentes à la racine. Les entrées email et les TXT de vérification restent en place. Ajouter `www` en CNAME vers `patfoort47-gif.github.io.`. Si IPv6 est utilisé, remplacer les anciennes entrées AAAA web par les quatre adresses GitHub correspondantes.
3. Attendre que le contrôle DNS de GitHub Pages et le certificat réussissent, puis activer **Enforce HTTPS**. Vérifier le site, ses icônes, le manifeste, le service worker, `robots.txt`, `sitemap.xml` et l’ancienne URL GitHub Pages. Vérifier qu’un seul saut de domaine suffit et que les paramètres et fragments d’un lien d’alerte sont conservés.
4. Configurer une redirection HTTPS permanente de `pronosafe.eu` et `www.pronosafe.eu` vers `https://pronosafe.fr/`, avec préservation du chemin et des paramètres. Utiliser un service de redirection qui présente un certificat valide pour les deux hôtes de départ. Vérifier la redirection en HTTP et HTTPS. GitHub Pages n’accepte qu’un domaine personnalisé par site.
5. Dans Supabase Auth, préparer `https://pronosafe.fr/` dans les URL de redirection. Une fois le site prêt en HTTPS, basculer **Site URL** vers `https://pronosafe.fr/`, conserver les anciens callbacks pendant la transition et publier les modèles HTML Auth versionnés. Le callback déclaré chez Google reste celui de Supabase. Tester connexion Google, confirmation, récupération et retour dans Mes alertes sur le nouveau domaine.
6. Dans la fonction Edge `notifications`, préparer `SITE_ALLOWED_ORIGINS` pour autoriser le nouveau domaine pendant la transition. Une fois le HTTPS actif, mettre `SITE_URL=https://pronosafe.fr/` afin d’émettre les nouveaux liens d’alertes. Autoriser temporairement l’ancienne origine GitHub dans `SITE_ALLOWED_ORIGINS` et exécuter le contrôle de production sans envoi. La PWA et la permission push sont liées à l’origine. Rouvrir ou réinstaller depuis le nouveau site et réassocier les push avec un accord explicite. Une session locale de l’ancien domaine ne migre pas entre origines.
7. Pour les emails, ajouter un sous-domaine d’envoi dans Resend, puis recopier dans OVHcloud les enregistrements annoncés par Resend et vérifier le domaine dans Resend. Mettre à jour `EMAIL_FROM` après validation. Vérifier séparément le SMTP Supabase Auth et l’adresse de réponse. Faire un envoi consenti et vérifier la réception, SPF, DKIM, DMARC et les liens.
8. Soumettre le nouveau sitemap dans Search Console après vérification du domaine. Surveiller les accès à l’ancien site et les retours de connexion avant de retirer les anciennes redirections Supabase. Pour revenir en arrière, rétablir le réglage de domaine précédent dans GitHub Pages, les valeurs précédentes de `SITE_URL` et de Supabase Auth, puis vérifier les liens et le certificat.

| Hôte | Type | Valeurs |
| --- | --- | --- |
| `@` | A | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` |
| `@` | AAAA si IPv6 | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` |
| `www` | CNAME | `patfoort47-gif.github.io.` |

[Documentation GitHub Pages pour les domaines personnalisés](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
