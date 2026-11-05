# BET-181 : performances de Matchs

Cause confirmée : `forecastMatch` redécodait les identifiants de marchés pour chacune des 1 681 cases de sa grille Poisson. Les différents blocs de l’accueil recalculaient ensuite la même prévision. Enfin, toutes les catégories repliées et les grandes tables bookmakers étaient construites dès l’accueil.

La correction décode chaque marché une fois par prévision, réutilise au plus 512 prévisions (clé comprenant paramètres, cotes et marchés réels), renvoie des copies indépendantes et construit catégories secondaires et comparaisons seulement à leur ouverture. Une cote ou des paramètres modifiés invalident la prévision ; les contrôles de fraîcheur et de dix bookmakers restent recalculés, hors de ce cache. Aucune règle de pronostic, de cote, de règlement ou de classement n’est modifiée.

## Mesures locales du 5 novembre 2026

Chromium, 360 × 900 px, CPU ralenti ×4, trois contextes neufs par version, animations réduites, services externes bloqués. Quinze matchs du calendrier `51792f5`, choisis par nombre de marchés décroissant (140 à 142), sont replacés à aujourd’hui avec un coup d’envoi futur. Le compte et l’archive sont simulés. Même calendrier pour les deux versions. Les requêtes sont interceptées : cette mesure porte sur l’exécution et le rendu, pas sur le cache HTTP ni le réseau de production.

| Médiane de trois essais | Avant | Après |
| --- | ---: | ---: |
| Navigation jusqu’à 15 cartes disponibles | 47 432 ms | 5 491 ms |
| Filtre Favoris puis retour à tous, deux rendus | 45 790 ms | 2 428 ms |
| Sélection d’un pronostic jusqu’au prochain frame | 485 ms | 38 ms |
| Éléments DOM après sélection | 66 511 | 4 356 |

Aucune erreur JavaScript. Les nombres ne constituent pas des mesures sur un vrai téléphone. Le chargement reste mesurable avec quinze rencontres riches en marchés, mais les choix du ticket répondent en quelques dizaines de millisecondes dans cette recette. Le contrôle complémentaire ouvre la comparaison et une catégorie, puis sélectionne une alternative.

Micro-mesure Node sur ces quinze matchs : 1 878 ms avant contre 398 ms après le seul pré-décodage, analyses strictement identiques (comparaison profonde de tous les champs). Les tests vérifient aussi l’absence de partage mutable et l’invalidation des prévisions.

## Reproduction

Installer Playwright hors du dépôt, démarrer `python3 -m http.server 4173 --bind 127.0.0.1`, puis :

```sh
mkdir -p work/before
# Référence complète : 51792f5
 git show 51792f5:app.js > work/before/app.js
 git show 51792f5:markets.js > work/before/markets.js
 git show 51792f5:prediction-model.js > work/before/prediction-model.js
node --input-type=module - <<'JS'
import fs from 'node:fs';
const matches=JSON.parse(fs.readFileSync('data/fixtures.json')).matches.filter(m=>m.homeGoals>0&&m.awayGoals>0).sort((a,b)=>Object.keys(b.odds).length-Object.keys(a.odds).length).slice(0,15);
fs.writeFileSync('work/benchmark-matches.json',JSON.stringify(matches));
JS
NODE_PATH=/tmp/bet-ui-tools/node_modules node scripts/measure-match-performance.cjs
```

Pour retrouver exactement l’échantillon, lire le calendrier de la référence `51792f5` au lieu du calendrier courant dans la préparation. Résultats dans `work/performance-results.json`. `BET_BENCH_VERSIONS=after` et `BET_BENCH_RUNS=1` permettent une recette fonctionnelle courte.
