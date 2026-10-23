# AGENTS.md

Consignes pour Codex (et tout agent qui lit `AGENTS.md`) dans ce dépôt. Le projet est développé à deux : l'un avec Codex, l'autre avec Claude Code, qui lit `CLAUDE.md`. Les deux fichiers portent les mêmes règles communes et doivent rester cohérents : toute règle commune ajoutée ici va aussi dans `CLAUDE.md`.

**Avant toute modification, lis `CLAUDE.md`** : il décrit en détail l'architecture (pipeline de données, front, fiches détaillées, tests). Ce fichier en reprend l'essentiel.

## Projet

BetMaster / BotPari : application web **statique** (HTML + JS vanilla en module ES, sans framework, sans build, sans dépendance npm) d'aide à la décision pour des paris sportifs **virtuels**. Hébergée sur GitHub Pages. Toute l'interface et les textes sont en français.

## Commandes

```bash
npm start          # python3 -m http.server 4173 → http://localhost:4173
npm test           # node --test (exécute app.test.js, club.test.js, league.test.js, special.test.js, rewards.test.js, auth-model.test.js, community.test.js, shop.test.js et avatar.test.js)
node --test --test-name-pattern="combiné" app.test.js   # un seul test
node scripts/update-results.mjs    # met à jour uniquement les scores ESPN (sans clé)
```

Aucun linter ni formateur n'est configuré. Lance `npm test` avant chaque commit.

## Repères d'architecture

- `data/fixtures.json` est le seul lien entre le pipeline (`scripts/*.mjs`, lancé par GitHub Actions) et le front. Il est régénéré et commité par un bot plusieurs fois par jour : fais `git pull --rebase` avant de pousser, et ne le modifie pas à la main.
- `model.js` : calculs purs (Poisson, value, combinés, règlement), importés à la fois par `app.js` et par `scripts/update-fixtures.mjs`. Changer la logique de pronostic ici change le site **et** les pronostics enregistrés par le pipeline.
- `app.js` : interface, rendu par `innerHTML` depuis un objet `state` global. `details.js` et `account.js` sont chargés à la demande. Le direct ESPN utilise un scoreboard daté, la veille puis le résumé du match en secours, avec un rafraîchissement toutes les 20 secondes.
- `app.js` et `model.js` sont écrits en style très compact (une fonction par ligne) : garder ce style.
- `app.test.js` charge `app.js` avec des stubs de `localStorage`, `location` et `document` : tout nouvel accès au DOM ou au navigateur au niveau module doit rester compatible (ou être protégé par `typeof window !== 'undefined'`).
- La liste `leagues` de `scripts/update-fixtures.mjs`, celle de `scripts/update-results.mjs` et l'objet `LEAGUES` de `app.js` doivent garder les mêmes libellés.
- Thèmes : couleurs en variables CSS, sombre sur `:root`, clair sur `:root.light`. `--accent` pour les aplats, `--accent-text` pour le texte et les traits.

## Club : comptes, paris certifiés et ligues

