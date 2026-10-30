# BET-99 · Comparaison xG hors production

![StatsBomb](docs/statsbomb-logo.svg)

Source des données : **StatsBomb Open Data**. Logo officiel inchangé issu de `statsbomb/logos`, révision `d90a0ca2bd62550ad7dabc7b3a1c21a00538644d`, fichier `HudlStatsbomb_Python.svg`. StatsBomb n’approuve pas nécessairement les conclusions de cette analyse.

## Décision

**Conserver le modèle de production actuel.** La variante xG n’a pas amélioré les métriques sur l’échantillon de test tenu à l’écart. Aucun xG de recherche n’est injecté dans les matchs publiés et aucun pronostic historique n’est réécrit.

Cette conclusion applique le critère du ticket : activer seulement en présence d’un gain documenté ; sinon livrer les résultats et conserver la référence. Elle ne démontre pas que tous les modèles xG seraient inutiles.

## Source et périmètre

Dépôt officiel : https://github.com/statsbomb/open-data

Révision : `4b73468fc5b0f1950f9f66fada70ad3a4f9327cb`. Compétition 11, saison 27 : Liga 2015/2016, 380 matchs et 20 équipes. Les xG sont ceux des tirs fournis par StatsBomb, additionnés par équipe et match. L’intégrité des téléchargements repose sur HTTPS et la révision figée ; les sommes SHA-256 des réponses sont conservées dans le cache de recherche.

Licence officielle : https://github.com/statsbomb/open-data/blob/4b73468fc5b0f1950f9f66fada70ad3a4f9327cb/LICENSE.pdf

Elle permet l’analyse et la recherche, interdit l’exploitation commerciale et la redistribution du jeu source, et exige l’attribution et le logo lors de la publication d’analyses. Le jeu téléchargé reste hors du dépôt. Cette source historique n’est pas un flux couvrant les matchs actuels du site. Une future intégration opérationnelle demanderait de vérifier une couverture et des droits adaptés.

## Protocole

- Référence : formule de forme du pipeline, six matchs précédents au plus et deux au minimum par équipe ; moyennes buts marqués/encaissés, facteurs domicile 1,08 / extérieur 0,92 et bornes 0,3 à 3,5.
- Variante : même calcul à partir des xG pour/contre, mélangé à la référence. Candidats de pondération : 0, 0,25, 0,5, 0,75, 1.
- Pour chaque prédiction, seuls les matchs antérieurs sont disponibles. Hypothèse conservatrice du backtest : informations d’un match utilisables 48 h après le début de sa date UTC. Ce n’est pas une date réelle de publication StatsBomb en 2015.
- Construction des paramètres avant ajout du résultat et des xG du match courant. Les tests vérifient qu’une modification du match courant ou futur ne change pas ses paramètres.
- Découpage par dates : historique initial avant le 19 décembre 2015 (130 prédictions exploitables), validation du 19 décembre au 1er mars inclus (112), test à partir du 2 mars 2016 (118). Vingt matchs servent uniquement à l’amorçage.
- Choix du poids sur le Brier de validation uniquement ; poids retenu **0,75**, figé avant le test. Le test n’est pas réutilisé pour choisir un autre poids.
- Critères suivis : Brier multiclasses, log-loss, calibration par décile et couverture. Rééchantillonnage apparié de 2 000 tirages, graine 99, pour l’incertitude du delta de Brier. Un minimum de 200 matchs de test aurait été demandé pour envisager une activation ; ce seuil n’est pas atteint.

## Résultats sur le test

| Mesure, plus faible = meilleur | Référence | Variante xG à 0,75 |
| --- | ---: | ---: |
| Matchs évalués | 118 | 118 |
| Brier multiclasses | 0,597554 | 0,599474 |
| Log-loss | 1,005422 | 1,006078 |

Couverture de la variante sur ce test : 118/118. Delta Brier variante moins référence : **+0,001920**, donc légère dégradation. Intervalle bootstrap à 95 % : **[−0,022755 ; +0,025164]**, compatible avec un gain comme avec une dégradation. Calibration de la variante : décile 20–30 %, 166 probabilités, moyenne prédite 25,52 %, fréquence observée 22,89 % ; décile 40–50 %, 64 probabilités, moyenne prédite 44,27 %, fréquence observée 54,69 %. Les autres déciles sont disponibles dans le rapport généré ; certains ont trop peu de cas pour être interprétés.

Limites : une compétition et une saison anciennes, échantillon de test réduit, données et modèle xG fournis rétrospectivement et potentiellement corrigés depuis les matchs. La référence reproduit la formule du pipeline à partir de l’historique StatsBomb ; elle ne reconstitue pas des snapshots historiques football-data.org. Il s’agit d’une comparaison de modèles, pas d’un calcul de rendement de paris. Les cotes neutres utilisées par le moteur ne servent pas aux métriques de probabilité.

## Reproduction

Depuis la racine du dépôt, avec Python 3 et Node :

```sh
python3 scripts/download-xg-research.py /tmp/bet-xg-research
node scripts/backtest-xg.mjs /tmp/bet-xg-research/summaries.json > /tmp/bet-xg-research/report.json
npm test
```

Le téléchargement utilise quatre requêtes parallèles au plus et réutilise les fichiers vérifiés par décompression/lecture JSON du cache. Il ne désactive ni TLS ni la vérification des téléchargements npm. Ne pas placer ce cache sous la racine publiée du site. Le rapport et les données locales ont été effectivement générés pendant cette tâche ; l’exécution du script versionné a reproduit les mêmes résultats.

L’outil plus général `node scripts/evaluate-xg.mjs donnees-test.json ponderation-fixee` reste disponible. L’absence de xG ou une information future laisse la référence inchangée. Aucune activation n’est commandée par ces scripts.
