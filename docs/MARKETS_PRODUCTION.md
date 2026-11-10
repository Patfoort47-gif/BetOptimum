# BET-170 : mettre le premier lot en production

## Version livrée

L’étape **3** ajoute des choix manuels en temps réglementaire :

- scores exacts domicile/extérieur de 0 à 15 buts, uniquement les scores réellement cotés dans un format non ambigu ; les issues « autre score » et les libellés dont l’orientation n’est pas certaine restent ignorés ;
- handicaps européens entiers de -9 à +9 appliqués au domicile, trois issues distinctes ; le nul corrigé est gagnant pour l’issue N, pas remboursé ;
- marges de victoire exactes de 1 à 9 buts et seuils « ou plus », ainsi que nul 0 - 0 et nul avec buts ;
- Over/Under sur les demi-lignes 0,5 et 4,5 à 9,5. Les lignes 1,5 / 2,5 / 3,5 gardent leurs identités et modèle existants.

Aucune cote absente n’est créée. Les totaux entiers/quarts, marchés joueurs, corners, cartons, composites et mi-temps restent désactivés ; voir [la matrice](archive/MARKETS_INVENTORY.md). La livraison constitue le premier lot déployable de BET-170, pas l’activation des 35 clés.

Les nouveaux choix n’ont ni probabilité, ni value, ni recommandation automatique, ni conseil de mise. Les cinq recommandations historiques sont conservées. Le ticket, la comparaison et l’historique utilisent la même clé stable que le règlement. Une seule sélection par match demeure autorisée dans tout ticket, y compris les systèmes.

## Preuve fournisseur

