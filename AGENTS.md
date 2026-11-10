# AGENTS.md

Consignes pour Codex (et tout agent qui lit `AGENTS.md`) dans ce dépôt. Le projet est développé à deux : l'un avec Codex, l'autre avec Claude Code, qui lit `CLAUDE.md`. Les deux fichiers portent les mêmes règles communes et doivent rester cohérents : toute règle commune ajoutée ici va aussi dans `CLAUDE.md`.

**Avant toute modification, lis `CLAUDE.md`** : il décrit en détail l'architecture (pipeline de données, front, fiches détaillées, tests). Ce fichier en reprend l'essentiel.

## Projet

BetOptimum : application web **statique** (HTML + JS vanilla en module ES, sans framework, sans build, sans dépendance npm) d'aide à la décision pour des paris sportifs **virtuels**. Hébergée sur GitHub Pages. Toute l'interface et les textes sont en français.

## Commandes

```bash
npm start          # python3 -m http.server 4173 → http://localhost:4173
npm test           # node --test (exécute tests/app.test.js, tests/club.test.js, tests/league.test.js, tests/special.test.js, tests/rewards.test.js, tests/auth-model.test.js, tests/community.test.js, tests/shop.test.js et tests/avatar.test.js)
node --test --test-name-pattern="combiné" tests/app.test.js   # un seul test
node scripts/update-results.mjs    # met à jour uniquement les scores ESPN (sans clé)
```

Aucun linter ni formateur n'est configuré. Lance `npm test` avant chaque commit.

## Repères d'architecture

- `data/fixtures.json` est le seul lien entre le pipeline (`scripts/*.mjs`, lancé par GitHub Actions) et le front. Il est régénéré et commité par un bot plusieurs fois par jour : fais `git pull --rebase` avant de pousser, et ne le modifie pas à la main.
- `model.js` : calculs purs (Poisson, value, combinés, règlement), importés à la fois par `app.js` et par `scripts/update-fixtures.mjs`. Changer la logique de pronostic ici change le site **et** les pronostics enregistrés par le pipeline.
- `app.js` : interface, rendu par `innerHTML` depuis un objet `state` global. `details.js` est chargé à l’ouverture d’une fiche ; `account.js` démarre avec le site pour restaurer la session. Le direct ESPN utilise un scoreboard daté, la veille puis le résumé du match en secours, avec un rafraîchissement toutes les 20 secondes.
- `app.js` et `model.js` sont écrits en style très compact (une fonction par ligne) : garder ce style.
- `tests/app.test.js` charge `app.js` avec des stubs de `localStorage`, `location` et `document` : tout nouvel accès au DOM ou au navigateur au niveau module doit rester compatible (ou être protégé par `typeof window !== 'undefined'`).
- La liste `leagues` de `scripts/update-fixtures.mjs`, celle de `scripts/update-results.mjs` et l'objet `LEAGUES` de `app.js` doivent garder les mêmes libellés.
- Thèmes : couleurs en variables CSS, sombre sur `:root`, clair sur `:root.light`. `--accent` pour les aplats, `--accent-text` pour le texte et les traits.

Retrait BET-199 : V52 archive l’économie virtuelle et révoque les anciens achats/échanges. Le profil actif conserve avatar, cadre et badges. Les sections historiques ci-dessous sur les objets et la monnaie sont supersédées par `docs/PROFILE_CLEANUP.md`.

## Recentrage produit (BET-308 · 10 novembre 2026)

La demande du propriétaire de réaliser le lot 16 fixe la règle commune à Codex et Claude Code : les nouvelles mécaniques sont gelées en dehors du défi du jour et des ligues privées entre amis. Les corrections, la sécurité, l’accessibilité et la maintenance des fonctions existantes restent possibles ; ne pas étendre divisions, ligues spéciales, défis hebdomadaires, niveaux, trophées, duels ou économie virtuelle.