Les paris des joueurs connectés sont enregistrés et réglés côté serveur (Supabase) : tables `fixtures`, `player_accounts`, `bets`, RPC `place_bet` et `settle_bet`, scripts `supabase-v4-schema.sql` et `supabase-v5-schema.sql` (ordre dans `SUPABASE_SETUP.md`). `scripts/sync-supabase.mjs` envoie les matchs et règle les paris avec `settleTicket` de `model.js` (clé `service_role` seulement dans GitHub Actions). Le navigateur n'écrit ni bankroll, ni statut, ni statistique : tout passe par des RPC `security definer`. Détail complet dans `CLAUDE.md` (section « Club »). Points de ligue et quota hebdomadaire : `supabase-v6-schema.sql`, `leaguePoints` et `leagueEligibility` dans `model.js`. Défi du jour (`supabase-v7-schema.sql`, `pickDailyChallenge`, carte `#daily-challenge`) : 4 matchs imposés par jour, gratuits, réglés avec le barème de la ligue. Ligue générale : `league.js` (échelons, groupes, clôture de saison, pur), `supabase-v8-schema.sql`, `scripts/league-engine.mjs`, `scripts/close-season.mjs` et le workflow `close-season.yml`, bloc « Ma ligue » du site. Ligues spéciales : `special.js` (pur), `supabase-v9-schema.sql` (`special_try_pick` fait foi), `scripts/special-engine.mjs`, blocs « Mes ligues » et catalogue. XP, niveaux, trophées et défis hebdomadaires : `rewards.js`, `supabase-v10-schema.sql`, `scripts/xp-engine.mjs` (XP écrits seulement par le serveur, une fois par événement). Jetons : `rewards.js`, `supabase-v11-schema.sql`, `scripts/token-engine.mjs` (journal `token_ledger` écrit seulement par le serveur, aucune valeur, jamais achetables ni convertibles). Page « Rejoindre le club » : `join.js` (interface), `auth-model.js` (règles pures, erreurs traduites), objet `auth` de `account.js`, `supabase-v12-schema.sql`. Page profil : `profile.js`, `supabase-v13-schema.sql` (pseudo mensuel, export, suppression, vues publiques), carte joueur dans `model.js`. Ligues privées et hub communauté : `community.js` (pur : codes, fil d'activité, suggestions), `supabase-v14-schema.sql` et `supabase-v15-schema.sql`, `scripts/activity-engine.mjs` (fil écrit seulement par le serveur), sections du site (Général paginé, Suivis, Hall of fame). Boutique et usages des jetons : `shop.js` (pur), `shop-page.js`, `supabase-v16-schema.sql` (achats et duels par RPC, solde recalculé sous verrou), `scripts/shop-engine.mjs`. Cadre légal : page « Règlement du club » (`#rules-dialog`) à tenir à jour avec le code, `VALIDATION_JURIDIQUE.md` pour l'avis juridique (bloquant avant la mise en production des jetons et de la boutique). Les tests du Club sont dans `club.test.js`, `league.test.js`, `special.test.js`, `rewards.test.js`, `auth-model.test.js`, `community.test.js` et `shop.test.js`.

Avatar 3D (BET-49 ; `avatar-config.js` pur et testé par `avatar.test.js`, `avatar-scenes.js`, `avatar-parts.js`, `avatar.js`, `avatar-studio.js`, `avatar-view.js`, `supabase-v17-schema.sql`) : footballeur modélisé par le code (grosse tête expressive, yeux brillants, cheveux en mèches, maillot en maille, matériaux PBR), Three.js 0.170.0 figé depuis jsDelivr, chargé à la demande par le studio, la page profil (aperçu 3D de l'en-tête) et la boutique (cabine d'essayage), jamais sur les autres pages. Éclairage studio (environnement PMREM, lumière principale, deux contre-jours), tons ACES, ombres douces, fond en profondeur de champ aligné sur la ligne de sol commune (`FLOOR_LINE`), qualité haute / moyenne / basse choisie par `qualityFor` (téléphone ou appareil modeste : moyenne), pause hors écran, ressources libérées à la fermeture, « réduire les animations » respecté (pose fixe, pas de rotation). Configuration v2 JSON dans `profiles.avatar_config` (`{v:2, body, skin, face, eyes, expression, hair, hairColor, kit:{item, number, name}, boots, pose, accessories, base, background, showcase, celebration, rev}`), validée à l'identique côté navigateur (`validateAvatar`, `sanitizeAvatar`) et côté SQL (`avatar_config_valid`, contrainte `profiles_avatar_valid`, déclencheur `profiles_check_avatar`) : aucun objet payant sans inventaire (`inventories`) ni déblocage de division (`player_unlocks`), nettoyage automatique à la revente ou à la perte du Master. Anciens avatars (couleur, expression, accessoire) convertis sans perte par `migrateAvatar` (lunettes et casquette offertes par la migration SQL, couronne conservée par un Master seulement). Images : à l'enregistrement le studio rend le buste (512 px) et l'avatar en pied (768 x 1024) avec le fond, WebP (JPEG si le navigateur ne sait pas l'écrire), envoyés dans le seau public Storage `avatars` (`{user_id}/bust` et `{user_id}/full`, écriture réservée au propriétaire par RLS, 1,5 Mo au plus) ; l'adresse se déduit de l'identifiant et de `rev` (`avatarImageUrl`), les classements, le fil, les menus et la carte joueur affichent ces images par `avatarMarkup` (`avatar-view.js`, repli sur l'ancien avatar CSS si l'image manque) sans charger la 3D. Le studio (onglet Avatar du profil) propose Visage, Coiffure, Tenue (numéro et nom au dos), Pose, Accessoires, Socle, Fond (6 fonds unis, centre d'entraînement, vestiaire, tunnel, 6 stades en vue intérieure et extérieure) et Vitrine ; les options verrouillées affichent leur condition (prix en jetons, division requise, objet exclusif) et peuvent être essayées avant achat (non enregistrées tant qu'elles ne sont pas possédées). La boutique a une cabine d'essayage 3D (« Essayer », « Porter ») et l'inscription une étape Avatar (options gratuites). Sans WebGL : l'image enregistrée s'affiche, l'édition est désactivée. Le personnage est une solution de code : il pourra être remplacé par le .glb du graphiste (BET-47) et les fonds par ses rendus (BET-48) sans changer la configuration.

