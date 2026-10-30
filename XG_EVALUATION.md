# BET-99 · Expérience xG hors production

Le flux ESPN exploité par le projet ne fournit pas de xG dans les données existantes (CLAUDE.md). Aucun historique xG horodaté, fournisseur licencié ou abonnement utilisable n’est disponible dans ce checkout. L’intégration au modèle de production reste bloquée : aucun gain n’a été mesuré. Ne pas inventer de xG à partir des scores.

Un outil hors production compare les mêmes rencontres avec et sans mélange xG :

`node scripts/evaluate-xg.mjs /chemin/test.json 0.25`

Entrée : tableau de `{match, asOf, result, xg?}`. `match` suit analyseMatch, `result` vaut home/draw/away, `asOf` est l’instant historique de prédiction. `xg` contient home/away (estimations de buts issues des historiques offensifs/défensifs, pas les xG du match à prédire) et availableAt, strictement antérieur à asOf. Absence ou date future : repli inchangé. Sortie : Brier multiclasses, log-loss, couverture et calibration par décile.

Avant une vraie comparaison : choisir fournisseur, licence, coût et compétitions ; documenter la provenance et la date de chaque historique. Construire des ensembles chronologiques entraînement/validation/test, ajuster la pondération uniquement sur validation puis la figer pour le test. Comparer couverture et sous-groupes ; mesurer l’incertitude du gain. L’outil ne prouve pas à lui seul l’absence de fuite dans la construction des entrées.

Tests synthétiques : métriques et repli uniquement, aucune conclusion de précision réelle. Les pronostics publiés restent inchangés. L’activation exige un gain documenté et une source autorisée.