Les jetons, achats, échanges, duels et boutique restent hors production (retrait V52, BET-199). Aucune réactivation avant avis écrits sur les points 1 à 4 de `VALIDATION_JURIDIQUE.md` et décision explicite du propriétaire. Cette règle remplace pour les évolutions futures la décision du 4 novembre 2026 (BET-63). Les archives sont conservées ; aucune suppression de comptes, paris, points ou résultats historiques. Voir `docs/PRODUCT_FOCUS.md`.

## Club : comptes, paris certifiés et ligues

Les paris des joueurs connectés sont enregistrés et réglés côté serveur (Supabase) : tables `fixtures`, `player_accounts`, `bets`, RPC `place_bet` et `settle_bet`, scripts `supabase/migrations/supabase-v4-schema.sql` et `supabase/migrations/supabase-v5-schema.sql` (ordre dans `SUPABASE_SETUP.md`). `scripts/sync-supabase.mjs` envoie les matchs et règle les paris avec `settleTicket` de `model.js` (clé `service_role` seulement dans GitHub Actions). Le navigateur n'écrit ni bankroll, ni statut, ni statistique : tout passe par des RPC `security definer`. Détail complet dans `CLAUDE.md` (section « Club »). Points de ligue et quota hebdomadaire : `supabase/migrations/supabase-v6-schema.sql`, `leaguePoints` et `leagueEligibility` dans `model.js`. Défi du jour (`supabase/migrations/supabase-v7-schema.sql`, `pickDailyChallenge`, carte `#daily-challenge`) : 4 matchs imposés par jour, gratuits, réglés avec le barème de la ligue. Ligue générale : `league.js` (échelons, groupes, clôture de saison, pur), `supabase/migrations/supabase-v8-schema.sql`, `scripts/league-engine.mjs`, `scripts/close-season.mjs` et le workflow `close-season.yml`, bloc « Ma ligue » du site. Ligues spéciales : `special.js` (pur), `supabase/migrations/supabase-v9-schema.sql` (`special_try_pick` fait foi), `scripts/special-engine.mjs`, blocs « Mes ligues » et catalogue. XP, niveaux, trophées et défis hebdomadaires : `rewards.js`, `supabase/migrations/supabase-v10-schema.sql`, `scripts/xp-engine.mjs` (XP écrits seulement par le serveur, une fois par événement). Jetons : `rewards.js`, `supabase/migrations/supabase-v11-schema.sql`, `scripts/token-engine.mjs` (journal `token_ledger` écrit seulement par le serveur, aucune valeur, jamais achetables ni convertibles). Page « Rejoindre le club » : `join.js` (interface), `auth-model.js` (règles pures, erreurs traduites), objet `auth` de `account.js`, `supabase/migrations/supabase-v12-schema.sql`. Page profil : `profile.js`, `supabase/migrations/supabase-v13-schema.sql` (pseudo mensuel, export, suppression, vues publiques), carte joueur dans `model.js`. Ligues privées et hub communauté : `community.js` (pur : codes, fil d'activité, suggestions), `supabase/migrations/supabase-v14-schema.sql` et `supabase/migrations/supabase-v15-schema.sql`, `scripts/activity-engine.mjs` (fil écrit seulement par le serveur), sections du site (Général paginé, Suivis, Hall of fame). Boutique et usages des jetons : `shop.js` (pur), `shop-page.js`, `supabase/migrations/supabase-v16-schema.sql` (achats et duels par RPC, solde recalculé sous verrou), `scripts/shop-engine.mjs`. Cadre légal : page « Règlement du club » (`#rules-dialog`) à tenir à jour avec le code, `VALIDATION_JURIDIQUE.md` pour l'avis juridique. Décision du propriétaire du 4 novembre 2026 (BET-63) : jetons, duels et boutique en production sans avis juridique, risques assumés ; les pages légales doivent rester exactes (trophées aux noms des récompenses du football : mention de non-affiliation dans les Mentions légales). Les tests du Club sont dans `tests/club.test.js`, `tests/league.test.js`, `tests/special.test.js`, `tests/rewards.test.js`, `tests/auth-model.test.js`, `tests/community.test.js` et `tests/shop.test.js`.