## Contraintes

- Les secrets `FOOTBALL_DATA_TOKEN`, `THE_ODDS_API_KEY` et `SUPABASE_SERVICE_ROLE_KEY` n'existent que dans GitHub Actions ; rien ne doit les exposer dans `data/fixtures.json` ni côté navigateur.
- L'interface distingue cotes réelles (« MOYENNE · n bookmakers ») et estimées. Conserver cette distinction et les mentions « paris virtuels / 18+ / aucune garantie ».
- Les pages Confidentialité et Mentions légales (bas de `index.html`) décrivent les données collectées et les services tiers contactés (Supabase et son stockage d'images d'avatar, Google Fonts, ESPN, jsDelivr pour le client Supabase et Three.js) : les mettre à jour à chaque nouveau service ou nouvelle donnée.
- Pas de tiret cadratin ni demi-cadratin dans les textes affichés : utiliser « · », « : » ou « - ».
- Le site doit rester utilisable sur téléphone (barre de navigation du bas sous 700 px) comme sur PC (colonne combiné fixe au-delà de 1100 px).

## Tickets et travail à deux

- **Tickets BetMaster uniquement dans le YouTrack BetOptimum** (`betoptimum.youtrack.cloud`, projet `BET`), via le serveur MCP YouTrack configuré dans Codex. N'utilise aucune autre instance YouTrack pour ce dépôt.
- Affecte immédiatement chaque nouveau ticket à l'utilisateur YouTrack `Victor.patfoort3`. Avant toute modification ou tout commentaire sur un ticket existant, vérifie qu'il est affecté à cet utilisateur ; sinon, n'y touche pas. La seule modification autorisée sur un ticket nouvellement créé et encore non affecté est son affectation immédiate à `Victor.patfoort3`.
- Une branche par ticket, créée depuis `main` : `BET-<n>-<descriptif-court>` (ex. `BET-12-classement-buteurs`).
- Le numéro du ticket figure dans chaque message de commit et dans le titre de la pull request (ex. `BET-12 Ajoute le classement des buteurs`).
- Le ticket est fermé quand la pull request est fusionnée dans `main`.
- Aucun jeton YouTrack ni autre secret dans le dépôt : chacun garde le sien dans la configuration de son IA (`~/.codex/config.toml` pour Codex).
