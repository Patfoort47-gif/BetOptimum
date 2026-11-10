# Consignes communes de développement

BetOptimum est un site statique en français (HTML et modules JavaScript natifs), publié sur GitHub Pages. Lire [le plan du dépôt](docs/README.md), [l’architecture](docs/ARCHITECTURE.md), puis le guide du domaine modifié.

## Priorité produit

Les nouvelles mécaniques sont gelées hors défi du jour et ligues privées entre amis (BET-308). Corrections, sécurité, accessibilité et maintenance restent possibles. L’économie virtuelle, les achats, échanges et duels restent retirés (V52). Aucune réactivation sans avis écrits sur les points 1 à 4 de VALIDATION_JURIDIQUE.md et nouvelle décision explicite du propriétaire. Aucun ajout libre de capital (V64). Conserver les historiques.

Le lot 18, demandé explicitement par le propriétaire, autorise le périmètre BET-316 à BET-321 : recherche du modèle sous validation préalable, mesure de clôture, partages du défi/comparaison, aperçus et invitations privées. Cette exception ne réactive pas l’économie et ne dispense jamais du consentement ni de la confidentialité.

## Travail et vérification

- Une branche par ticket, créée depuis main : `BET-<n>-description`. Numéro du ticket dans chaque commit et titre de PR. Fermer le ticket après fusion de sa PR.
- Tickets uniquement dans `betoptimum.youtrack.cloud`, projet BET. Avant modification/commentaire, vérifier l’affectation à `Victor.patfoort3` ; sinon ne pas toucher. Affecter immédiatement tout nouveau ticket à cet utilisateur.
- `npm ci` installe les outils de développement. `npm run format` applique Prettier ; `npm run format:check` vérifie le style. `npm test` avant chaque commit. Pas de dépendance npm à l’exécution ni de build du site.
- `node scripts/prepare-pages.mjs` prépare le site public ; vérifier aussi `node scripts/check-migrations.mjs` et `node scripts/check-links.mjs`. Les workflows publient uniquement `_site/` avec le groupe `betmaster-pages`.
- Adapter les recettes SQL et navigateur au domaine modifié. Les simulations ne prouvent pas la réception sur un téléphone réel ; préciser les limites des validations.
- Les bots modifient les données : `git pull --rebase` avant de pousser. Ne jamais modifier à la main `data/fixtures.json`, ses offres par date ni les archives de pronostics.

## Code et publication

- Sources regroupées sous `src/` par domaine. `app.js`, `theme-bootstrap.js` et `notification-sw.js` gardent leur URL et leur portée publiques. Les anciens chemins des modules sont servis par des alias générés depuis `config/module-paths.json`.
- Modifier les imports, références de workers et préparation Pages ensemble lors d’un déplacement. Les fonctions Edge et scripts serveur utilisent les mêmes règles pures que le site.
- `src/model/model.js` porte les calculs partagés : une modification affecte le navigateur et les pronostics du pipeline. Conserver l’identité des marchés et le règlement des anciens paris, même pour un marché retiré.
- Les tests importent app.js avec des stubs DOM. Protéger les accès au navigateur au niveau module (`typeof window !== 'undefined'`).
- CSS dans l’ordre `styles.css`, `styles/details.css`, `styles/components.css`. Variables de couleur ; sombre sur `:root`, clair sur `:root.light`, `--accent` pour les aplats et `--accent-text` pour le texte. Téléphone et PC doivent rester utilisables.
- Textes affichés en français, décimales françaises, pas de tiret cadratin ou demi-cadratin. Conserver « paris virtuels · 18+ · aucune garantie » et la distinction cotes réelles/estimées.
- Cotes jouables et recommandations : au moins dix bookmakers distincts pour chaque sélection ; conseil avec cote strictement supérieure à 1,15. Aucun repli sans sélection admissible.
- Les clients Supabase et Three.js sont figés dans vendor/. Garder leurs licences et empreintes. CSP : scripts locaux uniquement, pas de gestionnaire JavaScript HTML.

## Serveur et données privées

- Le navigateur ne modifie ni solde, statut, statistique, points ni XP : RPC serveur avec RLS. Aucun secret dans Git, les fichiers publiés ou les commentaires de tickets.
- Les migrations horodatées publiées sont immuables. Ajouter une migration avec la CLI Supabase ; vérifier une base vierge et les recettes SQL avant application. Ne jamais réinitialiser la production.
- Notifications : aucun envoi ni nouvelle association sans consentement explicite. Options facultatives inactives par défaut ; relire accord, silence, expiration et état métier avant transport. Conserver déduplication et absence de rejeu après résultat incertain.
- Ne pas ouvrir un nouvel accès public sans accord du propriétaire. Mettre à jour Confidentialité et Mentions légales pour toute nouvelle donnée ou tout nouveau fournisseur.
- Avatar, cadre et badges restent actifs ; les archives de l’économie ne sont pas des fonctions à réactiver.

Codex et Claude Code appliquent ces mêmes règles. Toute règle commune doit être mise à jour dans AGENTS.md et CLAUDE.md.