Avatar 3D (BET-49 ; `avatar-config.js` pur et testé par `tests/avatar.test.js`, `avatar-scenes.js`, `avatar-parts.js`, `avatar.js`, `avatar-studio.js`, `avatar-view.js`, `supabase/migrations/supabase-v17-schema.sql`) : footballeur modélisé par le code (grosse tête expressive, yeux brillants, cheveux en mèches, maillot en maille, matériaux PBR), Three.js 0.170.0 figé depuis jsDelivr, chargé à la demande par le studio, la page profil (aperçu 3D de l'en-tête) et la boutique (cabine d'essayage), jamais sur les autres pages. Éclairage studio (environnement PMREM, lumière principale, deux contre-jours), tons ACES, ombres douces, fond en profondeur de champ aligné sur la ligne de sol commune (`FLOOR_LINE`), qualité haute / moyenne / basse choisie par `qualityFor` (téléphone ou appareil modeste : moyenne), pause hors écran, ressources libérées à la fermeture, « réduire les animations » respecté (pose fixe, pas de rotation). Configuration v2 JSON dans `profiles.avatar_config` (`{v:2, body, skin, face, eyes, expression, hair, hairColor, kit:{item, number, name}, boots, pose, accessories, base, background, showcase, celebration, rev}`), validée à l'identique côté navigateur (`validateAvatar`, `sanitizeAvatar`) et côté SQL (`avatar_config_valid`, contrainte `profiles_avatar_valid`, déclencheur `profiles_check_avatar`) : aucun objet payant sans inventaire (`inventories`) ni déblocage de division (`player_unlocks`), nettoyage automatique à la revente ou à la perte du Master. Anciens avatars (couleur, expression, accessoire) convertis sans perte par `migrateAvatar` (lunettes et casquette offertes par la migration SQL, couronne conservée par un Master seulement). Images : à l'enregistrement le studio rend le buste (512 px) et l'avatar en pied (768 x 1024) avec le fond, WebP (JPEG si le navigateur ne sait pas l'écrire), envoyés dans le seau public Storage `avatars` (`{user_id}/bust` et `{user_id}/full`, écriture réservée au propriétaire par RLS, 1,5 Mo au plus) ; l'adresse se déduit de l'identifiant et de `rev` (`avatarImageUrl`), les classements, le fil, les menus et la carte joueur affichent ces images par `avatarMarkup` (`avatar-view.js`, repli sur l'ancien avatar CSS si l'image manque) sans charger la 3D. Le studio (onglet Avatar du profil) propose Visage, Coiffure, Tenue (numéro et nom au dos), Pose, Accessoires, Socle, Fond (6 fonds unis, centre d'entraînement, vestiaire, tunnel, 6 stades en vue intérieure et extérieure) et Vitrine ; les options verrouillées affichent leur condition (prix en jetons, division requise, objet exclusif) et peuvent être essayées avant achat (non enregistrées tant qu'elles ne sont pas possédées). La boutique a une cabine d'essayage 3D (« Essayer », « Porter ») et l'inscription une étape Avatar (options gratuites). Sans WebGL : l'image enregistrée s'affiche, l'édition est désactivée. Le personnage est une solution de code : il pourra être remplacé par le .glb du graphiste (BET-47) et les fonds par ses rendus (BET-48) sans changer la configuration.

## Contraintes

