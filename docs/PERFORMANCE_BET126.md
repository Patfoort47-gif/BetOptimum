# BET-126 : fluidité des interactions

Mesure locale du 31 octobre 2026, avant : révision 6768596 intacte ; après : candidat BET-126. Chromium, viewport 360 × 900, CPU ralenti ×4, réduction des animations. Trente matchs synthétiques identiques dans chaque version ; comptes et réponses de données simulés, appels externes bloqués. Trois pages neuves par version, cinq sélections et changements de mise par page, soit quinze observations par action et par version.

Le chronomètre mesure uniquement l’exécution synchrone du gestionnaire JavaScript, via un clic programmatique puis un événement input. Il ne mesure ni INP complet, ni réseau, ni rendu écran, ni vitesse globale du site. Les requêtes sont interceptées pour cette comparaison CPU : ce protocole ne permet pas de comparer le cache HTTP.

| Médiane locale | Avant | Après |
| --- | ---: | ---: |
| Sélection d’une cote | 215,5 ms | 15,0 ms |
| Changement de mise | 184,6 ms | 9,3 ms |
| Remplacement de la liste pendant une sélection | 1 | 0 |
| Remplacement de la liste pendant une saisie de mise | 1 | 0 |

Le gain observé vient notamment de la suppression du rendu complet des matchs à chaque modification du ticket. Le nombre de modules initiaux reste à vingt dans ce scénario : le chargeur JSON ajouté compense le module fiches différé. Aucun pourcentage d’amélioration du chargement global n’est déduit de ces chiffres. Résultats bruts : ticket-benchmark-bet126.json.

Reproduction : servir deux instantanés locaux, original 6768596 et candidat, avec python3 -m http.server, en liant les serveurs à 127.0.0.1. Puis :

```sh
BET_BENCH_BEFORE_URL=http://127.0.0.1:4174 BET_BENCH_AFTER_URL=http://127.0.0.1:4173 NODE_PATH=/tmp/bet-ui-tools/node_modules node scripts/measure-ticket.cjs
```

Le script utilise un calendrier synthétique sans modifier data/. Le rapport JSON est écrit dans /tmp/bet-ticket-benchmark.json, ou dans BET_BENCH_REPORT. Outils externes décrits dans TESTING_UI.md.

## Contrôles fonctionnels

- Tests Node pour les règles métier, mutualisation et réessai des JSON, intégrité des fichiers nécessaires à la publication.
- Recette publique Chromium, parcours de connexion simulés, erreurs de pari, liens directs, navigation clavier et Axe.
- Recette responsive sur 34 combinaisons de largeur et thème, cinq destinations chacune.
- Recette spécifique à 360 et 1280 px : archive lente indépendante, fiche absente du démarrage puis chargée au clic, cartes conservées lors des sélections et saisies, conservation des autres cartes avec détails ouverts lors d’une mise à jour, calendrier identique sans reconstruction, archive non répétée, URL stables, bilan caché non redessiné et fermeture de fiche pendant une réponse lente sans erreur.

Les comptes, achats, RPC de production, fournisseurs de cotes et performances sur de vrais téléphones ne sont pas validés par cette recette locale.

Validation finale : 229 tests Node réussis, recette publique réussie avec zéro violation Axe détectée, 34 configurations responsive validées, recette de stabilité réussie à 360 et 1280 px. La racine contient désormais 66 fichiers suivis, contre 122 initialement. Aucun déploiement effectué pendant l’intervention.
