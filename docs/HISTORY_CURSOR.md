# BET-193 · Cinq paris et chargement progressif

V48 après V47 ajoute `my_bet_history`, une RPC distincte de `my_bet_dashboard` pour préserver les consommateurs existants du profil. Elle renvoie cinq tickets maximum et un curseur privé `(placed_at, id, snapshot_at)`, tri décroissant date/UUID. Une sixième ligne est seulement observée côté serveur pour déterminer s’il reste un lot. La borne de création et la période restent fixées au snapshot entre les lots : un nouveau pari n’est pas inséré au milieu de la lecture. Actualiser repart d’un nouveau snapshot. Le détail complet et les KPI sont agrégés côté serveur, indépendamment des cinq lignes renvoyées. La banque disponible reste le solde global actuel.

Le navigateur ajoute les nouveaux nœuds sans remplacer les anciens, déduplique par identifiant, bloque les clics pendant la requête et garde le même curseur en cas d’erreur. Charger plus/Réessayer conserve la lecture et les panneaux déjà ouverts. La fin et le vide sont explicites. Après plus d’un lot, les rendus d’arrière-plan conservent la lecture ; Actualiser les paris ou un changement de filtres repart des cinq derniers. Une confirmation de nouveau pari déclenche une actualisation explicite. Les réponses obsolètes sont ignorées après changement de filtre ou déconnexion.

La synchronisation hebdomadaire utilisée par les quotas n’est pas remplacée ; aucun téléchargement complet de l’historique n’est ajouté pour le masquer ensuite. Aucun solde, statut ou pari n’est écrit par cette RPC.

Validation : 387 tests Node, recette PostgreSQL isolée V48 (96 combinaisons de filtres, dates identiques et UUID, limite 5, ajout concurrent, curseurs invalides, isolation/authentification) et recette V47 de compatibilité. Chromium `scripts/check-history-cursor.cjs` et `scripts/check-bankroll-kpis.cjs` aux huit largeurs : clics en rafale, même lot après échec, nœuds conservés, cinq lignes par lot, ajout concurrent, agrégats complets, actualisation et vide. API `personalHistory` et RPC V48 à déployer avant le nouveau client.

## BET-381 · Mesure et décision du 19 novembre 2026

PostgreSQL 17.11 en production, 72 tickets au total. Lecture seule. Le corps SQL de
la RPC V53 a été expliqué sur l’historique du compte qui a le plus de tickets. Le
solde projeté a été remplacé par une constante et les identifiants ont été
retirés des [plans](evidence/BET-381-plans.json). Les écritures, l’appel HTTP et la
latence mobile ne font pas partie de la mesure. La construction des bornes du
curseur et la recherche du compte représentatif sont incluses dans le plan.

| Cas | Planification (ms) | Exécution, deux passages (ms) | Blocs partagés en cache |
| --- | ---: | ---: | ---: |
| Tous, première page | 3,4 | 6,8 à 7,3 | 32 |
| Tous, page suivante | 3,2 | 3,6 à 8,7 | 83 |
| Sept jours, réglés | 3,9 | 2,2 à 3,1 | 32 |
| Sept jours, en attente | 3,6 | 1,6 à 1,9 | 32 |
| Recherche « victoire », première page | 8,5 | 1,9 | 32 |
| Recherche « victoire », après le curseur | 3,2 | 2,8 à 3,0 | 32 |
| Recherche sans résultat | 2,7 | 2,0 | 32 |

Aucun bloc lu hors cache et aucun fichier temporaire dans ces plans. Le parcours
séquentiel de la petite table et les agrégats donnent des temps de la même
ampleur entre les pages. L’index existant `(user_id, placed_at DESC)` couvre
le préfixe utile. La mesure ne justifie pas d’ajouter le second index avec
`id DESC` ni de modifier la RPC, dont les anciens clients utilisent la réponse
complète. Réévaluer sur une volumétrie supérieure ou si les temps serveur
augmentent durablement.

Sur le navigateur, une page suivante ne reconstruit plus les graphiques ni les
indicateurs de la période. Un changement de filtres ou une actualisation les
recalcule d’après la nouvelle première page. La réponse du serveur et les
contraintes du curseur restent compatibles avec les clients déjà déployés.