- Les secrets `FOOTBALL_DATA_TOKEN`, `PROPLINE_API_KEY` et `SUPABASE_SERVICE_ROLE_KEY` n'existent que dans GitHub Actions ; rien ne doit les exposer dans `data/fixtures.json` ni côté navigateur.
- L'interface distingue cotes réelles (« MOYENNE · n bookmakers ») et estimées. Conserver cette distinction et les mentions « paris virtuels / 18+ / aucune garantie ».
- Les pages Confidentialité et Mentions légales (bas de `index.html`) décrivent les données collectées et les services tiers contactés (Supabase et son stockage d'images d'avatar, Google Fonts, ESPN, jsDelivr pour le client Supabase et Three.js) : les mettre à jour à chaque nouveau service ou nouvelle donnée.
- Pas de tiret cadratin ni demi-cadratin dans les textes affichés : utiliser « · », « : » ou « - ».
- Le site doit rester utilisable sur téléphone (barre de navigation du bas sous 700 px) comme sur PC (colonne combiné fixe au-delà de 1100 px).

## Tickets et travail à deux

- **Tickets BetOptimum uniquement dans le YouTrack BetOptimum** (`betoptimum.youtrack.cloud`, projet `BET`), via le serveur MCP YouTrack configuré dans Codex. N'utilise aucune autre instance YouTrack pour ce dépôt.
- Affecte immédiatement chaque nouveau ticket à l'utilisateur YouTrack `Victor.patfoort3`. Avant toute modification ou tout commentaire sur un ticket existant, vérifie qu'il est affecté à cet utilisateur ; sinon, n'y touche pas. La seule modification autorisée sur un ticket nouvellement créé et encore non affecté est son affectation immédiate à `Victor.patfoort3`.
- Une branche par ticket, créée depuis `main` : `BET-<n>-<descriptif-court>` (ex. `BET-12-classement-buteurs`).
- Le numéro du ticket figure dans chaque message de commit et dans le titre de la pull request (ex. `BET-12 Ajoute le classement des buteurs`).
- Le ticket est fermé quand la pull request est fusionnée dans `main`.
- Aucun jeton YouTrack ni autre secret dans le dépôt : chacun garde le sien dans la configuration de son IA (`~/.codex/config.toml` pour Codex).

## Personnalisation et alertes (BET-80 à BET-85, BET-69)

- `supabase/migrations/supabase-v22-schema.sql` étend la validation d’avatar et installe les nouveaux objets. `syncShop` exclut les nouveautés tant que cette validation n’est pas disponible, pour éviter un achat impossible à porter. `shop-art.js` contient les aperçus vectoriels des accessoires et nouveaux trophées ; les maillots et décors réutilisent `avatar-scenes.js`.
- `notification-model.js` porte la détection pure et les plages silencieuses ; `notification-delivery.js` reste exclusivement côté serveur. `notification-page.js` est monté dans le profil, `notification-sw.js` affiche les Web Push sans cache des pages. Les destinations ne passent jamais au stockage local. SQL V23, fonction Edge et secrets sont nécessaires pour activer les canaux : voir `NOTIFICATIONS_SETUP.md`. La formule est décidée côté serveur. Aucun envoi ne doit être activé sans le consentement explicite du destinataire.

PWA / Push BET-200 : V50 rétablit le canal navigateur sur consentement explicite, indépendant du briefing email. Les clés VAPID et le chiffrement complets sont nécessaires ; sans eux, le canal reste indisponible. Voir `docs/PWA_PUSH.md`.

`notification-config.js` calcule la disponibilité publique des canaux côté serveur à partir de leur configuration complète (chiffrement inclus), sans exposer de secret. Un test email est clairement identifié et renvoie au profil ; le retour de mise en file distingue un doublon d’une nouvelle demande.

Alertes V24 (`supabase/migrations/supabase-v24-schema.sql`) : sauvegarder les préférences conserve les tests en attente tant que leur canal reste consenti et associé. Seul un nouveau clic sur Tester peut reprendre un test annulé avant toute tentative ; aucun rejeu après tentative ou résultat incertain.

Newsletter (BET-69) : `newsletter.js`, choix facultatif dans `join.js`, gestion dans Compte et confidentialité, `supabase/migrations/supabase-v25-schema.sql` après V23. Table privée `newsletter_subscriptions`, activation après confirmation Auth, pas d’inscription automatique des comptes existants, aucun envoi ni campagne avant définition des règles. Appliquer V25 avant publication du formulaire. Voir `NEWSLETTER_SETUP.md`.

