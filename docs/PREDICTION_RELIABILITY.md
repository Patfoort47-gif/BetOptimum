# Fiabilité du bilan public · lot 14

BET-299 : le bilan et ses graphiques utilisent les cotes réelles vérifiées par défaut. Le filtre Origine des cotes permet de consulter les cotes synthétiques, inconnues ou toute l’archive. Une cote synthétique ne correspond pas à une offre réalisable. Aucun résultat n’est supprimé ni recalculé après le match.

Les nouvelles entrées conservent `oddsSource`, la version du modèle et l’heure de capture lorsqu’elles existent. L’archive historique est annotée par `python3 scripts/mark-prediction-provenance.py` : concordance exacte du choix, de la cote et de la probabilité avec un pronostic stocké dans Git, puis indicateur `real` / `basis` ou couverture `realOddsMarkets` du même prix. L’absence de couverture réelle dans ces anciennes fixtures correspond au repli synthétique du collecteur historique. Sans preuve suffisante, l’origine reste inconnue. Le commit justificatif est conservé dans chaque ligne. Ces preuves identifient l’origine du prix, pas la qualité de la capture prématch.

Validation : tests Node et navigateur Chromium à 390 et 1440 px, filtres, réinitialisation, conservation des 362 entrées, absence de débordement et d’erreur JavaScript. Les chiffres détaillés et le déploiement sont consignés dans YouTrack.

## Calibration · BET-300

Le bilan trace annoncé / observé par tranches de 10 points et affiche les effectifs, intervalles de Wilson à 95 % et Brier binaire (plus bas est meilleur). Les probabilités invalides, attentes et remboursements sont exclus. Les filtres du bilan s’appliquent aussi à cette mesure. Un intervalle de Wilson décrit ici une incertitude binomiale indicative : des choix corrélés et un modèle évolutif limitent son interprétation.

Évaluation reproductible :

```sh
node scripts/evaluate-prediction-model.mjs --archive data/predictions-history.json
```

Le mode historique de recherche reste disponible : extraction des snapshots prématch par `scripts/extract-prediction-history.py`, puis passage de ce fichier au même évaluateur sans `--archive` pour les variantes de modèle 1N2/BTTS/totaux. Ne pas confondre ce score multivarié avec le Brier binaire du seul choix archivé.

Archive au 10 novembre 2026 : 141 choix à cote réelle, 73,54 % annoncés en moyenne contre 68,79 % observés, Brier binaire 0,18035. L’essai d’ajustement multiplicatif par marché apprend uniquement sur les premières dates (70 % des dates distinctes, journées entières), avec facteurs bornés entre 0,5 et 1,5 et probabilités bornées entre 0 et 1. Il utilise 64 choix sur 8 jours pour l’apprentissage et 77 sur 4 jours pour le test. Sur ce test, Brier avant 0,14817, après 0,18632 : dégradation. Les seuils fixés avant activation exigent au moins 200 observations d’apprentissage et 100 de test par marché évalué, ainsi que 14 jours d’apprentissage et 7 de test. Ils ne sont pas atteints. Les heures de capture prématch ne sont pas prouvées pour toute l’archive et les versions successives du modèle sont mélangées.

**Décision : aucune correction activée.** Les facteurs restent expérimentaux dans le script, sans branchement sur le modèle de production et sans réécriture des probabilités archivées. Les nouvelles entrées conservent capture, coup d’envoi et version du modèle pour permettre une validation prospective. Une validation prospective et indépendante reste nécessaire si le volume devient suffisant. Le diagnostic public est descriptif ; il ne démontre aucun rendement futur.

Validation : 467 tests Node, préparation Pages, recette Chromium 390 et 1440 px. Courbe et tableau présents, filtres et réinitialisation cohérents, pas de débordement ni d’erreur JavaScript. Aucune migration SQL ni fonction Edge nécessaire.
