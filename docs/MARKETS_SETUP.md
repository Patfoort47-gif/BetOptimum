# Marchés prioritaires (BET-153)

## Activation par étapes

Installer `supabase/migrations/supabase-v36-schema.sql` après V35 et déployer le nouveau code de règlement avant d’activer la collecte supplémentaire. Les paris existants gardent leurs identifiants, libellés et cotes enregistrés. La migration ne réécrit aucune sélection.

La variable Actions `PROPLINE_MARKET_STAGE` vaut **0 par défaut**. Elle sélectionne :

- **0** : 1N2, Over exactement 2,5, BTTS Oui (BET-152).
- **1** : ajoute BTTS Non, Under 2,5, Over et Under 1,5 et 3,5. Même requête et même fréquence.
- **2** : ajoute double chance 1N/N2/12, domicile/extérieur remboursé si nul et totaux par équipe sur les demi-lignes 0,5 à 5,5 effectivement fournies. Une ligne non prise en charge reste ignorée, sans arrondi ni substitution d’une ligne voisine.

Utiliser d’abord le workflow de diagnostic avec l’étape choisie. Il reste sans écriture et sans déploiement ; il vérifie les prix réels. Ne pas passer la variable de production à 1 ou 2 tant que le diagnostic correspondant et la migration SQL ne sont pas validés. Les marchés indisponibles ne sont ni inventés ni proposés ; les cinq marchés historiques conservent leur repli estimé. Un nouveau marché doit avoir une cote réelle côté serveur.

## Calcul et règlement

Chaque clé identifie le marché, le sens et la ligne. Les probabilités sont calculées depuis la même grille de scores de Poisson ; les totaux équipe utilisent uniquement les buts de l’équipe nommée. Pour le remboursé si nul, la probabilité affichée est celle d’une victoire, le remboursement est affiché séparément et la value vaut `P(victoire) × cote + P(nul) - 1`. Un nul vaut une sélection remboursée, retirée du produit des cotes ; le calcul vaut aussi pour chaque ligne de système. Match annulé : même règle. Aucun ajout de deux choix d’un même match à un combiné.

Les recommandations automatiques restent limitées aux cinq marchés historiques, en attendant une évaluation des nouveaux marchés. Une cote disponible et une probabilité calculée ne constituent pas une validation prédictive. Les nouvelles options sont des choix manuels.

Les cartes gardent les cinq choix essentiels visibles. Les choix supplémentaires sont répartis dans Résultat, Buts et Équipes, dépliables. La comparaison utilise les mêmes clés et lignes que le ticket. Les moyennes, compteurs, dates, provenance et indicateurs de cache sont calculés par sélection, sans mélanger les lignes ni les équipes.

## Recette

`npm test`, `node scripts/prepare-pages.mjs`, puis `PGLITE_MODULE=… node scripts/check-markets-sql.mjs` pour la recette SQL isolée. Tester à 320 et 1280 px : ouverture des familles, sélection, conservation lors d’une nouvelle sélection, comparaison horizontale et absence de débordement de la page. Vérifier dans le diagnostic réel les lignes exactes, les variantes régionales et les moyennes. Le contrôle du compte fournisseur peut refuser certains nouveaux marchés : garder alors l’étape précédente active.

Après prolongation ou tirs au but, les nouveaux marchés utilisent seulement les deux premières périodes ESPN. Si ces scores manquent, leur règlement attend une vérification ; il ne reprend pas le score final. Le champ `fixtures.regulation` conserve cette information. Les cinq marchés historiques conservent leur traitement existant.

## Validation réelle du 2 novembre 2026

Étape 1 : [diagnostic réussi](https://github.com/Patfoort47-gif/BetOptimum/actions/runs/41434367481), 13 rencontres, quatre compétitions, plusieurs bookmakers sur chaque sélection supplémentaire.

Étape 2 : [diagnostic réussi](https://github.com/Patfoort47-gif/BetOptimum/actions/runs/41434955697), doubles chances et remboursé si nul confirmés sur 13 rencontres de quatre compétitions. Aucune ligne `team_totals` renvoyée dans ces réponses : les totaux par équipe restent absents de la collecte réelle observée. Le parseur et le règlement sont testés avec des données simulées ; leur couverture réelle reste à vérifier lorsqu’une ligne est fournie.

Mise en production : V36 appliquée le 2 novembre 2026 au projet BetMaster ; le workflow de production utilise explicitement l’étape 2. Le paramètre du collecteur reste à 0 hors du workflow pour les autres usages. Une collecte manuelle d’administration est disponible pour vérifier une activation immédiate, sans nouvelle fréquence planifiée.

## Inventaire de tous les marchés (BET-154, lot 1)

Avant d’activer d’autres familles (périodes, joueurs, corners, cartons, combinés), il faut savoir ce que PropLine sert réellement avec notre compte. Le workflow manuel **« Inventorier les marchés PropLine »** (`.github/workflows/inventory-propline.yml`, `scripts/propline-inventory.mjs`) le relève en lecture seule :

- pour chaque compétition suivie, la liste des matchs à venir puis, pour 2 matchs au plus, les marchés stockés en match complet, en 1re et en 2e mi-temps (`/events/{id}/markets`, `period=h1|h2`) ;
- 56 requêtes par défaut (de quoi couvrir les 8 compétitions) (entrée `budget`, 60 au plus), une par une, sans nouvelle tentative, arrêt au premier refus d’accès ou de quota ;
- rapport `propline-inventory.md` et `propline-inventory.json` en artefact du job (7 jours) et dans son résumé : clé fournisseur, période, famille proposée, déjà collectée ou non, nombre de matchs, nombre d’issues, compétitions.

Il n’écrit rien dans le dépôt, ne touche ni `data/fixtures.json` ni Supabase et ne déploie rien. Une clé relevée n’est ni une couverture garantie ni un marché jouable : la [matrice BET-170](MARKETS_INVENTORY.md) documente le relevé réel du 3 novembre, les données nécessaires, les exclusions et les lots d’activation, et un marché non réglable de manière fiable reste désactivé pour les paris.

Le diagnostic reconnaît le champ réel `outcomes_count`. Une période est seulement un filtre demandé : des catalogues identiques à `full` déclenchent un avertissement, sans annoncer une couverture H1/H2. Les compteurs d’issues ne prouvent ni le nombre de bookmakers ni la présence de prix jouables. Le JSON historique est conservé tel quel dans `docs/evidence/` : ses compteurs inconnus ne doivent pas être interprétés comme des zéros réels.
Les nouveaux rapports conservent aussi `samples` (événement, compétition, période demandée et clés/compteurs), pour vérifier les ressemblances par match plutôt que sur la seule agrégation. Cela ne transforme pas une période demandée en période confirmée.