Briefings email (BET-98) : `notification-briefing.js` (planification/calculs), `notification-email.js` (HTML et texte), `notification-briefing-service.js` (snapshot privé avant livraison), V26 après V24. Deux opt-ins distincts et inactifs par défaut, indépendants de la newsletter. File email existante, réservation par date/type, relecture du consentement et de l’adresse confirmée. Aperçus fictifs : `node scripts/preview-notification-emails.mjs`. Déploiement et limites : `NOTIFICATIONS_SETUP.md`.

Navigation (BET-120) : quatre destinations principales (Matchs, Résultats du modèle, Le Club, Mes paris). Les classements des équipes sont un sous-espace de Matchs, avec accès au ticket ; les classements des joueurs sont dans Le Club. Les URL historiques (`#classements`, `#bilan-pronos`, `#communaute`, `#bankroll`) restent compatibles. Les analyses détaillées et graphiques de bankroll sont repliables. Sur mobile, les quatre espaces sont complétés par les raccourcis Ticket et Compte.

## Organisation et publication (BET-126)

- Tests Node dans `tests/`, SQL dans `supabase/migrations/` : garder les chemins des guides et scripts cohérents.
- CSS chargé dans l’ordre `styles.css`, `styles/details.css`, `styles/components.css` ; préserver cet ordre de cascade.
- `node scripts/prepare-pages.mjs` prépare `_site/` à partir des modules navigateur accessibles, styles et données. Les workflows Pages publient uniquement ce dossier et partagent le groupe `betmaster-pages`.
- Recette de stabilité des cartes et du chargement différé : `NODE_PATH=/tmp/bet-ui-tools/node_modules node scripts/check-performance.cjs`, sur serveur local uniquement.


Classements (BET-132, remplace la transition BET-131) : `supabase/migrations/supabase-v31-schema.sql` après V30. Barème unique sur tout l'historique : mise fixe 10, plafond de cote 5, perdu -1 depuis BET-253, annulé 0. `rescore_league_history` reconstruit points, ROI et rangs courants/archivés sans rejouer les gains ni les décisions de promotion passées. `scoring_version` reste à 2 pour compatibilité, sans choisir de barème. Règlement et réparation doivent utiliser les cotes retenues et la date de règlement historique pour les annulations. Départage points / ROI sans annulations / victoires / UUID. Promotion : 10 résultats décidés et 50 % des occasions du défi depuis l'arrivée. Guide et recette isolée : `docs/LEAGUE_SCORING.md`.


Cotes françaises (BET-151) : `scripts/propline-odds.mjs` complète seulement BTTS et Over 2,5 de Betclic FR et Winamax FR via PropLine (`PROPLINE_API_KEY` dans Actions). Un appel groupé par compétition ayant un match dans les sept prochains jours, aux créneaux existants ; aucun appel navigateur. Prix américains convertis explicitement, périodes et totaux équipe exclus, cotes de plus d’une heure ignorées à la collecte. Rapprochement unique par ESPN ou équipes orientées et horaire à 15 min près ; aucune variante DE fusionnée avec FR. Les offres primaires restent prioritaires, la provenance par marché est conservée dans le cache. Guide : `docs/PROPLINE_SETUP.md`.

Marchés BET-153 : `markets.js` définit les identifiants, lignes et règles de résultat. V36 après V35 valide les nouveaux choix côté serveur ; activation progressive par `PROPLINE_MARKET_STAGE` (0 par défaut), voir `docs/MARKETS_SETUP.md`. Depuis BET-175, les recommandations comparent tous les marchés disponibles par confiance décroissante, avec cote strictement supérieure à 1,15 et au moins dix bookmakers par sélection ; aucun repli sans candidat.

Production BET-153 : V36 appliquée, étape 2 activée explicitement dans `update-fixtures.yml`. Collectes planifiées à 6 h et 18 h Paris ; `workflow_dispatch` permet une collecte manuelle d’administration (notamment au déploiement), jamais depuis le navigateur.

