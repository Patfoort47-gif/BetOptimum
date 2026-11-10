# Recherche sur la force des équipes (BET-316)

Le candidat Elo par identifiant ESPN est isolé dans `src/model/team-strength.js`, avec avantage domicile, K=20, total de buts fixé à 2,6 et conversion en intensités Poisson. Ces paramètres sont fixés avant le test. Il ne remplace **pas** le repli `model()` du pipeline : la condition d'acceptation « meilleur Brier et meilleure calibration avant activation » n'est pas satisfaite.

Étude du 10 novembre 2026, 548 snapshots Git, 392 matchs avant filtrage, 281 exploitables sans coupes à élimination directe. Séparation chronologique au 5 novembre : 92 matchs de test sur quatre journées. Brier 1N2 actuel 0,597256 ; Elo 0,630387 (dégradation +0,033131, intervalle bootstrap par journée à 95 % [+0,018172 ; +0,052523]). ECE actuel 0,062890 ; Elo 0,045806. La calibration agrégée s'améliore, le Brier se dégrade. Quatre journées ne permettent pas de conclure pour toutes les compétitions. Résultats par compétition et limites dans [la preuve JSON](evidence/lot18/team-strength.json).

Les résultats ne deviennent utilisables qu'après leur première publication Git attestée ; les prévisions sont calculées à la date du snapshot et non au coup d'envoi. Les coupes sont exclues sans preuve systématique du score à 90 minutes. Ni les cotes synthétiques ni les résultats futurs ne servent à entraîner les ratings. Cette archive courte n'est pas une saison d'apprentissage et ne démontre aucun gain généralisable.

Reproduction :

```sh
python3 scripts/extract-prediction-history.py /tmp/prematch.json b612be8
node scripts/evaluate-team-strength.mjs /tmp/prematch.json
```

Suite requise avant activation : acquérir un historique ESPN de résultats suffisamment long et attesté (score réglementaire inclus), couvrir chaque compétition ciblée, sélectionner les paramètres sur apprentissage/validation puis confirmer Brier et calibration sur un test chronologique intact, avec incertitude et comparaison au modèle réellement publié. Aucun appel Odds supplémentaire n'est nécessaire pour cette recherche. Aucune collecte supplémentaire n'est activée par cette livraison.