[Diagnostic réel du 3 novembre 2026 à 16 h 10 Paris](https://github.com/Patfoort47-gif/BetOptimum/actions/runs/41661059219), huit appels groupés, seize matchs, huit compétitions, aucun incident. Le validateur `scripts/check-markets-lot-one.mjs` appliqué au rapport donne :

| Famille | Matchs avec sélection cotée acceptée | Compétitions |
|---|---|---|
| Score exact | 16 | 8 |
| Handicap européen | 15 | 8 |
| Marge de victoire | 16 | 8 |
| Demi-lignes supplémentaires | 16 | 8 |

Ces chiffres concernent l’échantillon, pas une garantie par rencontre ou par bookmaker français. Des [extraits réels](evidence/propline-lot-one-2026-11-03.json) de Premier League et Ligue 1 sont conservés comme fixtures de tests, avec la provenance du rapport original (artefact `13242835588`). Les variantes régionales et les conditions de marché restent distinctes. Formats non reconnus, périodes, totaux équipe déguisés et promotions ne sont pas convertis en marché classique.

Le workflow « Inventorier les marchés PropLine » propose désormais `mode=prices` et un budget de huit appels au plus pour rejouer ce diagnostic. Il conserve `propline-prices.json`, puis exige des prix acceptés sur au moins deux matchs et deux compétitions pour chacune des quatre familles. Le catalogue `/markets` seul ne suffit pas.

## Ordre de mise en production

1. Appliquer `supabase/migrations/20261110000040_legacy_v40.sql` après V39 dans le projet Supabase de production. La migration est réexécutable ; elle ajoute `fixtures.market_valid_until` et étend les labels/choix acceptés par la RPC sans réécrire les paris existants.
2. Fusionner la PR BET-170 pour publier les modules et le moteur de règlement. La version publiée du workflow fixe explicitement `PROPLINE_MARKET_STAGE=3` ; V40 doit donc être vérifiée avant cette fusion.
3. Vérifier `PROPLINE_MARKET_STAGE=3` dans les deux étapes du workflow, puis lancer manuellement « Actualiser les matchs » sur `main`. Le workflow vérifie d’abord la colonne V40 et un label serveur en lecture seule. Si le schéma manque, il échoue avant tout appel fournisseur et toute modification du calendrier.
4. Vérifier le succès de la collecte et de la synchronisation Supabase ; ouvrir un match couvert et vérifier les familles, les prix réels datés et « Manuel / Sans modèle ». Une famille peut manquer sur un match : c’est une absence d’offre, pas une erreur à combler avec une estimation.

Commandes équivalentes pour les étapes Actions (après migration et fusion) :

```bash
gh workflow run update-fixtures.yml --repo Patfoort47-gif/BetOptimum --ref main
```

La collecte conserve ses deux créneaux de 6 h et 18 h Paris, et huit appels groupés au plus. L’extension ajoute des clés à ces appels, pas des appels par joueur ou par événement. Le coût commercial en crédits n’est pas déduit du nombre de requêtes ; le diagnostic prouve l’accès du compte et le nombre d’appels, pas son quota mensuel restant.

## Validité, suspension et règlement

Un nouveau prix est accepté à la collecte seulement si son horodatage fournisseur a moins d’une heure, n’est pas futur de plus d’une minute, et si la sélection n’est ni masquée ni suspendue. Les périodes, joueurs et conditions promotionnelles sont exclus de ce lot. Le prix est converti depuis le format américain explicitement, sans mélanger les lignes ni les issues.

Les nouvelles sélections ne sont jamais restaurées depuis un ancien cache : une absence à la collecte suivante les retire. L’expiration dure est fixée à **20 heures après l’horodatage fournisseur**, pour couvrir la nuit entre deux collectes. Le consensus expire avec son offre la plus ancienne. Le navigateur masque les offres expirées et la RPC refuse un prix expiré ou sans date de validité, même si un ancien onglet tente encore de le jouer. Une suspension non encore observée entre deux collectes ne peut pas être détectée en temps réel ; le site expose une cote collectée, pas une prise de pari chez le bookmaker.

Les prix acceptés et labels serveur sont figés dans le pari ; le règlement ne relit pas les prix courants. Les scores après prolongation/tirs au but ne remplacent jamais les scores à 90 minutes des nouveaux marchés. Sans score réglementaire fiable, le règlement attend une vérification. Une annulation rembourse la sélection ; dans un combiné/système, elle vaut une cote de 1. Tous les barèmes existants des ligues et le plafond de cote restent appliqués.

## Validation reproductible

```bash
npm test
node scripts/prepare-pages.mjs
PGLITE_MODULE=/tmp/bet-sql-tools/node_modules/@electric-sql/pglite/dist/index.js node scripts/check-markets-lot-one-sql.mjs
node scripts/check-markets-lot-one.mjs chemin/vers/propline-prices.json
```

PGlite 0.5.15 est installé dans un dossier temporaire, jamais comme dépendance du site. La recette vérifie la migration deux fois, la parité des labels JS/SQL, les paramètres falsifiés, les prix, la source réelle, l’expiration, l’idempotence et les doublons. Les tests JS couvrent frontières, remboursements, prolongations, règlement serveur et absence de modèle. Le workflow de PR « Vérifier les marchés et leur règlement » exécute les tests, les deux recettes SQL et la préparation Pages sans secret de production.

## Retour à l’étape 2

Remettre `PROPLINE_MARKET_STAGE` à `2` dans les deux étapes de `update-fixtures.yml`, publier ce changement puis relancer « Actualiser les matchs » pour retirer les nouvelles offres. Conserver V40 et le code de règlement tant que des paris de ce lot sont en attente. Ne pas annuler des paris acceptés pour réaliser un retour de version, ni supprimer leurs clés du moteur. Les sélections déjà placées continuent à être réglées normalement.

Activation du 3 novembre 2026 : V40 appliquée et vérifiée sur le projet BetMaster avant fusion. La connexion GitHub ne peut pas modifier les variables de dépôt (HTTP 403) ; l’étape 3 est donc fixée explicitement dans le workflow, comme l’étape 2 l’était précédemment.

## Correctif : dix bookmakers par cote

V41 après V40 impose désormais au moins 10 bookmakers distincts pour chaque sélection, sur tous les marchés. Le compteur est dérivé des offres de cette sélection ; ni un doublon, ni le total du match, ni une probabilité calculée ne remplacent une offre. La même règle vaut dans le navigateur, les tickets, les défis et les grilles. Les cotes des paris déjà pris restent conservées. Voir [le guide du seuil](MARKETS_SETUP.md#seuil-de-dix-bookmakers-bet-170-v41).

Avant de publier ce correctif, appliquer V41 et synchroniser le calendrier existant : cette synchronisation remplit `odds_bookmaker_counts` et retire les prix non qualifiés de `fixtures.odds`. Il n’est pas nécessaire de refaire une collecte fournisseur. Le contrôle de déploiement exige aussi la nouvelle colonne avant l’étape 3.