Célébrations BET-163 : effets de victoire (`effect`), ambiances sonores (`sound`) et personnalisation de la carte joueur (`card-bg`, `card-font`, `card-shine`) sont des catégories de `shop.js` équipées par `equipped_items`, sans toucher `avatar_config`. V39 après V38 rend publics les seuls objets de carte (`public_equipped`, `equipped_slot_public`) ; `shop-engine.mjs` ne les vend qu’une fois V39 appliquée. `celebration-model.js` (pur, `tests/celebration.test.js`) décide d’une célébration par prono gagné (marque locale `betmaster-celebration-seen`) ; `victory-effects.js`, chargé à la demande, joue l’animation légère (image de l’avatar, sans Three.js), les effets en canvas 2D et les sons Web Audio. Son coupé par défaut (`profile.celebrationSound` dans l’état utilisateur), « réduire les animations » respecté (toast seul).

Inventaire PropLine (BET-154, lot 1) : `scripts/propline-inventory.mjs` et le workflow manuel « Inventorier les marchés PropLine » relèvent en lecture seule les marchés servis par PropLine (match complet, 1re et 2e mi-temps), 56 requêtes par défaut, 60 au plus, rapport en artefact. Rien n'est écrit ni déployé ; la matrice et l'activation des familles suivent dans BET-170. Guide : `docs/MARKETS_SETUP.md`.

Classement confirmé (BET-169) : V38 après V37. `ranking-policy.js` et les fonctions SQL appliquent la règle V3 aux périodes commençant le 9 novembre 2026 ou après. Le barème numérique V2, ROI et critères de promotion restent inchangés. Avant 10 décisions gagnées/perdues, rang public NULL, zone provisoire distincte, aucun podium/titre confirmé. Ne pas utiliser l’ordre interne des tables pour présenter un rang provisoire. Archives inchangées ; guide `docs/RANKING_CONFIRMATION.md`.

Marchés BET-170, premier lot : V40 après V39, étape 3 activée explicitement dans `update-fixtures.yml` après application de V40. Scores exacts, handicaps européens, marges et demi-lignes supplémentaires disposent depuis BET-175 des probabilités et de la value issues de la même grille Poisson que les autres marchés. Aucun repli cache pour ces prix ; expiration à 20 h, vérifiée côté serveur. `check-market-deployment.mjs` bloque la collecte étape 3 avant V40. Ne pas retirer leur règlement lors du retour à l’étape 2. Guide : `docs/MARKETS_PRODUCTION.md`.

Cotes BET-170 : `quote-policy.js` exige au moins 10 bookmakers distincts par sélection pour toute cote actuelle (aucun recours au nombre global du match). En dessous : pas de cote affichée ni jouable, probabilités du modèle conservées. V41 après V40 contrôle tickets, défis et grilles via `fixtures.odds_bookmaker_counts`. Les instantanés des paris existants restent inchangés. Déployer V41 et synchroniser le calendrier avant publication.


Retrait H1 BET-198 : décision du propriétaire du 5 novembre 2026, seuls les marchés de match complet restent proposés. V49 bloque les nouveaux paris H1 ; la collecte des résultats et le règlement historique sont conservés. Voir `docs/RETIRED_HALF_TIME.md`. Les indications suivantes décrivent le fonctionnement historique.

H1 BET-170 : décision du propriétaire de terminer H1 et d’abandonner les autres extensions. V45 indépendante de V44 composites (non appliquée), après V43. Activation par `PROPLINE_H1_ENABLED`, étape 3 conservée. Neuf choix H1 1N2/totaux match 0,5/1,5/2,5, dix bookmakers par choix, sans modèle ni recommandation H1. Résultat ESPN de période persisté dans `fixtures.period_scores`, score absent/incohérent = attente, prolongations et tirs au but exclus. Garder le moteur et la collecte des résultats pour les paris H1 déjà pris même si les nouvelles cotes sont désactivées. Guide : `docs/MARKETS_H1_PRODUCTION.md`.

