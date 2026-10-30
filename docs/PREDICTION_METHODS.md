# BET-115 : audit des pronostics et méthodes comparées

## Constat

À la révision `b6b299f6af4a356bc0a960b60e3343aebba1d37b`, 280 snapshots du calendrier permettent de retrouver 177 matchs réglés entre le 21 et le 29 octobre 2026 avec des paramètres disponibles au moins une heure avant leur coup d’envoi. Le dernier snapshot éligible est retenu pour chaque match, puis rapproché de son résultat officiel. Les pronostics enregistrés proposaient BTTS sur 132 matchs (74,6 %), Over sur 37, domicile sur 7 et extérieur sur 1.

Causes : le tri maximise surtout la probabilité brute, alors qu’un « oui » BTTS regroupe beaucoup de scores et que le 1N2 partage sa masse entre trois issues. Une probabilité BTTS élevée n’indique pas une meilleure qualité de prédiction. Des cotes estimées à partir des paramètres initiaux restaient aussi inchangées après intégration de la forme ; calculer une value avec ces prix synthétiques produisait des avantages artificiels. Enfin, la grille limitée à huit buts par équipe perdait une partie de sa masse pour les équipes très offensives.

## Méthodes comparées

| Méthode | Intérêt | Limite |
| --- | --- | --- |
| Poisson indépendant normalisé | Référence simple, distribution de scores cohérente | Suppose les deux nombres de buts indépendants |
| Régularisation à 25 % ou 50 % | Réduit les extrêmes d’une forme calculée sur peu de matchs | Moyennes génériques 1,45 / 1,15, pas un prior appris par compétition |
| Dixon-Coles, rho = −0,10 | Corrige les faibles scores corrélés, notamment 0-0 et 1-1 | Coefficient expérimental fixé, pas estimé sur une longue série |
| Poisson + marché à 50 % | Confronte le modèle aux informations reflétées dans les prix | Requiert des cotes 1N2 réelles complètes et plausibles |
| Régularisation 25 % + Dixon-Coles + marché 50 % | Combine ces trois informations | Plus de paramètres et risque de surajustement |

Le consensus est calculé par normalisation de `1 / cote` sur le 1N2 réel complet. Le mélange réalloue la masse de la grille au sein des catégories domicile/nul/extérieur, en préservant la distribution conditionnelle des scores du modèle. Il ne traite pas les cinq marchés comme des événements exclusifs. Sans 1N2 réel complet, sa contribution est nulle ; les cotes estimées ne servent jamais de consensus. Cette normalisation simple n’élimine pas tous les biais de marge ou d’agrégation des prix.

Référence de Dixon-Coles : Dixon et Coles (1997), *Modelling Association Football Scores and Inefficiencies in the Football Betting Market*, https://doi.org/10.1111/1467-9876.00065. Pour les xG, l’expérience du dépôt reste documentée dans `XG_EVALUATION.md` : elle n’avait pas démontré de gain et sa source historique ne couvre pas les matchs actuels. Un Elo ou un modèle attaque/défense par compétition serait une autre piste, mais nécessiterait un historique opérationnel plus long et correctement daté.

## Comparaison chronologique

103 matchs du 21 au 26 octobre servent au choix des paramètres, 74 du 27 au 29 octobre au test final. Le critère de choix est la moyenne de trois Brier : Brier 1N2 divisé par trois, Brier Over et Brier BTTS. Les six candidats sont fixés avant ce test. La référence de cette comparaison est le Poisson normalisé, pas la grille tronquée de l’ancien code.

La combinaison des trois méthodes gagne sur la période de réglage (Brier moyen 0,235744 contre 0,240934), mais **se dégrade sur le test tenu à l’écart** :

| Mesure, plus faible = meilleur | Poisson normalisé | Combinaison retenue sur le réglage |
| --- | ---: | ---: |
| Brier 1N2 | 0,684945 | 0,690235 |
| Log-loss 1N2 | 1,120640 | 1,133583 |
| Brier Over | 0,243765 | 0,245190 |
| Brier BTTS | 0,238066 | 0,240207 |
| Brier moyen | 0,236715 | 0,238492 |

Delta de Brier moyen : +0,001777. Bootstrap par journée, 2 000 tirages avec graine fixe : intervalle indicatif à 95 % [−0,000175 ; +0,003476]. Seulement trois journées de test : cet intervalle est fragile et ne prouve pas un gain. 70 des 177 matchs seulement ont un 1N2 réel complet. Aucun rendement financier n’est inféré de cotes synthétiques. Le rapport agrégé est dans `docs/prediction-evaluation.json`.

**Décision : aucune activation de la combinaison.** Elle reste disponible pour expérimentation explicite, avec pondérations nulles en production. Une saison complète par compétition, une validation glissante, une calibration par marché et une période finale indépendante seront nécessaires avant de revendiquer une amélioration de précision.

## Corrections livrées

- Distribution Poisson normalisée avec une queue jusqu’à 40 buts, cohérente entre 1N2, BTTS et total ; tests contre les formules analytiques.
- Aucune value sur cotes estimées. Priorité aux marchés réels éligibles dans la sélection rapide ; aucun quota artificiel contre BTTS. Les cotes réelles peuvent être conservées en cache : leur date reste affichée, une cote réelle n’est pas nécessairement fraîche.
- Trois lectures visibles : issue 1N2 la plus probable, Over/Under et BTTS oui/non. L’écart avec l’alternative est descriptif, pas une confiance calibrée. Les issues négatives non proposées par le serveur restent des analyses sans bouton de pari.
- Mention des moyennes génériques quand aucune forme réelle n’est disponible. Une sélection fondée uniquement sur des prix synthétiques est appelée « simulation du modèle ».
- Recalcul de la lecture des rencontres encore à venir ; les pronostics historiques enregistrés ne sont pas réécrits.

Après correction, sur les mêmes 177 snapshots : BTTS 113, Over 19, domicile 30, extérieur 10, nul 5. Ce changement de répartition ne constitue **pas** une mesure d’amélioration de précision ou de rendement. BTTS reste fréquent lorsque c’est l’événement le plus probable parmi ceux proposés.

## Reproduction

Depuis la racine du dépôt :

```sh
python3 scripts/extract-prediction-history.py /tmp/bet-prematch.json b6b299f6af4a356bc0a960b60e3343aebba1d37b
node scripts/evaluate-prediction-model.mjs /tmp/bet-prematch.json > /tmp/bet-prediction-evaluation.json
npm test
```

L’extraction utilise uniquement Git et ne contacte aucun fournisseur. Les scores et cotes du jeu de test ne servent pas à ajuster les paramètres de la combinaison. Les snapshots restent hors de la racine publiée pour limiter le volume du site. Aucune modification manuelle de `data/fixtures.json` ni de `data/predictions-history.json`.