BET-211 : quota réservé et poussé dans `data/odds-sync-attempts.json` avant les appels PropLine, au moins 12 h entre deux tentatives et deux maximum sur 24 h glissantes. Sans réservation du workflow, le pipeline utilise le cache. Une tentative échouée consomme son créneau.

BET-242 : `notification-reminder.js` détecte les rappels des équipes favorites à H-2 (fenêtre de 15 min), sans cote. Depuis BET-243, les compétitions favorites sont également incluses. V54 après V50 ajoute `favorite_reminders`, désactivé par défaut, et déduplique par compte/match. Les rappels respectent le silence et sont indépendants du plafond d’opportunités. Relire favoris, consentement et horaire avant livraison ; voir `docs/PWA_PUSH.md`.

BET-243 : V55 sépare les lots de rappels et d’opportunités. `notification-scheduler.js` lit les fixtures récentes côté serveur ; `supabase/notification-scheduler.sql` installe le minuteur Supabase Cron à la minute. Route Edge `scheduled-reminders` avec secret dédié dans Vault et l’environnement Edge, sans secret dans cron.job. Bail et heartbeat privés dans `notification_scheduler`, installation initiale en mode sans envoi ; voir `docs/PWA_PUSH.md`.

BET-244 : `inLiveWindow` (`live.js`) convertit explicitement le coup d’envoi en nombre avant addition d’une durée. `applyLiveSnapshot` mutualise les scores du scoreboard et des résumés des fiches, ignore les réponses plus anciennes et ne règle le résultat final qu’une fois. Les cartes et l’en-tête ouvert suivent le même état ; tests `live.test.js` et `details-live.test.js`.

BET-246 : V56 après V55 ajoute le mode push Essentiel (résultats certifiés uniquement) et un plafond commun de 1 ou 2 push/jour, rappels et tests compris. Expiration transport à 120 secondes et notification générique regroupée pour les résultats, sans montants. Aucun opt-in automatique ni rejeu des anciens règlements. Déployer la fonction Edge notifications avec V56 avant le front.

BET-251 : `scripts/propline-competitions.mjs` étend la collecte aux compétitions du calendrier par catalogue PropLine et alias exacts (dont Coupe de France et Copa del Rey). La découverte compte dans le budget de huit appels ; les compétitions non couvertes sont signalées. Historique football-data.org indépendant, quota et dix bookmakers par sélection inchangés. Voir `docs/PROPLINE_SETUP.md`.

BET-252 : exception administrative explicite au quota par `workflow_dispatch` avec `force_odds_sync=true`. Désactivée par défaut, inaccessible aux lancements planifiés, tentative toujours journalisée avant les appels. Aucun changement au plafond de huit requêtes par collecte.

BET-253 : V57 après V56 remplace la pénalité des classements par -1, y compris les paris, défis et grilles déjà réglés. Recalcul transactionnel des points, ROI et rangs ; les rangs provisoires restent NULL. Gains, bankrolls et décisions de promotion conservés. `leaguePoints` et `league_score` restent identiques.

BET-255 : V58 retire le plafond quotidien des push, conserve déduplication, consentement, silence et expiration. Équipes favorites uniquement, y compris les opportunités (`notification-opportunity.js`). Les rappels incluent le conseil disponible, sa cote et sa confiance ; `fixtures.notification_pick` est alimenté par `sync-supabase.mjs` pour le minuteur. Appliquer V58 et déployer Edge avant le front.

BET-256 : les briefings email ne montrent que les équipes favorites, l’affiche et trois conseils au plus. Les cotes sont celles du modèle recommandé avec dix bookmakers datés. BET-273 : le bloc « Mon suivi » rappelle désormais la bankroll virtuelle actuelle, à la demande explicite du propriétaire. Sans conseil, analyse statistique du match du jour, bouton vert et objet spécifique ; aucune cote inventée. Maquettes fictives : `examples/notification-emails/`, génération par `scripts/preview-notification-emails.mjs`. Mise en page en tables et styles en ligne pour Gmail/Outlook ; recette visuelle réelle dans ces clients à distinguer des captures Chromium.

BET-257 : V59 ajoute `daily_summary`, désactivé par défaut, résumé push de 1 à 3 conseils à 9 h dans le fuseau du compte (Paris par défaut), fenêtre de 15 min, aucun envoi sans conseil. Le minuteur lit le calendrier sur 24 h et traite aussi ce résumé, indépendant des favoris. Déduplication compte/date, consentement et conseils relus avant envoi. `daily-picks.js` est partagé avec la vue `#conseils-du-jour`.

BET-258 : V60 retire le canal abandonné, ses associations, préférences et RPC ; seuls email et smartphone sont actifs. Les migrations historiques restent pour reconstruire le schéma. Les adaptateurs et l’interface associés sont supprimés. Voir `NOTIFICATIONS_SETUP.md`.

BET-259 : fournisseur Google configuré dans Supabase, Site URL sur `/BetOptimum/`. `auth-return.js` distingue refus OAuth et confirmation email expirée sans afficher les paramètres sensibles. Aucun secret OAuth côté navigateur. Le déclencheur de profil reste idempotent ; voir `docs/GOOGLE_SIGN_IN.md`.

BET-260 : les liens de coupon V2 (`ticket-url.js`) transportent choix, mode/formule et cotes de référence, sans mise ni identité ; V1 reste lisible. `ticket-restore.js` signale choix indisponibles et cotes modifiées sans remplacer le marché. Brouillon de session 24 h pour OAuth, aucune validation automatique. Aperçus : Worker Sites public séparé, images PNG Supabase V61 sous UUID aléatoire ; dépôt authentifié et purge horaire après 30 jours ou suppression du compte. Ne jamais activer un nouvel accès public sans accord explicite du propriétaire. Guide `docs/TICKET_SHARING.md`.

BET-261 : un seul bouton partage le coupon. L’envoi contient le lien et un résumé texte adapté au simple ou au combiné, sans générer, déposer ni joindre d’image. Les anciens aperçus restent soumis à la purge V61.

Performance BET-292 : `data/fixtures.json` est compact et ne contient plus `bookmakerOffers`. `scripts/fixture-files.mjs` publie les offres détaillées par date dans `data/offers/YYYY-MM-DD.json`; le navigateur ne les charge qu’à l’ouverture du comparateur. Le calendrier léger est mis en cache via Cache API (`fixture-cache.js`), jamais dans `localStorage`. Les workflows doivent committer `data/fixtures.json` et `data/offers/`. Les logos ESPN utilisent les variantes 96 px sans héberger de copie. Inter et Barlow Condensed sont servis depuis `fonts/` avec `font-display: swap`, sans Google Fonts.

BET-278 : calendrier, affiche du jour, aperçu HTML public et briefing email excluent les matchs sans sélection réelle admissible (au moins dix bookmakers distincts pour une même sélection, politique de cotes commune). Aucune exception pour la popularité ni repli vers un match non admissible. Les données de règlement historiques restent conservées.

Sécurité BET-302 : clients Supabase JS 2.81.1 et Three.js 0.170.0 servis localement depuis `vendor/`, sans import jsDelivr. Versions npm verrouillées, licences et empreintes conservées ; reconstruction explicite par `scripts/build-vendor.mjs`, voir `vendor/README.md`. La publication inclut les modules vendor accessibles et leurs notices, pas les outils de compilation.

CSP BET-303 : scripts et workers locaux uniquement ; pas de gestionnaire JavaScript dans le HTML. La CSP meta de `index.html` limite les connexions au projet Supabase courant et à ESPN. Les styles inline restent nécessaires aux rendus dynamiques. Adapter explicitement cette liste à tout nouveau service. Recette : `scripts/check-security-ui.cjs`, guide `docs/SECURITY_LOT15.md`.
